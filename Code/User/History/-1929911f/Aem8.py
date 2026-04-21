"""app/logger.py — Central Loguru configuration for Sawda Marketplace API.

Usage in any module:
    from app.logger import logger
    logger.info("event_name", user_id=1, action="login")

Environment variables:
    LOG_LEVEL   — TRACE | DEBUG | INFO | WARNING | ERROR | CRITICAL  (default: INFO)
    LOG_FORMAT  — text | json                                          (default: text)
    FORCE_COLOR — set to any non-empty value to force ANSI colors (useful under uvicorn)
    NO_COLOR    — set to any non-empty value to disable colors
"""

import logging
import os
import sys
from contextvars import ContextVar

from loguru import logger

from app.settings import settings

# ── Request-ID context variable ───────────────────────────────────────────────
# Set by the X-Request-ID middleware in main.py; included in every log line
# automatically via the patcher below so all logs for one HTTP request share
# the same ID even across concurrent requests.

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

# ── Pull config from settings (with sensible defaults) ────────────────────────

_LOG_LEVEL: str = getattr(settings, "LOG_LEVEL", "INFO").upper()
_LOG_FORMAT: str = getattr(settings, "LOG_FORMAT", "text").lower()

# ── Colour detection ──────────────────────────────────────────────────────────
# Uvicorn spawns workers without a real TTY, so sys.stderr.isatty() returns
# False even inside kitty.  We honour FORCE_COLOR / NO_COLOR first, then fall
# back to isatty().  Write to stderr because uvicorn doesn't intercept it.


def _should_colorize() -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    if os.environ.get("FORCE_COLOR"):
        return True
    # kitty sets COLORTERM=truecolor; most terminals set TERM to xterm-256color
    if os.environ.get("COLORTERM") in ("truecolor", "24bit"):
        return True
    return sys.stderr.isatty()

_COLORIZE = _should_colorize()

# ── Text format ────────────────────────────────────────────────────────────────

_TEXT_FORMAT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
    "<level>{level: <8}</level> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
    "rid=<yellow>{extra[request_id]}</yellow> — "
    "<level>{message}</level>"
)


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
            colorize=False,
        )
    else:
        # Use stderr — uvicorn does NOT strip ANSI from stderr, only stdout.
        logger.add(
            sys.stderr,
            level=_LOG_LEVEL,
            format=_TEXT_FORMAT,
            colorize=_COLORIZE,  # forced True when kitty's COLORTERM is detected
            backtrace=True,
            diagnose=True,
        )

    # Inject request_id from ContextVar into every log record so correlation
    # works without passing it explicitly to every logger call.
    logger.configure(patcher=lambda record: record["extra"].update(
        request_id=request_id_var.get()
    ))

    # Redirect all stdlib loggers (uvicorn, SQLAlchemy, asyncio …) into Loguru
    logging.basicConfig(handlers=[_InterceptHandler()], level=0, force=True)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "sqlalchemy.engine"):
        _log = logging.getLogger(name)
        _log.handlers = [_InterceptHandler()]
        _log.propagate = False


_setup_logging()

__all__ = ["logger", "request_id_var"]
