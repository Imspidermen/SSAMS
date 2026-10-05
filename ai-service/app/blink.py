"""Eye-blink detection using the Eye Aspect Ratio (EAR) across a frame burst.

A blink is only accepted if the EAR sequence shows a genuine
OPEN -> CLOSED -> OPEN transition (not merely "an eye was closed in one
frame", which could happen from a blurry frame or a static half-closed-eye
photo).
"""
from __future__ import annotations

import math
from typing import List

import numpy as np

from .config import settings
from .face_mesh_engine import LEFT_EYE_EAR_IDX, RIGHT_EYE_EAR_IDX, get_engine, landmarks_to_xy
from .image_utils import InvalidImageError, decode_base64_image
from .schemas import BlinkResponse


def _dist(a, b) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _eye_aspect_ratio(points, idx) -> float:
    p1, p2, p3, p4, p5, p6 = [points[i] for i in idx]
    vertical = _dist(p2, p6) + _dist(p3, p5)
    horizontal = _dist(p1, p4) * 2.0
    if horizontal == 0:
        return 0.0
    return vertical / horizontal


def analyze_blink(frames: List[str]) -> BlinkResponse:
    if len(frames) < 3:
        return BlinkResponse(
            blinkDetected=False,
            minEar=0.0,
            maxEar=0.0,
            reason="Not enough frames were captured to detect a blink.",
        )

    ear_values: List[float] = []
    engine = get_engine()

    for frame in frames:
        try:
            image = decode_base64_image(frame)
        except InvalidImageError:
            continue

        h, w = image.shape[:2]
        result = engine.face_mesh(image)
        if not result.multi_face_landmarks or len(result.multi_face_landmarks) != 1:
            continue

        points = landmarks_to_xy(result.multi_face_landmarks[0], w, h)
        left_ear = _eye_aspect_ratio(points, LEFT_EYE_EAR_IDX)
        right_ear = _eye_aspect_ratio(points, RIGHT_EYE_EAR_IDX)
        ear_values.append((left_ear + right_ear) / 2.0)

    if len(ear_values) < 3:
        return BlinkResponse(
            blinkDetected=False,
            minEar=0.0,
            maxEar=0.0,
            reason="Face was not consistently visible. Please look at the camera and blink naturally.",
        )

    min_ear = min(ear_values)
    max_ear = max(ear_values)

    # Look for OPEN (>= open threshold) -> CLOSED (<= closed threshold) -> OPEN again, in order.
    state = "SEEKING_OPEN"
    saw_open_before = False
    saw_closed = False
    blink_detected = False

    for ear in ear_values:
        if state == "SEEKING_OPEN" and ear >= settings.EAR_OPEN_THRESHOLD:
            saw_open_before = True
            state = "SEEKING_CLOSED"
        elif state == "SEEKING_CLOSED" and ear <= settings.EAR_CLOSED_THRESHOLD:
            saw_closed = True
            state = "SEEKING_REOPEN"
        elif state == "SEEKING_REOPEN" and ear >= settings.EAR_OPEN_THRESHOLD:
            if saw_open_before and saw_closed:
                blink_detected = True
            break

    if not blink_detected:
        return BlinkResponse(
            blinkDetected=False,
            minEar=round(min_ear, 4),
            maxEar=round(max_ear, 4),
            reason="Please blink your eyes naturally while looking at the camera.",
        )

    return BlinkResponse(blinkDetected=True, minEar=round(min_ear, 4), maxEar=round(max_ear, 4), reason=None)
