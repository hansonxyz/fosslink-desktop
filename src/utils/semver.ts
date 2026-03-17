/**
 * Semver Comparison Utility
 *
 * Simple MAJOR.MINOR.PATCH version comparison for the version
 * compatibility system. No external dependencies needed.
 */

export interface VersionCheckResult {
  compatible: boolean;
  peerTooOld: boolean;
  selfTooOld: boolean;
}

/**
 * Compare two semver strings (MAJOR.MINOR.PATCH).
 * Returns negative if a < b, 0 if equal, positive if a > b.
 * Returns 0 if either is undefined/invalid (fail-open for missing versions).
 */
export function compareSemver(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Check version compatibility between us and a peer.
 *
 * - peerTooOld: peer needs to upgrade (their version < our minimum requirement)
 * - selfTooOld: we need to upgrade (our version < their minimum requirement)
 *
 * If peerVersion is undefined (standard protocol peer with no version info),
 * returns all-compatible — version checks only apply to FossLink peers.
 */
export function checkVersionCompatibility(
  ourVersion: string,
  ourMinPeerVersion: string,
  peerVersion: string | undefined,
  peerMinPeerVersion: string | undefined,
): VersionCheckResult {
  if (!peerVersion) {
    return { compatible: true, peerTooOld: false, selfTooOld: false };
  }

  const peerTooOld = compareSemver(peerVersion, ourMinPeerVersion) < 0;
  const selfTooOld = peerMinPeerVersion
    ? compareSemver(ourVersion, peerMinPeerVersion) < 0
    : false;

  return {
    compatible: !peerTooOld && !selfTooOld,
    peerTooOld,
    selfTooOld,
  };
}
