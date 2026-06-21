from fastapi import APIRouter, Depends
from pymysql.connections import Connection

from database import get_mariadb
from dependencies import get_current_user

router = APIRouter()

# ============================================================
# DASHBOARD
# ============================================================
@router.get("/dashboard/overview")
def dashboard_overview(
    current_user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_mariadb),
):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_trials,
                SUM(CASE WHEN ts.is_open_to_recruitment = TRUE THEN 1 ELSE 0 END) AS open_trials
            FROM trials t
            LEFT JOIN trial_statuses ts ON t.status_id = ts.status_id
            WHERE t.is_archived = FALSE
            """
        )
        summary = cursor.fetchone()

        cursor.execute(
            """
            SELECT
                COALESCE(SUM(criteria_count), 0) AS total_criteria,
                ROUND(AVG(criteria_count), 2) AS avg_criteria_per_trial
            FROM trial_search_cache
            """
        )
        summary = {**summary, **cursor.fetchone()}

        cursor.execute(
            """
            SELECT COUNT(*) AS saved_count
            FROM saved_trials
            WHERE user_id = %s
            """,
            (current_user["user_id"],),
        )
        saved = cursor.fetchone()

        cursor.execute(
            """
            SELECT COUNT(*) AS profile_count
            FROM patient_profiles
            WHERE created_by_user_id = %s
            """,
            (current_user["user_id"],),
        )
        profiles = cursor.fetchone()

        cursor.execute(
            """
            SELECT COALESCE(tp.phase_name, 'Unknown') AS label, COUNT(*) AS value
            FROM trials t
            LEFT JOIN trial_phases tp ON t.phase_id = tp.phase_id
            WHERE t.is_archived = FALSE
            GROUP BY tp.phase_name
            ORDER BY value DESC
            LIMIT 8
            """
        )
        phases = cursor.fetchall()

        cursor.execute(
            """
            SELECT c.condition_id, c.condition_name, cache.trial_count
            FROM condition_summary_cache cache
            JOIN conditions c ON cache.condition_id = c.condition_id
            ORDER BY cache.trial_count DESC
            LIMIT 8
            """
        )
        top_conditions = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                t.trial_id, t.nct_id, t.brief_title,
                tp.phase_name, ts.status_name, se.sex_name,
                t.minimum_age, t.maximum_age, t.healthy_volunteers,
                cache.criteria_count, cache.condition_count
            FROM trials t
            LEFT JOIN trial_phases tp ON t.phase_id = tp.phase_id
            LEFT JOIN trial_statuses ts ON t.status_id = ts.status_id
            LEFT JOIN sex_eligibilities se ON t.sex_id = se.sex_id
            LEFT JOIN trial_search_cache cache ON t.trial_id = cache.trial_id
            WHERE t.is_archived = FALSE
            ORDER BY cache.criteria_count DESC, t.trial_id DESC
            LIMIT 6
            """
        )
        spotlight_trials = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                ROUND(AVG(avg_complexity_score), 2) AS avg_complexity,
                COALESCE(SUM(manual_review_count), 0) AS manual_review_count
            FROM trial_search_cache
            """
        )
        criteria = cursor.fetchone()

    return {
        "summary": summary,
        "saved": saved,
        "profiles": profiles,
        "phase_distribution": phases,
        "top_conditions": top_conditions,
        "spotlight_trials": spotlight_trials,
        "criteria": criteria,
    }
