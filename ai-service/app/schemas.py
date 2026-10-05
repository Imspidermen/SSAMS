"""Pydantic request/response models for the AI service's internal HTTP API."""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Quality = Literal["ok", "too_dark", "too_bright", "no_face", "multiple_faces"]


class ImageRequest(BaseModel):
    image: str = Field(..., description="Base64-encoded JPEG/PNG image (optionally a data: URL)")


class FaceBox(BaseModel):
    x: int
    y: int
    width: int
    height: int
    confidence: float


class DetectFaceResponse(BaseModel):
    faceCount: int
    faces: List[FaceBox]
    brightness: float
    quality: Quality


class EmbeddingResponse(BaseModel):
    embedding: List[float]
    quality: float


class VerifyFaceRequest(BaseModel):
    image: str
    referenceEmbeddings: List[List[float]]
    threshold: Optional[float] = None


class VerifyFaceResponse(BaseModel):
    match: bool
    similarity: float
    threshold: float


class LivenessRequest(BaseModel):
    frames: List[str]
    challenge: List[str] = Field(default_factory=list)


class LivenessResponse(BaseModel):
    live: bool
    headMovementDetected: bool
    movementDirectionObserved: Literal["LEFT", "RIGHT", "NONE"]
    landmarkConsistency: float
    reason: Optional[str] = None


class BlinkRequest(BaseModel):
    frames: List[str]


class BlinkResponse(BaseModel):
    blinkDetected: bool
    minEar: float
    maxEar: float
    reason: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    details: dict
