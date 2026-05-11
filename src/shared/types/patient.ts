import type { DicomTag } from './dicom';

/** 환자 정보 */
export interface PatientInfo {
  patientName: string;
  patientID: string;
  birthDate: Date | null;
  studyDate: Date | null;
  modality: string;
  studyDescription: string;
  seriesDescription: string;
  additionalTags: Map<string, unknown>;
}

/** 환자 세션 */
export interface PatientSession {
  id: string;
  patient: PatientInfo;
  createdAt: Date;
  volumeLoaded: boolean;
}

/** 환자 데이터 변경 리스너 */
export type PatientDataListener = (
  patient: PatientInfo | null,
  previous: PatientInfo | null,
) => void;

/** RawBuffer 타입 별칭 */
export type RawBuffer = ArrayBuffer;

/** DICOM 태그 맵 */
export type DicomTags = Map<string, DicomTag>;
