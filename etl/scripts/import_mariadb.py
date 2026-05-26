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
    )


def clean_text(value):
    if pd.isna(value):
        return None

    text = str(value).strip()
    return text if text else None


def normalise_name(value):
    text = clean_text(value)
    if text is None:
        return None

    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_age_to_years(value):
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
        return max(0, round(number / 12))

    if "week" in text:
        return max(0, round(number / 52))

    if "day" in text:
        return 0

    return number


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

    nct_to_trial_id = {}

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

            rows.append((
                nct_id,
                title,
                clean_text(row.get("official_title")),
                clean_text(row.get("brief_summary")),
                phases.get(phase_name),
                statuses.get(status_name),
                study_types.get(study_type_name),
                sexes.get(sex_name),
                parse_age_to_years(row.get("minimum_age")),
                parse_age_to_years(row.get("maximum_age")),
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
                    minimum_age, maximum_age, source_url
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                        INSERT INTO interventions (intervention_name, intervention_type, normalised_name)
                        VALUES (%s, %s, %s)
                        ON DUPLICATE KEY UPDATE intervention_name = VALUES(intervention_name)
                        """,
                        (intervention, None, normalised),
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
                0,
                min(99.99, len(criterion_text) / 20),
                False,
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


def main():
    conn = get_connection()

    try:
        # Start with 5000 first. Change to None after testing.
        trial_limit = 10000

        nct_to_trial_id = import_trials(conn, limit=trial_limit)
        import_conditions_and_interventions(conn, nct_to_trial_id, limit=trial_limit)
        import_criteria(conn, nct_to_trial_id, limit=100000)

        print("MariaDB import completed.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()