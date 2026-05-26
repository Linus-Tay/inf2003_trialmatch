from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from pymysql.connections import Connection

from auth import get_current_user
from db import get_mariadb, get_mongodb
from schemas import (
    CriteriaAnnotationCreate,
    MatchExplanationCreate,
    SavedTrialUpdate,
    TrialConditionAdd,
    TrialCriteriaCreate,
    TrialCriteriaUpdate,
    TrialInterventionAdd,
)

router = APIRouter()


# ============================================================
# Shared helper functions
# ============================================================
def normalise_name(value: str) -> str:
    """Normalise names before storing or comparing lookup values.

    This helps reduce duplicated rows caused by different spacing or casing.
    """

    return " ".join(value.lower().strip().split())


def fetch_optional_view(conn: Connection, view_name: str, sql: str) -> dict[str, Any]:
    """Safely read from a SQL view.

    Some views may not exist yet depending on which SQL files have been loaded.
    This helper reports missing views without crashing the API.
    """

    try:
        with conn.cursor() as cursor:
            cursor.execute(sql)
            return {"view_name": view_name, "exists": True, "rows": cursor.fetchall()}
    except Exception as exc:
        return {"view_name": view_name, "exists": False, "rows": [], "error": str(exc)}


def refresh_trial_cache_for_trial(cursor, trial_id: int):
    """Refresh the performance cache for one trial.

    The live UI reads from trial_search_cache instead of recalculating large
    aggregate joins on every page load.
    """

    cursor.execute(
        """
        REPLACE INTO trial_search_cache (
            trial_id,
            condition_count,
            intervention_count,
            criteria_count,
            inclusion_count,
            exclusion_count,
            avg_complexity_score,
            manual_review_count,
            updated_at
        )
        SELECT
            t.trial_id,
            COALESCE(tc.condition_count, 0),
            COALESCE(ti.intervention_count, 0),
            COALESCE(ec.criteria_count, 0),
            COALESCE(ec.inclusion_count, 0),
            COALESCE(ec.exclusion_count, 0),
            ec.avg_complexity_score,
            COALESCE(ec.manual_review_count, 0),
            CURRENT_TIMESTAMP
        FROM trials t
        LEFT JOIN (
            SELECT trial_id, COUNT(*) AS condition_count
            FROM trial_conditions
            WHERE trial_id = %s
            GROUP BY trial_id
        ) tc ON t.trial_id = tc.trial_id
        LEFT JOIN (
            SELECT trial_id, COUNT(*) AS intervention_count
            FROM trial_interventions
            WHERE trial_id = %s
            GROUP BY trial_id
        ) ti ON t.trial_id = ti.trial_id
        LEFT JOIN (
            SELECT
                trial_id,
                COUNT(*) AS criteria_count,
                SUM(CASE WHEN criteria_type = 'Inclusion' THEN 1 ELSE 0 END) AS inclusion_count,
                SUM(CASE WHEN criteria_type = 'Exclusion' THEN 1 ELSE 0 END) AS exclusion_count,
                ROUND(AVG(complexity_score), 2) AS avg_complexity_score,
                SUM(CASE WHEN requires_manual_review = TRUE THEN 1 ELSE 0 END) AS manual_review_count
            FROM eligibility_criteria
            WHERE trial_id = %s
            GROUP BY trial_id
        ) ec ON t.trial_id = ec.trial_id
        WHERE t.trial_id = %s
        """,
        (trial_id, trial_id, trial_id, trial_id),
    )


def refresh_condition_summary_for_condition(cursor, condition_id: int):
    """Refresh the cached trial count for one condition."""

    cursor.execute(
        """
        REPLACE INTO condition_summary_cache (condition_id, trial_count, updated_at)
        SELECT
            c.condition_id,
            COUNT(tc.trial_id),
            CURRENT_TIMESTAMP
        FROM conditions c
        LEFT JOIN trial_conditions tc ON c.condition_id = tc.condition_id
        WHERE c.condition_id = %s
        GROUP BY c.condition_id
        """,
        (condition_id,),
    )


def get_first_lookup_id(cursor, table_name: str, id_column: str) -> int:
    """Fetch the first lookup ID for safe validation checks."""

    cursor.execute(f"SELECT {id_column} AS id_value FROM {table_name} ORDER BY {id_column} LIMIT 1")
    row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=400, detail=f"No lookup rows found in {table_name}.")

    return row["id_value"]


# ============================================================
# Saved trial workflow routes
# ============================================================
@router.patch("/saved-trials/{saved_trial_id}")
def update_saved_trial(
    saved_trial_id: int,
    payload: SavedTrialUpdate,
    current_user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_mariadb),
):
    """Update a saved trial's workflow status and notes.

    This route demonstrates user-specific update logic on the saved_trials
    workflow table.
    """

    with conn.cursor() as cursor:
        cursor.execute(
            """
            UPDATE saved_trials
            SET saved_status = %s,
                notes = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE saved_trial_id = %s AND user_id = %s
            """,
            (payload.saved_status, payload.notes, saved_trial_id, current_user["user_id"]),
        )

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Saved trial not found.")

    conn.commit()
    return {"message": "Saved trial updated."}


@router.delete("/saved-trials/{saved_trial_id}")
def delete_saved_trial(
    saved_trial_id: int,
    current_user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_mariadb),
):
    """Remove a saved trial for the current user."""

    with conn.cursor() as cursor:
        cursor.execute(
            "DELETE FROM saved_trials WHERE saved_trial_id = %s AND user_id = %s",
            (saved_trial_id, current_user["user_id"]),
        )

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Saved trial not found.")

    conn.commit()
    return {"message": "Saved trial removed."}


# ============================================================
# Trial enrichment routes
# ============================================================
@router.post("/trials/{trial_id}/conditions")
def add_trial_condition(
    trial_id: int,
    payload: TrialConditionAdd,
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Create or reuse a condition, then link it to a trial.

    This demonstrates the trials -> trial_conditions -> conditions
    many-to-many relationship.
    """

    normalised = normalise_name(payload.condition_name)

    with conn.cursor() as cursor:
        cursor.execute("SELECT trial_id FROM trials WHERE trial_id = %s", (trial_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Trial not found.")

        cursor.execute(
            """
            INSERT INTO conditions (condition_name, normalised_name)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE condition_name = VALUES(condition_name)
            """,
            (payload.condition_name.strip(), normalised),
        )

        cursor.execute("SELECT condition_id FROM conditions WHERE normalised_name = %s", (normalised,))
        condition_id = cursor.fetchone()["condition_id"]

        cursor.execute(
            """
            INSERT IGNORE INTO trial_conditions (trial_id, condition_id, condition_role)
            VALUES (%s, %s, %s)
            """,
            (trial_id, condition_id, payload.condition_role),
        )

        refresh_trial_cache_for_trial(cursor, trial_id)
        refresh_condition_summary_for_condition(cursor, condition_id)

    conn.commit()
    return {"message": "Condition linked.", "condition_id": condition_id}


@router.post("/trials/{trial_id}/interventions")
def add_trial_intervention(
    trial_id: int,
    payload: TrialInterventionAdd,
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Create or reuse an intervention, then link it to a trial."""

    normalised = normalise_name(payload.intervention_name)

    with conn.cursor() as cursor:
        cursor.execute("SELECT trial_id FROM trials WHERE trial_id = %s", (trial_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Trial not found.")

        cursor.execute(
            """
            INSERT INTO interventions (intervention_name, intervention_type, normalised_name)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
                intervention_name = VALUES(intervention_name),
                intervention_type = VALUES(intervention_type)
            """,
            (payload.intervention_name.strip(), payload.intervention_type, normalised),
        )

        cursor.execute("SELECT intervention_id FROM interventions WHERE normalised_name = %s", (normalised,))
        intervention_id = cursor.fetchone()["intervention_id"]

        cursor.execute(
            """
            INSERT IGNORE INTO trial_interventions (trial_id, intervention_id, arm_group_label)
            VALUES (%s, %s, %s)
            """,
            (trial_id, intervention_id, payload.arm_group_label),
        )

        refresh_trial_cache_for_trial(cursor, trial_id)

    conn.commit()
    return {"message": "Intervention linked.", "intervention_id": intervention_id}


@router.post("/trials/{trial_id}/criteria")
def add_trial_criteria(
    trial_id: int,
    payload: TrialCriteriaCreate,
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Add a new eligibility criteria row to a trial.

    The route calculates text length and a basic complexity score so analytics
    can update immediately.
    """

    text_length = len(payload.criteria_text)
    computed_score = (
        payload.complexity_score
        if payload.complexity_score is not None
        else min(99.99, round(text_length / 20, 2))
    )

    with conn.cursor() as cursor:
        cursor.execute("SELECT trial_id FROM trials WHERE trial_id = %s", (trial_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Trial not found.")

        cursor.execute(
            """
            INSERT INTO eligibility_criteria (
                trial_id,
                criteria_type,
                criteria_text,
                criteria_order,
                text_length,
                keyword_count,
                complexity_score,
                requires_manual_review
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                trial_id,
                payload.criteria_type,
                payload.criteria_text,
                payload.criteria_order,
                text_length,
                payload.keyword_count,
                computed_score,
                payload.requires_manual_review,
            ),
        )
        criteria_id = cursor.lastrowid
        refresh_trial_cache_for_trial(cursor, trial_id)

    conn.commit()
    return {"message": "Criteria added.", "criteria_id": criteria_id}


@router.patch("/criteria/{criteria_id}")
def update_trial_criteria(
    criteria_id: int,
    payload: TrialCriteriaUpdate,
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Update one eligibility criteria row and refresh its trial cache."""

    update_data = payload.model_dump(exclude_unset=True)

    if "criteria_text" in update_data and update_data["criteria_text"] is not None:
        text_length = len(update_data["criteria_text"])
        update_data["text_length"] = text_length
        if "complexity_score" not in update_data or update_data["complexity_score"] is None:
            update_data["complexity_score"] = min(99.99, round(text_length / 20, 2))

    if not update_data:
        return {"message": "Nothing to update."}

    updates = []
    params: list[Any] = []

    for field, value in update_data.items():
        updates.append(f"{field} = %s")
        params.append(value)

    with conn.cursor() as cursor:
        cursor.execute("SELECT trial_id FROM eligibility_criteria WHERE criteria_id = %s", (criteria_id,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Criteria not found.")

        trial_id = row["trial_id"]
        params.append(criteria_id)

        cursor.execute(
            f"UPDATE eligibility_criteria SET {', '.join(updates)} WHERE criteria_id = %s",
            tuple(params),
        )

        refresh_trial_cache_for_trial(cursor, trial_id)

    conn.commit()
    return {"message": "Criteria updated."}


@router.delete("/criteria/{criteria_id}")
def delete_trial_criteria(
    criteria_id: int,
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Delete one eligibility criteria row and refresh its trial cache."""

    with conn.cursor() as cursor:
        cursor.execute("SELECT trial_id FROM eligibility_criteria WHERE criteria_id = %s", (criteria_id,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Criteria not found.")

        trial_id = row["trial_id"]
        cursor.execute("DELETE FROM eligibility_criteria WHERE criteria_id = %s", (criteria_id,))
        refresh_trial_cache_for_trial(cursor, trial_id)

    conn.commit()
    return {"message": "Criteria deleted."}


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


# ============================================================
# Data quality and database demonstration routes
# ============================================================
@router.get("/quality/optional-views")
def quality_optional_views(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Read optional data quality views if they exist."""

    return {
        "trial_data_quality_view": fetch_optional_view(
            conn,
            "trial_data_quality_view",
            "SELECT * FROM trial_data_quality_view LIMIT 20",
        ),
        "duplicate_criteria_view": fetch_optional_view(
            conn,
            "duplicate_criteria_view",
            "SELECT * FROM duplicate_criteria_view LIMIT 20",
        ),
    }


@router.get("/database-demo/views")
def database_demo_views(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Return limited preview rows from SQL views used in the project evidence."""

    return {
        "trial_summary_view": fetch_optional_view(
            conn,
            "trial_summary_view",
            "SELECT * FROM trial_summary_view LIMIT 10",
        ),
        "eligibility_complexity_view": fetch_optional_view(
            conn,
            "eligibility_complexity_view",
            "SELECT * FROM eligibility_complexity_view ORDER BY avg_complexity_score DESC LIMIT 10",
        ),
        "condition_trial_stats_view": fetch_optional_view(
            conn,
            "condition_trial_stats_view",
            "SELECT * FROM condition_trial_stats_view LIMIT 10",
        ),
        "criteria_distribution_view": fetch_optional_view(
            conn,
            "criteria_distribution_view",
            "SELECT * FROM criteria_distribution_view LIMIT 10",
        ),
        "trial_data_quality_view": fetch_optional_view(
            conn,
            "trial_data_quality_view",
            "SELECT * FROM trial_data_quality_view LIMIT 10",
        ),
        "patient_match_summary_view": fetch_optional_view(
            conn,
            "patient_match_summary_view",
            "SELECT * FROM patient_match_summary_view LIMIT 10",
        ),
    }


@router.post("/database-demo/trigger-test/patient-age")
def trigger_test_patient_age(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Test the invalid-age trigger/constraint.

    A working trigger should reject age 150. The transaction is rolled back either way.
    """

    try:
        with conn.cursor() as cursor:
            sex_id = get_first_lookup_id(cursor, "sex_eligibilities", "sex_id")

            cursor.execute(
                """
                INSERT INTO patient_profiles (
                    created_by_user_id,
                    profile_name,
                    age,
                    sex_id,
                    notes
                )
                VALUES (%s, 'Trigger Test Invalid Age', 150, %s, 'This insert should fail if the age trigger exists.')
                """,
                (current_user["user_id"], sex_id),
            )

        conn.rollback()
        return {
            "trigger_worked": False,
            "message": "Insert succeeded. The invalid-age trigger may be missing.",
        }
    except Exception as exc:
        conn.rollback()
        return {
            "trigger_worked": True,
            "message": "Insert rejected by trigger/constraint.",
            "error": str(exc),
        }


@router.post("/database-demo/trigger-test/match-status")
def trigger_test_match_status(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Test match-status trigger behaviour without persisting test rows.

    The route runs inside a transaction and always rolls back before returning.
    This demonstrates trigger behaviour without adding artificial records to the
    final dataset-backed database.
    """

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT patient_profile_id
                FROM patient_profiles
                WHERE created_by_user_id = %s
                LIMIT 1
                """,
                (current_user["user_id"],),
            )
            profile = cursor.fetchone()

            if not profile:
                sex_id = get_first_lookup_id(cursor, "sex_eligibilities", "sex_id")
                cursor.execute(
                    """
                    INSERT INTO patient_profiles (
                        created_by_user_id,
                        profile_name,
                        age,
                        sex_id,
                        notes
                    )
                    VALUES (%s, 'Rollback Trigger Check Profile', 30, %s, 'Temporary row rolled back by the trigger check route.')
                    """,
                    (current_user["user_id"], sex_id),
                )
                profile = {"patient_profile_id": cursor.lastrowid}

            cursor.execute("SELECT trial_id FROM trials WHERE is_archived = FALSE LIMIT 1")
            trial = cursor.fetchone()

            if not trial:
                conn.rollback()
                raise HTTPException(status_code=400, detail="No active trial found.")

            cursor.execute(
                """
                INSERT INTO patient_trial_matches (
                    patient_profile_id,
                    trial_id,
                    structured_match_passed,
                    criteria_review_required,
                    match_score,
                    match_status
                )
                VALUES (%s, %s, TRUE, FALSE, 88, 'Needs Review')
                ON DUPLICATE KEY UPDATE
                    structured_match_passed = TRUE,
                    criteria_review_required = FALSE,
                    match_score = 88,
                    match_status = 'Needs Review',
                    matched_at = CURRENT_TIMESTAMP
                """,
                (profile["patient_profile_id"], trial["trial_id"]),
            )

            cursor.execute(
                """
                SELECT
                    match_id,
                    match_score,
                    structured_match_passed,
                    criteria_review_required,
                    match_status
                FROM patient_trial_matches
                WHERE patient_profile_id = %s AND trial_id = %s
                """,
                (profile["patient_profile_id"], trial["trial_id"]),
            )
            match_row = cursor.fetchone()

            cursor.execute(
                """
                SELECT *
                FROM match_status_history
                WHERE match_id = %s
                ORDER BY changed_at DESC
                LIMIT 5
                """,
                (match_row["match_id"],),
            )
            history = cursor.fetchall()

        conn.rollback()
        return {
            "message": "Match trigger check completed and rolled back. No test records were kept.",
            "rolled_back": True,
            "match": match_row,
            "history": history,
        }
    except HTTPException:
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Trigger check rolled back: {exc}")


@router.post("/database-demo/transaction-demo/create-trial")
def transaction_demo_create_trial(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Demonstrate a multi-table transaction without keeping test rows.

    The temporary trial, condition link, and criterion are inserted only inside
    the current transaction. The route then rolls back deliberately so the
    database remains dataset-backed and free from artificial records.
    """

    nct_id = "ROLLBACK_CHECK_TRIAL"

    try:
        with conn.cursor() as cursor:
            phase_id = get_first_lookup_id(cursor, "trial_phases", "phase_id")
            status_id = get_first_lookup_id(cursor, "trial_statuses", "status_id")
            study_type_id = get_first_lookup_id(cursor, "study_types", "study_type_id")
            sex_id = get_first_lookup_id(cursor, "sex_eligibilities", "sex_id")

            cursor.execute(
                """
                INSERT INTO trials (
                    nct_id,
                    brief_title,
                    phase_id,
                    status_id,
                    study_type_id,
                    sex_id,
                    minimum_age,
                    maximum_age,
                    healthy_volunteers,
                    enrollment_count
                )
                VALUES (%s, %s, %s, %s, %s, %s, 18, 65, TRUE, 100)
                """,
                (nct_id, "Rollback Transaction Check Trial", phase_id, status_id, study_type_id, sex_id),
            )
            trial_id = cursor.lastrowid

            condition_name = "Rollback Transaction Check Condition"
            condition_normalised = normalise_name(condition_name)

            cursor.execute(
                """
                INSERT INTO conditions (condition_name, normalised_name)
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE condition_name = VALUES(condition_name)
                """,
                (condition_name, condition_normalised),
            )

            cursor.execute("SELECT condition_id FROM conditions WHERE normalised_name = %s", (condition_normalised,))
            condition_id = cursor.fetchone()["condition_id"]

            cursor.execute("INSERT INTO trial_conditions (trial_id, condition_id) VALUES (%s, %s)", (trial_id, condition_id))

            criteria_text = "Participant must be eligible for the rollback transaction check."

            cursor.execute(
                """
                INSERT INTO eligibility_criteria (
                    trial_id,
                    criteria_type,
                    criteria_text,
                    criteria_order,
                    text_length,
                    keyword_count,
                    complexity_score,
                    requires_manual_review
                )
                VALUES (%s, 'Inclusion', %s, 1, %s, 2, 20, FALSE)
                """,
                (trial_id, criteria_text, len(criteria_text)),
            )

            refresh_trial_cache_for_trial(cursor, trial_id)
            refresh_condition_summary_for_condition(cursor, condition_id)

        conn.rollback()

        return {
            "transaction_success": True,
            "rolled_back": True,
            "message": "Transaction check succeeded and was rolled back. No temporary rows were kept.",
            "temporary_trial_id": trial_id,
            "temporary_nct_id": nct_id,
        }
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Transaction check rolled back: {exc}")


@router.get("/database-demo/index-performance")
def index_performance_demo(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Run indexed/cache-backed queries and return timing plus EXPLAIN output."""

    results = {}

    tests = {
        "nct_id_lookup": """
            SELECT trial_id, nct_id, brief_title
            FROM trials
            WHERE nct_id LIKE 'NCT%'
            LIMIT 20
        """,
        "condition_summary_cache": """
            SELECT c.condition_name, cache.trial_count
            FROM condition_summary_cache cache
            JOIN conditions c ON cache.condition_id = c.condition_id
            ORDER BY cache.trial_count DESC
            LIMIT 20
        """,
        "criteria_cache_sort": """
            SELECT t.nct_id, t.brief_title, cache.criteria_count, cache.avg_complexity_score
            FROM trial_search_cache cache
            JOIN trials t ON cache.trial_id = t.trial_id
            ORDER BY cache.criteria_count DESC
            LIMIT 20
        """,
    }

    with conn.cursor() as cursor:
        for test_name, sql in tests.items():
            start_time = time.perf_counter()
            cursor.execute(sql)
            rows = cursor.fetchall()
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            cursor.execute(f"EXPLAIN {sql}")
            explain_rows = cursor.fetchall()

            results[test_name] = {
                "elapsed_ms": elapsed_ms,
                "rows": rows,
                "explain": explain_rows,
            }

    return {"performance_tests": results}


@router.post("/database-demo/refresh-cache")
def refresh_performance_cache(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Rebuild the two UI cache tables after an import or bulk update."""

    with conn.cursor() as cursor:
        cursor.execute(
            """
            REPLACE INTO trial_search_cache (
                trial_id,
                condition_count,
                intervention_count,
                criteria_count,
                inclusion_count,
                exclusion_count,
                avg_complexity_score,
                manual_review_count,
                updated_at
            )
            SELECT
                t.trial_id,
                COALESCE(tc.condition_count, 0),
                COALESCE(ti.intervention_count, 0),
                COALESCE(ec.criteria_count, 0),
                COALESCE(ec.inclusion_count, 0),
                COALESCE(ec.exclusion_count, 0),
                ec.avg_complexity_score,
                COALESCE(ec.manual_review_count, 0),
                CURRENT_TIMESTAMP
            FROM trials t
            LEFT JOIN (SELECT trial_id, COUNT(*) AS condition_count FROM trial_conditions GROUP BY trial_id) tc ON t.trial_id = tc.trial_id
            LEFT JOIN (SELECT trial_id, COUNT(*) AS intervention_count FROM trial_interventions GROUP BY trial_id) ti ON t.trial_id = ti.trial_id
            LEFT JOIN (
                SELECT
                    trial_id,
                    COUNT(*) AS criteria_count,
                    SUM(CASE WHEN criteria_type = 'Inclusion' THEN 1 ELSE 0 END) AS inclusion_count,
                    SUM(CASE WHEN criteria_type = 'Exclusion' THEN 1 ELSE 0 END) AS exclusion_count,
                    ROUND(AVG(complexity_score), 2) AS avg_complexity_score,
                    SUM(CASE WHEN requires_manual_review = TRUE THEN 1 ELSE 0 END) AS manual_review_count
                FROM eligibility_criteria
                GROUP BY trial_id
            ) ec ON t.trial_id = ec.trial_id
            """
        )

        cursor.execute(
            """
            REPLACE INTO condition_summary_cache (condition_id, trial_count, updated_at)
            SELECT
                c.condition_id,
                COUNT(tc.trial_id),
                CURRENT_TIMESTAMP
            FROM conditions c
            LEFT JOIN trial_conditions tc ON c.condition_id = tc.condition_id
            GROUP BY c.condition_id
            """
        )

    conn.commit()
    return {"message": "Performance cache refreshed."}
