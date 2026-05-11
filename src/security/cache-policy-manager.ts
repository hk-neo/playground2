import type { CachePolicy, CacheComplianceReport } from '../shared/types/security';

export class CachePolicyManager {
  private policies = new Map<string, CachePolicy>();

  setNoCacheHeaders(): void {
    if (typeof document !== 'undefined') {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Cache-Control';
      meta.content = 'no-store, no-cache, must-revalidate';
      document.head.appendChild(meta);
    }
  }

  preventDataCaching(): void {
    this.policies.set('default', {
      scope: 'all',
      maxAge: 0,
      noStore: true,
      noCache: true,
    });
  }

  setPolicy(scope: string, policy: CachePolicy): void {
    this.policies.set(scope, policy);
  }

  getPolicy(scope: string): CachePolicy | undefined {
    return this.policies.get(scope);
  }

  verifyCacheCompliance(): CacheComplianceReport {
    const issues: string[] = [];

    for (const [scope, policy] of this.policies) {
      if (!policy.noStore) {
        issues.push(`${scope}: noStore is not enabled`);
      }
      if (!policy.noCache) {
        issues.push(`${scope}: noCache is not enabled`);
      }
    }

    return {
      compliant: issues.length === 0,
      issues,
    };
  }

  configureServiceWorker(): void {
    if ('serviceWorker' in navigator) {
      // Unregister any existing service workers to prevent caching
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const reg of registrations) {
          reg.unregister();
        }
      }).catch(() => {});
    }
  }
}
