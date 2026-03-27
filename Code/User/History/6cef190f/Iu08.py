"""Colour-coded console logger."""
import sys
import logging

_G = "\033[92m"   # green
_Y = "\033[93m"   # yellow
_R = "\033[91m"   # red
_C = "\033[96m"   # cyan
_B = "\033[1m"    # bold
_X = "\033[0m"    # reset


def _get() -> logging.Logger:
    log = logging.getLogger("pharmasos")
    if not log.handlers:
        h = logging.StreamHandler(sys.stdout)
        h.setFormatter(logging.Formatter("%(message)s"))
        log.addHandler(h)
    log.setLevel(logging.DEBUG)
    return log


_log = _get()


def log_section(title: str) -> None:
    w = 62
    _log.info(f"\n{_B}{_C}{'─' * w}{_X}")
    _log.info(f"{_B}{_C}  {title}{_X}")
    _log.info(f"{_B}{_C}{'─' * w}{_X}")


def log_ok(msg: str)      -> None: _log.info(f"  {_G}✔  {msg}{_X}")
def log_warn(msg: str)    -> None: _log.warning(f"  {_Y}⚠  {msg}{_X}")
def log_error(msg: str)   -> None: _log.error(f"  {_R}✘  {msg}{_X}")
def log_info(msg: str)    -> None: _log.info(f"  {_C}ℹ  {msg}{_X}")
def log_step(n: int, total: int, msg: str) -> None:
    _log.info(f"\n{_B}[{n}/{total}]{_X} {msg}")


def log_row(label: str, actual: int, expected: int) -> None:
    if actual >= expected:
        status = f"{_G}✔  {actual}/{expected}{_X}"
    else:
        status = f"{_R}✘  {actual}/{expected}  ← missing {expected - actual}{_X}"
    _log.info(f"  {label:<34} {status}")