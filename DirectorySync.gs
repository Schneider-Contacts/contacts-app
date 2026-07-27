/**
 * מסנכרן את רשימת אנשי הקשר לספרייה חכמה.
 * ברוב המקרים נכתב מסמך נתונים יחיד; עמודים נוספים נוצרים רק אם הגודל מחייב.
 */
function syncContactsToFirestore() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error(
      "ספריית אנשי הקשר כבר נבנית בתהליך אחר. נסו שוב בעוד מספר שניות."
    );
  }

  try {
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
  } finally {
    lock.releaseLock();
  }
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
  const versionKey = Utilities.getUuid().replace(/-/g, "");
  const version = new Date().toISOString() + "_" + versionKey;
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
    CONTACT_DIRECTORY_PAGE_PREFIX + versionKey + "_" + index
  );
  const existingDirectoryState = readExistingDirectoryState_(token);
  const previousPageIds = existingDirectoryState.pageIds;

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
      previousPageIds,
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

  // שומרים דור אחד קודם כדי שלקוח שכבר קרא את ה-meta הישן
  // יוכל להשלים את הטעינה. רק הדור שקדם לו נמחק כעת.
  deleteStaleDirectoryPages_(
    existingDirectoryState.previousPageIds,
    pageIds.concat(previousPageIds),
    token
  );

  return {
    contactCount: normalizedContacts.length,
    pageCount: pages.length,
    version
  };
}

function readExistingDirectoryState_(token) {
  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/" +
    CONTACT_DIRECTORY_COLLECTION_NAME +
    "/" +
    CONTACT_DIRECTORY_META_ID;

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 404) {
      return { pageIds: [], previousPageIds: [] };
    }
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      console.warn("לא ניתן לקרוא meta קודם לצורך ניקוי עמודים ישנים.");
      return { pageIds: [], previousPageIds: [] };
    }

    const document = JSON.parse(response.getContentText() || "{}");
    const data = firestoreDocumentToJs_(document);
    return {
      pageIds: Array.isArray(data.pageIds)
        ? data.pageIds.map(String)
        : [],
      previousPageIds: Array.isArray(data.previousPageIds)
        ? data.previousPageIds.map(String)
        : []
    };
  } catch (error) {
    console.warn("קריאת עמודי הספרייה הקודמים נכשלה:", error);
    return { pageIds: [], previousPageIds: [] };
  }
}

function deleteStaleDirectoryPages_(previousPageIds, currentPageIds, token) {
  const currentSet = new Set((currentPageIds || []).map(String));
  const staleIds = (previousPageIds || [])
    .map(String)
    .filter(pageId => pageId && !currentSet.has(pageId));

  if (!staleIds.length) return;

  const requests = staleIds.map(pageId => ({
    url:
      "https://firestore.googleapis.com/v1/projects/" +
      FIREBASE_PROJECT_ID +
      "/databases/(default)/documents/" +
      CONTACT_DIRECTORY_COLLECTION_NAME +
      "/" +
      encodeURIComponent(pageId),
    method: "delete",
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  }));

  try {
    UrlFetchApp.fetchAll(requests).forEach((response, index) => {
      const code = response.getResponseCode();
      if ((code < 200 || code >= 300) && code !== 404) {
        console.warn(
          "מחיקת עמוד ספרייה ישן נכשלה: " +
            staleIds[index] +
            " HTTP " +
            code
        );
      }
    });
  } catch (error) {
    // ניקוי עמודים ישנים אינו צריך להפיל סנכרון שכבר הצליח.
    console.warn("ניקוי עמודי ספרייה ישנים נכשל:", error);
  }
}

function packDirectoryContacts_(contacts) {
  const pages = [];
  let currentPage = [];
  let currentBytes = 1024; // מעטפת המסמך והשדות הקבועים.

  (Array.isArray(contacts) ? contacts : []).forEach(contact => {
    // חישוב ליניארי: מודדים כל איש קשר פעם אחת בלבד.
    // בגרסה הקודמת כל ה-page עבר stringify מחדש עבור כל רשומה.
    const contactBytes = Utilities
      .newBlob(JSON.stringify(contact))
      .getBytes()
      .length + 2;

    if (
      currentPage.length > 0 &&
      currentBytes + contactBytes > CONTACT_DIRECTORY_TARGET_BYTES
    ) {
      pages.push(currentPage);
      currentPage = [];
      currentBytes = 1024;
    }

    currentPage.push(contact);
    currentBytes += contactBytes;
  });

  if (currentPage.length || pages.length === 0) {
    pages.push(currentPage);
  }

  // בדיקה מדויקת סופית מול גודל ה-JSON המלא של כל עמוד.
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

function getFirestoreDocumentName_(collectionName, documentId) {
  return (
    "projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/" +
    collectionName +
    "/" +
    documentId
  );
}

function commitFirestoreWrites_(writes) {
  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents:commit";
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({
      writes: Array.isArray(writes) ? writes : []
    }),
    muteHttpExceptions: true
  });
  const responseCode = response.getResponseCode();

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(
      "כתיבה אטומית ל-Firestore נכשלה. HTTP " +
        responseCode +
        ": " +
        response.getContentText()
    );
  }

  return JSON.parse(response.getContentText() || "{}");
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
