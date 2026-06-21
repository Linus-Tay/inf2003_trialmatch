from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import APP_NAME, FRONTEND_ORIGIN
from routers import (
    analytics,
    auth,
    dashboard,
    database_demo,
    health,
    lookups,
    management,
    mongo_documents,
    patients,
    quality,
    saved_trials,
    trial_enrichment,
    trials,
)


def create_app() -> FastAPI:
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

    routers = [
        health.router,
        auth.router,
        dashboard.router,
        lookups.router,
        trials.router,
        saved_trials.router,
        management.router,
        trial_enrichment.router,
        patients.router,
        analytics.router,
        quality.router,
        mongo_documents.router,
        database_demo.router,
    ]

    for router in routers:
        app.include_router(router, prefix="/api")

    @app.get("/")
    def root():
        return {"message": "TrialMatch backend is running.", "docs": "/docs"}

    return app


app = create_app()
