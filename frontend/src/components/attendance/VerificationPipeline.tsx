import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck2,
  Crosshair,
  Eye,
  MapPin,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { CameraViewport } from './CameraViewport';
import { StepIndicator, type StepIndicatorItem, type StepState } from './StepIndicator';
import { useToast } from '@/hooks/useToast';
import { useCamera } from '@/hooks/useCamera';
import { useCountdown, formatRemaining } from '@/hooks/useCountdown';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  useBlinkVerify,
  useFaceVerify,
  useLivenessVerify,
  useLocationCheck,
  useMarkAttendance,
} from '@/hooks/queries/useStudentQueries';
import { paths } from '@/routes/paths';
import { describeApiError, isApiError } from '@/utils/apiError';
import { BLINK_FRAME_COUNT, FRAME_INTERVAL_MS, LIVENESS_FRAME_COUNT } from '@/utils/constants';
import { formatDistance, formatScore, formatTime } from '@/utils/format';
import type {
  AttendanceRecord,
  AttendanceSession,
  ChallengeStep,
  FaceVerifyResult,
  LocationCheckResult,
} from '@/types';

type Stage = 'location' | 'face' | 'liveness' | 'blink' | 'mark' | 'complete' | 'blocked';

interface BlockState {
  title: string;
  message: string;
  code?: string;
  /** Whether the student can try the whole pipeline again. */
  retryable: boolean;
}

export interface VerificationPipelineProps {
  session: AttendanceSession;
  /** Called once the backend has written the attendance record. */
  onCompleted?: (record: AttendanceRecord) => void;
  /** Called when the session can no longer be used (expired, already marked). */
  onClosed?: (reason: string) => void;
}

const MIN_FRAMES = 3;

/**
 * The student's self-service verification flow, one backend call per step:
 *
 *   1. POST /attendance/location-check  -> geofence + server-side attempt id
 *   2. POST /attendance/face/verify     -> face match against the enrolment
 *   3. POST /attendance/liveness        -> head-turn challenge over N frames
 *   4. POST /attendance/blink           -> natural blink over N frames
 *   5. POST /attendance/mark            -> the backend writes the record
 *
 * Nothing is decided in the browser: frames and coordinates are uploaded and the
 * verdict comes back from the API (which calls the Python CV service). Failures
 * are reported with the backend's own reason and respect `maxAttempts`.
 */
export function VerificationPipeline({
  session,
  onCompleted,
  onClosed,
}: VerificationPipelineProps) {
  const toast = useToast();
  const geolocation = useGeolocation();
  const camera = useCamera({ facingMode: 'user' });

  const locationCheck = useLocationCheck();
  const faceVerify = useFaceVerify();
  const livenessVerify = useLivenessVerify();
  const blinkVerify = useBlinkVerify();
  const markAttendance = useMarkAttendance();

  const [stage, setStage] = useState<Stage>('location');
  const [verification, setVerification] = useState<LocationCheckResult | null>(null);
  const [faceResult, setFaceResult] = useState<FaceVerifyResult | null>(null);
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [block, setBlock] = useState<BlockState | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [flash, setFlash] = useState(false);

  const remainingMs = useCountdown(
    verification?.expiresAt,
    verification !== null && stage !== 'complete',
  );
  const busy =
    locationCheck.isPending ||
    faceVerify.isPending ||
    livenessVerify.isPending ||
    blinkVerify.isPending ||
    markAttendance.isPending ||
    geolocation.status === 'locating';

  const livenessRequired = verification?.livenessRequired ?? session.livenessRequired;
  const blinkRequired = verification?.blinkRequired ?? session.blinkRequired;
  const maxAttempts = session.maxAttempts > 0 ? session.maxAttempts : 3;

  const turnInstructions = useMemo(() => {
    const turns = (verification?.challengeSequence ?? []).filter(
      (step: ChallengeStep) => step === 'TURN_LEFT' || step === 'TURN_RIGHT',
    );
    return turns.map((step) => (step === 'TURN_LEFT' ? 'left' : 'right'));
  }, [verification]);

  // The camera is only needed from the face step onwards.
  useEffect(() => {
    if (stage === 'face' && camera.status === 'idle') {
      void camera.start();
    }
    if (stage === 'complete' || stage === 'blocked') {
      camera.stop();
    }
    // `camera.start`/`stop` are stable callbacks from useCamera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const fail = useCallback(
    (error: unknown, retryStage: Stage) => {
      const apiError = isApiError(error) ? error : null;
      const code = apiError?.code;
      const message = describeApiError(error);
      setStepError(message);

      switch (code) {
        case 'SESSION_EXPIRED':
        case 'SESSION_NOT_FOUND':
          setBlock({
            title: 'This session has closed',
            message:
              'The attendance window ended before your verification completed. Ask your teacher to reopen a session if you were present.',
            code,
            retryable: false,
          });
          setStage('blocked');
          onClosed?.(message);
          return;

        case 'ALREADY_ATTENDED':
          setBlock({
            title: 'You are already marked for this session',
            message:
              'The backend already holds a record for you in this class, so it cannot be marked twice.',
            code,
            retryable: false,
          });
          setStage('blocked');
          onClosed?.(message);
          return;

        case 'TOO_MANY_ATTEMPTS':
          setBlock({
            title: 'Too many attempts',
            message:
              'The rate limit for verification attempts has been reached. Wait a few minutes and try again.',
            code,
            retryable: false,
          });
          setStage('blocked');
          return;

        case 'VERIFICATION_EXPIRED':
          setStepError('This verification attempt expired. Start again from the location check.');
          setVerification(null);
          setStage('location');
          return;

        case 'FACE_NOT_ENROLLED':
        case 'NO_FACE':
          setBlock({
            title: code === 'FACE_NOT_ENROLLED' ? 'Your face is not enrolled' : 'No face detected',
            message:
              code === 'FACE_NOT_ENROLLED'
                ? 'Enrol your face first - it takes about a minute and is required for every session.'
                : 'The camera did not find a face in the frame. Move into good light, face the camera and try again.',
            code,
            retryable: code !== 'FACE_NOT_ENROLLED',
          });
          setStage(code === 'FACE_NOT_ENROLLED' ? 'blocked' : retryStage);
          return;

        case 'AI_SERVICE_UNAVAILABLE':
        case 'AI_SERVICE_ERROR':
          setBlock({
            title: 'Verification service unavailable',
            message:
              'The face-analysis service the backend depends on is not responding. Your attendance cannot be recorded until it recovers - tell your teacher.',
            code,
            retryable: true,
          });
          setStage('blocked');
          return;

        case 'OUTSIDE_GEOFENCE':
          setBlock({
            title: 'You are outside the classroom area',
            message: geofenceMessage(apiError?.details),
            code,
            retryable: true,
          });
          setStage('blocked');
          return;

        default:
          // Retryable in-place for the remaining failures (recognition, liveness,
          // blink, network hiccups).
          setStage(retryStage);
          return;
      }
    },
    [onClosed],
  );

  const runLocationCheck = async () => {
    setStepError(null);
    setBlock(null);

    const position = await geolocation.locate();
    if (!position) {
      setStepError(
        geolocation.error ??
          'Your location could not be read. Enable location permission for this site and try again.',
      );
      return;
    }

    try {
      const result = await locationCheck.mutateAsync({ sessionId: session.id, ...position });
      setVerification(result);
      setFaceResult(null);
      setStage('face');
      toast.info(
        'Location verified',
        `You are ${formatDistance(result.distanceMeters)} from ${session.classroom?.name ?? 'the classroom'} (limit ${formatDistance(result.allowedRadiusMeters)}).`,
      );
    } catch (error) {
      fail(error, 'location');
    }
  };

  const runFaceVerify = async () => {
    if (!verification) return;
    setStepError(null);

    const frame = camera.captureFrame();
    if (!frame) {
      setStepError('The camera is not ready yet. Wait for the preview, then capture again.');
      return;
    }
    setFlash(true);
    setTimeout(() => setFlash(false), 220);

    try {
      const result = await faceVerify.mutateAsync({
        verificationId: verification.verificationId,
        image: frame,
      });
      setFaceResult(result);
      if (result.verified) {
        setStage(livenessRequired ? 'liveness' : blinkRequired ? 'blink' : 'mark');
        return;
      }
      setAttempts((current) => current + 1);
      setStepError(
        `The face match score ${formatScore(result.similarity)} was below the required ${formatScore(
          result.threshold,
        )}. Check your lighting, remove anything covering your face and try again.`,
      );
    } catch (error) {
      setAttempts((current) => current + 1);
      fail(error, 'face');
    }
  };

  const runFrameChallenge = async (kind: 'liveness' | 'blink') => {
    if (!verification) return;
    setStepError(null);
    setFrames([]);

    const count = kind === 'liveness' ? LIVENESS_FRAME_COUNT : BLINK_FRAME_COUNT;
    const captured = await camera.captureFrames(count, FRAME_INTERVAL_MS);
    setFrames(captured);

    if (captured.length < MIN_FRAMES) {
      setStepError(
        `Only ${captured.length} frames could be captured - at least ${MIN_FRAMES} are required. Make sure the camera preview is live and try again.`,
      );
      return;
    }

    try {
      const result =
        kind === 'liveness'
          ? await livenessVerify.mutateAsync({
              verificationId: verification.verificationId,
              frames: captured,
            })
          : await blinkVerify.mutateAsync({
              verificationId: verification.verificationId,
              frames: captured,
            });

      if (result.verified) {
        setStage(kind === 'liveness' ? (blinkRequired ? 'blink' : 'mark') : 'mark');
        return;
      }

      setAttempts((current) => current + 1);
      setStepError(
        kind === 'liveness'
          ? 'The head-movement challenge was not detected clearly. Keep your face in frame and follow the on-screen direction.'
          : 'No natural blink was detected. Look at the camera and blink normally a couple of times.',
      );
    } catch (error) {
      setAttempts((current) => current + 1);
      fail(error, kind);
    }
  };

  const runMark = async () => {
    if (!verification) return;
    setStepError(null);
    try {
      const created = await markAttendance.mutateAsync(verification.verificationId);
      setRecord(created);
      setStage('complete');
      toast.success(
        'Attendance marked',
        `${created.status} recorded for ${session.subject?.name ?? 'this class'}.`,
      );
      onCompleted?.(created);
    } catch (error) {
      fail(error, 'mark');
    }
  };

  const restart = () => {
    setStage('location');
    setVerification(null);
    setFaceResult(null);
    setRecord(null);
    setAttempts(0);
    setStepError(null);
    setBlock(null);
    setFrames([]);
    geolocation.reset();
  };

  const exhausted = attempts >= maxAttempts;

  useEffect(() => {
    if (exhausted && stage !== 'complete' && stage !== 'blocked') {
      setBlock({
        title: 'Attempt limit reached',
        message: `You have used all ${maxAttempts} verification attempts for this session. Your teacher can review the situation - the record cannot be forced from this device.`,
        retryable: false,
      });
      setStage('blocked');
    }
  }, [exhausted, maxAttempts, stage]);

  const steps: StepIndicatorItem[] = useMemo(() => {
    const stateFor = (id: Stage): StepState => {
      if (stage === 'complete') return 'done';
      if (stage === 'blocked') return id === 'location' ? 'done' : 'failed';
      const order: Stage[] = [
        'location',
        'face',
        ...(livenessRequired ? (['liveness'] as Stage[]) : []),
        ...(blinkRequired ? (['blink'] as Stage[]) : []),
        'mark',
      ];
      const currentIndex = order.indexOf(stage);
      const thisIndex = order.indexOf(id);
      if (thisIndex < currentIndex) return 'done';
      if (thisIndex === currentIndex) return busy ? 'working' : 'current';
      return 'pending';
    };

    const items: StepIndicatorItem[] = [
      {
        id: 'location',
        label: 'Location check',
        description: verification
          ? `${formatDistance(verification.distanceMeters)} from the room centre (limit ${formatDistance(verification.allowedRadiusMeters)})`
          : 'Confirms you are inside the classroom geofence',
        state: stateFor('location'),
      },
      {
        id: 'face',
        label: 'Face match',
        description: faceResult
          ? `Score ${formatScore(faceResult.similarity)} vs required ${formatScore(faceResult.threshold)}`
          : 'Compares a camera frame with your enrolled face profile',
        state: stateFor('face'),
      },
    ];

    if (livenessRequired) {
      items.push({
        id: 'liveness',
        label: 'Liveness challenge',
        description:
          turnInstructions.length > 0
            ? `Turn your head ${turnInstructions.join(', then ')} while ${LIVENESS_FRAME_COUNT} frames are captured`
            : `Follow the head-turn instruction while ${LIVENESS_FRAME_COUNT} frames are captured`,
        state: stateFor('liveness'),
      });
    }

    if (blinkRequired) {
      items.push({
        id: 'blink',
        label: 'Blink detection',
        description: `Blink naturally while ${BLINK_FRAME_COUNT} frames are captured`,
        state: stateFor('blink'),
      });
    }

    items.push({
      id: 'mark',
      label: 'Record attendance',
      description: 'The backend writes your mark only after every check passes',
      state: stateFor('mark'),
    });

    return items;
  }, [stage, busy, verification, faceResult, livenessRequired, blinkRequired, turnInstructions]);

  /* ------------------------------ rendering ------------------------------ */

  if (stage === 'complete' && record) {
    return (
      <Card>
        <CardBody>
          <div className="stack stack-4" style={{ textAlign: 'center', alignItems: 'center' }}>
            <span className="pipeline-done" aria-hidden="true">
              <CalendarCheck2 size={30} />
            </span>
            <div className="stack stack-2">
              <h2 className="section-title">Attendance recorded</h2>
              <p className="text-body">
                You are marked <strong>{record.status}</strong> for{' '}
                <strong>{session.subject?.name ?? 'this class'}</strong> at{' '}
                {formatTime(record.markedAt)}.
              </p>
            </div>

            <div
              className="row"
              style={{ gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}
            >
              <Badge tone="success" icon={<MapPin size={12} />}>
                Location verified
              </Badge>
              <Badge tone="success" icon={<ScanFace size={12} />}>
                Face matched {faceResult ? formatScore(faceResult.similarity) : ''}
              </Badge>
              {record.livenessVerified ? (
                <Badge tone="success" icon={<ShieldCheck size={12} />}>
                  Liveness passed
                </Badge>
              ) : null}
              {record.blinkVerified ? (
                <Badge tone="success" icon={<Eye size={12} />}>
                  Blink detected
                </Badge>
              ) : null}
            </div>

            <div
              className="row"
              style={{ gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}
            >
              <ButtonLink to={paths.student.attendance} variant="secondary">
                View my attendance
              </ButtonLink>
              <ButtonLink to={paths.student.attendanceHistory} variant="ghost">
                Full history
              </ButtonLink>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (stage === 'blocked' && block) {
    return (
      <Card>
        <CardBody>
          <div className="stack stack-4">
            <Alert
              tone={block.retryable ? 'warning' : 'error'}
              title={block.title}
              icon={<AlertTriangle size={17} />}
            >
              {block.message}
              {block.code ? (
                <>
                  {' '}
                  <span className="text-caption text-mono">({block.code})</span>
                </>
              ) : null}
            </Alert>

            {block.code === 'FACE_NOT_ENROLLED' ? (
              <ButtonLink to={paths.student.face} icon={<ScanFace size={16} />}>
                Enrol my face now
              </ButtonLink>
            ) : null}

            {block.retryable ? (
              <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={restart}>
                Start again
              </Button>
            ) : (
              <p className="text-caption">
                Still stuck? Your teacher sees this session’s roster and can advise. Attendance can
                only be written by the backend after a successful verification.
              </p>
            )}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="stack stack-4">
      <Card>
        <CardBody>
          <StepIndicator steps={steps} />
        </CardBody>
      </Card>

      {verification ? (
        <Alert
          tone={remainingMs < 60_000 ? 'warning' : 'info'}
          title="Verification window"
          icon={<Timer size={17} />}
        >
          This attempt expires in <strong>{formatRemaining(remainingMs)}</strong>. Complete the
          remaining checks before then, or start again.
          {attempts > 0 ? ` Attempts used: ${attempts} of ${maxAttempts}.` : ''}
        </Alert>
      ) : null}

      {stepError ? (
        <Alert tone="error" title="This step did not pass" icon={<AlertTriangle size={17} />}>
          {stepError}
        </Alert>
      ) : null}

      {stage === 'location' ? (
        <Card>
          <CardBody>
            <div className="stack stack-4">
              <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
                <span className="pipeline-icon" aria-hidden="true">
                  <Crosshair size={18} />
                </span>
                <div>
                  <h2 className="section-title">Confirm you are in the room</h2>
                  <p className="text-caption">
                    Your browser will ask for location permission. The coordinates are sent to the
                    backend, which measures the distance to{' '}
                    {session.classroom?.name ?? 'the classroom'} and decides whether you are inside
                    the geofence.
                  </p>
                </div>
              </div>

              {geolocation.location ? (
                <p className="text-caption text-mono">
                  Last reading: {geolocation.location.latitude.toFixed(5)},{' '}
                  {geolocation.location.longitude.toFixed(5)} (±
                  {formatDistance(geolocation.location.accuracyMeters)})
                </p>
              ) : null}

              {geolocation.error ? <Alert tone="warning">{geolocation.error}</Alert> : null}

              <Button
                icon={<MapPin size={16} />}
                onClick={() => void runLocationCheck()}
                isLoading={busy}
                loadingText="Checking location…"
              >
                Check my location
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {stage === 'face' || stage === 'liveness' || stage === 'blink' ? (
        <Card>
          <CardBody>
            <div className="stack stack-4">
              <CameraViewport
                videoRef={camera.videoRef}
                status={camera.status}
                error={camera.error}
                busy={busy}
                onStart={() => void camera.start()}
                onRetry={() => void camera.retry()}
                instruction={
                  stage === 'face' ? (
                    <>
                      <ScanFace size={16} aria-hidden="true" /> Position your face in the outline
                      and capture a frame
                    </>
                  ) : stage === 'liveness' ? (
                    <>
                      <ShieldCheck size={16} aria-hidden="true" />
                      {turnInstructions.length > 0
                        ? ` Turn your head ${turnInstructions.join(', then ')} and hold still`
                        : ' Follow the head-turn instruction and hold still'}
                    </>
                  ) : (
                    <>
                      <Eye size={16} aria-hidden="true" /> Look at the camera and blink naturally
                      twice
                    </>
                  )
                }
                overlay={
                  <>
                    <span
                      className={`camera__face-guide${faceResult?.verified ? ' camera__face-guide--active' : ''}`}
                    />
                    <span className="camera__badge">
                      {stage === 'face'
                        ? 'Face match'
                        : stage === 'liveness'
                          ? 'Liveness challenge'
                          : 'Blink detection'}
                    </span>
                    {flash ? <span className="camera__flash" aria-hidden="true" /> : null}
                  </>
                }
                caption={
                  stage === 'face'
                    ? 'Frames are downscaled in your browser and analysed by the server - never locally.'
                    : frames.length > 0
                      ? `${frames.length} frames captured and sent for analysis.`
                      : `About ${Math.round(
                          ((stage === 'liveness' ? LIVENESS_FRAME_COUNT : BLINK_FRAME_COUNT) *
                            FRAME_INTERVAL_MS) /
                            1000,
                        )} seconds of capture. Keep your face in frame the whole time.`
                }
              />

              {frames.length > 0 ? (
                <div className="camera__frames" aria-label="Captured frames">
                  {frames.slice(0, 6).map((frame, index) => (
                    // The data URLs are ephemeral captures from this device.
                    <img
                      className="camera__frame"
                      src={frame}
                      alt={`Captured frame ${index + 1}`}
                      key={index}
                    />
                  ))}
                  {frames.length > 6 ? (
                    <span className="text-caption">+{frames.length - 6} more</span>
                  ) : null}
                </div>
              ) : null}

              <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {stage === 'face' ? (
                  <Button
                    icon={<ScanFace size={16} />}
                    onClick={() => void runFaceVerify()}
                    isLoading={faceVerify.isPending}
                    loadingText="Matching face…"
                    disabled={camera.status !== 'ready' || exhausted}
                  >
                    Capture and verify
                  </Button>
                ) : stage === 'liveness' ? (
                  <Button
                    icon={<ShieldCheck size={16} />}
                    onClick={() => void runFrameChallenge('liveness')}
                    isLoading={livenessVerify.isPending}
                    loadingText="Analysing movement…"
                    disabled={camera.status !== 'ready' || exhausted}
                  >
                    Start head-turn check
                  </Button>
                ) : (
                  <Button
                    icon={<Eye size={16} />}
                    onClick={() => void runFrameChallenge('blink')}
                    isLoading={blinkVerify.isPending}
                    loadingText="Analysing blinks…"
                    disabled={camera.status !== 'ready' || exhausted}
                  >
                    Start blink check
                  </Button>
                )}

                <Button
                  variant="ghost"
                  icon={<RotateCcw size={16} />}
                  onClick={restart}
                  disabled={busy}
                >
                  Start over
                </Button>
              </div>

              {exhausted ? (
                <Alert tone="warning" title="No attempts left">
                  You have used all {maxAttempts} attempts for this session.
                </Alert>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {stage === 'mark' ? (
        <Card>
          <CardBody>
            <div className="stack stack-4">
              <Alert tone="success" title="Every check passed" icon={<ShieldCheck size={17} />}>
                Location, face{verification?.livenessRequired ? ', liveness' : ''}
                {verification?.blinkRequired ? ' and blink' : ''} were accepted by the backend.
                Confirm to write your attendance record.
              </Alert>
              <Button
                icon={<CalendarCheck2 size={16} />}
                onClick={() => void runMark()}
                isLoading={markAttendance.isPending}
                loadingText="Recording attendance…"
              >
                Mark my attendance
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <p className="text-caption">
        Need help? Read{' '}
        <Link to={paths.student.attendance} className="link">
          how verification works
        </Link>{' '}
        or check your enrolment under{' '}
        <Link to={paths.student.face} className="link">
          Face enrolment
        </Link>
        .
      </p>
    </div>
  );
}

function geofenceMessage(details: unknown): string {
  if (details && typeof details === 'object') {
    const data = details as Record<string, unknown>;
    const distance = typeof data.distanceMeters === 'number' ? data.distanceMeters : undefined;
    const radius =
      typeof data.allowedRadiusMeters === 'number' ? data.allowedRadiusMeters : undefined;
    if (distance !== undefined && radius !== undefined) {
      return `You are ${formatDistance(distance)} from the classroom centre, but this session only accepts students within ${formatDistance(radius)}. Move into the room and try again.`;
    }
  }
  return 'Your measured position is outside this session’s classroom radius. Move into the room and try again.';
}
