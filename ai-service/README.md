# SSAMS AI Service

A small, CPU-only Python/FastAPI microservice used internally by the SSAMS
Node.js backend to perform the computer-vision steps of attendance
verification: face detection, face-embedding extraction/comparison, a
head-turn liveness challenge, and eye-blink detection.

**This service is never called directly by the browser.** The React
frontend sends camera frames to the Node backend, which forwards them here
over a private network call, applies the result to its own
authorization/session/geofence/duplicate-prevention logic, and only then
decides whether to mark attendance. See `docs/ARCHITECTURE.md` for the full
pipeline.

## Why these specific libraries

* **MediaPipe 0.10.14** (`mp.solutions.face_mesh` / `face_detection`) - the
  face detector and 468-point face mesh model ship *inside* the pip wheel,
  so there is no separate model download step and no GPU/CUDA requirement.
  Newer MediaPipe releases (1.0+) moved to a different "Tasks" API whose
  prebuilt model bundles are fetched over the network at first use, which
  this project intentionally avoids - the pinned 0.10.14 keeps the service
  fully offline-capable after `pip install`.
* **OpenCV (`opencv-contrib-python`, pulled in by MediaPipe)** - image
  decoding, geometric transforms, and classical texture-descriptor math.

Both install from prebuilt wheels on Windows, Linux and macOS via plain
`pip install -r requirements.txt` - no system package manager, Docker, or
compiler toolchain required (see `docs/WINDOWS_SETUP.md` /
`docs/LINUX_SETUP.md`).

## Honest limitation: face matching is classical CV, not deep learning

`/extract-face-embedding` and `/verify-face` use a hand-built descriptor
(face alignment + grid-based uniform LBP texture histogram + normalized
landmark geometry), **not** a pretrained deep embedding model such as
ArcFace/SFace. Modern deep models are noticeably more accurate at
distinguishing look-alikes, but they require downloading a pretrained model
file, which was not possible in the environment this project was built in
(no access to the usual model-hosting services). The full reasoning,
measured accuracy (~0.80 default similarity threshold, derived from a small
manual test - see the module docstring for exact numbers), and the exact
upgrade path to `cv2.FaceRecognizerSF` once you do have network access to a
model file are documented at the top of `app/embeddings.py`. This is one
layer in a multi-factor pipeline (login credentials + active session +
geofence + live head-turn challenge + blink detection + face match), so it
is not the sole safeguard against a false attendance mark.

Liveness ("did a real person move their head") and blink detection also have
real limits - they resist a simple printed-photo or static-image replay
attack, but are not a certified anti-spoofing solution against, e.g., a
high-quality pre-recorded video played back to the camera. See
`docs/BIOMETRIC_PRIVACY.md` for the full write-up.

## Endpoints

| Method | Path                     | Purpose                                             |
|--------|--------------------------|------------------------------------------------------|
| GET    | `/health`                | Liveness/readiness check                             |
| POST   | `/detect-face`           | Face count, bounding boxes, brightness, quality      |
| POST   | `/extract-face-embedding`| Returns a numeric descriptor for one detected face   |
| POST   | `/verify-face`           | Compares a probe image against reference embeddings  |
| POST   | `/liveness-analysis`     | Validates a head-turn challenge across a frame burst |
| POST   | `/blink-analysis`        | Validates an open->closed->open blink across frames  |

All image payloads are base64-encoded JPEG/PNG strings (a `data:image/...;
base64,` prefix is tolerated and stripped). Raw images are decoded in memory
only and are never written to disk by this service. Face embeddings are
numeric vectors with no direct visual meaning; this service never returns a
cropped face image or raw landmark coordinates in any response.

## Configuration

Copy `.env.example` to `.env` and adjust as needed. See `app/config.py` for
every setting and its default (detection confidence, brightness bounds,
default face-match threshold, EAR blink thresholds, head-turn sensitivity,
max image dimension processed, etc).

## Running locally

```bash
pip install -r requirements.txt
cp .env.example .env
python main.py
# or: uvicorn main:app --host 0.0.0.0 --port 8000
```

On a minimal/headless Linux server you may hit a missing `libGL.so.1` error
when importing OpenCV - see `docs/TROUBLESHOOTING.md` for the one-line fix
(`apt-get install libgl1`) or the alternative headless-OpenCV install.

## Tests

```bash
pip install pytest httpx
pytest tests/ -v
```

The suite (44 tests) covers: image decoding/validation, face detection on
real fixture images, embedding extraction and verification (including
no-face/multiple-faces error handling), and deterministic blink/liveness
state-machine logic driven by synthetic landmark sequences (since a CI
environment has no real camera to produce genuine blink/head-turn video).
`tests/fixtures/*.jpg` are small AI-generated (not real people's) photos
bundled for face-detection tests so the suite has no external dependency.
