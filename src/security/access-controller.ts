const ALLOWED_EXTENSIONS = ['.dcm', '.DCM', '.dicom', '.DIC'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export class AccessController {
  validateFileAccess(file: File): boolean {
    const ext = file.name.substring(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      return false;
    }
    return true;
  }

  restrictToLocalStorage(): void {
    // Prevent IndexedDB storage of patient data
    if (typeof indexedDB !== 'undefined') {
      try {
        indexedDB.deleteDatabase('patient_data');
      } catch {}
    }
  }

  preventUnauthorizedAccess(): void {
    // Clear any sensitive data from window object
    if (typeof window !== 'undefined') {
      delete (window as any).__patientData__;
      delete (window as any).__volumeData__;
    }
  }

  isDicomFile(file: File): boolean {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    return ext === '.dcm' || ext === '.dicom';
  }
}
