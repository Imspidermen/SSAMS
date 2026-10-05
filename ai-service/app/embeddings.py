"""Face embedding extraction and comparison.

IMPORTANT / HONEST LIMITATION
------------------------------
Production-grade face recognition normally uses a pretrained deep embedding
model (e.g. ArcFace / OpenCV's "SFace"). Downloading such a pretrained model
was not possible in the environment this project was built in (outbound
access to the usual model-hosting services was unavailable). To keep the
system fully functional end-to-end without any external download, this
module instead builds a descriptor from classical, dependency-free computer
vision techniques that ship inside the already-installed `mediapipe` and
`opencv-contrib` packages:

  1. Face alignment - the face is rotated/scaled/cropped to a canonical pose
     using the eye landmarks (the same technique classic face-recognition
     pipelines like Eigenfaces/Fisherfaces/LBPH use), so the rest of the
     descriptor is not confused by head tilt or camera framing.
  2. Texture features - a grid-based uniform Local Binary Pattern (LBP)
     histogram (Ahonen et al. 2006 - the same algorithm behind OpenCV's
     `cv2.face.LBPHFaceRecognizer`) computed over the aligned face, which
     captures the fine-grained skin/feature texture that differs between
     individuals.
  3. Geometric features - normalized positions of ~33 stable facial
     landmarks (eyebrows, eyes, nose, mouth, jaw), which add face-shape
     information (e.g. relative jaw width, nose width) not captured by
     texture alone.

The two feature groups are concatenated and L2-normalized; identity
comparison uses cosine similarity against a configurable threshold, exactly
like a deep-embedding pipeline. This is a legitimate, fully functional,
offline face-verification approach, but it is measurably less accurate than
a modern deep embedding model (ArcFace/SFace typically exceed 99% accuracy
on standard benchmarks; this classical descriptor does not). It is adequate
for a classroom-scale deployment where the student's claimed identity, an
active class roster, geofence and liveness/blink checks already constrain
who could plausibly be attempting to mark attendance - face matching here is
one additional layer, not the sole safeguard.

Empirical note: the default match threshold (`DEFAULT_FACE_MATCH_THRESHOLD`,
see `app/config.py`) was chosen from a small manual test of 6 distinct faces
(4 real photos + 2 AI-generated test fixtures), comparing every cross-
identity pair plus "same person, different capture" simulated via rotation/
brightness/blur/downscale distortion of each photo. Observed results:
cross-identity cosine similarity ranged ~0.40-0.80 (max 0.7998), while
same-identity-under-distortion similarity ranged ~0.82-0.94 (min 0.8189).
0.80 was picked as it sits at that boundary. This is a THIN margin from a
tiny sample, NOT a calibrated false-accept/false-reject curve from a
standard face-verification benchmark (which would need thousands of
identities). Administrators should treat 0.80 strictly as a starting point
and tune the per-institution attendance policy threshold against their own
enrolled population and camera/lighting conditions. Because face matching
is only one of several independent checks in the attendance pipeline (valid
login + active session + geofence + live head-turn challenge + eye-blink
detection), an imperfect face-match threshold does not, by itself, make the
whole pipeline forgeable.

If you have normal internet access, you can upgrade accuracy by dropping
OpenCV's pretrained `face_recognition_sface_2021dec.onnx` model (from the
OpenCV Zoo) into `ai-service/models/` and swapping `extract_embedding`'s body
to run it via `cv2.FaceRecognizerSF` - the HTTP contract (`/extract-face-
embedding`, `/verify-face`) does not need to change for callers.
"""
from __future__ import annotations

from typing import List, Optional, Tuple

import cv2
import numpy as np

from .config import settings
from .face_mesh_engine import GEOMETRY_LANDMARK_IDX, get_engine, landmarks_to_xy

GEOMETRY_WEIGHT = 0.15
TEXTURE_WEIGHT = 1.0

ALIGNED_FACE_SIZE = 128
LBP_GRID = 8  # 8x8 cells
LBP_UNIFORM_BINS = 59  # the 58 uniform patterns + 1 "non-uniform" bucket

LEFT_EYE_OUTER_IDX = 263
RIGHT_EYE_OUTER_IDX = 33

_UNIFORM_LUT: Optional[np.ndarray] = None


class FaceGeometryError(ValueError):
    """Raised when a usable, single face cannot be found for embedding extraction."""


def _get_single_face_landmarks(image_bgr: np.ndarray):
    result = get_engine().face_mesh(image_bgr)
    if not result.multi_face_landmarks:
        raise FaceGeometryError("no_face")
    if len(result.multi_face_landmarks) > 1:
        raise FaceGeometryError("multiple_faces")
    return result.multi_face_landmarks[0]


def _geometry_vector(points: List[Tuple[float, float]]) -> np.ndarray:
    pts = np.array(points, dtype=np.float64)
    left_eye_outer = pts[LEFT_EYE_OUTER_IDX]
    right_eye_outer = pts[RIGHT_EYE_OUTER_IDX]
    origin = (left_eye_outer + right_eye_outer) / 2.0
    scale = float(np.linalg.norm(left_eye_outer - right_eye_outer)) or 1.0

    selected = np.array([points[i] for i in GEOMETRY_LANDMARK_IDX], dtype=np.float64)
    normalized = (selected - origin) / scale
    return normalized.flatten()


def _align_face(image_bgr: np.ndarray, points: List[Tuple[float, float]]) -> np.ndarray:
    """Rotates/scales/crops the face to a canonical pose using the eye landmarks."""
    left_eye = np.array(points[LEFT_EYE_OUTER_IDX])
    right_eye = np.array(points[RIGHT_EYE_OUTER_IDX])

    dx, dy = (left_eye - right_eye)
    angle = np.degrees(np.arctan2(dy, dx))
    eye_center = tuple(((left_eye + right_eye) / 2.0).tolist())
    inter_ocular = float(np.linalg.norm(left_eye - right_eye)) or 1.0

    # Target: inter-ocular distance maps to a fixed fraction of the output size.
    desired_inter_ocular = ALIGNED_FACE_SIZE * 0.42
    scale = desired_inter_ocular / inter_ocular

    rot_mat = cv2.getRotationMatrix2D(eye_center, angle, scale)
    # Translate so the eye center lands at the desired output position.
    target_x, target_y = ALIGNED_FACE_SIZE / 2.0, ALIGNED_FACE_SIZE * 0.38
    rot_mat[0, 2] += target_x - eye_center[0]
    rot_mat[1, 2] += target_y - eye_center[1]

    aligned = cv2.warpAffine(
        image_bgr, rot_mat, (ALIGNED_FACE_SIZE, ALIGNED_FACE_SIZE), flags=cv2.INTER_LINEAR
    )
    return cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY)


def _uniform_lut() -> np.ndarray:
    """Builds a lookup table mapping each of the 256 LBP codes to one of 59 uniform bins."""
    global _UNIFORM_LUT
    if _UNIFORM_LUT is not None:
        return _UNIFORM_LUT

    def transitions(code: int) -> int:
        bits = [(code >> i) & 1 for i in range(8)]
        return sum(bits[i] != bits[(i + 1) % 8] for i in range(8))

    lut = np.zeros(256, dtype=np.int32)
    next_label = 0
    for code in range(256):
        if transitions(code) <= 2:
            lut[code] = next_label
            next_label += 1
        else:
            lut[code] = -1  # placeholder, fixed below
    non_uniform_label = next_label  # the 59th bucket (index 58, since next_label ends at 58)
    lut[lut == -1] = non_uniform_label
    _UNIFORM_LUT = lut
    return lut


def _lbp_codes(gray: np.ndarray) -> np.ndarray:
    """Computes the raw (0-255) LBP code for every interior pixel."""
    center = gray[1:-1, 1:-1].astype(np.int16)
    code = np.zeros_like(center, dtype=np.uint8)
    offsets = [(-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1)]
    for bit, (dy, dx) in enumerate(offsets):
        neighbor = gray[1 + dy : 1 + dy + center.shape[0], 1 + dx : 1 + dx + center.shape[1]].astype(np.int16)
        code |= ((neighbor >= center).astype(np.uint8)) << bit
    return code


def _grid_lbp_histogram(aligned_gray: np.ndarray) -> np.ndarray:
    aligned_gray = cv2.equalizeHist(aligned_gray)
    codes = _lbp_codes(aligned_gray)
    uniform = _uniform_lut()[codes]

    cell = ALIGNED_FACE_SIZE // LBP_GRID
    histograms = []
    for row in range(LBP_GRID):
        for col in range(LBP_GRID):
            y1, y2 = row * cell, (row + 1) * cell
            x1, x2 = col * cell, (col + 1) * cell
            # account for the 1px border lost when computing LBP codes
            cy1, cy2 = max(0, y1 - 1), max(0, y2 - 1)
            cx1, cx2 = max(0, x1 - 1), max(0, x2 - 1)
            patch = uniform[cy1:cy2, cx1:cx2]
            hist, _ = np.histogram(patch, bins=LBP_UNIFORM_BINS, range=(0, LBP_UNIFORM_BINS))
            hist = hist.astype(np.float64)
            total = hist.sum()
            histograms.append(hist / total if total > 0 else hist)
    return np.concatenate(histograms)


def _face_quality(points: List[Tuple[float, float]], image_shape, brightness: float) -> float:
    xs = [p[0] for p in points]
    w = image_shape[1]
    face_w = max(xs) - min(xs)
    size_score = float(min(1.0, face_w / (0.15 * w))) if w > 0 else 0.0
    brightness_score = float(max(0.0, 1.0 - abs(brightness - 135.0) / 135.0))
    return round(0.5 * size_score + 0.5 * brightness_score, 3)


def extract_embedding(image_bgr: np.ndarray) -> Tuple[List[float], float]:
    from .image_utils import brightness_of  # local import avoids a circular import

    landmarks = _get_single_face_landmarks(image_bgr)
    h, w = image_bgr.shape[:2]
    points = landmarks_to_xy(landmarks, w, h)

    aligned_gray = _align_face(image_bgr, points)

    geometry = _geometry_vector(points) * GEOMETRY_WEIGHT
    texture = _grid_lbp_histogram(aligned_gray) * TEXTURE_WEIGHT

    vector = np.concatenate([geometry, texture])
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm

    quality = _face_quality(points, image_bgr.shape, brightness_of(image_bgr))
    return vector.tolist(), quality


def cosine_similarity(a: List[float], b: List[float]) -> float:
    va, vb = np.array(a, dtype=np.float64), np.array(b, dtype=np.float64)
    if va.shape != vb.shape or va.size == 0:
        return 0.0
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.clip(np.dot(va, vb) / denom, -1.0, 1.0))


def best_match_similarity(candidate: List[float], references: List[List[float]]) -> float:
    if not references:
        return 0.0
    return max(cosine_similarity(candidate, ref) for ref in references)


def verify_face(
    image_bgr: np.ndarray, reference_embeddings: List[List[float]], threshold: Optional[float] = None
) -> Tuple[bool, float, float]:
    embedding, _quality = extract_embedding(image_bgr)
    similarity = best_match_similarity(embedding, reference_embeddings)
    effective_threshold = threshold if threshold is not None else settings.DEFAULT_FACE_MATCH_THRESHOLD
    return similarity >= effective_threshold, similarity, effective_threshold
