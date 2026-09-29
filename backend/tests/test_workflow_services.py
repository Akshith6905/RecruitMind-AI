import asyncio
from types import SimpleNamespace

import pytest

from app.services.evaluator import evaluate
from app.services.resume import profile


def test_profile_extracts_contact_and_role_skills():
    parsed = profile("Jamie Chen\njamie@example.com\nPython, SQL, FastAPI\nBuilt ML systems")
    assert parsed["name"] == "Jamie Chen"
    assert parsed["email"] == "jamie@example.com"
    assert {"Python", "SQL", "FastAPI", "Machine Learning"}.intersection(parsed["skills"]) == {"Python", "SQL", "FastAPI"}


def test_evaluation_returns_evidence_and_recalled_context_separately():
    job = SimpleNamespace(required_skills=["Python", "SQL", "FastAPI"], preferred_skills=["Docker"])
    candidate = SimpleNamespace(resume_text="Python SQL FastAPI", skills=["Python", "SQL", "FastAPI"])
    memory = ["Recruiter previously prioritized production API ownership for this role"]
    result = evaluate(job, candidate, memory, True)
    assert result["match_score"] == 80
    assert result["missing_skills"] == []
    assert result["memory_context"] == memory
    assert result["memory_enabled"] is True
    assert "does not" not in result["explanation"]
    assert result["evaluation_method"] == "evidence_rules"


def test_llm_structured_response_is_schema_validated():
    from pydantic import ValidationError
    from app.services.llm import StructuredEvaluation

    parsed = StructuredEvaluation.model_validate_json(
        '{"match_score":82,"recommendation":"strong_match","matched_skills":["Python"],'
        '"missing_skills":[],"evidence":["Resume mentions Python"],"explanation":"Relevant role evidence."}'
    )
    assert parsed.match_score == 82
    with pytest.raises(ValidationError):
        StructuredEvaluation.model_validate_json('{"match_score":120}')


def test_hindsight_retain_then_recall_uses_real_endpoints(monkeypatch):
    from app.services import memory as memory_module

    calls = []

    class Response:
        def __init__(self, payload=None):
            self.payload = payload or {"results": [{"text": "Prior role decision"}]}

        def raise_for_status(self):
            return None

        def json(self):
            return self.payload

    class Client:
        def __init__(self, timeout):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            calls.append((url, kwargs))
            return Response()

    monkeypatch.setattr(memory_module.httpx, "AsyncClient", Client)
    monkeypatch.setattr(memory_module.settings, "hindsight_url", "https://hindsight.example")
    monkeypatch.setattr(memory_module.settings, "hindsight_bank_id", "recruitmind-test")
    service = memory_module.HindsightMemory()
    async def run():
        await service.retain("Shortlisted for API experience", "recruitment decision")
        return await service.recall("API engineer candidate")

    recalled = asyncio.run(run())

    assert len(calls) == 2
    assert calls[0][0].endswith("/banks/recruitmind-test/memories")
    assert calls[1][0].endswith("/banks/recruitmind-test/memories/recall")
    assert recalled == ["Prior role decision"]
