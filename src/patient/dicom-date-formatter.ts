import { DateParseError } from '../shared/errors/patient';

export class DicomDateFormatter {
  parseDicomDate(da: string): Date | null {
    if (!da || da.length < 8) {
      if (da) throw new DateParseError(da);
      return null;
    }

    const year = parseInt(da.substring(0, 4), 10);
    const month = parseInt(da.substring(4, 6), 10) - 1;
    const day = parseInt(da.substring(6, 8), 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      throw new DateParseError(da);
    }

    return new Date(year, month, day);
  }

  parseDicomTime(tm: string): Date | null {
    if (!tm || tm.length < 6) {
      if (tm) throw new DateParseError(tm);
      return null;
    }

    const hours = parseInt(tm.substring(0, 2), 10);
    const minutes = parseInt(tm.substring(2, 4), 10);
    const seconds = parseInt(tm.substring(4, 6), 10);

    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      throw new DateParseError(tm);
    }

    const d = new Date();
    d.setHours(hours, minutes, seconds, 0);
    return d;
  }

  formatDate(date: Date, format: string): string {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }
}
