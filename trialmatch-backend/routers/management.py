from fastapi import APIRouter, Depends, HTTPException, Query
from pymysql.connections import Connection

from database import get_mariadb
from dependencies import get_current_user, require_admin
from schemas import TrialCreate, TrialUpdate
from services.helpers import ensure_limit
from services.audit import set_audit_user

router = APIRouter(dependencies=[Depends(require_admin)])

# ============================================================
# MANAGEMENT
# ============================================================
@router.get("/management/trials")
def management_list_trials(
    q: str | None = Query(default=None),
    include_archived: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    limit = ensure_limit(limit)

    where = []
    params: list[object] = []

    if not include_archived:
        where.append("is_archived = FALSE")

    if q:
        cleaned_q = q.strip()
        if cleaned_q.upper().startswith("NCT"):
            where.append("nct_id LIKE %s")
            params.append(f"{cleaned_q}%")
        else:
            where.append("brief_title LIKE %s")
            params.append(f"%{cleaned_q}%")

    where_sql = "WHERE " + " AND ".join(where) if where else ""

    with conn.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
                trial_id, nct_id, brief_title, minimum_age, maximum_age,
                healthy_volunteers, is_archived, created_at, updated_at
            FROM trials
            {where_sql}
            ORDER BY updated_at DESC
            LIMIT %s
            """,
            tuple(params + [limit]),
        )
        rows = cursor.fetchall()

    return {"trials": rows}


@router.post("/management/trials")
def management_create_trial(
    payload: TrialCreate,
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    with conn.cursor() as cursor:
        set_audit_user(cursor, current_user)

        cursor.execute(
            """
            INSERT INTO trials (
                nct_id, brief_title, official_title, brief_summary,
                phase_id, status_id, study_type_id, sex_id,
                minimum_age, maximum_age, healthy_volunteers, source_url
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                payload.nct_id.strip(),
                payload.brief_title.strip(),
                payload.official_title,
                payload.brief_summary,
                payload.phase_id,
                payload.status_id,
                payload.study_type_id,
                payload.sex_id,
                payload.minimum_age,
                payload.maximum_age,
                payload.healthy_volunteers,
                payload.source_url,
            ),
        )
        trial_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO trial_search_cache (trial_id)
            VALUES (%s)
            ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
            """,
            (trial_id,),
        )

    conn.commit()
    return {"trial_id": trial_id, "message": "Trial created."}


@router.patch("/management/trials/{trial_id}")
def management_update_trial(
    trial_id: int,
    payload: TrialUpdate,
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    updates = []
    params = []

    for field, value in payload.model_dump(exclude_unset=True).items():
        updates.append(f"{field} = %s")
        params.append(value)

    if not updates:
        return {"message": "Nothing to update."}

    params.append(trial_id)

    with conn.cursor() as cursor:
        set_audit_user(cursor, current_user)

        cursor.execute(
            f"UPDATE trials SET {', '.join(updates)} WHERE trial_id = %s",
            tuple(params),
        )

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Trial not found.")

    conn.commit()
    return {"message": "Trial updated."}


@router.delete("/management/trials/{trial_id}/archive")
def management_archive_trial(
    trial_id: int,
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    with conn.cursor() as cursor:
        set_audit_user(cursor, current_user)

        cursor.execute("UPDATE trials SET is_archived = TRUE WHERE trial_id = %s", (trial_id,))

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Trial not found.")

    conn.commit()
    return {"message": "Trial archived."}

@router.get("/management/audit-logs")
def management_audit_logs(
    table_name: str | None = Query(default=None),
    record_pk: str | None = Query(default=None),
    action_type: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    where = []
    params: list[object] = []

    if table_name:
        where.append("a.table_name = %s")
        params.append(table_name)

    if record_pk:
        where.append("a.record_pk = %s")
        params.append(record_pk)

    if action_type:
        where.append("a.action_type = %s")
        params.append(action_type)

    if user_id:
        where.append("a.user_id = %s")
        params.append(user_id)

    where_sql = "WHERE " + " AND ".join(where) if where else ""

    with conn.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
                a.audit_log_id,
                a.user_id,
                u.full_name,
                u.email,
                a.table_name,
                a.record_pk,
                a.action_type,
                a.old_values,
                a.new_values,
                a.created_at
            FROM audit_logs a
            LEFT JOIN app_users u ON a.user_id = u.user_id
            {where_sql}
            ORDER BY a.created_at DESC
            LIMIT %s
            """,
            tuple(params + [limit]),
        )
        logs = cursor.fetchall()

    return {"audit_logs": logs}