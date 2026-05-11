import type {
  SecurityReport,
  CacheComplianceReport,
  AuditEntry,
  VVChecklist,
} from '../types/security';

/** 보안 검증 추상화 */
export interface ISecurityGuard {
  verifyNoNetworkCode(): SecurityReport;
  scanForPatterns(code: string): string[];
}

/** 캐시 정책 추상화 */
export interface ICachePolicy {
  preventDataCaching(): void;
  setNoCacheHeaders(): void;
  verifyCacheCompliance(): CacheComplianceReport;
}

/** 감사 추적 추상화 */
export interface IAuditTrail {
  logChange(entry: AuditEntry): void;
  generateVVChecklist(): VVChecklist;
  exportLog(): AuditEntry[];
  verifyIntegrity(): boolean;
}
