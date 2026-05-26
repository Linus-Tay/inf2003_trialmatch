# TrialMatch

Monorepo structure for the TrialMatch database project.

## Folder idea

```txt
database/           Database init files for Docker
etl/                CSV import scripts and dataset folder
trialmatch-backend/ FastAPI backend
trialmatch-frontend/ React + Vite + Tailwind frontend
```

## First-time setup

### 1. Create env file

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 2. Start MariaDB and MongoDB

```bash
docker compose up -d
```

Check containers:

```bash
docker compose ps
```

### 3. Add your CSV datasets

Put your CSV files inside:

```txt
etl/data/
```

Expected filenames:

```txt
trials_clean.csv
eligibility_criteria_chunks.csv
clinical_trials_raw_patient2trial_...csv
```

Only the first two are used by the current import scripts.

### 4. Run ETL imports

```bash
cd etl
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Mac/Linux:

```bash
source .venv/bin/activate
```

Then:

```bash
pip install -r requirements.txt
python scripts/import_mariadb.py
python scripts/import_mongodb.py
```

### 5. Run FastAPI backend

Open a new terminal:

```bash
cd trialmatch-backend
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Mac/Linux:

```bash
source .venv/bin/activate
```

Then:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Test:

```txt
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/api/health/db
```

### 6. Run React frontend

Open a new terminal:

```bash
cd trialmatch-frontend
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell:

```powershell
cd trialmatch-frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open:

```txt
http://localhost:5173
```

## Important Docker note

Docker init SQL/JS files only run when the database volume is created for the first time.

If you change files in `database/mariadb/init` or `database/mongodb/init` and need a full reset:

```bash
docker compose down -v
docker compose up -d
```

This deletes the local database volume, so only do it when you are okay resetting local DB data.
