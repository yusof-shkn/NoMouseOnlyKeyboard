"""app/chat/service.py"""

import hashlib
import struct

from fastapi import HTTPException, status
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.chat.models import Conversation, ConversationParticipant, Message
from app.db.utils import Pagination
from app.logger import logger
from app.posts.service import _use_pg_syntax

_MAX_MESSAGE_LEN = 4000


def _conv_lock_key(uid1: int, uid2: int, post_id: int | None) -> int:
    """Deterministic 64-bit lock key for a (user_pair, post) triple."""
    raw = f"{min(uid1, uid2)}:{max(uid1, uid2)}:{post_id or 0}".encode()
    return struct.unpack(">q", hashlib.sha256(raw).digest()[:8])[0]


# ── load helpers ──────────────────────────────────────────────────────────────


def _conv_options():
    return [
        selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
        selectinload(Conversation.post),
    ]


def _msg_options():
    return [selectinload(Message.sender)]


# ── conversations ─────────────────────────────────────────────────────────────


async def get_or_create_conversation(
    db: AsyncSession, initiator_id: int, other_id: int, post_id: int | None
) -> tuple["Conversation", bool]:
    """Return (conversation, is_new). Prevents duplicates via participant lookup."""
    if _use_pg_syntax(db):
        lock_key = _conv_lock_key(initiator_id, other_id, post_id)
        await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})

    sub = select(ConversationParticipant.conversation_id).where(
        ConversationParticipant.user_id == initiator_id
    )
    sub2 = select(ConversationParticipant.conversation_id).where(
        ConversationParticipant.user_id == other_id
    )
    q = (
        select(Conversation)
        .options(*_conv_options())
        .where(
            Conversation.id.in_(sub),
            Conversation.id.in_(sub2),
            Conversation.post_id == post_id,
        )
    )
    result = await db.execute(q)
    conv = result.scalar_one_or_none()
    if conv:
        logger.debug("conversation_reused", conversation_id=conv.id, post_id=post_id)
        return conv, False

    conv = Conversation(post_id=post_id)
    db.add(conv)
    await db.flush()

    db.add(ConversationParticipant(conversation_id=conv.id, user_id=initiator_id))
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=other_id))
    await db.commit()
    await db.refresh(conv)

    result = await db.execute(
        select(Conversation).options(*_conv_options()).where(Conversation.id == conv.id)
    )
    conv = result.scalar_one()
    logger.info(
        "conversation_created",
        conversation_id=conv.id,
        initiator_id=initiator_id,
        other_id=other_id,
        post_id=post_id,
    )
    return conv, True


async def get_conversation(db: AsyncSession, conversation_id: int) -> Conversation | None:
    result = await db.execute(
        select(Conversation).options(*_conv_options()).where(Conversation.id == conversation_id)
    )
    return result.scalar_one_or_none()


async def list_conversations_for_user(
    db: AsyncSession, user_id: int, pagination: Pagination
) -> tuple[list[Conversation], int]:
    participant_conv_ids = select(ConversationParticipant.conversation_id).where(
        ConversationParticipant.user_id == user_id
    )

    total = (
        await db.execute(
            select(func.count())
            .select_from(Conversation)
            .where(Conversation.id.in_(participant_conv_ids))
        )
    ).scalar()

    result = await db.execute(
        select(Conversation)
        .options(*_conv_options())
        .where(Conversation.id.in_(participant_conv_ids))
        .order_by(Conversation.updated_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    conversations = list(result.scalars().all())
    logger.debug("conversations_listed", user_id=user_id, total=total)
    return conversations, total


def is_participant(conv: Conversation, user_id: int) -> bool:
    return any(p.user_id == user_id for p in conv.participants)


# ── messages ──────────────────────────────────────────────────────────────────


async def create_message(
    db: AsyncSession,
    conversation_id: int,
    sender_id: int,
    message_text: str | None,
    message_type: str = "text",
    attachment_url: str | None = None,
) -> Message:
    if not message_text and not attachment_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message must have text or attachment",
        )
    if message_text and len(message_text) > _MAX_MESSAGE_LEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Message text exceeds {_MAX_MESSAGE_LEN} characters",
        )

    msg = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        message_text=message_text,
        message_type=message_type,
        attachment_url=attachment_url,
    )
    db.add(msg)

    await db.execute(
        update(Conversation).where(Conversation.id == conversation_id).values(updated_at=func.now())
    )
    await db.commit()
    await db.refresh(msg)

    result = await db.execute(select(Message).options(*_msg_options()).where(Message.id == msg.id))
    msg = result.scalar_one()
    logger.info(
        "message_created",
        message_id=msg.id,
        conversation_id=conversation_id,
        sender_id=sender_id,
        message_type=message_type,
        has_attachment=attachment_url is not None,
    )
    return msg


async def get_messages(
    db: AsyncSession,
    conversation_id: int,
    pagination: Pagination,
) -> tuple[list[Message], int]:
    filters = [
        Message.conversation_id == conversation_id,
        Message.is_deleted.is_(False),
    ]

    total = (await db.execute(select(func.count()).select_from(Message).where(*filters))).scalar()

    result = await db.execute(
        select(Message)
        .options(*_msg_options())
        .where(*filters)
        .order_by(Message.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    messages = list(result.scalars().all())
    logger.debug("messages_listed", conversation_id=conversation_id, total=total)
    return messages, total


async def soft_delete_message(db: AsyncSession, message_id: int, user_id: int) -> None:
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if msg is None:
        logger.warning("message_not_found", message_id=message_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if msg.sender_id != user_id:
        logger.warning("message_delete_forbidden", message_id=message_id, user_id=user_id)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your message")
    msg.is_deleted = True
    await db.commit()
    logger.info("message_soft_deleted", message_id=message_id, user_id=user_id)


async def last_message(db: AsyncSession, conversation_id: int) -> Message | None:
    result = await db.execute(
        select(Message)
        .options(*_msg_options())
        .where(
            Message.conversation_id == conversation_id,
            Message.is_deleted.is_(False),
        )
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def batch_last_messages(
    db: AsyncSession, conversation_ids: list[int]
) -> dict[int, Message | None]:
    """Return {conversation_id: last_message} in a single query."""
    if not conversation_ids:
        return {}

    if _use_pg_syntax(db):
        from sqlalchemy import text

        raw = await db.execute(
            text(
                "SELECT DISTINCT ON (m.conversation_id) m.id "
                "FROM messages m "
                "WHERE m.conversation_id = ANY(:cids) AND m.is_deleted = false "
                "ORDER BY m.conversation_id, m.created_at DESC"
            ),
            {"cids": conversation_ids},
        )
        ids = [row[0] for row in raw.all()]
        if not ids:
            return {cid: None for cid in conversation_ids}

        result = await db.execute(
            select(Message).options(*_msg_options()).where(Message.id.in_(ids))
        )
        msgs_by_conv: dict[int, Message] = {m.conversation_id: m for m in result.scalars().all()}
    else:
        from sqlalchemy import func as sa_func

        sub = (
            select(sa_func.max(Message.id).label("max_id"))
            .where(
                Message.conversation_id.in_(conversation_ids),
                Message.is_deleted.is_(False),
            )
            .group_by(Message.conversation_id)
            .subquery()
        )
        result = await db.execute(
            select(Message).options(*_msg_options()).where(Message.id.in_(select(sub.c.max_id)))
        )
        msgs_by_conv = {m.conversation_id: m for m in result.scalars().all()}

    return {cid: msgs_by_conv.get(cid) for cid in conversation_ids}
