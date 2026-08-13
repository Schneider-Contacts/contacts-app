(function initInternWorkbookImporter_(root) {
  "use strict";

  const HEBREW_MONTHS = new Map([
    ["ינואר", 1], ["פברואר", 2], ["מרץ", 3], ["אפריל", 4],
    ["מאי", 5], ["יוני", 6], ["יולי", 7], ["אוגוסט", 8],
    ["ספטמבר", 9], ["אוקטובר", 10], ["נובמבר", 11], ["דצמבר", 12]
  ]);
  const ENGLISH_MONTHS = new Map([
    ["january", 1], ["february", 2], ["march", 3], ["april", 4],
    ["may", 5], ["june", 6], ["july", 7], ["august", 8],
    ["september", 9], ["october", 10], ["november", 11], ["december", 12]
  ]);
  const NAME_HEADER_RE = /^(?:שם|שם מלא|שם הסטאז(?:׳|')?ר(?:ית)?|סטאז(?:׳|')?ר(?:ית)?|name|full name)$/i;
  const PHONE_HEADER_RE = /^(?:טלפון|נייד|מספר טלפון|מס(?:׳|')? טלפון|phone|mobile|cell)$/i;
  const DEPARTMENT_HEADER_RE = /^(?:מחלקה|שיבוץ|מחלקת שיבוץ|יחידה|מכון|department|ward|placement)$/i;
  const NON_NAME_RE = /(?:טלפון|נייד|מחלקה|שיבוץ|אוניברסיט|פקולט|בית חולים|הערות|תאריך|מספר|מייל|דוא(?:״|\")?ל|email|phone|department|university|hospital|notes?|status|סה[״\"]?כ)/i;
  const DEPARTMENT_WORD_RE = /(?:מחלק|מכון|יחידה|מרפא|מיון|טיפול נמרץ|ילדים|כירורג|פנימ|קרדיולוג|אונקולוג|אורתופד|הרדמ|דימות|רנטגן|מעבד|אשפוז|ward|department|unit|clinic|surgery|pediatr)/i;

  function normalizeText_(value) {
    return String(value == null ? "" : value)
      .replace(/[\u200e\u200f]/g, "")
      .replace(/[׳'`]/g, "")
      .replace(/[״\"]/g, "")
      .replace(/[\u2010-\u2015]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function cleanText_(value) {
    return String(value == null ? "" : value)
      .replace(/[\u200e\u200f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizePhoneFallback_(value) {
    let digits = String(value == null ? "" : value).replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("00972")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = "972" + digits.slice(1);
    if (!digits.startsWith("972")) digits = "972" + digits;
    return "+" + digits;
  }

  function normalizePhoneCandidate_(value, phoneNormalizer) {
    const raw = cleanText_(value);
    if (!raw) return "";
    const scientificMatch = raw.match(/^([0-9]+(?:\.[0-9]+)?)e\+?([0-9]+)$/i);
    const expanded = scientificMatch
      ? String(Math.round(Number(raw)))
      : raw;
    const normalizer = typeof phoneNormalizer === "function"
      ? phoneNormalizer
      : normalizePhoneFallback_;
    const normalized = String(normalizer(expanded) || "");
    const digits = normalized.replace(/\D/g, "");
    if (!digits.startsWith("972") || digits.length < 11 || digits.length > 12) {
      return "";
    }
    return "+" + digits;
  }

  function hasPersonLetters_(value) {
    const letters = cleanText_(value).match(/[A-Za-z\u0590-\u05ff]/g) || [];
    return letters.length >= 2;
  }

  function isLikelyPersonName_(value) {
    const clean = cleanText_(value);
    if (!clean || clean.length < 2 || clean.length > 70) return false;
    if (!hasPersonLetters_(clean) || NON_NAME_RE.test(clean)) return false;
    if (/^(?:כן|לא|זכר|נקבה|פעיל|לא פעיל|מאושר|ממתין)$/i.test(clean)) return false;
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length > 6) return false;
    const digitCount = (clean.match(/\d/g) || []).length;
    return digitCount <= 1;
  }

  function cleanPersonName_(value) {
    return cleanText_(value)
      .replace(/^(?:ד(?:״|\")?ר|דר|פרופ(?:׳|')?)\s+/i, match => match.trim() + " ")
      .trim();
  }

  function cleanDepartment_(value) {
    return cleanText_(value);
  }

  function getColumnCount_(rows) {
    return (Array.isArray(rows) ? rows : []).reduce(
      (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
      0
    );
  }

  function getColumnValues_(rows, columnIndex, rowIndexes) {
    const indexes = Array.isArray(rowIndexes)
      ? rowIndexes
      : rows.map((_, index) => index);
    return indexes.map(index => rows[index] && rows[index][columnIndex]);
  }

  function findHeaderSignal_(rows, columnIndex, expression) {
    const limit = Math.min(Array.isArray(rows) ? rows.length : 0, 12);
    for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
      if (expression.test(normalizeText_(rows[rowIndex] && rows[rowIndex][columnIndex]))) {
        return { found: true, rowIndex };
      }
    }
    return { found: false, rowIndex: -1 };
  }

  function scorePhoneColumns_(rows, phoneNormalizer) {
    const columnCount = getColumnCount_(rows);
    const candidates = [];
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const validRows = [];
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const phone = normalizePhoneCandidate_(
          rows[rowIndex] && rows[rowIndex][columnIndex],
          phoneNormalizer
        );
        if (phone) validRows.push(rowIndex);
      }
      if (!validRows.length) continue;
      const nonEmpty = getColumnValues_(rows, columnIndex)
        .filter(value => cleanText_(value)).length || 1;
      const header = findHeaderSignal_(rows, columnIndex, PHONE_HEADER_RE);
      const ratio = validRows.length / nonEmpty;
      candidates.push({
        columnIndex,
        validRows,
        validCount: validRows.length,
        ratio,
        header,
        score: validRows.length * 14 + ratio * 35 + (header.found ? 55 : 0)
      });
    }
    return candidates.sort((a, b) => b.score - a.score);
  }

  function scoreNameColumns_(rows, phoneCandidate) {
    const columnCount = getColumnCount_(rows);
    const candidates = [];
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      if (columnIndex === phoneCandidate.columnIndex) continue;
      const values = getColumnValues_(rows, columnIndex, phoneCandidate.validRows)
        .map(cleanText_);
      const validValues = values.filter(isLikelyPersonName_);
      if (!validValues.length) continue;
      const normalizedUnique = new Set(validValues.map(normalizeText_));
      const coverage = validValues.length / Math.max(1, phoneCandidate.validRows.length);
      const uniqueRatio = normalizedUnique.size / validValues.length;
      const avgWords = validValues.reduce(
        (sum, value) => sum + value.split(/\s+/).filter(Boolean).length,
        0
      ) / validValues.length;
      const header = findHeaderSignal_(rows, columnIndex, NAME_HEADER_RE);
      const categoricalPenalty = uniqueRatio < 0.35 ? 35 : 0;
      const nameShapeBonus = avgWords >= 1.5 && avgWords <= 4.5 ? 16 : 0;
      candidates.push({
        columnIndex,
        validCount: validValues.length,
        coverage,
        uniqueRatio,
        header,
        score:
          validValues.length * 9 + coverage * 45 + uniqueRatio * 24 +
          nameShapeBonus + (header.found ? 60 : 0) - categoricalPenalty
      });
    }
    return candidates.sort((a, b) => b.score - a.score);
  }

  function scoreDepartmentColumns_(rows, phoneCandidate, nameCandidate, knownDepartments) {
    const columnCount = getColumnCount_(rows);
    const known = new Set(
      (Array.isArray(knownDepartments) ? knownDepartments : [])
        .map(normalizeText_)
        .filter(Boolean)
    );
    const candidates = [];
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      if ([phoneCandidate.columnIndex, nameCandidate.columnIndex].includes(columnIndex)) {
        continue;
      }
      const values = getColumnValues_(rows, columnIndex, phoneCandidate.validRows)
        .map(cleanText_)
        .filter(value => value && hasPersonLetters_(value) && value.length <= 100);
      if (!values.length) continue;
      const normalizedValues = values.map(normalizeText_);
      const knownMatches = normalizedValues.filter(value => {
        if (known.has(value)) return true;
        return [...known].some(item => item && (item.includes(value) || value.includes(item)));
      }).length;
      const wordingMatches = values.filter(value => DEPARTMENT_WORD_RE.test(value)).length;
      const uniqueRatio = new Set(normalizedValues).size / values.length;
      const coverage = values.length / Math.max(1, phoneCandidate.validRows.length);
      const header = findHeaderSignal_(rows, columnIndex, DEPARTMENT_HEADER_RE);
      const score =
        coverage * 18 + knownMatches * 16 + wordingMatches * 7 +
        (1 - Math.min(1, uniqueRatio)) * 8 + (header.found ? 65 : 0);
      candidates.push({
        columnIndex,
        coverage,
        knownMatches,
        wordingMatches,
        header,
        score
      });
    }
    return candidates.sort((a, b) => b.score - a.score);
  }

  function isCandidateConfident_(candidates, kind) {
    const top = candidates[0];
    if (!top) return false;
    const second = candidates[1];
    const threshold = kind === "phone" ? 45 : 48;
    if (top.header && top.header.found && top.validCount >= 1) return true;
    if (top.score < threshold) return false;
    if (!second) return true;
    const margin = top.score - second.score;
    const requiredMargin = kind === "name"
      ? Math.max(22, top.score * 0.2)
      : Math.max(10, top.score * 0.12);
    return margin >= requiredMargin;
  }

  function columnLabel_(index) {
    let value = Number(index) + 1;
    let label = "";
    while (value > 0) {
      value -= 1;
      label = String.fromCharCode(65 + (value % 26)) + label;
      value = Math.floor(value / 26);
    }
    return label;
  }

  function getMappingOptions_(table) {
    const rows = Array.isArray(table && table.rows) ? table.rows : [];
    return Array.from({ length: getColumnCount_(rows) }, (_, columnIndex) => {
      const samples = getColumnValues_(rows, columnIndex)
        .map(cleanText_)
        .filter(Boolean)
        .slice(0, 3);
      return {
        columnIndex,
        label: `${columnLabel_(columnIndex)}${samples.length ? " · " + samples.join(" · ") : ""}`
      };
    });
  }

  function namesEquivalent_(first, second) {
    const a = normalizeText_(first).replace(/[^a-z\u0590-\u05ff0-9]/g, "");
    const b = normalizeText_(second).replace(/[^a-z\u0590-\u05ff0-9]/g, "");
    return Boolean(a && b && a === b);
  }

  function parseTableWithMapping_(table, mapping, options) {
    const rows = Array.isArray(table && table.rows) ? table.rows : [];
    const phoneNormalizer = options && options.normalizePhone;
    const entriesByPhone = new Map();
    const rejected = [];
    const warnings = [];
    let duplicates = 0;

    rows.forEach((row, rowIndex) => {
      const rawName = row && row[mapping.nameColumn];
      const rawPhone = row && row[mapping.phoneColumn];
      const name = cleanPersonName_(rawName);
      const phone = normalizePhoneCandidate_(rawPhone, phoneNormalizer);
      const department = Number.isInteger(mapping.departmentColumn)
        ? cleanDepartment_(row && row[mapping.departmentColumn])
        : "";

      if (
        NAME_HEADER_RE.test(normalizeText_(rawName)) ||
        PHONE_HEADER_RE.test(normalizeText_(rawPhone))
      ) {
        return;
      }
      if (!name && !cleanText_(rawPhone)) return;
      if (!isLikelyPersonName_(name) || !phone) {
        rejected.push({
          rowIndex,
          reason: !isLikelyPersonName_(name) ? "missing_name" : "invalid_phone",
          name,
          rawPhone: cleanText_(rawPhone)
        });
        return;
      }

      const entry = { name, phone, department };
      const existing = entriesByPhone.get(phone);
      if (!existing) {
        entriesByPhone.set(phone, entry);
        return;
      }

      duplicates += 1;
      if (!namesEquivalent_(existing.name, name)) {
        warnings.push({
          type: "phone_name_conflict",
          phone,
          keptName: existing.name,
          ignoredName: name,
          rowIndex
        });
      } else if (!existing.department && department) {
        existing.department = department;
      }
    });

    return {
      entries: [...entriesByPhone.values()],
      rejected,
      duplicates,
      warnings,
      totalRows: rows.length
    };
  }

  function analyzeTable_(table, options) {
    const rows = Array.isArray(table && table.rows) ? table.rows : [];
    const phoneCandidates = scorePhoneColumns_(rows, options && options.normalizePhone);
    const phoneCandidate = phoneCandidates[0] || null;
    const nameCandidates = phoneCandidate
      ? scoreNameColumns_(rows, phoneCandidate)
      : [];
    const nameCandidate = nameCandidates[0] || null;
    const departmentCandidates = phoneCandidate && nameCandidate
      ? scoreDepartmentColumns_(
          rows,
          phoneCandidate,
          nameCandidate,
          options && options.knownDepartments
        )
      : [];
    const departmentCandidate = departmentCandidates[0] || null;
    const phoneConfident = isCandidateConfident_(phoneCandidates, "phone");
    const nameConfident = isCandidateConfident_(nameCandidates, "name");
    const departmentConfident = Boolean(
      departmentCandidate &&
      (
        departmentCandidate.header.found ||
        departmentCandidate.knownMatches > 0 ||
        departmentCandidate.wordingMatches >= 2
      ) &&
      departmentCandidate.score >= 20
    );
    const mapping = {
      nameColumn: nameCandidate ? nameCandidate.columnIndex : null,
      phoneColumn: phoneCandidate ? phoneCandidate.columnIndex : null,
      departmentColumn: departmentConfident
        ? departmentCandidate.columnIndex
        : null
    };
    const parsed = Number.isInteger(mapping.nameColumn) && Number.isInteger(mapping.phoneColumn)
      ? parseTableWithMapping_(table, mapping, options || {})
      : { entries: [], rejected: [], duplicates: 0, warnings: [], totalRows: rows.length };

    return {
      table,
      mapping,
      phoneCandidates,
      nameCandidates,
      departmentCandidates,
      requiredFieldsConfident: phoneConfident && nameConfident,
      parsed,
      score:
        (phoneCandidate ? phoneCandidate.score : 0) +
        (nameCandidate ? nameCandidate.score : 0) +
        parsed.entries.length * 30
    };
  }

  function analyzeTables_(tables, options) {
    const normalizedTables = (Array.isArray(tables) ? tables : [])
      .map((table, index) => ({
        name: cleanText_(table && table.name) || `גיליון ${index + 1}`,
        rows: Array.isArray(table && table.rows) ? table.rows : []
      }))
      .filter(table => table.rows.length);
    const analyses = normalizedTables
      .map(table => analyzeTable_(table, options || {}))
      .sort((a, b) => b.score - a.score);
    const best = analyses[0] || null;
    if (!best || !best.parsed.entries.length) {
      return {
        status: best ? "mapping_required" : "empty",
        tables: normalizedTables,
        analyses,
        selectedSheet: best ? best.table.name : "",
        mapping: best ? best.mapping : null,
        mappingOptions: best ? getMappingOptions_(best.table) : [],
        parsed: best ? best.parsed : null
      };
    }
    return {
      status: best.requiredFieldsConfident ? "ready" : "mapping_required",
      tables: normalizedTables,
      analyses,
      selectedSheet: best.table.name,
      mapping: best.mapping,
      mappingOptions: getMappingOptions_(best.table),
      parsed: best.parsed
    };
  }

  function workbookToTables_(workbook, xlsx) {
    if (!workbook || !xlsx || !xlsx.utils || !Array.isArray(workbook.SheetNames)) {
      return [];
    }
    return workbook.SheetNames.map(name => ({
      name,
      rows: xlsx.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        raw: true,
        defval: "",
        blankrows: false
      })
    }));
  }

  function analyzeWorkbook_(workbook, xlsx, options) {
    return analyzeTables_(workbookToTables_(workbook, xlsx), options || {});
  }

  function parseManualMapping_(analysis, mapping, options) {
    const table = (analysis && analysis.tables || []).find(
      item => item.name === mapping.sheetName
    );
    if (!table) throw new Error("הגיליון שנבחר אינו קיים בקובץ.");
    if (!Number.isInteger(mapping.nameColumn) || !Number.isInteger(mapping.phoneColumn)) {
      throw new Error("יש לבחור עמודת שם ועמודת טלפון.");
    }
    if (mapping.nameColumn === mapping.phoneColumn) {
      throw new Error("עמודת השם ועמודת הטלפון חייבות להיות שונות.");
    }
    return parseTableWithMapping_(table, mapping, options || {});
  }

  function getMonthValue_(year, month) {
    const numericYear = Number(year);
    const numericMonth = Number(month);
    if (numericYear < 2000 || numericYear > 2100 || numericMonth < 1 || numericMonth > 12) {
      return "";
    }
    return `${numericYear}-${String(numericMonth).padStart(2, "0")}`;
  }

  function inferMonthYear_(fileName, tables, fallbackDate) {
    const text = [
      cleanText_(fileName),
      ...(Array.isArray(tables) ? tables : []).flatMap(table => [
        cleanText_(table && table.name),
        ...(Array.isArray(table && table.rows)
          ? table.rows.slice(0, 12).flat().map(cleanText_)
          : [])
      ])
    ].filter(Boolean).join(" ");
    const yearMatch = text.match(/(?:^|[^0-9])(20\d{2})(?![0-9])/);
    const normalized = normalizeText_(text);
    const monthTokens = new Set(
      normalized.split(/[^a-z\u0590-\u05ff]+/).filter(Boolean)
    );
    const monthEntry = [...HEBREW_MONTHS, ...ENGLISH_MONTHS]
      .find(([monthName]) => monthTokens.has(normalizeText_(monthName)));
    if (yearMatch && monthEntry) {
      return getMonthValue_(yearMatch[1], monthEntry[1]);
    }
    const numeric = text.match(/(?:^|[^0-9])(20\d{2})[\s_.\/-]+(0?[1-9]|1[0-2])(?![0-9])/) ||
      text.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])[\s_.\/-]+(20\d{2})(?![0-9])/);
    if (numeric) {
      const yearFirst = numeric[1].length === 4;
      return getMonthValue_(yearFirst ? numeric[1] : numeric[2], yearFirst ? numeric[2] : numeric[1]);
    }
    const date = fallbackDate instanceof Date ? fallbackDate : new Date();
    return getMonthValue_(date.getFullYear(), date.getMonth() + 1);
  }

  const api = {
    analyzeTables: analyzeTables_,
    analyzeWorkbook: analyzeWorkbook_,
    workbookToTables: workbookToTables_,
    parseManualMapping: parseManualMapping_,
    inferMonthYear: inferMonthYear_,
    normalizePhoneCandidate: normalizePhoneCandidate_,
    normalizeText: normalizeText_,
    getMappingOptions: getMappingOptions_
  };

  root.InternWorkbookImporter = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
