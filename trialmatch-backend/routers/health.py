from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from pymysql.connections import Connection

from database import get_mariadb, get_mongodb

router = APIRouter()

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
