# Vercel API routes (server-only)

All server-side logic lives here as **Vercel serverless functions** — including the
Anthropic AI extraction route (added in the extraction phase, brief §5).

## Rules (brief §2 — non-negotiable)

- **Do NOT use Supabase Edge Functions.** They returned 401 on this team's stack. Use these
  Vercel routes instead.
- The `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are read from `process.env` **here
  only**. They must never be imported into `src/` or prefixed with `VITE_`.
- Never call the Anthropic API from the browser. The browser uploads a file to Supabase
  Storage, then calls a route in this folder, which calls Anthropic.

## Conventions

- One file per endpoint, e.g. `api/extract.ts` → `POST /api/extract`.
- Each handler exports a default `(req, res) => …` (Vercel Node function signature).
- The SPA rewrite in `vercel.json` excludes `/api/*` so these resolve as functions, not the
  client app.

(No routes yet — this folder is a placeholder for the first checkpoint.)
