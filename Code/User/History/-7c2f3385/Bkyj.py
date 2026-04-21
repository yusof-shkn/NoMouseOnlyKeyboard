"""tests/conftest.py — pytest fixtures for the Sawda test suite.

Uses an in-memory SQLite database (via aiosqlite + StaticPool) so no running
PostgreSQL is required to run the tests.  The SQLAlchemy models are database-
agnostic (no JSONB / ARRAY / PG-specific columns), so SQLite works correctly.

Pure HTTP helpers (register_user, auth_headers, unique) live in tests/helpers.py
and carry no ORM dependency.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import BigInteger, text
from sqlalchemy.ext.compiler import compiles

from app.main import app


# SQLite only auto-increments bare INTEGER PKs, not BIGINT.
# This compile hook makes BigInteger → INTEGER for SQLite so all PKs work.
@compiles(BigInteger, "sqlite")
def _bigint_to_int(element, compiler, **kw):
    return "INTEGER"


from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.dependencies import get_db
from app.limiter import limiter as _limiter

# ---------------------------------------------------------------------------
# Shared in-memory database (StaticPool keeps one connection for the whole
# session so every async_sessionmaker call sees the same data).
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


# ---------------------------------------------------------------------------
# Per-test HTTP client with get_db overridden to use the test engine.
# Rate limiting is disabled so tests don't hit 429 after 10 requests.
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def client(engine):
    TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    _limiter.enabled = False
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    finally:
        _limiter.enabled = True
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Staff user fixture — registers a user then sets is_staff=True directly in
# the test DB (bypassing the API which has no staff-promotion endpoint).
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def staff_headers(client, engine):
    from tests.helpers import register_user

    data = await register_user(client)
    async with async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)() as session:
        await session.execute(
            text("UPDATE users SET is_staff = 1 WHERE username = :u"),
            {"u": data["username"]},
        )
        await session.commit()
    return {"Authorization": f"Bearer {data['access_token']}"}
