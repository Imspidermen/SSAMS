"""Smart Student Attendance Management System - AI/CV Service entry point.

Run with:
    uvicorn main:app --host 0.0.0.0 --port 8000

This service is only ever called by the Node.js backend (never directly by
the browser) over a plain internal HTTP API. It performs face detection,
face-embedding extraction/comparison, liveness-challenge analysis and
eye-blink detection using CPU-only, cross-platform libraries (OpenCV +
MediaPipe). See ai-service/README.md for full details and limitations.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.embeddings import FaceGeometryError, extract_embedding, verify_face
from app.face_detection import detect_faces
from app.image_utils import InvalidImageError, decode_base64_image
from app.liveness import analyze_liveness
from app.blink import analyze_blink
from app.schemas import (
    BlinkRequest,
    BlinkResponse,
    DetectFaceResponse,
    EmbeddingResponse,
    HealthResponse,
    ImageRequest,
    LivenessRequest,
    LivenessResponse,
    VerifyFaceRequest,
    VerifyFaceResponse,
)

logging.basicConfig(level=settings.LOG_LEVEL.upper())
logger = logging.getLogger("ssams.ai-service")

app = FastAPI(
    title="SSAMS AI Service",
    description="Internal face detection / recognition / liveness / blink analysis API",
    version="1.0.0",
)

# This API is only called server-to-server by the Node backend, but CORS is
# configured defensively in case of local debugging from a browser tool.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000", "http://127.0.0.1:4000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", details={"service": "ai-service", "version": "1.0.0"})


@app.post("/detect-face", response_model=DetectFaceResponse)
def detect_face_endpoint(payload: ImageRequest) -> DetectFaceResponse:
    try:
        image = decode_base64_image(payload.image)
    except InvalidImageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return detect_faces(image)


@app.post("/extract-face-embedding", response_model=EmbeddingResponse)
def extract_embedding_endpoint(payload: ImageRequest) -> EmbeddingResponse:
    try:
        image = decode_base64_image(payload.image)
        vector, quality = extract_embedding(image)
    except InvalidImageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except FaceGeometryError as exc:
        code = str(exc)
        message = (
            "No face detected in the image."
            if code == "no_face"
            else "Only one person should be visible in the camera."
        )
        raise HTTPException(status_code=422, detail=message) from exc
    return EmbeddingResponse(embedding=vector, quality=quality)


@app.post("/verify-face", response_model=VerifyFaceResponse)
def verify_face_endpoint(payload: VerifyFaceRequest) -> VerifyFaceResponse:
    if not payload.referenceEmbeddings:
        raise HTTPException(status_code=422, detail="No reference embeddings were provided.")
    try:
        image = decode_base64_image(payload.image)
        match, similarity, threshold = verify_face(image, payload.referenceEmbeddings, payload.threshold)
    except InvalidImageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except FaceGeometryError as exc:
        code = str(exc)
        message = (
            "No face detected in the image."
            if code == "no_face"
            else "Only one person should be visible in the camera."
        )
        raise HTTPException(status_code=422, detail=message) from exc
    return VerifyFaceResponse(match=match, similarity=round(similarity, 4), threshold=threshold)


@app.post("/liveness-analysis", response_model=LivenessResponse)
def liveness_analysis_endpoint(payload: LivenessRequest) -> LivenessResponse:
    if not payload.frames:
        raise HTTPException(status_code=422, detail="No frames were provided.")
    return analyze_liveness(payload.frames, payload.challenge)


@app.post("/blink-analysis", response_model=BlinkResponse)
def blink_analysis_endpoint(payload: BlinkRequest) -> BlinkResponse:
    if not payload.frames:
        raise HTTPException(status_code=422, detail="No frames were provided.")
    return analyze_blink(payload.frames)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=False)
