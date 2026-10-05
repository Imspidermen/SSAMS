"""Centralized, environment-driven configuration for the AI service.

Uses pathlib / pydantic-settings so no path or setting is hard-coded, and the
service behaves identically on Windows and Linux.
"""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "info"

    # Face detection / quality
    MIN_DETECTION_CONFIDENCE: float = 0.5
    MIN_BRIGHTNESS: float = 40.0
    MAX_BRIGHTNESS: float = 230.0

    # Face matching
    DEFAULT_FACE_MATCH_THRESHOLD: float = 0.80

    # Liveness / blink
    EAR_CLOSED_THRESHOLD: float = 0.21
    EAR_OPEN_THRESHOLD: float = 0.27
    # Head-turn is measured as a unit-less ratio (nose offset from the
    # midline, normalized by half the face width) rather than a true 3D
    # angle, since it only needs to be monotonic with yaw - not metrically
    # accurate - to serve as a challenge-response liveness signal.
    MIN_YAW_RATIO_DELTA: float = 0.16
    MIN_FRAME_MOVEMENT_VARIANCE: float = 0.0004
    MIN_VALID_FRAME_FRACTION: float = 0.5

    MAX_IMAGE_DIMENSION: int = 640  # frames are downscaled before processing


settings = Settings()
