import { describe, it, expect } from 'vitest';
import { classesNeededForTarget } from '../src/utils/attendanceMath';

describe('classesNeededForTarget (low-attendance projection)', () => {
  it('returns 0 when already at or above the target', () => {
    expect(classesNeededForTarget(18, 20, 75)).toBe(0); // 90%
  });

  it('computes exact classes needed to reach 75% from 68%', () => {
    // present=17, total=25 -> 68%; need x such that (17+x)/(25+x) >= 0.75
    const needed = classesNeededForTarget(17, 25, 75);
    const achieved = (17 + needed) / (25 + needed);
    expect(achieved).toBeGreaterThanOrEqual(0.75);
    const oneLess = (17 + needed - 1) / (25 + needed - 1);
    expect(oneLess).toBeLessThan(0.75);
  });

  it('handles zero total classes gracefully', () => {
    expect(classesNeededForTarget(0, 0, 75)).toBe(0);
  });

  it('returns Infinity when target is 100%', () => {
    expect(classesNeededForTarget(5, 10, 100)).toBe(Infinity);
  });
});
