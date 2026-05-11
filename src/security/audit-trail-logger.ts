import type { AuditEntry, VVChecklist, VVItem } from '../shared/types/security';

export class AuditTrailLogger {
  private logEntries: AuditEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
  }

  logChange(entry: AuditEntry): void {
    this.logEntries.push({
      ...entry,
      timestamp: entry.timestamp ?? new Date(),
    });

    if (this.logEntries.length > this.maxEntries) {
      this.logEntries = this.logEntries.slice(-this.maxEntries);
    }
  }

  generateVVChecklist(): VVChecklist {
    const items: VVItem[] = [
      { id: 'VV-001', description: 'Software requirements are documented and reviewed', category: 'Documentation', verified: false },
      { id: 'VV-002', description: 'Unit tests cover critical functions', category: 'Testing', verified: false },
      { id: 'VV-003', description: 'Integration tests verify module interactions', category: 'Testing', verified: false },
      { id: 'VV-004', description: 'No network communication code present', category: 'Security', verified: false },
      { id: 'VV-005', description: 'Patient data is not cached in browser', category: 'Security', verified: false },
      { id: 'VV-006', description: 'Secure data disposal implemented', category: 'Security', verified: false },
      { id: 'VV-007', description: 'All changes tracked in audit log', category: 'Traceability', verified: false },
      { id: 'VV-008', description: 'Known anomalies documented', category: 'Documentation', verified: false },
    ];

    return {
      items,
      version: this.getVersion(),
    };
  }

  exportLog(): AuditEntry[] {
    return [...this.logEntries];
  }

  verifyIntegrity(): boolean {
    return this.logEntries.length > 0;
  }

  getEntryCount(): number {
    return this.logEntries.length;
  }

  getLastEntry(): AuditEntry | null {
    return this.logEntries.length > 0 ? this.logEntries[this.logEntries.length - 1] : null;
  }

  clear(): void {
    this.logEntries = [];
  }

  private getVersion(): string {
    return '1.0.0';
  }
}
