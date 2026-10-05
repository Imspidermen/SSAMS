"""Deterministic unit tests for the head-turn liveness challenge.

As with blink detection, real turning-head video isn't available in an
automated test environment, so synthetic per-frame landmark sets with a
precisely controlled nose-offset ("yaw ratio") and face scale are fed
through the real app/liveness.py logic via a monkeypatched engine.
"""
from __future__ import annotations

from types import SimpleNamespace

import numpy as np

import app.liveness as liveness_module
from app.liveness import (
    LEFT_EYE_OUTER_IDX,
    LEFT_FACE_EDGE_IDX,
    NOSE_TIP_IDX,
    RIGHT_EYE_OUTER_IDX,
    RIGHT_FACE_EDGE_IDX,
    analyze_liveness,
)


class _FakeLandmark:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
        self.z = 0.0


def _fake_result(yaw_ratio: float, scale_jitter: float = 0.0, face_count: int = 1):
    if face_count != 1:
        return SimpleNamespace(multi_face_landmarks=[SimpleNamespace(landmark=[]) for _ in range(face_count)])

    points = [(0.5, 0.5)] * 468
    left_edge_x, right_edge_x = 0.3, 0.7
    center_x = (left_edge_x + right_edge_x) / 2
    half_width = (right_edge_x - left_edge_x) / 2
    nose_x = center_x + yaw_ratio * half_width

    points[LEFT_FACE_EDGE_IDX] = (left_edge_x, 0.5)
    points[RIGHT_FACE_EDGE_IDX] = (right_edge_x, 0.5)
    points[NOSE_TIP_IDX] = (nose_x, 0.5)
    points[LEFT_EYE_OUTER_IDX] = (0.42 + scale_jitter, 0.4)
    points[RIGHT_EYE_OUTER_IDX] = (0.58 - scale_jitter, 0.4)

    landmark_set = SimpleNamespace(landmark=[_FakeLandmark(x, y) for x, y in points])
    return SimpleNamespace(multi_face_landmarks=[landmark_set])


class _FakeEngine:
    def __init__(self, frame_specs):
        self._specs = list(frame_specs)
        self._calls = 0

    def face_mesh(self, _image):
        spec = self._specs[self._calls]
        self._calls += 1
        return _fake_result(**spec)


def _patch(monkeypatch, frame_specs):
    monkeypatch.setattr(liveness_module, "decode_base64_image", lambda _f: np.zeros((10, 10, 3), dtype=np.uint8))
    monkeypatch.setattr(liveness_module, "get_engine", lambda: _FakeEngine(frame_specs))


def test_genuine_left_and_right_turn_passes(monkeypatch):
    yaw_sequence = [0.0, -0.1, -0.22, -0.1, 0.0, 0.1, 0.22, 0.1, 0.0]
    specs = [{"yaw_ratio": y} for y in yaw_sequence]
    _patch(monkeypatch, specs)

    result = analyze_liveness(["frame"] * len(specs), ["TURN_LEFT", "TURN_RIGHT"])

    assert result.live is True
    assert result.headMovementDetected is True
    assert result.reason is None


def test_static_face_no_movement_fails(monkeypatch):
    specs = [{"yaw_ratio": 0.0} for _ in range(8)]
    _patch(monkeypatch, specs)

    result = analyze_liveness(["frame"] * len(specs), ["TURN_LEFT"])

    assert result.live is False
    assert result.headMovementDetected is False
    assert "static photo" in result.reason.lower() or "movement" in result.reason.lower()


def test_only_turns_one_direction_when_both_required_fails(monkeypatch):
    yaw_sequence = [0.0, -0.1, -0.22, -0.1, 0.0, -0.05, 0.0]
    specs = [{"yaw_ratio": y} for y in yaw_sequence]
    _patch(monkeypatch, specs)

    result = analyze_liveness(["frame"] * len(specs), ["TURN_LEFT", "TURN_RIGHT"])

    assert result.live is False
    assert "right" in result.reason.lower()


def test_multiple_faces_fails(monkeypatch):
    specs = [{"yaw_ratio": 0.0, "face_count": 1} for _ in range(3)] + [
        {"yaw_ratio": 0.0, "face_count": 2} for _ in range(3)
    ]
    _patch(monkeypatch, specs)

    result = analyze_liveness(["frame"] * len(specs), ["TURN_LEFT"])

    assert result.live is False
    assert "one person" in result.reason.lower()


def test_face_not_consistently_visible_fails(monkeypatch):
    specs = [{"yaw_ratio": 0.0, "face_count": 0} for _ in range(5)] + [
        {"yaw_ratio": -0.22, "face_count": 1}
    ]
    _patch(monkeypatch, specs)

    result = analyze_liveness(["frame"] * len(specs), ["TURN_LEFT"])

    assert result.live is False


def test_too_few_frames_rejected():
    result = analyze_liveness(["frame1", "frame2"], ["TURN_LEFT"])
    assert result.live is False
    assert "not enough frames" in result.reason.lower()
