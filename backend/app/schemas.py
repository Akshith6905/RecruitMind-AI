from pydantic import BaseModel, Field


class JobCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    team: str = "Hiring team"
    description: str = ""
    required_skills: list[str] = []
    preferred_skills: list[str] = []
    min_experience: int = Field(default=0, ge=0, le=60)


class DecisionCreate(BaseModel):
    decision: str = Field(pattern="^(accept|shortlist|maybe|reject)$")
    feedback: str = Field(min_length=3, max_length=2000)


class Evaluation(BaseModel):
    match_score: int
    recommendation: str
    matched_skills: list[str]
    missing_skills: list[str]
    evidence: list[str]
    memory_context: list[str]
    memory_enabled: bool
    explanation: str
    evaluation_method: str = "evidence_rules"
    evaluation_notice: str | None = None
