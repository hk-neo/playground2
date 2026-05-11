import { describe, it, expect, vi } from 'vitest';
import { NetworkIsolationGuard } from '../network-isolation-guard';
import { CachePolicyManager } from '../cache-policy-manager';
import { SecureDataDisposal } from '../secure-data-disposal';
import { AuditTrailLogger } from '../audit-trail-logger';
import { AccessController } from '../access-controller';

describe('NetworkIsolationGuard', () => {
  it('should detect fetch pattern', () => {
    const guard = new NetworkIsolationGuard();
    const matches = guard.scanForPatterns('const data = fetch("/api")');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should detect XMLHttpRequest pattern', () => {
    const guard = new NetworkIsolationGuard();
    const matches = guard.scanForPatterns('const xhr = new XMLHttpRequest()');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should detect WebSocket pattern', () => {
    const guard = new NetworkIsolationGuard();
    const matches = guard.scanForPatterns('const ws = new WebSocket("ws://")');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should pass safe code', () => {
    const guard = new NetworkIsolationGuard();
    const matches = guard.scanForPatterns('const x = 1 + 2;');
    expect(matches).toHaveLength(0);
  });

  it('should generate report with violations', () => {
    const guard = new NetworkIsolationGuard();
    const report = guard.generateReport('fetch("/api")');
    expect(report.passed).toBe(false);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].severity).toBe('critical');
  });

  it('should generate passing report for safe code', () => {
    const guard = new NetworkIsolationGuard();
    const report = guard.generateReport('const x = 42;');
    expect(report.passed).toBe(true);
  });

  it('should check isCodeSafe', () => {
    const guard = new NetworkIsolationGuard();
    expect(guard.isCodeSafe('const x = 1')).toBe(true);
    expect(guard.isCodeSafe('fetch("/api")')).toBe(false);
  });
});

describe('CachePolicyManager', () => {
  it('should set and get policy', () => {
    const mgr = new CachePolicyManager();
    mgr.preventDataCaching();
    const report = mgr.verifyCacheCompliance();
    expect(report.compliant).toBe(true);
  });

  it('should detect non-compliant policy', () => {
    const mgr = new CachePolicyManager();
    mgr.setPolicy('test', { scope: 'test', maxAge: 3600, noStore: false, noCache: false });
    const report = mgr.verifyCacheCompliance();
    expect(report.compliant).toBe(false);
    expect(report.issues.length).toBeGreaterThan(0);
  });
});

describe('SecureDataDisposal', () => {
  it('should zero out ArrayBuffer', () => {
    const disposal = new SecureDataDisposal();
    const buf = new ArrayBuffer(16);
    const view = new Uint8Array(buf);
    view.fill(255);

    disposal.secureDelete(buf);

    for (let i = 0; i < view.length; i++) {
      expect(view[i]).toBe(0);
    }
  });

  it('should clear memory region', () => {
    const disposal = new SecureDataDisposal();
    const buf = new ArrayBuffer(16);
    const view = new Uint8Array(buf);
    view.fill(255);

    disposal.clearMemoryRegion(buf, 4, 8);

    for (let i = 0; i < 4; i++) expect(view[i]).toBe(255);
    for (let i = 4; i < 12; i++) expect(view[i]).toBe(0);
    for (let i = 12; i < 16; i++) expect(view[i]).toBe(255);
  });

  it('should schedule and flush disposal', () => {
    const disposal = new SecureDataDisposal();
    const buf = new ArrayBuffer(8);
    new Uint8Array(buf).fill(99);

    disposal.scheduleDisposal(buf);
    expect(disposal.getScheduledCount()).toBe(1);

    disposal.flushScheduled();
    expect(disposal.getScheduledCount()).toBe(0);
  });
});

describe('AuditTrailLogger', () => {
  it('should log change entries', () => {
    const logger = new AuditTrailLogger();
    logger.logChange({
      timestamp: new Date(),
      action: 'volume_load',
      details: 'Loaded 500 slices',
      userId: 'local',
    });
    expect(logger.getEntryCount()).toBe(1);
  });

  it('should respect max entries', () => {
    const logger = new AuditTrailLogger(3);
    for (let i = 0; i < 5; i++) {
      logger.logChange({ timestamp: new Date(), action: `action_${i}`, details: '', userId: 'test' });
    }
    expect(logger.getEntryCount()).toBe(3);
    expect(logger.getLastEntry()?.action).toBe('action_4');
  });

  it('should generate V&V checklist', () => {
    const logger = new AuditTrailLogger();
    const checklist = logger.generateVVChecklist();
    expect(checklist.items.length).toBeGreaterThan(0);
    expect(checklist.version).toBeTruthy();
  });

  it('should export log', () => {
    const logger = new AuditTrailLogger();
    logger.logChange({ timestamp: new Date(), action: 'test', details: 'desc', userId: 'u1' });
    const log = logger.exportLog();
    expect(log).toHaveLength(1);
    expect(log[0].action).toBe('test');
  });

  it('should verify integrity', () => {
    const logger = new AuditTrailLogger();
    expect(logger.verifyIntegrity()).toBe(false);
    logger.logChange({ timestamp: new Date(), action: 'init', details: '', userId: 'system' });
    expect(logger.verifyIntegrity()).toBe(true);
  });

  it('should clear log', () => {
    const logger = new AuditTrailLogger();
    logger.logChange({ timestamp: new Date(), action: 'test', details: '', userId: 'u' });
    logger.clear();
    expect(logger.getEntryCount()).toBe(0);
  });
});

describe('AccessController', () => {
  it('should validate DICOM file access', () => {
    const ctrl = new AccessController();
    const file = new File([], 'test.dcm', { type: 'application/dicom' });
    expect(ctrl.validateFileAccess(file)).toBe(true);
  });

  it('should reject non-DICOM files', () => {
    const ctrl = new AccessController();
    const file = new File([], 'test.txt');
    expect(ctrl.validateFileAccess(file)).toBe(false);
  });

  it('should check isDicomFile', () => {
    const ctrl = new AccessController();
    expect(ctrl.isDicomFile(new File([], 'scan.DCM'))).toBe(true);
    expect(ctrl.isDicomFile(new File([], 'scan.dcm'))).toBe(true);
    expect(ctrl.isDicomFile(new File([], 'scan.txt'))).toBe(false);
  });
});
