function upsertAllowedUserPairAtomically_(
  email,
  source,
  phone,
  options
) {
  const normalizedEmail = normalizeEmail_(email);
  const normalizedPhone = normalizeIsraeliPhone(phone);
  const phoneKey = getAllowedPhoneDocumentId_(normalizedPhone);
  const settings = options && typeof options === "object" ? options : {};
  const allowTransfer = settings.allowTransfer === true;
  const allowReactivate = settings.allowReactivate === true;
  const permanentApproval = settings.permanentApproval === true;
  const approvedBy = normalizeEmail_(settings.approvedBy || "");

  if (!normalizedEmail || !isValidEmail_(normalizedEmail)) {
    throw new Error("כתובת מייל אינה תקינה: " + email);
  }

  if (!isValidNormalizedIsraeliPhone_(normalizedPhone) || !phoneKey) {
    throw new Error(
      "לא ניתן ליצור הרשאת משתמש ללא מספר טלפון תקין: " +
        normalizedEmail
    );
  }

  const existingUser = Object.prototype.hasOwnProperty.call(
    settings,
    "existingUser"
  )
    ? settings.existingUser
    : getAllowedUser_(normalizedEmail);
  const existingPhonePermission = Object.prototype.hasOwnProperty.call(
    settings,
    "existingPhonePermission"
  )
    ? settings.existingPhonePermission
    : getAllowedPhonePermission_(normalizedPhone);

  // חסימה יזומה של אדמין נשמרת גם אם המשתמש ממלא שוב את הטופס
  // או אם מריצים שוב את סנכרון המשתמשים הקיימים.
  if (
    existingUser &&
    existingUser.active === false &&
    !allowReactivate
  ) {
    Logger.log(
      "ההרשאה נשארה חסומה ולא הופעלה מחדש: " + normalizedEmail
    );

    return {
      status: "blocked",
      email: normalizedEmail,
      phone: normalizedPhone,
      phoneKey
    };
  }

  if (
    existingPhonePermission &&
    existingPhonePermission.active === false &&
    !allowReactivate
  ) {
    Logger.log(
      "הרשאת הטלפון נשארה חסומה ולא הופעלה מחדש: " +
        normalizedPhone
    );

    return {
      status: "blocked",
      email: normalizedEmail,
      phone: normalizedPhone,
      phoneKey
    };
  }

  if (
    existingUser &&
    existingUser.active === true &&
    existingUser.phone &&
    normalizeIsraeliPhone(existingUser.phone) !== normalizedPhone
  ) {
    throw new Error(
      "כתובת המייל כבר משויכת למספר טלפון אחר. יש לטפל בהתנגשות במסך ההרשאות."
    );
  }

  const previousPhoneEmail = normalizeEmail_(
    existingPhonePermission && existingPhonePermission.email
  );
  if (
    existingPhonePermission &&
    existingPhonePermission.active === true &&
    previousPhoneEmail &&
    previousPhoneEmail !== normalizedEmail &&
    !allowTransfer
  ) {
    throw new Error(
      "מספר הטלפון כבר משויך למייל פעיל אחר. הבקשה דורשת אישור מנהל."
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
    "updatedAt"
  ];
  if (isNewGrant) {
    userUpdateFields.push(
      "accessGrantedAt",
      "accessGrantSource",
      "accessReviewRequired",
      "accessReviewStatus",
      "temporaryAccessUntil",
      "temporaryAccessReason",
      "temporaryAccessGrantedAt",
      "temporaryAccessGrantedBy"
    );
    if (permanentApproval) {
      userUpdateFields.push(
        "permanentApprovedAt",
        "permanentApprovedBy"
      );
    }
  }

  const userFields = {
    active: { booleanValue: true },
    email: { stringValue: normalizedEmail },
    phone: { stringValue: normalizedPhone },
    phoneKey: { stringValue: phoneKey },
    source: { stringValue: source || "unknown" },
    updatedAt: { timestampValue: now }
  };

  if (isNewGrant) {
    userFields.accessGrantedAt = { timestampValue: now };
    userFields.accessGrantSource = {
      stringValue: source || "unknown"
    };
    userFields.accessReviewRequired = {
      booleanValue: !permanentApproval
    };
    userFields.accessReviewStatus = {
      stringValue: permanentApproval
        ? ACCESS_REVIEW_STATUS_APPROVED
        : ACCESS_REVIEW_STATUS_PENDING
    };
    userFields.temporaryAccessUntil = { nullValue: null };
    userFields.temporaryAccessReason = { stringValue: "" };
    userFields.temporaryAccessGrantedAt = { nullValue: null };
    userFields.temporaryAccessGrantedBy = { stringValue: "" };

    if (permanentApproval) {
      userFields.permanentApprovedAt = { timestampValue: now };
      userFields.permanentApprovedBy = {
        stringValue: approvedBy || "admin"
      };
    }
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
    source: { stringValue: source || "unknown" },
    updatedAt: { timestampValue: now }
  };
  const writes = [
    {
      update: {
        name: getFirestoreDocumentName_(
          "allowedUsers",
          normalizedEmail
        ),
        fields: userFields
      },
      updateMask: {
        fieldPaths: userUpdateFields
      },
      currentDocument:
        existingUser && existingUser.updateTime
          ? { updateTime: existingUser.updateTime }
          : { exists: false }
    },
    {
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
    },
  ];

  let transferredFrom = "";
  if (
    allowTransfer &&
    previousPhoneEmail &&
    previousPhoneEmail !== normalizedEmail
  ) {
    const previousUser = getAllowedUser_(previousPhoneEmail);
    if (
      previousUser &&
      previousUser.active === true &&
      normalizeIsraeliPhone(previousUser.phone) === normalizedPhone
    ) {
      transferredFrom = previousPhoneEmail;
      writes.push({
        update: {
          name: getFirestoreDocumentName_(
            "allowedUsers",
            previousPhoneEmail
          ),
          fields: {
            active: { booleanValue: false },
            source: {
              stringValue: "replaced-by-admin-approved-form"
            },
            updatedAt: { timestampValue: now }
          }
        },
        updateMask: {
          fieldPaths: ["active", "source", "updatedAt"]
        },
        currentDocument: previousUser.updateTime
          ? { updateTime: previousUser.updateTime }
          : { exists: true }
      });
    }
  }

  try {
    commitFirestoreWrites_(writes);
  } catch (error) {
    // אם התשובה אבדה לאחר commit מוצלח, בודקים את הזוג לפני כשל.
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
    if (!pairIsConsistent) throw error;
  }

  return {
    status: isNewGrant ? "created" : "updated",
    email: normalizedEmail,
    phone: normalizedPhone,
    phoneKey,
    accessGrantedAt: isNewGrant ? now : "",
    accessReviewRequired: isNewGrant && !permanentApproval,
    transferredFrom
  };
}

function upsertAllowedUser_(email, source, knownExistingUser, phone) {
  const options = {};
  if (arguments.length >= 3 && knownExistingUser !== undefined) {
    options.existingUser = knownExistingUser;
  }
  return upsertAllowedUserPairAtomically_(
    email,
    source,
    phone,
    options
  );
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
      ? normalizeEmail_(fields.email.stringValue)
      : normalizedEmail,
    active: fields.active &&
      typeof fields.active.booleanValue === "boolean"
        ? fields.active.booleanValue
        : true,
    phone: fields.phone && fields.phone.stringValue
      ? normalizeIsraeliPhone(fields.phone.stringValue)
      : "",
    phoneKey: fields.phoneKey && fields.phoneKey.stringValue
      ? cleanSheetValue_(fields.phoneKey.stringValue)
      : "",
    authState: fields.authState && fields.authState.stringValue
      ? cleanSheetValue_(fields.authState.stringValue)
      : "",
    lastVerifiedLoginAt:
      fields.lastVerifiedLoginAt &&
      fields.lastVerifiedLoginAt.timestampValue
        ? fields.lastVerifiedLoginAt.timestampValue
        : "",
    manualApproved:
      fields.manualApproved &&
      typeof fields.manualApproved.booleanValue === "boolean"
        ? fields.manualApproved.booleanValue
        : false,
    accessReviewRequired:
      fields.accessReviewRequired &&
      typeof fields.accessReviewRequired.booleanValue === "boolean"
        ? fields.accessReviewRequired.booleanValue
        : false,
    accessReviewStatus:
      fields.accessReviewStatus &&
      fields.accessReviewStatus.stringValue
        ? cleanSheetValue_(fields.accessReviewStatus.stringValue)
        : "",
    temporaryAccessUntil:
      fields.temporaryAccessUntil &&
      fields.temporaryAccessUntil.timestampValue
        ? fields.temporaryAccessUntil.timestampValue
        : "",
    previousAccessEmails:
      fields.previousAccessEmails &&
      fields.previousAccessEmails.arrayValue &&
      Array.isArray(fields.previousAccessEmails.arrayValue.values)
        ? fields.previousAccessEmails.arrayValue.values
            .map(value =>
              value && value.stringValue
                ? normalizeEmail_(value.stringValue)
                : ""
            )
            .filter(Boolean)
        : [],
    pendingOldEmails:
      fields.pendingOldEmails &&
      fields.pendingOldEmails.arrayValue &&
      Array.isArray(fields.pendingOldEmails.arrayValue.values)
        ? fields.pendingOldEmails.arrayValue.values
            .map(value =>
              value && value.stringValue
                ? normalizeEmail_(value.stringValue)
                : ""
            )
            .filter(Boolean)
        : [],
    replacementRequestedAt:
      fields.replacementRequestedAt &&
      fields.replacementRequestedAt.timestampValue
        ? fields.replacementRequestedAt.timestampValue
        : "",
    updateTime: cleanSheetValue_(document.updateTime)
  };
}

function getAllowedPhonePermission_(phone) {
  const normalizedPhone = normalizeIsraeliPhone(phone);
  const phoneKey = getAllowedPhoneDocumentId_(normalizedPhone);
  if (!isValidNormalizedIsraeliPhone_(normalizedPhone) || !phoneKey) {
    return null;
  }

  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/" +
    ALLOWED_PHONES_COLLECTION_NAME +
    "/" +
    phoneKey;

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() === 404) return null;

  if (
    response.getResponseCode() < 200 ||
    response.getResponseCode() >= 300
  ) {
    throw new Error(
      "קריאת הרשאת הטלפון נכשלה. HTTP " +
        response.getResponseCode() +
        ": " +
        response.getContentText()
    );
  }

  const document = JSON.parse(response.getContentText() || "{}");
  const fields = document.fields || {};

  return {
    phone: fields.phone && fields.phone.stringValue
      ? normalizeIsraeliPhone(fields.phone.stringValue)
      : normalizedPhone,
    phoneKey,
    email: fields.email && fields.email.stringValue
      ? normalizeEmail_(fields.email.stringValue)
      : "",
    active: fields.active &&
      typeof fields.active.booleanValue === "boolean"
        ? fields.active.booleanValue
        : true,
    updateTime: cleanSheetValue_(document.updateTime)
  };
}

function isAllowedEmailPhonePairActive_(email, allowedUser) {
  const normalizedEmail = normalizeEmail_(email);
  const user = allowedUser || getAllowedUser_(normalizedEmail);

  if (
    !user ||
    user.active !== true ||
    !user.phone ||
    !user.phoneKey
  ) {
    return false;
  }

  const phonePermission = getAllowedPhonePermission_(user.phone);
  return Boolean(
    phonePermission &&
    phonePermission.active === true &&
    phonePermission.phoneKey === user.phoneKey &&
    normalizeEmail_(phonePermission.email) === normalizedEmail
  );
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

function listFirestoreCollectionDocuments_(collectionName) {
  const documents = [];
  let pageToken = "";

  do {
    let url =
      "https://firestore.googleapis.com/v1/projects/" +
      FIREBASE_PROJECT_ID +
      "/databases/(default)/documents/" +
      encodeURIComponent(collectionName) +
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
    if (responseCode === 404) return documents;
    if (responseCode < 200 || responseCode >= 300) {
      throw new Error(
        "קריאת האוסף " + collectionName + " נכשלה. HTTP " +
          responseCode + ": " + response.getContentText()
      );
    }

    const payload = JSON.parse(response.getContentText() || "{}");
    (payload.documents || []).forEach(document => documents.push(document));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return documents;
}

function queryFirestoreDocumentsSince_(
  collectionName,
  timestampField,
  windowStart,
  limit
) {
  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents:runQuery";
  const structuredQuery = {
    from: [{ collectionId: collectionName }],
    where: {
      fieldFilter: {
        field: { fieldPath: timestampField },
        op: "GREATER_THAN",
        value: { timestampValue: windowStart.toISOString() }
      }
    },
    orderBy: [{
      field: { fieldPath: timestampField },
      direction: "DESCENDING"
    }]
  };
  const requestedLimit = Number(limit);
  if (Number.isFinite(requestedLimit) && requestedLimit > 0) {
    structuredQuery.limit = Math.floor(requestedLimit);
  }

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({
      structuredQuery
    }),
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(
      "שאילתת האוסף " + collectionName + " נכשלה. HTTP " +
        responseCode + ": " + response.getContentText()
    );
  }

  return (JSON.parse(response.getContentText() || "[]") || [])
    .map(item => item && item.document)
    .filter(Boolean);
}

function getFirestoreDocumentId_(document) {
  return decodeURIComponent(String(document && document.name || "").split("/").pop());
}

function getFirestoreStringField_(fields, fieldName, fallback) {
  const field = fields && fields[fieldName];
  return field && field.stringValue !== undefined
    ? cleanSheetValue_(field.stringValue)
    : cleanSheetValue_(fallback);
}

function getFirestoreBooleanField_(fields, fieldName, fallback) {
  const field = fields && fields[fieldName];
  return field && typeof field.booleanValue === "boolean"
    ? field.booleanValue
    : Boolean(fallback);
}

function getFirestoreTimestampField_(fields, fieldName) {
  const field = fields && fields[fieldName];
  const value = field && field.timestampValue
    ? new Date(field.timestampValue)
    : null;

  return value && !Number.isNaN(value.getTime()) ? value : null;
}

function getActiveAdminRecords_() {
  return listFirestoreCollectionDocuments_("admins")
    .map(document => {
      const fields = document.fields || {};
      const documentId = normalizeEmail_(getFirestoreDocumentId_(document));
      return {
        email: normalizeEmail_(
          getFirestoreStringField_(fields, "email", documentId)
        ),
        active: getFirestoreBooleanField_(fields, "active", false),
        role: getFirestoreStringField_(fields, "role", "admin")
      };
    })
    .filter(admin => admin.email && admin.active)
    .sort((a, b) => {
      if (a.role === "super_admin" && b.role !== "super_admin") return -1;
      if (b.role === "super_admin" && a.role !== "super_admin") return 1;
      return a.email.localeCompare(b.email);
    });
}

function getActiveManagerSupportContact_() {
  try {
    const cached = CacheService.getScriptCache().get(
      SUPPORT_CONTACT_CACHE_KEY
    );
    if (cached) return JSON.parse(cached);
  } catch (error) {
    console.warn("קריאת מטמון איש הקשר למנהל נכשלה:", error);
  }

  const admins = getActiveAdminRecords_();
  let contacts = [];
  try {
    contacts = readAndDeduplicateContacts_();
  } catch (error) {
    console.warn("קריאת אנשי הקשר לצורך תמיכת מנהל נכשלה:", error);
  }
  let result = { ok: false };

  for (let index = 0; index < admins.length; index += 1) {
    const admin = admins[index];
    const contact = contacts.find(item =>
      normalizeEmail_(item && item.email) === admin.email
    );
    let phone = normalizeIsraeliPhone(contact && contact.phone);

    // גם מנהל שאינו מופיע כרגע בטאב אנשי הקשר יכול לספק תמיכה,
    // כל עוד קיימת עבורו הרשאת טלפון פעילה ומקושרת.
    if (!phone) {
      try {
        const allowedUser = getAllowedUser_(admin.email);
        if (
          allowedUser &&
          allowedUser.active === true &&
          isAllowedEmailPhonePairActive_(admin.email, allowedUser)
        ) {
          phone = normalizeIsraeliPhone(allowedUser.phone);
        }
      } catch (error) {
        console.warn(
          "קריאת טלפון התמיכה של המנהל נכשלה:",
          admin.email,
          error
        );
      }
    }

    const digits = phone.replace(/\D/g, "");

    if (!digits) continue;

    const name = [
      cleanSheetValue_(contact && contact.title_prefix),
      cleanSheetValue_(contact && contact.first_name_he),
      cleanSheetValue_(contact && contact.last_name_he)
    ].filter(Boolean).join(" ").trim();

    result = {
      ok: true,
      name: admin.email === CONTACT_MANAGER_EMAIL
        ? CONTACT_MANAGER_DISPLAY_NAME
        : (name || "מנהל ספר אנשי הקשר"),
      whatsappUrl: "https://wa.me/" + digits
    };
    break;
  }

  try {
    CacheService.getScriptCache().put(
      SUPPORT_CONTACT_CACHE_KEY,
      JSON.stringify(result),
      SUPPORT_CONTACT_CACHE_SECONDS
    );
  } catch (error) {
    console.warn("שמירת מטמון איש הקשר למנהל נכשלה:", error);
  }

  return result;
}

function diagnoseActiveManagerSupportContact() {
  const result = getActiveManagerSupportContact_();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function createSupportContactJsonp_(e) {
  let callback = e && e.parameter
    ? cleanSheetValue_(e.parameter.callback)
    : "";

  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    callback = "receiveSupportContact";
  }

  let payload;
  try {
    payload = getActiveManagerSupportContact_();
  } catch (error) {
    console.error("טעינת איש הקשר של המנהל נכשלה:", error);
    payload = { ok: false };
  }

  return ContentService
    .createTextOutput(
      callback + "(" + JSON.stringify(payload).replace(/</g, "\\u003c") + ");"
    )
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
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
