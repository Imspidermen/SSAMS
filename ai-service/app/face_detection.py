"""Face presence/quality detection using MediaPipe's bundled face detector."""
from __future__ import annotations

from typing import List

import numpy as np

from .config import settings
from .face_mesh_engine import get_engine
from .image_utils import brightness_of
from .schemas import DetectFaceResponse, FaceBox, Quality


def detect_faces(image_bgr: np.ndarray) -> DetectFaceResponse:
    h, w = image_bgr.shape[:2]
    result = get_engine().detect_faces(image_bgr)

    boxes: List[FaceBox] = []
    if result.detections:
        for det in result.detections:
            bbox = det.location_data.relative_bounding_box
            x = max(0, int(bbox.xmin * w))
            y = max(0, int(bbox.ymin * h))
            box_w = max(1, int(bbox.width * w))
            box_h = max(1, int(bbox.height * h))
            confidence = float(det.score[0]) if det.score else 0.0
            boxes.append(FaceBox(x=x, y=y, width=box_w, height=box_h, confidence=confidence))

    brightness = brightness_of(image_bgr)
    face_count = len(boxes)

    quality: Quality
    if face_count == 0:
        quality = "no_face"
    elif face_count > 1:
        quality = "multiple_faces"
    elif brightness < settings.MIN_BRIGHTNESS:
        quality = "too_dark"
    elif brightness > settings.MAX_BRIGHTNESS:
        quality = "too_bright"
    else:
        quality = "ok"

    return DetectFaceResponse(faceCount=face_count, faces=boxes, brightness=brightness, quality=quality)
