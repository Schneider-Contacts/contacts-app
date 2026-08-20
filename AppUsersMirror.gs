const APP_USERS_SHEET_NAME = "app_users";
const APP_USERS_HEADERS = [
  "user_key",
  "name",
  "email",
  "phone",
  "contact_id",
  "role",
  "department",
  "access_status",
  "source",
  "requested_at",
  "provisional_at",
  "review_requested_at",
  "approved_at",
  "revoked_at",
  "updated_at",
  "approved_by",
  "firebase_uid",
  "sync_status"
];

function ensureAppUsersMirrorSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(APP_USERS_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(APP_USERS_SHEET_NAME);

  const existingHeaders = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
    : [];
  const matches = APP_USERS_HEADERS.every(
    (header, index) => cleanSheetValue_(existingHeaders[index]) === header
  );
  if (!matches) {
    if (sheet.getLastRow() > 0 && existingHeaders.some(cleanSheetValue_)) {
      throw new Error(
        "בטאב app_users קיימות כותרות שאינן תואמות לסכימה הצפויה."
      );
    }
    sheet.getRange(1, 1, 1, APP_USERS_HEADERS.length)
      .setValues([APP_USERS_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function normalizeAppUserMirrorRecord_(record) {
  const source = record && typeof record === "object" ? record : {};
  const profile = source.profile && typeof source.profile === "object"
    ? source.profile
    : {};
  const email = normalizeEmail_(source.email);
  const phone = normalizeIsraeliPhone(source.phone);
  return {
    user_key: cleanSheetValue_(source.userKey || email),
    name: cleanSheetValue_(source.name || profile.name),
    email,
    phone,
    contact_id: cleanSheetValue_(source.contactId || profile.contactId),
    role: cleanSheetValue_(source.role || profile.role),
    department: cleanSheetValue_(source.department || profile.department),
    access_status: cleanSheetValue_(source.accessStatus || "pending"),
    source: cleanSheetValue_(source.source || "unknown"),
    requested_at: cleanSheetValue_(source.requestedAt),
    provisional_at: cleanSheetValue_(source.provisionalAt),
    review_requested_at: cleanSheetValue_(source.reviewRequestedAt),
    approved_at: cleanSheetValue_(source.approvedAt),
    revoked_at: cleanSheetValue_(source.revokedAt),
    updated_at: cleanSheetValue_(source.updatedAt || new Date().toISOString()),
    approved_by: normalizeEmail_(source.approvedBy),
    firebase_uid: cleanSheetValue_(source.firebaseUid),
    sync_status: cleanSheetValue_(source.syncStatus || "ok")
  };
}

function upsertAppUserMirror_(record) {
  const normalized = normalizeAppUserMirrorRecord_(record);
  if (!normalized.user_key || !normalized.email) {
    throw new Error("לא ניתן לעדכן app_users ללא user_key ומייל תקינים.");
  }

  const sheet = ensureAppUsersMirrorSheet_();
  const lastRow = sheet.getLastRow();
  const rows = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, APP_USERS_HEADERS.length)
        .getDisplayValues()
    : [];
  const keyIndex = APP_USERS_HEADERS.indexOf("user_key");
  const existingIndex = rows.findIndex(row =>
    cleanSheetValue_(row[keyIndex]) === normalized.user_key
  );
  const existing = existingIndex >= 0
    ? APP_USERS_HEADERS.reduce((result, header, index) => {
        result[header] = cleanSheetValue_(rows[existingIndex][index]);
        return result;
      }, {})
    : {};
  const merged = { ...existing, ...normalized };
  [
    "requested_at",
    "provisional_at",
    "review_requested_at",
    "approved_at",
    "revoked_at",
    "firebase_uid"
  ].forEach(field => {
    if (!normalized[field] && existing[field]) merged[field] = existing[field];
  });
  const output = APP_USERS_HEADERS.map(header => merged[header] || "");

  if (existingIndex >= 0) {
    sheet.getRange(existingIndex + 2, 1, 1, output.length).setValues([output]);
    return { created: false, updated: true, userKey: normalized.user_key };
  }
  sheet.appendRow(output);
  return { created: true, updated: false, userKey: normalized.user_key };
}

function syncAppUserMirrorBestEffort_(record) {
  try {
    return upsertAppUserMirror_(record);
  } catch (error) {
    console.error("app_users mirror update failed:", error);
    try {
      appendFirestoreActivity_({
        action: "app_users_mirror_failed",
        targetEmail: record && record.email,
        targetPhone: record && record.phone,
        source: record && record.source,
        syncStatus: "failed",
        timestamp: new Date().toISOString()
      });
    } catch (auditError) {
      console.error("app_users mirror failure audit failed:", auditError);
    }
    return { created: false, updated: false, failed: true };
  }
}

function getAllowedUserMirrorStatus_(data) {
  if (!data || data.active !== true) return "revoked";
  if (data.accessLevel === "provisional") return "provisional";
  if (data.accessReviewRequired === true) {
    if (data.accessReviewStatus === "temporary_active") return "temporary";
    if (["rejected", "revoked"].includes(data.accessReviewStatus)) {
      return "revoked";
    }
    return "pending";
  }
  return "active";
}

function syncAppUsersMirrorFromFirestore() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("המערכת עסוקה בסנכרון app_users אחר.");
  }

  const counts = { processed: 0, created: 0, updated: 0, failed: 0 };
  try {
    const contacts = readAndDeduplicateContacts_();
    const contactsByPhone = new Map(
      contacts.map(contact => [normalizeIsraeliPhone(contact.phone), contact])
    );
    const requests = new Map(
      listFirestoreCollectionDocuments_("verificationRequests").map(document => [
        normalizeEmail_(getFirestoreDocumentId_(document)),
        firestoreDocumentToJs_(document)
      ])
    );

    listFirestoreCollectionDocuments_("allowedUsers").forEach(document => {
      counts.processed += 1;
      try {
        const data = firestoreDocumentToJs_(document);
        const email = normalizeEmail_(
          data.email || getFirestoreDocumentId_(document)
        );
        const phone = normalizeIsraeliPhone(data.phone);
        const contact = contactsByPhone.get(phone) || null;
        const profile = getRegistrationContactProfile_(contact);
        const request = requests.get(email) || {};
        const result = upsertAppUserMirror_({
          email,
          phone,
          profile,
          source: data.source || data.accessGrantSource || "firestore_sync",
          accessStatus: getAllowedUserMirrorStatus_(data),
          requestedAt: request.requestedAt || data.accessGrantedAt || "",
          provisionalAt: data.provisionalAt || request.provisionalAt || "",
          reviewRequestedAt: request.reviewRequestedAt || "",
          approvedAt: data.permanentApprovedAt || "",
          revokedAt: data.active === false ? data.updatedAt || "" : "",
          updatedAt: data.updatedAt || new Date().toISOString(),
          approvedBy: data.permanentApprovedBy || data.manualApprovedBy || "",
          firebaseUid: data.firebaseUid || "",
          syncStatus: "ok"
        });
        if (result.created) counts.created += 1;
        if (result.updated) counts.updated += 1;
      } catch (error) {
        counts.failed += 1;
        console.error("app_users reconciliation row failed:", error);
      }
    });
    return counts;
  } finally {
    lock.releaseLock();
  }
}
