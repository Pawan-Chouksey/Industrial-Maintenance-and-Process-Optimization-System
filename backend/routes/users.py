from fastapi import APIRouter, Depends

from dependencies import get_current_user
from schemas import UserResponse

router = APIRouter(prefix="/api", tags=["Users"])


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get currently logged-in user's profile",
)
def get_me(current_user: dict = Depends(get_current_user)):
    """
    Protected route — requires a valid JWT in the Authorization header.
    Returns the profile of the currently authenticated user.
    """
    return UserResponse(
        id=str(current_user["_id"]),
        username=current_user["username"],
        email=current_user["email"],
        mobile=current_user.get("mobile"),
    )
