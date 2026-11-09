(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PharmacologyRoster = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const ZONE = 'Asia/Jerusalem';
  const DAY = 1440;
  const MAX_BYTES = 100 * 1024;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const plain = o => o !== null && typeof o === 'object' && !Array.isArray(o) &&
    (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);
  function bytes(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
    return unescape(encodeURIComponent(s)).length;
  }
  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s) || (Number(s.slice(0, 4)) < 2000 || Number(s.slice(0, 4)) > 2099)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  function dateMinute(s) { return new Date(s + 'T00:00:00Z').getTime() / 60000; }
  function clockMinute(s) {
    return typeof s === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)
      ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3)) : null;
  }
  function interval(e) {
    const a = clockMinute(e.start), b = clockMinute(e.end);
    if (!validDate(e.date) || a === null || b === null) return null;
    const start = dateMinute(e.date) + a;
    const end = dateMinute(e.date) + b + (e.endNextDay === true ? DAY : 0);
    return end > start && end - start <= DAY ? [start, end] : null;
  }
  function phone(s) {
    if (!s) return '';
    if (!/^(?:\+?[\d ()-]+)$/.test(s)) return null;
    let digits = s.replace(/[ ()-]/g, '');
    if (digits.startsWith('+972')) digits = '0' + digits.slice(4);
    else if (digits.startsWith('00972')) digits = '0' + digits.slice(5);
    else if (digits.startsWith('972')) digits = '0' + digits.slice(3);
    if (!/^(?:0[23489]\d{7}|0[57]\d{8})$/.test(digits)) return null;
    return '+972' + digits.slice(1);
  }
  function analyze(input) {
    const errors = [], warnings = [];
    const roster = { schemaVersion: 1, month: '', timeZone: ZONE, notes: '', entries: [] };
    const result = () => ({ valid: errors.length === 0, errors, warnings, roster });
    let source;
    try {
      const serialized = typeof input === 'string' ? input : JSON.stringify(input);
      if (typeof serialized !== 'string' || bytes(serialized) > MAX_BYTES) {
        errors.push('הקלט חייב להיות JSON עד 100KB.'); return result();
      }
      source = typeof input === 'string' ? JSON.parse(serialized) : input;
    } catch (_) { errors.push('הקלט אינו JSON תקין.'); return result(); }
    if (!plain(source)) { errors.push('שורש הקלט חייב להיות אובייקט.'); return result(); }
    function keys(o, allowed, label) {
      Object.keys(o).forEach(k => { if (!allowed.includes(k)) errors.push(label + ': שדה לא מוכר: ' + k); });
    }
    function text(o, k, max, required, label) {
      if (!own(o, k)) { if (required) errors.push(label + ': חסר ' + k); return ''; }
      if (typeof o[k] !== 'string') { errors.push(label + ': ' + k + ' חייב להיות טקסט.'); return ''; }
      const value = o[k].trim();
      if (o[k].length > max || (required && !value)) errors.push(label + ': אורך לא תקין עבור ' + k);
      return value;
    }
    keys(source, ['schemaVersion', 'month', 'timeZone', 'notes', 'entries'], 'לוח');
    if (own(source, 'schemaVersion') && source.schemaVersion !== 1) errors.push('schemaVersion חייב להיות 1.');
    roster.month = text(source, 'month', 7, true, 'לוח');
    const monthValid = /^\d{4}-\d{2}$/.test(roster.month) && validDate(roster.month + '-01');
    if (!monthValid) errors.push('חודש לא תקין; נדרש YYYY-MM.');
    if (own(source, 'timeZone') && source.timeZone !== ZONE) errors.push('אזור הזמן חייב להיות Asia/Jerusalem.');
    roster.notes = text(source, 'notes', 1200, false, 'לוח');
    if (!Array.isArray(source.entries) || source.entries.length === 0 || source.entries.length > 100) {
      errors.push('entries חייב להיות מערך של 1 עד 100 שיבוצים.'); return result();
    }
    const seen = new Set();
    source.entries.forEach((raw, index) => {
      const label = 'שיבוץ ' + (index + 1);
      if (!plain(raw)) { errors.push(label + ': נדרש אובייקט.'); return; }
      keys(raw, ['date', 'name', 'phone', 'shift', 'start', 'end', 'endNextDay', 'uncertain', 'note'], label);
      const e = {
        date: text(raw, 'date', 10, true, label), name: text(raw, 'name', 120, true, label),
        phone: text(raw, 'phone', 40, false, label), shift: text(raw, 'shift', 120, true, label),
        start: text(raw, 'start', 5, false, label), end: text(raw, 'end', 5, false, label),
        endNextDay: raw.endNextDay === true, uncertain: raw.uncertain === true,
        note: text(raw, 'note', 300, false, label)
      };
      ['endNextDay', 'uncertain'].forEach(k => {
        if (own(raw, k) && typeof raw[k] !== 'boolean') errors.push(label + ': ' + k + ' חייב להיות בוליאני.');
      });
      if (!validDate(e.date) || e.date.slice(0, 7) !== roster.month) errors.push(label + ': התאריך לא תקין או אינו בחודש הלוח.');
      const normalized = phone(e.phone);
      if (normalized === null) errors.push(label + ': מספר טלפון ישראלי לא תקין.');
      e.phone = normalized || '';
      if (!e.phone) warnings.push(label + ': חסר טלפון מאומת; אין אפשרות לחיוג.');
      if (!e.start && !e.end) {
        warnings.push(label + ': שעות לא ידועות; אין להסיק מי הכונן כעת.');
        if (e.endNextDay) errors.push(label + ': endNextDay דורש שעות התחלה וסיום.');
      } else if (!interval(e)) errors.push(label + ': טווח שעות לא תקין; נדרשות שתי שעות HH:mm ומעבר יום מפורש למשמרת לילה (עד 24 שעות).');
      if (e.uncertain) warnings.push(label + ': שיבוץ לא ודאי; נדרש אימות מול המקור.');
      const key = JSON.stringify(e);
      if (seen.has(key)) errors.push(label + ': שיבוץ כפול.');
      seen.add(key);
      roster.entries.push(e);
    });
    for (let i = 0; i < roster.entries.length; i++) {
      const a = interval(roster.entries[i]);
      if (!a) continue;
      for (let j = i + 1; j < roster.entries.length; j++) {
        const b = interval(roster.entries[j]);
        if (b && a[0] < b[1] && b[0] < a[1]) errors.push('חפיפה בין שיבוצים ' + (i + 1) + ' ו-' + (j + 1) + '.');
      }
    }
    if (monthValid) {
      const covered = new Set(roster.entries.map(e => e.date));
      const missing = [];
      for (let day = 1; day <= 31; day++) {
        const key = roster.month + '-' + String(day).padStart(2, '0');
        if (validDate(key) && !covered.has(key)) missing.push(String(day));
      }
      if (missing.length) warnings.push('ימים ללא שיבוץ בחודש: ' + missing.join(', ') + '. אין להסיק כיסוי לימים אלה.');
    }
    return result();
  }
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  function localParts(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new TypeError('נדרש תאריך תקין.');
    const parts = {};
    formatter.formatToParts(date).forEach(p => { parts[p.type] = p.value; });
    return { date: parts.year.padStart(4, '0') + '-' + parts.month + '-' + parts.day,
      minute: Number(parts.hour) * 60 + Number(parts.minute) };
  }
  function israelDateKey(date = new Date()) { return localParts(date).date; }
  function selectDay(roster, date = new Date()) {
    const local = localParts(date);
    const now = dateMinute(local.date) + local.minute;
    // Validate again at the trust boundary; malformed stored data must never name a current clinician.
    const checked = (Array.isArray(roster) ? roster : [roster]).map(analyze);
    const allValid = checked.length > 0 && checked.every(item => item.valid);
    const entries = checked.flatMap(item => item.roster.entries).filter(e => {
      if (e.date === local.date) return true;
      const span = interval(e);
      return e.endNextDay && e.date < local.date && span && span[0] <= now && now < span[1];
    });
    const candidates = entries.filter(e => { const span = interval(e); return span && span[0] <= now && now < span[1]; });
    const unresolved = entries.some(e => !interval(e) || (e.uncertain && candidates.includes(e)));
    const ambiguous = unresolved || candidates.length > 1 || !allValid;
    return { date: local.date, entries, current: !ambiguous && candidates.length === 1 ? candidates[0] : null, ambiguous };
  }
  function buildAiPrompt() {
    return 'חלץ מהתמונה בלבד לוח כוננות פרמקולוגיה. החזר JSON בלבד ללא Markdown. אל תמציא, תשלים או תפתור מידע לא ברור. '
      + 'אין להסיק שעות כוננות משעות מעבדה/פעילות או משם המשמרת. כששעות אינן ידועות השתמש במחרוזת ריקה גם ב-start וגם ב-end. '
      + 'כל תאריך חייב לכלול שנה YYYY-MM-DD והחודש YYYY-MM; אם השנה או החודש לא ברורים בקש הבהרה, אל תנחש. '
      + 'שייך מספרי טלפון לאנשים רק לפי המקור; טלפון חסר הוא מחרוזת ריקה. סמן uncertain:true בכל ספק ושמור את הטקסט והספק ב-note. '
      + 'חובה לציין shift מפורש מהמקור. endNextDay:true רק כאשר מעבר לחצות מפורש במקור. כל שיבוץ בחודש הנבחר; אין להשלים ימים חסרים. '
      + 'הסכמה המדויקת (הדוגמה בדויה בלבד, אינה נתון אמיתי): '
      + '{"schemaVersion":1,"month":"2030-01","timeZone":"Asia/Jerusalem","notes":"דוגמה בדויה",'
      + '"entries":[{"date":"2030-01-01","name":"שם לדוגמה בלבד","phone":"","shift":"כוננות",'
      + '"start":"","end":"","endNextDay":false,"uncertain":true,"note":"שעות ומספר טלפון אינם מופיעים במקור"}]}';
  }
  return Object.freeze({ analyze, israelDateKey, selectDay, buildAiPrompt });
});
