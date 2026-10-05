from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


# ──────────────────────────────────────────────
#  REQUEST bodies  (what the client sends)
# ──────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str                 = Field(min_length=3, max_length=30)
    email:    EmailStr
    password: str                 = Field(min_length=8)
    mobile:   Optional[str]       = None

    @field_validator("mobile", mode="before")
    @classmethod
    def sanitize_mobile(cls, v):
        if not v or not str(v).strip():
            return None
        cleaned = str(v).strip()
        if len(cleaned) < 7 or len(cleaned) > 15:
            raise ValueError("Mobile number must be between 7 and 15 digits.")
        return cleaned


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
