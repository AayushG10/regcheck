# RegCheck — Deployment Strategy

## Architecture

Two independent deployments, connected by two env vars:

```
┌─────────────────────────┐        CORS_ORIGINS         ┌──────────────────────────┐
│   Frontend (static)     │ ───────────────────────────► │  Backend (Python service) │
│   Vercel                │                               │  Render                   │
│   frontend/ -> dist/    │ ◄─────────────────────────── │  backend/                 │
│   React + Vite SPA      │        VITE_API_URL           │  FastAPI + uvicorn        │
└─────────────────────────┘                               └──────────────────────────┘
```

- **Frontend → Vercel.** Static build (`vite build`), free tier, auto-deploys on every push to `main` once connected. React Router needs a SPA rewrite (already configured in `frontend/vercel.json`) so direct loads of e.g. `/dashboard/rules` don't 404.
- **Backend → Render.** A real long-running Python process (not serverless — the backend holds JSON-file state in `backend/data/*.json` across requests, e.g. `rules.live.json`, `check_runs.json`; a serverless/edge platform would reset that state between invocations). Free tier, config already checked into `render.yaml` as a Blueprint.
- Why not one platform for both: Vercel's Python runtime is serverless and would break RegCheck's file-backed state and its 60s+ eval/extraction script use case; Render (or Railway/Fly) gives a real persistent container for the backend while Vercel remains the best free static host for the Vite SPA.

**Known constraint on Render's free tier:** the file-backed store (`backend/data/rules.live.json` etc.) lives on the container's local disk, which is **ephemeral on free-tier Render** — a redeploy or free-tier spin-down resets it back to the seed state. That's actually fine for a demo (equivalent to hitting `POST /api/reset`), but it means the "audit trail" (`check_runs.json`) won't survive across deploys in this free configuration. If persistence across deploys matters beyond demo day, the fix is a small one: point `storage/store.py` at a [Render Disk](https://render.com/docs/disks) (a few dollars/month) instead of the container's local filesystem — no application code changes needed, just a mount path.

## Prerequisites

- The GitHub repo (already set up: `https://github.com/AayushG10/regcheck`) — both platforms deploy straight from it.
- A free [Render](https://render.com) account (sign in with GitHub — no separate password).
- A free [Vercel](https://vercel.com) account (sign in with GitHub).
- Your Groq and OpenRouter API keys (same ones in `backend/.env` locally) — you'll paste these into Render's dashboard, not into any file that gets committed.

## Step 1 — Deploy the backend (Render)

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connect the `AayushG10/regcheck` GitHub repo. Render detects `render.yaml` at the repo root automatically.
3. It will show one service, `regcheck-backend`, with the build/start commands already filled in from `render.yaml`. You'll be prompted for the `sync: false` env vars:
   - `GROQ_API_KEY` — your real key
   - `OPENROUTER_API_KEY` — your real key
   - `CORS_ORIGINS` — leave a placeholder for now (e.g. `http://localhost:5173`), you'll update it in Step 3 once you know the Vercel URL
4. Click **Apply**. First deploy takes a few minutes (installing `requirements.txt`).
5. Once live, note the URL Render gives you — something like `https://regcheck-backend.onrender.com`. Verify it: `curl https://regcheck-backend.onrender.com/api/health` should return `{"status":"ok"}`.

> Free-tier Render services spin down after 15 minutes of inactivity and take ~30-60s to wake back up on the next request — expect a slow first load if the demo has been idle. Worth knowing before a live judging session; hit the `/api/health` URL a minute before you present to warm it up.

## Step 2 — Deploy the frontend (Vercel)

1. Go to [vercel.com/new](https://vercel.com/new), import the `AayushG10/regcheck` GitHub repo.
2. Set **Root Directory** to `frontend`. Vercel auto-detects the Vite framework preset from there.
3. Add one environment variable: `VITE_API_URL` = your Render backend URL from Step 1 (e.g. `https://regcheck-backend.onrender.com`, no trailing slash).
4. Deploy. Vercel gives you a URL like `https://regcheck.vercel.app`.

## Step 3 — Close the loop (CORS)

Go back to the Render dashboard → `regcheck-backend` → **Environment**, and set `CORS_ORIGINS` to your real Vercel URL from Step 2 (e.g. `https://regcheck.vercel.app`). Save — Render redeploys automatically. This is the step that lets the deployed frontend actually call the deployed backend; skipping it means the browser will block every API request with a CORS error.

## Step 4 — Verify

1. Open the Vercel URL. Landing page should render.
2. Click **Launch Dashboard** → Scorecard should load real data (4 PASS / 4 FAIL baseline) — if it's blank, open the browser console; a CORS error means Step 3 wasn't completed correctly, a network error means the Render URL in `VITE_API_URL` is wrong or the backend is still spinning up.
3. Drive the amendment simulator once to confirm the full round-trip (frontend → backend → LLM-free deterministic re-run) works end to end on the real deployment, not just locally.
4. Put the live URL at the top of `README.md` (there's a placeholder comment marking where).

## Ongoing: both platforms auto-redeploy on every push to `main`

No extra step needed going forward — the same `git push` workflow already used throughout this project keeps the live deployment current.

## What I could not do without your input

I don't have your Vercel/Render account access or an API token for either — both require an interactive browser login (device-code OAuth) that has to happen in your own browser, not something completable from this non-interactive session. The steps above are written so you can execute the whole thing in about 10 minutes of clicking; tell me the two resulting URLs (or paste any error you hit) and I'll verify the live deployment and fix anything that's broken.
