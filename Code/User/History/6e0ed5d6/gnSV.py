"""app/chat/schemas.py"""

from datetime import datetime

from pydantic import BaseModel, Field

from app.users.schemas import UserPublicOut


class MessageCreate(BaseModel):
    message_text: str | None = Field(default=None, max_length=4000)
    message_type: str = Field(default="text", pattern="^(text|image|file|location)$")
    attachment_url: str | None = None


class MessageOut(BaseModel):
    id: int
    sender: UserPublicOut
    message_text: str | None
    message_type: str
    attachment_url: str | None
    is_deleted: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class ConversationStartRequest(BaseModel):
    post_id: int


class ParticipantOut(BaseModel):
    user: UserPublicOut
    joined_at: datetime
    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: int
    post_id: int | None
    participants: list[ParticipantOut]
    last_message: MessageOut | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ConversationListOut(BaseModel):
    total: int
    items: list[ConversationOut]


# ── WebSocket frames ──────────────────────────────────────────────────────────


class WSMessageIn(BaseModel):
    type: str  # "message" | "typing"
    message_text: str | None = Field(default=None, max_length=4000)
    message_type: str = "text"
    attachment_url: str | None = None


class WSMessageOut(BaseModel):
    type: str
    data: dict
