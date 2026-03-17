import { describe, it, expect } from 'vitest';
import { compareSemver, checkVersionCompatibility } from '../../../src/utils/semver.js';

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('0.1.0', '0.1.0')).toBe(0);
    expect(compareSemver('2.3.4', '2.3.4')).toBe(0);
  });

  it('returns negative when a < b (major)', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  it('returns positive when a > b (major)', () => {
    expect(compareSemver('3.0.0', '1.0.0')).toBeGreaterThan(0);
  });

  it('compares minor versions when major is equal', () => {
    expect(compareSemver('1.2.0', '1.3.0')).toBeLessThan(0);
    expect(compareSemver('1.5.0', '1.1.0')).toBeGreaterThan(0);
  });

  it('compares patch versions when major and minor are equal', () => {
    expect(compareSemver('1.0.1', '1.0.2')).toBeLessThan(0);
    expect(compareSemver('1.0.9', '1.0.3')).toBeGreaterThan(0);
  });

  it('major takes precedence over minor', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });

  it('minor takes precedence over patch', () => {
    expect(compareSemver('1.2.0', '1.1.9')).toBeGreaterThan(0);
  });

  it('returns 0 when a is undefined (fail-open)', () => {
    expect(compareSemver(undefined, '1.0.0')).toBe(0);
  });

  it('returns 0 when b is undefined (fail-open)', () => {
    expect(compareSemver('1.0.0', undefined)).toBe(0);
  });

  it('returns 0 when both are undefined', () => {
    expect(compareSemver(undefined, undefined)).toBe(0);
  });

  it('returns 0 when a is empty string (fail-open)', () => {
    expect(compareSemver('', '1.0.0')).toBe(0);
  });
});

describe('checkVersionCompatibility', () => {
  it('returns compatible when versions match exactly', () => {
    const result = checkVersionCompatibility('0.1.0', '0.1.0', '0.1.0', '0.1.0');
    expect(result.compatible).toBe(true);
    expect(result.peerTooOld).toBe(false);
    expect(result.selfTooOld).toBe(false);
  });

  it('returns compatible when both exceed minimum', () => {
    const result = checkVersionCompatibility('1.0.0', '0.1.0', '1.0.0', '0.1.0');
    expect(result.compatible).toBe(true);
    expect(result.peerTooOld).toBe(false);
    expect(result.selfTooOld).toBe(false);
  });

  it('detects peer too old', () => {
    // Our min is 0.2.0, peer is 0.1.0
    const result = checkVersionCompatibility('1.0.0', '0.2.0', '0.1.0', '0.1.0');
    expect(result.compatible).toBe(false);
    expect(result.peerTooOld).toBe(true);
    expect(result.selfTooOld).toBe(false);
  });

  it('detects self too old', () => {
    // Peer min is 0.3.0, our version is 0.2.0
    const result = checkVersionCompatibility('0.2.0', '0.1.0', '1.0.0', '0.3.0');
    expect(result.compatible).toBe(false);
    expect(result.peerTooOld).toBe(false);
    expect(result.selfTooOld).toBe(true);
  });

  it('detects both too old', () => {
    const result = checkVersionCompatibility('0.1.0', '0.5.0', '0.1.0', '0.5.0');
    expect(result.compatible).toBe(false);
    expect(result.peerTooOld).toBe(true);
    expect(result.selfTooOld).toBe(true);
  });

  it('returns compatible when peerVersion is undefined (standard KDE Connect)', () => {
    const result = checkVersionCompatibility('1.0.0', '0.1.0', undefined, undefined);
    expect(result.compatible).toBe(true);
    expect(result.peerTooOld).toBe(false);
    expect(result.selfTooOld).toBe(false);
  });

  it('returns selfTooOld=false when peerMinPeerVersion is undefined', () => {
    // Older FossLink that sends clientVersion but not minPeerVersion
    const result = checkVersionCompatibility('0.1.0', '0.1.0', '0.1.0', undefined);
    expect(result.compatible).toBe(true);
    expect(result.peerTooOld).toBe(false);
    expect(result.selfTooOld).toBe(false);
  });

  it('handles peer at exact minimum version (not too old)', () => {
    const result = checkVersionCompatibility('1.0.0', '0.2.0', '0.2.0', '0.1.0');
    expect(result.compatible).toBe(true);
    expect(result.peerTooOld).toBe(false);
  });

  it('handles self at exact minimum version (not too old)', () => {
    const result = checkVersionCompatibility('0.3.0', '0.1.0', '1.0.0', '0.3.0');
    expect(result.compatible).toBe(true);
    expect(result.selfTooOld).toBe(false);
  });
});
