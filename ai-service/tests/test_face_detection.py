from app.face_detection import detect_faces


def test_detect_single_face(face_image_a_bgr):
    result = detect_faces(face_image_a_bgr)
    assert result.faceCount == 1
    assert len(result.faces) == 1
    box = result.faces[0]
    assert box.width > 0 and box.height > 0
    assert 0.0 < box.confidence <= 1.0
    assert result.quality == "ok"


def test_detect_no_face_on_blank_image():
    import cv2
    import numpy as np

    blank = np.full((200, 200, 3), 100, dtype=np.uint8)
    result = detect_faces(blank)
    assert result.faceCount == 0
    assert result.faces == []
    assert result.quality == "no_face"


def test_detect_two_faces(face_image_a_bgr, face_image_b_bgr):
    import cv2
    import numpy as np

    h = 300
    a = cv2.resize(face_image_a_bgr, (int(face_image_a_bgr.shape[1] * h / face_image_a_bgr.shape[0]), h))
    b = cv2.resize(face_image_b_bgr, (int(face_image_b_bgr.shape[1] * h / face_image_b_bgr.shape[0]), h))
    combined = np.hstack([a, b])

    result = detect_faces(combined)
    assert result.faceCount == 2


def test_brightness_classification_for_dark_image():
    import numpy as np

    very_dark = np.full((200, 200, 3), 5, dtype=np.uint8)
    result = detect_faces(very_dark)
    assert result.quality in ("too_dark", "no_face")


def test_brightness_classification_for_bright_image():
    import numpy as np

    very_bright = np.full((200, 200, 3), 250, dtype=np.uint8)
    result = detect_faces(very_bright)
    assert result.quality in ("too_bright", "no_face")
