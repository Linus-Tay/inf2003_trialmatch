from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import APP_NAME, FRONTEND_ORIGIN
from routes import router as core_router
from module_routes import router as module_router

app = FastAPI(title=APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_ORIGIN,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core routes:
# login, signup, dashboard, trial search, patient matching,
# analytics, data quality, and existing database demo routes.
app.include_router(core_router, prefix="/api")

# Extra module routes:
# saved trial status updates, criteria CRUD, condition/intervention linking,
# MongoDB annotations, view demos, trigger tests, transaction demo,
# and index performance demo.
app.include_router(module_router, prefix="/api")


@app.get("/")
def root():
    return {
        "message": "TrialMatch backend is running.",
        "docs": "/docs",
    }