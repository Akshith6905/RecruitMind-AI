import json

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.config import settings


class StructuredEvaluation(BaseModel):
    match_score: int = Field(ge=0, le=100)
    recommendation: str = Field(pattern="^(strong_match|potential_match|limited_evidence)$")
    matched_skills: list[str]
    missing_skills: list[str]
    evidence: list[str]
    explanation: str = Field(min_length=1, max_length=1000)


class LLMConfigurationError(Exception):
    pass


class OpenAICompatibleEvaluator:
    """Optional JSON-mode evaluator for OpenAI-compatible chat completion APIs."""

    @property
    def configured(self) -> bool:
        return bool(settings.llm_base_url and settings.llm_api_key and settings.llm_model)

    async def evaluate(self, job, candidate, memories: list[str]) -> StructuredEvaluation | None:
        if not self.configured:
            return None
        payload = {
            "role": {"title": job.title, "requirements": job.required_skills or [], "preferred": job.preferred_skills or [], "minimum_experience": job.min_experience},
            "candidate_evidence": {"skills_extracted": candidate.skills or [], "resume_text": candidate.resume_text[:16000]},
            "recalled_recruiter_memories": memories,
        }
        system = (
            "You support a human recruiter. Return only JSON with match_score (integer 0-100), recommendation "
            "(strong_match, potential_match, or limited_evidence), matched_skills, missing_skills, evidence (short "
            "quotes or faithful paraphrases grounded in candidate_evidence), and explanation (brief rationale). "
            "Use only job-related evidence. Treat memories as historical recruiter context, not facts about this candidate. "
            "Memories may inform prioritization but must not override contradictory resume evidence. Do not use or infer "
            "protected characteristics. Do not return hidden reasoning or chain-of-thought. If evidence is insufficient, say so."
        )
        try:
            async with httpx.AsyncClient(timeout=40) as client:
                response = await client.post(
                    f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.llm_api_key}", "Content-Type": "application/json"},
                    json={"model": settings.llm_model, "temperature": 0, "response_format": {"type": "json_object"},
                          "messages": [{"role": "system", "content": system}, {"role": "user", "content": json.dumps(payload)}]},
                )
                response.raise_for_status()
                body = response.json()
            content = body["choices"][0]["message"]["content"]
            if not isinstance(content, str):
                raise ValueError("Provider response did not contain JSON text")
            parsed = StructuredEvaluation.model_validate_json(content)
            allowed_skills = {str(skill).casefold(): str(skill) for skill in (job.required_skills or []) + (job.preferred_skills or [])}
            parsed.matched_skills = list(dict.fromkeys(allowed_skills[s.casefold()] for s in parsed.matched_skills if s.casefold() in allowed_skills))
            parsed.missing_skills = list(dict.fromkeys(allowed_skills[s.casefold()] for s in parsed.missing_skills if s.casefold() in allowed_skills))
            return parsed
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, ValidationError) as exc:
            raise LLMConfigurationError(f"LLM evaluation unavailable or invalid: {exc}") from exc


llm_evaluator = OpenAICompatibleEvaluator()
