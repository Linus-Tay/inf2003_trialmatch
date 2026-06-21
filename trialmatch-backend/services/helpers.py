from typing import Any

from fastapi import HTTPException
from pymysql.connections import Connection


def compute_match_status(score: float, structured_passed: bool, review_required: bool) -> str:
    if score >= 75 and structured_passed and not review_required:
        return "Potential Match"
    if score >= 40 or review_required:
        return "Needs Review"
    return "Not Suitable"


def ensure_limit(limit: int, max_limit: int = 100) -> int:
    return min(max(limit, 1), max_limit)


def normalise_name(value: str) -> str:
    return " ".join(value.lower().strip().split())


def fetch_optional_view(conn: Connection, view_name: str, sql: str) -> dict[str, Any]:
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql)
            return {"view_name": view_name, "exists": True, "rows": cursor.fetchall()}
    except Exception as exc:
        return {"view_name": view_name, "exists": False, "rows": [], "error": str(exc)}


def get_first_lookup_id(cursor, table_name: str, id_column: str) -> int:
    cursor.execute(f"SELECT {id_column} AS id_value FROM {table_name} ORDER BY {id_column} LIMIT 1")
    row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=400, detail=f"No lookup rows found in {table_name}.")

    return row["id_value"]


def simple_keyword_count(text: str) -> int:
    important_terms = [
        "cancer",
        "diabetes",
        "hypertension",
        "pregnant",
        "pregnancy",
        "kidney",
        "liver",
        "heart",
        "severe",
        "history",
        "allergy",
        "chemotherapy",
        "surgery",
        "adult",
        "child",
        "excluded",
    ]
    lowered = text.lower()
    return sum(1 for term in important_terms if term in lowered)
