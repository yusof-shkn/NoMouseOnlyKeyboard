"""app/logger.py — Central Loguru configuration for Sawda Marketplace API.

Usage in any module:
    from app.logger import logger
    logger.info("event_name", user_id=1, action="login")

Environment variables:
    LOG_LEVEL   — TRACE | DEBUG | INFO | WARNING | ERROR | CRITICAL  (default: INFO)
    LOG_FORMAT  — text | json                                          (default: text)
"""

import logging
import sys

from loguru import logger

from app.settings import settings

# ── Pull config from settings (with sensible defaults) ────────────────────────

_LOG_LEVEL: str = getattr(settings, "LOG_LEVEL", "INFO").upper()
_LOG_FORMAT: str = getattr(settings, "LOG_FORMAT", "text").lower()

# ── Text format ────────────────────────────────────────────────────────────────

_TEXT_FORMAT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
    "<level>{level: <8}</level> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> — "
    "<level>{message}</level>"
    "{extra}"
)


def _format_extra(record) -> str:
    """Append structured key=value pairs from `extra` dict to the log line."""
    extra = record["extra"]
    if not extra:
        return ""
    pairs = " | ".join(f"{k}={v}" for k, v in extra.items())
    return f" | {pairs}"


# ── Intercept stdlib logging (uvicorn, SQLAlchemy, etc.) ─────────────────────


class _InterceptHandler(logging.Handler):
    """Bridge stdlib `logging` calls into Loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = sys._getframe(6), 6
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back  # type: ignore[assignment]
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def _setup_logging() -> None:
    """Configure Loguru and intercept stdlib logging."""
    logger.remove()  # remove the default stderr sink

    if _LOG_FORMAT == "json":
        logger.add(
            sys.stdout,
            level=_LOG_LEVEL,
            serialize=True,  # emits JSON lines
            backtrace=True,
            diagnose=False,  # keep diagnose off in prod to avoid leaking values
        )
    else:
        logger.add(
            sys.stdout,
            level=_LOG_LEVEL,
            format=_TEXT_FORMAT,
            colorize=True,
            backtrace=True,
            diagnose=True,
        )

    # Redirect all stdlib loggers (uvicorn, SQLAlchemy, asyncio …) into Loguru
    logging.basicConfig(handlers=[_InterceptHandler()], level=0, force=True)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "sqlalchemy.engine"):
        _log = logging.getLogger(name)
        _log.handlers = [_InterceptHandler()]
        _log.propagate = False


_setup_logging()

__all__ = ["logger"]
