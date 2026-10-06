import type { RefObject, ReactNode } from 'react';
import { Camera, CameraOff, RotateCw, Video } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { CameraStatus } from '@/hooks/useCamera';

export interface CameraViewportProps {
  videoRef: RefObject<HTMLVideoElement>;
  status: CameraStatus;
  error?: string | null;
  /** Instruction shown above the viewport. */
  instruction?: ReactNode;
  /** Overlay drawn on top of the video (guide outline, countdown, capture flash). */
  overlay?: ReactNode;
  /** Status line under the viewport, e.g. "Capturing 12 frames…". */
  caption?: ReactNode;
  onStart?: () => void;
  onRetry?: () => void;
  busy?: boolean;
  mirrored?: boolean;
}

/**
 * Presentational camera stage. It renders the live `getUserMedia` stream and
 * honestly reports permission, device and secure-context failures - it never
 * draws a fake preview or pretends to analyse a face locally. All analysis is
 * done by the backend CV service.
 */
export function CameraViewport({
  videoRef,
  status,
  error,
  instruction,
  overlay,
  caption,
  onStart,
  onRetry,
  busy = false,
  mirrored = true,
}: CameraViewportProps) {
  const isLive = status === 'ready';

  return (
    <div className="camera">
      {instruction ? <p className="camera__instruction">{instruction}</p> : null}

      <div className="camera__stage">
        <video
          ref={videoRef}
          className="camera__video"
          style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
          autoPlay
          playsInline
          muted
          aria-label="Live camera preview used for face verification"
        />

        {!isLive ? (
          <div className="camera__placeholder">
            {status === 'requesting' ? (
              <>
                <Spinner size={28} label="Waiting for camera" />
                <p className="text-caption">Waiting for camera permission…</p>
              </>
            ) : status === 'error' ? (
              <>
                <CameraOff size={26} aria-hidden="true" />
                <p className="text-caption">Camera unavailable</p>
              </>
            ) : (
              <>
                <Camera size={26} aria-hidden="true" />
                <p className="text-caption">Camera is off</p>
              </>
            )}
          </div>
        ) : null}

        {isLive && overlay ? <div className="camera__overlay">{overlay}</div> : null}

        {busy && isLive ? (
          <div className="camera__busy" role="status">
            <Spinner size={14} />
            <span>Working…</span>
          </div>
        ) : null}
      </div>

      {caption ? <p className="camera__caption">{caption}</p> : null}

      {status === 'idle' || status === 'stopped' ? (
        <Button type="button" icon={<Video size={16} />} onClick={onStart} disabled={busy}>
          Turn on camera
        </Button>
      ) : null}

      {status === 'error' ? (
        <div className="stack stack-3">
          <Alert tone="error" title="Camera could not start">
            {error ?? 'An unknown camera error occurred.'}
          </Alert>
          {onRetry ? (
            <Button
              type="button"
              variant="secondary"
              icon={<RotateCw size={16} />}
              onClick={onRetry}
            >
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
