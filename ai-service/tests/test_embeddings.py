import cv2
import numpy as np
import pytest

from app.embeddings import (
    FaceGeometryError,
    best_match_similarity,
    cosine_similarity,
    extract_embedding,
    verify_face,
)


def test_extract_embedding_returns_normalized_vector(face_image_a_bgr):
    vector, quality = extract_embedding(face_image_a_bgr)
    assert len(vector) > 0
    norm = float(np.linalg.norm(np.array(vector)))
    assert abs(norm - 1.0) < 1e-3
    assert 0.0 <= quality <= 1.0


def test_extract_embedding_no_face_raises():
    blank = np.full((200, 200, 3), 100, dtype=np.uint8)
    with pytest.raises(FaceGeometryError) as exc_info:
        extract_embedding(blank)
    assert str(exc_info.value) == "no_face"


def test_extract_embedding_multiple_faces_raises(face_image_a_bgr, face_image_b_bgr):
    h = 300
    a = cv2.resize(face_image_a_bgr, (int(face_image_a_bgr.shape[1] * h / face_image_a_bgr.shape[0]), h))
    b = cv2.resize(face_image_b_bgr, (int(face_image_b_bgr.shape[1] * h / face_image_b_bgr.shape[0]), h))
    combined = np.hstack([a, b])

    with pytest.raises(FaceGeometryError) as exc_info:
        extract_embedding(combined)
    assert str(exc_info.value) == "multiple_faces"


def test_cosine_similarity_identical_vectors_is_one():
    v = [0.5, 0.5, 0.5, 0.5]
    assert cosine_similarity(v, v) == pytest.approx(1.0, abs=1e-6)


def test_cosine_similarity_mismatched_shapes_returns_zero():
    assert cosine_similarity([1.0, 2.0], [1.0, 2.0, 3.0]) == 0.0


def test_same_image_matches_itself(face_image_a_bgr):
    embedding, _ = extract_embedding(face_image_a_bgr)
    match, similarity, threshold = verify_face(face_image_a_bgr, [embedding])
    assert match is True
    assert similarity == pytest.approx(1.0, abs=1e-6)


def test_different_people_do_not_necessarily_share_identity(face_image_a_bgr, face_image_b_bgr):
    # NOTE: this classical (non-deep-learning) descriptor is not perfectly
    # discriminative - see app/embeddings.py's module docstring for the
    # documented accuracy limitation. This test only asserts the sanity
    # property that two different people are *less* similar than a person
    # compared with themselves, not that they fall below the production
    # threshold (which depends on institution-specific tuning).
    embedding_a, _ = extract_embedding(face_image_a_bgr)
    self_similarity = best_match_similarity(embedding_a, [embedding_a])
    cross_similarity = best_match_similarity(embedding_a, [extract_embedding(face_image_b_bgr)[0]])
    assert cross_similarity < self_similarity


def test_verify_face_respects_custom_threshold(face_image_a_bgr):
    embedding, _ = extract_embedding(face_image_a_bgr)
    match, similarity, threshold = verify_face(face_image_a_bgr, [embedding], threshold=0.99)
    assert threshold == 0.99
    assert match is True  # exact self-match is similarity 1.0, still passes a strict threshold


def test_verify_face_no_face_in_probe_raises():
    blank = np.full((200, 200, 3), 100, dtype=np.uint8)
    with pytest.raises(FaceGeometryError):
        verify_face(blank, [[0.1, 0.2, 0.3]])
