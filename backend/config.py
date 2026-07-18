from typing import Optional
import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

class Settings(BaseSettings):
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", 152005)
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "3306")
    DB_NAME: str = os.getenv("DB_NAME", "edupilot")
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "edupilot_super_secret_signing_key_2026_pilot")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    
    OPENROUTER_API_KEY: Optional[str] = os.getenv("OPENROUTER_API_KEY", None)
    YOUTUBE_API_KEY: Optional[str] = os.getenv("YOUTUBE_API_KEY", None)
    
    # Upload setup
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")

    @property
    def DATABASE_URL(self) -> str:
        # Base MySQL URL
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def DATABASE_URL_WITHOUT_DB(self) -> str:
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}"

settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Force uvicorn reload on config update - new key
