/**
 * מחזיר ל-Web App את מצב העמוד ואת כתובת האפליקציה הראשית.
 */
function getEmailUpdatePortalStatus() {
  return {
    open: isEmailUpdatePortalOpen_(),
    appUrl: getEmailUpdateSetting_(
      MAIN_APP_URL_KEY,
      DEFAULT_MAIN_APP_URL
    )
  };
}

/**
 * הפונקציה שנקראת מהעמוד הציבורי.
 * מחפשת את מספר הטלפון בשני טבלאות המקור, מעדכנת את המייל,
 * מוסיפה הרשאה ל-Firebase ומסנכרנת את איש הקשר ל-Firestore.
 */
function upsertAllowedUserForEmailReplacement_(
  newEmail,
  pendingOldEmails,
  existingUser,
  phone,
  existingPhonePermission
) {
  const normalizedEmail = normalizeEmail_(newEmail);
  const normalizedPhone = normalizeIsraeliPhone(phone);
  const phoneKey = getAllowedPhoneDocumentId_(normalizedPhone);

  if (!isValidNormalizedIsraeliPhone_(normalizedPhone) || !phoneKey) {
    throw new Error("לא ניתן לעדכן הרשאה ללא מספר טלפון תקין.");
  }

  const normalizedPending = [
    ...new Set(
      (Array.isArray(pendingOldEmails) ? pendingOldEmails : [])
        .map(normalizeEmail_)
        .filter(email => email && email !== normalizedEmail)
    )
  ];

  if (existingUser && existingUser.active === false) {
    throw new Error(
      "כתובת המייל הזו חסומה במערכת. יש לפנות למנהל ספר אנשי הקשר."
    );
  }

  if (existingPhonePermission && existingPhonePermission.active === false) {
    throw new Error(
      "הגישה של מספר הטלפון הזה חסומה. יש לפנות למנהל ספר אנשי הקשר."
    );
  }

  if (
    existingUser &&
    existingUser.active === true &&
    existingUser.phone &&
    normalizeIsraeliPhone(existingUser.phone) !== normalizedPhone
  ) {
    throw new Error(
      "כתובת המייל הזו כבר משויכת למספר טלפון אחר. יש לפנות למנהל ספר אנשי הקשר."
    );
  }

  const now = new Date().toISOString();
  const isNewGrant = !existingUser;
  const userUpdateFields = [
    "active",
    "email",
    "phone",
    "phoneKey",
    "source",
    "updatedAt",
    "pendingOldEmails",
    "pendingEmailReplacement",
    "replacementRequestedAt"
  ];

  if (isNewGrant) {
    userUpdateFields.push("accessGrantedAt", "accessGrantSource");
  }

  const userFields = {
    active: { booleanValue: true },
    email: { stringValue: normalizedEmail },
    phone: { stringValue: normalizedPhone },
    phoneKey: { stringValue: phoneKey },
    source: { stringValue: "self-service-email-update" },
    updatedAt: { timestampValue: now },
    pendingOldEmails: {
      arrayValue: {
        values: normalizedPending.map(email => ({ stringValue: email }))
      }
    },
    pendingEmailReplacement: {
      booleanValue: normalizedPending.length > 0
    },
    replacementRequestedAt: { timestampValue: now }
  };

  if (isNewGrant) {
    userFields.accessGrantedAt = { timestampValue: now };
    userFields.accessGrantSource = {
      stringValue: "self-service-email-update"
    };
  }

  const phoneUpdateFields = [
    "phone",
    "phoneKey",
    "email",
    "active",
    "source",
    "updatedAt"
  ];
  const phoneFields = {
    phone: { stringValue: normalizedPhone },
    phoneKey: { stringValue: phoneKey },
    email: { stringValue: normalizedEmail },
    active: { booleanValue: true },
    source: { stringValue: "self-service-email-update" },
    updatedAt: { timestampValue: now }
  };
  const userWrite = {
    update: {
      name: getFirestoreDocumentName_("allowedUsers", normalizedEmail),
      fields: userFields
    },
    updateMask: {
      fieldPaths: userUpdateFields
    },
    currentDocument: existingUser && existingUser.updateTime
      ? { updateTime: existingUser.updateTime }
      : { exists: false }
  };
  const phoneWrite = {
    update: {
      name: getFirestoreDocumentName_(
        ALLOWED_PHONES_COLLECTION_NAME,
        phoneKey
      ),
      fields: phoneFields
    },
    updateMask: {
      fieldPaths: phoneUpdateFields
    },
    currentDocument:
      existingPhonePermission && existingPhonePermission.updateTime
        ? { updateTime: existingPhonePermission.updateTime }
        : { exists: false }
  };

  try {
    commitFirestoreWrites_([userWrite, phoneWrite]);
  } catch (error) {
    // אם התקבלה שגיאת רשת לאחר commit מוצלח, קריאה חוזרת מונעת
    // הצגת כשל שגוי או כתיבה כפולה.
    const savedUser = getAllowedUser_(normalizedEmail);
    const savedPhone = getAllowedPhonePermission_(normalizedPhone);
    const pairIsConsistent = Boolean(
      savedUser &&
      savedUser.active === true &&
      normalizeIsraeliPhone(savedUser.phone) === normalizedPhone &&
      savedUser.phoneKey === phoneKey &&
      savedPhone &&
      savedPhone.active === true &&
      normalizeEmail_(savedPhone.email) === normalizedEmail
    );

    if (!pairIsConsistent) {
      throw error;
    }
  }

  return {
    status: isNewGrant ? "created" : "updated",
    email: normalizedEmail,
    phone: normalizedPhone,
    phoneKey,
    pendingOldEmails: normalizedPending,
    accessGrantedAt: isNewGrant ? now : ""
  };
}

function maskEmailAddress_(email) {
  const normalized = normalizeEmail_(email);
  const parts = normalized.split("@");
  if (parts.length !== 2) return "";

  const local = parts[0];
  const visibleLocal = local.length <= 2
    ? local.slice(0, 1) + "*"
    : local.slice(0, 2) + "***";

  return visibleLocal + "@" + parts[1];
}

function submitEmailUpdate(formData) {
  if (!isEmailUpdatePortalOpen_()) {
    throw new Error(
      "האפשרות להשלמת או עדכון כתובת מייל סגורה כעת."
    );
  }

  if (!formData || typeof formData !== "object") {
    throw new Error("לא התקבלו נתונים תקינים.");
  }

  if (cleanSheetValue_(formData.website)) {
    throw new Error("לא ניתן להשלים את הבקשה.");
  }

  const normalizedPhone = normalizeIsraeliPhone(formData.phone);
  const newEmail = normalizeEmail_(formData.email);
  const confirmEmail = normalizeEmail_(formData.confirmEmail);
  const confirmedRecentChange =
    cleanSheetValue_(formData.confirmRecentChange) === "1";

  if (!isValidNormalizedIsraeliPhone_(normalizedPhone)) {
    throw new Error(
      "מספר הטלפון אינו תקין. יש להזין את המספר שמופיע בספר אנשי הקשר."
    );
  }

  if (!newEmail || !isValidEmail_(newEmail)) {
    throw new Error("כתובת המייל אינה תקינה.");
  }

  if (newEmail !== confirmEmail) {
    throw new Error("כתובות המייל שהוזנו אינן תואמות.");
  }

  let matches = [];
  let oldEmails = [];
  let displayName = "";
  let updatedSheets = [];
  let allowedStatus = "";
  let firestoreStatus = "";
  let pendingOldEmails = [];
  let sheetWasUpdated = false;

  // נעילה אחת מגינה על בדיקת הכפילות, עדכון הגיליון והרשאת Firebase.
  // נפח השימוש נמוך ולכן סדרה קצרה של עדכוני מייל עדיפה על שתי פעולות כפולות.
  const lock = LockService.getDocumentLock() || LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("המערכת עסוקה בעדכון אחר. נסו שוב בעוד מספר שניות.");
  }

  try {
    const recentResult = getRecentEmailUpdateResult_(
      normalizedPhone,
      newEmail
    );
    const existingNewUser = getAllowedUser_(newEmail);
    const existingPhonePermission = getAllowedPhonePermission_(
      normalizedPhone
    );

    if (existingNewUser && existingNewUser.active === false) {
      throw new Error(
        "כתובת המייל הזו חסומה במערכת. יש לפנות למנהל ספר אנשי הקשר."
      );
    }

    if (
      existingPhonePermission &&
      existingPhonePermission.active === false
    ) {
      throw new Error(
        "הגישה של מספר הטלפון הזה חסומה. יש לפנות למנהל ספר אנשי הקשר."
      );
    }

    if (
      existingPhonePermission &&
      existingPhonePermission.active === true &&
      !isValidEmail_(normalizeEmail_(existingPhonePermission.email))
    ) {
      throw new Error(
        "הרשאת הטלפון הקיימת אינה תקינה. יש לפנות למנהל ספר אנשי הקשר."
      );
    }

    if (
      existingNewUser &&
      existingNewUser.active === true &&
      existingNewUser.phone &&
      normalizeIsraeliPhone(existingNewUser.phone) !== normalizedPhone
    ) {
      throw new Error(
        "כתובת המייל הזו כבר משויכת למספר טלפון אחר. יש לפנות למנהל ספר אנשי הקשר."
      );
    }

    const existingPairIsConsistent = Boolean(
      existingNewUser &&
      existingNewUser.active === true &&
      normalizeIsraeliPhone(existingNewUser.phone) === normalizedPhone &&
      existingNewUser.phoneKey ===
        getAllowedPhoneDocumentId_(normalizedPhone) &&
      existingPhonePermission &&
      existingPhonePermission.active === true &&
      normalizeEmail_(existingPhonePermission.email) === newEmail
    );

    if (
      recentResult &&
      recentResult.success === true &&
      existingPairIsConsistent
    ) {
      clearPublicAuthRouteCache_("email", newEmail);
      return Object.assign({}, recentResult, {
        duplicate: true,
        appUrl: getEmailUpdateSetting_(
          MAIN_APP_URL_KEY,
          DEFAULT_MAIN_APP_URL
        )
      });
    }

    const recentPhoneUpdate = getRecentEmailUpdateForPhone_(
      normalizedPhone
    );
    let conflictingEmail = "";

    if (
      existingPhonePermission &&
      existingPhonePermission.active === true
    ) {
      const activePhoneEmail = normalizeEmail_(
        existingPhonePermission.email
      );
      if (activePhoneEmail !== newEmail) {
        conflictingEmail = activePhoneEmail;
      }
    } else if (
      recentPhoneUpdate &&
      normalizeEmail_(recentPhoneUpdate.email) !== newEmail
    ) {
      conflictingEmail = normalizeEmail_(recentPhoneUpdate.email);
    }

    if (
      conflictingEmail &&
      !confirmedRecentChange
    ) {
      return {
        requiresChoice: true,
        phone: formatIsraeliPhoneForDisplay_(normalizedPhone),
        attemptedEmail: newEmail,
        previousEmail: conflictingEmail,
        previousEmailMasked: maskEmailAddress_(conflictingEmail),
        appUrl: getEmailUpdateSetting_(
          MAIN_APP_URL_KEY,
          DEFAULT_MAIN_APP_URL
        )
      };
    }

    matches = findEmailUpdateMatches_(normalizedPhone);

    if (!matches.length) {
      appendEmailUpdateLog_({
        phone: normalizedPhone,
        displayName: "",
        oldEmails: [],
        newEmail,
        updatedSheets: [],
        matchedRows: 0,
        allowedStatus: "not-run",
        firestoreStatus: "not-run",
        result: "phone-not-found"
      });

      throw new Error(
        "מספר הטלפון לא נמצא ברשימה. ודאו שהוזן אותו מספר שמופיע בספר אנשי הקשר."
      );
    }

    displayName = getBestDisplayNameFromMatches_(matches);
    oldEmails = [
      ...new Set(
        matches
          .map(match => normalizeEmail_(match.oldEmail))
          .filter(email => email && email !== newEmail)
      )
    ];
    updatedSheets = [
      ...new Set(matches.map(match => match.sheetName))
    ];

    updateMatchedEmailCells_(matches, newEmail);
    sheetWasUpdated = true;

    pendingOldEmails = getBooleanEmailUpdateSetting_(
      DISABLE_REPLACED_EMAIL_KEY,
      false
    )
      ? getEligiblePendingOldEmails_(oldEmails)
      : [];
    const allowedResult = upsertAllowedUserForEmailReplacement_(
      newEmail,
      pendingOldEmails,
      existingNewUser,
      normalizedPhone,
      existingPhonePermission
    );
    allowedStatus = allowedResult.status;

    queueDirectoryRebuild_("email-update", {
      phone: normalizedPhone,
      email: newEmail,
      submittedAt: new Date().toISOString()
    });
    firestoreStatus = "queued-background-update";

    appendEmailUpdateLog_({
      phone: normalizedPhone,
      displayName,
      oldEmails,
      newEmail,
      updatedSheets,
      matchedRows: matches.length,
      allowedStatus,
      firestoreStatus,
      result: confirmedRecentChange
        ? "success-confirmed-recent-change"
        : "success"
    });

    try {
      appendFirestoreActivity_({
        action: "email_self_update",
        targetEmail: newEmail,
        targetPhone: normalizedPhone,
        displayName,
        actorEmail: newEmail,
        source: confirmedRecentChange
          ? "self-service-email-correction"
          : "self-service-email-update",
        oldEmails,
        newEmail
      });

      if (allowedStatus === "created") {
        appendFirestoreActivity_({
          action: "access_auto_granted",
          targetEmail: newEmail,
          targetPhone: normalizedPhone,
          displayName,
          actorEmail: newEmail,
          source: "self-service-email-update"
        });
      }
    } catch (activityError) {
      console.error(
        "כתיבת עדכון המייל ליומן הפעילות נכשלה:",
        activityError
      );
    }

    clearPublicAuthRouteCache_("email", newEmail);

    const successResult = {
      success: true,
      displayName: displayName || "איש הקשר",
      phone: formatIsraeliPhoneForDisplay_(normalizedPhone),
      email: newEmail,
      updatedRows: matches.length,
      appUrl: getEmailUpdateSetting_(
        MAIN_APP_URL_KEY,
        DEFAULT_MAIN_APP_URL
      ),
      pendingOldEmails,
      correctedRecentEmail: confirmedRecentChange
    };

    rememberEmailUpdateResult_(
      normalizedPhone,
      newEmail,
      successResult
    );

    return successResult;
  } catch (error) {
    try {
      appendEmailUpdateLog_({
        phone: normalizedPhone,
        displayName,
        oldEmails,
        newEmail,
        updatedSheets,
        matchedRows: matches.length,
        allowedStatus: allowedStatus || "failed-or-not-run",
        firestoreStatus: firestoreStatus || "failed-or-not-run",
        result:
          (sheetWasUpdated ? "partial-after-sheet-update: " : "error: ") +
          cleanSheetValue_(error.message)
      });
    } catch (logError) {
      console.error("כתיבת יומן השגיאות נכשלה:", logError);
    }

    throw error;
  } finally {
    lock.releaseLock();
  }
}

/**
 * מאתר את כל השורות המתאימות למספר בשני טבלאות המקור.
 */
function ensureEmailPhoneIndexSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(EMAIL_PHONE_INDEX_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(EMAIL_PHONE_INDEX_SHEET_NAME);
  }

  const currentHeaders = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), EMAIL_PHONE_INDEX_HEADERS.length))
        .getDisplayValues()[0]
    : [];

  const headersMatch = EMAIL_PHONE_INDEX_HEADERS.every(
    (header, index) => cleanSheetValue_(currentHeaders[index]) === header
  );

  if (!headersMatch) {
    sheet.clear();
    sheet.getRange(1, 1, 1, EMAIL_PHONE_INDEX_HEADERS.length)
      .setValues([EMAIL_PHONE_INDEX_HEADERS]);
  }

  try {
    sheet.hideSheet();
  } catch (error) {
    // הטאב יכול כבר להיות מוסתר.
  }

  return sheet;
}

function rebuildEmailUpdatePhoneIndex() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const grouped = {};
  const updatedAt = new Date().toISOString();

  EMAIL_UPDATE_SOURCE_SHEETS.forEach(config => {
    const sheet = spreadsheet.getSheetByName(config.sheetName);
    if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return;

    const values = sheet
      .getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
      .getDisplayValues();
    const headers = values[0].map(cleanSheetValue_);
    const phoneColumn = findHeaderColumn_(headers, config.phoneHeader);
    const emailColumn = findHeaderColumn_(headers, config.emailHeader);
    const firstNameColumn = findHeaderColumn_(headers, config.firstNameHeader);
    const lastNameColumn = findHeaderColumn_(headers, config.lastNameHeader);

    if (!phoneColumn || !emailColumn) return;

    values.slice(1).forEach((row, index) => {
      const phone = normalizeIsraeliPhone(row[phoneColumn - 1]);
      if (!phone) return;

      if (!grouped[phone]) {
        grouped[phone] = {
          locations: [],
          names: []
        };
      }

      grouped[phone].locations.push({
        sheetName: config.sheetName,
        row: index + 2,
        phoneColumn,
        emailColumn,
        firstNameColumn,
        lastNameColumn
      });

      const displayName = [
        firstNameColumn ? row[firstNameColumn - 1] : "",
        lastNameColumn ? row[lastNameColumn - 1] : ""
      ]
        .map(cleanSheetValue_)
        .filter(Boolean)
        .join(" ")
        .trim();

      if (displayName) grouped[phone].names.push(displayName);
    });
  });

  const indexSheet = ensureEmailPhoneIndexSheet_();
  const rows = Object.keys(grouped)
    .sort()
    .map(phone => {
      const item = grouped[phone];
      const displayName = item.names
        .slice()
        .sort((a, b) => b.length - a.length)[0] || "";

      return [
        phone,
        JSON.stringify(item.locations),
        displayName,
        updatedAt
      ];
    });

  const existingRows = Math.max(0, indexSheet.getLastRow() - 1);
  if (existingRows > 0) {
    indexSheet
      .getRange(2, 1, existingRows, EMAIL_PHONE_INDEX_HEADERS.length)
      .clearContent();
  }

  if (rows.length) {
    indexSheet
      .getRange(2, 1, rows.length, EMAIL_PHONE_INDEX_HEADERS.length)
      .setValues(rows);
  }

  CacheService.getScriptCache().removeAll(
    Object.keys(grouped).slice(0, 1000).map(phone =>
      "email-phone-index:" + phone.replace(/\D/g, "")
    )
  );

  Logger.log("נבנה אינדקס טלפונים עבור " + rows.length + " מספרים.");
  return { indexedPhones: rows.length };
}

function upsertEmailPhoneIndexFromFormSubmit_(sheet, row, headers) {
  const config = EMAIL_UPDATE_SOURCE_SHEETS.find(item =>
    item.sheetName === sheet.getName()
  );

  if (!config) return;

  const normalizedHeaders = headers.map(cleanSheetValue_);
  const phoneColumn = findHeaderColumn_(normalizedHeaders, config.phoneHeader);
  const emailColumn = findHeaderColumn_(normalizedHeaders, config.emailHeader);
  const firstNameColumn = findHeaderColumn_(normalizedHeaders, config.firstNameHeader);
  const lastNameColumn = findHeaderColumn_(normalizedHeaders, config.lastNameHeader);

  if (!phoneColumn || !emailColumn) return;

  const phone = normalizeIsraeliPhone(
    sheet.getRange(row, phoneColumn).getDisplayValue()
  );
  if (!phone) return;

  const existing = getEmailPhoneIndexLocations_(phone);
  const nextLocation = {
    sheetName: sheet.getName(),
    row,
    phoneColumn,
    emailColumn,
    firstNameColumn,
    lastNameColumn
  };
  const locations = existing.filter(location => !(
    location.sheetName === nextLocation.sheetName &&
    Number(location.row) === Number(nextLocation.row)
  ));
  locations.push(nextLocation);

  saveEmailPhoneIndexLocations_(phone, locations);
}

function getEmailPhoneIndexLocations_(phone) {
  const normalizedPhone = normalizeIsraeliPhone(phone);
  const cacheKey = "email-phone-index:" + normalizedPhone.replace(/\D/g, "");
  const cache = CacheService.getScriptCache();

  try {
    const cached = cache.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    // ממשיכים לאינדקס בגיליון.
  }

  const indexSheet = ensureEmailPhoneIndexSheet_();
  if (indexSheet.getLastRow() < 2) return [];

  const match = indexSheet
    .getRange(2, 1, indexSheet.getLastRow() - 1, 1)
    .createTextFinder(normalizedPhone)
    .matchEntireCell(true)
    .findNext();

  if (!match) return [];

  try {
    const raw = indexSheet.getRange(match.getRow(), 2).getDisplayValue();
    const parsed = JSON.parse(raw || "[]");
    const locations = Array.isArray(parsed) ? parsed : [];
    try {
      cache.put(cacheKey, JSON.stringify(locations), 6 * 60 * 60);
    } catch (error) {
      // המטמון הוא אופטימיזציה בלבד.
    }
    return locations;
  } catch (error) {
    return [];
  }
}

function saveEmailPhoneIndexLocations_(phone, locations) {
  const normalizedPhone = normalizeIsraeliPhone(phone);
  const indexSheet = ensureEmailPhoneIndexSheet_();
  let targetRow = 0;

  if (indexSheet.getLastRow() >= 2) {
    const match = indexSheet
      .getRange(2, 1, indexSheet.getLastRow() - 1, 1)
      .createTextFinder(normalizedPhone)
      .matchEntireCell(true)
      .findNext();
    if (match) targetRow = match.getRow();
  }

  if (!targetRow) targetRow = Math.max(2, indexSheet.getLastRow() + 1);

  const matches = readIndexedLocations_(normalizedPhone, locations, false);
  indexSheet.getRange(targetRow, 1, 1, EMAIL_PHONE_INDEX_HEADERS.length)
    .setValues([[
      normalizedPhone,
      JSON.stringify(locations),
      getBestDisplayNameFromMatches_(matches),
      new Date().toISOString()
    ]]);

  try {
    CacheService.getScriptCache().put(
      "email-phone-index:" + normalizedPhone.replace(/\D/g, ""),
      JSON.stringify(locations),
      6 * 60 * 60
    );
  } catch (error) {
    // המטמון הוא אופטימיזציה בלבד.
  }
}

function readIndexedLocations_(phone, locations, validatePhone) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const matches = [];

  (Array.isArray(locations) ? locations : []).forEach(location => {
    const sheet = spreadsheet.getSheetByName(location.sheetName);
    const row = Number(location.row || 0);
    const phoneColumn = Number(location.phoneColumn || 0);
    const emailColumn = Number(location.emailColumn || 0);

    if (!sheet || row < 2 || !phoneColumn || !emailColumn) return;
    if (row > sheet.getLastRow()) return;

    const maxColumn = Math.max(
      phoneColumn,
      emailColumn,
      Number(location.firstNameColumn || 0),
      Number(location.lastNameColumn || 0)
    );
    const values = sheet.getRange(row, 1, 1, maxColumn).getDisplayValues()[0];
    const rowPhone = normalizeIsraeliPhone(values[phoneColumn - 1]);

    if (validatePhone !== false && rowPhone !== normalizeIsraeliPhone(phone)) {
      return;
    }

    matches.push({
      sheetName: location.sheetName,
      row,
      emailColumn,
      oldEmail: values[emailColumn - 1],
      firstName: location.firstNameColumn
        ? values[Number(location.firstNameColumn) - 1]
        : "",
      lastName: location.lastNameColumn
        ? values[Number(location.lastNameColumn) - 1]
        : ""
    });
  });

  return matches;
}

function findEmailUpdateMatches_(normalizedPhone) {
  try {
    const indexedLocations = getEmailPhoneIndexLocations_(normalizedPhone);
    const indexedMatches = readIndexedLocations_(
      normalizedPhone,
      indexedLocations,
      true
    );

    if (indexedMatches.length) {
      return indexedMatches;
    }
  } catch (indexError) {
    console.error("קריאת אינדקס הטלפונים נכשלה; עובר לחיפוש ישיר:", indexError);
  }

  let matches = findEmailUpdateMatchesWithTextFinder_(normalizedPhone);

  if (!matches.length) {
    matches = findEmailUpdateMatchesByFullScan_(normalizedPhone);
  }

  if (matches.length) {
    const locations = matches.map(match => ({
      sheetName: match.sheetName,
      row: match.row,
      phoneColumn: match.phoneColumn,
      emailColumn: match.emailColumn,
      firstNameColumn: match.firstNameColumn,
      lastNameColumn: match.lastNameColumn
    }));

    try {
      saveEmailPhoneIndexLocations_(normalizedPhone, locations);
    } catch (indexWriteError) {
      console.error("שמירת אינדקס הטלפונים נכשלה:", indexWriteError);
    }
  }

  return matches;
}

function findEmailUpdateMatchesWithTextFinder_(normalizedPhone) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const matches = [];
  const digits = normalizedPhone.replace(/\D/g, "");
  const localDigits = digits.startsWith("972")
    ? "0" + digits.slice(3)
    : digits;
  const variants = [
    normalizedPhone,
    digits,
    localDigits,
    formatIsraeliPhoneForDisplay_(normalizedPhone)
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  EMAIL_UPDATE_SOURCE_SHEETS.forEach(config => {
    const sheet = spreadsheet.getSheetByName(config.sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0]
      .map(cleanSheetValue_);
    const phoneColumn = findHeaderColumn_(headers, config.phoneHeader);
    const emailColumn = findHeaderColumn_(headers, config.emailHeader);
    const firstNameColumn = findHeaderColumn_(headers, config.firstNameHeader);
    const lastNameColumn = findHeaderColumn_(headers, config.lastNameHeader);

    if (!phoneColumn || !emailColumn) return;

    const phoneRange = sheet.getRange(2, phoneColumn, sheet.getLastRow() - 1, 1);
    const rows = new Set();

    variants.forEach(variant => {
      phoneRange
        .createTextFinder(variant)
        .matchEntireCell(true)
        .findAll()
        .forEach(cell => rows.add(cell.getRow()));
    });

    rows.forEach(row => {
      const maxColumn = Math.max(
        phoneColumn,
        emailColumn,
        firstNameColumn,
        lastNameColumn
      );
      const values = sheet.getRange(row, 1, 1, maxColumn).getDisplayValues()[0];

      if (normalizeIsraeliPhone(values[phoneColumn - 1]) !== normalizedPhone) {
        return;
      }

      matches.push({
        sheetName: config.sheetName,
        row,
        phoneColumn,
        emailColumn,
        firstNameColumn,
        lastNameColumn,
        oldEmail: values[emailColumn - 1],
        firstName: firstNameColumn ? values[firstNameColumn - 1] : "",
        lastName: lastNameColumn ? values[lastNameColumn - 1] : ""
      });
    });
  });

  return matches;
}

function findEmailUpdateMatchesByFullScan_(normalizedPhone) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const matches = [];

  EMAIL_UPDATE_SOURCE_SHEETS.forEach(config => {
    const sheet = spreadsheet.getSheetByName(config.sheetName);

    if (!sheet) {
      throw new Error('לא נמצא טאב המקור "' + config.sheetName + '".');
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 2 || lastColumn < 1) return;

    const values = sheet
      .getRange(1, 1, lastRow, lastColumn)
      .getDisplayValues();
    const headers = values[0].map(cleanSheetValue_);
    const phoneColumn = findHeaderColumn_(headers, config.phoneHeader);
    const emailColumn = findHeaderColumn_(headers, config.emailHeader);
    const firstNameColumn = findHeaderColumn_(headers, config.firstNameHeader);
    const lastNameColumn = findHeaderColumn_(headers, config.lastNameHeader);

    if (!phoneColumn || !emailColumn) {
      throw new Error(
        'בטאב "' + config.sheetName + '" חסרה עמודת טלפון או מייל.'
      );
    }

    for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
      if (
        normalizeIsraeliPhone(values[rowIndex][phoneColumn - 1]) !==
        normalizedPhone
      ) {
        continue;
      }

      matches.push({
        sheetName: config.sheetName,
        row: rowIndex + 1,
        phoneColumn,
        emailColumn,
        firstNameColumn,
        lastNameColumn,
        oldEmail: values[rowIndex][emailColumn - 1],
        firstName: firstNameColumn
          ? values[rowIndex][firstNameColumn - 1]
          : "",
        lastName: lastNameColumn
          ? values[rowIndex][lastNameColumn - 1]
          : ""
      });
    }
  });

  return matches;
}

/**
 * מעדכן את כל השורות שנמצאו.
 */
function updateMatchedEmailCells_(matches, newEmail) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const bySheet = {};

  (Array.isArray(matches) ? matches : []).forEach(match => {
    if (!bySheet[match.sheetName]) bySheet[match.sheetName] = [];
    bySheet[match.sheetName].push(
      columnToLetter_(Number(match.emailColumn)) + Number(match.row)
    );
  });

  Object.keys(bySheet).forEach(sheetName => {
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('לא נמצא טאב המקור "' + sheetName + '".');
    }

    sheet.getRangeList(bySheet[sheetName]).setValue(newEmail);
  });
}

function columnToLetter_(column) {
  let value = Math.max(1, Number(column || 1));
  let result = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

/**
 * ממתין לעדכון הטאב contacts ומסנכרן את איש הקשר ל-Firestore.
 * גם אם נוסחת contacts עדיין לא התעדכנה, המייל החדש נכתב למסמך.
 */
function syncUpdatedContactToFirestore_(phone, newEmail) {
  const normalizedPhone = normalizeIsraeliPhone(phone);
  const normalizedEmail = normalizeEmail_(newEmail);
  const documentId = normalizedPhone.replace(/\D/g, "");
  const now = new Date().toISOString();
  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/" +
    CONTACTS_COLLECTION_NAME +
    "/" +
    encodeURIComponent(documentId) +
    "?updateMask.fieldPaths=email" +
    "&updateMask.fieldPaths=updated_at" +
    "&currentDocument.exists=true";

  const response = UrlFetchApp.fetch(url, {
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({
      fields: {
        email: { stringValue: normalizedEmail },
        updated_at: { stringValue: now }
      }
    }),
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  const missingDocument =
    responseCode === 404 ||
    responseCode === 409 ||
    responseCode === 412 ||
    (
      responseCode === 400 &&
      /NOT_FOUND|FAILED_PRECONDITION/i.test(responseBody)
    );

  // אם המסמך האישי עדיין לא נוצר, הבנייה ברקע תיצור אותו מהטאב contacts.
  if (
    !missingDocument &&
    (responseCode < 200 || responseCode >= 300)
  ) {
    throw new Error(
      "עדכון מסמך איש הקשר נכשל. HTTP " +
        responseCode +
        ": " +
        responseBody
    );
  }

  updateContactOverrideEmailIfPresent_(normalizedPhone, normalizedEmail);
  queueDirectoryRebuild_("email-update", {
    phone: normalizedPhone,
    email: normalizedEmail,
    submittedAt: now
  });

  return {
    directContactUpdated: responseCode >= 200 && responseCode < 300,
    directoryQueued: true
  };
}

/**
 * מחזיר שם להצגה מתוך אחת השורות שנמצאו.
 */
function getBestDisplayNameFromMatches_(matches) {
  const names = matches
    .map(match =>
      [match.firstName, match.lastName]
        .map(cleanSheetValue_)
        .filter(Boolean)
        .join(" ")
        .trim()
    )
    .filter(Boolean);

  if (!names.length) {
    return "";
  }

  return names.sort((a, b) => b.length - a.length)[0];
}

/**
 * בודק אם מייל ישן עדיין משויך לאדם אחר באחת מטבלאות המקור.
 */
function getEligiblePendingOldEmails_(oldEmails) {
  const candidates = [
    ...new Set(
      (Array.isArray(oldEmails) ? oldEmails : [])
        .map(normalizeEmail_)
        .filter(Boolean)
    )
  ];

  if (!candidates.length) return [];

  const candidateSet = new Set(candidates);
  const stillUsed = new Set();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  EMAIL_UPDATE_SOURCE_SHEETS.forEach(config => {
    const sheet = spreadsheet.getSheetByName(config.sheetName);
    if (!sheet || sheet.getLastRow() < 2 || stillUsed.size === candidateSet.size) {
      return;
    }

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0]
      .map(cleanSheetValue_);
    const emailColumn = findHeaderColumn_(headers, config.emailHeader);
    if (!emailColumn) return;

    const values = sheet
      .getRange(2, emailColumn, sheet.getLastRow() - 1, 1)
      .getDisplayValues()
      .flat();

    values.forEach(value => {
      const normalized = normalizeEmail_(value);
      if (candidateSet.has(normalized)) stillUsed.add(normalized);
    });
  });

  return candidates.filter(email => !stillUsed.has(email));
}

function backfillPendingEmailReplacementsFromLog() {
  if (
    !getBooleanEmailUpdateSetting_(
      DISABLE_REPLACED_EMAIL_KEY,
      false
    )
  ) {
    Logger.log(
      "disable_replaced_email כבוי; לא הוכנו הרשאות ישנות להשבתה."
    );
    return { prepared: 0, disabledBySetting: true };
  }

  const sheet = ensureEmailUpdateLogSheet_();

  if (sheet.getLastRow() < 2) {
    Logger.log("לא נמצאו עדכוני מייל קודמים לשחזור.");
    return { prepared: 0 };
  }

  const values = sheet
    .getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
    .getDisplayValues();
  const headers = values[0].map(cleanSheetValue_);
  const oldEmailsColumn = findHeaderColumn_(headers, "old_emails");
  const newEmailColumn = findHeaderColumn_(headers, "new_email");
  const resultColumn = findHeaderColumn_(headers, "result");

  if (!oldEmailsColumn || !newEmailColumn || !resultColumn) {
    throw new Error(
      "טאב email_update_log אינו כולל את כל הכותרות הנדרשות."
    );
  }

  const processedNewEmails = new Set();
  let prepared = 0;

  for (let index = values.length - 1; index >= 1; index--) {
    const row = values[index];
    const result = cleanSheetValue_(row[resultColumn - 1]);
    const newEmail = normalizeEmail_(row[newEmailColumn - 1]);

    if (result !== "success" || !newEmail) continue;
    if (processedNewEmails.has(newEmail)) continue;
    processedNewEmails.add(newEmail);

    const loggedOldEmails = cleanSheetValue_(
      row[oldEmailsColumn - 1]
    )
      .split(",")
      .map(normalizeEmail_)
      .filter(Boolean);
    const eligibleOldEmails = getEligiblePendingOldEmails_(
      loggedOldEmails
    );

    if (!eligibleOldEmails.length) continue;

    setPendingEmailReplacement_(newEmail, eligibleOldEmails);
    prepared += 1;
  }

  Logger.log(
    "הוכנו " + prepared + " החלפות מייל להשלמה לאחר כניסה מאומתת."
  );

  return { prepared };
}

function setPendingEmailReplacement_(newEmail, oldEmails) {
  const normalizedNewEmail = normalizeEmail_(newEmail);
  const pendingOldEmails = [
    ...new Set(
      (Array.isArray(oldEmails) ? oldEmails : [])
        .map(normalizeEmail_)
        .filter(
          email =>
            email &&
            email !== normalizedNewEmail
        )
    )
  ];
  const documentId = encodeURIComponent(normalizedNewEmail);
  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/allowedUsers/" +
    documentId +
    "?updateMask.fieldPaths=pendingOldEmails" +
    "&updateMask.fieldPaths=pendingEmailReplacement" +
    "&updateMask.fieldPaths=replacementRequestedAt" +
    "&updateMask.fieldPaths=updatedAt";

  const payload = {
    fields: {
      pendingOldEmails: {
        arrayValue: {
          values: pendingOldEmails.map(email => ({
            stringValue: email
          }))
        }
      },
      pendingEmailReplacement: {
        booleanValue: pendingOldEmails.length > 0
      },
      replacementRequestedAt: {
        timestampValue: new Date().toISOString()
      },
      updatedAt: {
        timestampValue: new Date().toISOString()
      }
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (
    response.getResponseCode() < 200 ||
    response.getResponseCode() >= 300
  ) {
    throw new Error(
      "שמירת החלפת המייל הממתינה נכשלה. HTTP " +
        response.getResponseCode() +
        ": " +
        response.getContentText()
    );
  }

  return pendingOldEmails;
}

/**
 * משבית הרשאה קיימת. לא יוצר מסמך חסום חדש אם המייל לא היה קיים.
 */
function setAllowedUserActive_(email, active, source) {
  const normalizedEmail = normalizeEmail_(email);
  const existingUser = getAllowedUser_(normalizedEmail);

  if (!existingUser) {
    return {
      status: "not-found",
      email: normalizedEmail
    };
  }

  const documentId = encodeURIComponent(normalizedEmail);
  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/allowedUsers/" +
    documentId +
    "?updateMask.fieldPaths=active" +
    "&updateMask.fieldPaths=email" +
    "&updateMask.fieldPaths=source" +
    "&updateMask.fieldPaths=updatedAt";

  const payload = {
    fields: {
      active: {
        booleanValue: Boolean(active)
      },
      email: {
        stringValue: normalizedEmail
      },
      source: {
        stringValue: source || "manual"
      },
      updatedAt: {
        timestampValue: new Date().toISOString()
      }
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(
      "עדכון הרשאת המייל הישן נכשל. HTTP " +
        responseCode +
        ": " +
        responseBody
    );
  }

  return {
    status: active ? "enabled" : "disabled",
    email: normalizedEmail
  };
}

/**
 * יוצר או משלים את טאב ההגדרות.
 */
function ensureEmailUpdateSettingsSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(
    EMAIL_UPDATE_SETTINGS_SHEET_NAME
  );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      EMAIL_UPDATE_SETTINGS_SHEET_NAME
    );
    sheet
      .getRange(1, 1, 1, 3)
      .setValues([["key", "value", "description"]]);
  }

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const values = sheet
    .getRange(1, 1, lastRow, Math.max(sheet.getLastColumn(), 3))
    .getDisplayValues();

  const headers = values[0].map(cleanSheetValue_);

  if (
    headers[0] !== "key" ||
    headers[1] !== "value" ||
    headers[2] !== "description"
  ) {
    throw new Error(
      'הטאב "' +
        EMAIL_UPDATE_SETTINGS_SHEET_NAME +
        '" קיים אך הכותרות שלו אינן מתאימות.'
    );
  }

  const existingKeys = new Set(
    values
      .slice(1)
      .map(row => cleanSheetValue_(row[0]))
      .filter(Boolean)
  );

  const defaultRows = [
    [
      EMAIL_UPDATE_OPEN_KEY,
      "TRUE",
      "שנו ל-FALSE כדי לסגור מיד את עמוד עדכון המייל"
    ],
    [
      DISABLE_REPLACED_EMAIL_KEY,
      "FALSE",
      "TRUE ישבית מייל ישן שאינו משויך עוד לאף איש קשר"
    ],
    [
      MAIN_APP_URL_KEY,
      DEFAULT_MAIN_APP_URL,
      "כתובת האפליקציה הראשית"
    ]
  ].filter(row => !existingKeys.has(row[0]));

  if (defaultRows.length) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, defaultRows.length, 3)
      .setValues(defaultRows);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 3);

  return sheet;
}

/**
 * יוצר את טאב היומן אם אינו קיים.
 */
function ensureEmailUpdateLogSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(
    EMAIL_UPDATE_LOG_SHEET_NAME
  );

  const headers = [
    "timestamp",
    "phone",
    "name",
    "old_emails",
    "new_email",
    "updated_sheets",
    "matched_rows",
    "allowed_user_status",
    "firestore_status",
    "result"
  ];

  if (!sheet) {
    sheet = spreadsheet.insertSheet(EMAIL_UPDATE_LOG_SHEET_NAME);
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    const currentHeaders = sheet
      .getRange(1, 1, 1, headers.length)
      .getDisplayValues()[0]
      .map(cleanSheetValue_);

    if (
      currentHeaders.some(
        (header, index) => header !== headers[index]
      )
    ) {
      throw new Error(
        'הטאב "' +
          EMAIL_UPDATE_LOG_SHEET_NAME +
          '" קיים אך הכותרות שלו אינן מתאימות.'
      );
    }
  }

  return sheet;
}

function appendEmailUpdateLog_(data) {
  const sheet = ensureEmailUpdateLogSheet_();

  sheet.appendRow([
    new Date(),
    data.phone || "",
    data.displayName || "",
    (data.oldEmails || []).join(", "),
    data.newEmail || "",
    (data.updatedSheets || []).join(", "),
    Number(data.matchedRows || 0),
    data.allowedStatus || "",
    data.firestoreStatus || "",
    data.result || ""
  ]);
}

/**
 * קורא ערך מטאב ההגדרות.
 */
function getEmailUpdateSetting_(key, defaultValue) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(
    EMAIL_UPDATE_SETTINGS_SHEET_NAME
  );

  if (!sheet || sheet.getLastRow() < 2) {
    return defaultValue;
  }

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 2)
    .getDisplayValues();

  const match = values.find(
    row => cleanSheetValue_(row[0]) === key
  );

  return match ? cleanSheetValue_(match[1]) : defaultValue;
}

function getBooleanEmailUpdateSetting_(key, defaultValue) {
  const value = getEmailUpdateSetting_(
    key,
    defaultValue ? "TRUE" : "FALSE"
  );

  return String(value).trim().toUpperCase() === "TRUE";
}

function isEmailUpdatePortalOpen_() {
  return getBooleanEmailUpdateSetting_(
    EMAIL_UPDATE_OPEN_KEY,
    false
  );
}

function isValidNormalizedIsraeliPhone_(phone) {
  const digits = cleanSheetValue_(phone).replace(/\D/g, "");

  return (
    digits.startsWith("972") &&
    (digits.length === 11 || digits.length === 12)
  );
}

function formatIsraeliPhoneForDisplay_(phone) {
  let digits = normalizeIsraeliPhone(phone).replace(/\D/g, "");

  if (digits.startsWith("972")) {
    digits = "0" + digits.slice(3);
  }

  if (digits.length === 10) {
    return (
      digits.slice(0, 3) +
      "-" +
      digits.slice(3, 6) +
      "-" +
      digits.slice(6)
    );
  }

  if (digits.length === 9) {
    return (
      digits.slice(0, 2) +
      "-" +
      digits.slice(2, 5) +
      "-" +
      digits.slice(5)
    );
  }

  return phone;
}
