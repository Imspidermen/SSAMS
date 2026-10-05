import { describe, it, expect } from 'vitest';
import { haversineDistanceMeters, checkGeofence, isPlausibleLocation } from '../src/utils/geo';

describe('haversineDistanceMeters', () => {
  it('returns ~0 for identical coordinates', () => {
    const d = haversineDistanceMeters(
      { latitude: 28.6139, longitude: 77.209 },
      { latitude: 28.6139, longitude: 77.209 },
    );
    expect(d).toBeLessThan(0.001);
  });

  it('computes a known distance between two cities within 1% tolerance', () => {
    // Delhi to Agra ~ 183 km great-circle
    const d = haversineDistanceMeters(
      { latitude: 28.6139, longitude: 77.209 },
      { latitude: 27.1767, longitude: 78.0081 },
    );
    expect(d / 1000).toBeGreaterThan(170);
    expect(d / 1000).toBeLessThan(190);
  });
});

describe('checkGeofence', () => {
  const classroom = { latitude: 28.6139, longitude: 77.209 };

  it('allows attendance within the radius', () => {
    const result = checkGeofence({
      studentLocation: { latitude: 28.614, longitude: 77.2091 }, // ~15m away
      classroomLocation: classroom,
      radiusMeters: 100,
      accuracyMeters: 10,
    });
    expect(result.withinGeofence).toBe(true);
  });

  it('rejects attendance outside the radius', () => {
    const result = checkGeofence({
      studentLocation: { latitude: 28.63, longitude: 77.25 }, // ~3-4km away
      classroomLocation: classroom,
      radiusMeters: 100,
      accuracyMeters: 10,
    });
    expect(result.withinGeofence).toBe(false);
  });

  it('grants limited tolerance for GPS accuracy at the edge, but not unlimited', () => {
    // ~120m away with 50m claimed accuracy -> tolerance capped at 30m -> still outside 100m radius
    const result = checkGeofence({
      studentLocation: { latitude: 28.615, longitude: 77.209 },
      classroomLocation: classroom,
      radiusMeters: 100,
      accuracyMeters: 500, // should be capped, not trusted blindly
    });
    expect(result.distanceMeters).toBeGreaterThan(100);
  });
});

describe('isPlausibleLocation', () => {
  it('accepts a fresh, accurate reading', () => {
    const result = isPlausibleLocation(28.6139, 77.209, 15, Date.now());
    expect(result.valid).toBe(true);
  });

  it('rejects out-of-range coordinates', () => {
    expect(isPlausibleLocation(200, 77.209, 15, Date.now()).valid).toBe(false);
  });

  it('rejects stale readings older than the max age', () => {
    const result = isPlausibleLocation(28.6139, 77.209, 15, Date.now() - 5 * 60_000);
    expect(result.valid).toBe(false);
  });

  it('rejects implausibly poor accuracy', () => {
    const result = isPlausibleLocation(28.6139, 77.209, 5000, Date.now());
    expect(result.valid).toBe(false);
  });
});
