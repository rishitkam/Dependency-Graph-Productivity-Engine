# claude.md — Synapse AI Context

## Project Overview
Synapse is an AI-powered knowledge management app. Users write notes, and Claude automatically:
1. Extracts key concepts and their categories
2. Generates concise summaries
3. Discovers semantic relationships between notes
4. Answers questions grounded in the user's notes (RAG)

## Architecture
```
backend/   Flask REST API (port 5000) + SQLite via SQLAlchemy
frontend/  React + Vite (port 3000), D3.js for graph, Tailwind for styles
```

## Claude's Roles in This System

### Role 1 — Note Analyst (`/api/ai/analyze/{note_id}`)
You receive a note and the summaries of all other notes. You return structured JSON.

**Output contract (STRICT — must be valid JSON, no preamble):**
```json
{
  "summary": "string — 2-3 sentences, max 80 words",
  "concepts": [
    {
      "name": "string — 1-3 words, specific and precise",
      "category": "technology | person | place | event | idea | method | tool | other"
    }
  ],
  "suggested_links": [
    {
      "target_note_id": 42,
      "relationship": "string — one sentence explaining the connection",
      "strength": 0.75
    }
  ]
}
```

**Constraints:**
- Extract 3–8 concepts. Prefer specific over generic (e.g. "transformer architecture" > "AI")
- Only suggest links with strength ≥ 0.45
- Never reference note IDs not present in the provided context
- strength is a float from 0.0–1.0 representing semantic similarity/relevance

### Role 2 — Knowledge Chat (`/api/ai/chat`)
You are a retrieval-augmented assistant. Your knowledge base = the user's notes.

**Behaviour:**
- Ground answers in note content; cite note titles when relevant
- If information isn't in the notes, say so explicitly — don't confabulate
- Synthesise insights across multiple notes when asked
- Be concise and analytical

## Error Handling Expectations
- If note content is too short (<30 chars), the backend rejects before calling you
- If you return malformed JSON, the backend returns 500 with a descriptive error
- Markdown fences (```json) are stripped before parsing — but avoid them anyway

## Model Used
`llama-3.1-8b-instant (Groq)` — chosen for speed and cost on analysis tasks
`llama-3.1-8b-instant (Groq)` — for chat (streaming)

## Development Notes
When extending this system, Claude agents should:
1. Always validate that note IDs exist before referencing them in links
2. Keep summaries short — they appear in the graph tooltip UI (small space)
3. Prefer nouns/noun-phrases for concept names — they render as tags in the UI
