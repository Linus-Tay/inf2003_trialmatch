import os
from pathlib import Path

import pandas as pd
import pymysql
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne
from tqdm import tqdm

ROOT_DIR = Path(__file__).resolve().parents[2]
BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")
TRIALS_CSV = BASE_DIR / "data" / "trials_clean.csv"
CRITERIA_CSV = BASE_DIR / "data" / "eligibility_criteria_chunks.csv"

BATCH_SIZE = 1000


def parse_optional_limit(env_name: str) -> int | None:
    raw = os.getenv(env_name)
    if raw is None or raw.strip().lower() in {"", "none", "null", "all"}:
        return None
    return int(raw)


def get_mariadb_connection():
    return pymysql.connect(
        host=os.getenv("MARIADB_HOST", "localhost"),
        port=int(os.getenv("MARIADB_PORT", "3307")),
        user=os.getenv("MARIADB_USER", "trialmatch_user"),
        password=os.getenv("MARIADB_PASSWORD", "trialmatch_password"),
        database=os.getenv("MARIADB_DB", "trialmatch_db"),
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )


def get_mongo_db():
    client = MongoClient(os.getenv("MONGO_URI"))
    return client[os.getenv("MONGO_DB", "trialmatch_nosql")]


def clean_value(value):
    if pd.isna(value):
        return None

    value = str(value).strip()
    return value if value else None


def get_nct_to_trial_id():
    conn = get_mariadb_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT trial_id, nct_id FROM trials")
            return {
                row["nct_id"]: row["trial_id"]
                for row in cursor.fetchall()
            }
    finally:
        conn.close()


def import_raw_trial_documents(db, nct_to_trial_id, limit=None):
    """Preserve source trial rows as MongoDB documents.

    MariaDB stores normalized operational columns. MongoDB keeps the raw and
    derived source fields for traceability, retrieval, and future NLP work.
    """

    print("Importing raw trial documents into MongoDB...")

    operations = []
    processed = 0

    for chunk in tqdm(pd.read_csv(TRIALS_CSV, chunksize=BATCH_SIZE)):
        if limit is not None and processed >= limit:
            break

        for _, row in chunk.iterrows():
            if limit is not None and processed >= limit:
                break

            nct_id = clean_value(row.get("nct_id"))
            trial_id = nct_to_trial_id.get(nct_id)

            if not trial_id:
                continue

            doc = {
                "trial_id": trial_id,
                "nct_id": nct_id,
                "dataset_name": "clinical_trial_eligibility_dataset",
                "raw": {
                    "source_condition_query": clean_value(row.get("source_condition_query")),
                    "title": clean_value(row.get("title")),
                    "official_title": clean_value(row.get("official_title")),
                    "brief_summary": clean_value(row.get("brief_summary")),
                    "conditions": clean_value(row.get("conditions")),
                    "interventions": clean_value(row.get("interventions")),
                    "overall_status": clean_value(row.get("overall_status")),
                    "study_type": clean_value(row.get("study_type")),
                    "phase": clean_value(row.get("phase")),
                    "sex": clean_value(row.get("sex")),
                    "minimum_age": clean_value(row.get("minimum_age")),
                    "maximum_age": clean_value(row.get("maximum_age")),
                    "healthy_volunteers": clean_value(row.get("healthy_volunteers")),
                    "eligibility_criteria": clean_value(row.get("eligibility_criteria")),
                    "inclusion_criteria": clean_value(row.get("inclusion_criteria")),
                    "exclusion_criteria": clean_value(row.get("exclusion_criteria")),
                    "criteria_split_status": clean_value(row.get("criteria_split_status")),
                    "combined_text_for_retrieval": clean_value(row.get("combined_text_for_retrieval")),
                    "has_eligibility_criteria": clean_value(row.get("has_eligibility_criteria")),
                    "eligibility_criteria_length": clean_value(row.get("eligibility_criteria_length")),
                    "inclusion_criteria_length": clean_value(row.get("inclusion_criteria_length")),
                    "exclusion_criteria_length": clean_value(row.get("exclusion_criteria_length")),
                    "clinicaltrials_url": clean_value(row.get("clinicaltrials_url")),
                },
            }

            operations.append(
                UpdateOne(
                    {"trial_id": trial_id},
                    {"$set": doc},
                    upsert=True,
                )
            )

            processed += 1

            if len(operations) >= BATCH_SIZE:
                db.raw_trial_documents.bulk_write(operations)
                operations = []

    if operations:
        db.raw_trial_documents.bulk_write(operations)

    print(f"Raw trial documents imported: {processed}")


def import_parsed_criteria_documents(db, nct_to_trial_id, limit=None):
    """Store split criteria as nested arrays grouped by trial.

    This demonstrates a document model: one trial document can contain many
    criteria items with flexible analysis fields.
    """

    print("Importing parsed criteria documents into MongoDB...")

    criteria_by_trial = {}
    processed = 0

    for chunk in tqdm(pd.read_csv(CRITERIA_CSV, chunksize=BATCH_SIZE)):
        if limit is not None and processed >= limit:
            break

        for _, row in chunk.iterrows():
            if limit is not None and processed >= limit:
                break

            nct_id = clean_value(row.get("nct_id"))
            trial_id = nct_to_trial_id.get(nct_id)

            if not trial_id:
                continue

            criterion_text = clean_value(row.get("criterion_text"))

            if not criterion_text:
                continue

            raw_type = clean_value(row.get("criterion_type")) or "general"

            item = {
                "criteria_external_id": clean_value(row.get("criterion_id")),
                "criteria_type": raw_type.capitalize(),
                "criterion_index": int(row.get("criterion_index") or 0),
                "original_text": criterion_text,
                "keywords": extract_simple_keywords(criterion_text),
                "complexity": {
                    "character_length": int(row.get("criterion_length") or len(criterion_text)),
                    "word_count": len(criterion_text.split()),
                    "has_numeric_rule": any(char.isdigit() for char in criterion_text),
                    "has_negation": contains_negation(criterion_text),
                    "score": min(99.99, len(criterion_text) / 20),
                },
                "rules": {
                    "requires_manual_review": contains_manual_review_terms(criterion_text),
                },
            }

            if trial_id not in criteria_by_trial:
                criteria_by_trial[trial_id] = {
                    "trial_id": trial_id,
                    "nct_id": nct_id,
                    "criteria_items": [],
                }

            criteria_by_trial[trial_id]["criteria_items"].append(item)
            processed += 1

    operations = [
        UpdateOne(
            {"trial_id": trial_id},
            {"$set": doc},
            upsert=True,
        )
        for trial_id, doc in criteria_by_trial.items()
    ]

    if operations:
        for start in range(0, len(operations), BATCH_SIZE):
            db.parsed_criteria_documents.bulk_write(operations[start:start + BATCH_SIZE])

    print(f"Criteria items imported into MongoDB: {processed}")


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


def contains_negation(text):
    lowered = text.lower()
    return any(term in lowered for term in [" no ", " not ", "without", "excluded", "exclusion"])


def contains_manual_review_terms(text):
    lowered = text.lower()
    return any(term in lowered for term in ["severe", "history of", "clinically significant", "investigator"])


def main():
    db = get_mongo_db()
    nct_to_trial_id = get_nct_to_trial_id()

    raw_limit = parse_optional_limit("MONGO_RAW_IMPORT_LIMIT")
    criteria_limit = parse_optional_limit("MONGO_CRITERIA_IMPORT_LIMIT")

    import_raw_trial_documents(db, nct_to_trial_id, limit=raw_limit)
    import_parsed_criteria_documents(db, nct_to_trial_id, limit=criteria_limit)

    print("MongoDB import completed.")


if __name__ == "__main__":
    main()
