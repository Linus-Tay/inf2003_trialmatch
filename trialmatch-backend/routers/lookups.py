from fastapi import APIRouter, Depends, Query
from pymysql.connections import Connection

from database import get_mariadb

router = APIRouter()

# ============================================================
# LOOKUPS
# ============================================================
@router.get("/lookups")
def get_lookups(conn: Connection = Depends(get_mariadb)):
    with conn.cursor() as cursor:
        cursor.execute("SELECT phase_id, phase_name FROM trial_phases ORDER BY phase_order")
        phases = cursor.fetchall()

        cursor.execute("SELECT status_id, status_name, is_open_to_recruitment FROM trial_statuses ORDER BY status_id")
        statuses = cursor.fetchall()

        cursor.execute("SELECT study_type_id, study_type_name FROM study_types ORDER BY study_type_name")
        study_types = cursor.fetchall()

        cursor.execute("SELECT sex_id, sex_name FROM sex_eligibilities ORDER BY sex_id")
        sexes = cursor.fetchall()

    return {
        "phases": phases,
        "statuses": statuses,
        "study_types": study_types,
        "sexes": sexes,
    }


@router.get("/lookups/conditions")
def search_conditions(
    q: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    conn: Connection = Depends(get_mariadb),
):
    params: list[object] = []

    sql = """
        SELECT
            c.condition_id,
            c.condition_name,
            COALESCE(cache.trial_count, 0) AS trial_count
        FROM conditions c
        LEFT JOIN condition_summary_cache cache ON c.condition_id = cache.condition_id
    """

    if q:
        sql += " WHERE c.condition_name LIKE %s OR c.normalised_name LIKE %s"
        like = f"%{q.strip()}%"
        params.extend([like, like])

    sql += """
        ORDER BY trial_count DESC, c.condition_name
        LIMIT %s
    """
    params.append(limit)

    with conn.cursor() as cursor:
        cursor.execute(sql, tuple(params))
        conditions = cursor.fetchall()

    return {"conditions": conditions}
