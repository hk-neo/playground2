import type { PatientInfo, PatientDataListener, PatientSession } from '../types/patient';
import type { DicomTags } from '../types/patient';

/** 환자 데이터 제공 추상화 */
export interface IPatientDataProvider {
  loadFromDicom(tags: DicomTags): PatientInfo;
  getCurrentPatient(): PatientInfo | null;
  switchPatient(newPatient: PatientInfo): void;
  clearSession(): void;
  onPatientChange(callback: PatientDataListener): void;
}

/** 세션 관리 추상화 */
export interface ISessionManager {
  createSession(patient: PatientInfo): string;
  activateSession(sessionId: string): void;
  destroySession(sessionId: string): void;
  isSessionActive(sessionId: string): boolean;
}
