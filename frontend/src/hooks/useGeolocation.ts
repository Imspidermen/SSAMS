import { useCallback, useRef, useState } from 'react';
import type { LocationCheckRequest } from '@/types';

export type GeolocationStatus = 'idle' | 'locating' | 'success' | 'error' | 'unsupported';

export type StudentLocation = Pick<
  LocationCheckRequest,
  'latitude' | 'longitude' | 'accuracyMeters' | 'timestamp'
>;

export interface UseGeolocationResult {
  status: GeolocationStatus;
  location: StudentLocation | null;
  error: string | null;
  isSupported: boolean;
  locate: () => Promise<StudentLocation | null>;
  reset: () => void;
}

function describePositionError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission was denied. The attendance geofence needs your approximate location - enable it in your browser settings and try again.';
    case error.POSITION_UNAVAILABLE:
      return 'Your location could not be determined. Move near a window or connect to Wi-Fi, then try again.';
    case error.TIMEOUT:
      return 'Getting your location took too long. Please try again.';
    default:
      return error.message || 'Unable to read your location.';
  }
}

/**
 * One-shot high-accuracy geolocation read used by the attendance geofence
 * check. The raw coordinates are sent to the backend, which decides whether the
 * student is inside the classroom radius - the client never makes that call.
 */
export function useGeolocation(): UseGeolocationResult {
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [location, setLocation] = useState<StudentLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const reset = useCallback(() => {
    setStatus('idle');
    setLocation(null);
    setError(null);
  }, []);

  const locate = useCallback(async (): Promise<StudentLocation | null> => {
    if (!isSupported) {
      setStatus('unsupported');
      setError(
        'This browser does not expose a location API, so the classroom geofence cannot be verified.',
      );
      return null;
    }
    if (inFlight.current) return null;
    inFlight.current = true;
    setStatus('locating');
    setError(null);

    return new Promise<StudentLocation | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          inFlight.current = false;
          const next: StudentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            // The backend rejects non-positive accuracy, so clamp to 1 m.
            accuracyMeters: Math.max(1, position.coords.accuracy ?? 1),
            timestamp: position.timestamp || Date.now(),
          };
          setLocation(next);
          setStatus('success');
          resolve(next);
        },
        (positionError) => {
          inFlight.current = false;
          setLocation(null);
          setStatus('error');
          setError(describePositionError(positionError));
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 0,
        },
      );
    });
  }, [isSupported]);

  return { status, location, error, isSupported, locate, reset };
}
