# Synapse — AI Knowledge Graph

> *Your thoughts. Connected.*

Synapse is a second-brain app where every note you write becomes a node in a living knowledge graph. Claude AI automatically extracts concepts, generates summaries, and **discovers semantic connections between your notes** — turning a flat list of text files into a navigable map of your mind.

---

## Demo

| Feature | Description |
|---|---|
| ✍️ Note Editor | Write notes with auto-save and Ctrl+S |
| ⚡ AI Analysis | Extract concepts, summary, and cross-note links in one click |
| 🕸️ Knowledge Graph | D3.js force-directed graph — drag, zoom, explore connections |
| 💬 RAG Chat | Ask questions about your entire knowledge base, answers stream live |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        BROWSER                          │
│                                                         │
│  ┌─────────────┐  ┌─────────────────┐  ┌────────────┐  │
│  │   Sidebar   │  │   Note Editor   │  │   Graph    │  │
│  │ (note list) │  │  + AI Analyze   │  │  (D3.js)   │  │
│  └─────────────┘  └─────────────────┘  └────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              React SPA (Vite + Tailwind)          │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / SSE
┌───────────────────────▼─────────────────────────────────┐
│                    FLASK API (:5000)                     │
│                                                         │
│   /api/notes/*          /api/ai/analyze/:id             │
│   CRUD + graph data     /api/ai/chat (streaming)        │
│                                                         │
│  ┌──────────────┐       ┌──────────────────────────┐    │
│  │  SQLAlchemy  │       │   Anthropic Claude API   │    │
│  │  SQLite DB   │       │   claude-3-5-haiku        │    │
│  └──────────────┘       └──────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Data Model
```
notes          concepts           note_links
─────          ────────           ──────────
id             id                 id
title          note_id (FK)       source_id (FK)
content        name               target_id (FK)
summary        category           relationship
analyzed                          strength (0.0–1.0)
created_at
updated_at
```

---

## Key Technical Decisions

### 1. SQLite over PostgreSQL
SQLite is zero-config and works out-of-the-box for demos. The `DATABASE_URL` env var is a drop-in swap to any SQLAlchemy-compatible database. For production, switching to PostgreSQL is one env var change.

### 2. Streaming SSE for chat
Chat responses stream via Server-Sent Events using Flask's `stream_with_context` and Anthropic's streaming SDK. This makes the AI feel alive rather than making the user wait for a full response. Note: SSE over `fetch` (not `EventSource`) because we need POST, not GET.

### 3. Full-context RAG (not vector search)
All notes are passed into the system prompt for chat. This is intentional for v1 — simpler to implement, zero extra dependencies, works perfectly for small-to-medium knowledge bases (<50 notes). The upgrade path to vector embeddings is documented in `ai_guidance/agents.md`.

### 4. Schema-first AI prompting
The analyst prompt defines the output JSON schema *before* the task. This dramatically reduces JSON schema violations compared to describing the schema after the task. All AI responses are validated and sanitised before DB writes — we never blindly trust model output.

### 5. Strength threshold for links
Only links with `strength ≥ 0.45` are persisted. Weak links add noise to the graph and confuse users. The threshold was chosen empirically — it filters out "mentioned the same word once" coincidences while preserving genuine conceptual relationships.

### 6. D3.js over charting libraries
Libraries like Recharts or Nivo don't support custom force simulations. D3's `forceSimulation` gives full control over node radius (degree-scaled), edge thickness (strength-scaled), glow filters, drag behaviour, and zoom — none of which are configurable in higher-level graph libraries.

### 7. Haiku over Sonnet for analysis
`claude-3-5-haiku` is ~10x cheaper and ~3x faster than Sonnet for structured extraction tasks. Analysis is a JSON extraction problem, not a reasoning problem — Haiku handles it reliably. Sonnet is reserved for a future "synthesis" agent that needs deeper reasoning.

---

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY

python app.py
# → Running on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → Running on http://localhost:3000
```

Open `http://localhost:3000` — create some notes, hit **Analyze**, then check the Graph.

---

## AI Usage in Development

This project was built with Claude as both the AI runtime and the development assistant.

**AI was used for:**
- Scaffolding boilerplate (Flask blueprint structure, SQLAlchemy model setup)
- D3.js simulation tuning (force parameters, zoom behaviour)
- Prompt engineering iteration (schema-first prompting, constraint enumeration)
- Debugging streaming SSE edge cases

**AI was NOT used for:**
- Architecture decisions (Flask vs FastAPI, SQLite choice, RAG strategy)
- The core product concept and UX flow
- Prompt design philosophy (documented in `ai_guidance/`)

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Context length exceeded | Medium | Chat quality degrades | Implement vector retrieval (see agents.md v2) |
| Malformed AI JSON | Low | 500 error returned | Try/except + fence stripping in ai.py |
| Rate limiting | Medium | Analyze fails | Exponential backoff on 429s |
| Spurious links | Medium | Graph is noisy | Strength threshold + user can delete notes |
| API key exposure | Low (dev) | High | .gitignore .env; use env vars in prod |

---

## Extension Approach

### Near-term (1–2 days)
- **Export**: Download knowledge graph as JSON or PNG
- **Note linking UI**: Click a node in graph → opens note editor
- **Concept filter**: Click a concept tag → highlight related notes in graph

### Medium-term (1–2 weeks)
- **Vector search**: Embed notes with `text-embedding-3-small`, store in pgvector
- **Auto-synthesis**: Cron job that generates a weekly "state of my knowledge" note
- **Markdown rendering**: Preview panel in editor (react-markdown)
- **Note history**: Track content versions with diff viewer

### Long-term
- **Multi-user**: JWT auth, per-user note isolation
- **Import**: Ingest Notion, Obsidian, Roam exports
- **Public graphs**: Share a read-only view of your knowledge graph
- **AI writing assistant**: In-editor suggestions grounded in existing notes

---

## Walkthrough Guide (10–15 min)

1. **Architecture** (2 min) — Explain the Flask + React + SQLite split. Show how `app.py` wires blueprints.
2. **AI Integration** (3 min) — Walk through `routes/ai.py`. Show the schema-first system prompt. Explain strength threshold and ID validation.
3. **Knowledge Graph** (3 min) — Explain D3 force simulation. Show node sizing (degree), edge strength, glow filters.
4. **Streaming** (2 min) — Walk through SSE generator in Flask + ReadableStream consumer in frontend.
5. **AI Guidance Files** (2 min) — Explain `claude.md` (output contract), `agents.md` (RAG v1 vs v2), `coding_standards.md`.
6. **Risks + Extensions** (2 min) — Context length risk + vector retrieval upgrade path.

---

## File Structure

```
synapse/
├── backend/
│   ├── app.py              # Flask app factory
│   ├── database.py         # SQLAlchemy instance
│   ├── models.py           # Note, Concept, NoteLink, ChatMessage
│   ├── requirements.txt
│   ├── .env.example
│   └── routes/
│       ├── notes.py        # CRUD + graph endpoint
│       └── ai.py           # analyze + streaming chat
├── frontend/
│   ├── vite.config.js      # Dev proxy → :5000
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx         # Layout, tabs, state
│       ├── api/client.js   # All API calls + SSE stream
│       └── components/
│           ├── Sidebar.jsx         # Note list + search
│           ├── NoteEditor.jsx      # Editor + AI analyze
│           ├── KnowledgeGraph.jsx  # D3 force graph
│           └── ChatPanel.jsx       # Streaming RAG chat
└── ai_guidance/
    ├── claude.md           # Output contracts + AI roles
    ├── agents.md           # Prompting philosophy + upgrade paths
    └── coding_standards.md # Style + conventions
```

---

*Built with Flask · React · D3.js · Claude (Anthropic)*
