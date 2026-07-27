function getAccessReportWindowStart_(now) {
  const properties = PropertiesService.getScriptProperties();
  const stored = Number(
    properties.getProperty(DAILY_ACCESS_REPORT_LAST_SENT_KEY) || 0
  );

  if (stored > 0 && stored < now.getTime()) {
    return new Date(stored);
  }

  return new Date(now.getTime() - 24 * 60 * 60 * 1000);
}

function formatAccessReportDateTime_(date) {
  return Utilities.formatDate(
    date,
    "Asia/Jerusalem",
    "dd/MM/yyyy HH:mm"
  );
}

function getAccessGrantEvents_(windowStart, windowEnd) {
  const events = [];
  const userStateByEmail = {};

  listFirestoreCollectionDocuments_("allowedUsers").forEach(document => {
    const fields = document.fields || {};
    const documentId = normalizeEmail_(getFirestoreDocumentId_(document));
    const email = normalizeEmail_(
      getFirestoreStringField_(fields, "email", documentId)
    );
    const active = getFirestoreBooleanField_(fields, "active", false);
    const manualApproved = getFirestoreBooleanField_(
      fields,
      "manualApproved",
      false
    );
    const authState = getFirestoreStringField_(fields, "authState", "");
    const accessGrantedAt = getFirestoreTimestampField_(
      fields,
      "accessGrantedAt"
    );

    userStateByEmail[email] = {
      active,
      manualApproved,
      authState
    };

    if (
      accessGrantedAt &&
      accessGrantedAt.getTime() > windowStart.getTime() &&
      accessGrantedAt.getTime() <= windowEnd.getTime()
    ) {
      events.push({
        email,
        active,
        currentStatus: active ? "פעיל" : "נחסם מאז",
        timestamp: accessGrantedAt,
        type: "automatic",
        source: getFirestoreStringField_(
          fields,
          "accessGrantSource",
          getFirestoreStringField_(fields, "source", "automatic")
        ),
        approvedBy: ""
      });
    }
  });

  // אישור ידני נלקח מיומן הפעולות, כדי שיופיע בדוח גם אם בוטל בהמשך היום.
  queryFirestoreDocumentsSince_(
    "admin_actions",
    "timestamp",
    windowStart,
    0
  ).forEach(document => {
    const fields = document.fields || {};
    const action = getFirestoreStringField_(fields, "action", "");
    if (action !== "manual_approval_grant") return;

    const timestamp = getFirestoreTimestampField_(fields, "timestamp");
    if (
      !timestamp ||
      timestamp.getTime() <= windowStart.getTime() ||
      timestamp.getTime() > windowEnd.getTime()
    ) {
      return;
    }

    const email = normalizeEmail_(
      getFirestoreStringField_(fields, "targetEmail", "")
    );
    const state = userStateByEmail[email] || {};
    let currentStatus = "מצב נוכחי לא ידוע";

    if (state.active === false) {
      currentStatus = "הגישה נחסמה מאז";
    } else if (state.manualApproved === true) {
      currentStatus = "פעיל באישור ידני";
    } else if (state.authState === "verified") {
      currentStatus = "המייל אומת מאז";
    } else {
      currentStatus = "האישור הידני בוטל מאז";
    }

    events.push({
      email,
      active: state.active === true,
      currentStatus,
      timestamp,
      type: "manual",
      source: "manual-approval",
      approvedBy: normalizeEmail_(
        getFirestoreStringField_(fields, "adminEmail", "")
      )
    });
  });

  return events.sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}

function getContactReportLookup_() {
  const byEmail = {};

  readAndDeduplicateContacts_().forEach(contact => {
    const email = normalizeEmail_(contact && contact.email);
    if (!email || byEmail[email]) return;

    byEmail[email] = {
      name: [
        cleanSheetValue_(contact.title_prefix),
        cleanSheetValue_(contact.first_name_he),
        cleanSheetValue_(contact.last_name_he)
      ].filter(Boolean).join(" ").trim(),
      phone: normalizeIsraeliPhone(contact.phone),
      department: cleanSheetValue_(contact.department)
    };
  });

  return byEmail;
}

function getAccessGrantTypeLabel_(event) {
  if (event.type === "manual") return "אישור ידני של מנהל־על";
  if (event.source === "google-form") return "טופס הצטרפות";
  if (event.source === "self-service-email-update") return "עדכון מייל עצמאי";
  return "אישור אוטומטי";
}

function sendDailyAccessReport() {
  const now = new Date();
  const windowStart = getAccessReportWindowStart_(now);
  const admins = getActiveAdminRecords_();

  if (!admins.length) {
    throw new Error("לא נמצא מנהל פעיל שאליו ניתן לשלוח את הדוח.");
  }

  const events = getAccessGrantEvents_(windowStart, now);
  const properties = PropertiesService.getScriptProperties();

  if (!events.length) {
    properties.setProperty(
      DAILY_ACCESS_REPORT_LAST_SENT_KEY,
      String(now.getTime())
    );
    cleanupExpiredSubmissionRecords_();
    return { sent: false, count: 0 };
  }

  const contactsByEmail = getContactReportLookup_();
  const appUrl = getEmailUpdateSetting_(
    MAIN_APP_URL_KEY,
    DEFAULT_MAIN_APP_URL
  );

  const rows = events.map(event => {
    const contact = contactsByEmail[event.email] || {};
    const name = cleanSheetValue_(contact.name) || "ללא שם תואם";
    const phone = contact.phone
      ? formatIsraeliPhoneForDisplay_(contact.phone)
      : "לא נמצא";
    const department = cleanSheetValue_(contact.department) || "";
    const status = cleanSheetValue_(event.currentStatus) ||
      (event.active ? "פעיל" : "נחסם מאז");
    const approvalDetails = event.approvedBy
      ? "<br><small>אושר על ידי " +
        escapeHtmlForOutput_(event.approvedBy) +
        "</small>"
      : "";

    return '<tr>' +
      '<td>' + escapeHtmlForOutput_(formatAccessReportDateTime_(event.timestamp)) + '</td>' +
      '<td><b>' + escapeHtmlForOutput_(name) + '</b>' +
        (department ? '<br><small>' + escapeHtmlForOutput_(department) + '</small>' : '') +
      '</td>' +
      '<td dir="ltr">' + escapeHtmlForOutput_(phone) + '</td>' +
      '<td dir="ltr">' + escapeHtmlForOutput_(event.email) + '</td>' +
      '<td>' + escapeHtmlForOutput_(getAccessGrantTypeLabel_(event)) + approvalDetails + '</td>' +
      '<td>' + escapeHtmlForOutput_(status) + '</td>' +
      '</tr>';
  }).join("");

  const subjectDate = Utilities.formatDate(
    now,
    "Asia/Jerusalem",
    "dd/MM/yyyy"
  );
  const subject = "ספר אנשי קשר — הרשאות חדשות " + subjectDate;
  const htmlBody =
    '<div dir="rtl" style="font-family:Arial,sans-serif;color:#1f2937">' +
    '<h2 style="color:#065f46">הרשאות שניתנו מאז הדוח הקודם</h2>' +
    '<p>נרשמו <b>' + events.length + '</b> פעולות אישור. האנשים האלה מוצגים בראש מסך <b>ניהול ← הרשאות</b>, וניתן לחסום שם גישה במידת הצורך.</p>' +
    '<table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;border-color:#d9efe4;font-size:13px">' +
    '<thead style="background:#ecfdf5"><tr><th>מועד</th><th>שם</th><th>טלפון</th><th>מייל</th><th>סוג אישור</th><th>מצב נוכחי</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>' +
    '<p style="margin-top:18px"><a href="' + escapeHtmlForOutput_(appUrl) + '" style="display:inline-block;padding:11px 16px;border-radius:10px;background:#059669;color:#fff;text-decoration:none;font-weight:bold">פתיחת ספר אנשי הקשר</a></p>' +
    '<p style="color:#6b7280;font-size:12px">תקופת הדוח: ' +
      escapeHtmlForOutput_(formatAccessReportDateTime_(windowStart)) +
      '–' + escapeHtmlForOutput_(formatAccessReportDateTime_(now)) +
      '</p></div>';
  const plainBody = events.map(event => {
    const contact = contactsByEmail[event.email] || {};
    return [
      formatAccessReportDateTime_(event.timestamp),
      contact.name || "ללא שם תואם",
      contact.phone ? formatIsraeliPhoneForDisplay_(contact.phone) : "ללא טלפון",
      event.email,
      getAccessGrantTypeLabel_(event),
      cleanSheetValue_(event.currentStatus) ||
        (event.active ? "פעיל" : "נחסם מאז")
    ].join(" | ");
  }).join("\n");

  MailApp.sendEmail({
    to: admins.map(admin => admin.email).join(","),
    subject,
    body:
      "הרשאות שניתנו מאז הדוח הקודם:\n\n" +
      plainBody +
      "\n\nלניהול הרשאות: " + appUrl,
    htmlBody,
    name: "ספר אנשי קשר"
  });

  properties.setProperty(
    DAILY_ACCESS_REPORT_LAST_SENT_KEY,
    String(now.getTime())
  );
  cleanupExpiredSubmissionRecords_();

  return {
    sent: true,
    count: events.length,
    recipients: admins.map(admin => admin.email)
  };
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
  const hasDailyAccessReportTrigger = triggers.some(trigger =>
    trigger.getHandlerFunction() === DAILY_ACCESS_REPORT_HANDLER
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

  if (!hasDailyAccessReportTrigger) {
    ScriptApp.newTrigger(DAILY_ACCESS_REPORT_HANDLER)
      .timeBased()
      .atHour(DAILY_ACCESS_REPORT_HOUR)
      .everyDays(1)
      .inTimezone("Asia/Jerusalem")
      .create();
    Logger.log("נוצר טריגר יומי לדוח הרשאות חדשות.");
  } else {
    Logger.log("כבר קיים טריגר יומי לדוח הרשאות חדשות.");
  }
  try {
    configureRegistrationFormConfirmation();
  } catch (error) {
    console.error("עדכון הודעת הסיום של טופס ההצטרפות נכשל:", error);
  }
}

/**
 * מעדכן את הודעת הסיום של Google Form כך שתכלול קישור ברור
 * לחזרה לאפליקציה ולהמשך יצירת החשבון.
 */
function configureRegistrationFormConfirmation() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const formUrl = spreadsheet.getFormUrl();

  if (!formUrl) {
    throw new Error("הגיליון אינו מקושר ל-Google Form.");
  }

  const form = FormApp.openByUrl(formUrl);
  form.setConfirmationMessage(REGISTRATION_FORM_CONFIRMATION_MESSAGE);

  Logger.log("הודעת הסיום של טופס ההצטרפות עודכנה.");
  return {
    updated: true,
    formUrl,
    appUrl: DEFAULT_MAIN_APP_URL
  };
}

/**
 * בדיקה ידנית של החיבור ל-Firebase ללא יצירת הרשאה ניסיונית.
 */
function testFirebaseConnection() {
  const admins = getActiveAdminRecords_();
  Logger.log(
    "בדיקת החיבור ל-Firebase הצליחה. מנהלים פעילים: " +
      admins.length
  );
  return { ok: true, activeAdmins: admins.length };
}

