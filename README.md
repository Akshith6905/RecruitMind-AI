# RecruitMind

RecruitMind is an AI recruitment decision-support MVP built around persistent recruiter memory. It records explicit hiring feedback in Hindsight and recalls relevant decisions before evaluating the next candidate. It does not automate hiring decisions.

## First vertical slice

Create a role → upload a PDF/DOCX resume → parse a candidate profile → compare evidence to the role and recalled Hindsight memories → record a recruiter decision and rationale → retain that experience in Hindsight.

The backend uses SQLite by default for a zero-setup local demo and accepts PostgreSQL through `DATABASE_URL`. Evaluations use a configurable OpenAI-compatible JSON API when `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` are set; otherwise the app clearly labels its transparent evidence-rules fallback.

## Architecture

```mermaid
flowchart LR
  R[Recruiter] --> UI[React + Vite]
  UI --> API[FastAPI]
  API --> DB[(SQLite / PostgreSQL)]
  API --> RP[PDF / DOCX parser]
  API --> H[Hindsight retain + recall]
  H --> E[Explainable evaluation]
  E --> UI
```

## Hindsight

Hindsight is the persistent memory layer, not a local mock. On evaluation, RecruitMind recalls the hiring team's prior decisions for the role and includes the returned facts in the evaluation context. On recruiter feedback, the decision and their explicit rationale are retained to the configured Hindsight bank. With `HINDSIGHT_URL` unset, memory operations are marked unavailable and are not simulated; configure a Hindsight instance to enable the memory workflow.

See [docs/hindsight-memory.md](docs/hindsight-memory.md), [docs/architecture.md](docs/architecture.md), [docs/api.md](docs/api.md), [docs/demo-script.md](docs/demo-script.md), and [docs/deployment.md](docs/deployment.md).

## Run locally

1. Copy `.env.example` to `.env` and set `HINDSIGHT_URL` and `HINDSIGHT_API_KEY` to enable real memory.
2. Backend: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload`
3. Frontend: `cd frontend && npm install && npm run dev`
4. Open the Vite URL. API docs are at `http://localhost:8000/docs`.

The frontend defaults to `http://localhost:8000`. PostgreSQL deployments should set a SQLAlchemy-compatible `DATABASE_URL` such as `postgresql+psycopg://user:password@host:5432/recruitmind`. Backend settings load the project-root `.env` file regardless of whether Uvicorn is started from the repository root or `backend/`.

## Environment

See `.env.example`. Never commit real credentials. The application is a decision-support tool: recruiters remain responsible for reviewing evidence and making decisions. Do not use protected attributes or infer them from resumes.
