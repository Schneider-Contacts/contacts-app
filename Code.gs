const FIREBASE_PROJECT_ID = "contacts-sch";
const FORM_EMAIL_HEADER = "Email";
const CONTACTS_SHEET_NAME = "contacts";
const CONTACTS_OLD_SHEET_NAME = "contacts_old";
const CONTACTS_OLD_PHONE_HEADER = "phone";
const CONTACTS_EMAIL_HEADER = "email";
const FORM_RESPONSES_SHEET_NAME = "Form Responses 1";
const FORM_TIMESTAMP_HEADERS = ["Timestamp", "חותמת זמן"];
const FORM_PHONE_HEADER = "מספר טלפון";
const CONTACTS_COLLECTION_NAME = "contacts";
const FIRESTORE_REQUEST_BATCH_SIZE = 100;
const CONTACT_OVERRIDES_COLLECTION_NAME = "contactOverrides";
const CONTACT_BUNDLE_COLLECTION_NAME = "contactBundles";
const CONTACT_BUNDLE_MANIFEST_ID = "manifest";
const CONTACT_BUNDLE_CHUNK_COUNT = 4;
const CONTACT_BUNDLE_SCHEMA_VERSION = 1;
const CONTACT_BUNDLE_MAX_PAYLOAD_BYTES = 850000;

// ספרייה חכמה: עמוד נתונים יחיד כל עוד הוא נכנס במגבלת Firestore,
// וחלוקה אוטומטית לעמודים נוספים רק כאשר הגודל מחייב זאת.
const CONTACT_DIRECTORY_COLLECTION_NAME = "contactDirectory";
const CONTACT_DIRECTORY_META_ID = "meta";
const CONTACT_DIRECTORY_PAGE_PREFIX = "page_";
const CONTACT_DIRECTORY_SCHEMA_VERSION = 2;
const CONTACT_DIRECTORY_TARGET_BYTES = 650000;
const CONTACT_DIRECTORY_MAX_BYTES = 900000;
const DIRECTORY_REBUILD_PENDING_KEY = "contacts_directory_rebuild_pending";
const DIRECTORY_REBUILD_REASON_KEY = "contacts_directory_rebuild_reason";
const DIRECTORY_REBUILD_CONTACTS_KEY = "contacts_directory_pending_contacts";
const DIRECTORY_REBUILD_TRIGGER_HANDLER = "processPendingDirectoryRebuild";

// אינדקס מקומי בגיליון עבור עדכון מייל לפי טלפון.
// הוא מונע סריקה מלאה של כל טבלאות המקור בכל בקשה.
const EMAIL_PHONE_INDEX_SHEET_NAME = "email_phone_index";
const EMAIL_PHONE_INDEX_HEADERS = [
  "phone",
  "locations_json",
  "display_name",
  "updated_at"
];
const ADMIN_OVERRIDE_FIELDS = [
  "id",
  "first_name_he",
  "last_name_he",
  "first_name_en",
  "last_name_en",
  "title_prefix",
  "role",
  "department",
  "hospital",
  "phone",
  "email",
  "source",
  "status",
  "created_at",
  "first_seen_at",
  "is_new_contact",
  "updated_at"
];

const EMAIL_UPDATE_SETTINGS_SHEET_NAME = "app_settings";
const EMAIL_UPDATE_LOG_SHEET_NAME = "email_update_log";
const EMAIL_UPDATE_OPEN_KEY = "email_update_open";
const DISABLE_REPLACED_EMAIL_KEY = "disable_replaced_email";
const MAIN_APP_URL_KEY = "main_app_url";
const DEFAULT_MAIN_APP_URL = "https://schneider-contacts.github.io/contacts-app/";

const EMAIL_UPDATE_SOURCE_SHEETS = [
  {
    sheetName: "contacts_old",
    phoneHeader: "phone",
    emailHeader: "email",
    firstNameHeader: "first_name_he",
    lastNameHeader: "last_name_he"
  },
  {
    sheetName: "Form Responses 1",
    phoneHeader: "מספר טלפון",
    emailHeader: "Email",
    firstNameHeader: "שם פרטי (עברית)",
    lastNameHeader: "שם משפחה (עברית)"
  }
];

const CONTACT_FIELDS = [
  "id",
  "first_name_he",
  "last_name_he",
  "first_name_en",
  "last_name_en",
  "title_prefix",
  "role",
  "department",
  "hospital",
  "phone",
  "email",
  "source",
  "status",
  "created_at",
  "updated_at"
];

const CONTACT_FIRESTORE_FIELDS = CONTACT_FIELDS.concat([
  "first_seen_at",
  "is_new_contact"
]);

function normalizeIsraeliPhone(phone) {
  if (!phone) return "";

  let num = String(phone).replace(/\D/g, "");

  if (num.startsWith("0")) {
    num = "972" + num.slice(1);
  } else if (!num.startsWith("972")) {
    num = "972" + num;
  }

  return "+" + num;
}

/**
 * מופעל אוטומטית לאחר שליחת הטופס.
 * מנרמל את הטלפון, מוסיף את המייל ל-allowedUsers,
 * ומנסה לסנכרן את איש הקשר החדש אל Firestore.
 */
function onFormSubmit(e) {
  if (!e || !e.range) {
    throw new Error(
      "הפונקציה onFormSubmit חייבת לפעול באמצעות טריגר של שליחת טופס."
    );
  }

  const sheet = e.range.getSheet();
  const row = e.range.getRow();

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const phoneCol = findHeaderColumn_(headers, "מספר טלפון");
  const emailCol = findHeaderColumn_(headers, FORM_EMAIL_HEADER);
  const firstNameCol = findHeaderColumn_(
    headers,
    "שם פרטי (עברית)"
  );
  const lastNameCol = findHeaderColumn_(
    headers,
    "שם משפחה (עברית)"
  );
  const timestampCol = findFirstHeaderColumn_(
    headers,
    FORM_TIMESTAMP_HEADERS
  );

  const submittedAt = timestampCol > 0
    ? normalizeDateToIso_(sheet.getRange(row, timestampCol).getValue())
    : new Date().toISOString();

  let normalizedPhone = "";

  if (phoneCol > 0) {
    const phoneCell = sheet.getRange(row, phoneCol);
    const currentPhone = phoneCell.getValue();
    normalizedPhone = normalizeIsraeliPhone(currentPhone);

    if (normalizedPhone) {
      phoneCell.setValue(normalizedPhone);
    }
  }

  if (emailCol === 0) {
    throw new Error(
      'לא נמצאה עמודת המייל "' +
        FORM_EMAIL_HEADER +
        '" בטאב ' +
        sheet.getName()
    );
  }

  const email = normalizeEmail_(
    sheet.getRange(row, emailCol).getValue()
  );

  if (!email) {
    throw new Error("שדה המייל ריק בשליחת הטופס.");
  }

  if (!isValidEmail_(email)) {
    throw new Error("כתובת המייל אינה תקינה: " + email);
  }

  const firstName = firstNameCol > 0
    ? cleanSheetValue_(
        sheet.getRange(row, firstNameCol).getValue()
      )
    : "";

  const lastName = lastNameCol > 0
    ? cleanSheetValue_(
        sheet.getRange(row, lastNameCol).getValue()
      )
    : "";

  const displayName = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  try {
    upsertEmailPhoneIndexFromFormSubmit_(sheet, row, headers);
  } catch (indexError) {
    console.error("עדכון אינדקס הטלפונים נכשל:", indexError);
  }

  upsertAllowedUser_(email, "google-form");

  let syncStatus = "updated";

  try {
    syncSubmittedContactToFirestore_(normalizedPhone, email, submittedAt);
  } catch (error) {
    syncStatus = "failed";

    console.error(
      "המייל אושר, אך סנכרון איש הקשר החדש ל-Firestore נכשל:",
      error
    );
  }

  try {
    appendFirestoreActivity_({
      action: "contact_add_form",
      targetEmail: email,
      targetPhone: normalizedPhone,
      displayName,
      actorEmail: email,
      source: "google-form",
      syncStatus,
      timestamp: submittedAt
    });
  } catch (activityError) {
    console.error(
      "כתיבת הפעילות האחרונה ל-Firestore נכשלה:",
      activityError
    );
  }
}

/**
 * יש להריץ פעם אחת בלבד כדי לסנכרן את כל המיילים
 * שכבר קיימים בטאב contacts.
 */
function syncExistingAllowedUsers() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CONTACTS_SHEET_NAME);

  if (!sheet) {
    throw new Error(
      'לא נמצא טאב בשם "' + CONTACTS_SHEET_NAME + '".'
    );
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2) {
    Logger.log("אין אנשי קשר לסנכרון.");
    return;
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0];

  const emailCol = findHeaderColumn_(headers, CONTACTS_EMAIL_HEADER);

  if (emailCol === 0) {
    throw new Error(
      'לא נמצאה עמודה בשם "' +
        CONTACTS_EMAIL_HEADER +
        '" בטאב ' +
        CONTACTS_SHEET_NAME
    );
  }

  const emailValues = sheet
    .getRange(2, emailCol, lastRow - 1, 1)
    .getDisplayValues()
    .flat();

  const uniqueEmails = [
    ...new Set(
      emailValues
        .map(normalizeEmail_)
        .filter(email => email && isValidEmail_(email))
    )
  ];

  if (!uniqueEmails.length) {
    Logger.log("לא נמצאו כתובות מייל תקינות לסנכרון.");
    return;
  }

  let successCount = 0;
  const failedEmails = [];

  uniqueEmails.forEach(email => {
    try {
      upsertAllowedUser_(email, "contacts-existing");
      successCount++;
    } catch (error) {
      failedEmails.push(email);
      console.error("נכשל סנכרון המייל " + email, error);
    }
  });

  Logger.log(
    "הסנכרון הסתיים. הצליחו: " +
      successCount +
      ", נכשלו: " +
      failedEmails.length
  );

  if (failedEmails.length) {
    throw new Error(
      "הסנכרון הסתיים חלקית. המיילים שנכשלו: " +
        failedEmails.join(", ")
    );
  }
}

/**
 * מסנכרן את רשימת אנשי הקשר לספרייה חכמה.
 * ברוב המקרים נכתב מסמך נתונים יחיד; עמודים נוספים נוצרים רק אם הגודל מחייב.
 */
function syncContactsToFirestore() {
  const contacts = readAndDeduplicateContacts_();
  const effectiveContacts = buildEffectiveDirectoryContacts_(contacts);
  const result = writeSmartContactDirectory_(effectiveContacts);

  // האינדקס נבנה בגיליון, ללא צריכת מכסת Firestore.
  rebuildEmailUpdatePhoneIndex();

  const properties = PropertiesService.getScriptProperties();
  properties.deleteProperty(DIRECTORY_REBUILD_PENDING_KEY);
  properties.deleteProperty(DIRECTORY_REBUILD_REASON_KEY);
  properties.deleteProperty(DIRECTORY_REBUILD_CONTACTS_KEY);
  removeDirectoryRebuildTriggers_();

  Logger.log(
    "הסנכרון החכם הסתיים. אנשי קשר: " +
      result.contactCount +
      ", עמודי נתונים: " +
      result.pageCount
  );

  return result;
}

function buildEffectiveDirectoryContacts_(contacts) {
  const overridesById = getAllContactOverrides_();
  const effectiveContacts = [];

  (Array.isArray(contacts) ? contacts : []).forEach(contact => {
    const documentId = getContactDocumentId_(contact);
    const effectiveContact = applyContactOverride_(
      contact,
      overridesById[documentId]
    );

    if (!effectiveContact) return;

    effectiveContacts.push({
      ...effectiveContact,
      docId: documentId
    });
  });

  return effectiveContacts;
}

function writeSmartContactDirectory_(contacts) {
  const token = ScriptApp.getOAuthToken();
  const version = new Date().toISOString() + "_" + Utilities.getUuid();
  const updatedAt = new Date().toISOString();
  const normalizedContacts = (Array.isArray(contacts) ? contacts : [])
    .map(contact => {
      const docId = cleanSheetValue_(
        contact.docId || getContactDocumentId_(contact)
      );

      return buildBundleContactPayload_(contact, docId);
    })
    .sort((a, b) => {
      const lastCompare = cleanSheetValue_(a.last_name_he)
        .localeCompare(cleanSheetValue_(b.last_name_he), "he");
      if (lastCompare !== 0) return lastCompare;
      return cleanSheetValue_(a.first_name_he)
        .localeCompare(cleanSheetValue_(b.first_name_he), "he");
    });

  const pages = packDirectoryContacts_(normalizedContacts);
  const pageIds = pages.map((_, index) =>
    CONTACT_DIRECTORY_PAGE_PREFIX + index
  );

  const pageRequests = pages.map((pageContacts, index) => {
    const request = buildDirectoryDocumentPatchRequest_(
      pageIds[index],
      {
        kind: "contacts_page",
        schemaVersion: CONTACT_DIRECTORY_SCHEMA_VERSION,
        version,
        pageIndex: index,
        contacts: pageContacts,
        updatedAt
      },
      token
    );

    const payloadBytes = Utilities
      .newBlob(request.payload)
      .getBytes()
      .length;

    if (payloadBytes > CONTACT_DIRECTORY_MAX_BYTES) {
      throw new Error(
        "עמוד אנשי הקשר " +
          index +
          " גדול מדי ל-Firestore. גודל: " +
          payloadBytes +
          " bytes."
      );
    }

    return request;
  });

  const pageResponses = UrlFetchApp.fetchAll(pageRequests);
  const failures = [];

  pageResponses.forEach((response, index) => {
    const code = response.getResponseCode();
    if (code >= 200 && code < 300) return;

    failures.push({
      documentId: pageIds[index],
      code,
      body: response.getContentText()
    });
  });

  if (failures.length) {
    throw new Error(
      "כתיבת ספריית אנשי הקשר נכשלה: " +
        JSON.stringify(failures.slice(0, 4))
    );
  }

  // ה-meta נכתב אחרון, כדי שהאפליקציה לא תקרא גרסה חלקית.
  const metaRequest = buildDirectoryDocumentPatchRequest_(
    CONTACT_DIRECTORY_META_ID,
    {
      kind: "contacts_directory_meta",
      schemaVersion: CONTACT_DIRECTORY_SCHEMA_VERSION,
      version,
      pageCount: pages.length,
      pageIds,
      contactCount: normalizedContacts.length,
      rebuildPending: false,
      updatedAt
    },
    token
  );

  const metaResponse = UrlFetchApp.fetch(metaRequest.url, {
    method: metaRequest.method,
    contentType: metaRequest.contentType,
    headers: metaRequest.headers,
    payload: metaRequest.payload,
    muteHttpExceptions: true
  });

  if (
    metaResponse.getResponseCode() < 200 ||
    metaResponse.getResponseCode() >= 300
  ) {
    throw new Error(
      "כתיבת meta של ספריית אנשי הקשר נכשלה. HTTP " +
        metaResponse.getResponseCode() +
        ": " +
        metaResponse.getContentText()
    );
  }

  return {
    contactCount: normalizedContacts.length,
    pageCount: pages.length,
    version
  };
}

function packDirectoryContacts_(contacts) {
  const pages = [];
  let currentPage = [];

  (Array.isArray(contacts) ? contacts : []).forEach(contact => {
    const candidate = currentPage.concat([contact]);
    const estimatedBytes = Utilities
      .newBlob(JSON.stringify({ contacts: candidate }))
      .getBytes()
      .length;

    if (
      currentPage.length > 0 &&
      estimatedBytes > CONTACT_DIRECTORY_TARGET_BYTES
    ) {
      pages.push(currentPage);
      currentPage = [contact];
      return;
    }

    currentPage = candidate;
  });

  if (currentPage.length || pages.length === 0) {
    pages.push(currentPage);
  }

  pages.forEach((page, index) => {
    const bytes = Utilities
      .newBlob(JSON.stringify({ contacts: page }))
      .getBytes()
      .length;

    if (bytes > CONTACT_DIRECTORY_MAX_BYTES) {
      throw new Error(
        "איש קשר או עמוד יחיד גדול מדי במספר עמוד " + index + "."
      );
    }
  });

  return pages;
}

function buildDirectoryDocumentPatchRequest_(documentId, data, token) {
  return {
    url:
      "https://firestore.googleapis.com/v1/projects/" +
      FIREBASE_PROJECT_ID +
      "/databases/(default)/documents/" +
      CONTACT_DIRECTORY_COLLECTION_NAME +
      "/" +
      encodeURIComponent(documentId),
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token
    },
    payload: JSON.stringify({
      fields: toFirestoreFields_(data)
    }),
    muteHttpExceptions: true
  };
}

function queueDirectoryRebuild_(reason, pendingContact) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty(DIRECTORY_REBUILD_PENDING_KEY, "true");
  properties.setProperty(
    DIRECTORY_REBUILD_REASON_KEY,
    cleanSheetValue_(reason || "data-change")
  );

  if (pendingContact && typeof pendingContact === "object") {
    let pending = [];

    try {
      pending = JSON.parse(
        properties.getProperty(DIRECTORY_REBUILD_CONTACTS_KEY) || "[]"
      );
    } catch (error) {
      pending = [];
    }

    const normalizedPhone = normalizeIsraeliPhone(pendingContact.phone);
    const normalizedEmail = normalizeEmail_(pendingContact.email);
    const existingIndex = pending.findIndex(item =>
      normalizeIsraeliPhone(item && item.phone) === normalizedPhone
    );
    const nextItem = {
      phone: normalizedPhone,
      email: normalizedEmail,
      submittedAt: normalizeDateToIso_(pendingContact.submittedAt) || ""
    };

    if (existingIndex >= 0) pending[existingIndex] = nextItem;
    else pending.push(nextItem);

    properties.setProperty(
      DIRECTORY_REBUILD_CONTACTS_KEY,
      JSON.stringify(pending.slice(-50))
    );
  }

  // אין יצירת טריגר בכל בקשת משתמש. setupAutomation יוצר טריגר קבוע
  // שרץ כל 5 דקות ומטפל בכל השינויים שנצברו יחד.
  return {
    queued: true,
    reason: reason || "data-change"
  };
}

function ensureDirectoryRebuildTrigger_(delayMs) {
  const existing = ScriptApp.getProjectTriggers().some(trigger =>
    trigger.getHandlerFunction() === DIRECTORY_REBUILD_TRIGGER_HANDLER
  );

  if (existing) return;

  ScriptApp.newTrigger(DIRECTORY_REBUILD_TRIGGER_HANDLER)
    .timeBased()
    .after(Math.max(5000, Number(delayMs || 15000)))
    .create();
}

function removeDirectoryRebuildTriggers_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === DIRECTORY_REBUILD_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

/**
 * מופעל ברקע לאחר שליחת טופס או עדכון מייל.
 * המשתמש אינו ממתין לבניית ספריית אנשי הקשר.
 */
function processPendingDirectoryRebuild() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(5000)) {
    return;
  }

  const properties = PropertiesService.getScriptProperties();

  try {
    if (properties.getProperty(DIRECTORY_REBUILD_PENDING_KEY) !== "true") {
      removeDirectoryRebuildTriggers_();
      return;
    }

    const contacts = readAndDeduplicateContacts_();
    let pending = [];

    try {
      pending = JSON.parse(
        properties.getProperty(DIRECTORY_REBUILD_CONTACTS_KEY) || "[]"
      );
    } catch (error) {
      pending = [];
    }

    // מסנכרן רק אנשי קשר שהתווספו לאחרונה למסמכים האישיים.
    const unresolved = [];

    pending.forEach(item => {
      const phone = normalizeIsraeliPhone(item && item.phone);
      const email = normalizeEmail_(item && item.email);
      const contact = contacts.find(candidate =>
        candidate.phone === phone ||
        (email && candidate.email === email)
      );

      if (!contact) {
        unresolved.push(item);
        return;
      }

      if (email) {
        contact.email = email;
        try {
          updateContactOverrideEmailIfPresent_(phone, email);
        } catch (overrideError) {
          console.error("עדכון מייל בשינוי אדמין ברקע נכשל:", overrideError);
        }
      }
      if (item.submittedAt) {
        contact.updated_at = normalizeDateToIso_(item.submittedAt);
      }

      upsertContact_(contact);
    });

    const effectiveContacts = buildEffectiveDirectoryContacts_(contacts);
    writeSmartContactDirectory_(effectiveContacts);

    removeDirectoryRebuildTriggers_();

    if (unresolved.length) {
      properties.setProperty(DIRECTORY_REBUILD_PENDING_KEY, "true");
      properties.setProperty(
        DIRECTORY_REBUILD_CONTACTS_KEY,
        JSON.stringify(unresolved)
      );
      ensureDirectoryRebuildTrigger_(60000);
    } else {
      properties.deleteProperty(DIRECTORY_REBUILD_PENDING_KEY);
      properties.deleteProperty(DIRECTORY_REBUILD_REASON_KEY);
      properties.deleteProperty(DIRECTORY_REBUILD_CONTACTS_KEY);
    }
  } catch (error) {
    console.error("בניית ספריית אנשי הקשר ברקע נכשלה:", error);
    properties.setProperty(DIRECTORY_REBUILD_PENDING_KEY, "true");
    removeDirectoryRebuildTriggers_();
    ensureDirectoryRebuildTrigger_(60000);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function processPendingDirectoryRebuildScheduled() {
  const properties = PropertiesService.getScriptProperties();

  if (properties.getProperty(DIRECTORY_REBUILD_PENDING_KEY) !== "true") {
    return;
  }

  processPendingDirectoryRebuild();
}

function firestoreValueToJs_(value) {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;

  if (value.arrayValue) {
    return (value.arrayValue.values || []).map(firestoreValueToJs_);
  }

  if (value.mapValue) {
    const output = {};
    const fields = value.mapValue.fields || {};

    Object.keys(fields).forEach(key => {
      output[key] = firestoreValueToJs_(fields[key]);
    });

    return output;
  }

  return null;
}

function firestoreDocumentToJs_(document) {
  const output = {};
  const fields = document && document.fields
    ? document.fields
    : {};

  Object.keys(fields).forEach(key => {
    output[key] = firestoreValueToJs_(fields[key]);
  });

  return output;
}

/**
 * מעדכן רק את ה-chunk שבו נמצא איש הקשר ואת ה-manifest.
 * כך עדכון מייל או שליחת טופס אינם בונים מחדש את כל ארבעת המקטעים.
 */
function updateSingleContactInBundle_(contact) {
  return queueDirectoryRebuild_("single-contact-update", {
    phone: contact && contact.phone,
    email: contact && contact.email,
    submittedAt: contact && contact.updated_at
  });
}

function getContactBundleChunkIndex_(documentId) {
  const value = String(documentId || "");
  let hash = 0;

  for (let index = 0; index < value.length; index++) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }

  return hash % CONTACT_BUNDLE_CHUNK_COUNT;
}

function buildBundleContactPayload_(contact, docId) {
  const payload = {
    docId: cleanSheetValue_(docId)
  };

  CONTACT_FIELDS.forEach(field => {
    payload[field] = cleanSheetValue_(contact[field]);
  });

  payload.phone = normalizeIsraeliPhone(payload.phone);
  payload.email = normalizeEmail_(payload.email);
  payload.first_seen_at = cleanSheetValue_(
    contact.first_seen_at || contact.created_at
  );
  payload.is_new_contact = contact.is_new_contact === true;

  return payload;
}

function buildBundleDocumentPatchRequest_(documentId, data, token) {
  return {
    url:
      "https://firestore.googleapis.com/v1/projects/" +
      FIREBASE_PROJECT_ID +
      "/databases/(default)/documents/" +
      CONTACT_BUNDLE_COLLECTION_NAME +
      "/" +
      encodeURIComponent(documentId),
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token
    },
    payload: JSON.stringify({
      fields: toFirestoreFields_(data)
    }),
    muteHttpExceptions: true
  };
}

function toFirestoreFields_(object) {
  const fields = {};

  Object.keys(object || {}).forEach(key => {
    fields[key] = toFirestoreValue_(object[key]);
  });

  return fields;
}

function toFirestoreValue_(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(toFirestoreValue_)
      }
    };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }

  if (typeof value === "object") {
    return {
      mapValue: {
        fields: toFirestoreFields_(value)
      }
    };
  }

  return { stringValue: String(value) };
}

/**
 * בדיקה בטוחה של איש קשר יחיד לפני הסנכרון המלא.
 */
function testOneContactSync() {
  const contacts = readAndDeduplicateContacts_();

  if (!contacts.length) {
    throw new Error("לא נמצא איש קשר תקין לבדיקה.");
  }

  const contact = contacts[0];
  upsertContact_(contact);

  Logger.log(
    "בדיקת איש קשר יחיד הצליחה: " +
      [contact.first_name_he, contact.last_name_he]
        .filter(Boolean)
        .join(" ") +
      " | " +
      contact.phone
  );
}

/**
 * מריצים פעם אחת כדי לאשר הרשאות ולוודא שקיים טריגר.
 * הפונקציה אינה יוצרת טריגר כפול.
 */

function auditAppDataFootprint() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = [
    CONTACTS_SHEET_NAME,
    CONTACTS_OLD_SHEET_NAME,
    FORM_RESPONSES_SHEET_NAME,
    EMAIL_PHONE_INDEX_SHEET_NAME,
    EMAIL_UPDATE_LOG_SHEET_NAME,
    EMAIL_UPDATE_SETTINGS_SHEET_NAME
  ];
  const sheets = {};

  sheetNames.forEach(name => {
    const sheet = spreadsheet.getSheetByName(name);
    sheets[name] = sheet
      ? {
          rows: sheet.getLastRow(),
          columns: sheet.getLastColumn(),
          cells: sheet.getLastRow() * sheet.getLastColumn()
        }
      : { missing: true };
  });

  const properties = PropertiesService.getScriptProperties().getProperties();
  const propertyKeys = Object.keys(properties);
  const propertyBytes = propertyKeys.reduce(
    (sum, key) => sum + key.length + String(properties[key] || "").length,
    0
  );
  const obsoleteResultKeys = propertyKeys.filter(key =>
    key.startsWith(EMAIL_UPDATE_RESULT_PROPERTY_PREFIX) ||
    key.startsWith("email-update-result:")
  );
  const triggers = ScriptApp.getProjectTriggers().map(trigger => ({
    handler: trigger.getHandlerFunction(),
    eventType: String(trigger.getEventType())
  }));

  const result = {
    sheets,
    scriptProperties: {
      count: propertyKeys.length,
      approximateBytes: propertyBytes,
      obsoleteEmailResultKeys: obsoleteResultKeys.length,
      directoryRebuildPending:
        properties[DIRECTORY_REBUILD_PENDING_KEY] === "true"
    },
    triggers
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function cleanupObsoleteRuntimeData() {
  const properties = PropertiesService.getScriptProperties();
  const allProperties = properties.getProperties();
  let removedProperties = 0;
  let removedTriggers = 0;

  Object.keys(allProperties).forEach(key => {
    if (
      key.startsWith(EMAIL_UPDATE_RESULT_PROPERTY_PREFIX) ||
      key.startsWith("email-update-result:")
    ) {
      properties.deleteProperty(key);
      removedProperties += 1;
    }
  });

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === DIRECTORY_REBUILD_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
      removedTriggers += 1;
    }
  });

  Logger.log(
    "נוקו " + removedProperties +
    " ערכי runtime ישנים ו-" + removedTriggers +
    " טריגרים חד-פעמיים ישנים."
  );

  return { removedProperties, removedTriggers };
}

function setupAutomation() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const triggers = ScriptApp.getProjectTriggers();
  const hasFormTrigger = triggers.some(trigger =>
    trigger.getHandlerFunction() === "onFormSubmit" &&
    trigger.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT
  );
  const hasDirectoryFallbackTrigger = triggers.some(trigger =>
    trigger.getHandlerFunction() === "processPendingDirectoryRebuildScheduled"
  );

  if (!hasFormTrigger) {
    ScriptApp.newTrigger("onFormSubmit")
      .forSpreadsheet(spreadsheet)
      .onFormSubmit()
      .create();
    Logger.log("נוצר טריגר חדש עבור onFormSubmit.");
  } else {
    Logger.log("כבר קיים טריגר תקין עבור onFormSubmit.");
  }

  if (!hasDirectoryFallbackTrigger) {
    ScriptApp.newTrigger("processPendingDirectoryRebuildScheduled")
      .timeBased()
      .everyMinutes(5)
      .create();
    Logger.log("נוצר טריגר גיבוי לעדכון הספרייה כל 5 דקות.");
  } else {
    Logger.log("כבר קיים טריגר גיבוי לעדכון הספרייה.");
  }
}

/**
 * בדיקה ידנית של החיבור ל-Firebase.
 * מעדכנת את המשתמש שכבר יצרת.
 */
function testFirebaseConnection() {
  upsertAllowedUser_("galnavon@me.com", "manual-test");
  Logger.log("בדיקת החיבור ל-Firebase הצליחה.");
}

function upsertAllowedUser_(email, source, knownExistingUser) {
  const normalizedEmail = normalizeEmail_(email);

  if (!normalizedEmail || !isValidEmail_(normalizedEmail)) {
    throw new Error("כתובת מייל אינה תקינה: " + email);
  }

  const existingUser = arguments.length >= 3
    ? knownExistingUser
    : getAllowedUser_(normalizedEmail);

  // חסימה יזומה של אדמין נשמרת גם אם המשתמש ממלא שוב את הטופס
  // או אם מריצים שוב את סנכרון המשתמשים הקיימים.
  if (existingUser && existingUser.active === false) {
    Logger.log(
      "ההרשאה נשארה חסומה ולא הופעלה מחדש: " + normalizedEmail
    );

    return {
      status: "blocked",
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
        booleanValue: true
      },
      email: {
        stringValue: normalizedEmail
      },
      source: {
        stringValue: source || "unknown"
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
      "כתיבת המייל ל-Firebase נכשלה. HTTP " +
        responseCode +
        ": " +
        responseBody
    );
  }

  return {
    status: existingUser ? "updated" : "created",
    email: normalizedEmail
  };
}

/**
 * קורא הרשאה קיימת מ-Firestore.
 * מחזיר null כאשר המסמך עדיין לא קיים.
 */
function getAllowedUser_(email) {
  const normalizedEmail = normalizeEmail_(email);
  const documentId = encodeURIComponent(normalizedEmail);

  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/allowedUsers/" +
    documentId;

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();

  if (responseCode === 404) {
    return null;
  }

  const responseBody = response.getContentText();

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(
      "קריאת ההרשאה מ-Firebase נכשלה. HTTP " +
        responseCode +
        ": " +
        responseBody
    );
  }

  const document = JSON.parse(responseBody || "{}");
  const fields = document.fields || {};

  return {
    email: fields.email && fields.email.stringValue
      ? fields.email.stringValue
      : normalizedEmail,
    active: fields.active &&
      typeof fields.active.booleanValue === "boolean"
        ? fields.active.booleanValue
        : true
  };
}

function syncSubmittedContactToFirestore_(submittedPhone, submittedEmail, submittedAt) {
  const normalizedPhone = normalizeIsraeliPhone(submittedPhone);
  const normalizedEmail = normalizeEmail_(submittedEmail);
  const normalizedSubmittedAt =
    normalizeDateToIso_(submittedAt) || new Date().toISOString();

  return queueDirectoryRebuild_("form-submit", {
    phone: normalizedPhone,
    email: normalizedEmail,
    submittedAt: normalizedSubmittedAt
  });
}

function upsertContact_(contact) {
  const documentId = getContactDocumentId_(contact);
  const override = getContactOverride_(documentId);
  const effectiveContact = applyContactOverride_(contact, override);

  if (!effectiveContact) {
    const deleteRequest = buildContactDeleteRequest_(
      documentId,
      ScriptApp.getOAuthToken()
    );
    const deleteResponse = UrlFetchApp.fetch(
      deleteRequest.url,
      {
        method: deleteRequest.method,
        headers: deleteRequest.headers,
        muteHttpExceptions: true
      }
    );
    const deleteCode = deleteResponse.getResponseCode();

    if (!(
      (deleteCode >= 200 && deleteCode < 300) ||
      deleteCode === 404
    )) {
      throw new Error(
        "מחיקת איש קשר שהוסר על ידי אדמין נכשלה. HTTP " +
          deleteCode +
          ": " +
          deleteResponse.getContentText()
      );
    }

    Logger.log(
      "איש הקשר " + documentId + " הוסר על ידי אדמין ולכן לא סונכרן."
    );
    return {
      skipped: true,
      reason: "admin-deleted"
    };
  }

  const request = buildContactPatchRequest_(
    effectiveContact,
    ScriptApp.getOAuthToken()
  );
  const url = request.url;
  delete request.url;

  const response = UrlFetchApp.fetch(url, request);

  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(
      "כתיבת איש הקשר ל-Firebase נכשלה. HTTP " +
        responseCode +
        ": " +
        responseBody
    );
  }

  return {
    skipped: false,
    contact: effectiveContact
  };
}

function buildContactDeleteRequest_(documentId, token) {
  return {
    url:
      "https://firestore.googleapis.com/v1/projects/" +
      FIREBASE_PROJECT_ID +
      "/databases/(default)/documents/" +
      CONTACTS_COLLECTION_NAME +
      "/" +
      encodeURIComponent(documentId),
    method: "delete",
    headers: {
      Authorization: "Bearer " + token
    },
    muteHttpExceptions: true
  };
}

function buildContactPatchRequest_(contact, token) {
  const documentId = getContactDocumentId_(contact);

  const updateMask = CONTACT_FIRESTORE_FIELDS
    .map(field => "updateMask.fieldPaths=" + encodeURIComponent(field))
    .join("&");

  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/" +
    CONTACTS_COLLECTION_NAME +
    "/" +
    encodeURIComponent(documentId) +
    "?" +
    updateMask;

  const fields = {};

  CONTACT_FIRESTORE_FIELDS.forEach(field => {
    if (field === "is_new_contact") {
      fields[field] = {
        booleanValue: contact[field] === true
      };
      return;
    }

    fields[field] = {
      stringValue: String(contact[field] || "")
    };
  });

  return {
    url,
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token
    },
    payload: JSON.stringify({ fields }),
    muteHttpExceptions: true
  };
}

function getContactDocumentId_(contact) {
  const phoneDigits = normalizeIsraeliPhone(contact.phone).replace(/\D/g, "");

  if (!phoneDigits) {
    throw new Error("לא ניתן ליצור מזהה לאיש קשר ללא מספר טלפון.");
  }

  return phoneDigits;
}


function getContactOverride_(documentId) {
  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/" +
    CONTACT_OVERRIDES_COLLECTION_NAME +
    "/" +
    encodeURIComponent(documentId);

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();

  if (responseCode === 404) {
    return null;
  }

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(
      "קריאת שינוי אדמין נכשלה. HTTP " +
        responseCode +
        ": " +
        response.getContentText()
    );
  }

  return parseContactOverrideDocument_(
    JSON.parse(response.getContentText() || "{}")
  );
}

function getAllContactOverrides_() {
  const result = {};
  let pageToken = "";

  do {
    let url =
      "https://firestore.googleapis.com/v1/projects/" +
      FIREBASE_PROJECT_ID +
      "/databases/(default)/documents/" +
      CONTACT_OVERRIDES_COLLECTION_NAME +
      "?pageSize=1000";

    if (pageToken) {
      url += "&pageToken=" + encodeURIComponent(pageToken);
    }

    const response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();

    if (responseCode === 404) {
      return result;
    }

    if (responseCode < 200 || responseCode >= 300) {
      throw new Error(
        "קריאת שינויי האדמין נכשלה. HTTP " +
          responseCode +
          ": " +
          response.getContentText()
      );
    }

    const payload = JSON.parse(response.getContentText() || "{}");

    (payload.documents || []).forEach(document => {
      const documentId = decodeURIComponent(
        String(document.name || "").split("/").pop()
      );

      result[documentId] = parseContactOverrideDocument_(document);
    });

    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return result;
}

function parseContactOverrideDocument_(document) {
  const fields = document.fields || {};
  const result = {
    deleted: Boolean(
      fields.deleted && fields.deleted.booleanValue === true
    )
  };

  ADMIN_OVERRIDE_FIELDS.forEach(field => {
    if (!fields[field]) return;

    if (field === "is_new_contact" && fields[field].booleanValue !== undefined) {
      result[field] = fields[field].booleanValue === true;
      return;
    }

    if (fields[field].stringValue !== undefined) {
      result[field] = fields[field].stringValue;
    }
  });

  return result;
}

function applyContactOverride_(contact, override) {
  if (!override) {
    return {
      ...contact,
      phone: normalizeIsraeliPhone(contact.phone),
      email: normalizeEmail_(contact.email)
    };
  }

  if (override.deleted === true) {
    return null;
  }

  const effectiveContact = {
    ...contact
  };

  ADMIN_OVERRIDE_FIELDS.forEach(field => {
    if (override[field] === undefined) return;

    if (field === "is_new_contact") {
      effectiveContact[field] = override[field] === true;
      return;
    }

    effectiveContact[field] = cleanSheetValue_(override[field]);
  });

  effectiveContact.phone = normalizeIsraeliPhone(effectiveContact.phone);
  effectiveContact.email = normalizeEmail_(effectiveContact.email);

  return effectiveContact;
}

function updateContactOverrideEmailIfPresent_(phone, newEmail) {
  const documentId = normalizeIsraeliPhone(phone).replace(/\D/g, "");
  if (!documentId) return;

  const override = getContactOverride_(documentId);
  if (!override || override.deleted === true) return;

  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/" +
    CONTACT_OVERRIDES_COLLECTION_NAME +
    "/" +
    encodeURIComponent(documentId) +
    "?updateMask.fieldPaths=email" +
    "&updateMask.fieldPaths=updated_at";

  const response = UrlFetchApp.fetch(url, {
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({
      fields: {
        email: {
          stringValue: normalizeEmail_(newEmail)
        },
        updated_at: {
          stringValue: new Date().toISOString()
        }
      }
    }),
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(
      "עדכון מייל בשינוי האדמין נכשל. HTTP " +
        responseCode +
        ": " +
        response.getContentText()
    );
  }
}

function readAndDeduplicateContacts_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CONTACTS_SHEET_NAME);

  if (!sheet) {
    throw new Error('לא נמצא טאב בשם "' + CONTACTS_SHEET_NAME + '".');
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }

  const values = sheet
    .getRange(1, 1, lastRow, lastColumn)
    .getDisplayValues();

  const headers = values[0].map(header => String(header).trim());

  const missingHeaders = CONTACT_FIELDS.filter(
    field => findHeaderColumn_(headers, field) === 0
  );

  if (missingHeaders.length) {
    throw new Error(
      "בטאב contacts חסרות הכותרות: " + missingHeaders.join(", ")
    );
  }

  const headerIndexes = {};
  CONTACT_FIELDS.forEach(field => {
    headerIndexes[field] = findHeaderColumn_(headers, field) - 1;
  });

  const rows = values.slice(1).map(row => {
    const contact = {};

    CONTACT_FIELDS.forEach(field => {
      contact[field] = cleanSheetValue_(row[headerIndexes[field]]);
    });

    contact.phone = normalizeIsraeliPhone(contact.phone);
    contact.email = normalizeEmail_(contact.email);

    return contact;
  }).filter(contact => contact.phone);

  const deduplicated = deduplicateContactRows_(rows);
  const formMetadataByPhone = getFormSubmissionMetadataByPhone_(spreadsheet);
  const legacyPhones = getLegacyPhoneSet_(spreadsheet);

  return deduplicated.map(contact =>
    enrichContactWithFormMetadata_(
      contact,
      formMetadataByPhone[contact.phone] || null,
      legacyPhones.has(contact.phone)
    )
  );
}

function findFirstHeaderColumn_(headers, candidates) {
  const values = Array.isArray(candidates) ? candidates : [candidates];

  for (let index = 0; index < values.length; index++) {
    const column = findHeaderColumn_(headers, values[index]);
    if (column > 0) return column;
  }

  return 0;
}

function normalizeDateToIso_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }

  if (typeof value === "number") {
    const milliseconds = value < 100000000000 ? value * 1000 : value;
    const dateFromNumber = new Date(milliseconds);
    return Number.isNaN(dateFromNumber.getTime())
      ? ""
      : dateFromNumber.toISOString();
  }

  const raw = cleanSheetValue_(value);
  if (!raw) return "";

  const match = raw.match(
    /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (match) {
    let year = match[3];
    if (year.length === 2) year = "20" + year;

    const parsed = new Date(
      Number(year),
      Number(match[2]) - 1,
      Number(match[1]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0)
    );

    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }

  const directDate = new Date(raw);
  return Number.isNaN(directDate.getTime())
    ? ""
    : directDate.toISOString();
}

function getLegacyPhoneSet_(spreadsheet) {
  const result = new Set();
  const sheet = spreadsheet.getSheetByName(CONTACTS_OLD_SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) {
    return result;
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const values = sheet
    .getRange(1, 1, lastRow, lastColumn)
    .getDisplayValues();
  const headers = values[0].map(header => String(header).trim());
  const phoneCol = findHeaderColumn_(headers, CONTACTS_OLD_PHONE_HEADER);

  if (phoneCol === 0) {
    Logger.log(
      'לא ניתן לזהות אנשי קשר ותיקים: חסרה עמודת phone בטאב contacts_old.'
    );
    return result;
  }

  values.slice(1).forEach(row => {
    const phone = normalizeIsraeliPhone(row[phoneCol - 1]);
    if (phone) result.add(phone);
  });

  return result;
}

function getFormSubmissionMetadataByPhone_(spreadsheet) {
  const result = {};
  const sheet = spreadsheet.getSheetByName(FORM_RESPONSES_SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) {
    return result;
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0];

  const phoneCol = findHeaderColumn_(headers, FORM_PHONE_HEADER);
  const timestampCol = findFirstHeaderColumn_(headers, FORM_TIMESTAMP_HEADERS);

  if (phoneCol === 0 || timestampCol === 0) {
    Logger.log(
      "לא ניתן להשלים תאריכי יצירה: חסרה עמודת טלפון או Timestamp בטאב " +
        FORM_RESPONSES_SHEET_NAME
    );
    return result;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getValues();

  values.forEach(row => {
    const phone = normalizeIsraeliPhone(row[phoneCol - 1]);
    const timestampIso = normalizeDateToIso_(row[timestampCol - 1]);

    if (!phone || !timestampIso) return;

    const timestampMs = new Date(timestampIso).getTime();
    const current = result[phone];

    if (!current) {
      result[phone] = {
        firstSubmittedAt: timestampIso,
        lastSubmittedAt: timestampIso,
        firstSubmittedAtMs: timestampMs,
        lastSubmittedAtMs: timestampMs
      };
      return;
    }

    if (timestampMs < current.firstSubmittedAtMs) {
      current.firstSubmittedAt = timestampIso;
      current.firstSubmittedAtMs = timestampMs;
    }

    if (timestampMs > current.lastSubmittedAtMs) {
      current.lastSubmittedAt = timestampIso;
      current.lastSubmittedAtMs = timestampMs;
    }
  });

  return result;
}

function enrichContactWithFormMetadata_(contact, metadata, isLegacyContact) {
  const enriched = {
    ...contact
  };

  const existingCreatedAt = normalizeDateToIso_(enriched.created_at);
  const existingUpdatedAt = normalizeDateToIso_(enriched.updated_at);
  const firstSubmittedAt = metadata && metadata.firstSubmittedAt
    ? metadata.firstSubmittedAt
    : "";

  if (existingCreatedAt) {
    enriched.created_at = existingCreatedAt;
  } else if (firstSubmittedAt) {
    enriched.created_at = firstSubmittedAt;
  }

  if (existingUpdatedAt) {
    enriched.updated_at = existingUpdatedAt;
  } else if (metadata && metadata.lastSubmittedAt) {
    enriched.updated_at = metadata.lastSubmittedAt;
  }

  // איש קשר נחשב חדש רק אם הופיע בטופס אך לא היה ברשימת contacts_old.
  // לכן מילוי חוזר של הטופס על ידי איש קשר ותיק אינו מסומן כחדש.
  enriched.is_new_contact = Boolean(metadata && !isLegacyContact);
  enriched.first_seen_at = enriched.is_new_contact
    ? (firstSubmittedAt || enriched.created_at || "")
    : "";

  if (metadata && !cleanSheetValue_(enriched.source)) {
    enriched.source = "google-form";
  }

  return enriched;
}

function deduplicateContactRows_(contacts) {
  const groupedByPhone = new Map();

  contacts.forEach(contact => {
    if (!groupedByPhone.has(contact.phone)) {
      groupedByPhone.set(contact.phone, []);
    }

    groupedByPhone.get(contact.phone).push(contact);
  });

  const result = [];

  groupedByPhone.forEach(group => {
    const sorted = [...group].sort(
      (a, b) => getContactRowScore_(b) - getContactRowScore_(a)
    );

    let merged = { ...sorted[0] };

    for (let index = 1; index < sorted.length; index++) {
      merged = mergeMissingContactFields_(merged, sorted[index]);
    }

    result.push(merged);
  });

  return result;
}

function getContactRowScore_(contact) {
  const values = CONTACT_FIELDS.map(field => cleanSheetValue_(contact[field]));
  const filledCount = values.filter(value => value !== "").length;
  const totalLength = values.reduce((sum, value) => sum + value.length, 0);

  return filledCount * 1000 + totalLength;
}

function mergeMissingContactFields_(base, extra) {
  const merged = { ...base };

  CONTACT_FIELDS.forEach(field => {
    if (!cleanSheetValue_(merged[field]) && cleanSheetValue_(extra[field])) {
      merged[field] = extra[field];
    }
  });

  merged.phone = normalizeIsraeliPhone(merged.phone);
  merged.email = normalizeEmail_(merged.email);

  return merged;
}

function cleanSheetValue_(value) {
  return String(value || "")
    .replace(/\u200E/g, "")
    .replace(/\u200F/g, "")
    .trim();
}

function findHeaderColumn_(headers, requiredHeader) {
  const normalizedRequiredHeader = String(requiredHeader)
    .trim()
    .toLowerCase();

  const index = headers.findIndex(header => {
    return (
      String(header).trim().toLowerCase() ===
      normalizedRequiredHeader
    );
  });

  return index + 1;
}

function normalizeEmail_(email) {
  return String(email || "")
    .replace(/\u200E/g, "")
    .replace(/\u200F/g, "")
    .trim()
    .toLowerCase();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


/* =========================================================
 * עמוד זמני להשלמה או החלפה של כתובת מייל
 * ========================================================= */

/**
 * יש להריץ פעם אחת מעורך Apps Script לפני פרסום ה-Web App.
 * הפונקציה יוצרת:
 * 1. טאב app_settings לניהול פתיחה וסגירה של העמוד.
 * 2. טאב email_update_log לתיעוד כל העדכונים.
 */

/**
 * מוסיף רשומה ליומן הפעילות שמוצג למנהלים באפליקציה.
 * הפעולה רצה בהרשאות Apps Script ולכן אינה תלויה בהרשאות המשתמש.
 */
function appendFirestoreActivity_(data) {
  const fields = {
    action: {
      stringValue: cleanSheetValue_(data.action || "system_activity")
    },
    timestamp: {
      timestampValue:
        normalizeDateToIso_(data.timestamp) || new Date().toISOString()
    }
  };

  const stringFields = [
    "targetEmail",
    "targetPhone",
    "displayName",
    "actorEmail",
    "adminEmail",
    "source",
    "syncStatus",
    "newEmail",
    "targetId"
  ];

  stringFields.forEach(fieldName => {
    const value = cleanSheetValue_(data[fieldName]);

    if (value) {
      fields[fieldName] = {
        stringValue: value
      };
    }
  });

  const arrayFields = [
    "oldEmails",
    "changedFields"
  ];

  arrayFields.forEach(fieldName => {
    const values = Array.isArray(data[fieldName])
      ? data[fieldName]
          .map(cleanSheetValue_)
          .filter(Boolean)
      : [];

    if (values.length) {
      fields[fieldName] = {
        arrayValue: {
          values: values.map(value => ({
            stringValue: value
          }))
        }
      };
    }
  });

  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/admin_actions";

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({
      fields
    }),
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(
      "כתיבת יומן הפעילות ל-Firestore נכשלה. HTTP " +
        responseCode +
        ": " +
        responseBody
    );
  }

  return JSON.parse(responseBody);
}

function setupEmailUpdatePortal() {
  const settingsSheet = ensureEmailUpdateSettingsSheet_();
  const logSheet = ensureEmailUpdateLogSheet_();

  Logger.log(
    "עמוד עדכון המייל מוכן. הטאבים קיימים: " +
      settingsSheet.getName() +
      ", " +
      logSheet.getName()
  );
}

/**
 * נקודת הכניסה של Apps Script Web App.
 */

/**
 * נקודת קצה עבור עמוד העדכון שמאוחסן ב-GitHub Pages.
 * העמוד שולח טופס POST ל-Web App ומקבל את התוצאה בחזרה
 * באמצעות postMessage מתוך iframe נסתר.
 */
const EMAIL_UPDATE_RESULT_CACHE_PREFIX = "email-update-result:";
const EMAIL_UPDATE_RESULT_PROPERTY_PREFIX = "email-update-result-durable:";
const EMAIL_UPDATE_RESULT_CACHE_SECONDS = 10 * 60;
const EMAIL_UPDATE_RESULT_PROPERTY_TTL_MS = 6 * 60 * 60 * 1000;

function cacheEmailUpdateResponse_(payload) {
  const requestId = cleanSheetValue_(
    payload && payload.requestId
  );

  if (!requestId) return;

  const persistedPayload = {
    ...payload,
    savedAt: Date.now()
  };
  const serializedPayload = JSON.stringify(persistedPayload);

  try {
    CacheService.getScriptCache().put(
      EMAIL_UPDATE_RESULT_CACHE_PREFIX + requestId,
      serializedPayload,
      EMAIL_UPDATE_RESULT_CACHE_SECONDS
    );
  } catch (cacheError) {
    console.error(
      "שמירת תשובת עדכון המייל במטמון נכשלה:",
      cacheError
    );
  }

  // CacheService הוא מנגנון best-effort ועלול להחזיר null גם לפני תום הזמן.
  // לכן נשמרת תשובה נוספת ב-Script Properties לצורך אישור אמין ללקוח.
  try {
    PropertiesService.getScriptProperties().setProperty(
      EMAIL_UPDATE_RESULT_PROPERTY_PREFIX + requestId,
      serializedPayload
    );
  } catch (propertyError) {
    console.error(
      "שמירת תשובת עדכון המייל באחסון המתמשך נכשלה:",
      propertyError
    );
  }

  if (Math.random() < 0.05) {
    cleanupExpiredEmailUpdateResponses_();
  }
}

function cleanupExpiredEmailUpdateResponses_() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const allProperties = properties.getProperties();
    const now = Date.now();

    Object.keys(allProperties).forEach(key => {
      if (!key.startsWith(EMAIL_UPDATE_RESULT_PROPERTY_PREFIX)) return;

      try {
        const parsed = JSON.parse(allProperties[key] || "{}");
        const savedAt = Number(parsed.savedAt || 0);

        if (!savedAt || now - savedAt > EMAIL_UPDATE_RESULT_PROPERTY_TTL_MS) {
          properties.deleteProperty(key);
        }
      } catch (error) {
        properties.deleteProperty(key);
      }
    });
  } catch (cleanupError) {
    console.error(
      "ניקוי תשובות עדכון מייל ישנות נכשל:",
      cleanupError
    );
  }
}

function getCachedEmailUpdateResponse_(requestId) {
  const normalizedRequestId = cleanSheetValue_(requestId);
  if (!normalizedRequestId) return null;

  try {
    const cachedValue = CacheService
      .getScriptCache()
      .get(EMAIL_UPDATE_RESULT_CACHE_PREFIX + normalizedRequestId);

    if (cachedValue) {
      return JSON.parse(cachedValue);
    }
  } catch (cacheError) {
    console.error(
      "קריאת תשובת עדכון המייל מהמטמון נכשלה:",
      cacheError
    );
  }

  try {
    const propertyKey =
      EMAIL_UPDATE_RESULT_PROPERTY_PREFIX + normalizedRequestId;
    const properties = PropertiesService.getScriptProperties();
    const storedValue = properties.getProperty(propertyKey);

    if (!storedValue) return null;

    const parsed = JSON.parse(storedValue);
    const savedAt = Number(parsed.savedAt || 0);

    if (
      !savedAt ||
      Date.now() - savedAt > EMAIL_UPDATE_RESULT_PROPERTY_TTL_MS
    ) {
      properties.deleteProperty(propertyKey);
      return null;
    }

    return parsed;
  } catch (propertyError) {
    console.error(
      "קריאת תשובת עדכון המייל מהאחסון המתמשך נכשלה:",
      propertyError
    );
    return null;
  }
}

function createEmailUpdateStatusJsonp_(e) {
  const requestId =
    e && e.parameter
      ? cleanSheetValue_(e.parameter.requestId)
      : "";

  let callback =
    e && e.parameter
      ? cleanSheetValue_(e.parameter.callback)
      : "";

  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    callback = "receiveEmailUpdateStatus";
  }

  const cachedPayload = getCachedEmailUpdateResponse_(requestId);
  const payload = cachedPayload || {
    source: "schneider-email-update",
    requestId: requestId,
    pending: true
  };

  const serializedPayload = JSON
    .stringify(payload)
    .replace(/</g, "\\u003c");

  return ContentService
    .createTextOutput(
      callback + "(" + serializedPayload + ");"
    )
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function escapeHtmlForOutput_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createEmailUpdateResultPage_(success, result, errorMessage) {
  const safeResult = result || {};
  const appUrl = cleanSheetValue_(safeResult.appUrl || DEFAULT_MAIN_APP_URL);
  const normalizedBaseUrl = appUrl.endsWith("/") ? appUrl : appUrl + "/";
  const updatePageUrl = normalizedBaseUrl + "email-update.html";
  const accountUrl =
    normalizedBaseUrl +
    "?authMode=register&email=" +
    encodeURIComponent(cleanSheetValue_(safeResult.email));
  const title = success ? "המייל עודכן בהצלחה" : "העדכון לא הושלם";
  const statusClass = success ? "success" : "error";
  const safeMessage = escapeHtmlForOutput_(
    success
      ? "כעת ניתן לפתוח חשבון באפליקציה באמצעות כתובת המייל החדשה."
      : (errorMessage || "העדכון נכשל. נסו שוב.")
  );
  const details = success
    ? '<div class="details"><b>' +
      escapeHtmlForOutput_(safeResult.displayName || "איש הקשר") +
      '</b><br>' +
      (safeResult.phone
        ? escapeHtmlForOutput_(safeResult.phone) + '<br>'
        : '') +
      'כתובת המייל המעודכנת: <b>' +
      escapeHtmlForOutput_(safeResult.email || "") +
      '</b></div>'
    : '';
  const steps = success
    ? '<ol>' +
      '<li>לחצו על „פתיחת חשבון באפליקציה”.</li>' +
      '<li>בחרו „יצירת חשבון” והגדירו סיסמה.</li>' +
      '<li>פתחו את מייל האימות ולחצו על הקישור. ב-Gmail בדקו גם בתיקיית הספאם.</li>' +
      '<li>חזרו לאפליקציה והתחברו עם המייל החדש והסיסמה.</li>' +
      '</ol>'
    : '';
  const primaryLink = success
    ? '<a class="primary" href="' +
      escapeHtmlForOutput_(accountUrl) +
      '">פתיחת חשבון באפליקציה</a>'
    : '<a class="primary" href="' +
      escapeHtmlForOutput_(updatePageUrl) +
      '">חזרה לעדכון המייל</a>';
  const secondaryLink = success
    ? '<a class="secondary" href="' +
      escapeHtmlForOutput_(updatePageUrl) +
      '">עדכון כתובת נוספת</a>'
    : '<a class="secondary" href="' +
      escapeHtmlForOutput_(normalizedBaseUrl) +
      '">חזרה לאפליקציה</a>';

  return '<!DOCTYPE html><html lang="he" dir="rtl"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="theme-color" content="#f4fbf7"><title>' + title + '</title>' +
    '<style>' +
    ':root{--g:#059669;--g2:#047857;--bg:#f4fbf7;--border:#d9efe4}' +
    '*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:24px 14px;background:radial-gradient(circle at top right,rgba(110,231,183,.24),transparent 34%),var(--bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#1f2937}' +
    '.card{width:100%;max-width:460px;margin:0 auto;background:#fff;border:1px solid var(--border);border-radius:24px;padding:26px 18px 22px;box-shadow:0 12px 34px rgba(15,23,42,.09)}' +
    '.icon{width:62px;height:62px;margin:0 auto 14px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:30px;background:#ecfdf5;border:1px solid #a7f3d0}' +
    'h1{margin:0 0 12px;text-align:center;font-size:25px;color:#17352d}.message{margin:0 0 16px;padding:13px 14px;border-radius:14px;line-height:1.6;font-size:14px}.message.success,.details{background:#ecfdf5;border:1px solid #a7f3d0;color:#295746}.message.error{background:#fff1f2;border:1px solid #fecdd3;color:#be123c}' +
    '.details{margin-bottom:16px;padding:14px;border-radius:15px;line-height:1.7;font-size:14px}ol{margin:0 0 18px;padding-right:21px;color:#405e52;line-height:1.75;font-size:14px}' +
    'a{width:100%;min-height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:15px;font-weight:700}.primary{background:var(--g);color:#fff;box-shadow:0 8px 20px rgba(5,150,105,.23)}.secondary{margin-top:10px;background:#ecfdf5;color:var(--g2);border:1px solid #a7f3d0}' +
    '@media(max-width:600px){body{padding:16px 12px}.card{border-radius:20px;padding:22px 15px 19px}h1{font-size:23px}}' +
    '</style></head><body><main class="card"><div class="icon">' +
    (success ? '✓' : '!') +
    '</div><h1>' + escapeHtmlForOutput_(title) + '</h1>' +
    '<div class="message ' + statusClass + '">' + safeMessage + '</div>' +
    details + steps + primaryLink + secondaryLink +
    '</main></body></html>';
}

function doPost(e) {
  try {
    if (
      !e ||
      !e.parameter ||
      cleanSheetValue_(e.parameter.action) !== "emailUpdate"
    ) {
      throw new Error("בקשה לא תקינה.");
    }

    const result = submitEmailUpdate({
      phone: e.parameter.phone,
      email: e.parameter.email,
      confirmEmail: e.parameter.confirmEmail,
      website: e.parameter.website
    });

    return HtmlService
      .createHtmlOutput(createEmailUpdateResultPage_(true, result, ""))
      .setTitle("המייל עודכן בהצלחה")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  } catch (error) {
    const message = error && error.message
      ? String(error.message)
      : "העדכון נכשל. נסו שוב.";

    return HtmlService
      .createHtmlOutput(createEmailUpdateResultPage_(false, null, message))
      .setTitle("עדכון המייל לא הושלם")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }
}

function doGet(e) {
  if (
    e &&
    e.parameter &&
    cleanSheetValue_(e.parameter.action) === "emailUpdateStatus"
  ) {
    return createEmailUpdateStatusJsonp_(e);
  }

  return HtmlService
    .createHtmlOutputFromFile("EmailUpdate")
    .setTitle("השלמת או עדכון כתובת מייל")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

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
  existingUser
) {
  const normalizedEmail = normalizeEmail_(newEmail);
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

  const now = new Date().toISOString();
  const documentId = encodeURIComponent(normalizedEmail);
  const masks = [
    "active",
    "email",
    "source",
    "updatedAt",
    "pendingOldEmails",
    "pendingEmailReplacement",
    "replacementRequestedAt"
  ]
    .map(field => "updateMask.fieldPaths=" + encodeURIComponent(field))
    .join("&");
  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/allowedUsers/" +
    documentId +
    "?" +
    masks;

  const response = UrlFetchApp.fetch(url, {
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({
      fields: {
        active: { booleanValue: true },
        email: { stringValue: normalizedEmail },
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
      }
    }),
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(
      "שמירת הרשאת המייל נכשלה. HTTP " +
        responseCode +
        ": " +
        response.getContentText()
    );
  }

  return {
    status: existingUser ? "updated" : "created",
    email: normalizedEmail,
    pendingOldEmails: normalizedPending
  };
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

  const existingNewUser = getAllowedUser_(newEmail);
  if (existingNewUser && existingNewUser.active === false) {
    throw new Error(
      "כתובת המייל הזו חסומה במערכת. יש לפנות למנהל ספר אנשי הקשר."
    );
  }

  let matches = [];
  let oldEmails = [];
  let displayName = "";
  let updatedSheets = [];
  let allowedStatus = "";
  let firestoreStatus = "";
  let pendingOldEmails = [];

  // הנעילה מגינה רק על איתור ועדכון השורות בגיליון.
  // פעולות Firebase והספרייה ברקע אינן מחזיקות את הנעילה.
  const lock = LockService.getDocumentLock() || LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error("המערכת עסוקה בעדכון אחר. נסו שוב בעוד מספר שניות.");
  }

  try {
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
  } finally {
    lock.releaseLock();
  }

  try {
    pendingOldEmails = getEligiblePendingOldEmails_(oldEmails);
    const allowedResult = upsertAllowedUserForEmailReplacement_(
      newEmail,
      pendingOldEmails,
      existingNewUser
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
      result: "success"
    });

    try {
      appendFirestoreActivity_({
        action: "email_self_update",
        targetEmail: newEmail,
        targetPhone: normalizedPhone,
        displayName,
        actorEmail: newEmail,
        source: "self-service-email-update",
        oldEmails,
        newEmail
      });
    } catch (activityError) {
      console.error(
        "כתיבת עדכון המייל ליומן הפעילות נכשלה:",
        activityError
      );
    }

    return {
      success: true,
      displayName: displayName || "איש הקשר",
      phone: formatIsraeliPhoneForDisplay_(normalizedPhone),
      email: newEmail,
      updatedRows: matches.length,
      appUrl: getEmailUpdateSetting_(
        MAIN_APP_URL_KEY,
        DEFAULT_MAIN_APP_URL
      ),
      pendingOldEmails
    };
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
        result: "error: " + cleanSheetValue_(error.message)
      });
    } catch (logError) {
      console.error("כתיבת יומן השגיאות נכשלה:", logError);
    }

    throw error;
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

