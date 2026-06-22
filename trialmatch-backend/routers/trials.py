import json

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pymysql.connections import Connection

from database import get_mariadb, get_mongodb
from dependencies import get_current_user
from services.helpers import ensure_limit

router = APIRouter()

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
    healthy_volunteers: bool | None = Query(default=None),
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

    if healthy_volunteers is not None:
        where.append("t.healthy_volunteers = %s")
        params.append(healthy_volunteers)

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
                t.minimum_age, t.maximum_age, t.healthy_volunteers,
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
                        "healthy_volunteers": healthy_volunteers,
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
                t.minimum_age, t.maximum_age, t.healthy_volunteers,
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
                t.minimum_age, t.maximum_age, t.healthy_volunteers,
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
            SELECT i.intervention_id, i.intervention_name
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
            ORDER BY criteria_order, criteria_id
            LIMIT 120
            """,
            (trial_id,),
        )
        criteria = decorate_criteria_for_display(cursor.fetchall())

        trial["display_inclusion_count"] = sum(
            1 for item in criteria
            if item.get("display_type") == "Inclusion" and not item.get("is_section_heading")
        )

        trial["display_exclusion_count"] = sum(
            1 for item in criteria
            if item.get("display_type") == "Exclusion" and not item.get("is_section_heading")
        )

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
        {"_id": 0, "dataset_name": 1, "raw.criteria_split_status": 1, "raw.source_condition_query": 1, "raw.healthy_volunteers": 1},
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

def decorate_criteria_for_display(criteria: list[dict]) -> list[dict]:
    current_display_type = None
    cleaned = []

    for item in criteria:
        text = (item.get("criteria_text") or "").strip()
        raw_type = normalise_raw_criteria_type(item.get("criteria_type"))
        detected_type = detect_criteria_type_from_text(text)

        if detected_type:
            current_display_type = detected_type

        item["display_type"] = detected_type or current_display_type or raw_type
        item["is_section_heading"] = is_criteria_section_heading(text)

        cleaned.append(item)

    return cleaned


def normalise_raw_criteria_type(value) -> str:
    text = str(value or "").strip().lower()

    if "inclusion" in text:
        return "Inclusion"

    if "exclusion" in text:
        return "Exclusion"

    return "General"


def detect_criteria_type_from_text(text: str) -> str | None:
    lowered = text.lower().strip()

    inclusion_patterns = [
        "inclusion criteria",
        "following inclusion criteria",
        "meet the following inclusion",
        "meet any of the following inclusion",
        "eligible for enrollment",
        "eligible for enrolment",
    ]

    exclusion_patterns = [
        "exclusion criteria",
        "following exclusion criteria",
        "not eligible",
        "will be excluded",
        "are excluded",
    ]

    if any(pattern in lowered for pattern in inclusion_patterns):
        return "Inclusion"

    if any(pattern in lowered for pattern in exclusion_patterns):
        return "Exclusion"

    return None


def is_criteria_section_heading(text: str) -> bool:
    cleaned = text.strip()
    lowered = cleaned.lower()

    if not cleaned:
        return False

    heading_phrases = [
        "inclusion criteria",
        "exclusion criteria",
        "participant selection",
        "cohort participant selection",
        "arm/module participant selection",
    ]

    if any(phrase in lowered for phrase in heading_phrases) and len(cleaned) <= 180:
        return True

    heading_endings = [
        "cohort",
        "arm",
        "module",
    ]

    return len(cleaned) <= 80 and any(lowered.endswith(ending) for ending in heading_endings)