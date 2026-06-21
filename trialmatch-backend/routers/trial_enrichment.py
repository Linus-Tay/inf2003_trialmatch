from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pymysql.connections import Connection

from database import get_mariadb
from dependencies import get_current_user
from schemas import TrialConditionAdd, TrialCriteriaCreate, TrialCriteriaUpdate, TrialInterventionAdd
from services.cache import refresh_condition_summary_for_condition, refresh_trial_cache_for_trial
from services.helpers import normalise_name, simple_keyword_count

router = APIRouter()

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
            INSERT INTO interventions (intervention_name, normalised_name)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE
                intervention_name = VALUES(intervention_name)
            """,
            (payload.intervention_name.strip(), normalised),
        )

        cursor.execute("SELECT intervention_id FROM interventions WHERE normalised_name = %s", (normalised,))
        intervention_id = cursor.fetchone()["intervention_id"]

        cursor.execute(
            """
            INSERT IGNORE INTO trial_interventions (trial_id, intervention_id)
            VALUES (%s, %s)
            """,
            (trial_id, intervention_id),
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
                payload.keyword_count or simple_keyword_count(payload.criteria_text),
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
