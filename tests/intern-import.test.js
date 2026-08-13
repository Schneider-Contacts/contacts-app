const assert = require("assert");
const XLSX = require("../vendor/xlsx.full.min.js");
const importer = require("../intern-import.js");

function normalizePhone(value) {
  let digits = String(value == null ? "" : value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00972")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  else if (!digits.startsWith("972")) digits = `972${digits}`;
  return `+${digits}`;
}

function buildWorkbook(sheetFixtures) {
  const workbook = XLSX.utils.book_new();
  sheetFixtures.forEach(({ name, rows }) => {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      name
    );
  });
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return XLSX.read(bytes, { type: "buffer", cellDates: false });
}

function analyze(sheetFixtures, options = {}) {
  return importer.analyzeWorkbook(
    buildWorkbook(sheetFixtures),
    XLSX,
    {
      normalizePhone,
      knownDepartments: options.knownDepartments || [
        "ילדים א׳",
        "מיון",
        "טיפול נמרץ ילדים"
      ]
    }
  );
}

const representative = analyze([
  {
    name: "הסברים",
    rows: [
      ["קובץ שיבוץ חודשי"],
      ["אין לערוך את הנוסח"]
    ]
  },
  {
    name: "שיבוץ אוגוסט",
    rows: [
      ["הערה", "מחלקה", "מספר טלפון", "אוניברסיטה", "שם מלא", "תאריך"],
      ["", "ילדים א׳", "050-1234567", "תל אביב", "נועה כהן", "1.8.2026"],
      ["תורנות", "מיון", 547654321, "בן גוריון", "דניאל לוי", "3.8.2026"],
      ["", "טיפול נמרץ ילדים", "+972 52 222 3344", "טכניון", "רוני בר", "4.8.2026"]
    ]
  }
]);

assert.strictEqual(representative.status, "ready");
assert.strictEqual(representative.selectedSheet, "שיבוץ אוגוסט");
assert.deepStrictEqual(
  representative.mapping,
  { nameColumn: 4, phoneColumn: 2, departmentColumn: 1 },
  "Relevant columns must be detected by content rather than fixed positions"
);
assert.strictEqual(representative.parsed.entries.length, 3);
assert.strictEqual(representative.parsed.rejected.length, 0);
assert.strictEqual(representative.parsed.entries[1].phone, "+972547654321");

const movedColumns = analyze([
  {
    name: "Sheet2",
    rows: [
      ["שם הסטאז׳ר", "מידע נוסף", "נייד", "שיבוץ"],
      ["נועה כהן", "x", "050 123 4567", "ילדים א׳"],
      ["דניאל לוי", "y", "054-7654321", "מיון"]
    ]
  }
]);
assert.strictEqual(movedColumns.mapping.nameColumn, 0);
assert.strictEqual(movedColumns.mapping.phoneColumn, 2);
assert.strictEqual(movedColumns.mapping.departmentColumn, 3);

const withoutDepartment = analyze([
  {
    name: "ללא מחלקה",
    rows: [
      ["שם", "טלפון"],
      ["גל כהן", "0501234567"],
      ["אור לוי", "0523334455"]
    ]
  }
]);
assert.strictEqual(withoutDepartment.status, "ready");
assert.strictEqual(withoutDepartment.parsed.entries.length, 2);
assert.strictEqual(withoutDepartment.parsed.entries[0].department, "");

const rejectedRows = analyze([
  {
    name: "בדיקה",
    rows: [
      ["שם", "טלפון", "מחלקה"],
      ["תקין אחד", "0501234567", "מיון"],
      ["ללא טלפון", "", "מיון"],
      ["", "0547654321", "מיון"],
      ["טלפון שגוי", "1234", "מיון"]
    ]
  }
]);
assert.strictEqual(rejectedRows.parsed.entries.length, 1);
assert.strictEqual(rejectedRows.parsed.rejected.length, 3);

const duplicateRows = analyze([
  {
    name: "כפילויות",
    rows: [
      ["שם מלא", "נייד", "מחלקה"],
      ["נועה כהן", "050-1234567", ""],
      ["נועה  כהן", "+972501234567", "ילדים א׳"],
      ["נועה כהן", 501234567, "ילדים א׳"]
    ]
  }
]);
assert.strictEqual(duplicateRows.parsed.entries.length, 1);
assert.strictEqual(duplicateRows.parsed.duplicates, 2);
assert.strictEqual(duplicateRows.parsed.entries[0].department, "ילדים א׳");

const phoneFormats = analyze([
  {
    name: "טלפונים",
    rows: [
      ["שם", "טלפון"],
      ["אחד ישראלי", "0501234567"],
      ["שניים רווחים", "052 222 3344"],
      ["שלושה מקפים", "054-7654321"],
      ["ארבע בינלאומי", "+972551112222"],
      ["חמש ישראלי", 569998887]
    ]
  }
]);
assert.deepStrictEqual(
  phoneFormats.parsed.entries.map(entry => entry.phone),
  [
    "+972501234567",
    "+972522223344",
    "+972547654321",
    "+972551112222",
    "+972569998887"
  ]
);

const ambiguousNames = importer.analyzeTables([
  {
    name: "ללא כותרות",
    rows: [
      ["נועה כהן", "תל אביב", "0501234567"],
      ["דניאל לוי", "חיפה", "0547654321"],
      ["רוני בר", "ירושלים", "0523334455"]
    ]
  }
], { normalizePhone, knownDepartments: [] });
assert.strictEqual(
  ambiguousNames.status,
  "mapping_required",
  "Low-confidence name selection must require explicit administrator mapping"
);
const manualNames = importer.parseManualMapping(
  ambiguousNames,
  {
    sheetName: "ללא כותרות",
    nameColumn: 0,
    phoneColumn: 2,
    departmentColumn: null
  },
  { normalizePhone }
);
assert.strictEqual(manualNames.entries.length, 3);

const ambiguousPhones = importer.analyzeTables([
  {
    name: "שני מספרים",
    rows: [
      ["נועה כהן", "0501234567", "0521112233"],
      ["דניאל לוי", "0547654321", "0524445566"]
    ]
  }
], { normalizePhone, knownDepartments: [] });
assert.strictEqual(ambiguousPhones.status, "mapping_required");
const manualPhones = importer.parseManualMapping(
  ambiguousPhones,
  {
    sheetName: "שני מספרים",
    nameColumn: 0,
    phoneColumn: 1,
    departmentColumn: null
  },
  { normalizePhone }
);
assert.strictEqual(manualPhones.entries[0].phone, "+972501234567");

const unknownDepartment = analyze([
  {
    name: "מחלקה לא מוכרת",
    rows: [
      ["שם מלא", "טלפון", "קוד שיבוץ"],
      ["נועה כהן", "0501234567", "A-17"],
      ["דניאל לוי", "0547654321", "B-22"]
    ]
  }
], { knownDepartments: [] });
assert.strictEqual(unknownDepartment.parsed.entries.length, 2);
assert.strictEqual(
  unknownDepartment.mapping.departmentColumn,
  null,
  "Failure to identify a department must never reject valid name and phone rows"
);

assert.strictEqual(
  importer.inferMonthYear("interns_2026_09.xlsx", [], new Date("2025-01-01")),
  "2026-09"
);
assert.strictEqual(
  importer.inferMonthYear("סטאזרים נובמבר 2027.xlsx", [], new Date("2025-01-01")),
  "2027-11"
);
assert.strictEqual(
  importer.inferMonthYear(
    "סטאזרים_אוגוסט_2026.xlsx",
    [{ name: "שיבוץ", rows: [["טיפול נמרץ ילדים"]] }],
    new Date("2025-01-01")
  ),
  "2026-08",
  "Department text containing נמרץ must not be mistaken for the month מרץ"
);
assert.strictEqual(
  importer.inferMonthYear("ללא חודש.xlsx", [], new Date("2026-08-13")),
  "2026-08"
);

console.log("intern import tests: OK");
