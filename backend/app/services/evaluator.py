import re


def evaluate(job, candidate, memories: list[str], memory_enabled: bool) -> dict:
    text = candidate.resume_text.casefold()
    required = job.required_skills or []
    preferred = job.preferred_skills or []
    matched = [skill for skill in required + preferred if skill.casefold() in text]
    missing = [skill for skill in required if skill.casefold() not in text]
    required_score = 100 if not required else round(100 * len([s for s in required if s.casefold() in text]) / len(required))
    preferred_score = 100 if not preferred else round(100 * len([s for s in preferred if s.casefold() in text]) / len(preferred))
    score = round(required_score * .8 + preferred_score * .2)
    cues = [m for m in memories if any(re.search(rf"\b{re.escape(s)}\b", m, re.I) for s in matched)]
    rec = "strong_match" if score >= 75 else "potential_match" if score >= 45 else "limited_evidence"
    evidence = [f"Resume mentions {skill}." for skill in matched[:8]]
    if missing:
        evidence.append("Required skills not found in extracted resume text: " + ", ".join(missing) + ".")
    explanation = f"Evidence match: {len(matched)} of {len(required) + len(preferred)} listed skills; required-skill coverage is {required_score}%. The score is a screening aid based only on extracted text."
    if cues:
        explanation += " Related prior recruiter memories were recalled and shown as context; they do not override the resume evidence."
    return {"match_score": score, "recommendation": rec, "matched_skills": matched, "missing_skills": missing, "evidence": evidence,
            "memory_context": memories, "memory_enabled": memory_enabled, "explanation": explanation,
            "evaluation_method": "evidence_rules", "evaluation_notice": "Configure an LLM provider to enable structured AI reasoning."}
