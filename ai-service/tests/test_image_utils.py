import base64

import numpy as np
import pytest

from app.image_utils import InvalidImageError, brightness_of, decode_base64_image


def test_decode_plain_base64(face_image_a_b64):
    image = decode_base64_image(face_image_a_b64)
    assert image is not None
    assert image.ndim == 3


def test_decode_data_url_prefix(face_image_a_b64):
    data_url = f"data:image/jpeg;base64,{face_image_a_b64}"
    image = decode_base64_image(data_url)
    assert image is not None


def test_decode_invalid_base64_raises():
    with pytest.raises(InvalidImageError):
        decode_base64_image("not-valid-base64!!! ###")


def test_decode_valid_base64_but_not_an_image_raises():
    junk = base64.b64encode(b"this is definitely not an image").decode()
    with pytest.raises(InvalidImageError):
        decode_base64_image(junk)


def test_decode_empty_string_raises():
    with pytest.raises(InvalidImageError):
        decode_base64_image("")


def test_downscale_large_image_is_capped(face_image_a_bgr):
    import cv2

    from app.config import settings

    # Upscale the fixture well beyond MAX_IMAGE_DIMENSION then round-trip it
    # through decode_base64_image to confirm the service downsizes it.
    big = cv2.resize(face_image_a_bgr, (2000, 2000))
    ok, buf = cv2.imencode(".jpg", big)
    b64 = base64.b64encode(buf.tobytes()).decode()

    image = decode_base64_image(b64)
    assert max(image.shape[0], image.shape[1]) <= settings.MAX_IMAGE_DIMENSION


def test_brightness_of_known_gray_value():
    flat = np.full((50, 50, 3), 128, dtype=np.uint8)
    value = brightness_of(flat)
    assert 120 <= value <= 136
