from datetime import datetime

from fastapi import APIRouter, Depends
from pymongo.database import Database

from database import get_mongodb
from dependencies import get_current_user
from schemas import CriteriaAnnotationCreate, MatchExplanationCreate

router = APIRouter()

# ============================================================
# MongoDB document routes
# ============================================================
@router.post("/mongo/criteria-annotations")
def create_criteria_annotation(
    payload: CriteriaAnnotationCreate,
    mongo_db: Database = Depends(get_mongodb),
    current_user: dict = Depends(get_current_user),
):
    """Store reviewer notes for criteria in MongoDB.

    SQL keeps the structured criteria row. MongoDB stores flexible notes/tags.
    """

    annotation = {
        "note": payload.note,
        "tags": payload.tags,
        "reviewer": payload.reviewer or current_user["full_name"],
        "created_at": datetime.utcnow(),
    }

    mongo_db.criteria_annotations.update_one(
        {"criteria_id": payload.criteria_id, "trial_id": payload.trial_id},
        {
            "$push": {"annotations": annotation},
            "$setOnInsert": {
                "criteria_id": payload.criteria_id,
                "trial_id": payload.trial_id,
            },
        },
        upsert=True,
    )

    return {"message": "Annotation saved.", "annotation": annotation}


@router.get("/mongo/criteria-annotations/{criteria_id}")
def get_criteria_annotations(
    criteria_id: int,
    mongo_db: Database = Depends(get_mongodb),
    current_user: dict = Depends(get_current_user),
):
    """Read MongoDB annotations for one criteria row."""

    doc = mongo_db.criteria_annotations.find_one({"criteria_id": criteria_id}, {"_id": 0})
    return {"annotation_document": doc}


@router.post("/mongo/match-explanations")
def upsert_match_explanation(
    payload: MatchExplanationCreate,
    mongo_db: Database = Depends(get_mongodb),
    current_user: dict = Depends(get_current_user),
):
    """Save a flexible match explanation document in MongoDB."""

    doc = payload.model_dump()
    doc["updated_at"] = datetime.utcnow()

    mongo_db.patient_match_explanations.update_one(
        {"match_id": payload.match_id},
        {"$set": doc},
        upsert=True,
    )

    return {"message": "Match explanation saved.", "match_id": payload.match_id}


@router.get("/mongo/match-explanations/{match_id}")
def get_match_explanation(
    match_id: int,
    mongo_db: Database = Depends(get_mongodb),
    current_user: dict = Depends(get_current_user),
):
    """Read one saved match explanation from MongoDB."""

    doc = mongo_db.patient_match_explanations.find_one({"match_id": match_id}, {"_id": 0})
    return {"match_explanation": doc}
