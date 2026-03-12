from flask import Blueprint, jsonify, request
from database import db
from models import Note, Concept, NoteLink
from datetime import datetime

notes_bp = Blueprint("notes", __name__)


@notes_bp.route("/", methods=["GET"])
def list_notes():
    notes = Note.query.order_by(Note.updated_at.desc()).all()
    return jsonify([n.to_dict(include_content=False) for n in notes])


@notes_bp.route("/", methods=["POST"])
def create_note():
    data = request.get_json()
    if not data or not data.get("title"):
        return jsonify({"error": "Title is required"}), 400

    note = Note(title=data["title"], content=data.get("content", ""))
    db.session.add(note)
    db.session.commit()
    return jsonify(note.to_dict()), 201


@notes_bp.route("/<int:note_id>", methods=["GET"])
def get_note(note_id):
    note = Note.query.get_or_404(note_id)
    return jsonify(note.to_dict())


@notes_bp.route("/<int:note_id>", methods=["PUT"])
def update_note(note_id):
    note = Note.query.get_or_404(note_id)
    data = request.get_json()

    if "title" in data:
        note.title = data["title"]
    if "content" in data:
        note.content = data["content"]
        # Mark as un-analyzed if content changed significantly
        if len(data["content"]) > 50:
            note.analyzed = False

    note.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(note.to_dict())


@notes_bp.route("/<int:note_id>", methods=["DELETE"])
def delete_note(note_id):
    note = Note.query.get_or_404(note_id)
    db.session.delete(note)
    db.session.commit()
    return jsonify({"deleted": True})


@notes_bp.route("/graph", methods=["GET"])
def get_graph():
    notes = Note.query.all()
    links = NoteLink.query.all()

    nodes = []
    for n in notes:
        degree = len(n.outgoing_links) + len(n.incoming_links)
        nodes.append({
            "id": n.id,
            "title": n.title,
            "summary": n.summary,
            "analyzed": n.analyzed,
            "concepts": [c.name for c in n.concepts],
            "degree": degree,
            "word_count": len(n.content.split()) if n.content else 0,
        })

    edges = [l.to_dict() for l in links]
    return jsonify({"nodes": nodes, "edges": edges})
