# TrialMatch Backend

Clean FastAPI backend for the TrialMatch database project.

## Structure

```txt
trialmatch-backend/
├── main.py              # FastAPI entry point and router registration
├── config.py            # Environment configuration
├── database.py          # MariaDB and MongoDB connection dependencies
├── dependencies.py      # Auth/JWT/current-user helpers
├── routers/             # Route modules grouped by feature
├── schemas/             # Pydantic request/response models
├── services/            # Shared cache/helper logic
├── models/              # Reserved for ORM models if added later
├── .env.example         # Example local environment variables
└── requirements.txt
```

## Run locally

```bash
cd trialmatch-backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env        # update values if needed
uvicorn main:app --reload
```

Open:

```txt
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/api/health/db
```

## Notes

- Public API paths are preserved so the existing frontend should continue to work.
- Duplicate cache-refresh route logic was centralized into `services/cache.py`.
- Data-quality flag generation is available at `POST /api/quality/generate-flags`.
- The database demo index route includes full-text search examples to match the full-text indexes in the SQL setup.
