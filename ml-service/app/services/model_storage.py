from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Directory layout
#
#   models/
#     {user_id}/
#       model.joblib     ← Random Forest
#       scaler.joblib    ← StandardScaler
#       meta.json        ← версия, feature_names, метрики
# ─────────────────────────────────────────────────────────────

MODELS_ROOT = Path(os.environ.get("MODELS_DIR", "models"))


# ─────────────────────────────────────────────────────────────
# Path helpers
# ─────────────────────────────────────────────────────────────

def _user_dir(user_id: str) -> Path:
    """Папка конкретного пользователя."""
    return MODELS_ROOT / _sanitize(user_id)


def get_model_path(user_id: str) -> str:
    """Путь до .joblib файла модели."""
    return str(_user_dir(user_id) / "model.joblib")


def get_scaler_path(user_id: str) -> str:
    """Путь до .joblib файла scaler'а."""
    return str(_user_dir(user_id) / "scaler.joblib")


def get_meta_path(user_id: str) -> str:
    """Путь до meta.json."""
    return str(_user_dir(user_id) / "meta.json")


def _sanitize(user_id: str) -> str:
    """
    Убираем всё кроме букв, цифр, дефисов и подчёркиваний.
    Защита от path traversal (../../../etc/passwd).
    """
    return "".join(c for c in user_id if c.isalnum() or c in "-_")


def _ensure_user_dir(user_id: str) -> Path:
    """Создаём папку пользователя если нет."""
    d = _user_dir(user_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


# ─────────────────────────────────────────────────────────────
# Meta operations
# ─────────────────────────────────────────────────────────────

def save_model_meta(user_id: str, meta: Dict[str, Any]) -> None:
    """
    Сохраняем meta.json.

    meta обязательно содержит:
      - version         (str)       "v1", "v2", ...
      - trained_at      (str)       ISO datetime
      - samples         (int)
      - features        (int)
      - feature_names   (list[str]) ← КРИТИЧНО для совпадения train/predict
      - cv_mae          (float|None)
      - oob_r2          (float|None)
    """
    _ensure_user_dir(user_id)
    meta_path = get_meta_path(user_id)

    try:
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
        logger.info(f"[{user_id}] Meta saved → {meta_path} (version={meta.get('version')})")
    except OSError as e:
        logger.error(f"[{user_id}] Failed to save meta: {e}")
        raise


def get_model_meta(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Читаем meta.json.
    Возвращает None если файл не существует.
    """
    meta_path = get_meta_path(user_id)

    if not Path(meta_path).exists():
        return None

    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.error(f"[{user_id}] Failed to read meta: {e}")
        return None


# ─────────────────────────────────────────────────────────────
# Status helpers
# ─────────────────────────────────────────────────────────────

def model_files_exist(user_id: str) -> bool:
    """
    Проверяем что все три файла есть:
    model.joblib + scaler.joblib + meta.json
    """
    return (
        Path(get_model_path(user_id)).exists()
        and Path(get_scaler_path(user_id)).exists()
        and Path(get_meta_path(user_id)).exists()
    )


def delete_user_model(user_id: str) -> bool:
    """
    Удаляем все файлы модели пользователя.
    Полезно при сбросе / тестах.
    """
    import shutil
    d = _user_dir(user_id)
    if d.exists():
        shutil.rmtree(d)
        logger.info(f"[{user_id}] Model deleted")
        return True
    return False


def list_trained_users() -> list[str]:
    """
    Список user_id у которых есть обученная модель.
    Полезно для мониторинга.
    """
    if not MODELS_ROOT.exists():
        return []
    return [
        d.name
        for d in MODELS_ROOT.iterdir()
        if d.is_dir() and (d / "meta.json").exists()
    ]


def get_all_models_summary() -> list[Dict[str, Any]]:
    """
    Краткая сводка по всем пользователям.
    Используется в /health или admin endpoint.
    """
    result = []
    for user_id in list_trained_users():
        meta = get_model_meta(user_id)
        if meta:
            result.append({
                "user_id": user_id,
                "version": meta.get("version"),
                "trained_at": meta.get("trained_at"),
                "samples": meta.get("samples"),
                "cv_mae": meta.get("cv_mae"),
                "oob_r2": meta.get("oob_r2"),
            })
    return result
