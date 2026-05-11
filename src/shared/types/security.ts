/** 보안 검증 보고서 */
export interface SecurityReport {
  passed: boolean;
  violations: SecurityViolation[];
  scannedAt: Date;
}

/** 보안 위반 항목 */
export interface SecurityViolation {
  type: 'network_code' | 'cache_leak' | 'data_exposure';
  severity: 'critical' | 'warning';
  description: string;
  location: string;
}

/** 캐시 정책 */
export interface CachePolicy {
  scope: string;
  maxAge: number;
  noStore: boolean;
  noCache: boolean;
}

/** 캐시 컴플라이언스 보고서 */
export interface CacheComplianceReport {
  compliant: boolean;
  issues: string[];
}

/** 감사 로그 엔트리 */
export interface AuditEntry {
  timestamp: Date;
  action: string;
  details: string;
  userId: string;
}

/** V&V 체크리스트 */
export interface VVChecklist {
  items: VVItem[];
  version: string;
}

/** V&V 검증 항목 */
export interface VVItem {
  id: string;
  description: string;
  category: string;
  verified: boolean;
}
