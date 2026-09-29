from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, engine, get_db
from app.models import Candidate, Job
from app.schemas import DecisionCreate, JobCreate
from app.services.evaluator import evaluate
from app.services.memory import memory
from app.services.llm import LLMConfigurationError, llm_evaluator
from app.services.resume import extract_text, profile


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="RecruitMind API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list({settings.frontend_url, "http://localhost:5173", "http://127.0.0.1:5173"}),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "memory_enabled": memory.enabled}


@app.get("/api/jobs")
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.scalars(select(Job).order_by(Job.created_at.desc())).all()
    return [{"id": j.id, "title": j.title, "team": j.team, "description": j.description,
             "required_skills": j.required_skills, "preferred_skills": j.preferred_skills,
             "min_experience": j.min_experience, "created_at": j.created_at,
             "candidates": [{"id": c.id, "name": c.name, "decision": c.decision,
                             "resume_file": (c.recommendation or {}).get("resume_file")} for c in j.candidates]} for j in jobs]


@app.post("/api/jobs", status_code=201)
def create_job(payload: JobCreate, db: Session = Depends(get_db)):
    job = Job(**payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"id": job.id, "title": job.title, "team": job.team, "description": job.description,
            "required_skills": job.required_skills, "preferred_skills": job.preferred_skills,
            "min_experience": job.min_experience, "created_at": job.created_at, "candidates": []}


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Role not found")
    deleted_candidates = len(job.candidates)
    db.delete(job)
    db.commit()
    return {"status": "success", "deleted_candidates": deleted_candidates,
            "message": "Role and its local candidate records deleted. Hindsight memories are unchanged."}


@app.post("/api/jobs/{job_id}/candidates", status_code=201)
async def upload_candidate(job_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    try:
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(413, "Resume exceeds the 10 MB upload limit")
        text = extract_text(file.filename or "resume", contents)
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(422, str(exc)) from exc
    parsed = profile(text)
    candidate = Candidate(job_id=job.id, resume_text=text, **parsed)
    candidate.recommendation = {"resume_file": {"name": file.filename or "resume", "size_bytes": len(contents)}}
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate_payload(candidate)


@app.post("/api/candidates/{candidate_id}/evaluate")
async def evaluate_candidate(candidate_id: int, db: Session = Depends(get_db)):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    job = db.get(Job, candidate.job_id)
    query = f"Recruiter hiring decisions and feedback for {job.title}; skills {', '.join(job.required_skills or [])}; candidate evidence {', '.join(candidate.skills or [])}"
    try:
        memories = await memory.recall(query)
    except Exception as exc:
        raise HTTPException(502, f"Hindsight recall failed: {exc}") from exc
    result = evaluate(job, candidate, memories, memory.enabled)
    resume_file = (candidate.recommendation or {}).get("resume_file")
    try:
        structured = await llm_evaluator.evaluate(job, candidate, memories)
        if structured:
            result.update(structured.model_dump())
            result["evaluation_method"] = "configured_llm"
            result["evaluation_notice"] = None
    except LLMConfigurationError as exc:
        result["evaluation_notice"] = str(exc)
    if resume_file:
        result["resume_file"] = resume_file
    candidate.recommendation = result
    db.commit()
    return result


@app.post("/api/candidates/{candidate_id}/decision")
async def decide(candidate_id: int, payload: DecisionCreate, db: Session = Depends(get_db)):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    job = db.get(Job, candidate.job_id)
    candidate.decision, candidate.feedback = payload.decision, payload.feedback
    db.commit()
    content = (f"Recruiter decision for role {job.title}: {payload.decision.upper()} candidate {candidate.name}. "
               f"Profile skills: {', '.join(candidate.skills or [])}. Recruiter rationale: {payload.feedback}")
    try:
        await memory.retain(content, f"recruitment decision — {job.title}")
    except Exception as exc:
        raise HTTPException(502, f"Decision saved, but Hindsight retain failed: {exc}") from exc
    return {"candidate_id": candidate.id, "decision": candidate.decision, "retained": memory.enabled, "message": "Decision saved and retained to Hindsight." if memory.enabled else "Decision saved. Configure Hindsight to persist this experience as memory."}


@app.get("/api/candidates/{candidate_id}")
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    return candidate_payload(candidate)



@app.delete("/api/candidates/{candidate_id}")
def delete_candidate(candidate_id: int, db: Session = Depends(get_db)):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    db.delete(candidate)
    db.commit()
    return {"status": "success", "message": "Candidate deleted"}

def candidate_payload(candidate: Candidate) -> dict:
    return {"id": candidate.id, "job_id": candidate.job_id, "name": candidate.name,
            "email": candidate.email, "phone": candidate.phone, "skills": candidate.skills,
            "education": candidate.education, "experience": candidate.experience,
            "projects": candidate.projects, "recommendation": candidate.recommendation,
            "resume_file": (candidate.recommendation or {}).get("resume_file"),
            "decision": candidate.decision, "feedback": candidate.feedback, "created_at": candidate.created_at}
