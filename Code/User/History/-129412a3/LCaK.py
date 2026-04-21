"""app/chat/router.py

POST  /chat/conversations                       – start / get conversation
GET   /chat/conversations                       – list my conversations
GET   /chat/conversations/{id}
GET   /chat/conversations/{id}/messages
POST  /chat/conversations/{id}/messages         – REST fallback send
DELETE /chat/conversations/{id}/messages/{msg_id}

WS    /chat/ws/{conversation_id}?token=<jwt>
"""

import asyncio
import time

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt_utils import decode_access_token
from app.chat.manager import manager
from app.chat.schemas import (
    ConversationListOut,
    ConversationOut,
    ConversationStartRequest,
    MessageCreate,
    MessageOut,
    ParticipantOut,
)
from app.chat.service import (
    batch_last_messages,
    create_message,
    get_conversation,
    get_messages,
    get_or_create_conversation,
    is_participant,
    last_message,
    list_conversations_for_user,
    soft_delete_message,
)
from app.db.engine import async_session_factory
from app.db.utils import Pagination
from app.dependencies import get_current_user, get_db
from app.logger import logger
from app.notifications.service import notify
from app.posts.service import get_post_by_id
from app.users.models import User
from app.users.service import get_user_by_id


async def _notify_bg(
    user_id: int,
    notif_type: str,
    title: str,
    message: str | None = None,
    related_user_id: int | None = None,
    related_post_id: int | None = None,
    action_url: str | None = None,
) -> None:
    """Fire-and-forget notification that opens its own DB session."""
    try:
        async with async_session_factory() as db:
            await notify(
                db,
                user_id=user_id,
                notif_type=notif_type,
                title=title,
                message=message,
                related_user_id=related_user_id,
                related_post_id=related_post_id,
                action_url=action_url,
            )
    except Exception as exc:
        logger.warning("notify_bg_failed", user_id=user_id, notif_type=notif_type, error=str(exc))


router = APIRouter(prefix="/chat", tags=["chat"])


# ── helpers ───────────────────────────────────────────────────────────────────


def _build_conv_out(conv, last_msg) -> ConversationOut:
    participants = [ParticipantOut(user=p.user, joined_at=p.joined_at) for p in conv.participants]
    last_msg_out = MessageOut.model_validate(last_msg) if last_msg else None
    return ConversationOut(
        id=conv.id,
        post_id=conv.post_id,
        participants=participants,
        last_message=last_msg_out,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


async def _ensure_participant(conv, user_id: int):
    if not is_participant(conv, user_id):
        logger.warning("chat_access_forbidden", conversation_id=conv.id, user_id=user_id)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant")


# ── conversations ─────────────────────────────────────────────────────────────


@router.post("/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def start_conversation(
    body: ConversationStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await get_post_by_id(db, body.post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot message yourself"
        )

    conv, is_new = await get_or_create_conversation(
        db, initiator_id=current_user.id, other_id=post.user_id, post_id=body.post_id
    )

    if is_new:
        asyncio.create_task(
            _notify_bg(
                user_id=post.user_id,
                notif_type="conversation_started",
                title="New conversation",
                message=f"Someone is interested in your post: {post.title}",
                related_user_id=current_user.id,
                related_post_id=post.id,
                action_url=f"/chat/{conv.id}",
            )
        )

    lm = await last_message(db, conv.id)
    return _build_conv_out(conv, lm)


@router.get("/conversations", response_model=ConversationListOut)
async def list_conversations(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pagination = Pagination.from_params(skip, limit)
    convs, total = await list_conversations_for_user(db, current_user.id, pagination)

    conv_ids = [c.id for c in convs]
    last_msgs = await batch_last_messages(db, conv_ids)

    items = [_build_conv_out(conv, last_msgs[conv.id]) for conv in convs]
    return ConversationListOut(total=total, items=items)


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
async def get_conversation_endpoint(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await get_conversation(db, conversation_id)
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    await _ensure_participant(conv, current_user.id)
    lm = await last_message(db, conv.id)
    return _build_conv_out(conv, lm)


# ── messages ──────────────────────────────────────────────────────────────────


@router.get("/conversations/{conversation_id}/messages")
async def get_messages_endpoint(
    conversation_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await get_conversation(db, conversation_id)
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    await _ensure_participant(conv, current_user.id)
    pagination = Pagination.from_params(skip, limit)
    msgs, total = await get_messages(db, conversation_id, pagination)
    items = [MessageOut.model_validate(m) for m in msgs]
    return {"total": total, "items": items}


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_message_rest(
    conversation_id: int,
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await get_conversation(db, conversation_id)
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    await _ensure_participant(conv, current_user.id)

    msg = await create_message(
        db,
        conversation_id,
        current_user.id,
        body.message_text,
        body.message_type,
        body.attachment_url,
    )
    msg_out = MessageOut.model_validate(msg)

    other_ids = [p.user_id for p in conv.participants if p.user_id != current_user.id]
    for uid in other_ids:
        await manager.send_to_user(
            uid, {"type": "message", "data": msg_out.model_dump(mode="json")}
        )
        asyncio.create_task(
            _notify_bg(
                user_id=uid,
                notif_type="new_message",
                title="New message",
                message=msg.message_text[:120] if msg.message_text else None,
                related_user_id=current_user.id,
                action_url=f"/chat/{conversation_id}",
            )
        )

    return msg_out


@router.delete(
    "/conversations/{conversation_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_message_endpoint(
    conversation_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await get_conversation(db, conversation_id)
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    await _ensure_participant(conv, current_user.id)
    await soft_delete_message(db, message_id, current_user.id)


# ── WebSocket ─────────────────────────────────────────────────────────────────


@router.websocket("/ws/{conversation_id}")
async def websocket_chat(
    websocket: WebSocket,
    conversation_id: int,
    token: str = Query(...),
):
    # Authenticate
    try:
        payload = decode_access_token(token)
    except Exception as exc:
        logger.warning("ws_auth_failed", conversation_id=conversation_id, error=str(exc))
        await websocket.close(code=1008)
        return

    user_id = int(payload["sub"])

    async with async_session_factory() as db:
        conv = await get_conversation(db, conversation_id)
        if conv is None or not is_participant(conv, user_id):
            logger.warning("ws_not_participant", conversation_id=conversation_id, user_id=user_id)
            await websocket.close(code=1008)
            return
        user = await get_user_by_id(db, user_id)
        if user is None or not user.is_active:
            logger.warning("ws_inactive_user", user_id=user_id)
            await websocket.close(code=1008)
            return
        other_participant_ids: list[int] = [
            p.user_id for p in conv.participants if p.user_id != user_id
        ]

    await manager.connect(user_id, websocket)
    logger.info("ws_connected", user_id=user_id, conversation_id=conversation_id)

    _ACTIVE_CHECK_INTERVAL = 60.0
    last_active_check = time.monotonic()

    try:
        while True:
            now = time.monotonic()
            if now - last_active_check >= _ACTIVE_CHECK_INTERVAL:
                async with async_session_factory() as db:
                    from app.users.service import get_user_by_id

                    live_user = await get_user_by_id(db, user_id)
                if live_user is None or not live_user.is_active:
                    logger.info("ws_user_deactivated_mid_session", user_id=user_id)
                    await websocket.close(code=1008)
                    break
                last_active_check = now

            try:
                data = await websocket.receive_json()
            except WebSocketDisconnect:
                raise
            except Exception:
                try:
                    await websocket.send_json({"type": "error", "data": {"detail": "Invalid JSON"}})
                except Exception:
                    break
                continue

            msg_type = data.get("type")
            logger.debug("ws_message_received", user_id=user_id, msg_type=msg_type)

            if msg_type == "message":
                content = (data.get("message_text") or "").strip()
                if not content and not data.get("attachment_url"):
                    continue
                if len(content) > 4000:
                    logger.warning("ws_message_too_long", user_id=user_id, length=len(content))
                    await websocket.send_json(
                        {"type": "error", "data": {"detail": "Message too long"}}
                    )
                    continue

                async with async_session_factory() as db:
                    conv_check = await get_conversation(db, conversation_id)
                    if conv_check is None or not is_participant(conv_check, user_id):
                        logger.warning(
                            "ws_participant_removed",
                            user_id=user_id,
                            conversation_id=conversation_id,
                        )
                        await websocket.close(code=1008)
                        break
                    msg = await create_message(
                        db,
                        conversation_id,
                        user_id,
                        content or None,
                        data.get("message_type", "text"),
                        data.get("attachment_url"),
                    )
                msg_out = MessageOut.model_validate(msg)
                payload_out = {"type": "message", "data": msg_out.model_dump(mode="json")}

                await websocket.send_json(payload_out)

                for uid in other_participant_ids:
                    try:
                        await manager.send_to_user(uid, payload_out)
                    except Exception as exc:
                        logger.warning("ws_send_to_user_failed", target_user_id=uid, error=str(exc))
                    asyncio.create_task(
                        _notify_bg(
                            user_id=uid,
                            notif_type="new_message",
                            title="New message",
                            message=msg.message_text[:120] if msg.message_text else None,
                            related_user_id=user_id,
                            action_url=f"/chat/{conversation_id}",
                        )
                    )

            elif msg_type == "typing":
                for uid in other_participant_ids:
                    try:
                        await manager.send_to_user(
                            uid,
                            {
                                "type": "typing",
                                "data": {"user_id": user_id, "conversation_id": conversation_id},
                            },
                        )
                    except Exception as exc:
                        logger.warning("ws_send_to_user_failed", target_user_id=uid, error=str(exc))

            else:
                logger.warning("ws_unknown_message_type", user_id=user_id, msg_type=msg_type)

    except WebSocketDisconnect:
        logger.info("ws_disconnected", user_id=user_id, conversation_id=conversation_id)
        await manager.disconnect(user_id, websocket)
    except Exception as exc:
        logger.exception(
            "ws_unexpected_error", user_id=user_id, conversation_id=conversation_id, error=str(exc)
        )
        await manager.disconnect(user_id, websocket)
