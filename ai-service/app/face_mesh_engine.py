"""Thread-safe singleton wrappers around MediaPipe's bundled CPU models.

MediaPipe ships its trained models (face detection + 468-point face mesh)
inside the `mediapipe` pip wheel itself - no extra model download or GPU is
required, and the same wheels are published for Windows, Linux and macOS.

MediaPipe's Python solution objects are not safe for concurrent use from
multiple threads at once, so access is serialized with a lock. For a
classroom-scale attendance system this is not a throughput bottleneck.
"""
from __future__ import annotations

import threading
from typing import List, Optional

import cv2
import mediapipe as mp
import numpy as np

from .config import settings

mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh

# 6-point indices used for the Eye Aspect Ratio (EAR), in the order
# (outer corner, upper-outer, upper-inner, inner corner, lower-inner, lower-outer)
LEFT_EYE_EAR_IDX = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_EAR_IDX = [33, 160, 158, 133, 153, 144]

# A broader curated set of landmarks used to build the geometric face
# descriptor (eyebrows, eyes, nose bridge/tip, mouth outline, jaw contour).
GEOMETRY_LANDMARK_IDX = [
    70, 63, 105, 66, 107,  # left eyebrow
    336, 296, 334, 293, 300,  # right eyebrow
    33, 160, 158, 133, 153, 144,  # right eye
    362, 385, 387, 263, 373, 380,  # left eye
    1, 2, 98, 327,  # nose
    61, 291, 0, 17, 405, 181,  # mouth outline
    152, 234, 454,  # chin / jaw edges
]


class _Engine:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=3,
            refine_landmarks=True,
            min_detection_confidence=settings.MIN_DETECTION_CONFIDENCE,
        )
        self._face_detection = mp_face_detection.FaceDetection(
            model_selection=0,
            min_detection_confidence=settings.MIN_DETECTION_CONFIDENCE,
        )

    def detect_faces(self, image_bgr: np.ndarray):
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        with self._lock:
            return self._face_detection.process(rgb)

    def face_mesh(self, image_bgr: np.ndarray):
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        with self._lock:
            return self._face_mesh.process(rgb)


_engine: Optional[_Engine] = None
_engine_lock = threading.Lock()


def get_engine() -> _Engine:
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = _Engine()
    return _engine


def landmarks_to_xy(landmarks, width: int, height: int) -> List[tuple]:
    return [(lm.x * width, lm.y * height) for lm in landmarks.landmark]
