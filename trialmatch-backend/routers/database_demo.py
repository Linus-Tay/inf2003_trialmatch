import time

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pymysql.connections import Connection

from database import get_mariadb, get_mongodb
from dependencies import get_current_user
from services.cache import refresh_all_performance_caches, refresh_condition_summary_for_condition, refresh_trial_cache_for_trial
from services.helpers import fetch_optional_view, get_first_lookup_id, normalise_name

router = APIRouter()

# ============================================================
# DATABASE DEMO
# ============================================================
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

@router.get("/database-demo/views")
def database_demo_views(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Return limited preview rows from SQL views used in the project evidence."""

    return {
        "trial_summary_view": fetch_optional_view(
            conn,
            "trial_summary_view",
            "SELECT * FROM trial_summary_view LIMIT 10",
        ),
        "eligibility_complexity_view": fetch_optional_view(
            conn,
            "eligibility_complexity_view",
            "SELECT * FROM eligibility_complexity_view ORDER BY avg_complexity_score DESC LIMIT 10",
        ),
        "condition_trial_stats_view": fetch_optional_view(
            conn,
            "condition_trial_stats_view",
            "SELECT * FROM condition_trial_stats_view LIMIT 10",
        ),
        "criteria_distribution_view": fetch_optional_view(
            conn,
            "criteria_distribution_view",
            "SELECT * FROM criteria_distribution_view LIMIT 10",
        ),
        "trial_data_quality_view": fetch_optional_view(
            conn,
            "trial_data_quality_view",
            "SELECT * FROM trial_data_quality_view LIMIT 10",
        ),
        "patient_match_summary_view": fetch_optional_view(
            conn,
            "patient_match_summary_view",
            "SELECT * FROM patient_match_summary_view LIMIT 10",
        ),
    }

@router.post("/database-demo/trigger-test/patient-age")
def trigger_test_patient_age(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Test the invalid-age trigger/constraint.

    A working trigger should reject age 150. The transaction is rolled back either way.
    """

    try:
        with conn.cursor() as cursor:
            sex_id = get_first_lookup_id(cursor, "sex_eligibilities", "sex_id")

            cursor.execute(
                """
                INSERT INTO patient_profiles (
                    created_by_user_id,
                    profile_name,
                    age,
                    sex_id,
                    notes
                )
                VALUES (%s, 'Trigger Test Invalid Age', 150, %s, 'This insert should fail if the age trigger exists.')
                """,
                (current_user["user_id"], sex_id),
            )

        conn.rollback()
        return {
            "trigger_worked": False,
            "message": "Insert succeeded. The invalid-age trigger may be missing.",
        }
    except Exception as exc:
        conn.rollback()
        return {
            "trigger_worked": True,
            "message": "Insert rejected by trigger/constraint.",
            "error": str(exc),
        }

@router.post("/database-demo/trigger-test/match-status")
def trigger_test_match_status(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Test match-status trigger behaviour without persisting test rows.

    The route runs inside a transaction and always rolls back before returning.
    This demonstrates trigger behaviour without adding artificial records to the
    final dataset-backed database.
    """

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT patient_profile_id
                FROM patient_profiles
                WHERE created_by_user_id = %s
                LIMIT 1
                """,
                (current_user["user_id"],),
            )
            profile = cursor.fetchone()

            if not profile:
                sex_id = get_first_lookup_id(cursor, "sex_eligibilities", "sex_id")
                cursor.execute(
                    """
                    INSERT INTO patient_profiles (
                        created_by_user_id,
                        profile_name,
                        age,
                        sex_id,
                        notes
                    )
                    VALUES (%s, 'Rollback Trigger Check Profile', 30, %s, 'Temporary row rolled back by the trigger check route.')
                    """,
                    (current_user["user_id"], sex_id),
                )
                profile = {"patient_profile_id": cursor.lastrowid}

            cursor.execute("SELECT trial_id FROM trials WHERE is_archived = FALSE LIMIT 1")
            trial = cursor.fetchone()

            if not trial:
                conn.rollback()
                raise HTTPException(status_code=400, detail="No active trial found.")

            cursor.execute(
                """
                INSERT INTO patient_trial_matches (
                    patient_profile_id,
                    trial_id,
                    structured_match_passed,
                    criteria_review_required,
                    match_score,
                    match_status
                )
                VALUES (%s, %s, TRUE, FALSE, 88, 'Needs Review')
                ON DUPLICATE KEY UPDATE
                    structured_match_passed = TRUE,
                    criteria_review_required = FALSE,
                    match_score = 88,
                    match_status = 'Needs Review',
                    matched_at = CURRENT_TIMESTAMP
                """,
                (profile["patient_profile_id"], trial["trial_id"]),
            )

            cursor.execute(
                """
                SELECT
                    match_id,
                    match_score,
                    structured_match_passed,
                    criteria_review_required,
                    match_status
                FROM patient_trial_matches
                WHERE patient_profile_id = %s AND trial_id = %s
                """,
                (profile["patient_profile_id"], trial["trial_id"]),
            )
            match_row = cursor.fetchone()

            cursor.execute(
                """
                SELECT *
                FROM match_status_history
                WHERE match_id = %s
                ORDER BY changed_at DESC
                LIMIT 5
                """,
                (match_row["match_id"],),
            )
            history = cursor.fetchall()

        conn.rollback()
        return {
            "message": "Match trigger check completed and rolled back. No test records were kept.",
            "rolled_back": True,
            "match": match_row,
            "history": history,
        }
    except HTTPException:
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Trigger check rolled back: {exc}")

@router.post("/database-demo/transaction-demo/create-trial")
def transaction_demo_create_trial(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Demonstrate a multi-table transaction without keeping test rows.

    The temporary trial, condition link, and criterion are inserted only inside
    the current transaction. The route then rolls back deliberately so the
    database remains dataset-backed and free from artificial records.
    """

    nct_id = "ROLLBACK_CHECK_TRIAL"

    try:
        with conn.cursor() as cursor:
            phase_id = get_first_lookup_id(cursor, "trial_phases", "phase_id")
            status_id = get_first_lookup_id(cursor, "trial_statuses", "status_id")
            study_type_id = get_first_lookup_id(cursor, "study_types", "study_type_id")
            sex_id = get_first_lookup_id(cursor, "sex_eligibilities", "sex_id")

            cursor.execute(
                """
                INSERT INTO trials (
                    nct_id,
                    brief_title,
                    phase_id,
                    status_id,
                    study_type_id,
                    sex_id,
                    minimum_age,
                    maximum_age,
                    healthy_volunteers,
                )
                VALUES (%s, %s, %s, %s, %s, %s, 18, 65, TRUE, 100)
                """,
                (nct_id, "Rollback Transaction Check Trial", phase_id, status_id, study_type_id, sex_id),
            )
            trial_id = cursor.lastrowid

            condition_name = "Rollback Transaction Check Condition"
            condition_normalised = normalise_name(condition_name)

            cursor.execute(
                """
                INSERT INTO conditions (condition_name, normalised_name)
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE condition_name = VALUES(condition_name)
                """,
                (condition_name, condition_normalised),
            )

            cursor.execute("SELECT condition_id FROM conditions WHERE normalised_name = %s", (condition_normalised,))
            condition_id = cursor.fetchone()["condition_id"]

            cursor.execute("INSERT INTO trial_conditions (trial_id, condition_id) VALUES (%s, %s)", (trial_id, condition_id))

            criteria_text = "Participant must be eligible for the rollback transaction check."

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
                VALUES (%s, 'Inclusion', %s, 1, %s, 2, 20, FALSE)
                """,
                (trial_id, criteria_text, len(criteria_text)),
            )

            refresh_trial_cache_for_trial(cursor, trial_id)
            refresh_condition_summary_for_condition(cursor, condition_id)

        conn.rollback()

        return {
            "transaction_success": True,
            "rolled_back": True,
            "message": "Transaction check succeeded and was rolled back. No temporary rows were kept.",
            "temporary_trial_id": trial_id,
            "temporary_nct_id": nct_id,
        }
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Transaction check rolled back: {exc}")

@router.get("/database-demo/index-performance")
def index_performance_demo(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Run indexed/cache-backed queries and return timing plus EXPLAIN output."""

    results = {}

    tests = {
        "nct_id_lookup": """
            SELECT trial_id, nct_id, brief_title
            FROM trials
            WHERE nct_id LIKE 'NCT%'
            LIMIT 20
        """,
        "condition_summary_cache": """
            SELECT c.condition_name, cache.trial_count
            FROM condition_summary_cache cache
            JOIN conditions c ON cache.condition_id = c.condition_id
            ORDER BY cache.trial_count DESC
            LIMIT 20
        """,
        "criteria_cache_sort": """
            SELECT t.nct_id, t.brief_title, cache.criteria_count, cache.avg_complexity_score
            FROM trial_search_cache cache
            JOIN trials t ON cache.trial_id = t.trial_id
            ORDER BY cache.criteria_count DESC
            LIMIT 20
        """,
        "fulltext_trial_search": """
            SELECT trial_id, nct_id, brief_title
            FROM trials
            WHERE MATCH(brief_title, official_title, brief_summary) AGAINST ('cancer' IN NATURAL LANGUAGE MODE)
            LIMIT 20
        """,
        "fulltext_criteria_search": """
            SELECT ec.criteria_id, t.nct_id, ec.criteria_type, LEFT(ec.criteria_text, 200) AS criteria_preview
            FROM eligibility_criteria ec
            JOIN trials t ON ec.trial_id = t.trial_id
            WHERE MATCH(ec.criteria_text) AGAINST ('diabetes' IN NATURAL LANGUAGE MODE)
            LIMIT 20
        """,
        "fulltext_source_metadata_search": """
            SELECT t.trial_id, t.nct_id, t.brief_title,
                   MATCH(meta.combined_text_for_retrieval) AGAINST ('diabetes' IN NATURAL LANGUAGE MODE) AS relevance_score
            FROM trial_source_metadata meta
            JOIN trials t ON meta.trial_id = t.trial_id
            WHERE MATCH(meta.combined_text_for_retrieval) AGAINST ('diabetes' IN NATURAL LANGUAGE MODE)
            ORDER BY relevance_score DESC
            LIMIT 20
        """,
    }

    with conn.cursor() as cursor:
        for test_name, sql in tests.items():
            start_time = time.perf_counter()
            cursor.execute(sql)
            rows = cursor.fetchall()
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            cursor.execute(f"EXPLAIN {sql}")
            explain_rows = cursor.fetchall()

            results[test_name] = {
                "elapsed_ms": elapsed_ms,
                "rows": rows,
                "explain": explain_rows,
            }

    return {"performance_tests": results}


@router.get("/database-demo/source-fulltext-search")
def source_fulltext_search_demo(
    query: str,
    limit: int = Query(default=20, ge=1, le=50),
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    """Search the source retrieval text stored in trial_source_metadata.

    This route directly demonstrates the FULLTEXT index on
    trial_source_metadata.combined_text_for_retrieval.
    """

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                t.trial_id,
                t.nct_id,
                t.brief_title,
                meta.source_condition_query,
                MATCH(meta.combined_text_for_retrieval) AGAINST (%s IN NATURAL LANGUAGE MODE) AS relevance_score
            FROM trial_source_metadata meta
            JOIN trials t ON meta.trial_id = t.trial_id
            WHERE MATCH(meta.combined_text_for_retrieval) AGAINST (%s IN NATURAL LANGUAGE MODE)
              AND t.is_archived = FALSE
            ORDER BY relevance_score DESC
            LIMIT %s
            """,
            (query, query, limit),
        )
        rows = cursor.fetchall()

    return {"query": query, "results": rows}


@router.post("/database-demo/refresh-cache")
def refresh_performance_cache(
    conn: Connection = Depends(get_mariadb),
    current_user: dict = Depends(get_current_user),
):
    with conn.cursor() as cursor:
        refresh_all_performance_caches(cursor)

    conn.commit()
    return {"message": "Performance cache refreshed."}
