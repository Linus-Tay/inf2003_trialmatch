import os
from pathlib import Path

import pymysql
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
SQL_FILE = ROOT_DIR / "database" / "mariadb" / "init" / "08_performance_cache.sql"
load_dotenv(ROOT_DIR / ".env")


def get_connection():
    return pymysql.connect(
        host=os.getenv("MARIADB_HOST", "127.0.0.1"),
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


def main():
    sql = SQL_FILE.read_text(encoding="utf-8")
    # Simple splitter: this file only uses DELIMITER for the index helper procedure, so run via Adminer if this script fails on DELIMITER.
    # The refresh section can still be pasted/run manually in Adminer.
    print("For reliability, run 08_performance_cache.sql in Adminer/MySQL after imports.")
    print(f"SQL file: {SQL_FILE}")


if __name__ == "__main__":
    main()
