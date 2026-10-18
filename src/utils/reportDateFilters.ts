// Utilities for comprehensive Arabic Date Filtering across all report sections

export type ReportPeriod =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_week'
  | 'this_month'
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

// Format Date to YYYY-MM-DD local time
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Format Date for Arabic display
export function formatArabicDate(dateStrOrObj: string | Date | null | undefined): string {
  if (!dateStrOrObj) return '-';
  try {
    const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
    if (isNaN(d.getTime())) return String(dateStrOrObj);
    return d.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(dateStrOrObj);
  }
}

// Compute Date Range according to local system time
export function computeReportDateRange(
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string
): DateRangeResult {
  const now = new Date();

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

  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      period: 'today',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'اليوم',
      inclusiveNote: `من بداية اليوم وحتى نهايته (${formatLocalDate(start)})`,
    };
  }

  if (period === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    return {
      period: 'yesterday',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'حركات أمس (اليوم السابق)',
      inclusiveNote: `من بداية يوم أمس وحتى نهايته (${formatLocalDate(start)})`,
    };
  }

  if (period === 'last_7_days') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return {
      period: 'last_7_days',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'آخر 7 أيام',
      inclusiveNote: `من ${formatLocalDate(start)} إلى ${formatLocalDate(end)} (شاملة يوم البداية والنهاية)`,
    };
  }

  if (period === 'last_30_days') {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return {
      period: 'last_30_days',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'آخر 30 يومًا',
      inclusiveNote: `من ${formatLocalDate(start)} إلى ${formatLocalDate(end)} (شاملة يوم البداية والنهاية)`,
    };
  }

  if (period === 'this_week') {
    // Saudi week begins Sunday (0) or Saturday (6)
    // Starting Sunday as week start:
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return {
      period: 'this_week',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'هذا الأسبوع',
      inclusiveNote: `من بداية الأسبوع ${formatLocalDate(start)} إلى نهاية الأسبوع ${formatLocalDate(end)} (شاملة)`,
    };
  }

  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      period: 'this_month',
      start,
      end,
      startDateStr: formatLocalDate(start),
      endDateStr: formatLocalDate(end),
      label: 'هذا الشهر',
      inclusiveNote: `من أول الشهر ${formatLocalDate(start)} حتى آخر يوم في الشهر ${formatLocalDate(end)} (شاملة)`,
    };
  }

  if (period === 'custom') {
    let start: Date;
    let end: Date;

    if (customStart) {
      const [y, m, d] = customStart.split('-').map(Number);
      start = new Date(y, m - 1, d, 0, 0, 0, 0);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    if (customEnd) {
      const [y, m, d] = customEnd.split('-').map(Number);
      end = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else {
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    if (start > end) {
      // Swap if user inverted dates
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
      inclusiveNote: `من ${formatLocalDate(start)} 00:00 إلى ${formatLocalDate(end)} 23:59 (شامل يوم البداية والنهاية بالكامل)`,
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
    inclusiveNote: 'يشمل كافة السجلات',
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [y, m, d] = dateVal.split('-').map(Number);
      // Set to midday in local time to avoid any timezone boundary drift
      timeMs = new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
    } else {
      timeMs = new Date(dateVal).getTime();
    }
  } else {
    return false;
  }

  if (isNaN(timeMs)) return false;
  return timeMs >= range.start.getTime() && timeMs <= range.end.getTime();
}

