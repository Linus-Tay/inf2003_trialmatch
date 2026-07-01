from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from pymysql.connections import Connection

from database import get_mariadb, get_mongodb
from dependencies import require_admin
from schemas import (
    ParsedCriteriaDocumentReviewUpdate,
    ParsedCriteriaItemCreate,
    ParsedCriteriaItemUpdate,
)

router = APIRouter(dependencies=[Depends(require_admin)])

# ============================================================
# MongoDB source-document / parsed-criteria review routes
# ============================================================


def get_trial_context(conn: Connection, trial_id: int) -> dict:
    """Return the MariaDB trial row used to link SQL and MongoDB documents."""

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT trial_id, nct_id, brief_title
            FROM trials
            WHERE trial_id = %s AND is_archived = FALSE
            """,
            (trial_id,),
        )
        trial = cursor.fetchone()

    if not trial:
        raise HTTPException(status_code=404, detail="Trial not found.")

    return trial


def normalise_criteria_type(value: str | None) -> str:
    allowed = {"Inclusion", "Exclusion", "General"}
    candidate = (value or "General").strip().capitalize()
    return candidate if candidate in allowed else "General"


def extract_keywords(text: str, supplied_keywords: list[str] | None = None) -> list[str]:
    if supplied_keywords:
        return [keyword.strip().lower() for keyword in supplied_keywords if keyword.strip()]

    important_terms = [
        "cancer", "diabetes", "hypertension", "pregnant", "pregnancy",
        "kidney", "liver", "heart", "severe", "history", "allergy",
        "chemotherapy", "surgery", "adult", "child", "excluded",
    ]
    lowered = text.lower()
    return [term for term in important_terms if term in lowered]


def has_negation(text: str) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in ["no ", "not ", "without", "exclude", "excluded"])


def build_complexity(text: str) -> dict:
    words = text.split()
    return {
        "character_length": len(text),
        "word_count": len(words),
        "has_numeric_rule": any(char.isdigit() for char in text),
        "has_negation": has_negation(text),
        "score": min(99.99, len(text) / 20),
    }


def build_criteria_item(payload: ParsedCriteriaItemCreate, current_user: dict) -> dict:
    text = payload.original_text.strip()
    now = datetime.utcnow()

    return {
        "criteria_external_id": f"manual-{uuid4().hex[:10]}",
        "criteria_type": normalise_criteria_type(payload.criteria_type),
        "criterion_index": 9999,
        "original_text": text,
        "keywords": extract_keywords(text, payload.keywords),
        "complexity": build_complexity(text),
        "rules": {
            "requires_manual_review": bool(payload.requires_manual_review),
        },
        "source": "manual_mongodb_review",
        "created_by": current_user["full_name"],
        "created_at": now,
        "updated_at": now,
    }


def parsed_projection(limit: int | None = None) -> dict:
    projection = {"_id": 0}
    if limit:
        projection["criteria_items"] = {"$slice": limit}
    return projection


@router.get("/mongo/trials/{trial_id}/document-review")
def get_mongo_document_review(
    trial_id: int,
    conn: Connection = Depends(get_mariadb),
    mongo_db: Database = Depends(get_mongodb),
):
    """Read the MongoDB source document and nested parsed criteria document."""

    trial = get_trial_context(conn, trial_id)

    raw_document = mongo_db.raw_trial_documents.find_one(
        {"trial_id": trial_id},
        {"_id": 0},
    )
    parsed_document = mongo_db.parsed_criteria_documents.find_one(
        {"trial_id": trial_id},
        parsed_projection(),
    )

    return {
        "trial": trial,
        "raw_document": raw_document,
        "parsed_document": parsed_document,
    }


@router.patch("/mongo/trials/{trial_id}/parsed-document-review")
def update_parsed_document_review(
    trial_id: int,
    payload: ParsedCriteriaDocumentReviewUpdate,
    conn: Connection = Depends(get_mariadb),
    mongo_db: Database = Depends(get_mongodb),
    current_user: dict = Depends(require_admin),
):
    """Update flexible review metadata on the parsed criteria document."""

    trial = get_trial_context(conn, trial_id)
    now = datetime.utcnow()

    mongo_db.parsed_criteria_documents.update_one(
        {"trial_id": trial_id},
        {
            "$set": {
                "document_review.status": payload.status.strip(),
                "document_review.reviewer_note": payload.reviewer_note,
                "document_review.reviewed_by": current_user["full_name"],
                "document_review.updated_at": now,
                "updated_at": now,
            },
            "$setOnInsert": {
                "trial_id": trial["trial_id"],
                "nct_id": trial["nct_id"],
                "criteria_items": [],
                "created_at": now,
            },
        },
        upsert=True,
    )

    parsed_document = mongo_db.parsed_criteria_documents.find_one(
        {"trial_id": trial_id},
        parsed_projection(),
    )

    return {
        "message": "Parsed criteria document review metadata updated.",
        "parsed_document": parsed_document,
    }


@router.post("/mongo/trials/{trial_id}/parsed-criteria-items")
def create_parsed_criteria_item(
    trial_id: int,
    payload: ParsedCriteriaItemCreate,
    conn: Connection = Depends(get_mariadb),
    mongo_db: Database = Depends(get_mongodb),
    current_user: dict = Depends(require_admin),
):
    """Create one nested criteria item inside a MongoDB parsed document."""

    trial = get_trial_context(conn, trial_id)
    item = build_criteria_item(payload, current_user)
    now = datetime.utcnow()

    mongo_db.parsed_criteria_documents.update_one(
        {"trial_id": trial_id},
        {
            "$push": {"criteria_items": item},
            "$set": {"updated_at": now},
            "$setOnInsert": {
                "trial_id": trial["trial_id"],
                "nct_id": trial["nct_id"],
                "created_at": now,
            },
        },
        upsert=True,
    )

    return {
        "message": "Parsed criteria item created in MongoDB.",
        "criteria_item": item,
    }


@router.patch("/mongo/trials/{trial_id}/parsed-criteria-items/{criteria_external_id}")
def update_parsed_criteria_item(
    trial_id: int,
    criteria_external_id: str,
    payload: ParsedCriteriaItemUpdate,
    conn: Connection = Depends(get_mariadb),
    mongo_db: Database = Depends(get_mongodb),
    current_user: dict = Depends(require_admin),
):
    """Update one nested criteria item using MongoDB array filters."""

    get_trial_context(conn, trial_id)
    changes = payload.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(status_code=400, detail="No fields provided for update.")

    now = datetime.utcnow()
    set_values = {
        "criteria_items.$[item].updated_at": now,
        "criteria_items.$[item].updated_by": current_user["full_name"],
        "updated_at": now,
    }

    if "criteria_type" in changes:
        set_values["criteria_items.$[item].criteria_type"] = normalise_criteria_type(changes["criteria_type"])

    if "original_text" in changes and changes["original_text"] is not None:
        text = changes["original_text"].strip()
        set_values["criteria_items.$[item].original_text"] = text
        set_values["criteria_items.$[item].complexity"] = build_complexity(text)

        if "keywords" not in changes:
            set_values["criteria_items.$[item].keywords"] = extract_keywords(text)

    if "keywords" in changes and changes["keywords"] is not None:
        set_values["criteria_items.$[item].keywords"] = extract_keywords(
            changes.get("original_text") or "",
            changes["keywords"],
        )

    if "requires_manual_review" in changes:
        set_values["criteria_items.$[item].rules.requires_manual_review"] = bool(changes["requires_manual_review"])

    result = mongo_db.parsed_criteria_documents.update_one(
        {"trial_id": trial_id, "criteria_items.criteria_external_id": criteria_external_id},
        {"$set": set_values},
        array_filters=[{"item.criteria_external_id": criteria_external_id}],
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Parsed criteria item not found.")

    return {
        "message": "Parsed criteria item updated in MongoDB.",
        "criteria_external_id": criteria_external_id,
    }


@router.delete("/mongo/trials/{trial_id}/parsed-criteria-items/{criteria_external_id}")
def delete_parsed_criteria_item(
    trial_id: int,
    criteria_external_id: str,
    conn: Connection = Depends(get_mariadb),
    mongo_db: Database = Depends(get_mongodb),
):
    """Delete one nested criteria item from a MongoDB parsed document."""

    get_trial_context(conn, trial_id)

    result = mongo_db.parsed_criteria_documents.update_one(
        {"trial_id": trial_id},
        {
            "$pull": {"criteria_items": {"criteria_external_id": criteria_external_id}},
            "$set": {"updated_at": datetime.utcnow()},
        },
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Parsed criteria item not found.")

    return {
        "message": "Parsed criteria item deleted from MongoDB.",
        "criteria_external_id": criteria_external_id,
    }
