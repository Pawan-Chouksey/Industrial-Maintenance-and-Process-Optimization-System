from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# ──────────────────────────────────────────────
#  REQUEST bodies  (what the client sends)
# ──────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str       = Field(min_length=3, max_length=30)
    email:    EmailStr
    password: str       = Field(min_length=8)
    mobile:   str       = Field(min_length=7, max_length=15)


class LoginRequest(BaseModel):
    # user can log in with either username OR email
    identifier: str     # username or email
    password:   str


# ──────────────────────────────────────────────
#  RESPONSE bodies  (what the server returns)
# ──────────────────────────────────────────────

class UserResponse(BaseModel):
    id:       str
    username: str
    email:    str
    mobile:   Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserResponse


class MessageResponse(BaseModel):
    message: str
