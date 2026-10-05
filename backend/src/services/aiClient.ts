import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

const client: AxiosInstance = axios.create({
  baseURL: env.AI_SERVICE_URL,
  timeout: env.AI_SERVICE_TIMEOUT_MS,
});

export interface DetectFaceResponse {
  faceCount: number;
  faces: Array<{ x: number; y: number; width: number; height: number; confidence: number }>;
  brightness: number;
  quality: 'ok' | 'too_dark' | 'too_bright' | 'no_face' | 'multiple_faces';
}

export interface EmbeddingResponse {
  embedding: number[];
  quality: number;
}

export interface VerifyFaceResponse {
  match: boolean;
  similarity: number;
  threshold: number;
}

export interface LivenessResponse {
  live: boolean;
  headMovementDetected: boolean;
  movementDirectionObserved: 'LEFT' | 'RIGHT' | 'NONE';
  landmarkConsistency: number;
  reason?: string;
}

export interface BlinkResponse {
  blinkDetected: boolean;
  minEar: number;
  maxEar: number;
  reason?: string;
}

async function safeCall<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response) {
        throw new AppError(
          'AI_SERVICE_ERROR',
          err.response.data?.detail || `AI service rejected the ${label} request`,
          502,
        );
      }
      throw new AppError(
        'AI_SERVICE_UNAVAILABLE',
        `The AI verification service is unavailable (${label}). Please try again shortly.`,
        503,
      );
    }
    throw err;
  }
}

export const aiClient = {
  async detectFace(imageBase64: string): Promise<DetectFaceResponse> {
    return safeCall('face detection', async () => {
      const { data } = await client.post('/detect-face', { image: imageBase64 });
      return data;
    });
  },

  async extractEmbedding(imageBase64: string): Promise<EmbeddingResponse> {
    return safeCall('embedding extraction', async () => {
      const { data } = await client.post('/extract-face-embedding', { image: imageBase64 });
      return data;
    });
  },

  async verifyFace(
    imageBase64: string,
    referenceEmbeddings: number[][],
    threshold: number,
  ): Promise<VerifyFaceResponse> {
    return safeCall('face verification', async () => {
      const { data } = await client.post('/verify-face', {
        image: imageBase64,
        referenceEmbeddings,
        threshold,
      });
      return data;
    });
  },

  async analyzeLiveness(frames: string[], challenge: string[]): Promise<LivenessResponse> {
    return safeCall('liveness analysis', async () => {
      const { data } = await client.post('/liveness-analysis', { frames, challenge });
      return data;
    });
  },

  async analyzeBlink(frames: string[]): Promise<BlinkResponse> {
    return safeCall('blink analysis', async () => {
      const { data } = await client.post('/blink-analysis', { frames });
      return data;
    });
  },

  async health(): Promise<boolean> {
    try {
      const { data } = await client.get('/health', { timeout: 2000 });
      return data?.status === 'ok';
    } catch {
      return false;
    }
  },
};
