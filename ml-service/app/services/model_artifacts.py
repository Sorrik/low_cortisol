from __future__ import annotations

import os
import tempfile
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

import joblib

_LOCKS_GUARD = threading.Lock()
_USER_LOCKS: dict[str, threading.Lock] = {}


def _sanitize(user_id: str) -> str:
    return "".join(c for c in user_id if c.isalnum() or c in "-_")


def _user_lock(user_id: str) -> threading.Lock:
    safe_user_id = _sanitize(user_id)
    with _LOCKS_GUARD:
        lock = _USER_LOCKS.get(safe_user_id)
        if lock is None:
            lock = threading.Lock()
            _USER_LOCKS[safe_user_id] = lock
        return lock


@contextmanager
def user_model_lock(user_id: str) -> Iterator[None]:
    lock = _user_lock(user_id)
    lock.acquire()
    try:
        yield
    finally:
        lock.release()


def atomic_joblib_dump(artifact: Any, target_path: str) -> None:
    target = Path(target_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp_fd, tmp_path = tempfile.mkstemp(
        dir=str(target.parent),
        prefix=target.name + ".",
        suffix=".tmp",
    )
    os.close(tmp_fd)
    try:
        joblib.dump(artifact, tmp_path)
        os.replace(tmp_path, target_path)
    except OSError:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        raise
