from typing import Any


def set_audit_user(cursor, current_user: dict[str, Any]) -> None:
    """Expose the current FastAPI user to MariaDB triggers.

    MariaDB triggers cannot directly read the JWT/current user,
    so the backend stores the user ID in a session variable before
    running INSERT/UPDATE/ARCHIVE statements.
    """

    user_id = current_user.get("user_id")
    cursor.execute("SET @app_user_id = %s", (user_id,))