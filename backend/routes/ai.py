import os
import json
from groq import Groq
from flask import Blueprint, jsonify, request, Response, stream_with_context
from database import db
from models import Note, Concept, NoteLink, ChatMessage

ai_bp = Blueprint("ai", __name__)
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

FAST_MODEL = "llama-3.1-8b-instant"
CHAT_MODEL = "llama-3.1-8b-instant"

ANALYSIS_SYSTEM_PROMPT = """You are a knowledge graph AI. Your job is to analyze notes and extract structured intelligence.

You MUST return ONLY a valid JSON object with this exact schema — no preamble, no markdown fences, no explanation:
{
  "summary": "2-3 sentence summary of the note",
  "concepts": [
    {"name": "concept name (max 3 words)", "category": "one of: technology|person|place|event|idea|method|tool|other"}
  ],
  "suggested_links": [
    {"target_note_id": 1, "relationship": "one sentence describing how these notes relate", "strength": 0.8}
  ]
}

Rules:
- Extract 3-8 concepts. Be precise. Prefer specific over generic.
- Only suggest links with strength >= 0.45. Quality over quantity.
- Never hallucinate note IDs. Only reference IDs present in the provided context.
- summary must be under 80 words.
- If no meaningful links exist, return an empty array for suggested_links.
- Return ONLY the JSON. No backticks. No commentary."""


def format_context_notes(notes):
    if not notes:
        return "No other notes exist yet."
    lines = []
    for n in notes:
        concepts_str = ", ".join(c.name for c in n.concepts) if n.concepts else "none"
        lines.append(
            f"[ID:{n.id}] Title: {n.title}\n  Summary: {n.summary or 'Not yet analyzed'}\n  Concepts: {concepts_str}"
        )
    return "\n\n".join(lines)


def cors_response(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response


@ai_bp.route("/analyze/<int:note_id>", methods=["POST"])
def analyze_note(note_id):
    note = Note.query.get_or_404(note_id)

    if not note.content or len(note.content.strip()) < 30:
        return jsonify({"error": "Note content is too short to analyze (min 30 chars)"}), 400

    other_notes = Note.query.filter(Note.id != note_id).all()
    context_str = format_context_notes(other_notes)

    user_prompt = f"""Analyze this note:

Title: {note.title}
Content:
{note.content}

---
Other notes in this knowledge base (for link discovery):
{context_str}

Return ONLY the JSON object. No markdown, no explanation."""

    try:
        response = client.chat.completions.create(
            model=FAST_MODEL,
            max_tokens=1200,
            messages=[
                {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)

    except json.JSONDecodeError as e:
        return jsonify({"error": f"AI returned malformed JSON: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Groq API error: {str(e)}"}), 500

    Concept.query.filter_by(note_id=note_id).delete()
    for c in result.get("concepts", []):
        db.session.add(Concept(note_id=note_id, name=c["name"], category=c.get("category", "other")))

    NoteLink.query.filter_by(source_id=note_id).delete()
    valid_note_ids = {n.id for n in other_notes}
    for link in result.get("suggested_links", []):
        tid = link.get("target_note_id")
        if tid and tid in valid_note_ids and link.get("strength", 0) >= 0.45:
            db.session.add(
                NoteLink(
                    source_id=note_id,
                    target_id=tid,
                    relationship=link["relationship"],
                    strength=float(link["strength"]),
                )
            )

    note.summary = result.get("summary", "")
    note.analyzed = True
    db.session.commit()

    return jsonify({
        "summary": note.summary,
        "concepts": [c.to_dict() for c in Concept.query.filter_by(note_id=note_id).all()],
        "links": [l.to_dict() for l in NoteLink.query.filter_by(source_id=note_id).all()],
        "link_count": NoteLink.query.filter_by(source_id=note_id).count()
            + NoteLink.query.filter_by(target_id=note_id).count(),
    })


@ai_bp.route("/chat", methods=["POST", "OPTIONS"])
def chat():
    # Handle CORS preflight
    if request.method == "OPTIONS":
        res = Response()
        res.headers["Access-Control-Allow-Origin"] = "*"
        res.headers["Access-Control-Allow-Headers"] = "Content-Type"
        res.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        return res

    data = request.get_json()
    user_message = data.get("message", "").strip()
    history = data.get("history", [])

    if not user_message:
        return jsonify({"error": "Message is required"}), 400

    notes = Note.query.all()
    if notes:
        note_context_parts = []
        for n in notes:
            concepts_str = ", ".join(c.name for c in n.concepts) if n.concepts else ""
            part = f"### {n.title} (ID: {n.id})\n"
            if n.summary:
                part += f"Summary: {n.summary}\n"
            if concepts_str:
                part += f"Concepts: {concepts_str}\n"
            part += f"Content:\n{n.content[:800]}"
            note_context_parts.append(part)
        knowledge_base = "\n\n---\n\n".join(note_context_parts)
    else:
        knowledge_base = "The knowledge base is empty. No notes have been created yet."

    system_prompt = f"""You are Synapse, an intelligent knowledge assistant. You answer questions grounded in the user's personal knowledge base.

KNOWLEDGE BASE:
{knowledge_base}

Guidelines:
- Ground your answers in the notes above. Cite note titles when relevant.
- If the answer isn't in the notes, say so clearly — don't hallucinate.
- Be concise, analytical, and direct.
- You can make connections between notes and synthesize insights."""

    def generate():
        try:
            messages = [{"role": "system", "content": system_prompt}]
            messages += [{"role": m["role"], "content": m["content"]} for m in history]
            messages.append({"role": "user", "content": user_message})

            stream = client.chat.completions.create(
                model=CHAT_MODEL,
                max_tokens=1024,
                messages=messages,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield f"data: {json.dumps({'delta': delta})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'delta': f'Error: {str(e)}'})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    resp = Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
    )
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Cache-Control"] = "no-cache"
    resp.headers["X-Accel-Buffering"] = "no"
    return resp


@ai_bp.route("/chat/history", methods=["GET"])
def get_chat_history():
    messages = ChatMessage.query.order_by(ChatMessage.created_at.asc()).limit(100).all()
    return jsonify([m.to_dict() for m in messages])


@ai_bp.route("/chat/clear", methods=["DELETE"])
def clear_chat():
    ChatMessage.query.delete()
    db.session.commit()
    return jsonify({"cleared": True})