import base64
import os
import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _b64_of(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


@pytest.fixture(scope="session")
def face_image_a_b64() -> str:
    return _b64_of(FIXTURES_DIR / "sample_face_a.jpg")


@pytest.fixture(scope="session")
def face_image_b_b64() -> str:
    return _b64_of(FIXTURES_DIR / "sample_face_b.jpg")


@pytest.fixture(scope="session")
def face_image_a_bgr() -> np.ndarray:
    return cv2.imread(str(FIXTURES_DIR / "sample_face_a.jpg"))


@pytest.fixture(scope="session")
def face_image_b_bgr() -> np.ndarray:
    return cv2.imread(str(FIXTURES_DIR / "sample_face_b.jpg"))


@pytest.fixture
def blank_image_b64() -> str:
    img = np.full((200, 200, 3), 100, dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", img)
    return base64.b64encode(buf.tobytes()).decode()


@pytest.fixture
def two_faces_image_b64(face_image_a_bgr, face_image_b_bgr) -> str:
    """Builds a single image containing two distinct faces side by side."""
    h = 300
    a = cv2.resize(face_image_a_bgr, (int(face_image_a_bgr.shape[1] * h / face_image_a_bgr.shape[0]), h))
    b = cv2.resize(face_image_b_bgr, (int(face_image_b_bgr.shape[1] * h / face_image_b_bgr.shape[0]), h))
    combined = np.hstack([a, b])
    ok, buf = cv2.imencode(".jpg", combined)
    return base64.b64encode(buf.tobytes()).decode()
