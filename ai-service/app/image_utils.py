"""Image decoding/normalization helpers.

All camera frames arrive from the Node.js backend as base64-encoded JPEG/PNG
strings (the browser captures frames via <canvas> and the backend forwards
them unmodified - raw binary frames are never written to disk). We decode
in-memory only, downscale to bound CPU cost, and never persist raw images.
"""
from __future__ import annotations

import base64
import re

import cv2
import numpy as np

from .config import settings

_DATA_URL_RE = re.compile(r"^data:image\/[a-zA-Z0-9.+-]+;base64,")


class InvalidImageError(ValueError):
    pass


def decode_base64_image(data: str) -> np.ndarray:
    """Decodes a base64 (optionally data-URL prefixed) image into a BGR numpy array."""
    if not data or not isinstance(data, str):
        raise InvalidImageError("Image payload is empty or not a string")

    cleaned = _DATA_URL_RE.sub("", data.strip())
    try:
        raw = base64.b64decode(cleaned, validate=False)
    except Exception as exc:  # noqa: BLE001
        raise InvalidImageError("Image payload is not valid base64") from exc

    if len(raw) < 50:
        raise InvalidImageError("Image payload is too small to be a valid image")

    array = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise InvalidImageError("Image payload could not be decoded (unsupported format)")

    return _downscale(image)


def _downscale(image: np.ndarray) -> np.ndarray:
    h, w = image.shape[:2]
    max_dim = settings.MAX_IMAGE_DIMENSION
    scale = min(1.0, max_dim / max(h, w))
    if scale < 1.0:
        image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return image


def brightness_of(image: np.ndarray) -> float:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return float(np.mean(gray))
