# coding_standards.md — Synapse Development Standards

## Python (Backend)

### Style
- PEP 8 strictly. Use `black` for formatting, `flake8` for linting.
- Type hints on all function signatures.
- Docstrings for all non-trivial functions.

### Flask conventions
- Use blueprints for all routes — no routes directly on `app`.
- Always return `jsonify(...)`, not plain dicts.
- Use `get_or_404` for single-resource lookups — never raw `.get()`.
- Handle expected errors with specific HTTP codes (400 for validation, 404 for missing, 500 for server errors).
- Never expose raw exception messages to the client in production.

### Database
- All DB mutations go through SQLAlchemy sessions — no raw SQL.
- Always call `db.session.commit()` after mutations.
- Add `cascade='all, delete-orphan'` on parent-child relationships.
- Timestamps: always `datetime.utcnow`, never `datetime.now()`.

### AI Integration
- Wrap all `anthropic` SDK calls in try/except for `anthropic.APIError`.
- Always validate AI-returned JSON before persisting. Never trust AI output blindly.
- Strip markdown fences from model output before `json.loads()`.
- Log model, tokens used, and latency for every AI call (add to future monitoring).

---

## JavaScript/React (Frontend)

### Style
- Functional components only. No class components.
- Use named exports for components, default exports for page-level components.
- `const` for everything. `let` only when reassignment is necessary.

### State management
- `useState` for local component state.
- Lift state only as high as needed — avoid prop drilling beyond 2 levels.
- No Redux — app is small enough that Context + useState suffices.

### API calls
- All API calls go through `src/api/client.js` — no inline `fetch`/`axios` in components.
- Exception: streaming chat uses `fetch` directly in `client.js` (not axios — axios doesn't support streaming).
- Always handle loading and error states in UI.

### D3 + React
- Mount D3 in `useEffect` with a `ref` — never manipulate DOM outside of effects.
- Always clean up simulations on unmount: `return () => simulation.stop()`.
- Re-run D3 effect when data changes, not on every render.

### Styling
- Tailwind utility classes only — no inline styles except for dynamic values (D3, positioning).
- Use CSS custom classes in `index.css` for repeated patterns (concept colors, etc.).
- Dark theme only — `color-scheme: dark` set globally.

---

## Git Conventions

### Commit messages
```
feat: add streaming chat response
fix: handle malformed JSON from AI analysis
refactor: extract concept rendering to ConceptTag component
chore: update requirements.txt
```

### Branch strategy
- `main` — always deployable
- `feat/...` — new features
- `fix/...` — bug fixes

---

## Environment Variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | — | Get from console.anthropic.com |
| `DATABASE_URL` | ❌ | `sqlite:///synapse.db` | Use PostgreSQL URL for production |
| `SECRET_KEY` | ❌ | dev default | Must be set in production |

Never commit `.env`. Always commit `.env.example`.
