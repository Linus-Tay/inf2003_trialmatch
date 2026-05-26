# TrialMatch

TrialMatch is a database-driven clinical trial matching project for INF2003. It uses a hybrid database design with:

- **MariaDB** for structured relational data, filtering, joins, matching, views, triggers, indexing, and cache tables.
- **MongoDB** for raw trial documents, parsed eligibility criteria documents, criteria annotations, and flexible match explanations.
- **FastAPI** for the backend API.
- **React + Vite + Tailwind CSS** for the frontend.
- **Python ETL scripts** to import the clinical trial datasets into MariaDB and MongoDB.

This is the current base version of the project. The database schema and core backend/frontend connection are set up. The UI may still be refined later.

---

## Project Structure

```txt
database/             Database init files for Docker
etl/                  CSV import scripts and dataset folder
trialmatch-backend/   FastAPI backend
trialmatch-frontend/  React + Vite + Tailwind frontend
docker-compose.yml    Local MariaDB + MongoDB setup
.env.example          Root environment variable template
README.md             Startup guide
```

---

## Required Software

Install these before running the project locally:

1. **Git**  
   https://git-scm.com/downloads

2. **Docker Desktop**  
   https://www.docker.com/products/docker-desktop/

3. **Python 3.10 or newer**  
   https://www.python.org/downloads/

4. **Node.js LTS**  
   https://nodejs.org/

Check installations:

```bash
git --version
docker --version
docker compose version
python --version
node --version
npm --version
```

On some macOS/Linux systems, use:

```bash
python3 --version
```

---

## Dataset

Download the dataset from Kaggle:

https://www.kaggle.com/datasets/harrachimustapha/clinical-trial-eligibility-criteria-dataset

Place the CSV files inside:

```txt
etl/data/
```

The current import scripts expect these filenames:

```txt
trials_clean.csv
eligibility_criteria_chunks.csv
```

---

## First-Time Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd trialmatch-db
```

---

### 2. Create the root environment file

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

---

### 3. Start MariaDB and MongoDB

Make sure Docker Desktop is running first.

```bash
docker compose up -d
```

Check containers:

```bash
docker compose ps
```

---

### 4. Run ETL imports

From the project root:

```bash
cd etl
python -m venv .venv
```

Activate the virtual environment.

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies and run imports:

```bash
pip install -r requirements.txt
python scripts/import_mariadb.py
python scripts/import_mongodb.py
```

If `python` does not work on macOS/Linux, use:

```bash
python3 scripts/import_mariadb.py
python3 scripts/import_mongodb.py
```

---

### 5. Run the FastAPI backend

Open a new terminal from the project root:

```bash
cd trialmatch-backend
python -m venv .venv
```

Activate the virtual environment.

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies and start the backend:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend links:

```txt
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/api/health/db
```

---

### 6. Run the React frontend

Open a new terminal from the project root:

```bash
cd trialmatch-frontend
npm install
```

Create the frontend environment file.

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Start the frontend:

```bash
npm run dev
```

Open:

```txt
http://localhost:5173
```

---

## Useful Commands

### Stop Docker containers

```bash
docker compose down
```

### Fully reset local databases

This removes the local MariaDB and MongoDB Docker volumes.

```bash
docker compose down -v
docker compose up -d
```

After resetting, run the ETL imports again.

---

## Important Notes

Docker init files only run when the database volume is created for the first time. If the schema, indexes, views, triggers, or MongoDB init files are changed, reset the Docker volume before re-importing the dataset:

```bash
docker compose down -v
docker compose up -d
```

The dataset CSV files are not committed to GitHub. Download them from Kaggle and place the required CSV files in `etl/data/`.

For setup issues, check:

```txt
1. Docker Desktop is running.
2. .env exists in the project root.
3. Dataset files are inside etl/data/.
4. Python virtual environment is activated.
5. Python dependencies are installed.
6. Frontend npm packages are installed.
7. Docker volume was reset if database init files changed.
```

---

## Current Project Status

The current version includes:

- MariaDB schema, lookup tables, indexes, views, triggers, and cache tables.
- MongoDB collections and indexes.
- Python ETL import scripts.
- FastAPI backend routes for authentication, trial search, patient profiles, matching, saved trials, analytics, quality checks, and database demos.
- React + Vite + Tailwind frontend base.
- No fake trial, patient, match, or MongoDB sample data is inserted during database initialization.

Actual clinical trial data is imported through the ETL scripts.
