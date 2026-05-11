/** VR(Value Representation) 타입별 DICOM 값 읽기 */
export class VrValueReader {
  /** LO (Long String) 읽기 */
  readLO(bytes: ArrayBuffer): string {
    return this.decodeString(bytes);
  }

  /** PN (Person Name) 읽기 - 'LastName^FirstName^MiddleName^Prefix^Suffix' */
  readPN(bytes: ArrayBuffer): string {
    const raw = this.decodeString(bytes);
    const parts = raw.split('^');
    const lastName = parts[0] ?? '';
    const firstName = parts[1] ?? '';
    return [lastName, firstName].filter(Boolean).join(' ');
  }

  /** DA (Date) 읽기 - YYYYMMDD */
  readDA(bytes: ArrayBuffer): Date | null {
    const raw = this.decodeString(bytes);
    if (raw.length !== 8) return null;

    const year = parseInt(raw.substring(0, 4), 10);
    const month = parseInt(raw.substring(4, 6), 10) - 1;
    const day = parseInt(raw.substring(6, 8), 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(year, month, day);
  }

  /** TM (Time) 읽기 - HHMMSS.FFFFFF */
  readTM(bytes: ArrayBuffer): Date | null {
    const raw = this.decodeString(bytes);
    const hour = parseInt(raw.substring(0, 2), 10);
    const minute = parseInt(raw.substring(2, 4), 10);
    const second = parseInt(raw.substring(4, 6), 10);

    if (isNaN(hour) || isNaN(minute)) return null;
    return new Date(1970, 0, 1, hour, minute, isNaN(second) ? 0 : second);
  }

  /** UI (Unique Identifier) 읽기 */
  readUI(bytes: ArrayBuffer): string {
    return this.decodeString(bytes);
  }

  /** DS (Decimal String) 읽기 */
  readDS(bytes: ArrayBuffer): number {
    const raw = this.decodeString(bytes);
    return parseFloat(raw);
  }

  /** IS (Integer String) 읽기 */
  readIS(bytes: ArrayBuffer): number {
    const raw = this.decodeString(bytes);
    return parseInt(raw, 10);
  }

  /** ArrayBuffer를 문자열로 디코딩 (null 바이트 제거) */
  private decodeString(bytes: ArrayBuffer): string {
    const view = new Uint8Array(bytes);
    let result = '';
    for (let i = 0; i < view.length; i++) {
      if (view[i] === 0) break;
      result += String.fromCharCode(view[i]);
    }
    return result.trimEnd();
  }
}
