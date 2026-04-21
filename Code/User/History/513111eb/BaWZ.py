"""app/lifespan.py"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db.engine import engine
from app.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("startup", version=app.version, title=app.title)
    yield
    logger.info("shutdown", detail="disposing db connection pool")
    await engine.dispose()
    logger.info("shutdown_complete")
