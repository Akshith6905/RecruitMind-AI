# Architecture

## Current implementation

The React/Vite client talks to a FastAPI REST service. SQLAlchemy stores roles, parsed candidate evidence, evaluations, and recruiter feedback in SQLite locally or PostgreSQL in deployment. PDF and DOCX extraction occurs in the API process. A dedicated Hindsight adapter makes explicit HTTP calls to the configured Hindsight memory bank.

The candidate evaluation path is `job + parsed resume → Hindsight recall → configured structured LLM evaluation with evidence and memories → recommendation`. When LLM settings are absent or the provider returns invalid data, a transparent skill-match fallback runs and the UI labels it as evidence rules. The decision path is `recruiter decision + rationale → SQL record → Hindsight retain`. A Hindsight error is surfaced instead of silently claiming memory success.

## Directory map

```text
backend/app/       FastAPI, SQLAlchemy models, and services
frontend/src/ui/   Recruiter workspace interface
docs/              Operational and workflow documentation
```

## Next production steps

Add Alembic migrations, authentication and per-tenant bank isolation, secure file storage and deletion, background processing for large documents, audit logs, and rate limits. Validate Hindsight's configured bank and health at startup. The local evidence-rules fallback is deliberately transparent and must not be presented as an LLM judgment.
