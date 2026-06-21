from fastapi import APIRouter, Depends
from pymysql.connections import Connection

from database import get_mariadb
from dependencies import authenticate_user, create_access_token, create_user, get_current_user, user_to_public
from schemas import AuthResponse, LoginRequest, SignupRequest, UserOut

router = APIRouter()

# ============================================================
# AUTH
# ============================================================
@router.post("/auth/signup", response_model=AuthResponse)
def signup(payload: SignupRequest, conn: Connection = Depends(get_mariadb)):
    user = create_user(conn, payload)
    public_user = user_to_public(user)
    token = create_access_token({"sub": str(user["user_id"])})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": public_user,
    }


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, conn: Connection = Depends(get_mariadb)):
    user = authenticate_user(conn, payload.email, payload.password)
    public_user = user_to_public(user)
    token = create_access_token({"sub": str(user["user_id"])})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": public_user,
    }


@router.get("/auth/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    return user_to_public(current_user)
