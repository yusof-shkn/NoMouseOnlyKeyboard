"""alembic/env.py"""

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Ads
from app.ads.models import AdCampaign, AdClick, AdImpression, AdPlacement  # noqa: F401

# Auth
from app.auth.models import RefreshToken, TokenBlacklist, VerificationToken  # noqa: F401

# Categories
from app.categories.models import Category  # noqa: F401

# Chat
from app.chat.models import Conversation, ConversationParticipant, Message  # noqa: F401

# ── import Base and ALL models so autogenerate sees every table ───────────────
from app.db.base import Base  # noqa: F401

# Social
from app.follows.models import UserFollow  # noqa: F401

# Listings
from app.listings.models import Listing  # noqa: F401

# Notifications
from app.notifications.models import Notification, NotificationPreference  # noqa: F401

# Posts
from app.posts.models import Favorite, Post, PostColor, PostImage, PostTag, PostView  # noqa: F401

# Privacy
from app.privacy.models import PrivacySettings  # noqa: F401
from app.ratings.models import UserRating  # noqa: F401

# Search / System
from app.search.models import SearchQuery  # noqa: F401
from app.system.models import AuditLog, SystemSetting  # noqa: F401

# Users
from app.users.models import BusinessDetails, User  # noqa: F401

# ── Alembic config ────────────────────────────────────────────────────────────
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    from app.settings import settings

    return settings.DATABASE_URL


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_async_engine(get_url())
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
