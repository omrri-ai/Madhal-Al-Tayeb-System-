// Utilities for comprehensive Arabic Date Filtering across all report sections
// Standardized on Asia/Riyadh (UTC+3) as requested:
// - Daily (اليومي): Starts at 12:00 AM (00:00:00) Riyadh Time to 11:59:59 PM
// - Weekly (الأسبوعي): Starts Friday at 12:00 AM (00:00:00) to Thursday 11:59:59 PM
// - Monthly (الشهري): Starts on the 1st of the month at 12:00 AM (00:00:00) to the last day of the month (28, 29, 30, or 31 days) at 11:59:59 PM

export const RIYADH_TIMEZONE = 'Asia/Riyadh';
export const RIYADH_OFFSET_HOURS = 3;
export const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

export type ReportPeriod =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom'
  | 'all';

export interface DateRangeResult {
  period: ReportPeriod;
  start: Date | null;
  end: Date | null;
  startDateStr: string;
  endDateStr: string;
  label: string;
  inclusiveNote: string;
}

export interface RiyadhDateParts {
  year: number;
  month: number; // 0-11
  date: number; // 1-31
  dayOfWeek: number; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  hours: number;
  minutes: number;
  seconds: number;
  daysInMonth: number;
}

// Compute date parts in Riyadh local time (UTC+3, no DST)
export function getRiyadhParts(date: Date = new Date()): RiyadhDateParts {
  const riyadhMs = date.getTime() + RIYADH_OFFSET_MS;
  const d = new Date(riyadhMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const dateNum = d.getUTCDate();
  const dayOfWeek = d.getUTCDay();
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const seconds = d.getUTCSeconds();
  // Query day 0 of (month + 1) to get the exact number of days in this month (28, 29, 30, or 31)
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return {
    year,
    month,
    date: dateNum,
    dayOfWeek,
    hours,
    minutes,
    seconds,
    daysInMonth,
  };
}

// Construct a JavaScript Date representing an exact instant in Riyadh local time
export function makeRiyadhDate(
  year: number,
  month: number, // 0-11
  date: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  ms = 0
): Date {
  const utcMs = Date.UTC(year, month, date, hours, minutes, seconds, ms) - RIYADH_OFFSET_MS;
  return new Date(utcMs);
}

// Format Date to YYYY-MM-DD in Riyadh calendar
export function formatLocalDate(d: Date): string {
  const r = getRiyadhParts(d);
  const y = r.year;
  const m = String(r.month + 1).padStart(2, '0');
  const day = String(r.date).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Format Date for Arabic display using Riyadh timezone
export function formatArabicDate(dateStrOrObj: string | Date | null | undefined): string {
  if (!dateStrOrObj) return '-';
  try {
    const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
    if (isNaN(d.getTime())) return String(dateStrOrObj);
    return d.toLocaleDateString('ar-SA', {
      timeZone: RIYADH_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(dateStrOrObj);
  }
}

// Format Date & Time for Arabic display using Riyadh timezone
export function formatArabicDateTime(dateStrOrObj: string | Date | null | undefined): string {
  if (!dateStrOrObj) return '-';
  try {
    const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
    if (isNaN(d.getTime())) return String(dateStrOrObj);
    return d.toLocaleString('ar-SA', {
      timeZone: RIYADH_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(dateStrOrObj);
  }
}

// Compute Date Range according to Riyadh standard rules
export function computeReportDateRange(
  period: ReportPeriod | string,
  customStart?: string,
  customEnd?: string
): DateRangeResult {
  const now = new Date();
  const r = getRiyadhParts(now);

  if (period === 'all') {
    return {
      period: 'all',
      start: null,
      end: null,
      startDateStr: '',
      endDateStr: '',
      label: 'جميع السجلات (دون تقييد زمني)',
      inclusiveNote: 'يشمل كافة السجلات والعمليات التاريخية المسجلة في النظام',
    };
  }

  // اليوم: بداية اليوم الساعة 12:00 صباحاً (00:00:00) بتوقيت الرياض وحتى نهايته 11:59:59 مساءً
  if (period === 'today') {
    const start = makeRiyadhDate(r.year, r.month, r.date, 0, 0, 0, 0);
    const end = makeRiyadhDate(r.year, r.month, r.date, 23, 59, 59, 999);
    return {
      period: 'today',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'اليوم',
      inclusiveNote: `من بداية اليوم الساعة 12:00 ص حتى نهاية اليوم 11:59 م بتوقيت الرياض (${formatLocalDate(start)})`,
    };
  }

  // أمس: بداية يوم أمس الساعة 12:00 صباحاً بتوقيت الرياض وحتى نهايته
  if (period === 'yesterday') {
    const start = makeRiyadhDate(r.year, r.month, r.date - 1, 0, 0, 0, 0);
    const end = makeRiyadhDate(r.year, r.month, r.date - 1, 23, 59, 59, 999);
    return {
      period: 'yesterday',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'حركات أمس',
      inclusiveNote: `من بداية يوم أمس (12:00 ص) حتى نهايته (11:59 م بتوقيت الرياض) (${formatLocalDate(start)})`,
    };
  }

  // الأسبوع: من بداية يوم الجمعة (الساعة 12:00 ص) إلى نهاية يوم الخميس (الساعة 11:59:59 م بتوقيت الرياض)
  // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  if (period === 'this_week') {
    const daysSinceFriday = (r.dayOfWeek + 7 - 5) % 7;
    const fridayDate = r.date - daysSinceFriday;
    const start = makeRiyadhDate(r.year, r.month, fridayDate, 0, 0, 0, 0);
    const end = makeRiyadhDate(r.year, r.month, fridayDate + 6, 23, 59, 59, 999);
    return {
      period: 'this_week',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'هذا الأسبوع',
      inclusiveNote: `من بداية يوم الجمعة (12:00 ص) حتى نهاية يوم الخميس (11:59 م بتوقيت الرياض) [${formatLocalDate(start)} إلى ${formatLocalDate(end)}]`,
    };
  }

  // الأسبوع الماضي: من الجمعة السابقة حتى الخميس السابق
  if (period === 'last_week') {
    const daysSinceFriday = (r.dayOfWeek + 7 - 5) % 7;
    const fridayDate = r.date - daysSinceFriday;
    const start = makeRiyadhDate(r.year, r.month, fridayDate - 7, 0, 0, 0, 0);
    const end = makeRiyadhDate(r.year, r.month, fridayDate - 1, 23, 59, 59, 999);
    return {
      period: 'last_week',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'الأسبوع الماضي (اللي فات)',
      inclusiveNote: `من بداية يوم الجمعة السابق (12:00 ص) حتى نهاية يوم الخميس السابق (11:59 م بتوقيت الرياض) [${formatLocalDate(start)} إلى ${formatLocalDate(end)}]`,
    };
  }

  // الشهري: من يوم 1 الساعة 12:00 ص حتى نهاية الشهر (سواء 28 أو 29 أو 30 أو 31 يوماً) الساعة 11:59:59 م بتوقيت الرياض
  if (period === 'this_month') {
    const start = makeRiyadhDate(r.year, r.month, 1, 0, 0, 0, 0);
    const end = makeRiyadhDate(r.year, r.month + 1, 0, 23, 59, 59, 999);
    const monthDays = getRiyadhParts(end).date;
    return {
      period: 'this_month',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'هذا الشهر',
      inclusiveNote: `من يوم 1 الساعة 12:00 ص حتى نهاية الشهر بالكامل (${monthDays} يوماً) الساعة 11:59 م بتوقيت الرياض [${formatLocalDate(start)} إلى ${formatLocalDate(end)}]`,
    };
  }

  // الشهر السابق: من يوم 1 حتى نهاية الشهر السابق
  if (period === 'last_month') {
    const start = makeRiyadhDate(r.year, r.month - 1, 1, 0, 0, 0, 0);
    const end = makeRiyadhDate(r.year, r.month, 0, 23, 59, 59, 999);
    const monthDays = getRiyadhParts(end).date;
    return {
      period: 'last_month',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'الشهر الماضي',
      inclusiveNote: `من أول الشهر السابق (12:00 ص) حتى نهايته (${monthDays} يوماً) الساعة 11:59 م بتوقيت الرياض [${formatLocalDate(start)} إلى ${formatLocalDate(end)}]`,
    };
  }

  if (period === 'last_7_days') {
    const start = makeRiyadhDate(r.year, r.month, r.date - 6, 0, 0, 0, 0);
    const end = makeRiyadhDate(r.year, r.month, r.date, 23, 59, 59, 999);
    return {
      period: 'last_7_days',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'آخر 7 أيام',
      inclusiveNote: `من ${formatLocalDate(start)} 12:00 ص إلى ${formatLocalDate(end)} 11:59 م بتوقيت الرياض`,
    };
  }

  if (period === 'last_30_days') {
    const start = makeRiyadhDate(r.year, r.month, r.date - 29, 0, 0, 0, 0);
    const end = makeRiyadhDate(r.year, r.month, r.date, 23, 59, 59, 999);
    return {
      period: 'last_30_days',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'آخر 30 يومًا',
      inclusiveNote: `من ${formatLocalDate(start)} 12:00 ص إلى ${formatLocalDate(end)} 11:59 م بتوقيت الرياض`,
    };
  }

  if (period === 'this_year') {
    const start = makeRiyadhDate(r.year, 0, 1, 0, 0, 0, 0);
    const end = makeRiyadhDate(r.year, 11, 31, 23, 59, 59, 999);
    return {
      period: 'this_year',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'هذا العام',
      inclusiveNote: `من بداية العام 1 يناير 12:00 ص حتى نهاية العام 31 ديسمبر 11:59 م بتوقيت الرياض [${formatLocalDate(start)} إلى ${formatLocalDate(end)}]`,
    };
  }

  if (period === 'last_year') {
    const start = makeRiyadhDate(r.year - 1, 0, 1, 0, 0, 0, 0);
    const end = makeRiyadhDate(r.year - 1, 11, 31, 23, 59, 59, 999);
    return {
      period: 'last_year',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'العام الماضي',
      inclusiveNote: `من بداية العام الماضي 1 يناير حتى نهايته 31 ديسمبر بتوقيت الرياض [${formatLocalDate(start)} إلى ${formatLocalDate(end)}]`,
    };
  }

  if (period === 'custom') {
    let start: Date;
    let end: Date;

    if (customStart) {
      const [y, m, d] = customStart.split('-').map(Number);
      start = makeRiyadhDate(y, m - 1, d, 0, 0, 0, 0);
    } else {
      start = makeRiyadhDate(r.year, r.month, 1, 0, 0, 0, 0);
    }

    if (customEnd) {
      const [y, m, d] = customEnd.split('-').map(Number);
      end = makeRiyadhDate(y, m - 1, d, 23, 59, 59, 999);
    } else {
      end = makeRiyadhDate(r.year, r.month, r.date, 23, 59, 59, 999);
    }

    if (start.getTime() > end.getTime()) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    return {
      period: 'custom',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: `فترة مخصصة (${formatLocalDate(start)} إلى ${formatLocalDate(end)})`,
      inclusiveNote: `من ${formatLocalDate(start)} 12:00 ص إلى ${formatLocalDate(end)} 11:59 م بتوقيت الرياض (شاملة يوم البداية والنهاية)`,
    };
  }

  // Fallback to all
  return {
    period: 'all',
    start: null,
    end: null,
    startDateStr: '',
    endDateStr: '',
    label: 'جميع السجلات',
    inclusiveNote: 'يشمل كافة السجلات والعمليات التاريخية في النظام',
  };
}

// Checks if a record date string, timestamp, or Date object falls inside the date range
export function isRecordInDateRange(
  dateVal: string | number | Date | undefined | null,
  range: DateRangeResult
): boolean {
  if (range.period === 'all' || !range.start || !range.end) {
    return true;
  }
  if (!dateVal) return false;

  let timeMs: number;
  if (typeof dateVal === 'number') {
    timeMs = dateVal;
  } else if (dateVal instanceof Date) {
    timeMs = dateVal.getTime();
  } else if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed) return false;

    // Date-only string YYYY-MM-DD (treat as that day in Riyadh)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      timeMs = makeRiyadhDate(y, m - 1, d, 12, 0, 0, 0).getTime();
    } else {
      const parsed = new Date(trimmed).getTime();
      if (!isNaN(parsed)) {
        timeMs = parsed;
      } else {
        return false;
      }
    }
  } else {
    return false;
  }

  if (isNaN(timeMs)) return false;
  return timeMs >= range.start.getTime() && timeMs <= range.end.getTime();
}
