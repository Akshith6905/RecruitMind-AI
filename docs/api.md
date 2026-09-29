# API

Base URL: `http://localhost:8000`. Interactive OpenAPI docs are at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | API and Hindsight configuration status |
| GET | `/api/jobs` | List roles and candidate summaries |
| POST | `/api/jobs` | Create a role (`title`, `required_skills`, optional preferred skills, description, experience) |
| POST | `/api/jobs/{id}/candidates` | Upload PDF/DOCX; extracts and saves candidate profile |
| POST | `/api/candidates/{id}/evaluate` | Recall memories and evaluate parsed role evidence |
| POST | `/api/candidates/{id}/decision` | Save recruiter decision and rationale; retain to Hindsight |
| GET | `/api/candidates/{id}` | Read parsed candidate profile and current decision |

Decision body: `{"decision":"shortlist|maybe|reject","feedback":"role-related rationale"}`. Resume upload returns 422 for unsupported or unreadable files. Hindsight recall/retain errors return 502 with a direct explanation.
