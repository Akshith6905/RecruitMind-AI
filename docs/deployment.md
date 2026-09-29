# Deployment notes

Deploy the Vite frontend as a static site and set `VITE_API_URL` to the public backend API base ending in `/api`. Deploy the FastAPI service with Uvicorn and a managed PostgreSQL database using a SQLAlchemy URL, for example `postgresql+psycopg://...`. Configure Hindsight URL, API key, and bank ID as backend secrets/environment variables.

Set `FRONTEND_URL` to the exact frontend origin for CORS. Set `DATABASE_URL` to the managed PostgreSQL URL. Use TLS, rotate secrets, restrict file sizes and request rates, and add migrations before production schema changes. The API currently has no authentication; do not expose candidate data publicly until recruiter authentication and tenant access controls are implemented. `JWT_SECRET` is reserved for that future authentication layer and is not yet used.
