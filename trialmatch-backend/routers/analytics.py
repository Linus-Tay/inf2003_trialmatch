from fastapi import APIRouter, Depends
from pymysql.connections import Connection

from database import get_mariadb
from dependencies import get_current_user

router = APIRouter()

# ============================================================
# ANALYTICS
# ============================================================
@router.get("/analytics/clinical")
def clinical_analytics(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT COALESCE(ts.status_name, 'Unknown') AS label, COUNT(*) AS value
            FROM trials t
            LEFT JOIN trial_statuses ts ON t.status_id = ts.status_id
            WHERE t.is_archived = FALSE
            GROUP BY ts.status_name
            ORDER BY value DESC
            """
        )
        statuses = cursor.fetchall()

        cursor.execute(
            """
            SELECT COALESCE(tp.phase_name, 'Unknown') AS label, COUNT(*) AS value
            FROM trials t
            LEFT JOIN trial_phases tp ON t.phase_id = tp.phase_id
            WHERE t.is_archived = FALSE
            GROUP BY tp.phase_name
            ORDER BY value DESC
            """
        )
        phases = cursor.fetchall()

        cursor.execute(
            """
            SELECT COALESCE(st.study_type_name, 'Unknown') AS label, COUNT(*) AS value
            FROM trials t
            LEFT JOIN study_types st ON t.study_type_id = st.study_type_id
            WHERE t.is_archived = FALSE
            GROUP BY st.study_type_name
            ORDER BY value DESC
            """
        )
        study_types = cursor.fetchall()

        cursor.execute(
            """
            SELECT COALESCE(se.sex_name, 'Unknown') AS label, COUNT(*) AS value
            FROM trials t
            LEFT JOIN sex_eligibilities se ON t.sex_id = se.sex_id
            WHERE t.is_archived = FALSE
            GROUP BY se.sex_name
            ORDER BY value DESC
            """
        )
        sexes = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                CASE
                    WHEN minimum_age IS NULL AND maximum_age IS NULL THEN 'Unspecified'
                    WHEN minimum_age <= 18 THEN 'Includes youth'
                    WHEN minimum_age BETWEEN 19 AND 64 THEN 'Adult focused'
                    WHEN minimum_age >= 65 THEN 'Older adult focused'
                    ELSE 'Mixed'
                END AS label,
                COUNT(*) AS value
            FROM trials
            WHERE is_archived = FALSE
            GROUP BY label
            ORDER BY value DESC
            """
        )
        age_buckets = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                CASE
                    WHEN healthy_volunteers = TRUE THEN 'Accepts healthy volunteers'
                    WHEN healthy_volunteers = FALSE THEN 'Patients/condition-specific only'
                    ELSE 'Unspecified'
                END AS label,
                COUNT(*) AS value
            FROM trials
            WHERE is_archived = FALSE
            GROUP BY label
            ORDER BY value DESC
            """
        )
        healthy_volunteer_distribution = cursor.fetchall()

    return {
        "statuses": statuses,
        "phases": phases,
        "study_types": study_types,
        "sexes": sexes,
        "age_buckets": age_buckets,
        "healthy_volunteer_distribution": healthy_volunteer_distribution,
    }


@router.get("/analytics/criteria")
def criteria_analytics(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                COALESCE(SUM(inclusion_count), 0) AS inclusion_count,
                COALESCE(SUM(exclusion_count), 0) AS exclusion_count,
                ROUND(AVG(avg_complexity_score), 2) AS avg_complexity,
                COALESCE(SUM(manual_review_count), 0) AS manual_review_count
            FROM trial_search_cache
            """
        )
        overview = cursor.fetchone()

        cursor.execute(
            """
            SELECT
                COALESCE(tp.phase_name, 'Unknown') AS label,
                ROUND(AVG(cache.avg_complexity_score), 2) AS value
            FROM trial_search_cache cache
            JOIN trials t ON cache.trial_id = t.trial_id
            LEFT JOIN trial_phases tp ON t.phase_id = tp.phase_id
            WHERE t.is_archived = FALSE
            GROUP BY tp.phase_name
            ORDER BY value DESC
            """
        )
        complexity_by_phase = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                t.trial_id, t.nct_id, t.brief_title,
                cache.criteria_count AS total_criteria,
                cache.inclusion_count, cache.exclusion_count,
                cache.avg_complexity_score, cache.manual_review_count
            FROM trial_search_cache cache
            JOIN trials t ON cache.trial_id = t.trial_id
            WHERE t.is_archived = FALSE
            ORDER BY cache.avg_complexity_score DESC, cache.criteria_count DESC
            LIMIT 15
            """
        )
        strict_trials = cursor.fetchall()

        cursor.execute(
            """
            SELECT criteria_type AS label, COUNT(*) AS value
            FROM eligibility_criteria
            GROUP BY criteria_type
            ORDER BY value DESC
            """
        )
        criteria_types = cursor.fetchall()

    return {
        "overview": overview,
        "complexity_by_phase": complexity_by_phase,
        "strict_trials": strict_trials,
        "criteria_types": criteria_types,
    }
