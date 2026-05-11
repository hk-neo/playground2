import type { PatientInfo, PatientDataListener } from '../shared/types/patient';
import type { DicomTags } from '../shared/types/patient';
import { PatientInfoExtractor } from './patient-info-extractor';
import { SessionManager } from './session-manager';

export class PatientDataManager {
  private currentPatient: PatientInfo | null = null;
  private extractor = new PatientInfoExtractor();
  private sessionManager = new SessionManager();
  private listeners: PatientDataListener[] = [];

  loadFromDicom(tags: DicomTags): PatientInfo {
    const info = this.extractor.extractAll(tags);
    this.switchPatient(info);
    return info;
  }

  getCurrentPatient(): PatientInfo | null {
    return this.currentPatient;
  }

  switchPatient(newPatient: PatientInfo): void {
    const previous = this.currentPatient;
    this.currentPatient = newPatient;

    const sessionId = this.sessionManager.createSession(newPatient);
    this.sessionManager.activateSession(sessionId);

    this.notifyListeners(newPatient, previous);
  }

  clearSession(): void {
    const previous = this.currentPatient;
    this.currentPatient = null;
    this.sessionManager.clear();
    this.notifyListeners(null, previous);
  }

  onPatientChange(callback: PatientDataListener): void {
    this.listeners.push(callback);
  }

  removeListener(callback: PatientDataListener): void {
    const idx = this.listeners.indexOf(callback);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  private notifyListeners(patient: PatientInfo | null, previous: PatientInfo | null): void {
    for (const cb of this.listeners) {
      cb(patient, previous);
    }
  }
}
