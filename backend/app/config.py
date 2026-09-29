from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./recruitmind.db"
    hindsight_url: str = ""
    hindsight_api_key: str = ""
    hindsight_bank_id: str = "recruitmind-team"
    llm_api_key: str = ""
    llm_model: str = ""
    llm_base_url: str = ""
    frontend_url: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[2] / ".env", extra="ignore")


settings = Settings()
