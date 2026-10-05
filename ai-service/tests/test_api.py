from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_detect_face_endpoint(face_image_a_b64):
    response = client.post("/detect-face", json={"image": face_image_a_b64})
    assert response.status_code == 200
    body = response.json()
    assert body["faceCount"] == 1
    assert body["quality"] == "ok"


def test_detect_face_rejects_invalid_payload():
    response = client.post("/detect-face", json={"image": "!!!not-base64!!!"})
    assert response.status_code == 422


def test_detect_face_rejects_missing_field():
    response = client.post("/detect-face", json={})
    assert response.status_code == 422


def test_extract_embedding_endpoint(face_image_a_b64):
    response = client.post("/extract-face-embedding", json={"image": face_image_a_b64})
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["embedding"], list) and len(body["embedding"]) > 0
    assert 0.0 <= body["quality"] <= 1.0


def test_extract_embedding_no_face_returns_422(blank_image_b64):
    response = client.post("/extract-face-embedding", json={"image": blank_image_b64})
    assert response.status_code == 422
    assert "no face" in response.json()["detail"].lower()


def test_extract_embedding_multiple_faces_returns_422(two_faces_image_b64):
    response = client.post("/extract-face-embedding", json={"image": two_faces_image_b64})
    assert response.status_code == 422
    assert "one person" in response.json()["detail"].lower()


def test_verify_face_self_match(face_image_a_b64):
    embedding = client.post("/extract-face-embedding", json={"image": face_image_a_b64}).json()["embedding"]
    response = client.post(
        "/verify-face",
        json={"image": face_image_a_b64, "referenceEmbeddings": [embedding], "threshold": 0.8},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["match"] is True
    assert body["similarity"] == 1.0


def test_verify_face_requires_reference_embeddings(face_image_a_b64):
    response = client.post("/verify-face", json={"image": face_image_a_b64, "referenceEmbeddings": []})
    assert response.status_code == 422


def test_liveness_endpoint_requires_frames():
    response = client.post("/liveness-analysis", json={"frames": [], "challenge": ["TURN_LEFT"]})
    assert response.status_code == 422


def test_liveness_endpoint_rejects_static_repeated_frame(face_image_a_b64):
    response = client.post(
        "/liveness-analysis",
        json={"frames": [face_image_a_b64] * 5, "challenge": ["TURN_LEFT", "TURN_RIGHT"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["live"] is False
    assert body["headMovementDetected"] is False


def test_blink_endpoint_requires_frames():
    response = client.post("/blink-analysis", json={"frames": []})
    assert response.status_code == 422


def test_blink_endpoint_rejects_static_repeated_frame(face_image_a_b64):
    response = client.post("/blink-analysis", json={"frames": [face_image_a_b64] * 5})
    assert response.status_code == 200
    body = response.json()
    assert body["blinkDetected"] is False
