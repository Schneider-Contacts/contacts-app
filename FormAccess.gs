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

function getAllowedPhoneDocumentId_(phone) {
  return normalizeIsraeliPhone(phone).replace(/\D/g, "");
}

function getSubmissionCacheKey_(prefix, normalizedPhone, normalizedEmail) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    [
      String(prefix || ""),
      String(normalizedPhone || ""),
      String(normalizedEmail || "")
    ].join("|"),
    Utilities.Charset.UTF_8
  );

  return Utilities.base64EncodeWebSafe(digest)
    .replace(/=+$/g, "")
    .slice(0, 40);
}

function getSubmissionPropertyKey_(prefix, normalizedPhone, normalizedEmail) {
  return SUBMISSION_DEDUPE_PROPERTY_PREFIX +
    String(prefix || "record") + ":" +
    getSubmissionCacheKey_(prefix, normalizedPhone, normalizedEmail);
}

function getSubmissionCacheStorageKey_(prefix, normalizedPhone, normalizedEmail) {
  return String(prefix || "record") + ":" +
    getSubmissionCacheKey_(prefix, normalizedPhone, normalizedEmail);
}

function readRecentSubmissionRecord_(prefix, normalizedPhone, normalizedEmail) {
  const cacheKey = getSubmissionCacheStorageKey_(
    prefix,
    normalizedPhone,
    normalizedEmail
  );

  try {
    const cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (
        parsed &&
        Number(parsed.savedAt || 0) > 0 &&
        Date.now() - Number(parsed.savedAt) <= DUPLICATE_SUBMISSION_WINDOW_MS
      ) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn("קריאת מטמון מניעת הכפילויות נכשלה:", error);
  }

  const propertyKey = getSubmissionPropertyKey_(
    prefix,
    normalizedPhone,
    normalizedEmail
  );

  try {
    const properties = PropertiesService.getScriptProperties();
    const stored = properties.getProperty(propertyKey);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const savedAt = Number(parsed && parsed.savedAt || 0);

    if (!savedAt || Date.now() - savedAt > DUPLICATE_SUBMISSION_WINDOW_MS) {
      properties.deleteProperty(propertyKey);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("קריאת מנגנון מניעת הכפילויות המתמשך נכשלה:", error);
    return null;
  }
}

function rememberSubmissionRecord_(
  prefix,
  normalizedPhone,
  normalizedEmail,
  payload
) {
  const record = Object.assign({}, payload || {}, {
    savedAt: Date.now()
  });
  const serialized = JSON.stringify(record);
  const cacheKey = getSubmissionCacheStorageKey_(
    prefix,
    normalizedPhone,
    normalizedEmail
  );
  const propertyKey = getSubmissionPropertyKey_(
    prefix,
    normalizedPhone,
    normalizedEmail
  );

  try {
    CacheService.getScriptCache().put(
      cacheKey,
      serialized,
      Math.min(DUPLICATE_SUBMISSION_WINDOW_SECONDS, SCRIPT_CACHE_MAX_SECONDS)
    );
  } catch (error) {
    console.warn("שמירת מטמון מניעת הכפילויות נכשלה:", error);
  }

  try {
    PropertiesService.getScriptProperties().setProperty(
      propertyKey,
      serialized
    );
  } catch (error) {
    console.warn("שמירת מנגנון מניעת הכפילויות המתמשך נכשלה:", error);
  }
}

function getRecentEmailUpdateResult_(normalizedPhone, normalizedEmail) {
  const record = readRecentSubmissionRecord_(
    EMAIL_UPDATE_DUPLICATE_CACHE_PREFIX,
    normalizedPhone,
    normalizedEmail
  );

  return record && record.result ? record.result : null;
}

function getRecentEmailUpdateForPhone_(normalizedPhone) {
  const propertyKey = EMAIL_UPDATE_PHONE_PROPERTY_PREFIX +
    getSubmissionCacheKey_(
      EMAIL_UPDATE_PHONE_PROPERTY_PREFIX,
      normalizedPhone,
      ""
    );

  try {
    const properties = PropertiesService.getScriptProperties();
    const stored = properties.getProperty(propertyKey);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const savedAt = Number(parsed && parsed.savedAt || 0);

    if (!savedAt || Date.now() - savedAt > DUPLICATE_SUBMISSION_WINDOW_MS) {
      properties.deleteProperty(propertyKey);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("קריאת העדכון האחרון לפי טלפון נכשלה:", error);
    return null;
  }
}

function rememberEmailUpdateResult_(
  normalizedPhone,
  normalizedEmail,
  result
) {
  rememberSubmissionRecord_(
    EMAIL_UPDATE_DUPLICATE_CACHE_PREFIX,
    normalizedPhone,
    normalizedEmail,
    { result: result || {} }
  );

  const propertyKey = EMAIL_UPDATE_PHONE_PROPERTY_PREFIX +
    getSubmissionCacheKey_(
      EMAIL_UPDATE_PHONE_PROPERTY_PREFIX,
      normalizedPhone,
      ""
    );

  try {
    PropertiesService.getScriptProperties().setProperty(
      propertyKey,
      JSON.stringify({
        savedAt: Date.now(),
        email: normalizeEmail_(normalizedEmail),
        displayName: cleanSheetValue_(result && result.displayName),
        phone: normalizedPhone
      })
    );
  } catch (error) {
    console.warn("שמירת העדכון האחרון לפי טלפון נכשלה:", error);
  }
}

function isRecentFormSubmission_(normalizedPhone, normalizedEmail) {
  return Boolean(
    readRecentSubmissionRecord_(
      FORM_SUBMISSION_DUPLICATE_CACHE_PREFIX,
      normalizedPhone,
      normalizedEmail
    )
  );
}

function rememberFormSubmission_(normalizedPhone, normalizedEmail) {
  rememberSubmissionRecord_(
    FORM_SUBMISSION_DUPLICATE_CACHE_PREFIX,
    normalizedPhone,
    normalizedEmail,
    { processed: true }
  );
}

function clearRecentSubmissionRecordsForUser_(normalizedPhone, normalizedEmail) {
  const phone = normalizeIsraeliPhone(normalizedPhone);
  const email = normalizeEmail_(normalizedEmail);
  const prefixes = [
    FORM_SUBMISSION_DUPLICATE_CACHE_PREFIX,
    EMAIL_UPDATE_DUPLICATE_CACHE_PREFIX
  ];
  const cacheKeys = prefixes.map(prefix =>
    getSubmissionCacheStorageKey_(prefix, phone, email)
  );
  const propertyKeys = prefixes.map(prefix =>
    getSubmissionPropertyKey_(prefix, phone, email)
  );

  if (phone) {
    propertyKeys.push(
      EMAIL_UPDATE_PHONE_PROPERTY_PREFIX +
        getSubmissionCacheKey_(
          EMAIL_UPDATE_PHONE_PROPERTY_PREFIX,
          phone,
          ""
        )
    );
  }

  try {
    CacheService.getScriptCache().removeAll(cacheKeys);
  } catch (error) {
    console.warn("ניקוי מטמון ההרשמה לאחר איפוס חשבון נכשל:", error);
  }

  try {
    const properties = PropertiesService.getScriptProperties();
    propertyKeys.forEach(key => properties.deleteProperty(key));
  } catch (error) {
    console.warn("ניקוי היסטוריית ההרשמה לאחר איפוס חשבון נכשל:", error);
  }
}

function cleanupExpiredSubmissionRecords_() {
  const properties = PropertiesService.getScriptProperties();
  const allProperties = properties.getProperties();
  const now = Date.now();
  const maximumAge = DUPLICATE_SUBMISSION_WINDOW_MS * 3;
  let removed = 0;

  Object.keys(allProperties).forEach(key => {
    if (
      !key.startsWith(SUBMISSION_DEDUPE_PROPERTY_PREFIX) &&
      !key.startsWith(EMAIL_UPDATE_PHONE_PROPERTY_PREFIX)
    ) {
      return;
    }

    try {
      const parsed = JSON.parse(allProperties[key] || "{}");
      const savedAt = Number(parsed.savedAt || 0);
      if (!savedAt || now - savedAt > maximumAge) {
        properties.deleteProperty(key);
        removed += 1;
      }
    } catch (error) {
      properties.deleteProperty(key);
      removed += 1;
    }
  });

  return removed;
}

function clearPublicAuthRouteCache_(kind, value) {
  const normalizedKind = cleanSheetValue_(kind).toLowerCase();
  const normalizedValue = normalizedKind === "email"
    ? normalizeEmail_(value)
    : normalizeIsraeliPhone(value);

  if (!normalizedKind || !normalizedValue) return;

  try {
    const key = getPublicAuthRouteCacheKey_(
      normalizedKind,
      normalizedValue
    );
    const accountAwareKey = getPublicAuthRouteCacheKey_(
      normalizedKind,
      normalizedValue,
      PUBLIC_AUTH_ACCOUNT_ROUTING_CLIENT
    );
    CacheService.getScriptCache().removeAll([
      key,
      key + ":busy",
      accountAwareKey,
      accountAwareKey + ":busy"
    ]);
  } catch (error) {
    console.warn("ניקוי מטמון מסלול הכניסה נכשל:", error);
  }
}

function getAccessReviewReason_(
  contact,
  allowedUser,
  phonePermission,
  email,
  phone
) {
  if (!contact) return "phone_not_in_contacts";
  if (
    (allowedUser && allowedUser.active === false) ||
    (phonePermission && phonePermission.active === false) ||
    (
      allowedUser &&
      (
        allowedUser.accessLevel === "revoked" ||
        ["rejected", "revoked"].includes(
          allowedUser.accessReviewStatus
        )
      )
    )
  ) {
    return "blocked_permission";
  }
  if (
    allowedUser &&
    allowedUser.active === true &&
    allowedUser.phone &&
    normalizeIsraeliPhone(allowedUser.phone) !== phone
  ) {
    return "email_linked_to_other_phone";
  }
  if (
    phonePermission &&
    phonePermission.active === true &&
    phonePermission.email &&
    normalizeEmail_(phonePermission.email) !== email
  ) {
    return "phone_linked_to_other_email";
  }
  return "";
}

function getGoogleFormAccessReviewReason_(
  contact,
  allowedUser,
  phonePermission,
  email,
  phone
) {
  return getAccessReviewReason_(
    contact,
    allowedUser,
    phonePermission,
    email,
    phone
  );
}

function getAccessRequestId_(phone, email) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    normalizeEmail_(email),
    Utilities.Charset.UTF_8
  );
  const emailKey = Utilities
    .base64EncodeWebSafe(digest)
    .replace(/=+$/g, "")
    .slice(0, 18);
  return (
    "access_" +
    normalizeIsraeliPhone(phone).replace(/\D/g, "") +
    "_" +
    emailKey
  );
}

function getGoogleFormAccessRequestId_(phone, email) {
  return getAccessRequestId_(phone, email);
}

function queueAccessRequestForAdmin_(
  contact,
  formValues,
  reviewReason,
  submittedAt,
  source
) {
  const phone = normalizeIsraeliPhone(formValues.phone);
  const email = normalizeEmail_(formValues.email);
  const requestId = getAccessRequestId_(phone, email);
  const now = normalizeDateToIso_(submittedAt) || new Date().toISOString();
  const choose = (formValue, contactValue) =>
    cleanSheetValue_(formValue) || cleanSheetValue_(contactValue);
  const fields = {
    firstName: {
      stringValue: choose(
        formValues.firstName,
        contact && contact.first_name_he
      )
    },
    lastName: {
      stringValue: choose(
        formValues.lastName,
        contact && contact.last_name_he
      )
    },
    titlePrefix: {
      stringValue: cleanSheetValue_(contact && contact.title_prefix)
    },
    role: {
      stringValue: cleanSheetValue_(contact && contact.role)
    },
    department: {
      stringValue: cleanSheetValue_(contact && contact.department)
    },
    phone: { stringValue: phone },
    email: { stringValue: email },
    reporterEmail: { stringValue: email },
    source: { stringValue: cleanSheetValue_(source || "app") },
    requestType: { stringValue: "contact_add" },
    originalContactId: {
      stringValue: contact ? getContactDocumentId_(contact) : ""
    },
    originalPhone: {
      stringValue: contact ? normalizeIsraeliPhone(contact.phone) : ""
    },
    originalEmail: {
      stringValue: contact ? normalizeEmail_(contact.email) : ""
    },
    status: { stringValue: "pending" },
    createdAt: { timestampValue: now },
    updatedAt: { timestampValue: now },
    handledAt: { nullValue: null },
    handledBy: { stringValue: "" },
    approvedContactId: { stringValue: "" },
    grantAccessOnApproval: { booleanValue: true },
    accessApprovalReason: {
      stringValue: cleanSheetValue_(reviewReason)
    }
  };
  const existingRequest = getAuthFlowDocument_(
    "contactAddRequests",
    requestId
  );
  if (
    existingRequest &&
    existingRequest.data &&
    existingRequest.data.status === "pending"
  ) {
    return {
      requestId,
      duplicate: true,
      reason: reviewReason
    };
  }
  if (existingRequest && existingRequest.updateTime) {
    commitFirestoreWrites_([{
      update: {
        name: getFirestoreDocumentName_("contactAddRequests", requestId),
        fields
      },
      updateMask: { fieldPaths: Object.keys(fields) },
      currentDocument: { updateTime: existingRequest.updateTime }
    }]);
    return {
      requestId,
      duplicate: false,
      reopened: true,
      reason: reviewReason
    };
  }
  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/contactAddRequests/" +
    encodeURIComponent(requestId) +
    "?currentDocument.exists=false";
  const response = UrlFetchApp.fetch(url, {
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({ fields }),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() === 409) {
    return {
      requestId,
      duplicate: true,
      reason: reviewReason
    };
  }
  if (
    response.getResponseCode() < 200 ||
    response.getResponseCode() >= 300
  ) {
    throw new Error(
      "שמירת בקשת ההצטרפות למנהל נכשלה. HTTP " +
        response.getResponseCode() +
        ": " +
        response.getContentText()
    );
  }

  return {
    requestId,
    duplicate: false,
    reason: reviewReason
  };
}

function queueGoogleFormAccessForAdmin_(
  contact,
  formValues,
  reviewReason,
  submittedAt
) {
  return queueAccessRequestForAdmin_(
    contact,
    formValues,
    reviewReason,
    submittedAt,
    "google_form"
  );
}

function getRegistrationContactProfile_(contact) {
  if (!contact) {
    return { name: "", role: "", department: "", contactId: "" };
  }
  return {
    name: [
      cleanSheetValue_(contact.title_prefix),
      cleanSheetValue_(contact.first_name_he),
      cleanSheetValue_(contact.last_name_he)
    ].filter(Boolean).join(" ").trim(),
    role: cleanSheetValue_(contact.role),
    department: cleanSheetValue_(contact.department),
    contactId: getContactDocumentId_(contact)
  };
}

/**
 * מקור הסמכות היחיד לבקשת הרשמה חדשה, הן מהאפליקציה והן מהטופס הישן.
 * Firestore נכתב תחילה. app_users הוא מראה תפעולית בלבד וכשל בו אינו
 * מבטל הרשאה שכבר נשמרה בהצלחה.
 */
function processAccessRegistration_(payload, source, options) {
  const values = payload && typeof payload === "object" ? payload : {};
  const normalizedSource = source === "google_form" ? "google_form" : "app";
  const email = normalizeEmail_(values.email);
  const phone = normalizeIsraeliPhone(values.phone);
  const now = normalizeDateToIso_(values.submittedAt) || new Date().toISOString();
  const settings = options && typeof options === "object" ? options : {};
  const deferProvisionalGrant = settings.deferProvisionalGrant === true;

  if (!email || !isValidEmail_(email)) {
    throw new Error("כתובת המייל אינה תקינה.");
  }
  if (!isValidNormalizedIsraeliPhone_(phone)) {
    throw new Error("מספר הטלפון אינו תקין.");
  }

  const lock = settings.lockAlreadyHeld === true
    ? null
    : LockService.getScriptLock();
  if (lock && !lock.tryLock(30000)) {
    throw new Error("המערכת עסוקה בבקשת הרשמה אחרת. נסו שוב בעוד רגע.");
  }

  try {
    const matchingContact = readAndDeduplicateContacts_().find(contact =>
      normalizeIsraeliPhone(contact && contact.phone) === phone
    ) || null;
    const existingAllowedUser = getAllowedUser_(email);
    const existingPhonePermission = getAllowedPhonePermission_(phone);
    const reviewReason = getAccessReviewReason_(
      matchingContact,
      existingAllowedUser,
      existingPhonePermission,
      email,
      phone
    );
    const profile = getRegistrationContactProfile_(matchingContact);

    if (reviewReason) {
      const requestResult = queueAccessRequestForAdmin_(
        matchingContact,
        {
          firstName: values.firstName,
          lastName: values.lastName,
          phone,
          email
        },
        reviewReason,
        now,
        normalizedSource
      );
      try {
        appendFirestoreActivity_({
          action: "access_registration_pending_admin",
          targetEmail: email,
          targetPhone: phone,
          displayName: profile.name || cleanSheetValue_(values.displayName),
          actorEmail: email,
          source: normalizedSource,
          syncStatus: requestResult.duplicate ? "duplicate" : "pending",
          timestamp: now
        });
      } catch (activityError) {
        console.error("רישום בקשת ההצטרפות הממתינה נכשל:", activityError);
      }
      syncAppUserMirrorBestEffort_({
        email,
        phone,
        profile,
        source: normalizedSource,
        accessStatus: "pending",
        requestedAt: now
      });
      clearPublicAuthRouteCache_("email", email);
      return {
        ok: true,
        route: "PENDING_ADMIN",
        provisional: false,
        requestId: requestResult.requestId,
        reason: reviewReason,
        formFallbackUrl: getRegistrationFormUrl_()
      };
    }

    const existingIsPermanent = Boolean(
      existingAllowedUser &&
      existingAllowedUser.active === true &&
      existingAllowedUser.accessReviewRequired !== true &&
      existingAllowedUser.accessLevel !== "provisional"
    );
    const existingRequiresAdminReview = Boolean(
      existingAllowedUser &&
      existingAllowedUser.active === true &&
      existingAllowedUser.accessReviewRequired === true &&
      existingAllowedUser.accessLevel !== "provisional"
    );
    if (existingRequiresAdminReview) {
      syncAppUserMirrorBestEffort_({
        email,
        phone,
        profile,
        source: normalizedSource,
        accessStatus: "pending",
        requestedAt: now
      });
      return {
        ok: true,
        route: "PENDING_ADMIN",
        provisional: false,
        requestId: email,
        reason: "existing_access_review",
        formFallbackUrl: getRegistrationFormUrl_()
      };
    }
    if (deferProvisionalGrant && !existingIsPermanent) {
      return {
        ok: true,
        route: "PROVISIONAL_SETUP_READY",
        provisional: false,
        eligible: true
      };
    }
    const allowedResult = existingIsPermanent
      ? {
          status: "existing_active",
          provisional: false,
          accessGrantedAt: existingAllowedUser.accessGrantedAt || ""
        }
      : upsertAllowedUserPairAtomically_(
          email,
          normalizedSource,
          phone,
          {
            existingUser: existingAllowedUser,
            existingPhonePermission,
            provisionalApproval: true,
            registrationProfile: profile
          }
        );

    try {
      appendFirestoreActivity_({
        action: allowedResult.provisional
          ? "provisional_access_granted"
          : "access_registration_existing_active",
        targetEmail: email,
        targetPhone: phone,
        displayName: profile.name,
        actorEmail: email,
        source: normalizedSource,
        timestamp: now
      });
    } catch (activityError) {
      console.error("רישום פעילות ההרשמה נכשל:", activityError);
    }

    syncAppUserMirrorBestEffort_({
      email,
      phone,
      profile,
      source: normalizedSource,
      accessStatus: allowedResult.provisional ? "provisional" : "active",
      requestedAt: now,
      provisionalAt: allowedResult.provisional
        ? allowedResult.accessGrantedAt || now
        : ""
    });
    clearPublicAuthRouteCache_("email", email);
    return {
      ok: true,
      route: allowedResult.provisional ? "PROVISIONAL_READY" : "ACTIVE",
      provisional: allowedResult.provisional === true,
      requestId: allowedResult.provisional ? email : "",
      profile
    };
  } finally {
    if (lock) lock.releaseLock();
  }
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
  if (sheet.getName() !== FORM_RESPONSES_SHEET_NAME) {
    console.log(
      "אירוע שליחת טופס מטאב אחר לא עובד: " + sheet.getName()
    );
    return;
  }

  const row = e.range.getRow();
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const phoneCol = findHeaderColumn_(headers, FORM_PHONE_HEADER);
  const emailCol = findHeaderColumn_(headers, FORM_EMAIL_HEADER);
  const firstNameCol = findHeaderColumn_(headers, "שם פרטי (עברית)");
  const lastNameCol = findHeaderColumn_(headers, "שם משפחה (עברית)");
  const timestampCol = findFirstHeaderColumn_(
    headers,
    FORM_TIMESTAMP_HEADERS
  );

  if (phoneCol === 0) {
    throw new Error(
      'לא נמצאה עמודת הטלפון "' + FORM_PHONE_HEADER + '" בטאב ' +
        sheet.getName()
    );
  }

  if (emailCol === 0) {
    throw new Error(
      'לא נמצאה עמודת המייל "' + FORM_EMAIL_HEADER + '" בטאב ' +
        sheet.getName()
    );
  }

  const submittedAt = timestampCol > 0
    ? normalizeDateToIso_(sheet.getRange(row, timestampCol).getValue())
    : new Date().toISOString();

  const phoneCell = sheet.getRange(row, phoneCol);
  const normalizedPhone = normalizeIsraeliPhone(phoneCell.getValue());
  if (!isValidNormalizedIsraeliPhone_(normalizedPhone)) {
    throw new Error("מספר הטלפון אינו תקין בשליחת הטופס.");
  }
  phoneCell.setValue(normalizedPhone);

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
    ? cleanSheetValue_(sheet.getRange(row, firstNameCol).getValue())
    : "";
  const lastName = lastNameCol > 0
    ? cleanSheetValue_(sheet.getRange(row, lastNameCol).getValue())
    : "";
  const displayName = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const lock = LockService.getDocumentLock() || LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("המערכת עסוקה בעיבוד טופס אחר. נסו שוב בעוד רגע.");
  }

  try {
    if (isRecentFormSubmission_(normalizedPhone, email)) {
      clearPublicAuthRouteCache_("email", email);
      console.log(
        "אותו טלפון ואותו מייל כבר נקלטו ב-24 השעות האחרונות: " +
          email
      );
      return;
    }

    try {
      upsertEmailPhoneIndexFromFormSubmit_(sheet, row, headers);
    } catch (indexError) {
      console.error("עדכון אינדקס הטלפונים נכשל:", indexError);
    }

    const registrationResult = processAccessRegistration_(
      {
        firstName,
        lastName,
        displayName,
        phone: normalizedPhone,
        email,
        submittedAt
      },
      "google_form",
      { lockAlreadyHeld: true }
    );

    if (registrationResult.route === "PENDING_ADMIN") {
      rememberFormSubmission_(normalizedPhone, email);
      console.log(
        "בקשת הטופס הועברה לאישור מנהל: " +
          registrationResult.reason +
          " (" +
          registrationResult.requestId +
          ")"
      );
      return;
    }

    const allowedResult = {
      status: registrationResult.provisional ? "created" : "updated"
    };

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
        // מנהלים רואים את שתי התוצאות גם כלשונית התראה בדף הניהול.
        // השם המפורש מאפשר להבדיל בין עובד חדש לבין עדכון של עובד קיים.
        action: allowedResult && allowedResult.status === "created"
          ? "worker_added"
          : "worker_details_updated",
        targetEmail: email,
        targetPhone: normalizedPhone,
        displayName,
        actorEmail: email,
        source: "google-form",
        syncStatus,
        timestamp: submittedAt
      });

      if (allowedResult && allowedResult.status === "created") {
        appendFirestoreActivity_({
          action: "access_provisional_granted",
          targetEmail: email,
          targetPhone: normalizedPhone,
          displayName,
          actorEmail: email,
          source: "google-form",
          timestamp: submittedAt
        });
      }
    } catch (activityError) {
      console.error(
        "כתיבת הפעילות האחרונה ל-Firestore נכשלה:",
        activityError
      );
    }

    rememberFormSubmission_(normalizedPhone, email);
  } finally {
    lock.releaseLock();
  }
}

/**
 * יש להריץ פעם אחת בלבד כדי לסנכרן את כל המיילים
 * שכבר קיימים בטאב contacts.
 */
function syncExistingAllowedUsers() {
  const contacts = readAndDeduplicateContacts_();
  const byEmail = new Map();

  contacts.forEach(contact => {
    const email = normalizeEmail_(contact && contact.email);
    const phone = normalizeIsraeliPhone(contact && contact.phone);

    if (!email || !isValidEmail_(email) || !isValidNormalizedIsraeliPhone_(phone)) {
      return;
    }

    if (!byEmail.has(email)) {
      byEmail.set(email, { email, phone });
    }
  });

  if (!byEmail.size) {
    Logger.log("לא נמצאו זוגות תקינים של מייל וטלפון לסנכרון.");
    return { successCount: 0, failedEmails: [] };
  }

  let successCount = 0;
  const failedEmails = [];

  byEmail.forEach(record => {
    try {
      upsertAllowedUser_(
        record.email,
        "contacts-existing",
        undefined,
        record.phone
      );
      successCount += 1;
    } catch (error) {
      failedEmails.push(record.email);
      console.error("נכשל סנכרון ההרשאה " + record.email, error);
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

  return { successCount, failedEmails };
}

/**
 * פונקציית הסבה חד־פעמית לגרסה שבה כניסת משתמש רגיל דורשת
 * גם הרשאת מייל וגם הרשאת מספר טלפון תואמת.
 *
 * יש להריץ לפני פרסום כללי Firestore החדשים.
 */
function auditExistingAccessBeforeV16() {
  const activeAdminEmails = new Set(
    getActiveAdminRecords_().map(admin => normalizeEmail_(admin.email))
  );
  const phonePermissionsByKey = {};

  listFirestoreCollectionDocuments_(ALLOWED_PHONES_COLLECTION_NAME)
    .forEach(document => {
      const fields = document.fields || {};
      const documentId = cleanSheetValue_(getFirestoreDocumentId_(document));
      const phoneKey = getFirestoreStringField_(
        fields,
        "phoneKey",
        documentId
      );

      phonePermissionsByKey[phoneKey] = {
        phoneKey,
        phone: normalizeIsraeliPhone(
          getFirestoreStringField_(fields, "phone", "")
        ),
        email: normalizeEmail_(
          getFirestoreStringField_(fields, "email", "")
        ),
        active: getFirestoreBooleanField_(fields, "active", false)
      };
    });

  const blockers = [];
  let activeUserCount = 0;
  let protectedAdminCount = 0;
  let readyUserCount = 0;

  listFirestoreCollectionDocuments_("allowedUsers")
    .forEach(document => {
      const fields = document.fields || {};
      const documentId = normalizeEmail_(getFirestoreDocumentId_(document));
      const email = normalizeEmail_(
        getFirestoreStringField_(fields, "email", documentId)
      );
      const active = getFirestoreBooleanField_(fields, "active", false);

      if (!email || !active) return;
      activeUserCount += 1;

      if (activeAdminEmails.has(email)) {
        protectedAdminCount += 1;
        return;
      }

      const phone = normalizeIsraeliPhone(
        getFirestoreStringField_(fields, "phone", "")
      );
      const phoneKey = getFirestoreStringField_(fields, "phoneKey", "");

      if (!isValidNormalizedIsraeliPhone_(phone) || !phoneKey) {
        blockers.push({
          email,
          phone,
          reason: "חסרים מספר טלפון או phoneKey במסמך allowedUsers"
        });
        return;
      }

      const phonePermission = phonePermissionsByKey[phoneKey];
      if (!phonePermission) {
        blockers.push({
          email,
          phone,
          reason: "לא קיים מסמך allowedPhones תואם"
        });
        return;
      }

      if (phonePermission.active !== true) {
        blockers.push({
          email,
          phone,
          reason: "הרשאת הטלפון אינה פעילה"
        });
        return;
      }

      if (phonePermission.email !== email) {
        blockers.push({
          email,
          phone,
          reason:
            "מספר הטלפון מקושר למייל אחר: " +
            (phonePermission.email || "ללא מייל")
        });
        return;
      }

      if (
        phonePermission.phone !== phone ||
        phonePermission.phoneKey !== phoneKey
      ) {
        blockers.push({
          email,
          phone,
          reason: "פרטי הטלפון אינם זהים בשני מסמכי ההרשאה"
        });
        return;
      }

      readyUserCount += 1;
    });

  const result = {
    ok: blockers.length === 0,
    activeUserCount,
    protectedAdminCount,
    readyUserCount,
    blockerCount: blockers.length,
    blockers
  };

  Logger.log(JSON.stringify(result, null, 2));

  if (blockers.length) {
    const preview = blockers
      .slice(0, 20)
      .map(item => item.email + " — " + item.reason)
      .join("\n");

    throw new Error(
      "אין לפרסם עדיין את כללי Firestore או את index.html של v16. " +
      "נמצאו " + blockers.length + " הרשאות פעילות שאינן מוכנות:\n" +
      preview +
      (blockers.length > 20
        ? "\n...ופרטים נוספים מופיעים ב-Execution log."
        : "")
    );
  }

  return result;
}

function migrateExistingPhonePermissions() {
  const migrationResult = syncExistingAllowedUsers();
  const auditResult = auditExistingAccessBeforeV16();

  return {
    migration: migrationResult,
    audit: auditResult
  };
}
