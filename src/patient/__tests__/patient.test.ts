import { describe, it, expect } from 'vitest';
import { DicomDateFormatter } from '../dicom-date-formatter';
import { PatientInfoExtractor } from '../patient-info-extractor';
import { SessionManager } from '../session-manager';
import { PatientDataManager } from '../patient-data-manager';
import { DateParseError, SessionConflictError } from '../../shared/errors/patient';
import type { DicomTags, PatientInfo } from '../../shared/types/patient';
import type { DicomTag } from '../../shared/types/dicom';

function createTags(entries: Record<string, string | number>): DicomTags {
  const map = new Map<string, DicomTag>();
  for (const [key, value] of Object.entries(entries)) {
    map.set(key, {
      group: parseInt(key.substring(0, 4), 16),
      element: parseInt(key.substring(4, 8), 16),
      vr: 'LO',
      value,
      offset: 0,
      length: 0,
    });
  }
  return map;
}

describe('DicomDateFormatter', () => {
  it('should parse DICOM DA format (YYYYMMDD)', () => {
    const fmt = new DicomDateFormatter();
    const date = fmt.parseDicomDate('19900315');
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(1990);
    expect(date!.getMonth()).toBe(2);
    expect(date!.getDate()).toBe(15);
  });

  it('should return null for empty string', () => {
    const fmt = new DicomDateFormatter();
    expect(fmt.parseDicomDate('')).toBeNull();
  });

  it('should throw DateParseError for invalid date', () => {
    const fmt = new DicomDateFormatter();
    expect(() => fmt.parseDicomDate('abcdef')).toThrow(DateParseError);
  });

  it('should parse DICOM time (HHMMSS)', () => {
    const fmt = new DicomDateFormatter();
    const date = fmt.parseDicomTime('143052');
    expect(date).not.toBeNull();
    expect(date!.getHours()).toBe(14);
    expect(date!.getMinutes()).toBe(30);
  });

  it('should format date with pattern', () => {
    const fmt = new DicomDateFormatter();
    const date = new Date(2024, 5, 15, 14, 30, 0);
    expect(fmt.formatDate(date, 'YYYY-MM-DD')).toBe('2024-06-15');
    expect(fmt.formatDate(date, 'YYYY-MM-DD HH:mm:ss')).toBe('2024-06-15 14:30:00');
  });
});

describe('PatientInfoExtractor', () => {
  it('should extract patient name (DICOM PN format)', () => {
    const extractor = new PatientInfoExtractor();
    const tags = createTags({ '00100010': 'Hong^GilDong' });
    expect(extractor.extractPatientName(tags)).toBe('GilDong Hong');
  });

  it('should return Unknown for missing name', () => {
    const extractor = new PatientInfoExtractor();
    expect(extractor.extractPatientName(new Map())).toBe('Unknown');
  });

  it('should extract patient ID', () => {
    const extractor = new PatientInfoExtractor();
    const tags = createTags({ '00100020': 'PAT001' });
    expect(extractor.extractPatientID(tags)).toBe('PAT001');
  });

  it('should extract birth date', () => {
    const extractor = new PatientInfoExtractor();
    const tags = createTags({ '00100030': '19900315' });
    const date = extractor.extractBirthDate(tags);
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(1990);
  });

  it('should extract modality', () => {
    const extractor = new PatientInfoExtractor();
    const tags = createTags({ '00080060': 'CBCT' });
    expect(extractor.extractModality(tags)).toBe('CBCT');
  });

  it('should extract all fields', () => {
    const extractor = new PatientInfoExtractor();
    const tags = createTags({
      '00100010': 'Kim^Test',
      '00100020': 'ID001',
      '00100030': '19850101',
      '00080020': '20240101',
      '00080060': 'CT',
      '00081030': 'Head Scan',
      '0008103e': 'Series 1',
    });
    const info = extractor.extractAll(tags);
    expect(info.patientName).toBe('Test Kim');
    expect(info.patientID).toBe('ID001');
    expect(info.birthDate).not.toBeNull();
    expect(info.studyDate).not.toBeNull();
    expect(info.modality).toBe('CT');
    expect(info.studyDescription).toBe('Head Scan');
    expect(info.seriesDescription).toBe('Series 1');
  });

  it('should handle plain name (no caret)', () => {
    const extractor = new PatientInfoExtractor();
    const tags = createTags({ '00100010': 'John Doe' });
    expect(extractor.extractPatientName(tags)).toBe('John Doe');
  });
});

describe('SessionManager', () => {
  it('should create and activate session', () => {
    const mgr = new SessionManager();
    const info = { patientName: 'Test', patientID: '1', birthDate: null, studyDate: null, modality: '', studyDescription: '', seriesDescription: '', additionalTags: new Map() };
    const id = mgr.createSession(info);
    mgr.activateSession(id);
    expect(mgr.isSessionActive(id)).toBe(true);
    expect(mgr.getActiveSession()).not.toBeNull();
  });

  it('should destroy session', () => {
    const mgr = new SessionManager();
    const info = { patientName: 'Test', patientID: '1', birthDate: null, studyDate: null, modality: '', studyDescription: '', seriesDescription: '', additionalTags: new Map() };
    const id = mgr.createSession(info);
    mgr.activateSession(id);
    mgr.destroySession(id);
    expect(mgr.isSessionActive(id)).toBe(false);
    expect(mgr.getActiveSession()).toBeNull();
  });

  it('should throw SessionConflictError for missing session', () => {
    const mgr = new SessionManager();
    expect(() => mgr.activateSession('nonexistent')).toThrow(SessionConflictError);
  });

  it('should clear all sessions', () => {
    const mgr = new SessionManager();
    const info = { patientName: 'Test', patientID: '1', birthDate: null, studyDate: null, modality: '', studyDescription: '', seriesDescription: '', additionalTags: new Map() };
    mgr.createSession(info);
    mgr.clear();
    expect(mgr.getActiveSession()).toBeNull();
  });
});

describe('PatientDataManager', () => {
  it('should load patient from DICOM tags', () => {
    const mgr = new PatientDataManager();
    const tags = createTags({ '00100010': 'Park^Test', '00100020': 'P001' });
    const info = mgr.loadFromDicom(tags);
    expect(info.patientName).toBe('Test Park');
    expect(info.patientID).toBe('P001');
    expect(mgr.getCurrentPatient()).toBe(info);
  });

  it('should notify listeners on patient change', () => {
    const mgr = new PatientDataManager();
    const events: [PatientInfo | null, PatientInfo | null][] = [];
    mgr.onPatientChange((patient, prev) => events.push([patient, prev]));

    const tags = createTags({ '00100020': 'P001' });
    mgr.loadFromDicom(tags);
    expect(events).toHaveLength(1);
    expect(events[0][0]?.patientID).toBe('P001');
    expect(events[0][1]).toBeNull();
  });

  it('should switch patient and notify', () => {
    const mgr = new PatientDataManager();
    const events: [PatientInfo | null, PatientInfo | null][] = [];
    mgr.onPatientChange((p, prev) => events.push([p, prev]));

    const p1 = { patientName: 'A', patientID: '1', birthDate: null, studyDate: null, modality: '', studyDescription: '', seriesDescription: '', additionalTags: new Map() };
    const p2 = { patientName: 'B', patientID: '2', birthDate: null, studyDate: null, modality: '', studyDescription: '', seriesDescription: '', additionalTags: new Map() };

    mgr.switchPatient(p1);
    mgr.switchPatient(p2);
    expect(events).toHaveLength(2);
    expect(events[1][0]?.patientName).toBe('B');
    expect(events[1][1]?.patientName).toBe('A');
  });

  it('should clear session', () => {
    const mgr = new PatientDataManager();
    const tags = createTags({ '00100020': 'P001' });
    mgr.loadFromDicom(tags);
    mgr.clearSession();
    expect(mgr.getCurrentPatient()).toBeNull();
  });

  it('should remove listener', () => {
    const mgr = new PatientDataManager();
    let count = 0;
    const cb = () => { count++; };
    mgr.onPatientChange(cb);
    mgr.removeListener(cb);

    const tags = createTags({ '00100020': 'P001' });
    mgr.loadFromDicom(tags);
    expect(count).toBe(0);
  });
});
