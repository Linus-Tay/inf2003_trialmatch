# TrialMatch Backend

FastAPI backend for the TrialMatch database project.

The backend reads database settings from the root `.env` and optionally from `trialmatch-backend/.env`.

## Run locally

### macOS / Linux

```bash
cd trialmatch-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Windows PowerShell

```powershell
cd trialmatch-backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

Open:

```txt
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/api/health/db
```
