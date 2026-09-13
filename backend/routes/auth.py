from fastapi import APIRouter, HTTPException, status
from pymongo.errors import DuplicateKeyError

from database import users_collection
from schemas import RegisterRequest, LoginRequest, TokenResponse, UserResponse, MessageResponse
from auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api", tags=["Authentication"])


# ── REGISTER ───────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(body: RegisterRequest):
    """
    Create a new user account.

    - **username**: 3–30 characters, must be unique
    - **email**: valid email, must be unique
    - **password**: minimum 8 characters (stored as bcrypt hash)
    - **mobile**: optional phone number
    """
    # Build the document to insert into MongoDB
    user_doc = {
        "username": body.username.strip().lower(),
        "email":    body.email.strip().lower(),
        "password": hash_password(body.password),
        "mobile":   body.mobile.strip(),
    }

    try:
        users_collection.insert_one(user_doc)
    except DuplicateKeyError as e:
        # MongoDB unique index will catch duplicate username or email
        error_key = "username" if "username" in str(e) else "email"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with this {error_key} already exists.",
        )

    return {"message": f"Account created successfully for '{body.username}'."}


# ── LOGIN ──────────────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive a JWT token",
)
def login(body: LoginRequest):
    """
    Login with username or email + password.
    Returns a JWT `access_token` to use in protected routes.
    """
    identifier = body.identifier.strip().lower()

    # Find user by username OR email
    user = users_collection.find_one({
        "$or": [
            {"username": identifier},
            {"email":    identifier},
        ]
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No account found with that username or email.",
        )

    if not verify_password(body.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password.",
        )

    # Issue JWT token with user's MongoDB _id as subject
    token = create_access_token(data={"sub": str(user["_id"])})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=str(user["_id"]),
            username=user["username"],
            email=user["email"],
            mobile=user.get("mobile"),
        ),
    )
