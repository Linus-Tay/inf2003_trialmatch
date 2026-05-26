# TrialMatch Frontend

React + Vite + Tailwind CSS frontend for TrialMatch.

## Run locally

### macOS / Linux

```bash
cd trialmatch-frontend
cp .env.example .env
npm install
npm run dev
```

### Windows PowerShell

```powershell
cd trialmatch-frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open:

```txt
http://localhost:5173
```

The frontend calls the FastAPI backend using `VITE_API_BASE_URL`.
