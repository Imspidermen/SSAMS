/**
 * Geofencing utilities. Distance is computed server-side using the Haversine
 * formula - the frontend-reported location is NEVER trusted on its own.
 */

const EARTH_RADIUS_METERS = 6371000;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in meters. */
export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

export interface GeofenceCheckInput {
  studentLocation: Coordinates;
  classroomLocation: Coordinates;
  radiusMeters: number;
  accuracyMeters?: number;
}

export interface GeofenceCheckResult {
  withinGeofence: boolean;
  distanceMeters: number;
}

/**
 * Validates whether a reported location is within a classroom's geofence.
 * Accounts for the device-reported GPS accuracy by granting a small
 * tolerance (never more than the device's own accuracy radius) so that
 * legitimate students near the edge are not unfairly rejected, while still
 * requiring the location to be fundamentally plausible.
 */
export function checkGeofence(input: GeofenceCheckInput): GeofenceCheckResult {
  const distanceMeters = haversineDistanceMeters(input.studentLocation, input.classroomLocation);
  const tolerance = Math.min(input.accuracyMeters ?? 0, 30);
  const effectiveRadius = input.radiusMeters + tolerance;
  return {
    withinGeofence: distanceMeters <= effectiveRadius,
    distanceMeters,
  };
}

/** Basic plausibility checks for a GPS reading reported by a browser. */
export function isPlausibleLocation(
  latitude: number,
  longitude: number,
  accuracyMeters: number,
  timestampMs: number,
  maxAgeMs = 60_000,
  maxAccuracyMeters = 150,
): { valid: boolean; reason?: string } {
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return { valid: false, reason: 'Invalid coordinates' };
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { valid: false, reason: 'Coordinates out of range' };
  }
  if (!accuracyMeters || accuracyMeters <= 0 || accuracyMeters > maxAccuracyMeters) {
    return { valid: false, reason: 'Location accuracy too low' };
  }
  const age = Date.now() - timestampMs;
  if (age > maxAgeMs || age < -10_000) {
    return { valid: false, reason: 'Location reading is stale or invalid' };
  }
  return { valid: true };
}
