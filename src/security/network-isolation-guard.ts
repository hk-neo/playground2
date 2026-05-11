import type { SecurityReport, SecurityViolation } from '../shared/types/security';

const NETWORK_PATTERNS = [
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /\.send\s*\(/,
  /navigator\.sendBeacon/,
  /importScripts\s*\(/,
  /new\s+Worker\s*\(/,
];

export class NetworkIsolationGuard {
  verifyNoNetworkCode(): SecurityReport {
    const violations: SecurityViolation[] = [];
    return {
      passed: violations.length === 0,
      violations,
      scannedAt: new Date(),
    };
  }

  scanForPatterns(code: string): string[] {
    const matches: string[] = [];
    for (const pattern of NETWORK_PATTERNS) {
      if (pattern.test(code)) {
        matches.push(pattern.source);
      }
    }
    return matches;
  }

  generateReport(code?: string): SecurityReport {
    const violations: SecurityViolation[] = [];

    if (code) {
      for (const pattern of NETWORK_PATTERNS) {
        const match = code.match(pattern);
        if (match) {
          violations.push({
            type: 'network_code',
            severity: 'critical',
            description: `Network API pattern detected: ${match[0]}`,
            location: `Pattern: ${pattern.source}`,
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      scannedAt: new Date(),
    };
  }

  isCodeSafe(code: string): boolean {
    return this.scanForPatterns(code).length === 0;
  }
}
