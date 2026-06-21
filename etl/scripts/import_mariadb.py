import os
import re
from pathlib import Path

import pandas as pd
import pymysql
from dotenv import load_dotenv
from tqdm import tqdm

ROOT_DIR = Path(__file__).resolve().parents[2]
BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")
TRIALS_CSV = BASE_DIR / "data" / "trials_clean.csv"
CRITERIA_CSV = BASE_DIR / "data" / "eligibility_criteria_chunks.csv"

BATCH_SIZE = 1000


def get_connection():
    return pymysql.connect(
        host=os.getenv("MARIADB_HOST", "localhost"),
        port=int(os.getenv("MARIADB_PORT", "3307")),
        user=os.getenv("MARIADB_USER", "trialmatch_user"),
        password=os.getenv("MARIADB_PASSWORD", "trialmatch_password"),
        database=os.getenv("MARIADB_DB", "trialmatch_db"),
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        connect_timeout=10,
        read_timeout=180,
        write_timeout=180,
    )


def parse_optional_limit(env_name: str) -> int | None:
    """Read an optional import limit from .env.

    Empty, missing, "none", or "null" means full import. This allows fast
    development imports and full final imports using the same script.
    """

    raw = os.getenv(env_name)
    if raw is None or raw.strip().lower() in {"", "none", "null", "all"}:
        return None

    return int(raw)


def clean_text(value):
    if pd.isna(value):
        return None

    text = str(value).strip()
    return text if text else None


def normalise_name(value):
    """Normalize names for duplicate-safe lookup tables.

    This lowers case and collapses repeated whitespace so values such as
    "Breast Cancer", "breast cancer", and "breast   cancer" map to one row.
    """

    text = clean_text(value)
    if text is None:
        return None

    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_bool(value):
    """Convert source TRUE/FALSE style values into SQL booleans."""

    text = clean_text(value)
    if text is None:
        return None

    text = text.lower()
    if text in {"true", "1", "yes", "y"}:
        return True
    if text in {"false", "0", "no", "n"}:
        return False
    return None


def parse_int(value):
    text = clean_text(value)
    if text is None:
        return None

    try:
        return int(float(text))
    except ValueError:
        return None


def parse_age_to_years(value):
    """Convert ClinicalTrials-style age strings into clean integer years.

    The trials table intentionally enforces ages between 0 and 120 because
    TrialMatch patient profiles also use a realistic 0-120 age range. Some
    source datasets contain placeholder upper ages such as "999 Years" to
    mean "no practical upper limit". Those should not be inserted as real
    human ages, so values above 120 are stored as NULL instead.
    """

    if pd.isna(value):
        return None

    text = str(value).strip().lower()

    if text in {"", "nan", "n/a", "not applicable"}:
        return None

    match = re.search(r"(\d+)", text)

    if not match:
        return None

    number = int(match.group(1))

    if "month" in text:
        years = max(0, round(number / 12))
    elif "week" in text:
        years = max(0, round(number / 52))
    elif "day" in text:
        years = 0
    else:
        years = number

    if years > 120:
        return None

    return years


def parse_trial_age_range(minimum_age_value, maximum_age_value):
    """Return a database-safe trial age range.

    If the source has an impossible range after cleaning, the upper bound is
    treated as unknown instead of allowing the database CHECK constraint to
    fail. The raw source text is still preserved in MongoDB for traceability.
    """

    minimum_age = parse_age_to_years(minimum_age_value)
    maximum_age = parse_age_to_years(maximum_age_value)

    if minimum_age is not None and maximum_age is not None and minimum_age > maximum_age:
        maximum_age = None

    return minimum_age, maximum_age


def map_phase(raw_phase):
    value = clean_text(raw_phase)

    if value is None:
        return "Not Applicable"

    mapping = {
        "EARLY_PHASE1": "Early Phase 1",
        "PHASE1": "Phase 1",
        "PHASE1|PHASE2": "Phase 1/Phase 2",
        "PHASE2": "Phase 2",
        "PHASE2|PHASE3": "Phase 2/Phase 3",
        "PHASE3": "Phase 3",
        "PHASE4": "Phase 4",
        "NA": "Not Applicable",
        "N/A": "Not Applicable",
    }

    return mapping.get(value.upper(), "Not Applicable")


def map_status(raw_status):
    value = clean_text(raw_status)

    if value is None:
        return "Unknown status"

    mapping = {
        "RECRUITING": "Recruiting",
        "NOT_YET_RECRUITING": "Not yet recruiting",
        "ENROLLING_BY_INVITATION": "Enrolling by invitation",
        "ACTIVE_NOT_RECRUITING": "Active, not recruiting",
        "COMPLETED": "Completed",
        "TERMINATED": "Terminated",
        "WITHDRAWN": "Withdrawn",
        "UNKNOWN": "Unknown status",
        "UNKNOWN_STATUS": "Unknown status",
    }

    return mapping.get(value.upper(), "Unknown status")


def map_study_type(raw_study_type):
    value = clean_text(raw_study_type)

    if value is None:
        return "Observational"

    mapping = {
        "INTERVENTIONAL": "Interventional",
        "OBSERVATIONAL": "Observational",
        "EXPANDED_ACCESS": "Expanded Access",
    }

    return mapping.get(value.upper(), "Observational")


def map_sex(raw_sex):
    value = clean_text(raw_sex)

    if value is None:
        return "All"

    mapping = {
        "ALL": "All",
        "MALE": "Male",
        "FEMALE": "Female",
    }

    return mapping.get(value.upper(), "All")


def split_pipe_values(value):
    text = clean_text(value)

    if text is None:
        return []

    return [
        item.strip()
        for item in text.split("|")
        if item.strip()
    ]


def extract_simple_keywords(text):
    important_terms = [
        "cancer", "diabetes", "hypertension", "pregnant", "pregnancy",
        "kidney", "liver", "heart", "severe", "history", "allergy",
        "chemotherapy", "surgery", "adult", "child", "excluded"
    ]

    lowered = text.lower()

    return [
        term
        for term in important_terms
        if term in lowered
    ]


def contains_manual_review_terms(text):
    lowered = text.lower()
    return any(term in lowered for term in ["severe", "history of", "clinically significant", "investigator"])


def get_lookup_maps(conn):
    with conn.cursor() as cursor:
        cursor.execute("SELECT phase_id, phase_name FROM trial_phases")
        phases = {row["phase_name"]: row["phase_id"] for row in cursor.fetchall()}

        cursor.execute("SELECT status_id, status_name FROM trial_statuses")
        statuses = {row["status_name"]: row["status_id"] for row in cursor.fetchall()}

        cursor.execute("SELECT study_type_id, study_type_name FROM study_types")
        study_types = {row["study_type_name"]: row["study_type_id"] for row in cursor.fetchall()}

        cursor.execute("SELECT sex_id, sex_name FROM sex_eligibilities")
        sexes = {row["sex_name"]: row["sex_id"] for row in cursor.fetchall()}

    return phases, statuses, study_types, sexes


def import_trials(conn, limit=None):
    print("Importing trials into MariaDB...")

    phases, statuses, study_types, sexes = get_lookup_maps(conn)
    df_iter = pd.read_csv(TRIALS_CSV, chunksize=BATCH_SIZE)
    total_imported = 0

    for chunk in tqdm(df_iter):
        if limit is not None and total_imported >= limit:
            break

        rows = []

        for _, row in chunk.iterrows():
            if limit is not None and total_imported + len(rows) >= limit:
                break

            nct_id = clean_text(row.get("nct_id"))
            title = clean_text(row.get("title"))

            if not nct_id or not title:
                continue

            phase_name = map_phase(row.get("phase"))
            status_name = map_status(row.get("overall_status"))
            study_type_name = map_study_type(row.get("study_type"))
            sex_name = map_sex(row.get("sex"))

            minimum_age, maximum_age = parse_trial_age_range(
                row.get("minimum_age"),
                row.get("maximum_age"),
            )

            rows.append((
                nct_id,
                title,
                clean_text(row.get("official_title")),
                clean_text(row.get("brief_summary")),
                phases.get(phase_name),
                statuses.get(status_name),
                study_types.get(study_type_name),
                sexes.get(sex_name),
                minimum_age,
                maximum_age,
                parse_bool(row.get("healthy_volunteers")),
                clean_text(row.get("clinicaltrials_url")),
            ))

        if not rows:
            continue

        with conn.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO trials (
                    nct_id, brief_title, official_title, brief_summary,
                    phase_id, status_id, study_type_id, sex_id,
                    minimum_age, maximum_age, healthy_volunteers, source_url
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    brief_title = VALUES(brief_title),
                    official_title = VALUES(official_title),
                    brief_summary = VALUES(brief_summary),
                    phase_id = VALUES(phase_id),
                    status_id = VALUES(status_id),
                    study_type_id = VALUES(study_type_id),
                    sex_id = VALUES(sex_id),
                    minimum_age = VALUES(minimum_age),
                    maximum_age = VALUES(maximum_age),
                    healthy_volunteers = VALUES(healthy_volunteers),
                    source_url = VALUES(source_url)
                """,
                rows,
            )

        conn.commit()
        total_imported += len(rows)

    with conn.cursor() as cursor:
        cursor.execute("SELECT trial_id, nct_id FROM trials")
        nct_to_trial_id = {
            row["nct_id"]: row["trial_id"]
            for row in cursor.fetchall()
        }

    print(f"Trials imported/updated: {total_imported}")
    return nct_to_trial_id


def import_trial_source_metadata(conn, nct_to_trial_id, limit=None):
    print("Importing source metadata into MariaDB...")

    df_iter = pd.read_csv(TRIALS_CSV, chunksize=BATCH_SIZE)
    total_imported = 0

    for chunk in tqdm(df_iter):
        if limit is not None and total_imported >= limit:
            break

        rows = []

        for _, row in chunk.iterrows():
            if limit is not None and total_imported + len(rows) >= limit:
                break

            nct_id = clean_text(row.get("nct_id"))
            trial_id = nct_to_trial_id.get(nct_id)

            if not trial_id:
                continue

            rows.append((
                trial_id,
                clean_text(row.get("source_condition_query")),
                clean_text(row.get("criteria_split_status")),
                clean_text(row.get("combined_text_for_retrieval")),
                parse_bool(row.get("has_eligibility_criteria")),
                parse_int(row.get("eligibility_criteria_length")),
                parse_int(row.get("inclusion_criteria_length")),
                parse_int(row.get("exclusion_criteria_length")),
            ))

        if not rows:
            continue

        with conn.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO trial_source_metadata (
                    trial_id,
                    source_condition_query,
                    criteria_split_status,
                    combined_text_for_retrieval,
                    has_eligibility_criteria,
                    eligibility_criteria_length,
                    inclusion_criteria_length,
                    exclusion_criteria_length
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    source_condition_query = VALUES(source_condition_query),
                    criteria_split_status = VALUES(criteria_split_status),
                    combined_text_for_retrieval = VALUES(combined_text_for_retrieval),
                    has_eligibility_criteria = VALUES(has_eligibility_criteria),
                    eligibility_criteria_length = VALUES(eligibility_criteria_length),
                    inclusion_criteria_length = VALUES(inclusion_criteria_length),
                    exclusion_criteria_length = VALUES(exclusion_criteria_length)
                """,
                rows,
            )

        conn.commit()
        total_imported += len(rows)

    print(f"Source metadata imported/updated: {total_imported}")


def import_conditions_and_interventions(conn, nct_to_trial_id, limit=None):
    print("Importing conditions and interventions...")

    df_iter = pd.read_csv(TRIALS_CSV, chunksize=BATCH_SIZE)
    processed = 0

    for chunk in tqdm(df_iter):
        if limit is not None and processed >= limit:
            break

        with conn.cursor() as cursor:
            for _, row in chunk.iterrows():
                if limit is not None and processed >= limit:
                    break

                nct_id = clean_text(row.get("nct_id"))
                trial_id = nct_to_trial_id.get(nct_id)

                if not trial_id:
                    continue

                for condition in split_pipe_values(row.get("conditions")):
                    normalised = normalise_name(condition)

                    cursor.execute(
                        """
                        INSERT INTO conditions (condition_name, normalised_name, condition_category)
                        VALUES (%s, %s, %s)
                        ON DUPLICATE KEY UPDATE condition_name = VALUES(condition_name)
                        """,
                        (condition, normalised, clean_text(row.get("source_condition_query"))),
                    )

                    cursor.execute(
                        "SELECT condition_id FROM conditions WHERE normalised_name = %s",
                        (normalised,),
                    )
                    condition_id = cursor.fetchone()["condition_id"]

                    cursor.execute(
                        """
                        INSERT IGNORE INTO trial_conditions (trial_id, condition_id, condition_role)
                        VALUES (%s, %s, 'Primary')
                        """,
                        (trial_id, condition_id),
                    )

                for intervention in split_pipe_values(row.get("interventions")):
                    normalised = normalise_name(intervention)

                    cursor.execute(
                        """
                        INSERT INTO interventions (intervention_name, normalised_name)
                        VALUES (%s, %s)
                        ON DUPLICATE KEY UPDATE intervention_name = VALUES(intervention_name)
                        """,
                        (intervention, normalised),
                    )

                    cursor.execute(
                        "SELECT intervention_id FROM interventions WHERE normalised_name = %s",
                        (normalised,),
                    )
                    intervention_id = cursor.fetchone()["intervention_id"]

                    cursor.execute(
                        """
                        INSERT IGNORE INTO trial_interventions (trial_id, intervention_id)
                        VALUES (%s, %s)
                        """,
                        (trial_id, intervention_id),
                    )

                processed += 1

        conn.commit()

    print(f"Condition/intervention links processed: {processed}")


def import_criteria(conn, nct_to_trial_id, limit=None):
    print("Importing eligibility criteria chunks...")

    df_iter = pd.read_csv(CRITERIA_CSV, chunksize=BATCH_SIZE)
    total_imported = 0

    for chunk in tqdm(df_iter):
        if limit is not None and total_imported >= limit:
            break

        rows = []

        for _, row in chunk.iterrows():
            if limit is not None and total_imported + len(rows) >= limit:
                break

            nct_id = clean_text(row.get("nct_id"))
            trial_id = nct_to_trial_id.get(nct_id)

            if not trial_id:
                continue

            criterion_text = clean_text(row.get("criterion_text"))

            if not criterion_text:
                continue

            raw_type = clean_text(row.get("criterion_type")) or "general"
            criteria_type = {
                "inclusion": "Inclusion",
                "exclusion": "Exclusion",
            }.get(raw_type.lower(), "General")

            rows.append((
                trial_id,
                criteria_type,
                criterion_text,
                int(row.get("criterion_index") or 1),
                int(row.get("criterion_length") or len(criterion_text)),
                len(extract_simple_keywords(criterion_text)),
                min(99.99, len(criterion_text) / 20),
                contains_manual_review_terms(criterion_text),
            ))

        if not rows:
            continue

        with conn.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO eligibility_criteria (
                    trial_id, criteria_type, criteria_text, criteria_order,
                    text_length, keyword_count, complexity_score, requires_manual_review
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                rows,
            )

        conn.commit()
        total_imported += len(rows)

    print(f"Criteria chunks imported: {total_imported}")


def refresh_performance_cache(conn):
    """Refresh aggregate cache tables after full import."""

    print("Refreshing trial and condition cache tables...")
    with conn.cursor() as cursor:
        cursor.execute(
            """
            REPLACE INTO trial_search_cache (
                trial_id,
                condition_count,
                intervention_count,
                criteria_count,
                inclusion_count,
                exclusion_count,
                avg_complexity_score,
                manual_review_count,
                updated_at
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
            LEFT JOIN (SELECT trial_id, COUNT(*) AS condition_count FROM trial_conditions GROUP BY trial_id) tc ON t.trial_id = tc.trial_id
            LEFT JOIN (SELECT trial_id, COUNT(*) AS intervention_count FROM trial_interventions GROUP BY trial_id) ti ON t.trial_id = ti.trial_id
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
    print("Cache refresh completed.")


def main():
    conn = get_connection()

    try:
        trial_limit = parse_optional_limit("TRIAL_IMPORT_LIMIT")
        criteria_limit = parse_optional_limit("CRITERIA_IMPORT_LIMIT")

        nct_to_trial_id = import_trials(conn, limit=trial_limit)
        import_trial_source_metadata(conn, nct_to_trial_id, limit=trial_limit)
        import_conditions_and_interventions(conn, nct_to_trial_id, limit=trial_limit)
        import_criteria(conn, nct_to_trial_id, limit=criteria_limit)
        refresh_performance_cache(conn)

        print("MariaDB import completed.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
