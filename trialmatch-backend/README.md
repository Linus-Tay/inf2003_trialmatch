# TrialMatch Backend Recovery Fast

Replace your current `trialmatch-backend` folder with this folder if your routes got overwritten.

## Run

```powershell
cd trialmatch-backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload
```

Then open:

```txt
http://127.0.0.1:8000/docs
```

You should see:

```txt
POST /api/auth/login
POST /api/auth/signup
GET  /api/dashboard/overview
GET  /api/trials
```
