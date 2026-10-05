"""Challenge-response liveness detection from a short burst of frames.

Checks performed (see docs/BIOMETRIC_PRIVACY.md and README for the honest
limitations of this approach):
  1. Exactly one face must be present in (most of) the frames.
  2. The face must actually move between frames (rejects a static photo).
  3. A horizontal head-turn matching the server-issued challenge
     ("TURN_LEFT" / "TURN_RIGHT") must be observed, measured via a
     landmark-ratio proxy for yaw.
  4. Face scale (interocular distance) must stay reasonably consistent
     across frames, i.e. the same face is being tracked throughout rather
     than, say, someone swapping a photo mid-sequence.

This reduces simple photo/video-replay spoofing but - like all
browser-camera-based liveness checks - does not guarantee protection against
sophisticated presentation attacks (e.g. high-quality video masks).
"""
from __future__ import annotations

from typing import List

import numpy as np

from .config import settings
from .face_mesh_engine import get_engine, landmarks_to_xy
from .image_utils import InvalidImageError, decode_base64_image
from .schemas import LivenessResponse

LEFT_FACE_EDGE_IDX = 234
RIGHT_FACE_EDGE_IDX = 454
NOSE_TIP_IDX = 1
LEFT_EYE_OUTER_IDX = 263
RIGHT_EYE_OUTER_IDX = 33


def _frame_metrics(points):
    left_edge = np.array(points[LEFT_FACE_EDGE_IDX])
    right_edge = np.array(points[RIGHT_FACE_EDGE_IDX])
    nose = np.array(points[NOSE_TIP_IDX])
    left_eye = np.array(points[LEFT_EYE_OUTER_IDX])
    right_eye = np.array(points[RIGHT_EYE_OUTER_IDX])

    center_x = (left_edge[0] + right_edge[0]) / 2.0
    half_width = abs(right_edge[0] - left_edge[0]) / 2.0 or 1.0
    yaw_ratio = (nose[0] - center_x) / half_width

    scale = float(np.linalg.norm(left_eye - right_eye)) or 1.0
    nose_norm = nose / scale

    return yaw_ratio, scale, nose_norm


def analyze_liveness(frames: List[str], challenge: List[str]) -> LivenessResponse:
    if len(frames) < 3:
        return LivenessResponse(
            live=False,
            headMovementDetected=False,
            movementDirectionObserved="NONE",
            landmarkConsistency=0.0,
            reason="Not enough frames were captured for a liveness check.",
        )

    yaw_values: List[float] = []
    scales: List[float] = []
    nose_positions: List[np.ndarray] = []
    multiple_faces_detected = False
    decode_failures = 0

    engine = get_engine()
    for frame in frames:
        try:
            image = decode_base64_image(frame)
        except InvalidImageError:
            decode_failures += 1
            continue

        h, w = image.shape[:2]
        result = engine.face_mesh(image)
        if not result.multi_face_landmarks:
            continue
        if len(result.multi_face_landmarks) > 1:
            multiple_faces_detected = True
            continue

        points = landmarks_to_xy(result.multi_face_landmarks[0], w, h)
        yaw, scale, nose_norm = _frame_metrics(points)
        yaw_values.append(yaw)
        scales.append(scale)
        nose_positions.append(nose_norm)

    if multiple_faces_detected:
        return LivenessResponse(
            live=False,
            headMovementDetected=False,
            movementDirectionObserved="NONE",
            landmarkConsistency=0.0,
            reason="Only one person should be visible in the camera.",
        )

    total_frames = len(frames)
    valid_fraction = len(yaw_values) / total_frames if total_frames else 0
    if valid_fraction < settings.MIN_VALID_FRAME_FRACTION:
        return LivenessResponse(
            live=False,
            headMovementDetected=False,
            movementDirectionObserved="NONE",
            landmarkConsistency=0.0,
            reason="Face was not consistently visible during the liveness check. Please try again.",
        )

    nose_array = np.array(nose_positions)
    movement_variance = float(np.var(nose_array[:, 0]) + np.var(nose_array[:, 1])) if len(nose_array) > 1 else 0.0
    head_movement_detected = movement_variance >= settings.MIN_FRAME_MOVEMENT_VARIANCE

    if not head_movement_detected:
        return LivenessResponse(
            live=False,
            headMovementDetected=False,
            movementDirectionObserved="NONE",
            landmarkConsistency=0.0,
            reason="No movement detected. Please move your face and blink your eyes - a static photo cannot be used.",
        )

    min_yaw, max_yaw = min(yaw_values), max(yaw_values)
    observed_left = min_yaw <= -settings.MIN_YAW_RATIO_DELTA
    observed_right = max_yaw >= settings.MIN_YAW_RATIO_DELTA

    if max_yaw >= settings.MIN_YAW_RATIO_DELTA and abs(max_yaw) >= abs(min_yaw):
        direction_observed = "RIGHT"
    elif min_yaw <= -settings.MIN_YAW_RATIO_DELTA:
        direction_observed = "LEFT"
    else:
        direction_observed = "NONE"

    required_directions = [c for c in challenge if c in ("TURN_LEFT", "TURN_RIGHT")]
    satisfied = True
    missing = []
    for req in required_directions:
        if req == "TURN_LEFT" and not observed_left:
            satisfied = False
            missing.append("left turn")
        if req == "TURN_RIGHT" and not observed_right:
            satisfied = False
            missing.append("right turn")

    mean_scale = float(np.mean(scales))
    std_scale = float(np.std(scales))
    landmark_consistency = round(max(0.0, 1.0 - (std_scale / mean_scale if mean_scale else 1.0)), 3)

    if not satisfied:
        return LivenessResponse(
            live=False,
            headMovementDetected=head_movement_detected,
            movementDirectionObserved=direction_observed,
            landmarkConsistency=landmark_consistency,
            reason=f"Please complete the requested head movement ({', '.join(missing)}).",
        )

    if landmark_consistency < 0.5:
        return LivenessResponse(
            live=False,
            headMovementDetected=head_movement_detected,
            movementDirectionObserved=direction_observed,
            landmarkConsistency=landmark_consistency,
            reason="Live face verification failed. Please try again.",
        )

    return LivenessResponse(
        live=True,
        headMovementDetected=head_movement_detected,
        movementDirectionObserved=direction_observed,
        landmarkConsistency=landmark_consistency,
        reason=None,
    )
