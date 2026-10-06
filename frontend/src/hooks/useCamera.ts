import { useCallback, useEffect, useRef, useState } from 'react';
import { FRAME_JPEG_QUALITY, FRAME_MAX_EDGE } from '@/utils/constants';

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'error' | 'stopped';

export interface UseCameraOptions {
  facingMode?: 'user' | 'environment';
  /** Called whenever the status or error changes. */
  onStatusChange?: (status: CameraStatus, error: string | null) => void;
}

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  error: string | null;
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => void;
  /** Captures one downscaled JPEG frame as a data URL (or null if not ready). */
  captureFrame: (maxEdge?: number, quality?: number) => string | null;
  /** Captures `count` frames spaced `intervalMs` apart - used for liveness/blink. */
  captureFrames: (count: number, intervalMs?: number) => Promise<string[]>;
  retry: () => Promise<void>;
}

function describeCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Camera permission was denied. Allow camera access in your browser settings, then try again.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera was found on this device.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'The camera is already in use by another application. Close it and try again.';
      case 'OverconstrainedError':
        return 'This camera does not support the requested settings.';
      case 'SecurityError':
        return 'Camera access requires a secure (HTTPS) connection.';
      default:
        return `Camera error: ${error.message}`;
    }
  }
  if (error instanceof Error) return error.message;
  return 'Unable to start the camera.';
}

/**
 * Real camera capture via `getUserMedia`.
 *
 * Frames are downscaled and JPEG-encoded in the browser before upload, which
 * keeps the base64 payloads the backend forwards to the CV service small.
 * Nothing here simulates recognition: images are always sent to the API and
 * the verdict comes back from the server.
 */
export function useCamera(options: UseCameraOptions = {}): UseCameraResult {
  const { facingMode = 'user', onStatusChange } = options;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const isSupported =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    // getUserMedia only works in secure contexts (HTTPS or localhost).
    (typeof window === 'undefined' || window.isSecureContext);

  const updateStatus = useCallback(
    (next: CameraStatus, nextError: string | null) => {
      setStatus(next);
      setError(nextError);
      onStatusChange?.(next, nextError);
    },
    [onStatusChange],
  );

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    updateStatus('stopped', null);
  }, [updateStatus]);

  const start = useCallback(async () => {
    if (!isSupported) {
      updateStatus(
        'error',
        'Camera capture is unavailable in this browser context. A secure (HTTPS) connection and camera permission are required.',
      );
      return;
    }
    if (streamRef.current) return;

    updateStatus('requesting', null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        // Some browsers need the promise to settle before the frame is drawn.
        await video.play().catch(() => undefined);
      }
      updateStatus('ready', null);
    } catch (caught) {
      updateStatus('error', describeCameraError(caught));
    }
  }, [facingMode, isSupported, updateStatus]);

  const captureFrame = useCallback(
    (maxEdge = FRAME_MAX_EDGE, quality = FRAME_JPEG_QUALITY): string | null => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

      const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return null;

      context.drawImage(video, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', quality);
    },
    [],
  );

  const captureFrames = useCallback(
    async (count: number, intervalMs = 160): Promise<string[]> => {
      const frames: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const frame = captureFrame();
        if (frame) frames.push(frame);
        if (index < count - 1) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }
      return frames;
    },
    [captureFrame],
  );

  // Always release the camera when the host component unmounts.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return {
    videoRef,
    status,
    error,
    isSupported,
    start,
    stop,
    captureFrame,
    captureFrames,
    retry: start,
  };
}
