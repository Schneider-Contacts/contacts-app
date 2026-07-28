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
const EMAIL_UPDATE_RESULT_PROPERTY_TTL_MS = 6 * 60 * 60 * 1000;

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

function createManagerWhatsappLinkHtml_(supportContact, label) {
  if (
    !supportContact ||
    supportContact.ok !== true ||
    !cleanSheetValue_(supportContact.whatsappUrl)
  ) {
    return "";
  }

  const name = cleanSheetValue_(supportContact.name || "מנהל ספר אנשי הקשר");
  const baseLabel = cleanSheetValue_(label || "שליחת WhatsApp למנהל הפעיל");
  const fullLabel = baseLabel.includes(name)
    ? baseLabel
    : baseLabel + " (" + name + ")";

  return '<a class="whatsapp" target="_blank" rel="noopener" href="' +
    escapeHtmlForOutput_(supportContact.whatsappUrl) +
    '">💬 ' + escapeHtmlForOutput_(fullLabel) + '</a>';
}

function createEmailUpdateChoicePage_(result, formData) {
  const safeResult = result || {};
  const appUrl = cleanSheetValue_(safeResult.appUrl || DEFAULT_MAIN_APP_URL);
  const normalizedBaseUrl = appUrl.endsWith("/") ? appUrl : appUrl + "/";
  const previousEmail = normalizeEmail_(safeResult.previousEmail || "");
  const previousMasked = cleanSheetValue_(safeResult.previousEmailMasked);
  const webAppUrl = cleanSheetValue_(ScriptApp.getService().getUrl());
  let supportContact = null;

  try {
    supportContact = getActiveManagerSupportContact_();
  } catch (error) {
    console.warn("לא ניתן היה להוסיף את פרטי המנהל לעמוד הבחירה:", error);
  }

  const managerName = supportContact && supportContact.ok === true
    ? cleanSheetValue_(supportContact.name)
    : "";
  const approvalUrl = previousEmail
    ? normalizedBaseUrl +
      "?email=" + encodeURIComponent(previousEmail) +
      "&manualApproval=1&fresh=1"
    : normalizedBaseUrl;

  const hiddenFields = [
    ["action", "emailUpdate"],
    ["phone", formData && formData.phone],
    ["email", formData && formData.email],
    ["confirmEmail", formData && formData.confirmEmail],
    ["website", ""],
    ["confirmRecentChange", "1"]
  ].map(item =>
    '<input type="hidden" name="' +
      escapeHtmlForOutput_(item[0]) +
      '" value="' + escapeHtmlForOutput_(item[1] || "") + '">'
  ).join("");

  const whatsappLink = createManagerWhatsappLinkHtml_(
    supportContact,
    "האישור דחוף? שליחת WhatsApp למנהל הפעיל"
  );

  return '<!DOCTYPE html><html lang="he" dir="rtl"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="theme-color" content="#f4fbf7"><title>מספר הטלפון משויך למייל אחר</title>' +
    '<style>' +
    ':root{--g:#059669;--g2:#047857;--bg:#f4fbf7;--border:#d9efe4}' +
    '*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:24px 14px;background:radial-gradient(circle at top right,rgba(110,231,183,.24),transparent 34%),var(--bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#1f2937}' +
    '.card{width:100%;max-width:480px;margin:0 auto;background:#fff;border:1px solid var(--border);border-radius:24px;padding:26px 18px 22px;box-shadow:0 12px 34px rgba(15,23,42,.09)}' +
    '.icon{width:62px;height:62px;margin:0 auto 14px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:28px;background:#fff8e8;border:1px solid #f3d990}' +
    'h1{margin:0 0 12px;text-align:center;font-size:25px;color:#17352d}.lead{margin:0 0 16px;padding:14px;border-radius:14px;background:#fff8e8;border:2px solid #f3d990;color:#6f4e0d;line-height:1.65;font-size:15px;font-weight:700}' +
    '.option{margin-top:12px;padding:14px;border:1px solid #d9efe4;border-radius:16px;background:#f9fdfa}.option h2{margin:0 0 6px;font-size:16px;color:#244f40}.option p{margin:0 0 12px;color:#526b61;font-size:13.5px;line-height:1.6}' +
    '.spam{margin:9px 0 12px;padding:11px;border-radius:12px;background:#fff3cd;border:2px solid #e5b84b;color:#644707;font-size:14px;font-weight:800;line-height:1.55}' +
    'a,button{width:100%;min-height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:15px;font-weight:700;cursor:pointer}.primary{border:0;background:var(--g);color:#fff;box-shadow:0 8px 20px rgba(5,150,105,.23)}.secondary{border:1px solid #a7f3d0;background:#ecfdf5;color:var(--g2)}' +
    'form{margin:0}.whatsapp{margin-top:12px;background:#ffffff;color:#176847;border:1px solid #86d7ad}.back{margin-top:10px;color:var(--g2);background:transparent;border:0;min-height:38px}' +
    '@media(max-width:600px){body{padding:16px 12px}.card{border-radius:20px;padding:22px 15px 19px}h1{font-size:23px}}' +
    '</style></head><body><main class="card"><div class="icon">?</div>' +
    '<h1>מספר הטלפון משויך למייל אחר</h1>' +
    '<div class="lead">מספר הטלפון כבר משויך לכתובת מייל אחרת' +
    (previousMasked ? ' (' + escapeHtmlForOutput_(previousMasked) + ')' : '') +
    '. בחרו את הסיבה לעדכון הנוסף.</div>' +
    '<section class="option"><h2>לא קיבלתי מייל אימות</h2>' +
    '<p>אין צורך לשנות שוב את המייל. עברו ישירות למסלול אישור מנהל. לאחר הזנת הסיסמה, בקשת האישור תישלח אוטומטית.</p>' +
    '<div class="spam">לפני כן יש לבדוק היטב גם בתיקיית ספאם / דואר זבל — מייל האימות מגיע לשם לעיתים קרובות.</div>' +
    '<a class="primary" href="' + escapeHtmlForOutput_(approvalUrl) + '">בקשת אימות ישיר ממנהל' +
      (managerName ? ' (' + escapeHtmlForOutput_(managerName) + ')' : '') +
    '</a></section>' +
    '<section class="option"><h2>הכתובת הקודמת נכתבה בטעות</h2>' +
    '<p>המשיכו רק אם אתם באמת מתקנים או מחליפים את כתובת המייל.</p>' +
    '<form method="post" action="' + escapeHtmlForOutput_(webAppUrl) + '">' + hiddenFields +
    '<button class="secondary" type="submit">המשך עם כתובת המייל החדשה</button></form></section>' +
    whatsappLink +
    '<a class="back" href="' + escapeHtmlForOutput_(normalizedBaseUrl + "email-update.html") + '">חזרה לטופס</a>' +
    '</main></body></html>';
}

function createEmailUpdateResultPage_(success, result, errorMessage) {
  const safeResult = result || {};
  const appUrl = cleanSheetValue_(safeResult.appUrl || DEFAULT_MAIN_APP_URL);
  const normalizedBaseUrl = appUrl.endsWith("/") ? appUrl : appUrl + "/";
  const updatePageUrl = normalizedBaseUrl + "email-update.html";
  const email = normalizeEmail_(safeResult.email || "");
  const accountUrl = normalizedBaseUrl +
    "?authMode=register&email=" + encodeURIComponent(email) + "&fresh=1";
  const approvalUrl = normalizedBaseUrl +
    "?email=" + encodeURIComponent(email) + "&manualApproval=1&fresh=1";
  const duplicate = Boolean(success && safeResult.duplicate === true);
  const title = success
    ? (duplicate ? "הפרטים כבר נקלטו" : "המייל עודכן בהצלחה")
    : "העדכון לא הושלם";
  const statusClass = success ? "success" : "error";
  const safeMessage = escapeHtmlForOutput_(
    success
      ? (duplicate
          ? "אותו מספר טלפון ואותו מייל כבר נקלטו ב־24 השעות האחרונות. אין צורך לשלוח את הטופס שוב."
          : "חזרו לאפליקציה והמשיכו עם כתובת המייל החדשה. אין צורך לשלוח את העדכון שוב.")
      : (errorMessage || "העדכון נכשל. נסו שוב.")
  );
  const details = success
    ? '<div class="details"><b>' +
      escapeHtmlForOutput_(safeResult.displayName || "איש הקשר") + '</b><br>' +
      (safeResult.phone ? escapeHtmlForOutput_(safeResult.phone) + '<br>' : '') +
      'כתובת המייל המעודכנת: <b>' + escapeHtmlForOutput_(email) + '</b></div>'
    : '';

  let supportContact = null;
  if (duplicate) {
    try {
      supportContact = getActiveManagerSupportContact_();
    } catch (error) {
      console.warn("לא ניתן היה לטעון את פרטי המנהל:", error);
    }
  }
  const managerName = supportContact && supportContact.ok === true
    ? cleanSheetValue_(supportContact.name)
    : "";
  const whatsappLink = duplicate
    ? createManagerWhatsappLinkHtml_(
        supportContact,
        "האישור דחוף? שליחת WhatsApp למנהל הפעיל"
      )
    : "";

  const steps = success
    ? '<ol><li>' +
      (duplicate
        ? 'אם מייל האימות לא הגיע, לחצו על „בקשת אימות ישיר ממנהל”.'
        : 'לחצו על „המשך להרשמה”, בחרו סיסמה וקבלו מייל אימות.') +
      '</li><li><b>חשוב: יש לבדוק גם בתיקיית ספאם / דואר זבל. מיילים אוטומטיים מגיעים לשם לעיתים קרובות.</b></li></ol>'
    : '';

  const primaryLink = success
    ? (duplicate
        ? '<a class="primary" href="' + escapeHtmlForOutput_(approvalUrl) + '">בקשת אימות ישיר ממנהל' +
          (managerName ? ' (' + escapeHtmlForOutput_(managerName) + ')' : '') + '</a>'
        : '<a class="primary" href="' + escapeHtmlForOutput_(accountUrl) + '">המשך להרשמה</a>')
    : '<a class="primary" href="' + escapeHtmlForOutput_(updatePageUrl) + '">חזרה לעדכון המייל</a>';
  const secondaryLink = success
    ? (duplicate
        ? '<a class="secondary" href="' + escapeHtmlForOutput_(accountUrl) + '">כניסה רגילה ושליחת אימות מחדש</a>'
        : '')
    : '<a class="secondary" href="' + escapeHtmlForOutput_(normalizedBaseUrl) + '">חזרה לאפליקציה</a>';

  return '<!DOCTYPE html><html lang="he" dir="rtl"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="theme-color" content="#f4fbf7"><title>' + title + '</title>' +
    '<style>' +
    ':root{--g:#059669;--g2:#047857;--bg:#f4fbf7;--border:#d9efe4}' +
    '*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:24px 14px;background:radial-gradient(circle at top right,rgba(110,231,183,.24),transparent 34%),var(--bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#1f2937}' +
    '.card{width:100%;max-width:460px;margin:0 auto;background:#fff;border:1px solid var(--border);border-radius:24px;padding:26px 18px 22px;box-shadow:0 12px 34px rgba(15,23,42,.09)}' +
    '.icon{width:62px;height:62px;margin:0 auto 14px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:30px;background:#ecfdf5;border:1px solid #a7f3d0}' +
    'h1{margin:0 0 12px;text-align:center;font-size:25px;color:#17352d}.message{margin:0 0 16px;padding:13px 14px;border-radius:14px;line-height:1.6;font-size:14px}.message.success,.details{background:#ecfdf5;border:1px solid #a7f3d0;color:#295746}.message.error{background:#fff1f2;border:1px solid #fecdd3;color:#be123c}' +
    '.details{margin-bottom:16px;padding:14px;border-radius:15px;line-height:1.7;font-size:14px}ol{margin:0 0 18px;padding:13px 30px 13px 13px;border-radius:14px;background:#fff3cd;border:2px solid #e5b84b;color:#604407;line-height:1.75;font-size:14px}' +
    'a{width:100%;min-height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:15px;font-weight:700}.primary{background:var(--g);color:#fff;box-shadow:0 8px 20px rgba(5,150,105,.23)}.secondary{margin-top:10px;background:#ecfdf5;color:var(--g2);border:1px solid #a7f3d0}.whatsapp{margin-top:10px;background:#fff;color:#176847;border:1px solid #86d7ad}' +
    '@media(max-width:600px){body{padding:16px 12px}.card{border-radius:20px;padding:22px 15px 19px}h1{font-size:23px}}' +
    '</style></head><body><main class="card"><div class="icon">' +
    (success ? '✓' : '!') + '</div><h1>' + escapeHtmlForOutput_(title) + '</h1>' +
    '<div class="message ' + statusClass + '">' + safeMessage + '</div>' +
    details + steps + primaryLink + secondaryLink + whatsappLink +
    '</main></body></html>';
}

function getPublicAuthRouteCacheKey_(kind, normalizedValue) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(kind || "") + ":" + String(normalizedValue || ""),
    Utilities.Charset.UTF_8
  );

  return "public-auth-route:" +
    Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, "").slice(0, 28);
}

function isActiveAdminEmail_(email) {
  const normalizedEmail = normalizeEmail_(email);
  if (!normalizedEmail) return false;

  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/admins/" +
    encodeURIComponent(normalizedEmail);

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() === 404) return false;
  if (
    response.getResponseCode() < 200 ||
    response.getResponseCode() >= 300
  ) {
    throw new Error(
      "בדיקת הרשאת המנהל נכשלה. HTTP " +
        response.getResponseCode()
    );
  }

  const fields = (JSON.parse(response.getContentText() || "{}").fields) || {};
  return Boolean(
    fields.active &&
    fields.active.booleanValue === true
  );
}

function getPublicEmailAuthRoute_(email) {
  const normalizedEmail = normalizeEmail_(email);

  if (!normalizedEmail || !isValidEmail_(normalizedEmail)) {
    return "INVALID_EMAIL";
  }

  const allowedUser = getAllowedUser_(normalizedEmail);
  if (!allowedUser) return "ASK_PHONE";
  if (allowedUser.active !== true) return "BLOCKED";

  return isAllowedEmailPhonePairActive_(normalizedEmail, allowedUser)
    ? "PASSWORD"
    : "ASK_PHONE";
}

function getPublicPhoneAuthRoute_(phone) {
  const normalizedPhone = normalizeIsraeliPhone(phone);

  if (!isValidNormalizedIsraeliPhone_(normalizedPhone)) {
    return "INVALID_PHONE";
  }

  const matches = findEmailUpdateMatches_(normalizedPhone);
  return matches.length ? "UPDATE_EMAIL" : "OPEN_FORM";
}

function getPublicAuthRoute_(kind, value, forceFresh) {
  const normalizedKind = cleanSheetValue_(kind).toLowerCase();
  const normalizedValue = normalizedKind === "email"
    ? normalizeEmail_(value)
    : normalizeIsraeliPhone(value);
  const cache = CacheService.getScriptCache();
  const cacheKey = getPublicAuthRouteCacheKey_(normalizedKind, normalizedValue);

  if (!forceFresh) {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const cooldownKey = cacheKey + ":busy";
  if (cache.get(cooldownKey)) {
    return {
      ok: true,
      source: PUBLIC_AUTH_ROUTE_SOURCE,
      route: "WAIT",
      admin: false
    };
  }
  cache.put(cooldownKey, "1", PUBLIC_AUTH_ROUTE_COOLDOWN_SECONDS);

  let route = "SYSTEM_ERROR";
  let isAdminEmail = false;

  if (normalizedKind === "email") {
    isAdminEmail = isActiveAdminEmail_(normalizedValue);
    route = isAdminEmail
      ? "PASSWORD"
      : getPublicEmailAuthRoute_(normalizedValue);
  } else if (normalizedKind === "phone") {
    route = getPublicPhoneAuthRoute_(normalizedValue);
  }

  const result = {
    ok: true,
    source: PUBLIC_AUTH_ROUTE_SOURCE,
    route,
    admin: isAdminEmail
  };

  if (!["SYSTEM_ERROR", "WAIT"].includes(route)) {
    cache.put(cacheKey, JSON.stringify(result), PUBLIC_AUTH_ROUTE_CACHE_SECONDS);
  }

  return result;
}

function createPublicAuthRouteJsonp_(e) {
  let callback = e && e.parameter
    ? cleanSheetValue_(e.parameter.callback)
    : "";

  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    callback = "receiveAuthRoute";
  }

  let payload;

  try {
    payload = getPublicAuthRoute_(
      e && e.parameter ? e.parameter.kind : "",
      e && e.parameter ? e.parameter.value : "",
      Boolean(e && e.parameter && e.parameter.fresh === "1")
    );
  } catch (error) {
    console.error("Public auth routing failed:", error);
    payload = {
      ok: false,
      source: PUBLIC_AUTH_ROUTE_SOURCE,
      route: "SYSTEM_ERROR",
      message: "לא ניתן לבדוק את מסלול הכניסה כרגע."
    };
  }

  const serialized = JSON.stringify(payload).replace(/</g, "\\u003c");

  return ContentService
    .createTextOutput(callback + "(" + serialized + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/**
 * בדיקת אבחון ידנית: הזינו מייל מורשה בעורך הסקריפט.
 * הפונקציה אינה משנה נתונים.
 */
function diagnoseAuthRouteForEmail(email) {
  const result = getPublicAuthRoute_("email", email, true);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * בדיקת אבחון ידנית והרשאתית עבור מסלול איפוס הסיסמה.
 * קוראת חשבון של מנהל פעיל אך אינה משנה משתמש, סיסמה או נתונים.
 */
function diagnoseFirebaseAuthLookup() {
  const admins = getActiveAdminRecords_();
  if (!admins.length) {
    throw new Error("לא נמצא מנהל פעיל לבדיקת Firebase Authentication.");
  }

  const email = normalizeEmail_(admins[0].email);
  const user = getFirebaseUserByEmailAdmin_(email);
  const result = {
    ok: true,
    email,
    userFound: Boolean(user && cleanSheetValue_(user.localId)),
    disabled: Boolean(user && user.disabled === true)
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}



function getAuthFlowDocument_(collectionName, documentId) {
  const normalizedId = cleanSheetValue_(documentId);
  if (!normalizedId) return null;

  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/" +
    collectionName +
    "/" + encodeURIComponent(normalizedId);
  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() === 404) return null;
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error("קריאת נתוני האימות נכשלה.");
  }

  const document = JSON.parse(response.getContentText() || "{}");
  return {
    id: normalizedId,
    data: firestoreDocumentToJs_(document),
    updateTime: cleanSheetValue_(document.updateTime)
  };
}

function patchAuthFlowDocument_(collectionName, documentId, fields) {
  const fieldNames = Object.keys(fields || {});
  if (!fieldNames.length) return;

  const mask = fieldNames
    .map(name => "updateMask.fieldPaths=" + encodeURIComponent(name))
    .join("&");
  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/" +
    collectionName +
    "/" + encodeURIComponent(documentId) +
    "?" + mask;
  const response = UrlFetchApp.fetch(url, {
    method: "patch",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ fields }),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(
      "שמירת נתוני האימות נכשלה. HTTP " +
        response.getResponseCode()
    );
  }
}

function getPasswordResetRequest_(email) {
  const normalizedEmail = normalizeEmail_(email);
  if (!normalizedEmail) return null;

  const request = getAuthFlowDocument_(
    PASSWORD_RECOVERY_REQUEST_COLLECTION,
    normalizedEmail
  );
  if (!request) return null;

  return {
    ...request.data,
    email: normalizeEmail_(request.data.email || normalizedEmail),
    status: cleanSheetValue_(request.data.status || "pending"),
    updateTime: request.updateTime
  };
}

function createPasswordRecoverySecret_() {
  const seed = [
    Utilities.getUuid(),
    Utilities.getUuid(),
    String(Date.now()),
    String(Math.random())
  ].join("|");
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      seed,
      Utilities.Charset.UTF_8
    )
  ).replace(/=+$/g, "");
}

function hashPasswordRecoverySecret_(secret) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      cleanSheetValue_(secret),
      Utilities.Charset.UTF_8
    )
  ).replace(/=+$/g, "");
}

function safeSecretEquals_(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (!a || a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

function savePasswordResetRequest_(email) {
  const normalizedEmail = normalizeEmail_(email);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("המערכת עסוקה בבקשה אחרת. נסו שוב בעוד רגע.");
  }

  try {
    const nowDate = new Date();
    const existing = getPasswordResetRequest_(normalizedEmail);
    const existingExpiry = existing && (
      existing.status === "approved"
        ? existing.approvedUntil
        : existing.requestExpiresAt
    )
      ? new Date(
          existing.status === "approved"
            ? existing.approvedUntil
            : existing.requestExpiresAt
        )
      : null;
    const existingActive = Boolean(
      existing &&
      ["pending", "approved"].includes(existing.status) &&
      existingExpiry &&
      !Number.isNaN(existingExpiry.getTime()) &&
      existingExpiry.getTime() > nowDate.getTime()
    );

    // אסור להחליף בקשה פעילה: אחרת דפדפן אחר יכול היה לקבל
    // סוד חדש בזמן שהמנהל מאשר את הבקשה המקורית.
    if (existingActive) {
      return {
        duplicate: true,
        requestId: "",
        recoveryToken: ""
      };
    }

    const now = nowDate.toISOString();
    const requestExpiresAt = getEndOfIsraelDay_(nowDate);
    const requestId = Utilities.getUuid().replace(/-/g, "");
    const recoveryToken = createPasswordRecoverySecret_();

    patchAuthFlowDocument_(
      PASSWORD_RECOVERY_REQUEST_COLLECTION,
      normalizedEmail,
      {
        email: { stringValue: normalizedEmail },
        requestId: { stringValue: requestId },
        recoveryTokenHash: {
          stringValue: hashPasswordRecoverySecret_(recoveryToken)
        },
        status: { stringValue: "pending" },
        requestedAt: { timestampValue: now },
        requestExpiresAt: {
          timestampValue: requestExpiresAt.toISOString()
        },
        updatedAt: { timestampValue: now },
        approvedAt: { nullValue: null },
        approvedUntil: { nullValue: null },
        handledAt: { nullValue: null },
        handledBy: { stringValue: "" },
        consumedAt: { nullValue: null },
        sentAt: { nullValue: null }
      }
    );

    return {
      duplicate: false,
      requestId,
      recoveryToken
    };
  } finally {
    lock.releaseLock();
  }
}

function createPasswordResetRequestJsonp_(e) {
  let callback = e && e.parameter
    ? cleanSheetValue_(e.parameter.callback)
    : "";
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    callback = "receivePasswordResetRequest";
  }

  let payload;
  try {
    const email = normalizeEmail_(e && e.parameter ? e.parameter.email : "");
    if (!email || !isValidEmail_(email)) {
      throw new Error("כתובת המייל אינה תקינה.");
    }

    const isAdminEmail = isActiveAdminEmail_(email);
    const allowedUser = getAllowedUser_(email);
    const eligible = isAdminEmail || (
      allowedUser &&
      allowedUser.active === true &&
      isAllowedEmailPhonePairActive_(email, allowedUser)
    );

    if (!eligible) {
      // תשובה כללית מונעת בדיקה אנונימית אם מייל מסוים מורשה.
      payload = {
        ok: true,
        duplicate: false,
        managerName: ""
      };
    } else {
      const supportContact = getActiveManagerSupportContact_();
      const recovery = savePasswordResetRequest_(email);
      payload = {
        ok: true,
        duplicate: recovery.duplicate === true,
        requestId: recovery.requestId,
        recoveryToken: recovery.recoveryToken,
        managerName: supportContact && supportContact.ok
          ? cleanSheetValue_(supportContact.name)
          : ""
      };
    }
  } catch (error) {
    console.error("Password reset request failed:", error);
    payload = {
      ok: false,
      message: error && error.message
        ? String(error.message)
        : "לא ניתן לשלוח את הבקשה כרגע."
    };
  }

  return ContentService
    .createTextOutput(
      callback + "(" + JSON.stringify(payload).replace(/</g, "\\u003c") + ");"
    )
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function createPasswordRecoveryStatusJsonp_(e) {
  let callback = e && e.parameter
    ? cleanSheetValue_(e.parameter.callback)
    : "";
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    callback = "receivePasswordRecoveryStatus";
  }

  let payload;
  try {
    const email = normalizeEmail_(e && e.parameter ? e.parameter.email : "");
    const requestId = cleanSheetValue_(
      e && e.parameter ? e.parameter.requestId : ""
    );
    const request = getPasswordResetRequest_(email);

    if (
      !request ||
      !requestId ||
      request.requestId !== requestId
    ) {
      payload = { ok: true, status: "missing" };
    } else {
      const statusExpiry = request.status === "approved"
        ? request.approvedUntil
        : request.requestExpiresAt;
      const approvedUntil = statusExpiry
        ? new Date(statusExpiry)
        : null;
      const expired = Boolean(
        approvedUntil &&
        !Number.isNaN(approvedUntil.getTime()) &&
        approvedUntil.getTime() <= Date.now()
      );

      payload = {
        ok: true,
        status: expired && ["pending", "approved"].includes(request.status)
          ? "expired"
          : request.status,
        approvedUntil: approvedUntil && !Number.isNaN(approvedUntil.getTime())
          ? approvedUntil.toISOString()
          : ""
      };
    }
  } catch (error) {
    console.error("Password recovery status failed:", error);
    payload = {
      ok: false,
      message: "לא ניתן לבדוק כרגע את מצב בקשת האיפוס."
    };
  }

  return ContentService
    .createTextOutput(
      callback + "(" + JSON.stringify(payload).replace(/</g, "\\u003c") + ");"
    )
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function verifyFirebaseUserIdToken_(idToken) {
  const token = cleanSheetValue_(idToken);
  if (!token || token.length > 5000) {
    throw new Error("לא התקבל אימות משתמש תקין.");
  }

  const response = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" +
      encodeURIComponent(FIREBASE_WEB_API_KEY),
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken: token }),
      muteHttpExceptions: true
    }
  );

  if (
    response.getResponseCode() < 200 ||
    response.getResponseCode() >= 300
  ) {
    throw new Error("האימות פג. יש להתחבר מחדש ולנסות שוב.");
  }

  const payload = JSON.parse(response.getContentText() || "{}");
  const user = Array.isArray(payload.users) ? payload.users[0] : null;
  const email = normalizeEmail_(user && user.email);

  if (!user || !email || user.disabled === true) {
    throw new Error("החשבון אינו פעיל או שאינו זמין.");
  }

  return {
    email,
    uid: cleanSheetValue_(user.localId),
    emailVerified: user.emailVerified === true
  };
}

function verifyFirebaseAdminIdToken_(idToken) {
  const user = verifyFirebaseUserIdToken_(idToken);
  if (
    user.emailVerified !== true ||
    !isActiveAdminEmail_(user.email)
  ) {
    throw new Error("הפעולה מותרת רק למנהל פעיל עם מייל מאומת.");
  }

  return user;
}

function getEndOfIsraelDay_(date) {
  const value = date instanceof Date ? date : new Date();
  const timeZone = "Asia/Jerusalem";
  const dateKey = Utilities.formatDate(value, timeZone, "yyyy-MM-dd");
  let rawOffset = Utilities.formatDate(value, timeZone, "Z");
  let offset = rawOffset.slice(0, 3) + ":" + rawOffset.slice(3);
  let endOfDay = new Date(dateKey + "T23:59:59.999" + offset);
  const endRawOffset = Utilities.formatDate(endOfDay, timeZone, "Z");
  const endOffset =
    endRawOffset.slice(0, 3) + ":" + endRawOffset.slice(3);
  if (endOffset !== offset) {
    offset = endOffset;
    endOfDay = new Date(dateKey + "T23:59:59.999" + offset);
  }
  return endOfDay;
}

function getPreviousVerifiedAccessEmail_(allowedUser) {
  const currentEmail = normalizeEmail_(allowedUser && allowedUser.email);
  const currentPhone = normalizeIsraeliPhone(
    allowedUser && allowedUser.phone
  );
  const candidates = [
    ...new Set(
      []
        .concat(allowedUser && allowedUser.previousAccessEmails || [])
        .concat(allowedUser && allowedUser.pendingOldEmails || [])
        .map(normalizeEmail_)
        .filter(email => email && email !== currentEmail)
    )
  ];

  for (let index = 0; index < candidates.length; index += 1) {
    const previous = getAllowedUser_(candidates[index]);
    const samePhone = Boolean(
      previous &&
      currentPhone &&
      normalizeIsraeliPhone(previous.phone) === currentPhone
    );
    const wasVerified = Boolean(
      previous &&
      (
        previous.authState === "verified" ||
        previous.lastVerifiedLoginAt
      )
    );

    if (samePhone && wasVerified) return candidates[index];
  }

  return "";
}

function activateTemporaryAccessFromWeb_(parameters) {
  const identity = verifyFirebaseUserIdToken_(
    parameters && parameters.idToken
  );
  const allowedUser = getAllowedUser_(identity.email);

  if (
    !allowedUser ||
    allowedUser.active !== true ||
    !isAllowedEmailPhonePairActive_(identity.email, allowedUser)
  ) {
    throw new Error(
      "לא נמצאה התאמה פעילה בין המייל למספר הטלפון הרשום."
    );
  }

  if (allowedUser.accessReviewRequired !== true) {
    return {
      ok: true,
      permanent: true,
      temporary: false
    };
  }

  if (
    allowedUser.accessReviewStatus === ACCESS_REVIEW_STATUS_REJECTED ||
    allowedUser.accessReviewStatus === ACCESS_REVIEW_STATUS_REVOKED
  ) {
    return {
      ok: true,
      permanent: false,
      temporary: false,
      blockedByManager: true
    };
  }

  const existingUntil = allowedUser.temporaryAccessUntil
    ? new Date(allowedUser.temporaryAccessUntil)
    : null;
  if (
    existingUntil &&
    !Number.isNaN(existingUntil.getTime()) &&
    existingUntil.getTime() > Date.now()
  ) {
    return {
      ok: true,
      permanent: false,
      temporary: true,
      approvedUntil: existingUntil.toISOString(),
      reason: cleanSheetValue_(
        allowedUser.temporaryAccessReason || ""
      )
    };
  }

  if (
    allowedUser.accessReviewStatus ===
      ACCESS_REVIEW_STATUS_TEMPORARY
  ) {
    return {
      ok: true,
      permanent: false,
      temporary: false,
      expired: true,
      needsManager: true
    };
  }

  const previousVerifiedEmail = identity.emailVerified
    ? ""
    : getPreviousVerifiedAccessEmail_(allowedUser);
  if (!identity.emailVerified && !previousVerifiedEmail) {
    return {
      ok: true,
      permanent: false,
      temporary: false,
      needsManager: true
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const approvedUntil = getEndOfIsraelDay_(now);
  const reason = identity.emailVerified
    ? "verified_current_email"
    : "previous_verified_email";
  const verificationRequest = getAuthFlowDocument_(
    "verificationRequests",
    identity.email
  );
  const requestedAt = verificationRequest &&
    verificationRequest.data &&
    verificationRequest.data.requestedAt
      ? verificationRequest.data.requestedAt
      : nowIso;
  const actionId = Utilities.getUuid().replace(/-/g, "");

  const allowedFields = {
    accessReviewRequired: { booleanValue: true },
    accessReviewStatus: {
      stringValue: ACCESS_REVIEW_STATUS_TEMPORARY
    },
    temporaryAccessUntil: {
      timestampValue: approvedUntil.toISOString()
    },
    temporaryAccessReason: { stringValue: reason },
    temporaryAccessGrantedAt: { timestampValue: nowIso },
    temporaryAccessGrantedBy: { stringValue: "automatic" },
    updatedAt: { timestampValue: nowIso }
  };
  const requestFields = {
    email: { stringValue: identity.email },
    requestType: { stringValue: "access_review" },
    status: {
      stringValue: ACCESS_REVIEW_STATUS_TEMPORARY
    },
    requestedAt: { timestampValue: requestedAt },
    updatedAt: { timestampValue: nowIso },
    temporaryAccessUntil: {
      timestampValue: approvedUntil.toISOString()
    },
    automaticReason: { stringValue: reason },
    handledAt: { nullValue: null },
    handledBy: { stringValue: "" }
  };
  const writes = [
    {
      update: {
        name: getFirestoreDocumentName_(
          "allowedUsers",
          identity.email
        ),
        fields: allowedFields
      },
      updateMask: { fieldPaths: Object.keys(allowedFields) },
      currentDocument: allowedUser.updateTime
        ? { updateTime: allowedUser.updateTime }
        : { exists: true }
    },
    {
      update: {
        name: getFirestoreDocumentName_(
          "verificationRequests",
          identity.email
        ),
        fields: requestFields
      },
      updateMask: { fieldPaths: Object.keys(requestFields) },
      currentDocument:
        verificationRequest && verificationRequest.updateTime
          ? { updateTime: verificationRequest.updateTime }
          : { exists: false }
    },
    {
      update: {
        name: getFirestoreDocumentName_("admin_actions", actionId),
        fields: {
          action: { stringValue: "temporary_access_automatic" },
          targetEmail: { stringValue: identity.email },
          source: { stringValue: reason },
          timestamp: { timestampValue: nowIso }
        }
      },
      currentDocument: { exists: false }
    }
  ];

  commitFirestoreWrites_(writes);
  return {
    ok: true,
    permanent: false,
    temporary: true,
    approvedUntil: approvedUntil.toISOString(),
    reason,
    previousVerifiedEmail: previousVerifiedEmail
      ? maskEmailAddress_(previousVerifiedEmail)
      : ""
  };
}

function createTemporaryAccessPostResponse_(e) {
  const parameters = e && e.parameter ? e.parameter : {};
  const nonce = cleanSheetValue_(parameters.nonce).slice(0, 160);
  let payload;

  try {
    payload = activateTemporaryAccessFromWeb_(parameters);
  } catch (error) {
    console.error("Temporary access activation failed:", error);
    payload = {
      ok: false,
      message: error && error.message
        ? String(error.message)
        : "לא ניתן להפעיל כרגע גישה זמנית."
    };
  }

  payload.source = "contacts-temporary-access";
  payload.nonce = nonce;
  const serialized = JSON.stringify(payload).replace(/</g, "\\u003c");
  return HtmlService
    .createHtmlOutput(
      "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"></head><body>" +
      "<script>window.parent.postMessage(" +
      serialized +
      ",\"*\"" +
      ");</script></body></html>"
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getFirebaseUserByEmailAdmin_(email) {
  const normalizedEmail = normalizeEmail_(email);
  const response = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/projects/" +
      encodeURIComponent(FIREBASE_PROJECT_ID) +
      "/accounts:lookup",
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken()
      },
      payload: JSON.stringify({ email: [normalizedEmail] }),
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    let apiMessage = "";
    try {
      const errorPayload = JSON.parse(response.getContentText() || "{}");
      apiMessage = cleanSheetValue_(
        errorPayload &&
        errorPayload.error &&
        errorPayload.error.message
      );
    } catch (error) {
      apiMessage = "";
    }
    console.error(
      "Firebase Authentication lookup failed:",
      response.getResponseCode(),
      apiMessage || "Unknown API error"
    );
    throw new Error(
      "בדיקת חשבון Firebase נכשלה" +
      " (" + response.getResponseCode() +
      (apiMessage ? ": " + apiMessage : "") +
      "). יש לוודא שהרשאת Firebase Authentication Admin פעילה."
    );
  }

  const payload = JSON.parse(response.getContentText() || "{}");
  const users = Array.isArray(payload.users) ? payload.users : [];
  const user = users.find(item =>
    normalizeEmail_(item && item.email) === normalizedEmail
  );
  if (!user || !cleanSheetValue_(user.localId)) {
    throw new Error(
      "לא נמצא חשבון Firebase עבור כתובת המייל הזו."
    );
  }
  if (user.disabled === true) {
    throw new Error("חשבון Firebase חסום.");
  }
  return user;
}

function updateFirebasePasswordAdmin_(localId, password) {
  const nowSeconds = String(Math.floor(Date.now() / 1000));
  const response = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:update",
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken()
      },
      payload: JSON.stringify({
        localId: cleanSheetValue_(localId),
        targetProjectId: FIREBASE_PROJECT_ID,
        password,
        validSince: nowSeconds,
        returnSecureToken: false
      }),
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    const rawMessage = response.getContentText();
    let firebaseMessage = "";
    try {
      const payload = JSON.parse(rawMessage || "{}");
      firebaseMessage = cleanSheetValue_(
        payload && payload.error && payload.error.message
      );
    } catch (error) {
      firebaseMessage = "";
    }

    if (
      firebaseMessage.indexOf("PASSWORD_DOES_NOT_MEET_REQUIREMENTS") >= 0 ||
      firebaseMessage.indexOf("WEAK_PASSWORD") >= 0
    ) {
      throw new Error(
        "הסיסמה אינה עומדת בדרישות האבטחה. יש לבחור סיסמה חזקה יותר."
      );
    }

    throw new Error(
      "עדכון הסיסמה ב־Firebase נכשל. יש לבדוק את הרשאות השרת."
    );
  }
}

function approvePasswordRecoveryFromWeb_(parameters) {
  const admin = verifyFirebaseAdminIdToken_(
    parameters && parameters.idToken
  );
  const email = normalizeEmail_(parameters && parameters.email);
  const requestId = cleanSheetValue_(
    parameters && parameters.requestId
  );
  const reason = cleanSheetValue_(
    parameters && parameters.reason
  ).slice(0, 300);
  const request = getPasswordResetRequest_(email);

  if (
    !request ||
    request.requestId !== requestId ||
    request.status !== "pending"
  ) {
    throw new Error("בקשת האיפוס כבר טופלה או שאינה זמינה.");
  }
  const requestExpiresAt = request.requestExpiresAt
    ? new Date(request.requestExpiresAt)
    : null;
  if (
    !requestExpiresAt ||
    Number.isNaN(requestExpiresAt.getTime()) ||
    requestExpiresAt.getTime() <= Date.now()
  ) {
    throw new Error("בקשת האיפוס פגה בחצות. יש לשלוח בקשה חדשה.");
  }
  if (reason.length < 3) {
    throw new Error("יש לציין בקצרה כיצד זהות המשתמש אומתה.");
  }

  const allowedUser = getAllowedUser_(email);
  const eligible = isActiveAdminEmail_(email) || (
    allowedUser &&
    allowedUser.active === true &&
    isAllowedEmailPhonePairActive_(email, allowedUser)
  );
  if (!eligible) {
    throw new Error(
      "לא ניתן לאשר איפוס לחשבון שאינו פעיל במערכת."
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const approvedUntil = getEndOfIsraelDay_(now);
  const actionId = Utilities.getUuid().replace(/-/g, "");
  const requestFields = {
    status: { stringValue: "approved" },
    approvedAt: { timestampValue: nowIso },
    approvedUntil: {
      timestampValue: approvedUntil.toISOString()
    },
    handledAt: { timestampValue: nowIso },
    handledBy: { stringValue: admin.email },
    approvalReason: { stringValue: reason },
    updatedAt: { timestampValue: nowIso }
  };

  commitFirestoreWrites_([
    {
      update: {
        name: getFirestoreDocumentName_(
          PASSWORD_RECOVERY_REQUEST_COLLECTION,
          email
        ),
        fields: requestFields
      },
      updateMask: { fieldPaths: Object.keys(requestFields) },
      currentDocument: request.updateTime
        ? { updateTime: request.updateTime }
        : { exists: true }
    },
    {
      update: {
        name: getFirestoreDocumentName_("admin_actions", actionId),
        fields: {
          action: { stringValue: "password_recovery_approved" },
          targetEmail: { stringValue: email },
          adminEmail: { stringValue: admin.email },
          reason: { stringValue: reason },
          approvedUntil: {
            timestampValue: approvedUntil.toISOString()
          },
          timestamp: { timestampValue: nowIso }
        }
      },
      currentDocument: { exists: false }
    }
  ]);

  return {
    ok: true,
    email,
    approvedUntil: approvedUntil.toISOString()
  };
}

function consumePasswordRecoveryFromWeb_(parameters) {
  const email = normalizeEmail_(parameters && parameters.email);
  const requestId = cleanSheetValue_(
    parameters && parameters.requestId
  );
  const recoveryToken = String(
    parameters && parameters.recoveryToken || ""
  );
  const password = String(parameters && parameters.password || "");

  if (!email || !isValidEmail_(email)) {
    throw new Error("כתובת המייל אינה תקינה.");
  }
  if (
    password.length < 8 ||
    password.length > PASSWORD_RECOVERY_MAX_PASSWORD_LENGTH
  ) {
    throw new Error("הסיסמה חייבת להכיל בין 8 ל־128 תווים.");
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("המערכת עסוקה באיפוס אחר. נסו שוב בעוד רגע.");
  }

  try {
    const request = getPasswordResetRequest_(email);
    const approvedUntil = request && request.approvedUntil
      ? new Date(request.approvedUntil)
      : null;
    const tokenMatches = Boolean(
      request &&
      safeSecretEquals_(
        request.recoveryTokenHash,
        hashPasswordRecoverySecret_(recoveryToken)
      )
    );

    if (
      !request ||
      request.requestId !== requestId ||
      request.status !== "approved" ||
      !tokenMatches
    ) {
      throw new Error(
        "אישור האיפוס אינו תקין או שכבר נעשה בו שימוש."
      );
    }
    if (
      !approvedUntil ||
      Number.isNaN(approvedUntil.getTime()) ||
      approvedUntil.getTime() <= Date.now()
    ) {
      patchAuthFlowDocument_(
        PASSWORD_RECOVERY_REQUEST_COLLECTION,
        email,
        {
          status: { stringValue: "expired" },
          updatedAt: { timestampValue: new Date().toISOString() }
        }
      );
      throw new Error(
        "אישור האיפוס פג בחצות. יש לשלוח בקשה חדשה."
      );
    }

    const allowedUser = getAllowedUser_(email);
    const eligible = isActiveAdminEmail_(email) || (
      allowedUser &&
      allowedUser.active === true &&
      isAllowedEmailPhonePairActive_(email, allowedUser)
    );
    if (!eligible) {
      throw new Error("הרשאת הכניסה של החשבון אינה פעילה.");
    }

    const consumingAt = new Date().toISOString();
    patchAuthFlowDocument_(
      PASSWORD_RECOVERY_REQUEST_COLLECTION,
      email,
      {
        status: { stringValue: "consuming" },
        consumingAt: { timestampValue: consumingAt },
        updatedAt: { timestampValue: consumingAt }
      }
    );

    let firebaseUpdated = false;
    try {
      const firebaseUser = getFirebaseUserByEmailAdmin_(email);
      updateFirebasePasswordAdmin_(firebaseUser.localId, password);
      firebaseUpdated = true;
    } catch (error) {
      patchAuthFlowDocument_(
        PASSWORD_RECOVERY_REQUEST_COLLECTION,
        email,
        {
          status: { stringValue: "approved" },
          consumingAt: { nullValue: null },
          updatedAt: { timestampValue: new Date().toISOString() }
        }
      );
      throw error;
    }

    if (firebaseUpdated) {
      const completedAt = new Date().toISOString();
      try {
        const actionId = Utilities.getUuid().replace(/-/g, "");
        const usedFields = {
          status: { stringValue: "used" },
          consumedAt: { timestampValue: completedAt },
          recoveryTokenHash: { stringValue: "" },
          updatedAt: { timestampValue: completedAt }
        };
        commitFirestoreWrites_([
          {
            update: {
              name: getFirestoreDocumentName_(
                PASSWORD_RECOVERY_REQUEST_COLLECTION,
                email
              ),
              fields: usedFields
            },
            updateMask: { fieldPaths: Object.keys(usedFields) }
          },
          {
            update: {
              name: getFirestoreDocumentName_(
                "admin_actions",
                actionId
              ),
              fields: {
                action: {
                  stringValue: "password_recovery_completed"
                },
                targetEmail: { stringValue: email },
                timestamp: { timestampValue: completedAt }
              }
            },
            currentDocument: { exists: false }
          }
        ]);
      } catch (trackingError) {
        console.error(
          "Password changed but recovery tracking failed:",
          trackingError
        );
      }
    }

    return { ok: true, email };
  } finally {
    lock.releaseLock();
  }
}

function createAuthManagementPostResponse_(e) {
  const parameters = e && e.parameter ? e.parameter : {};
  const action = cleanSheetValue_(parameters.action);
  const nonce = cleanSheetValue_(parameters.nonce).slice(0, 160);
  let payload;

  try {
    if (action === "approvePasswordRecovery") {
      payload = approvePasswordRecoveryFromWeb_(parameters);
    } else if (action === "consumePasswordRecovery") {
      payload = consumePasswordRecoveryFromWeb_(parameters);
    } else {
      throw new Error("פעולת האימות אינה מוכרת.");
    }
  } catch (error) {
    console.error("Authentication management action failed:", error);
    payload = {
      ok: false,
      message: error && error.message
        ? String(error.message)
        : "הפעולה נכשלה."
    };
  }

  payload.source = "contacts-auth-management";
  payload.nonce = nonce;
  const serialized = JSON.stringify(payload).replace(/</g, "\\u003c");
  return HtmlService
    .createHtmlOutput(
      "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"></head><body>" +
      "<script>window.parent.postMessage(" +
      serialized +
      ",\"*\"" +
      ");</script></body></html>"
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function readContactAddRequestForApproval_(requestId) {
  const normalizedRequestId = cleanSheetValue_(requestId);
  if (!normalizedRequestId || normalizedRequestId.length > 200) {
    throw new Error("מזהה בקשת ההוספה אינו תקין.");
  }

  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/contactAddRequests/" +
    encodeURIComponent(normalizedRequestId);
  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() === 404) {
    throw new Error("בקשת ההוספה לא נמצאה.");
  }
  if (
    response.getResponseCode() < 200 ||
    response.getResponseCode() >= 300
  ) {
    throw new Error(
      "קריאת בקשת ההוספה נכשלה. HTTP " +
        response.getResponseCode()
    );
  }

  const document = JSON.parse(response.getContentText() || "{}");
  return {
    id: normalizedRequestId,
    data: firestoreDocumentToJs_(document),
    updateTime: cleanSheetValue_(document.updateTime)
  };
}

function getContactApprovalValues_(parameters) {
  const source = parameters || {};
  const values = {
    firstName: cleanSheetValue_(source.firstName).slice(0, 100),
    lastName: cleanSheetValue_(source.lastName).slice(0, 100),
    titlePrefix: cleanSheetValue_(source.titlePrefix).slice(0, 60),
    role: cleanSheetValue_(source.role).slice(0, 160),
    department: cleanSheetValue_(source.department).slice(0, 160),
    phone: normalizeIsraeliPhone(source.phone),
    email: normalizeEmail_(source.email)
  };

  if (!isValidNormalizedIsraeliPhone_(values.phone)) {
    throw new Error("נדרש מספר טלפון ישראלי תקין כדי לאשר איש קשר.");
  }
  if (values.email && !isValidEmail_(values.email)) {
    throw new Error("כתובת המייל אינה תקינה.");
  }

  return values;
}

function upsertApprovedContactInContactsSheet_(values) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CONTACTS_OLD_SHEET_NAME);

  if (!sheet) {
    throw new Error('לא נמצא טאב בשם "' + CONTACTS_OLD_SHEET_NAME + '".');
  }

  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    throw new Error("בטאב contacts_old אין שורת כותרות.");
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(cleanSheetValue_);
  const sourceFields = CONTACT_FIELDS.slice(0, 11);
  const missingHeaders = sourceFields.filter(
    field => findHeaderColumn_(headers, field) === 0
  );

  if (missingHeaders.length) {
    throw new Error(
      "בטאב contacts_old חסרות הכותרות: " + missingHeaders.join(", ")
    );
  }

  const headerIndexes = {};
  sourceFields.forEach(field => {
    headerIndexes[field] = findHeaderColumn_(headers, field) - 1;
  });

  const lastRow = sheet.getLastRow();
  const existingRows = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues()
    : [];
  const matches = [];

  existingRows.forEach((row, index) => {
    const phone = normalizeIsraeliPhone(row[headerIndexes.phone]);
    if (phone === values.phone) {
      matches.push({
        rowNumber: index + 2,
        values: row
      });
    }
  });

  if (matches.length > 1) {
    throw new Error(
      "נמצאו כמה שורות בטאב contacts_old עם אותו מספר טלפון. יש לטפל בכפילות לפני האישור."
    );
  }

  const existingMatch = matches[0] || null;
  const existingContact = {};
  sourceFields.forEach(field => {
    existingContact[field] = existingMatch
      ? cleanSheetValue_(existingMatch.values[headerIndexes[field]])
      : "";
  });
  existingContact.phone = normalizeIsraeliPhone(existingContact.phone);
  existingContact.email = normalizeEmail_(existingContact.email);

  const now = new Date().toISOString();
  const choose = (nextValue, currentValue) =>
    cleanSheetValue_(nextValue) || cleanSheetValue_(currentValue);
  const contact = {
    id: existingContact.id || "",
    first_name_he: choose(values.firstName, existingContact.first_name_he),
    last_name_he: choose(values.lastName, existingContact.last_name_he),
    first_name_en: existingContact.first_name_en || "",
    last_name_en: existingContact.last_name_en || "",
    title_prefix: choose(values.titlePrefix, existingContact.title_prefix),
    role: choose(values.role, existingContact.role),
    department: choose(values.department, existingContact.department),
    hospital: existingContact.hospital || "",
    phone: values.phone,
    email: values.email || existingContact.email || "",
    source: existingMatch
      ? "admin-approved-update"
      : "user-submission-approved",
    status: "active",
    created_at: now,
    updated_at: now
  };
  const targetRow = existingMatch
    ? existingMatch.rowNumber
    : Math.max(2, lastRow + 1);

  const targetValues = existingMatch
    ? existingMatch.values.slice()
    : new Array(lastColumn).fill("");
  sourceFields.forEach(field => {
    targetValues[headerIndexes[field]] = contact[field];
  });
  sheet.getRange(targetRow, 1, 1, lastColumn).setValues([targetValues]);
  SpreadsheetApp.flush();

  return {
    contact,
    row: targetRow,
    created: !existingMatch
  };
}

function writeApprovedContactOverride_(contact, adminEmail, isNewContact) {
  const documentId = getContactDocumentId_(contact);
  const existingOverride = getContactOverride_(documentId);
  const effectiveIsNewContact = Boolean(
    isNewContact === true ||
    (existingOverride && existingOverride.is_new_contact === true)
  );
  const firstSeenAt = cleanSheetValue_(
    existingOverride && existingOverride.first_seen_at
  ) || (effectiveIsNewContact ? cleanSheetValue_(contact.created_at) : "");
  const now = new Date().toISOString();
  const fields = {};

  ADMIN_OVERRIDE_FIELDS.forEach(field => {
    if (field === "is_new_contact") {
      fields[field] = {
        booleanValue: effectiveIsNewContact
      };
      return;
    }

    const value = field === "first_seen_at"
      ? firstSeenAt
      : contact[field];
    fields[field] = {
      stringValue: cleanSheetValue_(value)
    };
  });
  fields.deleted = { booleanValue: false };
  fields.updatedBy = { stringValue: normalizeEmail_(adminEmail) };
  fields.updatedAt = { timestampValue: now };

  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/" +
    CONTACT_OVERRIDES_COLLECTION_NAME +
    "/" +
    encodeURIComponent(documentId);
  const response = UrlFetchApp.fetch(url, {
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({ fields }),
    muteHttpExceptions: true
  });

  if (
    response.getResponseCode() < 200 ||
    response.getResponseCode() >= 300
  ) {
    throw new Error(
      "שמירת פרטי איש הקשר ב-Firestore נכשלה. HTTP " +
        response.getResponseCode()
    );
  }
}

function completeApprovedContactRequest_(
  request,
  values,
  contact,
  adminEmail
) {
  const now = new Date().toISOString();
  const documentId = getContactDocumentId_(contact);
  const requestFields = {
    firstName: { stringValue: values.firstName },
    lastName: { stringValue: values.lastName },
    titlePrefix: { stringValue: values.titlePrefix },
    role: { stringValue: values.role },
    department: { stringValue: values.department },
    phone: { stringValue: contact.phone },
    email: { stringValue: contact.email },
    status: { stringValue: "approved" },
    updatedAt: { timestampValue: now },
    handledAt: { timestampValue: now },
    handledBy: { stringValue: adminEmail },
    approvedContactId: { stringValue: documentId }
  };
  const actionId = Utilities.getUuid();
  const grantsFormAccess =
    request.data.grantAccessOnApproval === true;
  const actionFields = {
    action: {
      stringValue: grantsFormAccess
        ? "form_access_request_approved"
        : "contact_add_request_approved"
    },
    targetId: { stringValue: documentId },
    targetEmail: { stringValue: contact.email || "" },
    targetPhone: { stringValue: contact.phone || "" },
    displayName: {
      stringValue: [
        contact.title_prefix,
        contact.first_name_he,
        contact.last_name_he
      ].filter(Boolean).join(" ")
    },
    requesterEmail: {
      stringValue: normalizeEmail_(request.data.reporterEmail)
    },
    adminEmail: { stringValue: adminEmail },
    timestamp: { timestampValue: now }
  };

  commitFirestoreWrites_([
    {
      update: {
        name: getFirestoreDocumentName_(
          "contactAddRequests",
          request.id
        ),
        fields: requestFields
      },
      updateMask: {
        fieldPaths: Object.keys(requestFields)
      },
      currentDocument: request.updateTime
        ? { updateTime: request.updateTime }
        : { exists: true }
    },
    {
      update: {
        name: getFirestoreDocumentName_("admin_actions", actionId),
        fields: actionFields
      },
      currentDocument: { exists: false }
    }
  ]);
}

function approveContactAddRequestFromWeb_(parameters) {
  const admin = verifyFirebaseAdminIdToken_(parameters && parameters.idToken);
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    throw new Error("המערכת עסוקה באישור אחר. נסו שוב בעוד מספר שניות.");
  }

  try {
    const request = readContactAddRequestForApproval_(
      parameters && parameters.requestId
    );
    if (
      request.data.status !== "pending" ||
      request.data.requestType !== "contact_add"
    ) {
      throw new Error("הבקשה כבר טופלה או שאינה בקשת הוספת איש קשר.");
    }

    const values = getContactApprovalValues_(parameters);
    const sheetResult = upsertApprovedContactInContactsSheet_(values);
    const contact = {
      ...sheetResult.contact,
      first_seen_at: sheetResult.created
        ? sheetResult.contact.created_at
        : "",
      is_new_contact: sheetResult.created
    };

    // רק לאחר הצלחת הכתיבה ל-Sheets מעדכנים את Firestore ואת הספרייה.
    writeApprovedContactOverride_(
      contact,
      admin.email,
      sheetResult.created
    );
    upsertContact_(contact);

    const contacts = readAndDeduplicateContacts_();
    const effectiveContacts = buildEffectiveDirectoryContacts_(contacts);
    writeSmartContactDirectory_(effectiveContacts);

    let accessResult = null;
    if (request.data.grantAccessOnApproval === true) {
      if (!contact.email || !isValidEmail_(contact.email)) {
        throw new Error(
          "כדי לאשר את הגישה יש להשלים כתובת מייל תקינה."
        );
      }
      accessResult = upsertAllowedUserPairAtomically_(
        contact.email,
        "google-form-admin-approved",
        contact.phone,
        {
          allowTransfer: true,
          allowReactivate: true,
          permanentApproval: true,
          approvedBy: admin.email
        }
      );
      clearPublicAuthRouteCache_("email", contact.email);
    }

    completeApprovedContactRequest_(
      request,
      values,
      contact,
      admin.email
    );

    return {
      ok: true,
      requestId: request.id,
      contactId: getContactDocumentId_(contact),
      created: sheetResult.created,
      accessGranted: Boolean(accessResult)
    };
  } finally {
    lock.releaseLock();
  }
}

function createContactApprovalPostResponse_(e) {
  const parameters = e && e.parameter ? e.parameter : {};
  const nonce = cleanSheetValue_(parameters.nonce).slice(0, 160);
  let payload;

  try {
    payload = approveContactAddRequestFromWeb_(parameters);
  } catch (error) {
    console.error("Contact addition approval failed:", error);
    payload = {
      ok: false,
      message: error && error.message
        ? String(error.message)
        : "אישור איש הקשר נכשל."
    };
  }

  payload.source = "contacts-admin-approval";
  payload.nonce = nonce;
  const serialized = JSON.stringify(payload).replace(/</g, "\\u003c");
  const html =
    "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"></head><body>" +
    "<script>window.parent.postMessage(" +
    serialized +
    ",\"*\"" +
    ");</script></body></html>";

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const action = e && e.parameter
    ? cleanSheetValue_(e.parameter.action)
    : "";

  if (action === "approveContactAddRequest") {
    return createContactApprovalPostResponse_(e);
  }
  if (action === "activateTemporaryAccess") {
    return createTemporaryAccessPostResponse_(e);
  }
  if (
    action === "approvePasswordRecovery" ||
    action === "consumePasswordRecovery"
  ) {
    return createAuthManagementPostResponse_(e);
  }

  try {
    if (!e || !e.parameter || action !== "emailUpdate") {
      throw new Error("בקשה לא תקינה.");
    }

    const formData = {
      phone: e.parameter.phone,
      email: e.parameter.email,
      confirmEmail: e.parameter.confirmEmail,
      website: e.parameter.website,
      confirmRecentChange: e.parameter.confirmRecentChange
    };
    const result = submitEmailUpdate(formData);

    if (result && result.requiresChoice === true) {
      return HtmlService
        .createHtmlOutput(createEmailUpdateChoicePage_(result, formData))
        .setTitle("מספר הטלפון משויך למייל אחר")
        .addMetaTag("viewport", "width=device-width, initial-scale=1");
    }

    return HtmlService
      .createHtmlOutput(createEmailUpdateResultPage_(true, result, ""))
      .setTitle(result && result.duplicate ? "הפרטים כבר נקלטו" : "המייל עודכן בהצלחה")
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
    cleanSheetValue_(e.parameter.action) === "authRoute"
  ) {
    return createPublicAuthRouteJsonp_(e);
  }

  if (
    e &&
    e.parameter &&
    cleanSheetValue_(e.parameter.action) === "supportContact"
  ) {
    return createSupportContactJsonp_(e);
  }

  if (
    e &&
    e.parameter &&
    cleanSheetValue_(e.parameter.action) === "passwordResetRequest"
  ) {
    return createPasswordResetRequestJsonp_(e);
  }

  if (
    e &&
    e.parameter &&
    cleanSheetValue_(e.parameter.action) === "passwordResetStatus"
  ) {
    return createPasswordRecoveryStatusJsonp_(e);
  }

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
