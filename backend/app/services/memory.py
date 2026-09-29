import httpx
from app.config import settings


class HindsightMemory:
    """Thin adapter over the official Hindsight memory REST API."""
    def __init__(self) -> None:
        self.base_url = settings.hindsight_url.rstrip("/")
        self.enabled = bool(self.base_url)

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if settings.hindsight_api_key:
            headers["Authorization"] = f"Bearer {settings.hindsight_api_key}"
        return headers

    async def recall(self, query: str) -> list[str]:
        if not self.enabled:
            return []
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(f"{self.base_url}/v1/default/banks/{settings.hindsight_bank_id}/memories/recall", headers=self._headers(), json={"query": query, "budget": "low"})
            response.raise_for_status()
            payload = response.json()
        results = payload.get("results", []) if isinstance(payload, dict) else []
        return [str(item.get("text", "")) for item in results if isinstance(item, dict) and item.get("text")][:8]

    async def retain(self, content: str, context: str) -> None:
        if not self.enabled:
            return
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(f"{self.base_url}/v1/default/banks/{settings.hindsight_bank_id}/memories", headers=self._headers(), json={"items": [{"content": content, "context": context}]})
            response.raise_for_status()


memory = HindsightMemory()
