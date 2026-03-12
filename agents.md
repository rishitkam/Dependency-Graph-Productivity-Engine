# agents.md — AI Agent Usage in Synapse

## Philosophy
Synapse uses AI not as a wrapper around chat, but as a **structural intelligence layer** —
Claude transforms unstructured text into a graph of knowledge. Every AI call either enriches
a node (note) or discovers an edge (relationship).

---

## Agent 1: Note Analyst

**Trigger:** User clicks "Analyze" button on a note  
**Input:** Note content + titles/summaries of all other notes  
**Output:** Concepts, summary, inter-note links

**Prompt Design Rationale:**
- System prompt specifies the JSON schema *before* any task description
- We provide "other notes" as context to enable cross-note link discovery
- We use `llama-3.1-8b-instant` (Groq) (not Sonnet) — analysis is structured extraction, not reasoning
- Temperature is default (1.0) — determinism not critical here; diversity in extraction is fine

**Failure Modes & Mitigations:**
| Failure | Mitigation |
|---|---|
| Malformed JSON | try/except with descriptive error; strip markdown fences |
| Hallucinated note IDs | Validate every `target_note_id` against real DB IDs before insert |
| Over-linking | Minimum strength threshold of 0.45 filters weak/spurious connections |
| Empty note | Backend rejects before API call if content < 30 chars |

---

## Agent 2: Knowledge Chat (RAG)

**Trigger:** User sends a message in Chat panel  
**Input:** User message + full conversation history + all notes as context  
**Output:** Streaming text response

**RAG Strategy — Naive Full-Context (v1):**
We currently pass ALL notes into the system prompt. This works well for small knowledge bases
(up to ~50 notes before hitting context limits). 

**v2 Upgrade Path — Semantic Retrieval:**
```
1. Embed each note using text-embedding-3-small (OpenAI) or voyage-2 (Anthropic)
2. Store embeddings in pgvector (PostgreSQL) or ChromaDB
3. On each chat message, embed the query and retrieve top-k notes by cosine similarity
4. Pass only retrieved notes to Claude — scales to 10,000+ notes
```

**Streaming Implementation:**
- Uses Flask `stream_with_context` + Anthropic streaming SDK
- Frontend reads SSE stream via `ReadableStream` API (no EventSource — needs POST)
- Format: `data: {"delta": "text chunk"}\n\n` — simple, parseable

---

## Prompting Rules Applied

### 1. Schema-first prompting
Define output schema *before* the task. Claude is less likely to deviate if it sees the structure first.

### 2. Constraint enumeration
List constraints explicitly: "Only suggest links with strength ≥ 0.45" — not implied.

### 3. Grounding injection
For RAG chat, the system prompt begins with the full knowledge base, then the behavioral instructions.
This grounds Claude before it "decides" how to respond.

### 4. Persona minimalism
We don't give the analyst a persona ("You are an expert knowledge graph builder...") — unnecessary.
We give the chat agent a minimal persona ("You are Synapse, a knowledge assistant").

### 5. Example-free for structured outputs
We rely on schema specification rather than few-shot examples. For small structured outputs,
this reduces prompt length and works reliably with Claude.

---

## Extension: Agent 3 (Proposed) — Auto-Synthesis

**Idea:** Periodically generate a "synthesis note" — Claude reads all notes and writes a
meta-summary identifying clusters, gaps, and emerging themes.

**Trigger:** Cron job or manual "Synthesize" button  
**Model:** claude-3-5-sonnet (more reasoning needed for synthesis)  
**Output:** A new Note automatically added to the knowledge base
