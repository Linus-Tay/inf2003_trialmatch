from fastapi import APIRouter, Depends, HTTPException
from pymysql.connections import Connection

from database import get_mariadb
from dependencies import get_current_user
from schemas import FlagResolveRequest
from services.helpers import fetch_optional_view

router = APIRouter()

# ============================================================
# DATA QUALITY
# ============================================================
@router.get("/quality/overview")
def data_quality_overview(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    with conn.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) AS value FROM data_quality_flags WHERE is_resolved = FALSE")
        unresolved_flags = cursor.fetchone()["value"]

        cursor.execute("SELECT COUNT(*) AS value FROM trials WHERE phase_id IS NULL AND is_archived = FALSE")
        missing_phase = cursor.fetchone()["value"]

        cursor.execute(
            """
            SELECT COUNT(*) AS value
            FROM trials
            WHERE minimum_age IS NULL AND maximum_age IS NULL AND is_archived = FALSE
            """
        )
        missing_age = cursor.fetchone()["value"]

        cursor.execute(
            """
            SELECT COUNT(*) AS value
            FROM trial_search_cache cache
            JOIN trials t ON cache.trial_id = t.trial_id
            WHERE t.is_archived = FALSE AND cache.criteria_count = 0
            """
        )
        no_criteria = cursor.fetchone()["value"]

    return {
        "unresolved_flags": unresolved_flags,
        "missing_phase": missing_phase,
        "missing_age": missing_age,
        "no_criteria": no_criteria,
    }


@router.get("/quality/flags")
def data_quality_flags(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                dq.flag_id, dq.trial_id, t.nct_id, t.brief_title,
                dq.criteria_id, dq.flag_type, dq.severity, dq.description,
                dq.is_resolved, dq.created_at, dq.resolved_at
            FROM data_quality_flags dq
            LEFT JOIN trials t ON dq.trial_id = t.trial_id
            ORDER BY dq.is_resolved ASC, dq.created_at DESC
            LIMIT 100
            """
        )
        flags = cursor.fetchall()

    return {"flags": flags}


@router.patch("/quality/flags/{flag_id}/resolve")
def resolve_quality_flag(
    flag_id: int,
    payload: FlagResolveRequest,
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            UPDATE data_quality_flags
            SET is_resolved = %s,
                resolved_at = CASE WHEN %s = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END
            WHERE flag_id = %s
            """,
            (payload.is_resolved, payload.is_resolved, flag_id),
        )

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Flag not found.")

    conn.commit()
    return {"message": "Quality flag updated."}

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


@router.post("/quality/generate-flags")
def generate_quality_flags(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Generate reusable data-quality flags from the current dataset.

    The table existed before, but the previous backend only listed/resolved rows.
    This route makes the table useful by populating non-duplicate flags for common
    issues that matter in the demo: missing phase, missing age range, no criteria,
    and high-complexity criteria requiring manual review.
    """

    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO data_quality_flags (trial_id, flag_type, severity, description)
            SELECT t.trial_id, 'Missing Phase', 'Medium',
                   CONCAT('Trial ', t.nct_id, ' has no mapped clinical phase.')
            FROM trials t
            WHERE t.phase_id IS NULL
              AND t.is_archived = FALSE
              AND NOT EXISTS (
                  SELECT 1 FROM data_quality_flags dq
                  WHERE dq.trial_id = t.trial_id
                    AND dq.criteria_id IS NULL
                    AND dq.flag_type = 'Missing Phase'
                    AND dq.is_resolved = FALSE
              )
            """
        )
        missing_phase_inserted = cursor.rowcount

        cursor.execute(
            """
            INSERT INTO data_quality_flags (trial_id, flag_type, severity, description)
            SELECT t.trial_id, 'Missing Age Range', 'Low',
                   CONCAT('Trial ', t.nct_id, ' has no structured minimum or maximum age range.')
            FROM trials t
            WHERE t.minimum_age IS NULL
              AND t.maximum_age IS NULL
              AND t.is_archived = FALSE
              AND NOT EXISTS (
                  SELECT 1 FROM data_quality_flags dq
                  WHERE dq.trial_id = t.trial_id
                    AND dq.criteria_id IS NULL
                    AND dq.flag_type = 'Missing Age Range'
                    AND dq.is_resolved = FALSE
              )
            """
        )
        missing_age_inserted = cursor.rowcount

        cursor.execute(
            """
            INSERT INTO data_quality_flags (trial_id, flag_type, severity, description)
            SELECT t.trial_id, 'No Criteria Imported', 'High',
                   CONCAT('Trial ', t.nct_id, ' has no imported eligibility criteria rows.')
            FROM trials t
            LEFT JOIN trial_search_cache cache ON t.trial_id = cache.trial_id
            WHERE COALESCE(cache.criteria_count, 0) = 0
              AND t.is_archived = FALSE
              AND NOT EXISTS (
                  SELECT 1 FROM data_quality_flags dq
                  WHERE dq.trial_id = t.trial_id
                    AND dq.criteria_id IS NULL
                    AND dq.flag_type = 'No Criteria Imported'
                    AND dq.is_resolved = FALSE
              )
            """
        )
        no_criteria_inserted = cursor.rowcount

        cursor.execute(
            """
            INSERT INTO data_quality_flags (trial_id, criteria_id, flag_type, severity, description)
            SELECT ec.trial_id, ec.criteria_id, 'Manual Review Required', 'Medium',
                   'Criteria text is complex or contains wording that needs human review.'
            FROM eligibility_criteria ec
            WHERE ec.requires_manual_review = TRUE
              AND NOT EXISTS (
                  SELECT 1 FROM data_quality_flags dq
                  WHERE dq.criteria_id = ec.criteria_id
                    AND dq.flag_type = 'Manual Review Required'
                    AND dq.is_resolved = FALSE
              )
            """
        )
        manual_review_inserted = cursor.rowcount

    conn.commit()
    return {
        "message": "Data-quality flag generation completed.",
        "inserted": {
            "missing_phase": missing_phase_inserted,
            "missing_age_range": missing_age_inserted,
            "no_criteria_imported": no_criteria_inserted,
            "manual_review_required": manual_review_inserted,
        },
    }
