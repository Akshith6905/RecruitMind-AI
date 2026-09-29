import io
import re
from docx import Document
from pypdf import PdfReader


def extract_text(filename: str, content: bytes) -> str:
    suffix = filename.lower().rsplit(".", 1)[-1]
    if suffix == "pdf":
        text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(content)).pages)
    elif suffix == "docx":
        text = "\n".join(p.text for p in Document(io.BytesIO(content)).paragraphs)
    else:
        raise ValueError("Upload a PDF or DOCX resume.")
    normalized = re.sub(r"[ \t]+", " ", text)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    if not normalized.strip():
        raise ValueError("No readable text found. Scanned resumes need OCR before upload.")
    return normalized[:100_000]


def profile(text: str) -> dict:
    lines = [line.strip(" •\t-") for line in text.splitlines() if line.strip()]
    email = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", text)
    phone = re.search(r"(?:\+?\d[\d ()-]{7,}\d)", text)
    skills = []
    known = ["Python", "Machine Learning", "FastAPI", "SQL", "TensorFlow", "PyTorch", "Docker", "AWS", "Azure", "GCP", "React", "Java", "Kubernetes", "NLP", "PostgreSQL"]
    folded = text.casefold()
    for skill in known:
        if skill.casefold() in folded:
            skills.append(skill)
    name = next((line for line in lines[:6] if "@" not in line and len(line.split()) in range(2, 5) and not any(c.isdigit() for c in line)), "Candidate")
    return {"name": name[:180], "email": email.group(0) if email else "", "phone": phone.group(0) if phone else "", "skills": skills,
            "education": [line for line in lines if any(k in line.casefold() for k in ["university", "college", "bachelor", "master", "ph.d", "b.tech", "degree"])][:8],
            "experience": [line for line in lines if any(k in line.casefold() for k in ["experience", "engineer", "developer", "analyst", "intern", "manager"])][:12],
            "projects": [line for line in lines if any(k in line.casefold() for k in ["project", "built", "developed", "implemented"])][:8]}
