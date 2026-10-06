import { useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Fingerprint,
  Info,
  Lightbulb,
  Plus,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/StateBlock';
import { CameraViewport } from '@/components/attendance/CameraViewport';
import { PageHeader } from '@/components/common/PageHeader';
import { DefinitionList } from '@/components/common/DefinitionList';
import { LiveRegion } from '@/components/common/LiveRegion';
import { useToast } from '@/hooks/useToast';
import { useCamera } from '@/hooks/useCamera';
import { useEnrollFace, useFaceStatus } from '@/hooks/queries/useStudentQueries';
import { useHealth } from '@/hooks/queries/useHealthQuery';
import { faceStatusMeta } from '@/utils/attendance';
import { describeApiError, isApiError } from '@/utils/apiError';
import { ENROLLMENT_SAMPLE_COUNT } from '@/utils/constants';
import { formatDate, formatNumber } from '@/utils/format';

const MIN_SAMPLES = 3;
const MAX_SAMPLES = 10;

/**
 * Face enrolment - the student's biometric identity in this system.
 *
 *   GET  /face/status -> NOT_ENROLLED | PENDING | ENROLLED | RESET
 *   POST /face/enroll -> 3..10 base64 frames, analysed by the CV service
 *
 * Only numeric embeddings are stored server-side; raw images are never
 * persisted, so there is no "profile photo" to upload or delete. Re-enrolment
 * requires an administrator to reset the profile
 * (POST /face/reset/:studentId is ADMIN-only), which is stated here instead of
 * offering a control the student is not allowed to use.
 */
export function FaceEnrollmentPage() {
  const toast = useToast();
  const status = useFaceStatus();
  const health = useHealth();
  const enroll = useEnrollFace();
  const camera = useCamera({ facingMode: 'user' });

  const [samples, setSamples] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const enrolled = status.data?.status === 'ENROLLED';

  // Release the camera when enrolment completes or the profile is already set.
  useEffect(() => {
    if (enrolled) {
      camera.stop();
      setSamples([]);
    }
    // camera.stop is a stable callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrolled]);

  const addSample = () => {
    setFormError(null);
    const frame = camera.captureFrame();
    if (!frame) {
      setFormError('The camera is not ready yet. Wait for the live preview, then capture again.');
      return;
    }
    setSamples((current) => (current.length >= MAX_SAMPLES ? current : [...current, frame]));
  };

  const removeSample = (index: number) =>
    setSamples((current) => current.filter((_, position) => position !== index));

  const captureBurst = async () => {
    setFormError(null);
    const captured = await camera.captureFrames(ENROLLMENT_SAMPLE_COUNT, 320);
    if (captured.length < MIN_SAMPLES) {
      setFormError(
        `Only ${captured.length} samples could be captured - at least ${MIN_SAMPLES} are required. Make sure the preview is live.`,
      );
      return;
    }
    setSamples((current) => [...current, ...captured].slice(0, MAX_SAMPLES));
  };

  const submit = async () => {
    setFormError(null);
    try {
      const result = await enroll.mutateAsync(samples);
      toast.success(
        'Face enrolled',
        `Your face profile is active with ${formatNumber(result.sampleCount)} samples. You can now mark attendance.`,
      );
      setSamples([]);
      camera.stop();
    } catch (error) {
      const message = describeApiError(error);
      setFormError(message);
      if (isApiError(error)) {
        switch (error.code) {
          case 'FACE_ALREADY_ENROLLED':
            toast.warning(
              'Already enrolled',
              'An administrator must reset your profile before you can enrol again.',
            );
            break;
          case 'AI_SERVICE_UNAVAILABLE':
          case 'AI_SERVICE_ERROR':
            toast.error(
              'Verification service unavailable',
              'Face analysis could not run. Try again in a few minutes.',
            );
            break;
          case 'MULTIPLE_FACES':
            toast.error(
              'Multiple faces detected',
              'Make sure only your face is visible in the frame.',
            );
            break;
          default:
            toast.error('Enrolment failed', message);
        }
      }
    }
  };

  const meta = faceStatusMeta(status.data?.status ?? 'NOT_ENROLLED');
  const enoughSamples = samples.length >= MIN_SAMPLES;

  return (
    <>
      <PageHeader
        title="Face enrolment"
        subtitle="Your face profile is how the system proves it is really you marking attendance."
        actions={
          status.data ? (
            <Badge tone={meta.tone} dot size="lg">
              {meta.label}
            </Badge>
          ) : undefined
        }
      />

      {health.data?.dependencies.aiService === 'down' ? (
        <Alert tone="error" title="Face analysis service is down">
          The CV service that extracts face embeddings is not responding, so enrolment and
          attendance verification cannot run right now. Nothing is lost - try again once it
          recovers.
        </Alert>
      ) : null}

      <div className="profile-columns">
        <div className="stack stack-4">
          <Card>
            <CardHeader
              title="Enrolment status"
              subtitle="Read from GET /api/face/status."
              headingLevel={2}
              actions={<Fingerprint size={17} aria-hidden="true" />}
            />
            <CardBody>
              {status.isPending ? (
                <div className="stack stack-3">
                  <Skeleton width="50%" height="1.5rem" />
                  <Skeleton width="80%" height="1rem" />
                </div>
              ) : status.isError ? (
                <ErrorState error={status.error} onRetry={() => void status.refetch()} />
              ) : (
                <div className="stack stack-4">
                  <DefinitionList
                    stacked
                    items={[
                      {
                        term: 'Status',
                        value: (
                          <Badge tone={meta.tone} dot>
                            {meta.label}
                          </Badge>
                        ),
                      },
                      {
                        term: 'Samples stored',
                        value: formatNumber(status.data?.sampleCount ?? 0),
                      },
                      {
                        term: 'Enrolled on',
                        value: status.data?.enrolledAt
                          ? formatDate(status.data.enrolledAt)
                          : 'Not enrolled yet',
                      },
                    ]}
                  />

                  {enrolled ? (
                    <Alert
                      tone="success"
                      title="You are ready to mark attendance"
                      icon={<CheckCircle2 size={17} />}
                    >
                      Your face profile is active. Every session will match a live camera frame
                      against it before recording your attendance.
                    </Alert>
                  ) : (
                    <Alert tone="warning" title="Enrolment required" icon={<Info size={17} />}>
                      Until your face is enrolled the backend rejects attendance verification with{' '}
                      <code className="text-mono">FACE_NOT_ENROLLED</code>. Use the camera below to
                      capture {MIN_SAMPLES}–{MAX_SAMPLES} samples.
                    </Alert>
                  )}

                  {status.data?.status === 'RESET' ? (
                    <Alert tone="info" title="Your profile was reset by an administrator">
                      Capture new samples below to enrol again.
                    </Alert>
                  ) : null}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="How to get a good enrolment"
              headingLevel={2}
              actions={<Lightbulb size={17} aria-hidden="true" />}
            />
            <CardBody>
              <ul className="checklist">
                {[
                  'Face the camera in even light - avoid bright windows behind you.',
                  'Remove caps, sunglasses and anything covering your face.',
                  'Keep a neutral expression and look straight at the lens.',
                  'Hold the device about an arm’s length away, one face in frame.',
                  'Capture samples from slightly different angles for a robust profile.',
                ].map((tip) => (
                  <li className="checklist__item" key={tip}>
                    <span className="checklist__icon" aria-hidden="true">
                      <ShieldCheck size={15} />
                    </span>
                    <span className="checklist__body">{tip}</span>
                  </li>
                ))}
              </ul>
              <p className="text-caption">
                The backend rejects frames that are too dark, too bright, low quality or contain
                more than one face, so follow these tips to avoid a failed enrolment.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="stack stack-4">
          {enrolled ? (
            <Card>
              <CardBody>
                <div
                  className="stack stack-4"
                  style={{ alignItems: 'center', textAlign: 'center' }}
                >
                  <span className="pipeline-done" aria-hidden="true">
                    <ScanFace size={30} />
                  </span>
                  <div className="stack stack-2">
                    <h2 className="section-title">Face profile active</h2>
                    <p className="text-caption">
                      {formatNumber(status.data?.sampleCount ?? 0)} samples were analysed and only
                      the numeric embedding is stored. Raw images are never kept by the server, so
                      there is no photo to view or delete.
                    </p>
                  </div>
                  <Alert tone="neutral" title="Need to re-enrol?">
                    Re-enrolment is blocked while a profile is active (
                    <code className="text-mono">FACE_ALREADY_ENROLLED</code>). Ask an administrator
                    to reset your face profile - they use{' '}
                    <code className="text-mono">POST /api/face/reset/:studentId</code> - then
                    capture new samples here.
                  </Alert>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="Capture your face"
                subtitle={`${formatNumber(samples.length)} of ${MIN_SAMPLES}–${MAX_SAMPLES} samples collected.`}
                headingLevel={2}
                actions={
                  samples.length > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={15} />}
                      onClick={() => setSamples([])}
                      disabled={enroll.isPending}
                    >
                      Clear samples
                    </Button>
                  ) : undefined
                }
              />
              <CardBody>
                <div className="stack stack-4">
                  <CameraViewport
                    videoRef={camera.videoRef}
                    status={camera.status}
                    error={camera.error}
                    busy={enroll.isPending}
                    onStart={() => void camera.start()}
                    onRetry={() => void camera.retry()}
                    instruction={
                      <>
                        <ScanFace size={16} aria-hidden="true" /> Centre your face in the outline
                      </>
                    }
                    overlay={<span className="camera__face-guide" />}
                    caption="Frames are downscaled in your browser, analysed by the server and discarded - only the embedding is stored."
                  />

                  <div
                    className="row"
                    style={{ gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}
                  >
                    <Button
                      variant="secondary"
                      icon={<Camera size={16} />}
                      onClick={addSample}
                      disabled={
                        camera.status !== 'ready' ||
                        samples.length >= MAX_SAMPLES ||
                        enroll.isPending
                      }
                    >
                      Add sample
                    </Button>
                    <Button
                      variant="ghost"
                      icon={<Plus size={16} />}
                      onClick={() => void captureBurst()}
                      disabled={
                        camera.status !== 'ready' ||
                        samples.length + ENROLLMENT_SAMPLE_COUNT > MAX_SAMPLES ||
                        enroll.isPending
                      }
                    >
                      Capture {ENROLLMENT_SAMPLE_COUNT} at once
                    </Button>
                    <Button
                      icon={<Fingerprint size={16} />}
                      onClick={() => void submit()}
                      disabled={!enoughSamples || enroll.isPending}
                      isLoading={enroll.isPending}
                      loadingText="Enrolling…"
                    >
                      Enrol my face
                    </Button>
                  </div>

                  {!enoughSamples && samples.length > 0 ? (
                    <p className="text-caption" style={{ textAlign: 'center' }}>
                      Add at least {MIN_SAMPLES - samples.length} more sample
                      {MIN_SAMPLES - samples.length === 1 ? '' : 's'} to enrol.
                    </p>
                  ) : null}

                  {samples.length > 0 ? (
                    <div className="camera__frames" aria-label="Collected enrolment samples">
                      {samples.map((sample, index) => (
                        <span className="sample" key={index}>
                          <img
                            className="camera__frame"
                            src={sample}
                            alt={`Enrolment sample ${index + 1}`}
                          />
                          <IconButton
                            size="sm"
                            variant="bordered"
                            icon={<Trash2 size={13} />}
                            label={`Remove sample ${index + 1}`}
                            onClick={() => removeSample(index)}
                            disabled={enroll.isPending}
                          />
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {formError ? (
                    <Alert tone="error" title="Enrolment did not complete">
                      {formError}
                    </Alert>
                  ) : null}

                  {enroll.isError && !formError ? (
                    <Alert tone="error">{describeApiError(enroll.error)}</Alert>
                  ) : null}

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw size={15} />}
                    onClick={() => void status.refetch()}
                    disabled={status.isFetching}
                  >
                    Re-check status
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <LiveRegion>
        {status.data
          ? `Face profile status: ${meta.label}. ${formatNumber(samples.length)} samples collected.`
          : ''}
      </LiveRegion>
    </>
  );
}
