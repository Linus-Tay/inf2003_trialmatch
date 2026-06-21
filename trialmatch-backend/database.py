import pymysql
from pymongo import MongoClient
from pymysql.connections import Connection

from config import (
    MARIADB_DB,
    MARIADB_HOST,
    MARIADB_PASSWORD,
    MARIADB_PORT,
    MARIADB_USER,
    MONGO_DB,
    MONGO_URI,
)


def get_mariadb_connection() -> Connection:
    return pymysql.connect(
        host=MARIADB_HOST,
        port=MARIADB_PORT,
        user=MARIADB_USER,
        password=MARIADB_PASSWORD,
        database=MARIADB_DB,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        connect_timeout=5,
        read_timeout=30,
        write_timeout=30,
    )


def get_mariadb():
    conn = get_mariadb_connection()

    try:
        yield conn
    finally:
        conn.close()


def get_mongo_client() -> MongoClient:
    return MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000,
    )


def get_mongodb():
    client = get_mongo_client()

    try:
        yield client[MONGO_DB]
    finally:
        client.close()
