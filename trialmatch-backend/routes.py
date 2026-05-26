import json

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pymysql.connections import Connection

from auth import (
    authenticate_user,
    create_access_token,
    create_user,
    get_current_user,
    user_to_public,
)
from db import get_mariadb, get_mongodb
from schemas import (
    AuthResponse,
    FlagResolveRequest,
    LoginRequest,
    PatientProfileCreate,
    SignupRequest,
    TrialCreate,
    TrialUpdate,
    UserOut,
)

router = APIRouter()


def compute_match_status(score: float, structured_passed: bool, review_required: bool) -> str:
    if score >= 75 and structured_passed and not review_required:
        return "Potential Match"
    if score >= 40 or review_required:
        return "Needs Review"
    return "Not Suitable"


def ensure_limit(limit: int, max_limit: int = 100) -> int:
    return min(max(limit, 1), max_limit)


# ============================================================
# HEALTH
# ============================================================
@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.get("/health/db")
def database_health_check(
    conn: Connection = Depends(get_mariadb),
    mongo_db: Database = Depends(get_mongodb),
):
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 AS ok")
            mariadb_result = cursor.fetchone()

        mongo_db.command("ping")

        return {
            "status": "ok",
            "mariadb": mariadb_result,
            "mongodb": "ok",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ============================================================
# AUTH
# ============================================================
@router.post("/auth/signup", response_model=AuthResponse)
def signup(payload: SignupRequest, conn: Connection = Depends(get_mariadb)):
    user = create_user(conn, payload)
    public_user = user_to_public(user)
    token = create_access_token({"sub": str(user["user_id"])})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": public_user,
    }


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, conn: Connection = Depends(get_mariadb)):
    user = authenticate_user(conn, payload.email, payload.password)
    public_user = user_to_public(user)
    token = create_access_token({"sub": str(user["user_id"])})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": public_user,
    }


@router.get("/auth/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    return user_to_public(current_user)


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
                t.minimum_age, t.maximum_age,
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


# ============================================================
# TRIAL SEARCH / SAVED / DETAIL
# ============================================================
@router.get("/trials")
def search_trials(
    q: str | None = Query(default=None),
    condition: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    status: str | None = Query(default=None),
    phase: str | None = Query(default=None),
    sex: str | None = Query(default=None),
    min_age: int | None = Query(default=None, ge=0, le=120),
    max_age: int | None = Query(default=None, ge=0, le=120),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_mariadb),
):
    limit = ensure_limit(limit)

    where = ["t.is_archived = FALSE"]
    params: list[object] = []

    if q:
        cleaned_q = q.strip()
        if cleaned_q.upper().startswith("NCT"):
            where.append("t.nct_id LIKE %s")
            params.append(f"{cleaned_q}%")
        else:
            like = f"%{cleaned_q}%"
            where.append("(t.brief_title LIKE %s OR t.official_title LIKE %s)")
            params.extend([like, like])

    if status:
        where.append("ts.status_name = %s")
        params.append(status)

    if phase:
        where.append("tp.phase_name = %s")
        params.append(phase)

    if sex:
        where.append("(se.sex_name = %s OR se.sex_name = 'All')")
        params.append(sex)

    if min_age is not None:
        where.append("(t.maximum_age IS NULL OR t.maximum_age >= %s)")
        params.append(min_age)

    if max_age is not None:
        where.append("(t.minimum_age IS NULL OR t.minimum_age <= %s)")
        params.append(max_age)

    if condition:
        like = f"%{condition.strip()}%"
        where.append(
            """
            EXISTS (
                SELECT 1
                FROM trial_conditions tc
                JOIN conditions c ON tc.condition_id = c.condition_id
                WHERE tc.trial_id = t.trial_id
                  AND (c.condition_name LIKE %s OR c.normalised_name LIKE %s)
            )
            """
        )
        params.extend([like, like])

    if keyword:
        like = f"%{keyword.strip()}%"
        where.append(
            """
            EXISTS (
                SELECT 1
                FROM eligibility_criteria ec
                WHERE ec.trial_id = t.trial_id
                  AND ec.criteria_text LIKE %s
            )
            """
        )
        params.append(like)

    where_sql = " AND ".join(where)

    with conn.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT COUNT(*) AS total
            FROM trials t
            LEFT JOIN trial_statuses ts ON t.status_id = ts.status_id
            LEFT JOIN trial_phases tp ON t.phase_id = tp.phase_id
            LEFT JOIN sex_eligibilities se ON t.sex_id = se.sex_id
            WHERE {where_sql}
            """,
            tuple(params),
        )
        total = cursor.fetchone()["total"]

        cursor.execute(
            f"""
            SELECT
                t.trial_id, t.nct_id, t.brief_title,
                tp.phase_name, ts.status_name, sty.study_type_name, se.sex_name,
                t.minimum_age, t.maximum_age, t.enrollment_count,
                COALESCE(cache.condition_count, 0) AS condition_count,
                COALESCE(cache.intervention_count, 0) AS intervention_count,
                COALESCE(cache.criteria_count, 0) AS criteria_count,
                cache.avg_complexity_score,
                COALESCE(cache.manual_review_count, 0) AS manual_review_count
            FROM trials t
            LEFT JOIN trial_phases tp ON t.phase_id = tp.phase_id
            LEFT JOIN trial_statuses ts ON t.status_id = ts.status_id
            LEFT JOIN study_types sty ON t.study_type_id = sty.study_type_id
            LEFT JOIN sex_eligibilities se ON t.sex_id = se.sex_id
            LEFT JOIN trial_search_cache cache ON t.trial_id = cache.trial_id
            WHERE {where_sql}
            ORDER BY
                CASE WHEN ts.is_open_to_recruitment = TRUE THEN 0 ELSE 1 END,
                cache.criteria_count DESC,
                t.trial_id DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [limit, offset]),
        )
        trials = cursor.fetchall()

        cursor.execute(
            """
            INSERT INTO search_logs (user_id, query_text, filters_json, result_count)
            VALUES (%s, %s, %s, %s)
            """,
            (
                current_user["user_id"],
                q or condition or keyword,
                json.dumps(
                    {
                        "status": status,
                        "phase": phase,
                        "sex": sex,
                        "min_age": min_age,
                        "max_age": max_age,
                        "condition": condition,
                        "keyword": keyword,
                    }
                ),
                total,
            ),
        )

    conn.commit()
    return {"total": total, "limit": limit, "offset": offset, "trials": trials}


@router.get("/trials/saved")
def get_saved_trials(
    current_user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_mariadb),
):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                st.saved_trial_id, st.saved_status, st.notes, st.saved_at,
                t.trial_id, t.nct_id, t.brief_title,
                tp.phase_name, ts.status_name, se.sex_name,
                t.minimum_age, t.maximum_age,
                COALESCE(cache.criteria_count, 0) AS criteria_count,
                COALESCE(cache.condition_count, 0) AS condition_count
            FROM saved_trials st
            JOIN trials t ON st.trial_id = t.trial_id
            LEFT JOIN trial_phases tp ON t.phase_id = tp.phase_id
            LEFT JOIN trial_statuses ts ON t.status_id = ts.status_id
            LEFT JOIN sex_eligibilities se ON t.sex_id = se.sex_id
            LEFT JOIN trial_search_cache cache ON t.trial_id = cache.trial_id
            WHERE st.user_id = %s
            ORDER BY st.saved_at DESC
            """,
            (current_user["user_id"],),
        )
        rows = cursor.fetchall()

    return {"saved_trials": rows}


@router.get("/trials/{trial_id}")
def get_trial_detail(
    trial_id: int,
    current_user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_mariadb),
    mongo_db: Database = Depends(get_mongodb),
):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                t.trial_id, t.nct_id, t.brief_title, t.official_title,
                t.brief_summary, t.source_url,
                p.phase_name, s.status_name, s.is_open_to_recruitment,
                st.study_type_name, sex.sex_name,
                t.minimum_age, t.maximum_age, t.enrollment_count,
                COALESCE(cache.criteria_count, 0) AS total_criteria,
                COALESCE(cache.inclusion_count, 0) AS inclusion_count,
                COALESCE(cache.exclusion_count, 0) AS exclusion_count,
                cache.avg_complexity_score,
                COALESCE(cache.manual_review_count, 0) AS manual_review_count
            FROM trials t
            LEFT JOIN trial_phases p ON t.phase_id = p.phase_id
            LEFT JOIN trial_statuses s ON t.status_id = s.status_id
            LEFT JOIN study_types st ON t.study_type_id = st.study_type_id
            LEFT JOIN sex_eligibilities sex ON t.sex_id = sex.sex_id
            LEFT JOIN trial_search_cache cache ON t.trial_id = cache.trial_id
            WHERE t.trial_id = %s AND t.is_archived = FALSE
            """,
            (trial_id,),
        )
        trial = cursor.fetchone()

        if not trial:
            raise HTTPException(status_code=404, detail="Trial not found.")

        cursor.execute(
            """
            SELECT c.condition_id, c.condition_name, tc.condition_role
            FROM trial_conditions tc
            JOIN conditions c ON tc.condition_id = c.condition_id
            WHERE tc.trial_id = %s
            ORDER BY c.condition_name
            LIMIT 50
            """,
            (trial_id,),
        )
        conditions = cursor.fetchall()

        cursor.execute(
            """
            SELECT i.intervention_id, i.intervention_name, i.intervention_type
            FROM trial_interventions ti
            JOIN interventions i ON ti.intervention_id = i.intervention_id
            WHERE ti.trial_id = %s
            ORDER BY i.intervention_name
            LIMIT 50
            """,
            (trial_id,),
        )
        interventions = cursor.fetchall()

        cursor.execute(
            """
            SELECT criteria_id, criteria_type, criteria_text, criteria_order, complexity_score, requires_manual_review
            FROM eligibility_criteria
            WHERE trial_id = %s
            ORDER BY criteria_type, criteria_order
            LIMIT 80
            """,
            (trial_id,),
        )
        criteria = cursor.fetchall()

        cursor.execute(
            """
            SELECT saved_trial_id, saved_status, notes
            FROM saved_trials
            WHERE user_id = %s AND trial_id = %s
            """,
            (current_user["user_id"], trial_id),
        )
        saved = cursor.fetchone()

    parsed_doc = mongo_db.parsed_criteria_documents.find_one(
        {"trial_id": trial_id},
        {"_id": 0, "criteria_items": {"$slice": 12}, "nct_id": 1, "trial_id": 1},
    )

    raw_doc = mongo_db.raw_trial_documents.find_one(
        {"trial_id": trial_id},
        {"_id": 0, "dataset_name": 1, "raw.criteria_split_status": 1, "raw.source_condition_query": 1},
    )

    return {
        "trial": trial,
        "conditions": conditions,
        "interventions": interventions,
        "criteria": criteria,
        "saved": saved,
        "mongo": {
            "parsed_criteria_preview": parsed_doc,
            "raw_trace": raw_doc,
        },
    }


@router.post("/trials/{trial_id}/save")
def save_trial(
    trial_id: int,
    current_user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_mariadb),
):
    with conn.cursor() as cursor:
        cursor.execute("SELECT trial_id FROM trials WHERE trial_id = %s AND is_archived = FALSE", (trial_id,))
        trial = cursor.fetchone()

        if not trial:
            raise HTTPException(status_code=404, detail="Trial not found.")

        cursor.execute(
            """
            INSERT INTO saved_trials (user_id, trial_id, saved_status)
            VALUES (%s, %s, 'Saved')
            ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
            """,
            (current_user["user_id"], trial_id),
        )

    conn.commit()
    return {"message": "Trial saved."}


@router.delete("/trials/{trial_id}/save")
def unsave_trial(
    trial_id: int,
    current_user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_mariadb),
):
    with conn.cursor() as cursor:
        cursor.execute(
            "DELETE FROM saved_trials WHERE user_id = %s AND trial_id = %s",
            (current_user["user_id"], trial_id),
        )

    conn.commit()
    return {"message": "Trial removed from saved list."}


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
                enrollment_count, is_archived, created_at, updated_at
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
        cursor.execute(
            """
            INSERT INTO trials (
                nct_id, brief_title, official_title, brief_summary,
                phase_id, status_id, study_type_id, sex_id,
                minimum_age, maximum_age, enrollment_count, source_url
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
                payload.enrollment_count,
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
        cursor.execute("UPDATE trials SET is_archived = TRUE WHERE trial_id = %s", (trial_id,))

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Trial not found.")

    conn.commit()
    return {"message": "Trial archived."}


# ============================================================
# PATIENTS / MATCHING
# ============================================================
@router.get("/patients")
def list_patient_profiles(
    current_user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_mariadb),
):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                pp.patient_profile_id,
                pp.profile_name,
                pp.age,
                se.sex_name,
                pp.notes,
                pp.created_at,
                COUNT(pc.condition_id) AS condition_count
            FROM patient_profiles pp
            JOIN sex_eligibilities se ON pp.sex_id = se.sex_id
            LEFT JOIN patient_conditions pc ON pp.patient_profile_id = pc.patient_profile_id
            WHERE pp.created_by_user_id = %s
            GROUP BY pp.patient_profile_id, pp.profile_name, pp.age, se.sex_name, pp.notes, pp.created_at
            ORDER BY pp.created_at DESC
            """,
            (current_user["user_id"],),
        )
        profiles = cursor.fetchall()

    return {"profiles": profiles}


@router.post("/patients")
def create_patient_profile(
    payload: PatientProfileCreate,
    current_user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_mariadb),
):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO patient_profiles (created_by_user_id, profile_name, age, sex_id, notes)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                current_user["user_id"],
                payload.profile_name.strip(),
                payload.age,
                payload.sex_id,
                payload.notes,
            ),
        )
        profile_id = cursor.lastrowid

        for condition_id in payload.condition_ids:
            cursor.execute(
                """
                INSERT IGNORE INTO patient_conditions (patient_profile_id, condition_id)
                VALUES (%s, %s)
                """,
                (profile_id, condition_id),
            )

    conn.commit()
    return {"patient_profile_id": profile_id, "message": "Patient profile created."}


@router.post("/patients/{profile_id}/match")
def generate_matches(
    profile_id: int,
    limit: int = Query(default=12, ge=1, le=30),
    current_user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_mariadb),
):
    limit = ensure_limit(limit, max_limit=30)

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT pp.patient_profile_id, pp.profile_name, pp.age, pp.sex_id, se.sex_name
            FROM patient_profiles pp
            JOIN sex_eligibilities se ON pp.sex_id = se.sex_id
            WHERE pp.patient_profile_id = %s AND pp.created_by_user_id = %s
            """,
            (profile_id, current_user["user_id"]),
        )
        profile = cursor.fetchone()

        if not profile:
            raise HTTPException(status_code=404, detail="Patient profile not found.")

        cursor.execute(
            "SELECT condition_id FROM patient_conditions WHERE patient_profile_id = %s",
            (profile_id,),
        )
        condition_ids = [row["condition_id"] for row in cursor.fetchall()]

        if not condition_ids:
            raise HTTPException(status_code=400, detail="Add at least one patient condition first.")

        placeholders = ",".join(["%s"] * len(condition_ids))

        cursor.execute(
            f"""
            SELECT
                t.trial_id, t.nct_id, t.brief_title,
                p.phase_name, s.status_name,
                sex.sex_name AS trial_sex,
                t.minimum_age, t.maximum_age,
                matched.matched_condition_count,
                cache.avg_complexity_score,
                COALESCE(cache.manual_review_count, 0) AS manual_review_count,
                CASE
                    WHEN (t.minimum_age IS NULL OR %s >= t.minimum_age)
                     AND (t.maximum_age IS NULL OR %s <= t.maximum_age)
                    THEN 1 ELSE 0
                END AS age_passed,
                CASE
                    WHEN sex.sex_name = 'All' OR sex.sex_name = %s
                    THEN 1 ELSE 0
                END AS sex_passed
            FROM (
                SELECT trial_id, COUNT(DISTINCT condition_id) AS matched_condition_count
                FROM trial_conditions
                WHERE condition_id IN ({placeholders})
                GROUP BY trial_id
                ORDER BY matched_condition_count DESC
                LIMIT 500
            ) matched
            JOIN trials t ON matched.trial_id = t.trial_id
            LEFT JOIN trial_phases p ON t.phase_id = p.phase_id
            LEFT JOIN trial_statuses s ON t.status_id = s.status_id
            LEFT JOIN sex_eligibilities sex ON t.sex_id = sex.sex_id
            LEFT JOIN trial_search_cache cache ON t.trial_id = cache.trial_id
            WHERE t.is_archived = FALSE
            ORDER BY matched.matched_condition_count DESC, age_passed DESC, sex_passed DESC, cache.avg_complexity_score ASC
            LIMIT %s
            """,
            tuple([profile["age"], profile["age"], profile["sex_name"], *condition_ids, limit]),
        )
        candidates = cursor.fetchall()

        results = []

        for candidate in candidates:
            condition_score = min(40, int(candidate["matched_condition_count"]) * 25)
            age_score = 25 if candidate["age_passed"] else 0
            sex_score = 20 if candidate["sex_passed"] else 0
            complexity_score = 15

            if candidate["avg_complexity_score"] is not None and float(candidate["avg_complexity_score"]) > 60:
                complexity_score = 8

            score = min(100, condition_score + age_score + sex_score + complexity_score)
            structured_passed = bool(candidate["age_passed"] and candidate["sex_passed"] and candidate["matched_condition_count"] > 0)
            review_required = bool(candidate["manual_review_count"] and candidate["manual_review_count"] > 0)
            status = compute_match_status(score, structured_passed, review_required)

            cursor.execute(
                """
                INSERT INTO patient_trial_matches (
                    patient_profile_id, trial_id, structured_match_passed,
                    criteria_review_required, match_score, match_status
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    structured_match_passed = VALUES(structured_match_passed),
                    criteria_review_required = VALUES(criteria_review_required),
                    match_score = VALUES(match_score),
                    match_status = VALUES(match_status),
                    matched_at = CURRENT_TIMESTAMP
                """,
                (
                    profile_id,
                    candidate["trial_id"],
                    structured_passed,
                    review_required,
                    score,
                    status,
                ),
            )

            match_id = cursor.lastrowid

            if match_id == 0:
                cursor.execute(
                    """
                    SELECT match_id
                    FROM patient_trial_matches
                    WHERE patient_profile_id = %s AND trial_id = %s
                    """,
                    (profile_id, candidate["trial_id"]),
                )
                match_id = cursor.fetchone()["match_id"]

            results.append(
                {
                    **candidate,
                    "match_id": match_id,
                    "match_score": score,
                    "match_status": status,
                    "structured_match_passed": structured_passed,
                    "criteria_review_required": review_required,
                    "explanation": {
                        "summary": f"{profile['profile_name']} received a {score}% pre-screening score for this trial.",
                        "age_passed": bool(candidate["age_passed"]),
                        "sex_passed": bool(candidate["sex_passed"]),
                        "matched_condition_count": int(candidate["matched_condition_count"]),
                    },
                }
            )

    conn.commit()
    return {"profile": profile, "matches": results}


# ============================================================
# ANALYTICS / QUALITY / DEMO
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

    return {
        "statuses": statuses,
        "phases": phases,
        "study_types": study_types,
        "sexes": sexes,
        "age_buckets": age_buckets,
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


@router.get("/database-demo/overview")
def database_demo_overview(
    conn: Connection = Depends(get_mariadb),
    mongo_db: Database = Depends(get_mongodb),
    current_user: dict = Depends(get_current_user),
):
    table_names = [
        "trials",
        "conditions",
        "interventions",
        "eligibility_criteria",
        "patient_profiles",
        "patient_trial_matches",
        "saved_trials",
        "search_logs",
        "audit_logs",
        "data_quality_flags",
        "trial_search_cache",
        "condition_summary_cache",
    ]

    table_counts = []

    with conn.cursor() as cursor:
        for table in table_names:
            cursor.execute(f"SELECT COUNT(*) AS count_value FROM {table}")
            table_counts.append({"name": table, "count": cursor.fetchone()["count_value"]})

        cursor.execute(
            """
            SELECT 'trial_summary_view' AS name, COUNT(*) AS count_value
            FROM trial_summary_view
            UNION ALL
            SELECT 'eligibility_complexity_view' AS name, COUNT(*) AS count_value
            FROM eligibility_complexity_view
            """
        )
        view_counts = cursor.fetchall()

    mongo_counts = []
    for collection_name in [
        "raw_trial_documents",
        "parsed_criteria_documents",
        "patient_match_explanations",
        "criteria_annotations",
    ]:
        mongo_counts.append(
            {
                "name": collection_name,
                "count": mongo_db[collection_name].count_documents({}),
            }
        )

    return {
        "mariadb_tables": table_counts,
        "mariadb_views": view_counts,
        "mongodb_collections": mongo_counts,
    }


@router.get("/database-demo/nested-queries")
def database_demo_nested_queries(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT c.condition_name, cache.trial_count
            FROM condition_summary_cache cache
            JOIN conditions c ON cache.condition_id = c.condition_id
            WHERE cache.trial_count > (SELECT AVG(trial_count) FROM condition_summary_cache)
            ORDER BY cache.trial_count DESC
            LIMIT 10
            """
        )
        above_average_conditions = cursor.fetchall()

        cursor.execute(
            """
            SELECT t.trial_id, t.nct_id, t.brief_title, cache.criteria_count AS total_criteria, cache.avg_complexity_score
            FROM trial_search_cache cache
            JOIN trials t ON cache.trial_id = t.trial_id
            WHERE cache.avg_complexity_score > (
                SELECT AVG(avg_complexity_score)
                FROM trial_search_cache
                WHERE avg_complexity_score IS NOT NULL
            )
            ORDER BY cache.avg_complexity_score DESC
            LIMIT 10
            """
        )
        complex_trials = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                t.trial_id, t.nct_id, t.brief_title,
                cache.exclusion_count, cache.inclusion_count,
                ROUND(cache.exclusion_count / NULLIF(cache.inclusion_count, 0), 2) AS exclusion_ratio
            FROM trial_search_cache cache
            JOIN trials t ON cache.trial_id = t.trial_id
            WHERE cache.inclusion_count > 0
              AND cache.exclusion_count / cache.inclusion_count > (
                SELECT AVG(exclusion_count / NULLIF(inclusion_count, 0))
                FROM trial_search_cache
                WHERE inclusion_count > 0
              )
            ORDER BY exclusion_ratio DESC
            LIMIT 10
            """
        )
        high_exclusion_ratio = cursor.fetchall()

    return {
        "above_average_conditions": above_average_conditions,
        "complex_trials": complex_trials,
        "high_exclusion_ratio": high_exclusion_ratio,
    }


@router.get("/database-demo/mongo-samples")
def database_demo_mongo_samples(
    mongo_db: Database = Depends(get_mongodb),
    current_user: dict = Depends(get_current_user),
):
    return {
        "raw_trial_document": mongo_db.raw_trial_documents.find_one({}, {"_id": 0}),
        "parsed_criteria_document": mongo_db.parsed_criteria_documents.find_one(
            {},
            {"_id": 0, "criteria_items": {"$slice": 3}},
        ),
        "patient_match_explanation": mongo_db.patient_match_explanations.find_one({}, {"_id": 0}),
        "criteria_annotation": mongo_db.criteria_annotations.find_one({}, {"_id": 0}),
    }


@router.post("/database-demo/refresh-cache")
def refresh_performance_cache(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    with conn.cursor() as cursor:
        cursor.execute(
            """
            REPLACE INTO trial_search_cache (
                trial_id, condition_count, intervention_count, criteria_count,
                inclusion_count, exclusion_count, avg_complexity_score,
                manual_review_count, updated_at
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
                GROUP BY trial_id
            ) tc ON t.trial_id = tc.trial_id
            LEFT JOIN (
                SELECT trial_id, COUNT(*) AS intervention_count
                FROM trial_interventions
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
                GROUP BY trial_id
            ) ec ON t.trial_id = ec.trial_id
            """
        )

        cursor.execute(
            """
            REPLACE INTO condition_summary_cache (condition_id, trial_count, updated_at)
            SELECT c.condition_id, COUNT(tc.trial_id), CURRENT_TIMESTAMP
            FROM conditions c
            LEFT JOIN trial_conditions tc ON c.condition_id = tc.condition_id
            GROUP BY c.condition_id
            """
        )

    conn.commit()
    return {"message": "Performance cache refreshed."}
