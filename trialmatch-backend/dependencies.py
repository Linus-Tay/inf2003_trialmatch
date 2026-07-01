from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pymysql.connections import Connection

from config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET_KEY
from database import get_mariadb
from schemas import SignupRequest

bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False

    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(data: dict[str, Any]) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {**data, "exp": expires_at}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_patient_role_id(conn: Connection) -> int:
    with conn.cursor() as cursor:
        cursor.execute("SELECT role_id FROM user_roles WHERE role_name = %s", ("Patient",))
        role = cursor.fetchone()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Patient role is missing. Run 02_seed_lookup_tables.sql first.",
        )

    return int(role["role_id"])


def user_to_public(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "user_id": row["user_id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "role_name": row["role_name"],
    }


def create_user(conn: Connection, payload: SignupRequest) -> dict[str, Any]:
    email = payload.email.lower().strip()

    with conn.cursor() as cursor:
        cursor.execute("SELECT user_id FROM app_users WHERE email = %s", (email,))
        existing_user = cursor.fetchone()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already registered.",
            )

        role_id = get_patient_role_id(conn)

        cursor.execute(
            """
            INSERT INTO app_users (role_id, full_name, email, password_hash)
            VALUES (%s, %s, %s, %s)
            """,
            (role_id, payload.full_name.strip(), email, hash_password(payload.password)),
        )

        user_id = cursor.lastrowid

        cursor.execute(
            """
            SELECT u.user_id, u.full_name, u.email, r.role_name
            FROM app_users u
            JOIN user_roles r ON u.role_id = r.role_id
            WHERE u.user_id = %s
            """,
            (user_id,),
        )
        created_user = cursor.fetchone()

    conn.commit()
    return created_user


def authenticate_user(conn: Connection, email: str, password: str) -> dict[str, Any]:
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT u.user_id, u.full_name, u.email, u.password_hash, u.is_active, r.role_name
            FROM app_users u
            JOIN user_roles r ON u.role_id = r.role_id
            WHERE u.email = %s
            """,
            (email.lower().strip(),),
        )
        user = cursor.fetchone()

    if not user or not verify_password(password, user.get("password_hash")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    if not user["is_active"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is inactive.")

    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    conn: Connection = Depends(get_mariadb),
) -> dict[str, Any]:
    token = credentials.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token.")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT u.user_id, u.full_name, u.email, r.role_name
            FROM app_users u
            JOIN user_roles r ON u.role_id = r.role_id
            WHERE u.user_id = %s AND u.is_active = TRUE
            """,
            (user_id,),
        )
        user = cursor.fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    return user

def require_admin(current_user: dict = Depends(get_current_user)) -> dict[str, Any]:
    role_name = str(current_user.get("role_name", "")).lower()

    if role_name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )

    return current_user