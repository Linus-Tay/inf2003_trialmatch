from fastapi import APIRouter, Depends, HTTPException, Query
from pymysql.connections import Connection

from database import get_mariadb
from dependencies import get_current_user
from schemas import PatientProfileCreate
from services.helpers import compute_match_status, ensure_limit

router = APIRouter()

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
                t.minimum_age, t.maximum_age, t.healthy_volunteers,
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
