"""Deterministic unit tests for EAR-based blink detection.

Real camera video of someone blinking is not available in an automated test
environment, so these tests build synthetic MediaPipe-shaped landmark
objects with a precisely controlled Eye Aspect Ratio (EAR) per frame and
monkeypatch the face-mesh engine to return them. This exercises the actual
open->closed->open state-machine logic in app/blink.py exactly as it runs in
production, without depending on a live camera.
"""
from __future__ import annotations

from types import SimpleNamespace

import numpy as np

import app.blink as blink_module
from app.blink import analyze_blink
from app.face_mesh_engine import LEFT_EYE_EAR_IDX, RIGHT_EYE_EAR_IDX


class _FakeLandmark:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
        self.z = 0.0


def _eye_points_for_ear(center_x: float, ear_value: float, horizontal: float = 0.3):
    half_h = horizontal / 2
    vertical_total = ear_value * 2 * horizontal
    v = vertical_total / 2
    p1 = (center_x - half_h, 0.5)
    p4 = (center_x + half_h, 0.5)
    p2 = (center_x - half_h * 0.4, 0.5 - v / 2)
    p6 = (center_x - half_h * 0.4, 0.5 + v / 2)
    p3 = (center_x + half_h * 0.4, 0.5 - v / 2)
    p5 = (center_x + half_h * 0.4, 0.5 + v / 2)
    return [p1, p2, p3, p4, p5, p6]


def _fake_result_for_ear(ear_value: float):
    points = [(0.5, 0.5)] * 468
    left_pts = _eye_points_for_ear(0.35, ear_value)
    right_pts = _eye_points_for_ear(0.65, ear_value)
    for idx, (x, y) in zip(LEFT_EYE_EAR_IDX, left_pts):
        points[idx] = (x, y)
    for idx, (x, y) in zip(RIGHT_EYE_EAR_IDX, right_pts):
        points[idx] = (x, y)

    landmark_set = SimpleNamespace(landmark=[_FakeLandmark(x, y) for x, y in points])
    return SimpleNamespace(multi_face_landmarks=[landmark_set])


class _FakeEngine:
    def __init__(self, ear_sequence):
        self._ear_sequence = list(ear_sequence)
        self._calls = 0

    def face_mesh(self, _image):
        ear_value = self._ear_sequence[self._calls]
        self._calls += 1
        return _fake_result_for_ear(ear_value)


def _patch(monkeypatch, ear_sequence):
    monkeypatch.setattr(blink_module, "decode_base64_image", lambda _frame: np.zeros((10, 10, 3), dtype=np.uint8))
    monkeypatch.setattr(blink_module, "get_engine", lambda: _FakeEngine(ear_sequence))


def test_genuine_blink_sequence_detected(monkeypatch):
    # open, open, closing, CLOSED, reopening, open
    sequence = [0.32, 0.31, 0.24, 0.14, 0.24, 0.30]
    _patch(monkeypatch, sequence)

    result = analyze_blink(["frame"] * len(sequence))

    assert result.blinkDetected is True
    assert result.reason is None
    assert result.minEar < blink_module.settings.EAR_CLOSED_THRESHOLD
    assert result.maxEar > blink_module.settings.EAR_OPEN_THRESHOLD


def test_eyes_always_open_no_blink(monkeypatch):
    sequence = [0.32, 0.31, 0.33, 0.30, 0.32]
    _patch(monkeypatch, sequence)

    result = analyze_blink(["frame"] * len(sequence))

    assert result.blinkDetected is False
    assert "blink" in result.reason.lower()


def test_eyes_always_closed_no_blink(monkeypatch):
    # No OPEN frame was ever observed, so this cannot be a genuine blink
    # (it's indistinguishable from a photo of someone with closed eyes).
    sequence = [0.15, 0.14, 0.16, 0.15, 0.14]
    _patch(monkeypatch, sequence)

    result = analyze_blink(["frame"] * len(sequence))

    assert result.blinkDetected is False


def test_too_few_frames_rejected():
    result = analyze_blink(["frame1", "frame2"])
    assert result.blinkDetected is False
    assert "not enough frames" in result.reason.lower()
