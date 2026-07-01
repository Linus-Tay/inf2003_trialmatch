import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent

# Load the project-level .env first, then allow trialmatch-backend/.env to override it.
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

APP_NAME = os.getenv("APP_NAME", "TrialMatch Backend")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

MARIADB_HOST = os.getenv("MARIADB_HOST", "127.0.0.1")
MARIADB_PORT = int(os.getenv("MARIADB_PORT", "3307"))
MARIADB_USER = os.getenv("MARIADB_USER", "trialmatch_user")
MARIADB_PASSWORD = os.getenv("MARIADB_PASSWORD", "trialmatch_password")
MARIADB_DB = os.getenv("MARIADB_DB", "trialmatch_db")

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://trialmatch_mongo_user:trialmatch_mongo_password@localhost:27017/trialmatch_nosql?authSource=trialmatch_nosql",
)
MONGO_DB = os.getenv("MONGO_DB", "trialmatch_nosql")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))
