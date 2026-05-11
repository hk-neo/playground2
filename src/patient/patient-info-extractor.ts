import type { PatientInfo } from '../shared/types/patient';
import type { DicomTags } from '../shared/types/patient';
import { DicomDateFormatter } from './dicom-date-formatter';

export class PatientInfoExtractor {
  private dateFormatter = new DicomDateFormatter();

  extractPatientName(tags: DicomTags): string {
    const tag = tags.get('00100010');
    if (!tag || !tag.value) return 'Unknown';
    const raw = String(tag.value);
    return this.formatPatientName(raw);
  }

  extractPatientID(tags: DicomTags): string {
    const tag = tags.get('00100020');
    return tag?.value ? String(tag.value) : 'Unknown';
  }

  extractBirthDate(tags: DicomTags): Date | null {
    const tag = tags.get('00100030');
    if (!tag?.value) return null;
    try {
      return this.dateFormatter.parseDicomDate(String(tag.value));
    } catch {
      return null;
    }
  }

  extractStudyDate(tags: DicomTags): Date | null {
    const tag = tags.get('00080020');
    if (!tag?.value) return null;
    try {
      return this.dateFormatter.parseDicomDate(String(tag.value));
    } catch {
      return null;
    }
  }

  extractModality(tags: DicomTags): string {
    const tag = tags.get('00080060');
    return tag?.value ? String(tag.value) : '';
  }

  extractStudyDescription(tags: DicomTags): string {
    const tag = tags.get('00081030');
    return tag?.value ? String(tag.value) : '';
  }

  extractSeriesDescription(tags: DicomTags): string {
    const tag = tags.get('0008103e');
    return tag?.value ? String(tag.value) : '';
  }

  extractAll(tags: DicomTags): PatientInfo {
    return {
      patientName: this.extractPatientName(tags),
      patientID: this.extractPatientID(tags),
      birthDate: this.extractBirthDate(tags),
      studyDate: this.extractStudyDate(tags),
      modality: this.extractModality(tags),
      studyDescription: this.extractStudyDescription(tags),
      seriesDescription: this.extractSeriesDescription(tags),
      additionalTags: new Map(),
    };
  }

  private formatPatientName(raw: string): string {
    // DICOM PN VR: LastName^FirstName^MiddleName^Prefix^Suffix
    if (raw.includes('^')) {
      const parts = raw.split('^');
      const names = [parts[1], parts[0]].filter(Boolean);
      return names.join(' ');
    }
    return raw.trim();
  }
}
