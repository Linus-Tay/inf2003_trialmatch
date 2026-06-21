from fastapi import APIRouter, Depends, HTTPException
from pymysql.connections import Connection

from database import get_mariadb
from dependencies import get_current_user
from schemas import SavedTrialUpdate

router = APIRouter()

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
