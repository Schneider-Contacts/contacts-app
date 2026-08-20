

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBaZa5_RmMqhRH6MazTw5or9BqMZGC1RqM",
  authDomain: "contacts-sch.firebaseapp.com",
  projectId: "contacts-sch",
  storageBucket: "contacts-sch.firebasestorage.app",
  messagingSenderId: "1075199399228",
  appId: "1:1075199399228:web:1791df20931f66a483fa39"
};

const FIREBASE_SDK_VERSION = "12.16.0";
const PASSWORD_AUTH_RETURN_URL =
  "https://schneider-contacts.github.io/contacts-app/";
const AUTH_ROUTER_URL =
  "https://script.google.com/macros/s/AKfycbwqwWDEUgxLRWIOEGX3TaK0tmdacrl-CG_kkdK01dlfAeGcDq3fXdHIjtSjQ2NwZvBK/exec";
const AUTH_ROUTER_CLIENT = "login-ux-v2";
const REGISTRATION_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfY6dWQD_OH5oXS1vbyRJRU44S1HSmAb6BLrA-a7SljvoaxzQ/viewform?usp=header";
const AUTH_ROUTE_TIMEOUT_MS = 20 * 1000;
const PASSWORD_HELP_TIMEOUT_MS = 30000;
const AUTH_ROUTE_CACHE_MS = 15 * 1000;
const AUTH_ROUTE_CACHE_PREFIX = "contacts_auth_route_v2_";
const SUPPORT_CONTACT_CACHE_KEY = "contacts_support_contact_v1";
const SUPPORT_CONTACT_CACHE_MS = 30 * 60 * 1000;
const PENDING_AUTH_EMAIL_STORAGE_KEY = "contacts_pending_auth_email_v1";
const IMPORT_STORAGE_PREFIX = "contacts_import_payload_";
const CONTACT_DIRECTORY_COLLECTION_NAME = "contactDirectory";
const ALLOWED_PHONES_COLLECTION_NAME = "allowedPhones";
const CONTACT_MANAGER_EMAIL = "schneidercontacts@gmail.com";
const CONTACT_MANAGER_DISPLAY_NAME = "מנהל אנשי הקשר";
const CONTACT_DIRECTORY_META_ID = "meta";
const CONTACT_DIRECTORY_PAGE_PREFIX = "page_";
const CONTACT_DIRECTORY_CACHE_KEY = "contacts_directory_cache_v5";
const CONTACT_DIRECTORY_TARGET_BYTES = 220000;
const MONTHLY_INTERNS_DOCUMENT_PREFIX = "interns_";
const MONTHLY_INTERNS_TIME_ZONE = "Asia/Jerusalem";
const MONTHLY_INTERNS_COLLECTION_NAME = "monthlyInterns";
const MONTHLY_INTERNS_ACTIVE_DOCUMENT_ID = "active";
const MONTHLY_INTERNS_PREVIOUS_DOCUMENT_ID = "previous";
const MONTHLY_INTERNS_SCHEMA_VERSION = 2;
const MONTHLY_INTERNS_MAX_RECORDS = 500;
const XLSX_VENDOR_URL = "vendor/xlsx.full.min.js?v=0.20.3";

const RECENT_CONTACTS_STORAGE_KEY = "contacts_last_recent_import_at_v2";
const RECENT_CONTACTS_IMPORTED_PHONES_KEY = "contacts_recent_imported_phones_v1";
const RECENT_CONTACTS_DEFAULT_DAYS = 30;
const USAGE_DAILY_COLLECTION_NAME = "usageDaily";
const DAILY_ACTIVE_USERS_COLLECTION_NAME = "dailyActiveUsers";
const DAILY_ACTIVE_USERS_STORAGE_PREFIX = "contacts_daily_active_user_v1_";
const DAILY_CONTACT_USERS_COLLECTION_NAME = "dailyContactUsers";
const DAILY_CONTACT_USERS_STORAGE_PREFIX = "contacts_daily_contact_user_v1_";
const PASSWORD_RESET_REQUESTS_COLLECTION_NAME = "passwordResetRequests";
const USAGE_CONTACT_FLUSH_DELAY_MS = 3 * 60 * 1000;
const USAGE_PENDING_STORAGE_KEY = "contacts_pending_usage_v3";
const LAST_LOGIN_EMAIL_STORAGE_KEY = "contacts_last_login_email_v1";
const AUTH_STATUS_TELEMETRY_INTERVAL_MS = 12 * 60 * 60 * 1000;
const AUTH_STATUS_TELEMETRY_PREFIX = "contacts_auth_status_write_v1_";
const USER_SUBMISSION_COOLDOWN_MS = 2 * 60 * 1000;
const PENDING_PASSWORD_RECOVERY_STORAGE_KEY =
  "contacts_pending_password_recovery_v1";
const PASSWORD_RECOVERY_STATUS_INTERVAL_MS = 5000;
const PASSWORD_RECOVERY_MIN_LENGTH = 8;

let firebaseApi = null;
let firebaseApp = null;
let auth = null;
let db = null;

let contacts = [];
let isLoadingContacts = false;
let hasLoadError = false;
let selectedContactIds = new Set();
let currentDisplayedContacts = [];
let selectionMode = false;
let activeQuickFilter = "all";
let directoryBrowseActivated = false;
let activeContactDetailId = null;
let selectedRecentContactPhones = new Set();
let monthlyInternsState = {
  status: "idle",
  descriptor: null,
  entries: []
};
let monthlyInternsLoadPromise = null;
let monthlyInternsLoadToken = 0;
let monthlyInternsHomeScrollY = 0;

let authMode = "login";
let authPurpose = "login";
let authStage = "email";
let forceEmailEntry = false;
let authActionInProgress = false;
let authRouteIsAdmin = false;
let pendingManualApprovalIntentEmail = "";
let pendingManualApprovalIntentHandled = false;
let verificationSuccessUser = null;
let lastUnverifiedEmail = "";
let lastUnknownEmail = "";
let managerPasswordResetEmail = "";
let authRouteRequestSequence = 0;
let pendingAuthRedirectTimer = null;
let managerSupportContactPromise = null;
let activeManagerSupportName = "";
let pendingEmailAuthRouteEmail = "";
let pendingEmailAuthRoutePromise = null;
let authEmailFlowToken = 0;
let authAccountSetupEmail = "";
let provisionalRegistrationPhone = "";
let pendingRegistrationEmail = "";
let pendingRegistrationPhone = "";
let authAccountSetupFallback = false;
let authRouteUnavailableEmail = "";
let authReturningUser = false;

let currentUserIsAdmin = false;
let currentUserIsSuperAdmin = false;
let currentUserHasAppAccess = false;
let verificationAccessListenerUnsubscribe = null;
let verificationAccessTransitionInProgress = false;
let verificationReturnCheckInProgress = false;
let currentAdminRole = "";
let currentAdminEmail = "";
let permissionListenerUnsubscribe = null;
let phonePermissionListenerUnsubscribe = null;
let permissionExpiryTimer = null;
let passwordRecoveryStatusTimer = null;
let activePasswordRecovery = null;
let adminActiveTab = "attention";
let adminActiveFilter = "all";
let adminContacts = [];
let adminRemovedContacts = [];
let adminAllowedUsers = [];
let adminAllowedPhones = [];
let adminManagers = [];
let adminActivity = [];
let adminDailyActiveUsers = [];
let adminPasswordResetRequests = [];
let adminReports = [];
let adminContactAddRequests = [];
let adminVerificationRequests = [];
let adminPendingSummary = {
  verificationRequests: 0,
  passwordResetRequests: 0,
  contactRequests: 0,
  contactReports: 0,
  loaded: false
};
let adminPendingSummaryLoadedAt = 0;
let pendingUsageByDate = {};
let usageFlushTimer = null;
let usageFlushScheduledAt = 0;
let usageFlushInProgress = false;
let currentUserPermissionData = null;
let myProfileContact = null;
let adminEditingContact = null;
let activeReportContact = null;
let contactAddModalMode = "user";
let activeContactAddRequestId = "";
let contactAddSource = "manual";
let activeContactUpdate = null;
let contactAddDuplicateConfirmed = false;
let userRequestState = {
  loadedAt: 0,
  loading: null,
  contactRequests: [],
  reports: []
};
let adminDataLoading = false;
const ADMIN_LIST_PAGE_SIZE = 25;
const ADMIN_PENDING_SUMMARY_CACHE_MS = 2 * 60 * 1000;
let adminVisibleItemCount = ADMIN_LIST_PAGE_SIZE;
let adminLoadedSections = new Set();
let adminSectionLoadPromises = new Map();
let adminDataPartLoadPromises = new Map();
let adminReasonResolve = null;
let adminConfirmationResolve = null;
let adminActiveFocus = null;
let adminMonthlyInternsActive = null;
let adminMonthlyInternsPrevious = null;
let monthlyInternsImportState = {
  phase: "idle",
  fileName: "",
  analysis: null,
  parsed: null,
  monthValue: "",
  error: ""
};
let xlsxLibraryLoadPromise = null;


function getIsraelDateKey_(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = {};
  parts.forEach(part => {
    if (part.type !== "literal") values[part.type] = part.value;
  });

  return `${values.year}-${values.month}-${values.day}`;
}

function getEndOfIsraelDayDate_(date = new Date()) {
  const dateKey = getIsraelDateKey_(date);
  const getOffset = value => {
    const offsetPart = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      timeZoneName: "longOffset"
    }).formatToParts(value).find(part => part.type === "timeZoneName");
    return String(offsetPart && offsetPart.value || "GMT+02:00")
      .replace("GMT", "");
  };
  let offset = getOffset(date);
  let endOfDay = new Date(`${dateKey}T23:59:59.999${offset}`);
  const endOffset = getOffset(endOfDay);
  if (endOffset !== offset) {
    offset = endOffset;
    endOfDay = new Date(`${dateKey}T23:59:59.999${offset}`);
  }
  return endOfDay;
}

function getCooldownSubmissionDocumentId_(type, user) {
  const uid = String(user && user.uid || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!uid) throw new Error("לא נמצא מזהה משתמש תקין.");

  const bucket = Math.floor(Date.now() / USER_SUBMISSION_COOLDOWN_MS)
    .toString(36);
  return `${type}_${uid}_${bucket}`;
}

function resetUserRequestState_() {
  userRequestState = {
    loadedAt: 0,
    loading: null,
    contactRequests: [],
    reports: []
  };
}

function getUserRequestStatusPresentation_(status, kind = "request") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return { label: "אושר", tone: "approved" };
  if (normalized === "rejected") return { label: "נדחה", tone: "rejected" };
  if (normalized === "resolved") return { label: "טופל", tone: "resolved" };
  if (normalized === "open" && kind === "report") {
    return { label: "ממתין לטיפול", tone: "pending" };
  }
  return { label: "ממתין לאישור", tone: "pending" };
}

async function loadUserRequestStatuses_(options = {}) {
  const user = auth && auth.currentUser;
  const reporterEmail = normalizeEmail(user && user.email || "");
  if (!user || !reporterEmail || !firebaseApi || !db) return userRequestState;

  const force = options.force === true;
  if (!force && userRequestState.loadedAt && Date.now() - userRequestState.loadedAt < 60000) {
    return userRequestState;
  }
  if (userRequestState.loading) return userRequestState.loading;

  const loadPromise = Promise.all([
    firebaseApi.getDocs(firebaseApi.query(
      firebaseApi.collection(db, "contactAddRequests"),
      firebaseApi.where("reporterEmail", "==", reporterEmail)
    )),
    firebaseApi.getDocs(firebaseApi.query(
      firebaseApi.collection(db, "contactReports"),
      firebaseApi.where("reporterEmail", "==", reporterEmail)
    ))
  ]).then(([contactSnapshot, reportSnapshot]) => {
    userRequestState.contactRequests = contactSnapshot.docs.map(document => ({
      docId: document.id,
      ...(document.data() || {})
    }));
    userRequestState.reports = reportSnapshot.docs.map(document => ({
      docId: document.id,
      ...(document.data() || {})
    }));
    userRequestState.loadedAt = Date.now();
    return userRequestState;
  }).catch(error => {
    console.warn("Could not load submitted-request statuses", error);
    return userRequestState;
  }).finally(() => {
    userRequestState.loading = null;
  });

  userRequestState.loading = loadPromise;
  return loadPromise;
}

function findLatestUserContactRequest_(contact, statuses = null) {
  if (!contact) return null;
  const contactId = String(contact.docId || "");
  const phone = normalizePhone(contact.phone || "");
  const allowedStatuses = Array.isArray(statuses) ? new Set(statuses) : null;
  return userRequestState.contactRequests
    .filter(request => {
      if (allowedStatuses && !allowedStatuses.has(String(request.status || "pending"))) return false;
      return request.requestType === "contact_update" && (
        (contactId && String(request.originalContactId || "") === contactId) ||
        (phone && normalizePhone(request.originalPhone || "") === phone)
      );
    })
    .sort((left, right) => getTimestampMillis_(right.updatedAt || right.createdAt) - getTimestampMillis_(left.updatedAt || left.createdAt))[0] || null;
}

function findEquivalentPendingContactRequest_(values, context = {}) {
  const requestType = context.requestType || "contact_add";
  const originalContactId = String(context.originalContactId || "");
  const phone = normalizePhone(values && values.phone || "");
  const email = normalizeEmail(values && values.email || "");
  return userRequestState.contactRequests.find(request => {
    if (String(request.status || "pending") !== "pending") return false;
    if (String(request.requestType || "contact_add") !== requestType) return false;
    if (requestType === "contact_update") {
      return Boolean(originalContactId && String(request.originalContactId || "") === originalContactId);
    }
    return Boolean(
      (phone && normalizePhone(request.phone || "") === phone) ||
      (email && normalizeEmail(request.email || "") === email)
    );
  }) || null;
}

function findEquivalentOpenReport_(subject) {
  const isIntern = subject && subject.reportSubject === "intern";
  return userRequestState.reports.find(report => {
    if (String(report.status || "open") !== "open") return false;
    if (subject.issueType && String(report.issueType || "") !== String(subject.issueType)) return false;
    if (isIntern) {
      return report.subjectType === "intern" &&
        String(report.internId || "") === String(subject.id || "") &&
        (!report.internVersion || String(report.internVersion) === String(monthlyInternsState.version || ""));
    }
    return report.subjectType !== "intern" && (
      (subject.docId && String(report.contactDocId || "") === String(subject.docId)) ||
      normalizePhone(report.contactPhone || "") === normalizePhone(subject.phone || "")
    );
  }) || null;
}

function formatUsageDate_(dateKey) {
  const parsed = new Date(`${dateKey}T12:00:00+03:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;

  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  }).format(parsed);
}

function loadPendingUsage_() {
  try {
    // ניקוי מדד החיפוש הישן; החל מ-v15 נשמר רק שימוש ממשי באנשי קשר.
    localStorage.removeItem("contacts_pending_usage_v2");
    const raw = localStorage.getItem(USAGE_PENDING_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    pendingUsageByDate = parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    pendingUsageByDate = {};
    console.warn("Could not load pending usage metrics", error);
  }
}

function persistPendingUsage_() {
  try {
    const clean = {};
    Object.entries(pendingUsageByDate).forEach(([dateKey, counts]) => {
      const logins = Math.max(0, Math.floor(Number(counts && counts.logins) || 0));
      const contactUses = Math.max(
        0,
        Math.floor(Number(counts && counts.contactUses) || 0)
      );

      if (logins || contactUses) {
        clean[dateKey] = { logins, contactUses };
      }
    });

    pendingUsageByDate = clean;
    localStorage.setItem(USAGE_PENDING_STORAGE_KEY, JSON.stringify(clean));
  } catch (error) {
    console.warn("Could not persist pending usage metrics", error);
  }
}

function getPendingContactUseCount_() {
  return Object.values(pendingUsageByDate).reduce(
    (sum, counts) =>
      sum + Math.max(0, Number(counts && counts.contactUses) || 0),
    0
  );
}

function scheduleUsageFlush_(delayMs = USAGE_CONTACT_FLUSH_DELAY_MS) {
  const safeDelay = Math.max(0, Number(delayMs) || 0);
  const requestedAt = Date.now() + safeDelay;

  if (
    usageFlushTimer &&
    usageFlushScheduledAt &&
    usageFlushScheduledAt <= requestedAt
  ) {
    return;
  }

  if (usageFlushTimer) clearTimeout(usageFlushTimer);
  usageFlushScheduledAt = requestedAt;
  usageFlushTimer = setTimeout(() => {
    usageFlushTimer = null;
    usageFlushScheduledAt = 0;
    flushUsageMetrics_().catch(error => {
      console.error("Usage metrics flush failed", error);
    });
  }, safeDelay);
}

async function writeUsageIncrement_(
  dateKey,
  loginDelta,
  contactUseDelta
) {
  await firebaseApi.setDoc(
    firebaseApi.doc(db, USAGE_DAILY_COLLECTION_NAME, dateKey),
    {
      date: dateKey,
      loginCount: firebaseApi.increment(loginDelta),
      searchCount: firebaseApi.increment(0),
      contactUseCount: firebaseApi.increment(contactUseDelta),
      updatedAt: firebaseApi.serverTimestamp()
    },
    { merge: true }
  );
}

async function flushUsageMetrics_() {
  if (usageFlushInProgress) return;
  if (!db || !firebaseApi || !auth || !auth.currentUser || !currentUserHasAppAccess) {
    return;
  }

  const snapshot = Object.fromEntries(
    Object.entries(pendingUsageByDate)
      .map(([dateKey, counts]) => [
        dateKey,
        {
          logins: Math.max(0, Math.floor(Number(counts && counts.logins) || 0)),
          contactUses: Math.max(
            0,
            Math.floor(Number(counts && counts.contactUses) || 0)
          )
        }
      ])
      .filter(([, counts]) => counts.logins || counts.contactUses)
  );

  if (!Object.keys(snapshot).length) return;
  usageFlushInProgress = true;

  try {
    for (const [dateKey, counts] of Object.entries(snapshot)) {
      let remainingLogins = counts.logins;
      let remainingContactUses = counts.contactUses;

      while (remainingLogins > 0 || remainingContactUses > 0) {
        const loginDelta = remainingLogins > 0 ? 1 : 0;
        const contactUseDelta = Math.min(50, remainingContactUses);

        await writeUsageIncrement_(
          dateKey,
          loginDelta,
          contactUseDelta
        );

        remainingLogins -= loginDelta;
        remainingContactUses -= contactUseDelta;

        const current = pendingUsageByDate[dateKey] || {
          logins: 0,
          contactUses: 0
        };
        current.logins = Math.max(
          0,
          (Number(current.logins) || 0) - loginDelta
        );
        current.contactUses = Math.max(
          0,
          (Number(current.contactUses) || 0) - contactUseDelta
        );
        pendingUsageByDate[dateKey] = current;
        persistPendingUsage_();
      }
    }
  } catch (error) {
    persistPendingUsage_();
    scheduleUsageFlush_(USAGE_CONTACT_FLUSH_DELAY_MS);
    throw error;
  } finally {
    usageFlushInProgress = false;
  }
}

function recordContactUse_(contactId, action = "open") {
  if (!auth || !auth.currentUser || !currentUserHasAppAccess) return;

  const trackedActions = ["phone", "call", "whatsapp", "email", "download"];
  if (!trackedActions.includes(String(action || ""))) return;

  recordDailyContactUser_(auth.currentUser);
}

function recordDailyContactUser_(user) {
  const uid = String(user && user.uid || "");
  if (!uid || !db || !firebaseApi || !currentUserHasAppAccess) return;

  const dateKey = getIsraelDateKey_();
  const storageKey = `${DAILY_CONTACT_USERS_STORAGE_PREFIX}${dateKey}_${uid}`;

  try {
    if (localStorage.getItem(storageKey) === "1") return;
  } catch (error) {
    // localStorage is only an optimization.
  }

  setTimeout(async () => {
    try {
      await firebaseApi.setDoc(
        firebaseApi.doc(
          db,
          DAILY_CONTACT_USERS_COLLECTION_NAME,
          dateKey,
          "users",
          uid
        ),
        { date: dateKey },
        { merge: true }
      );

      try {
        localStorage.setItem(storageKey, "1");
      } catch (error) {
        // localStorage is only an optimization.
      }
    } catch (error) {
      console.warn("Daily contact-user metric write failed", error);
    }
  }, 250);
}

function recordDailyActiveUser_(user) {
  const uid = String(user && user.uid || "");
  if (!uid || !db || !firebaseApi || !currentUserHasAppAccess) return;

  const dateKey = getIsraelDateKey_();
  const storageKey = `${DAILY_ACTIVE_USERS_STORAGE_PREFIX}${dateKey}_${uid}`;

  try {
    if (localStorage.getItem(storageKey) === "1") return;
  } catch (error) {
    console.warn("Could not read daily active-user marker", error);
  }

  // הרישום אינו חלק מתהליך הכניסה ואינו מעכב את הצגת האפליקציה.
  setTimeout(async () => {
    try {
      await firebaseApi.setDoc(
        firebaseApi.doc(
          db,
          DAILY_ACTIVE_USERS_COLLECTION_NAME,
          dateKey,
          "users",
          uid
        ),
        { date: dateKey },
        { merge: true }
      );

      try {
        localStorage.setItem(storageKey, "1");
      } catch (error) {
        console.warn("Could not store daily active-user marker", error);
      }
    } catch (error) {
      // מדדי שימוש לעולם אינם מונעים מהמשתמש לעבוד באפליקציה.
      console.warn("Daily active-user metric write failed", error);
    }
  }, 1500);
}

function getRecentIsraelDateKeys_(days = 14) {
  const safeDays = Math.max(1, Math.min(30, Math.floor(Number(days) || 14)));
  const todayKey = getIsraelDateKey_();
  const [year, month, day] = todayKey.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const keys = [];

  for (let index = 0; index < safeDays; index += 1) {
    keys.push(getIsraelDateKey_(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return keys;
}

async function loadDailyActiveUserCounts_(dateKeys) {
  return await Promise.all(dateKeys.map(async dateKey => {
    try {
      const usersCollection = firebaseApi.collection(
        db,
        DAILY_ACTIVE_USERS_COLLECTION_NAME,
        dateKey,
        "users"
      );
      const snapshot = await firebaseApi.getCountFromServer(usersCollection);
      return {
        date: dateKey,
        activeUserCount: Math.max(0, Number(snapshot.data().count) || 0)
      };
    } catch (error) {
      console.error(`Daily active-user count failed for ${dateKey}`, error);
      return { date: dateKey, activeUserCount: 0 };
    }
  }));
}

async function loadDailyContactUserCounts_(dateKeys) {
  return await Promise.all(dateKeys.map(async dateKey => {
    try {
      const usersCollection = firebaseApi.collection(
        db,
        DAILY_CONTACT_USERS_COLLECTION_NAME,
        dateKey,
        "users"
      );
      const snapshot = await firebaseApi.getCountFromServer(usersCollection);
      return {
        date: dateKey,
        contactUserCount: Math.max(0, Number(snapshot.data().count) || 0)
      };
    } catch (error) {
      console.error(`Daily contact-user count failed for ${dateKey}`, error);
      return { date: dateKey, contactUserCount: 0 };
    }
  }));
}

function setStatus(elementId, message = "", type = "") {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.textContent = message;
  el.className = "statusMessage";

  if (message) {
    el.classList.add("visible");
    if (type) el.classList.add(type);
  }
}

function setLoginButtonDisabled(disabled) {
  const btn = document.getElementById("loginButton");
  if (btn) btn.disabled = disabled;
}

function setLoginStatus(message = "", type = "") {
  setStatus("loginStatus", message, type);
}

function setListStatus(message = "", type = "") {
  setStatus("statusMessage", message, type);
}

function normalizePhone(p) {
  if (!p) return "";
  let num = p.replace(/\D/g, "");
  if (num.startsWith("0")) num = "972" + num.slice(1);
  if (!num.startsWith("972")) num = "972" + num;
  return "+" + num;
}

function formatIsraeliPhoneInput_(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("972")) {
    digits = "0" + digits.slice(3);
  }
  digits = digits.slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return digits.slice(0, 3) + " " + digits.slice(3);
  }
  return (
    digits.slice(0, 3) + " " +
    digits.slice(3, 6) + " " +
    digits.slice(6)
  );
}

function initAuthInputEnhancements_() {
  const phoneInput = document.getElementById("phoneInput");
  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      const formatted = formatIsraeliPhoneInput_(phoneInput.value);
      if (phoneInput.value !== formatted) phoneInput.value = formatted;
    });
  }

  [
    "emailInput",
    "phoneInput",
    "passwordInput",
    "confirmPasswordInput",
    "registrationFirstName",
    "registrationLastName",
    "registrationRole",
    "registrationDepartment"
  ].forEach(inputId => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      if (authActionInProgress) return;

      const activeButtonId = authStage === "email"
        ? "emailContinueBtn"
        : ["phone", "password_recovery_claim"].includes(authStage)
          ? "phoneContinueBtn"
          : authStage === "registration_details"
            ? "registrationDetailsSubmitBtn"
            : "loginButton";
      const activeButton = document.getElementById(activeButtonId);
      if (activeButton && activeButton.disabled) return;
      handlePrimaryAuthAction();
    });
  });
}

function formatPhoneForDisplay(phone) {
  let normalized = normalizePhone(phone);
  let digits = normalized.replace(/\D/g, "");

  if (digits.startsWith("972")) {
    digits = "0" + digits.slice(3);
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    return digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
  }

  if (digits.length === 9 && digits.startsWith("0")) {
    return digits.slice(0, 2) + "-" + digits.slice(2, 5) + "-" + digits.slice(5);
  }

  return normalized;
}

function getPhoneSearchValue(phone) {
  return formatPhoneForDisplay(phone).replace(/-/g, "").toLowerCase();
}

function isNoWhatsappPhone(phone) {
  const displayPhone = formatPhoneForDisplay(phone);
  return displayPhone.startsWith("03-");
}

function buildDisplayName(contact) {
  return [contact.title, contact.first, contact.last].filter(Boolean).join(" ").trim();
}

function getContactInfoScore(contact) {
  const fields = [
    contact.first,
    contact.last,
    contact.firstEn,
    contact.lastEn,
    contact.title,
    contact.role,
    contact.dept,
    contact.email
  ];

  const filledFields = fields.filter(v => (v || "").toString().trim() !== "").length;
  const textLength = fields.reduce((sum, v) => sum + ((v || "").toString().trim().length), 0);

  return (filledFields * 1000) + textLength;
}

function isEmptyValue(value) {
  return (value || "").toString().trim() === "";
}

function mergeMissingFields(base, extra) {
  const merged = { ...base };
  const fieldsToComplete = [
    "first", "last", "firstEn", "lastEn", "title", "role", "dept",
    "hospital", "email", "source", "status", "createdAt", "updatedAt", "docId"
  ];

  fieldsToComplete.forEach(field => {
    if (isEmptyValue(merged[field]) && !isEmptyValue(extra[field])) {
      merged[field] = extra[field];
    }
  });

  merged.name = buildDisplayName(merged);
  return merged;
}

function deduplicateContacts(list) {
  const groupedByPhone = new Map();

  list.forEach(contact => {
    if (!groupedByPhone.has(contact.phone)) {
      groupedByPhone.set(contact.phone, []);
    }
    groupedByPhone.get(contact.phone).push(contact);
  });

  const mergedContacts = [];

  groupedByPhone.forEach(group => {
    const sortedGroup = [...group].sort((a, b) => getContactInfoScore(b) - getContactInfoScore(a));
    let merged = { ...sortedGroup[0] };

    for (let i = 1; i < sortedGroup.length; i++) {
      merged = mergeMissingFields(merged, sortedGroup[i]);
    }

    merged.name = buildDisplayName(merged);
    mergedContacts.push(merged);
  });

  return mergedContacts;
}

function normalizeSearchText(value) {
  return String(value || "")
    .replace(/\u200E|\u200F/g, "")
    .replace(/[״"'׳]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildContactSearchIndex_(contact) {
  const first = normalizeSearchText(contact && contact.first);
  const last = normalizeSearchText(contact && contact.last);
  const firstEn = normalizeSearchText(contact && contact.firstEn);
  const lastEn = normalizeSearchText(contact && contact.lastEn);
  const title = normalizeSearchText(contact && contact.title);
  const role = normalizeSearchText(contact && contact.role);
  const department = normalizeSearchText(contact && contact.dept);
  const hospital = normalizeSearchText(contact && contact.hospital);
  const email = normalizeSearchText(contact && contact.email);
  const fullHe = [first, last].filter(Boolean).join(" ");
  const fullEn = [firstEn, lastEn].filter(Boolean).join(" ");
  const titledFullHe = [title, fullHe].filter(Boolean).join(" ");
  const phoneInternational = normalizePhone(contact && contact.phone)
    .replace(/\D/g, "");
  const phoneLocal = getPhoneSearchValue(contact && contact.phone)
    .replace(/\D/g, "");

  return {
    first,
    last,
    firstEn,
    lastEn,
    title,
    role,
    department,
    hospital,
    email,
    fullHe,
    fullEn,
    titledFullHe,
    nameParts: [first, last, firstEn, lastEn].filter(Boolean),
    roleParts: role.split(" ").filter(Boolean),
    departmentParts: department.split(" ").filter(Boolean),
    metadataParts: [title, hospital, email].filter(Boolean),
    phoneInternational,
    phoneLocal
  };
}

function getContactSearchIndex_(contact) {
  return contact && contact._search
    ? contact._search
    : buildContactSearchIndex_(contact || {});
}

function getSearchTokenPriority_(index, token, tokenDigits = "") {
  if (!token && !tokenDigits) return null;

  if (token && index.nameParts.some(value => value === token)) return 1;
  if (token && index.nameParts.some(value => value.startsWith(token))) return 2;
  if (
    token &&
    [index.fullHe, index.fullEn].some(value => value && value.includes(token))
  ) return 3;
  if (token && index.role === token) return 4;
  if (token && index.roleParts.some(value => value.startsWith(token))) return 5;
  if (token && index.role.includes(token)) return 6;
  if (token && index.department === token) return 7;
  if (
    token &&
    index.departmentParts.some(value => value.startsWith(token))
  ) return 8;
  if (token && index.department.includes(token)) return 9;
  if (
    token &&
    index.metadataParts.some(value => value.includes(token))
  ) return 10;
  if (
    tokenDigits &&
    (
      index.phoneLocal.includes(tokenDigits) ||
      index.phoneInternational.includes(tokenDigits)
    )
  ) return 11;
  return null;
}

function getSearchPriority(contact, q, qNoHyphen) {
  const index = getContactSearchIndex_(contact);
  const normalizedQuery = normalizeSearchText(q);
  const queryDigits = String(qNoHyphen || "").replace(/\D/g, "");
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);

  if (!normalizedQuery && !queryDigits) return null;
  if (
    normalizedQuery &&
    [index.fullHe, index.fullEn, index.titledFullHe]
      .some(value => value === normalizedQuery)
  ) return 1;
  if (
    normalizedQuery &&
    index.nameParts.some(value => value === normalizedQuery)
  ) return 2;
  if (
    normalizedQuery &&
    [index.fullHe, index.fullEn].some(value =>
      value && value.startsWith(normalizedQuery)
    )
  ) return 3;
  if (
    normalizedQuery &&
    index.nameParts.some(value => value.startsWith(normalizedQuery))
  ) return 4;
  if (
    queryTokens.length > 1 &&
    queryTokens.every(token =>
      index.nameParts.some(value => value.startsWith(token))
    )
  ) return 5;
  if (
    normalizedQuery &&
    [index.fullHe, index.fullEn].some(value =>
      value && value.includes(normalizedQuery)
    )
  ) return 6;
  if (normalizedQuery && index.role === normalizedQuery) return 7;
  if (normalizedQuery && index.role.startsWith(normalizedQuery)) return 8;
  if (normalizedQuery && index.department === normalizedQuery) return 9;
  if (
    normalizedQuery &&
    index.department.startsWith(normalizedQuery)
  ) return 10;
  if (
    normalizedQuery &&
    (index.role.includes(normalizedQuery) || index.department.includes(normalizedQuery))
  ) return 11;
  if (
    queryDigits &&
    (index.phoneLocal === queryDigits || index.phoneInternational === queryDigits)
  ) return 12;
  if (
    queryDigits &&
    (
      index.phoneLocal.startsWith(queryDigits) ||
      index.phoneInternational.startsWith(queryDigits)
    )
  ) return 13;

  if (queryTokens.length) {
    const tokenPriorities = queryTokens.map(token =>
      getSearchTokenPriority_(
        index,
        token,
        token.replace(/\D/g, "")
      )
    );
    if (tokenPriorities.every(priority => priority !== null)) {
      return 20 + tokenPriorities.reduce((sum, priority) => sum + priority, 0) / 100;
    }
  }

  if (
    queryDigits &&
    (
      index.phoneLocal.includes(queryDigits) ||
      index.phoneInternational.includes(queryDigits)
    )
  ) return 40;
  if (
    normalizedQuery &&
    index.metadataParts.some(value => value.includes(normalizedQuery))
  ) return 50;
  return null;
}

function compareContactsByName(a, b) {
  const lastComparison = (a.last || "").localeCompare(b.last || "", "he", { sensitivity: "base" });
  if (lastComparison !== 0) return lastComparison;
  return (a.first || "").localeCompare(b.first || "", "he", { sensitivity: "base" });
}

function isSearchActive() {
  const input = document.getElementById("searchInput");
  return !!input && normalizeSearchText(input.value).length > 0;
}

function getLocalPhoneDigits(phone) {
  const displayPhone = formatPhoneForDisplay(phone);
  return displayPhone.replace(/\D/g, "");
}

function isMobilePhone(phone) {
  return /^05\d{8}$/.test(getLocalPhoneDigits(phone));
}

function isInstituteLandline(phone) {
  return /^03\d{7}$/.test(getLocalPhoneDigits(phone));
}

function getRecentContactsCutoff() {
  const savedValue = Number(localStorage.getItem(RECENT_CONTACTS_STORAGE_KEY) || 0);
  if (Number.isFinite(savedValue) && savedValue > 0) return savedValue;
  return Date.now() - (RECENT_CONTACTS_DEFAULT_DAYS * 24 * 60 * 60 * 1000);
}

function getImportedRecentContactPhones_() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_CONTACTS_IMPORTED_PHONES_KEY) || "[]");
    return new Set(
      (Array.isArray(parsed) ? parsed : [])
        .map(normalizePhone)
        .filter(Boolean)
    );
  } catch (error) {
    console.warn("Could not load imported recent-contact phones", error);
    return new Set();
  }
}

function markRecentContactPhonesImported_(phones) {
  const importedPhones = getImportedRecentContactPhones_();
  (Array.isArray(phones) ? phones : [])
    .map(normalizePhone)
    .filter(Boolean)
    .forEach(phone => importedPhones.add(phone));

  try {
    localStorage.setItem(
      RECENT_CONTACTS_IMPORTED_PHONES_KEY,
      JSON.stringify([...importedPhones])
    );
  } catch (error) {
    console.warn("Could not store imported recent-contact phones", error);
  }
}

function parseContactDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    const converted = value.toDate();
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  if (typeof value.toMillis === "function") {
    const converted = new Date(value.toMillis());
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    const converted = new Date(value.seconds * 1000);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  if (typeof value === "number") {
    const milliseconds = value < 100000000000 ? value * 1000 : value;
    const converted = new Date(milliseconds);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  const raw = String(value).trim();
  if (!raw) return null;

  const israeliMatch = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (israeliMatch) {
    let [, day, month, year, hours = "0", minutes = "0", seconds = "0"] = israeliMatch;
    if (year.length === 2) year = "20" + year;
    const converted = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds));
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  const direct = new Date(raw);
  return Number.isNaN(direct.getTime()) ? null : direct;
}

function getContactCreationDate(contact) {
  const firstSeenDate = parseContactDate(contact && contact.firstSeenAt);
  if (firstSeenDate) return firstSeenDate;
  return parseContactDate(contact && contact.createdAt);
}

function getRecentContacts() {
  const importedPhones = getImportedRecentContactPhones_();
  const cutoff = getRecentContactsCutoff();

  return contacts.filter(contact => {
    if (!contact || contact.isNewContact !== true) return false;
    const phone = normalizePhone(contact.phone);
    if (!phone || importedPhones.has(phone)) return false;
    const createdDate = getContactCreationDate(contact);
    return Boolean(createdDate && createdDate.getTime() > cutoff);
  }).sort((a, b) => {
    const aDate = getContactCreationDate(a);
    const bDate = getContactCreationDate(b);
    return (bDate ? bDate.getTime() : 0) - (aDate ? aDate.getTime() : 0);
  });
}

function isDepartmentFilterActive_() {
  return String(activeQuickFilter || "").startsWith("department:");
}

function isQuickFilterActive() {
  return ["all", "vpn", "institutes", "labs"].includes(activeQuickFilter) ||
    isDepartmentFilterActive_();
}

function canUseMultiSelection() {
  return currentDisplayedContacts.length > 0;
}

function contactMatchesQuickFilter(contact, filterName) {
  const department = normalizeSearchText(contact.dept);
  const belongsToVpnList = department.includes("vpn");
  if (filterName === "vpn") return belongsToVpnList && isMobilePhone(contact.phone);
  if (filterName === "institutes") return belongsToVpnList && isInstituteLandline(contact.phone);
  if (filterName === "labs") return department.includes("מעבד");
  if (String(filterName || "").startsWith("department:")) {
    return department === String(filterName).slice("department:".length);
  }
  return true;
}

function getQuickFilterContacts() {
  if (!isQuickFilterActive()) return [...contacts];
  return contacts.filter(contact => contactMatchesQuickFilter(contact, activeQuickFilter));
}

function updateQuickFilterButtons() {
  const buttons = {
    vpn: document.getElementById("vpnFilterBtn"),
    institutes: document.getElementById("institutesFilterBtn"),
    labs: document.getElementById("labsFilterBtn")
  };

  Object.entries(buttons).forEach(([filterName, button]) => {
    if (!button) return;
    const isActive = activeQuickFilter === filterName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  const departmentsButton = document.getElementById("departmentsFilterBtn");
  if (departmentsButton) {
    const isActive = isDepartmentFilterActive_();
    departmentsButton.classList.toggle("active", isActive);
    departmentsButton.setAttribute("aria-pressed", String(isActive));
  }

  const activeFilter = document.getElementById("activeDirectoryFilter");
  const activeFilterText = document.getElementById("activeDirectoryFilterText");
  const label = getActiveDirectoryFilterLabel_();
  if (activeFilter) activeFilter.hidden = !label;
  if (activeFilterText) activeFilterText.textContent = label;
}

function toggleQuickFilter(filterName) {
  if (activeQuickFilter === filterName) {
    returnToHome_();
    return;
  }
  activeQuickFilter = filterName;
  directoryBrowseActivated = true;
  selectionMode = false;
  selectedContactIds.clear();
  closeDepartmentBrowser_();
  updateQuickFilterButtons();
  renderCurrentSearchResults();
}

function returnToHome_() {
  activeQuickFilter = "all";
  directoryBrowseActivated = false;
  selectionMode = false;
  selectedContactIds.clear();
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";
  closeDepartmentBrowser_();
  updateQuickFilterButtons();
  renderCurrentSearchResults();
}

function getActiveDirectoryFilterLabel_() {
  const labels = {
    vpn: "VPN",
    institutes: "מכונים",
    labs: "מעבדות"
  };
  if (labels[activeQuickFilter]) return labels[activeQuickFilter];
  if (!isDepartmentFilterActive_()) return "";
  const key = activeQuickFilter.slice("department:".length);
  const option = getDepartmentOptions_().find(item => item.key === key);
  return option ? option.label : key;
}

function clearActiveDirectoryFilter_() {
  returnToHome_();
}

function getDepartmentOptions_() {
  const departments = new Map();
  contacts.forEach(contact => {
    const label = String(contact && contact.dept || "").trim();
    const key = normalizeSearchText(label);
    if (!key) return;
    const current = departments.get(key) || { key, label, count: 0 };
    current.count += 1;
    if (!current.label) current.label = label;
    departments.set(key, current);
  });
  return [...departments.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "he", { sensitivity: "base" })
  );
}

function renderDepartmentBrowser_() {
  const list = document.getElementById("departmentList");
  if (!list) return;
  const options = getDepartmentOptions_();
  list.innerHTML = options.length
    ? options.map(option => {
        const isActive = activeQuickFilter === "department:" + option.key;
        return `
          <button type="button" class="departmentOption ${isActive ? "active" : ""}" data-department-key="${escapeHtml(option.key)}">
            <span>${escapeHtml(option.label)}</span>
            <small>${option.count}</small>
          </button>
        `;
      }).join("")
    : '<div class="departmentListEmpty">לא נמצאו מחלקות ברשימה.</div>';
}

function openDepartmentBrowser_() {
  closeAllDirectoryMenus_();
  renderDepartmentBrowser_();
  const sheet = document.getElementById("departmentSheet");
  if (!sheet) return;
  sheet.classList.add("visible");
  sheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("directorySheetOpen");
}

function handleDepartmentsFilterClick_() {
  if (isDepartmentFilterActive_()) {
    clearActiveDirectoryFilter_();
    return;
  }

  openDepartmentBrowser_();
}

function closeDepartmentBrowser_() {
  const sheet = document.getElementById("departmentSheet");
  if (!sheet) return;
  sheet.classList.remove("visible");
  sheet.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".directorySheet.visible")) {
    document.body.classList.remove("directorySheetOpen");
  }
}

function selectDepartmentFilter_(departmentKey) {
  const key = normalizeSearchText(departmentKey);
  if (!key) return;
  activeQuickFilter = `department:${key}`;
  directoryBrowseActivated = true;
  selectionMode = false;
  selectedContactIds.clear();
  closeDepartmentBrowser_();
  updateQuickFilterButtons();
  renderCurrentSearchResults();
}

function updateMainActionButton() {
  const btn = document.getElementById("selectionModeBtn");
  if (!btn) return;

  btn.hidden = !currentDisplayedContacts.length;
  if (selectionMode) {
    btn.disabled = false;
    btn.textContent = "סיום בחירה";
    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");
    return;
  }

  btn.disabled = false;
  btn.textContent = "בחירה";
  btn.classList.remove("active");
  btn.setAttribute("aria-pressed", "false");
}

function openSelectionModeFromHome_() {
  activeQuickFilter = "all";
  directoryBrowseActivated = true;
  selectionMode = false;
  selectedContactIds.clear();
  updateQuickFilterButtons();
  renderCurrentSearchResults();
  enterSelectionMode();
}

function handleMainImportButton() {
  if (selectionMode) {
    exitSelectionMode();
    return;
  }

  if (canUseMultiSelection()) {
    enterSelectionMode();
    return;
  }

  downloadAllContacts();
}

function toggleSelectionMode_() {
  if (selectionMode) exitSelectionMode();
  else enterSelectionMode();
}

function enterSelectionMode() {
  if (isCurrentUserProvisional_()) {
    alert("בחירה והורדה מרוכזת זמינות לאחר אישור גישה קבועה.");
    return;
  }
  if (!currentDisplayedContacts.length) {
    alert("לא נמצאו אנשי קשר לבחירה");
    return;
  }

  selectedContactIds.clear();
  selectionMode = true;
  show(currentDisplayedContacts);
}

function exitSelectionMode() {
  selectionMode = false;
  selectedContactIds.clear();
  show(currentDisplayedContacts);
}

function mapFirestoreContact(document, index = 0) {
  const isSnapshot = typeof document.data === "function";
  const row = isSnapshot
    ? document.data()
    : (document.data || document || {});

  const documentId = isSnapshot
    ? (document.id || "")
    : (document.docId || row.docId || document.id || row.contact_doc_id || "");

  return {
    id: index,
    docId: documentId,
    first: (row.first_name_he || "").toString().trim(),
    last: (row.last_name_he || "").toString().trim(),
    firstEn: (row.first_name_en || "").toString().trim(),
    lastEn: (row.last_name_en || "").toString().trim(),
    title: (row.title_prefix || "").toString().trim(),
    name: ((row.title_prefix || "") + " " + (row.first_name_he || "") + " " + (row.last_name_he || "")).trim(),
    role: (row.role || "").toString().trim(),
    dept: (row.department || "").toString().trim(),
    hospital: (row.hospital || "").toString().trim(),
    phone: normalizePhone(row.phone || ""),
    email: (row.email || "").toString().replace(/\u200E|\u200F/g, "").trim(),
    source: (row.source || "").toString().trim(),
    status: (row.status || "").toString().trim(),
    createdAt: (row.created_at || "").toString().trim(),
    updatedAt: (row.updated_at || "").toString().trim(),
    firstSeenAt: (row.first_seen_at || row.created_at || "").toString().trim(),
    isNewContact: row.is_new_contact === true || String(row.is_new_contact || "").toLowerCase() === "true",
    raw: row
  };
}

function applyRawContacts_(rawContacts) {
  contacts = deduplicateContacts(
    (Array.isArray(rawContacts) ? rawContacts : [])
      .map((row, index) => mapFirestoreContact(row, index))
      .filter(contact => contact.phone)
  ).map((contact, index) => ({
    ...contact,
    id: index,
    _search: buildContactSearchIndex_(contact)
  }));

  renderMonthlyInterns_();

  return contacts;
}

function getCurrentMonthlyInternsDescriptor_(date = new Date()) {
  const keyParts = new Intl.DateTimeFormat("en-US", {
    timeZone: MONTHLY_INTERNS_TIME_ZONE,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const year = keyParts.find(part => part.type === "year")?.value ||
    String(date.getFullYear());
  const month = keyParts.find(part => part.type === "month")?.value ||
    String(date.getMonth() + 1).padStart(2, "0");
  const label = new Intl.DateTimeFormat("he-IL", {
    timeZone: MONTHLY_INTERNS_TIME_ZONE,
    year: "numeric",
    month: "long"
  }).format(date);

  return {
    year,
    month,
    key: `${MONTHLY_INTERNS_DOCUMENT_PREFIX}${year}_${month}`,
    label
  };
}

function normalizeMonthlyInternEntry_(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  const name = String(source.name || "").trim();
  const phone = normalizePhone(source.phone || "");
  return {
    id: String(source.id || createMonthlyInternId_(name, phone)).trim(),
    phone,
    name,
    department: String(source.department || "").trim(),
    manuallyEdited: source.manuallyEdited === true
  };
}

function createMonthlyInternId_(name, phone) {
  const value = `${normalizeSearchText(name)}|${normalizePhone(phone)}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `intern_${(hash >>> 0).toString(36)}`;
}

function getMonthlyInternById_(internId) {
  return (monthlyInternsState.entries || []).find(
    entry => String(entry.id || "") === String(internId || "")
  ) || null;
}

function getMonthlyInternContact_(entry) {
  const phone = normalizePhone(entry && entry.phone || "");
  if (!phone) return null;
  return contacts.find(contact => normalizePhone(contact.phone) === phone) || null;
}

function monthlyInternMatchesSearch_(entry, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const textMatches = [entry && entry.name, entry && entry.department]
    .some(value => normalizeSearchText(value).includes(normalizedQuery));
  const queryDigits = String(query || "").replace(/\D/g, "");
  if (!queryDigits) return textMatches;

  const internationalPhone = normalizePhone(entry && entry.phone)
    .replace(/\D/g, "");
  const localPhone = internationalPhone.startsWith("972")
    ? `0${internationalPhone.slice(3)}`
    : internationalPhone;
  const normalizedQueryPhone = normalizePhone(query).replace(/\D/g, "");
  return textMatches || [internationalPhone, localPhone]
    .some(phone => phone.includes(queryDigits) || phone.includes(normalizedQueryPhone));
}

function handleMonthlyInternsSearch_() {
  const input = document.getElementById("monthlyInternsSearchInput");
  const clearButton = document.getElementById("monthlyInternsSearchClear");
  const hasQuery = Boolean(input && input.value.trim());
  if (clearButton) clearButton.classList.toggle("visible", hasQuery);
  renderMonthlyInterns_();
}

function clearMonthlyInternsSearch_() {
  const input = document.getElementById("monthlyInternsSearchInput");
  if (input) input.value = "";
  handleMonthlyInternsSearch_();
  if (input) input.focus();
}

function getMonthlyInternsDescriptorFromData_(data, fallbackDescriptor) {
  const source = data && typeof data === "object" ? data : {};
  const monthKey = String(source.monthKey || "");
  const match = monthKey.match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
  if (!match) return fallbackDescriptor;
  const date = new Date(`${match[1]}-${match[2]}-15T12:00:00`);
  const label = String(source.monthLabel || "").trim() ||
    new Intl.DateTimeFormat("he-IL", {
      timeZone: MONTHLY_INTERNS_TIME_ZONE,
      year: "numeric",
      month: "long"
    }).format(date);
  return {
    year: match[1],
    month: match[2],
    key: monthKey,
    label
  };
}

function renderMonthlyInterns_() {
  const view = document.getElementById("monthlyInternsView");
  const monthLabel = document.getElementById("monthlyInternsMonthLabel");
  const countElement = document.getElementById("monthlyInternsCount");
  const statusElement = document.getElementById("monthlyInternsStatus");
  const listElement = document.getElementById("monthlyInternsList");
  const searchInput = document.getElementById("monthlyInternsSearchInput");
  const quickMonthLabel = document.getElementById("monthlyInternsQuickMonthLabel");
  const quickCount = document.getElementById("monthlyInternsQuickCount");
  if (!view || !monthLabel || !countElement || !statusElement || !listElement) {
    return;
  }

  const descriptor = monthlyInternsState.descriptor ||
    getCurrentMonthlyInternsDescriptor_();
  monthLabel.textContent = descriptor.label;
  if (quickMonthLabel) quickMonthLabel.textContent = descriptor.label;
  if (quickCount) {
    quickCount.hidden = true;
    quickCount.textContent = "";
  }
  countElement.hidden = true;
  countElement.textContent = "";
  listElement.innerHTML = "";
  statusElement.hidden = false;
  statusElement.classList.remove("empty");

  if (["idle", "loading"].includes(monthlyInternsState.status)) {
    statusElement.textContent = "טוען את הרשימה…";
    return;
  }

  if (monthlyInternsState.status === "missing") {
    statusElement.textContent = "אין כרגע רשימת סטאז׳רים פעילה";
    return;
  }

  if (monthlyInternsState.status === "unavailable") {
    statusElement.textContent = "אין כרגע רשימת סטאז׳רים פעילה";
    return;
  }

  const entries = Array.isArray(monthlyInternsState.entries)
    ? monthlyInternsState.entries
    : [];
  if (!entries.length) {
    statusElement.textContent = "אין כרגע רשימת סטאז׳רים פעילה";
    return;
  }

  const query = searchInput ? searchInput.value.trim() : "";
  const filteredEntries = query
    ? entries.filter(entry => monthlyInternMatchesSearch_(entry, query))
    : entries;
  if (!filteredEntries.length) {
    statusElement.classList.add("empty");
    statusElement.innerHTML = "<strong>לא נמצאו סטאז׳רים</strong><span>נסה שם, מחלקה או מספר טלפון</span>";
    countElement.textContent = "0";
    countElement.hidden = false;
    if (quickCount) {
      quickCount.textContent = String(entries.length);
      quickCount.hidden = false;
    }
    return;
  }

  statusElement.hidden = true;
  countElement.textContent = String(filteredEntries.length);
  countElement.hidden = false;
  if (quickCount) {
    quickCount.textContent = String(entries.length);
    quickCount.hidden = false;
  }
  const departmentGroups = new Map();
  const noDepartmentEntries = [];
  filteredEntries.forEach(entry => {
    const department = String(entry.department || "").trim();
    if (!department) {
      noDepartmentEntries.push(entry);
      return;
    }
    const key = normalizeSearchText(department) || department;
    if (!departmentGroups.has(key)) {
      departmentGroups.set(key, { label: department, entries: [] });
    }
    departmentGroups.get(key).entries.push(entry);
  });

  const groups = [...departmentGroups.values()];
  if (noDepartmentEntries.length) {
    groups.push({ label: "ללא מחלקה", entries: noDepartmentEntries });
  }

  const hebrewNameSort = (left, right) => String(left.name || "").localeCompare(
    String(right.name || ""),
    "he",
    { sensitivity: "base" }
  );
  listElement.innerHTML = groups.map(group => {
    const sortedEntries = [...group.entries].sort(hebrewNameSort);
    const rows = sortedEntries.map(entry => {
      const name = entry.name || "סטאז׳ר/ית";
      const displayPhone = formatPhoneForDisplay(entry.phone);
      const cleanPhone = normalizePhone(entry.phone).replace(/\D/g, "");
      const report = userRequestState.reports.find(item =>
        item.subjectType === "intern" &&
        String(item.internId || "") === String(entry.id || "") &&
        (!item.internVersion || String(item.internVersion) === String(monthlyInternsState.version || ""))
      );
      const reportStatus = report
        ? getUserRequestStatusPresentation_(report.status || "open", "report")
        : null;
      return `
        <article class="monthlyInternItem">
          <span class="monthlyInternContent">
            <strong>${escapeHtml(name)}</strong>
            <span class="monthlyInternPhone" dir="ltr">${escapeHtml(displayPhone)}</span>
          </span>
          <span class="monthlyInternActions">
            <a href="tel:${escapeHtml(entry.phone)}" aria-label="חיוג אל ${escapeHtml(name)}" onclick="recordContactUse_('${escapeJsString(entry.phone)}', 'call')">${getDirectoryIconSvg_("phone")}</a>
            <a href="https://wa.me/${escapeHtml(cleanPhone)}" target="_blank" rel="noopener" aria-label="פתיחת WhatsApp עם ${escapeHtml(name)}" onclick="recordContactUse_('${escapeJsString(entry.phone)}', 'whatsapp')">${getDirectoryIconSvg_("whatsapp")}</a>
            <button type="button" aria-label="הוספת ${escapeHtml(name)} לאנשי הקשר בטלפון" onclick="downloadMonthlyIntern_('${escapeJsString(entry.id)}')">${getDirectoryIconSvg_("saveContact")}</button>
          </span>
          <span class="monthlyInternSecondaryActions">
            ${currentUserIsAdmin
              ? `<button type="button" onclick="openMonthlyInternEditor_('${escapeJsString(entry.id)}')">עריכת פרטים</button>
                 <button type="button" class="danger" onclick="deleteMonthlyIntern_('${escapeJsString(entry.id)}')">מחיקה מהרשימה</button>`
              : `<button type="button" onclick="openMonthlyInternReport_('${escapeJsString(entry.id)}')">דיווח על טעות</button>`}
          </span>
          ${reportStatus ? `<span class="userRequestStatus ${reportStatus.tone}">דיווח: ${reportStatus.label}</span>` : ""}
        </article>
      `;
    }).join("");
    return `
      <section class="monthlyInternDepartment" aria-label="${escapeHtml(group.label)}">
        <header class="monthlyInternDepartmentHeader">
          <h3>${escapeHtml(group.label)}</h3>
          <span>${sortedEntries.length}</span>
        </header>
        <div class="monthlyInternDepartmentList">${rows}</div>
      </section>
    `;
  }).join("");
}

function openMonthlyInternsView_() {
  closeAllDirectoryMenus_();
  closeDepartmentBrowser_();
  const appElement = document.getElementById("app");
  const view = document.getElementById("monthlyInternsView");
  if (!appElement || !view || appElement.classList.contains("internsViewActive")) {
    return;
  }
  monthlyInternsHomeScrollY = window.scrollY;
  view.hidden = false;
  appElement.classList.add("internsViewActive");
  loadUserRequestStatuses_().then(() => {
    if (appElement.classList.contains("internsViewActive")) renderMonthlyInterns_();
  });
  window.scrollTo({ top: 0, behavior: "auto" });
  window.setTimeout(() => {
    const backButton = view.querySelector(".monthlyInternsViewBack");
    if (backButton) backButton.focus();
  }, 0);
}

function closeMonthlyInternsView_() {
  const appElement = document.getElementById("app");
  const view = document.getElementById("monthlyInternsView");
  if (!appElement || !view || !appElement.classList.contains("internsViewActive")) {
    return;
  }
  appElement.classList.remove("internsViewActive");
  view.hidden = true;
  window.scrollTo({ top: monthlyInternsHomeScrollY, behavior: "auto" });
  const quickEntry = document.getElementById("monthlyInternsQuickEntry");
  if (quickEntry) quickEntry.focus();
}

function openMonthlyInternEditor_(internId, reportId = "") {
  if (!currentUserIsAdmin) return;
  const intern = getMonthlyInternById_(internId);
  if (!intern) {
    setAdminStatus("הסטאז׳ר כבר אינו מופיע ברשימה הפעילה.", "error");
    return;
  }
  openAdminFocusSheet_({
    eyebrow: "סטאז׳רים החודש",
    title: "עריכת פרטים",
    subtitle: monthlyInternsState.descriptor?.label || "",
    html: `
      <div class="adminFormGrid monthlyInternEditForm">
        <div class="adminFormField full"><label for="monthlyInternEditName">שם</label><input id="monthlyInternEditName" value="${escapeHtml(intern.name)}" maxlength="200" autocomplete="off"></div>
        <div class="adminFormField full"><label for="monthlyInternEditPhone">טלפון</label><input id="monthlyInternEditPhone" value="${escapeHtml(formatPhoneForDisplay(intern.phone))}" maxlength="30" inputmode="tel" dir="ltr" autocomplete="tel"></div>
        <div class="adminFormField full"><label for="monthlyInternEditDepartment">מחלקה — לא חובה</label><input id="monthlyInternEditDepartment" value="${escapeHtml(intern.department || "")}" maxlength="160" autocomplete="off"></div>
      </div>
      <div id="monthlyInternEditStatus" class="statusMessage adminSavingStatus"></div>
      <div class="adminFocusPrimaryActions">
        <button type="button" id="monthlyInternEditSaveBtn" class="adminActionBtn primary" onclick="saveMonthlyInternChanges_('${escapeJsString(intern.id)}', '${escapeJsString(reportId)}')">שמירת שינויים</button>
      </div>
    `
  });
}

async function updateActiveMonthlyInterns_(transform) {
  if (!currentUserIsAdmin || !firebaseApi || !db) {
    throw new Error("ADMIN_REQUIRED");
  }
  const activeRef = firebaseApi.doc(
    db,
    MONTHLY_INTERNS_COLLECTION_NAME,
    MONTHLY_INTERNS_ACTIVE_DOCUMENT_ID
  );
  let updatedEntries = null;
  let updatedData = null;
  await firebaseApi.runTransaction(db, async transaction => {
    const snapshot = await transaction.get(activeRef);
    if (!snapshot.exists()) throw new Error("NO_ACTIVE_INTERNS_LIST");
    const current = snapshot.data() || {};
    const entries = (Array.isArray(current.entries) ? current.entries : [])
      .map(normalizeMonthlyInternEntry_);
    updatedEntries = transform(entries);
    if (!Array.isArray(updatedEntries)) throw new Error("INVALID_INTERNS_UPDATE");
    updatedData = {
      ...current,
      entries: updatedEntries,
      recordCount: updatedEntries.length,
      version: String(current.version || `${Date.now()}_manual`),
      publishedAt: firebaseApi.serverTimestamp(),
      publishedBy: currentAdminEmail
    };
    transaction.set(activeRef, updatedData);
  });
  adminMonthlyInternsActive = {
    ...(adminMonthlyInternsActive || {}),
    ...updatedData,
    publishedAt: new Date(),
    entries: updatedEntries
  };
  monthlyInternsState = {
    ...monthlyInternsState,
    status: "ready",
    version: updatedData.version,
    entries: updatedEntries
  };
  renderMonthlyInterns_();
  if (adminActiveTab === "system") renderAdminSystem_();
  return updatedEntries;
}

async function saveMonthlyInternChanges_(internId, reportId = "") {
  if (!currentUserIsAdmin) return;
  const name = String(document.getElementById("monthlyInternEditName")?.value || "").trim();
  const phone = normalizePhone(document.getElementById("monthlyInternEditPhone")?.value || "");
  const department = String(document.getElementById("monthlyInternEditDepartment")?.value || "").trim();
  const saveButton = document.getElementById("monthlyInternEditSaveBtn");
  if (!name) {
    setStatus("monthlyInternEditStatus", "יש להזין שם.", "error");
    return;
  }
  if (!phone || !isValidPhoneForRouting_(phone)) {
    setStatus("monthlyInternEditStatus", "יש להזין מספר טלפון ישראלי תקין.", "error");
    return;
  }
  if (saveButton) saveButton.disabled = true;
  setStatus("monthlyInternEditStatus", "שומר את השינויים...", "loading");
  try {
    await updateActiveMonthlyInterns_(entries => {
      const index = entries.findIndex(entry => entry.id === internId);
      if (index < 0) throw new Error("INTERN_NOT_FOUND");
      if (entries.some((entry, entryIndex) => entryIndex !== index && entry.phone === phone)) {
        throw new Error("DUPLICATE_INTERN_PHONE");
      }
      entries[index] = {
        ...entries[index],
        id: internId,
        name,
        phone,
        department,
        manuallyEdited: true,
        manuallyEditedAt: new Date().toISOString(),
        manuallyEditedBy: currentAdminEmail
      };
      return entries;
    });
    logAdminAction("monthly_intern_edit", "", internId).catch(() => {});
    closeAdminFocusSheet_();
    if (reportId) await setContactReportStatus_(reportId, "resolved");
    setAdminStatus("פרטי הסטאז׳ר עודכנו.", "success");
  } catch (error) {
    console.error("Monthly intern edit failed", error);
    const message = error && error.message === "DUPLICATE_INTERN_PHONE"
      ? "מספר הטלפון כבר משויך לסטאז׳ר אחר ברשימה."
      : error && error.message === "INTERN_NOT_FOUND"
        ? "הסטאז׳ר כבר אינו מופיע ברשימה הפעילה."
        : "שמירת השינויים נכשלה.";
    setStatus("monthlyInternEditStatus", message, "error");
    if (saveButton) saveButton.disabled = false;
  }
}

async function deleteMonthlyIntern_(internId) {
  if (!currentUserIsAdmin) return;
  const intern = getMonthlyInternById_(internId);
  if (!intern) return;
  const confirmed = await requestAdminConfirmation_({
    title: "מחיקת סטאז׳ר",
    message: `${intern.name} יוסר מרשימת הסטאז׳רים הפעילה.`,
    confirmLabel: "מחיקה",
    tone: "danger"
  });
  if (!confirmed) return;
  try {
    await updateActiveMonthlyInterns_(entries => {
      const next = entries.filter(entry => entry.id !== internId);
      if (next.length === entries.length) throw new Error("INTERN_NOT_FOUND");
      return next;
    });
    logAdminAction("monthly_intern_delete", "", internId).catch(() => {});
    setAdminStatus("הסטאז׳ר הוסר מהרשימה הפעילה בלבד.", "success");
  } catch (error) {
    console.error("Monthly intern deletion failed", error);
    setAdminStatus("המחיקה נכשלה. הרשימה הפעילה לא השתנתה.", "error");
  }
}

async function loadCurrentMonthInterns_(options = {}) {
  const descriptor = getCurrentMonthlyInternsDescriptor_();
  const sameMonth = Boolean(
    monthlyInternsState.descriptor &&
    monthlyInternsState.descriptor.key === descriptor.key
  );

  if (
    options.force !== true &&
    sameMonth &&
    ["ready", "missing"].includes(monthlyInternsState.status)
  ) {
    renderMonthlyInterns_();
    return monthlyInternsState;
  }

  if (sameMonth && monthlyInternsLoadPromise) {
    return monthlyInternsLoadPromise;
  }

  const loadToken = ++monthlyInternsLoadToken;
  monthlyInternsState = {
    status: "loading",
    descriptor,
    entries: []
  };
  renderMonthlyInterns_();

  const request = (async () => {
    try {
      if (!firebaseApi || !db) {
        throw new Error("Monthly interns data is not initialized");
      }

      let snapshot = await firebaseApi.getDoc(
        firebaseApi.doc(
          db,
          MONTHLY_INTERNS_COLLECTION_NAME,
          MONTHLY_INTERNS_ACTIVE_DOCUMENT_ID
        )
      );
      if (loadToken !== monthlyInternsLoadToken) return monthlyInternsState;

      if (!snapshot.exists()) {
        // Backward-compatible fallback until the first Admin upload is published.
        snapshot = await firebaseApi.getDoc(
          firebaseApi.doc(
            db,
            CONTACT_DIRECTORY_COLLECTION_NAME,
            descriptor.key
          )
        );
        if (loadToken !== monthlyInternsLoadToken) return monthlyInternsState;
        if (!snapshot.exists()) {
          monthlyInternsState = {
            status: "missing",
            descriptor,
            entries: []
          };
          renderMonthlyInterns_();
          return monthlyInternsState;
        }
      }

      const data = snapshot.data() || {};
      if (data.sourceSheetPresent === false) {
        monthlyInternsState = {
          status: "missing",
          descriptor,
          entries: []
        };
        renderMonthlyInterns_();
        return monthlyInternsState;
      }

      const uniqueEntries = new Map();
      (Array.isArray(data.entries) ? data.entries : [])
        .map(normalizeMonthlyInternEntry_)
        .filter(entry => entry.phone && entry.name)
        .forEach(entry => uniqueEntries.set(entry.phone, entry));
      monthlyInternsState = {
        status: "ready",
        descriptor: getMonthlyInternsDescriptorFromData_(data, descriptor),
        version: String(data.version || ""),
        entries: [...uniqueEntries.values()]
      };
      renderMonthlyInterns_();
      return monthlyInternsState;
    } catch (error) {
      if (loadToken !== monthlyInternsLoadToken) return monthlyInternsState;
      console.warn("Monthly interns list could not be loaded", error);
      monthlyInternsState = {
        status: "unavailable",
        descriptor,
        entries: []
      };
      renderMonthlyInterns_();
      return monthlyInternsState;
    }
  })();

  monthlyInternsLoadPromise = request;
  try {
    return await request;
  } finally {
    if (monthlyInternsLoadPromise === request) {
      monthlyInternsLoadPromise = null;
    }
  }
}

function resetMonthlyInternsState_() {
  monthlyInternsLoadToken += 1;
  monthlyInternsLoadPromise = null;
  monthlyInternsState = {
    status: "idle",
    descriptor: getCurrentMonthlyInternsDescriptor_(),
    entries: []
  };
  renderMonthlyInterns_();
}

function countUsableRawContacts_(rawContacts) {
  return (Array.isArray(rawContacts) ? rawContacts : []).reduce(
    (count, row, index) =>
      count + (mapFirestoreContact(row, index).phone ? 1 : 0),
    0
  );
}

function hasUsableRawContacts_(rawContacts) {
  return countUsableRawContacts_(rawContacts) > 0;
}

async function loadContactsCollectionFallback_() {
  const snapshot = await firebaseApi.getDocs(
    firebaseApi.collection(db, "contacts")
  );

  return snapshot.docs.map(document => ({
    docId: document.id,
    ...(document.data() || {})
  }));
}

function getFirestoreTimestampMillis_(value) {
  if (value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadPreviousDirectoryGenerationFallback_() {
  const snapshot = await firebaseApi.getDocs(
    firebaseApi.collection(db, CONTACT_DIRECTORY_COLLECTION_NAME)
  );
  const generations = new Map();

  snapshot.docs.forEach(document => {
    const data = document.data() || {};
    const pageContacts = Array.isArray(data.contacts) ? data.contacts : [];
    if (
      data.kind !== "contacts_page" ||
      !hasUsableRawContacts_(pageContacts)
    ) {
      return;
    }

    const version = String(data.version || document.id);
    const generation = generations.get(version) || {
      contacts: [],
      updatedAt: 0
    };
    pageContacts.forEach(contact => generation.contacts.push(contact));
    generation.updatedAt = Math.max(
      generation.updatedAt,
      getFirestoreTimestampMillis_(data.updatedAt)
    );
    generations.set(version, generation);
  });

  const candidates = Array.from(generations.values())
    .filter(generation => hasUsableRawContacts_(generation.contacts))
    .sort((a, b) =>
      b.contacts.length - a.contacts.length ||
      b.updatedAt - a.updatedAt
    );

  return candidates.length ? candidates[0].contacts : [];
}

function loadContactsFromCache_() {
  const cached = readContactsBundleCache_();

  if (
    !cached ||
    !Array.isArray(cached.contacts) ||
    !hasUsableRawContacts_(cached.contacts)
  ) {
    return false;
  }

  applyRawContacts_(cached.contacts);
  return contacts.length > 0;
}

async function loadContacts() {
  if (!firebaseApi || !db) {
    throw new Error("Firebase עדיין לא אותחל.");
  }

  isLoadingContacts = true;
  hasLoadError = false;
  setLoginButtonDisabled(true);

  try {
    const rawContacts = await loadContactsFromOptimizedBundle_();
    applyRawContacts_(rawContacts);
    return contacts;
  } catch (error) {
    console.error(error);
    hasLoadError = true;
    throw error;
  } finally {
    isLoadingContacts = false;
    setLoginButtonDisabled(false);
  }
}

async function loadContactsFromOptimizedBundle_(options = {}) {
  const metaRef = firebaseApi.doc(
    db,
    CONTACT_DIRECTORY_COLLECTION_NAME,
    CONTACT_DIRECTORY_META_ID
  );
  const metaSnapshot = await firebaseApi.getDoc(metaRef);

  if (!metaSnapshot.exists()) {
    throw new Error(
      "ספריית אנשי הקשר עדיין לא נבנתה. יש להריץ syncContactsToFirestore ב-Apps Script."
    );
  }

  const meta = metaSnapshot.data() || {};
  const version = String(meta.version || "");
  const pageIds = Array.isArray(meta.pageIds) && meta.pageIds.length
    ? meta.pageIds.map(value => String(value))
    : Array.from(
        { length: Math.max(1, Number(meta.pageCount || 1)) },
        (_, index) => CONTACT_DIRECTORY_PAGE_PREFIX + index
      );
  const cached = readContactsBundleCache_();

  if (
    version &&
    cached &&
    cached.version === version &&
    Array.isArray(cached.contacts) &&
    hasUsableRawContacts_(cached.contacts)
  ) {
    return cached.contacts;
  }

  let loadedPages = 0;
  const pageSnapshots = await Promise.all(
    pageIds.map(pageId =>
      firebaseApi.getDoc(
        firebaseApi.doc(db, CONTACT_DIRECTORY_COLLECTION_NAME, pageId)
      ).then(snapshot => {
        loadedPages += 1;
        if (!document.getElementById("app") || document.getElementById("app").style.display !== "block") {
          setLoginStatus(
            `טוען אנשי קשר... ${loadedPages}/${pageIds.length}`,
            "loading"
          );
        }
        return snapshot;
      })
    )
  );
  const hasInvalidPage = pageSnapshots.some(snapshot => {
    if (!snapshot.exists()) return true;
    const data = snapshot.data() || {};
    return Boolean(version && String(data.version || "") !== version);
  });

  if (hasInvalidPage) {
    if (options.retried !== true) {
      return await loadContactsFromOptimizedBundle_({ retried: true });
    }
    throw new Error(
      "ספריית אנשי הקשר התעדכנה בזמן הטעינה. נסו שוב בעוד רגע."
    );
  }

  const rawContacts = [];

  pageSnapshots.forEach(snapshot => {
    if (!snapshot.exists()) return;
    const data = snapshot.data() || {};
    const pageContacts = Array.isArray(data.contacts) ? data.contacts : [];
    pageContacts.forEach(contact => rawContacts.push(contact));
  });

  const currentUsableCount = countUsableRawContacts_(rawContacts);
  if (currentUsableCount > 0 && currentUsableCount < 25) {
    try {
      const previousGenerationContacts =
        await loadPreviousDirectoryGenerationFallback_();
      const previousUsableCount =
        countUsableRawContacts_(previousGenerationContacts);
      if (
        previousUsableCount >= currentUsableCount * 2 &&
        previousUsableCount >= currentUsableCount + 25
      ) {
        console.warn(
          "Active contact directory shrank unexpectedly; using a larger previous generation."
        );
        writeContactsBundleCache_(version, previousGenerationContacts);
        return previousGenerationContacts;
      }
    } catch (previousGenerationError) {
      console.error(
        "Previous contact directory comparison failed",
        previousGenerationError
      );
    }
  }

  if (!hasUsableRawContacts_(rawContacts)) {
    try {
      const previousGenerationContacts =
        await loadPreviousDirectoryGenerationFallback_();
      if (hasUsableRawContacts_(previousGenerationContacts)) {
        console.warn(
          "Active contact directory is empty; using a previous directory generation."
        );
        writeContactsBundleCache_(version, previousGenerationContacts);
        return previousGenerationContacts;
      }
    } catch (previousGenerationError) {
      console.error(
        "Previous contact directory recovery failed",
        previousGenerationError
      );
    }

    try {
      const fallbackContacts = await loadContactsCollectionFallback_();
      if (hasUsableRawContacts_(fallbackContacts)) {
        console.warn(
          "Optimized contact directory is empty; using contacts collection fallback."
        );
        writeContactsBundleCache_(version, fallbackContacts);
        return fallbackContacts;
      }
    } catch (fallbackError) {
      console.error("Contacts collection fallback failed", fallbackError);
    }

    throw new Error(
      Number(meta.contactCount || 0) > 0
        ? "ספריית אנשי הקשר קיימת אך מסמכי הנתונים חסרים או פגומים."
        : "ספריית אנשי הקשר ריקה ולא נמצא מקור התאוששות זמין."
    );
  }

  writeContactsBundleCache_(version, rawContacts);
  return rawContacts;
}

function readContactsBundleCache_() {
  try {
    const raw = localStorage.getItem(CONTACT_DIRECTORY_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    localStorage.removeItem(CONTACT_DIRECTORY_CACHE_KEY);
    return null;
  }
}

function writeContactsBundleCache_(version, rawContacts) {
  try {
    localStorage.setItem(
      CONTACT_DIRECTORY_CACHE_KEY,
      JSON.stringify({
        version: String(version || ""),
        contacts: rawContacts,
        cachedAt: Date.now()
      })
    );
  } catch (error) {
    console.warn("Could not cache optimized contacts bundle", error);
  }
}

function clearContactsBundleCache_() {
  try {
    localStorage.removeItem(CONTACT_DIRECTORY_CACHE_KEY);
  } catch (error) {
    console.warn("Could not clear contacts bundle cache", error);
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getAccountDisplayName_(email, fallback = "") {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail === CONTACT_MANAGER_EMAIL) {
    return CONTACT_MANAGER_DISPLAY_NAME;
  }
  return String(fallback || normalizedEmail || "").trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function getAuthErrorMessage(error) {
  const code = error && error.code ? error.code : "";

  if (code === "auth/invalid-email") {
    return "כתובת המייל אינה תקינה.";
  }

  if (
    code === "auth/invalid-credential" ||
    code === "auth/invalid-login-credentials" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  ) {
    return "כתובת המייל או הסיסמה אינן נכונות.";
  }

  if (code === "auth/email-already-in-use") {
    return "כבר קיים חשבון עם כתובת המייל הזו. השתמשו ב״שכחתי / אין לי סיסמה״ כדי לקבוע סיסמה.";
  }

  if (
    code === "auth/weak-password" ||
    code === "auth/password-does-not-meet-requirements"
  ) {
    return "הסיסמה אינה עומדת בדרישות האבטחה. בחרו סיסמה חזקה יותר.";
  }

  if (code === "auth/too-many-requests") {
    return "בוצעו יותר מדי ניסיונות. נסו שוב מאוחר יותר.";
  }

  if (code === "auth/user-disabled") {
    return "חשבון המשתמש הושבת.";
  }

  if (code === "auth/operation-not-allowed") {
    return "כניסה באמצעות מייל וסיסמה עדיין אינה מופעלת בפרויקט Firebase.";
  }

  if (code === "auth/network-request-failed") {
    return "לא ניתן להתחבר למערכת. בדקו את החיבור לאינטרנט ונסו שוב.";
  }

  if (
    code === "auth/unauthorized-continue-uri" ||
    code === "auth/invalid-continue-uri" ||
    code === "auth/missing-continue-uri"
  ) {
    return "לא ניתן לשלוח מייל אימות עקב הגדרת קישור חזרה במערכת. מנהל ספר אנשי הקשר מטפל בכך.";
  }

  if (
    code === "auth/invalid-api-key" ||
    code === "auth/app-not-authorized" ||
    code === "auth/configuration-not-found"
  ) {
    return "הגדרת ההתחברות למערכת אינה זמינה כרגע. מנהל ספר אנשי הקשר מטפל בכך.";
  }

  return "לא הצלחנו להשלים את הפעולה. בדקו את הפרטים ונסו שוב.";
}

function setLoginButtonLabel_(label) {
  const button = document.getElementById("loginButton");
  if (!button) return;
  button.dataset.idleLabel = label;
  if (!button.classList.contains("authButtonBusy")) {
    button.textContent = label;
  }
}

function setLoginButtonBusy_(busy, busyLabel = "") {
  const button = document.getElementById("loginButton");
  if (!button) return;
  button.disabled = Boolean(busy);
  button.classList.toggle("authButtonBusy", Boolean(busy));
  button.setAttribute("aria-busy", String(Boolean(busy)));
  button.textContent = busy
    ? busyLabel || "ממשיך..."
    : button.dataset.idleLabel || button.textContent;
}

function invalidateEmailAuthFlow_() {
  authEmailFlowToken += 1;
  pendingEmailAuthRouteEmail = "";
  pendingEmailAuthRoutePromise = null;
  authAccountSetupEmail = "";
  authAccountSetupFallback = false;
  authRouteUnavailableEmail = "";
}

function setAuthMode(mode) {
  const previousPurpose = authPurpose;
  authPurpose = ["login", "register", "verify_existing"].includes(mode)
    ? mode
    : "login";
  authMode = authPurpose === "register" ? "register" : "login";
  setLoginStatus("", "");

  const title = document.getElementById("loginTitle");
  const description = document.getElementById("authModeDescription");
  const passwordInput = document.getElementById("passwordInput");
  const confirmGroup = document.getElementById("confirmPasswordGroup");
  const confirmInput = document.getElementById("confirmPasswordInput");
  const modeNote = document.getElementById("authModeNote");
  const entryPanel = document.getElementById("authPasswordEntry");
  const recoveryPanel = document.getElementById("passwordRecoveryOptions");
  const secondaryActions = document.getElementById("authPasswordSecondaryActions");

  if (entryPanel) entryPanel.style.display = "block";
  if (recoveryPanel) recoveryPanel.style.display = "none";
  if (passwordInput) {
    passwordInput.disabled = false;
    passwordInput.setAttribute("aria-disabled", "false");
    passwordInput.type = "password";
  }
  if (confirmInput) confirmInput.type = "password";

  document.querySelectorAll(".passwordToggle").forEach(toggle => {
    toggle.textContent = "הצג";
    toggle.setAttribute("aria-label", "הצגת הסיסמה");
  });

  if (authPurpose === "register") {
    authReturningUser = false;
    if (previousPurpose !== "register") {
      if (passwordInput) passwordInput.value = "";
      if (confirmInput) confirmInput.value = "";
    }
    if (title) title.textContent = "כמעט סיימנו";
    if (description) {
      description.textContent =
        "כדי להיכנס בפעמים הבאות, בחרו סיסמה.";
    }
    if (passwordInput) passwordInput.autocomplete = "new-password";
    if (confirmGroup) confirmGroup.style.display = "block";
    if (secondaryActions) secondaryActions.style.display = "none";
    if (modeNote) {
      modeNote.style.display = "block";
      modeNote.textContent =
        "לאחר יצירת החשבון יישלח מייל אימות חד־פעמי.";
    }
    setLoginButtonLabel_("המשך");
    setLoginButtonBusy_(false);
    return;
  }

  if (confirmGroup) confirmGroup.style.display = "none";
  if (confirmInput) confirmInput.value = "";
  if (passwordInput) passwordInput.autocomplete = "current-password";
  if (secondaryActions) secondaryActions.style.display = "flex";
  if (modeNote) modeNote.style.display = "none";

  if (authPurpose === "verify_existing") {
    if (title) title.textContent = "השלמת אימות החשבון";
    if (description) {
      description.textContent =
        "הזינו את הסיסמה שבחרתם כדי להשלים את אימות המייל.";
    }
    setLoginButtonLabel_("המשך לאימות");
  } else {
    if (title) {
      title.textContent = authReturningUser ? "ברוך שובך" : "כניסה לחשבון";
    }
    if (description) description.textContent = "הזינו את הסיסמה שלכם.";
    setLoginButtonLabel_("כניסה");
  }
  setLoginButtonBusy_(false);
}

function getEmailAuthRoutePromise_(email, options = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (
    pendingEmailAuthRoutePromise &&
    pendingEmailAuthRouteEmail === normalizedEmail
  ) {
    return pendingEmailAuthRoutePromise;
  }

  pendingEmailAuthRouteEmail = normalizedEmail;
  const routePromise = requestPublicAuthRouteWithRetry_(
    "email",
    normalizedEmail,
    options
  ).catch(error => {
    if (pendingEmailAuthRoutePromise === routePromise) {
      pendingEmailAuthRoutePromise = null;
    }
    throw error;
  });
  pendingEmailAuthRoutePromise = routePromise;
  return routePromise;
}

function getCurrentAuthEmail_() {
  const input = document.getElementById("emailInput");
  return normalizeEmail(input ? input.value : "");
}

function applyResolvedEmailAuthRoute_(email, result, options = {}) {
  const normalizedEmail = normalizeEmail(email);
  const flowToken = Number(options.flowToken || authEmailFlowToken);
  if (
    flowToken !== authEmailFlowToken ||
    getCurrentAuthEmail_() !== normalizedEmail ||
    (auth && auth.currentUser)
  ) {
    return false;
  }

  const route = String(result && result.route || "SYSTEM_ERROR");
  authRouteIsAdmin = Boolean(result && result.admin === true);
  if (route !== "SYSTEM_ERROR") {
    authRouteUnavailableEmail = "";
    authAccountSetupFallback = false;
  }

  if (route === "PASSWORD_RESET_READY") {
    showAuthPhoneStep_(normalizedEmail, "password_reset");
    setLoginStatus(
      "המנהל אישר איפוס סיסמה עד 23:59. לאחר התאמת מספר הטלפון תוכלו ליצור סיסמה חדשה.",
      "success"
    );
    return true;
  }

  if (route === "ASK_PHONE") {
    authRouteIsAdmin = false;
    showAuthPhoneStep_(normalizedEmail);
    return true;
  }

  if (route === "BLOCKED") {
    showAuthNotice_(
      "הגישה אינה פעילה",
      "לא ניתן להיכנס עם כתובת המייל הזו. אפשר לפנות למנהל ספר אנשי הקשר."
    );
    return true;
  }

  if (route === "PASSWORD_SETUP") {
    authAccountSetupEmail = normalizedEmail;
    showAuthPasswordStep_(normalizedEmail, "register", {
      preserveFlow: true
    });
    const passwordInput = document.getElementById("passwordInput");
    if (passwordInput) passwordInput.focus();
    return true;
  }

  if (route === "PASSWORD") {
    if (authMode === "register" || authStage === "routing") {
      showAuthPasswordStep_(normalizedEmail, "login", {
        preserveFlow: true,
        returning: authReturningUser
      });
    }
    if (options.afterPasswordFailure === true) {
      setLoginStatus(
        "הסיסמה אינה נכונה. נסו שוב או בחרו ב„שכחתי סיסמה”.",
        "error"
      );
    }
    return false;
  }

  if (options.afterPasswordFailure === true) {
    if (authStage === "routing") {
      showAuthPasswordStep_(normalizedEmail, "login", {
        preserveFlow: true,
        returning: authReturningUser
      });
    }
    setLoginStatus(
      "לא הצלחנו לבדוק כרגע את מסלול הכניסה. נסו שוב בעוד רגע.",
      "error"
    );
  }
  return false;
}

function handleBackgroundEmailAuthRoute_(email, result, flowToken) {
  const normalizedEmail = normalizeEmail(email);
  if (
    flowToken !== authEmailFlowToken ||
    !["password", "password_recovery_options"].includes(authStage) ||
    getCurrentAuthEmail_() !== normalizedEmail ||
    authActionInProgress ||
    (auth && auth.currentUser)
  ) {
    return;
  }

  applyResolvedEmailAuthRoute_(normalizedEmail, result, { flowToken });
}

async function selectAuthPasswordPath_(mode) {
  const email = getCurrentAuthEmail_();
  if (!isValidEmail(email)) return;

  if (mode !== "register") {
    setAuthMode("login");
    const passwordInput = document.getElementById("passwordInput");
    if (passwordInput) passwordInput.focus();
    return;
  }

  const flowToken = authEmailFlowToken;
  showAuthRoutingStep_();
  try {
    const result = await getEmailAuthRoutePromise_(email);
    if (flowToken !== authEmailFlowToken) return;
    applyResolvedEmailAuthRoute_(email, result, { flowToken });
  } catch (error) {
    if (flowToken === authEmailFlowToken) {
      showAuthPasswordStep_(email, "login", {
        preserveFlow: true,
        returning: authReturningUser
      });
      setLoginStatus(
        "לא הצלחנו לבדוק כרגע את מסלול הכניסה. נסו שוב.",
        "error"
      );
    }
  }
}

function getSavedLoginEmail_() {
  try {
    const email = normalizeEmail(localStorage.getItem(LAST_LOGIN_EMAIL_STORAGE_KEY) || "");
    return isValidEmail(email) ? email : "";
  } catch (error) {
    return "";
  }
}

function getPendingAuthEmail_() {
  try {
    const email = normalizeEmail(localStorage.getItem(PENDING_AUTH_EMAIL_STORAGE_KEY) || "");
    return isValidEmail(email) ? email : "";
  } catch (error) {
    return "";
  }
}

function rememberPendingAuthEmail_(email) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return;
  try {
    localStorage.setItem(PENDING_AUTH_EMAIL_STORAGE_KEY, normalized);
  } catch (error) {
    console.warn("Could not remember pending auth email", error);
  }
}

function clearPendingAuthEmail_() {
  try {
    localStorage.removeItem(PENDING_AUTH_EMAIL_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear pending auth email", error);
  }
}

function clearSavedLoginEmail_() {
  try {
    localStorage.removeItem(LAST_LOGIN_EMAIL_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear saved login email", error);
  }
}

function forgetRememberedLoginIdentity_() {
  clearSavedLoginEmail_();
  clearPendingAuthEmail_();
  const emailInput = document.getElementById("emailInput");
  if (emailInput) emailInput.value = "";
  showAuthEmailStep_({ forceEmailEntry: true });
}

function rememberSuccessfulEmail_(email) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return;
  try {
    localStorage.setItem(LAST_LOGIN_EMAIL_STORAGE_KEY, normalized);
    clearPendingAuthEmail_();
    clearCachedAuthRoute_("email", normalized);
  } catch (error) {
    console.warn("Could not remember login email", error);
  }
}

function setAuthRoutingActive_(active) {
  const login = document.getElementById("login");
  if (login) login.classList.toggle("authRoutingActive", Boolean(active));
}

function setAuthRedirectPanelVisible_(visible) {
  if (visible) setAuthRoutingActive_(false);
  const panel = document.getElementById("authRedirectPanel");
  if (panel) panel.classList.toggle("visible", Boolean(visible));
}

function setVerificationSuccessPanelVisible_(visible) {
  if (visible) setAuthRoutingActive_(false);
  const panel = document.getElementById("verificationSuccessPanel");
  if (panel) panel.classList.toggle("visible", Boolean(visible));
}

function updateAuthProgress_(stage) {
  const progress = document.getElementById("authProgress");
  const label = document.getElementById("authProgressText");
  const labels = {
    email: "כניסה מאובטחת",
    phone: "אימות זהות",
    password: "כניסה עם סיסמה",
    password_setup: "הגדרת סיסמה",
    password_help: "עזרה בכניסה",
    blocked: "מצב גישה",
    verification: "אימות כתובת המייל",
    verification_success: "האימות הושלם",
    password_recovery: "איפוס סיסמה באישור מנהל",
    password_recovery_identity: "אימות זהות לאיפוס",
    password_recovery_new: "יצירת סיסמה חדשה"
  };
  if (progress) {
    progress.style.display = stage ? "block" : "none";
  }
  if (label) label.textContent = labels[stage] || labels.email;
}

function setPasswordRecoveryPanelVisible_(visible) {
  if (visible) setAuthRoutingActive_(false);
  const panel = document.getElementById("passwordRecoveryPanel");
  const form = document.getElementById("authForm");
  if (panel) panel.classList.toggle("visible", Boolean(visible));
  if (visible) {
    invalidateEmailAuthFlow_();
    if (form) form.style.display = "none";
    const verificationPanel = document.getElementById("verificationPanel");
    if (verificationPanel) verificationPanel.classList.remove("visible");
    setAuthRedirectPanelVisible_(false);
    setVerificationSuccessPanelVisible_(false);
    updateAuthProgress_("password_recovery");
  }
}

function setVerificationPanelVisible_(visible) {
  if (visible) setAuthRoutingActive_(false);
  const form = document.getElementById("authForm");
  const panel = document.getElementById("verificationPanel");
  if (form) form.style.display = visible ? "none" : "block";
  if (panel) panel.classList.toggle("visible", Boolean(visible));
  if (visible) {
    invalidateEmailAuthFlow_();
    setPasswordRecoveryPanelVisible_(false);
    setAuthRedirectPanelVisible_(false);
    setVerificationSuccessPanelVisible_(false);
    updateAuthProgress_("verification");
  } else {
    stopVerificationAccessListener_();
  }
}

function showVerificationSuccessPanel_(user) {
  verificationSuccessUser = user || (auth && auth.currentUser) || null;
  authStage = "verification_success";
  stopVerificationAccessListener_();

  const form = document.getElementById("authForm");
  if (form) form.style.display = "none";
  const verificationPanel = document.getElementById("verificationPanel");
  if (verificationPanel) verificationPanel.classList.remove("visible");
  setAuthRedirectPanelVisible_(false);
  setPasswordRecoveryPanelVisible_(false);
  setVerificationSuccessPanelVisible_(true);
  updateAuthProgress_("verification_success");
  setLoginStatus("", "");
}

async function continueAfterVerificationSuccess_() {
  const user = verificationSuccessUser || (auth && auth.currentUser);
  if (!user) {
    showAuthEmailStep_({ forceEmailEntry: true });
    setLoginStatus("החיבור לחשבון הסתיים. התחברו מחדש.", "error");
    return;
  }

  verificationSuccessUser = null;
  setVerificationSuccessPanelVisible_(false);
  rememberSuccessfulEmail_(user.email || "");
  await handleAuthenticatedUser(user, { skipVerificationSuccess: true });
}

function hideAllAuthFormSteps_() {
  setAuthRoutingActive_(false);
  [
    "authEmailStep",
    "authPhoneStep",
    "authRegistrationDetailsStep",
    "authPasswordStep",
    "authRoutingStep",
    "authNoticeStep"
  ].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.style.display = "none";
  });
}

function showAuthRoutingStep_() {
  authStage = "routing";
  setVerificationPanelVisible_(false);
  setPasswordRecoveryPanelVisible_(false);
  setAuthRedirectPanelVisible_(false);
  setVerificationSuccessPanelVisible_(false);
  hideAllAuthFormSteps_();

  const form = document.getElementById("authForm");
  const routingStep = document.getElementById("authRoutingStep");
  setAuthRoutingActive_(true);
  if (form) form.style.display = "block";
  if (routingStep) routingStep.style.display = "grid";
  updateAuthProgress_("");
  setLoginStatus("", "");
}

function showAuthEmailStep_(options = {}) {
  invalidateEmailAuthFlow_();
  provisionalRegistrationPhone = "";
  pendingRegistrationEmail = "";
  pendingRegistrationPhone = "";
  authStage = "email";
  authPurpose = "login";
  authMode = "login";
  authReturningUser = false;
  authRouteIsAdmin = false;
  managerPasswordResetEmail = "";
  forceEmailEntry = options.forceEmailEntry === true;
  setVerificationPanelVisible_(false);
  setPasswordRecoveryPanelVisible_(false);
  setAuthRedirectPanelVisible_(false);
  hideAllAuthFormSteps_();

  const emailStep = document.getElementById("authEmailStep");
  const form = document.getElementById("authForm");
  const input = document.getElementById("emailInput");
  if (form) form.style.display = "block";
  if (emailStep) emailStep.style.display = "block";
  updateAuthProgress_("email");

  if (!options.preserveEmail && forceEmailEntry && input) {
    input.value = "";
  } else if (input && !input.value) {
    input.value = getPendingAuthEmail_() || getSavedLoginEmail_() || "";
  }

  if (!options.keepStatus) setLoginStatus("", "");
  setTimeout(() => {
    if (input) input.focus();
  }, 0);
}

function showAuthRegistrationDetailsStep_(email, phone) {
  authStage = "registration_details";
  pendingRegistrationEmail = normalizeEmail(email);
  pendingRegistrationPhone = normalizePhone(phone);
  setVerificationPanelVisible_(false);
  setPasswordRecoveryPanelVisible_(false);
  setAuthRedirectPanelVisible_(false);
  hideAllAuthFormSteps_();

  const form = document.getElementById("authForm");
  const step = document.getElementById("authRegistrationDetailsStep");
  const identity = document.getElementById("authRegistrationIdentity");
  if (form) form.style.display = "block";
  if (step) step.style.display = "block";
  if (identity) {
    identity.textContent = `${pendingRegistrationEmail} · ${formatPhoneForDisplay(pendingRegistrationPhone)}`;
  }
  updateAuthProgress_("registration");
  setLoginStatus("", "");
  setTimeout(() => document.getElementById("registrationFirstName")?.focus(), 0);
}

async function submitRegistrationDetails_() {
  if (authActionInProgress) return;
  const firstName = String(document.getElementById("registrationFirstName")?.value || "").trim();
  const lastName = String(document.getElementById("registrationLastName")?.value || "").trim();
  if (!firstName || !lastName) {
    setLoginStatus("יש למלא שם פרטי ושם משפחה.", "error");
    return;
  }
  authActionInProgress = true;
  const button = document.getElementById("registrationDetailsSubmitBtn");
  if (button) button.disabled = true;
  setLoginStatus("שולח את הבקשה למנהל...", "loading");
  try {
    const result = await submitAuthRouterForm_(
      "submitRegistrationDetails",
      {
        email: pendingRegistrationEmail,
        phone: pendingRegistrationPhone,
        firstName,
        lastName,
        titlePrefix: document.getElementById("registrationTitlePrefix")?.value || "",
        role: document.getElementById("registrationRole")?.value || "",
        department: document.getElementById("registrationDepartment")?.value || "",
        website: document.getElementById("registrationWebsite")?.value || ""
      },
      "contacts-access-registration-details"
    );
    const route = String(result && result.route || "");
    if (route === "RETRY_PHONE_CHECK") {
      showAuthPhoneStep_(pendingRegistrationEmail, "email_update");
      setLoginStatus(
        "המספר נוסף בינתיים לספר. הזינו אותו שוב כדי להשלים את הבדיקה הבטוחה.",
        "success"
      );
      return;
    }
    if (route !== "PENDING_ADMIN") {
      throw new Error("לא הצלחנו לשמור את בקשת ההצטרפות.");
    }
    showAuthNotice_(
      "הבקשה נשלחה למנהל",
      "לאחר האישור תוכלו לחזור לאפליקציה, לבחור סיסמה ולהיכנס."
    );
  } catch (error) {
    showAuthRegistrationDetailsStep_(
      pendingRegistrationEmail,
      pendingRegistrationPhone
    );
    setLoginStatus(error && error.message ? error.message : "שליחת הבקשה נכשלה.", "error");
  } finally {
    authActionInProgress = false;
    if (button) button.disabled = false;
  }
}

function showAuthPhoneStep_(email, purpose = "email_update") {
  invalidateEmailAuthFlow_();
  const normalizedEmail = normalizeEmail(email);
  const isPasswordReset = purpose === "password_reset";
  authStage = isPasswordReset ? "password_recovery_claim" : "phone";
  lastUnknownEmail = normalizedEmail;
  managerPasswordResetEmail = isPasswordReset ? normalizedEmail : "";
  setVerificationPanelVisible_(false);
  setPasswordRecoveryPanelVisible_(false);
  setAuthRedirectPanelVisible_(false);
  hideAllAuthFormSteps_();

  const form = document.getElementById("authForm");
  const phoneStep = document.getElementById("authPhoneStep");
  const phoneInput = document.getElementById("phoneInput");
  const phoneTitle = document.getElementById("authPhoneTitle");
  const phoneDescription = document.getElementById(
    "authPhoneDescription"
  );
  const phoneButton = document.getElementById("phoneContinueBtn");
  if (form) form.style.display = "block";
  if (phoneStep) phoneStep.style.display = "block";
  if (phoneInput) phoneInput.value = "";
  if (phoneTitle) {
    phoneTitle.textContent = isPasswordReset
      ? "האיפוס אושר — אימות קצר"
      : "בדיקת מספר הטלפון";
  }
  if (phoneDescription) {
    phoneDescription.textContent = isPasswordReset
      ? "המנהל אישר איפוס סיסמה עד 23:59. הזינו את מספר הטלפון שמקושר לחשבון, ולאחר מכן תוכלו ליצור סיסמה חדשה."
      : "כתובת המייל אינה מופיעה במערכת. הזינו את מספר הטלפון שמופיע בספר אנשי הקשר.";
  }
  if (phoneButton) {
    phoneButton.textContent = isPasswordReset
      ? "המשך ליצירת סיסמה חדשה"
      : "המשך";
  }
  updateAuthProgress_(
    isPasswordReset ? "password_recovery_identity" : "phone"
  );
  setLoginStatus("", "");
  setTimeout(() => {
    if (phoneInput) phoneInput.focus();
  }, 0);
}

function showAuthPasswordStep_(email, mode = "login", options = {}) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    setLoginStatus("הכניסו כתובת מייל תקינה.", "error");
    return false;
  }

  if (options.preserveFlow !== true) invalidateEmailAuthFlow_();
  authReturningUser = options.returning === true;
  authStage = "password";
  forceEmailEntry = false;
  setVerificationPanelVisible_(false);
  setPasswordRecoveryPanelVisible_(false);
  setAuthRedirectPanelVisible_(false);
  hideAllAuthFormSteps_();

  const emailInput = document.getElementById("emailInput");
  const form = document.getElementById("authForm");
  const passwordStep = document.getElementById("authPasswordStep");
  const selectedEmail = document.getElementById("selectedAuthEmail");
  const selectedRecoveryEmail = document.getElementById(
    "selectedRecoveryEmail"
  );
  if (emailInput) emailInput.value = normalized;
  if (selectedEmail) selectedEmail.textContent = normalized;
  if (selectedRecoveryEmail) selectedRecoveryEmail.textContent = normalized;
  if (form) form.style.display = "block";
  if (passwordStep) passwordStep.style.display = "block";
  setAuthMode(mode);
  const firstAccessAction = document.getElementById("authFirstAccessAction");
  if (firstAccessAction) {
    firstAccessAction.style.display =
      mode === "login" && authRouteUnavailableEmail === normalized
        ? "inline-flex"
        : "none";
  }
  updateAuthProgress_(mode === "register" ? "password_setup" : "password");
  setLoginStatus("", "");
  setTimeout(() => {
    const focusTarget = document.getElementById("passwordInput");
    if (focusTarget) focusTarget.focus();
  }, 0);
  return true;
}

function markAuthRouteUnavailable_(email) {
  authRouteUnavailableEmail = normalizeEmail(email);
  authAccountSetupFallback = false;
}

function startApprovedAccountSetup_() {
  if (authActionInProgress) return;

  const email = getCurrentAuthEmail_();
  if (!isValidEmail(email) || authRouteUnavailableEmail !== email) {
    setLoginStatus("חזרו לשלב המייל ונסו שוב.", "error");
    return;
  }

  // המסלול הזה זמין רק אחרי כשל ניתוב. לאחר יצירת חשבון Firebase
  // בודקים את מסמך ההרשאה של המשתמשת עצמה, שהכללים מאפשרים לקרוא.
  authAccountSetupEmail = email;
  authAccountSetupFallback = true;
  showAuthPasswordStep_(email, "register", { preserveFlow: true });
  setLoginStatus(
    "בחרו סיסמה לחשבון. ההרשאה שכבר אושרה תיבדק לאחר יצירת החשבון.",
    "success"
  );
}

function showAuthNotice_(title, message) {
  invalidateEmailAuthFlow_();
  authStage = "notice";
  setVerificationPanelVisible_(false);
  setPasswordRecoveryPanelVisible_(false);
  setAuthRedirectPanelVisible_(false);
  hideAllAuthFormSteps_();

  const form = document.getElementById("authForm");
  const notice = document.getElementById("authNoticeStep");
  const titleElement = document.getElementById("authNoticeTitle");
  const messageElement = document.getElementById("authNoticeMessage");
  const retryButton = document.getElementById("authNoticeRetryBtn");
  if (form) form.style.display = "block";
  if (notice) notice.style.display = "block";
  if (titleElement) titleElement.textContent = title || "לא ניתן להמשיך";
  if (messageElement) messageElement.textContent = message || "נסו שוב מאוחר יותר.";
  if (retryButton) retryButton.style.display = "none";
  updateAuthProgress_("blocked");
  setLoginStatus("", "");
}

function showAccessActivationRetryState_() {
  showAuthNotice_(
    "האימות הושלם",
    "המייל אומת, אך השלמת ההרשאה נכשלה זמנית. החשבון נשאר מחובר — נסו שוב."
  );
  const retryButton = document.getElementById("authNoticeRetryBtn");
  if (retryButton) retryButton.style.display = "flex";
}

async function retryAccessActivation_() {
  const user = auth && auth.currentUser;
  if (!user) {
    showAuthEmailStep_({ forceEmailEntry: true });
    return;
  }

  const button = document.getElementById("authNoticeRetryBtn");
  if (button) button.disabled = true;
  try {
    await handleAuthenticatedUser(user, { skipVerificationSuccess: true });
  } finally {
    if (button) button.disabled = false;
  }
}

function getAuthRouteCacheKey_(kind, value) {
  return AUTH_ROUTE_CACHE_PREFIX + kind + "_" + encodeURIComponent(String(value || "").toLowerCase());
}

function getCachedAuthRoute_(kind, value) {
  try {
    const raw = sessionStorage.getItem(getAuthRouteCacheKey_(kind, value));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.savedAt || Date.now() - parsed.savedAt > AUTH_ROUTE_CACHE_MS) {
      sessionStorage.removeItem(getAuthRouteCacheKey_(kind, value));
      return null;
    }
    return parsed.payload || null;
  } catch (error) {
    return null;
  }
}

function saveAuthRouteCache_(kind, value, payload) {
  if (
    !payload ||
    ["SYSTEM_ERROR", "WAIT", "PASSWORD_SETUP"].includes(payload.route)
  ) {
    return;
  }
  try {
    sessionStorage.setItem(
      getAuthRouteCacheKey_(kind, value),
      JSON.stringify({ savedAt: Date.now(), payload })
    );
  } catch (error) {
    console.warn("Could not cache auth route", error);
  }
}

function clearCachedAuthRoute_(kind, value) {
  try {
    sessionStorage.removeItem(getAuthRouteCacheKey_(kind, value));
  } catch (error) {
    console.warn("Could not clear auth route cache", error);
  }
}

function requestPublicAuthRoute_(kind, value, options = {}) {
  const normalizedValue = kind === "email"
    ? normalizeEmail(value)
    : normalizePhone(value);
  const forceFresh = options.forceFresh === true;
  const cached = forceFresh ? null : getCachedAuthRoute_(kind, normalizedValue);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const sequence = ++authRouteRequestSequence;
    const callbackName = `__contactsAuthRoute_${Date.now()}_${sequence}`;
    const script = document.createElement("script");
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { delete window[callbackName]; } catch (error) { window[callbackName] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("AUTH_ROUTE_TIMEOUT"));
    }, AUTH_ROUTE_TIMEOUT_MS);

    window[callbackName] = payload => {
      cleanup();
      if (!payload || payload.ok !== true) {
        reject(new Error(payload && payload.message ? payload.message : "AUTH_ROUTE_FAILED"));
        return;
      }
      saveAuthRouteCache_(kind, normalizedValue, payload);
      resolve(payload);
    };

    const params = new URLSearchParams({
      action: "authRoute",
      kind,
      value: normalizedValue,
      client: AUTH_ROUTER_CLIENT,
      callback: callbackName,
      _: String(Date.now())
    });
    if (forceFresh) params.set("fresh", "1");
    script.src = `${AUTH_ROUTER_URL}?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      cleanup();
      reject(new Error("AUTH_ROUTE_NETWORK"));
    };
    document.head.appendChild(script);
  });
}

async function requestPublicAuthRouteWithRetry_(kind, value, options = {}) {
  const maxWaitRetries = 3;

  for (let attempt = 0; attempt <= maxWaitRetries; attempt += 1) {
    const result = await requestPublicAuthRoute_(
      kind,
      value,
      attempt === 0
        ? options
        : { ...options, forceFresh: false }
    );

    if (String(result && result.route || "") !== "WAIT") {
      return result;
    }

    if (attempt === maxWaitRetries) {
      throw new Error("AUTH_ROUTE_BUSY");
    }

    await new Promise(resolve => {
      setTimeout(resolve, 1200 + attempt * 800);
    });
  }

  throw new Error("AUTH_ROUTE_BUSY");
}

function getCachedSupportContact_() {
  try {
    const raw = sessionStorage.getItem(SUPPORT_CONTACT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      !parsed.savedAt ||
      Date.now() - Number(parsed.savedAt) > SUPPORT_CONTACT_CACHE_MS
    ) {
      sessionStorage.removeItem(SUPPORT_CONTACT_CACHE_KEY);
      return null;
    }
    return parsed.payload || null;
  } catch (error) {
    return null;
  }
}

function requestActiveManagerSupportContact_() {
  const cached = getCachedSupportContact_();
  if (cached) return Promise.resolve(cached);
  if (managerSupportContactPromise) return managerSupportContactPromise;

  managerSupportContactPromise = new Promise(resolve => {
    const callbackName = `__contactsSupport_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement("script");
    let finished = false;

    const cleanup = payload => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { delete window[callbackName]; } catch (error) { window[callbackName] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
      managerSupportContactPromise = null;
      resolve(payload || { ok: false });
    };

    const timer = setTimeout(() => cleanup({ ok: false }), 8000);
    window[callbackName] = payload => {
      const safePayload = payload && typeof payload === "object"
        ? payload
        : { ok: false };
      try {
        sessionStorage.setItem(
          SUPPORT_CONTACT_CACHE_KEY,
          JSON.stringify({ savedAt: Date.now(), payload: safePayload })
        );
      } catch (error) {
        // מטמון הוא אופטימיזציה בלבד.
      }
      cleanup(safePayload);
    };

    const params = new URLSearchParams({
      action: "supportContact",
      callback: callbackName,
      _: String(Date.now())
    });
    script.src = `${AUTH_ROUTER_URL}?${params.toString()}`;
    script.async = true;
    script.onerror = () => cleanup({ ok: false });
    document.head.appendChild(script);
  });

  return managerSupportContactPromise;
}

async function updateManagerWhatsappLink_() {
  const link = document.getElementById("managerWhatsappLink");
  const recoveryLink = document.getElementById(
    "passwordRecoveryWhatsappLink"
  );
  const resetSupportLink = document.getElementById(
    "passwordResetSupportLink"
  );
  if (!link && !recoveryLink && !resetSupportLink) return;

  [link, recoveryLink, resetSupportLink].filter(Boolean).forEach(item => {
    item.classList.remove("visible");
    item.removeAttribute("href");
  });
  if (link) link.textContent = "שליחת WhatsApp למנהל הפעיל";
  if (recoveryLink) recoveryLink.textContent = "פנייה למנהל ב־WhatsApp";
  if (resetSupportLink) {
    resetSupportLink.textContent = "פנייה למנהל ב־WhatsApp";
  }

  try {
    const contact = await requestActiveManagerSupportContact_();
    if (
      !contact ||
      contact.ok !== true ||
      !String(contact.whatsappUrl || "").startsWith("https://wa.me/")
    ) {
      return;
    }

    activeManagerSupportName = String(contact.name || "").trim();
    if (link) {
      link.href = contact.whatsappUrl;
      link.textContent = contact.name
        ? `שליחת WhatsApp למנהל הפעיל (${contact.name})`
        : "שליחת WhatsApp למנהל הפעיל";
      link.classList.add("visible");
    }

    if (recoveryLink) {
      const recoveryEmail = normalizeEmail(
        activePasswordRecovery && activePasswordRecovery.email
      );
      const recoveryReference = String(
        activePasswordRecovery &&
        activePasswordRecovery.requestId || ""
      ).slice(-6).toUpperCase();
      const message = recoveryEmail
        ? `שלום, שלחתי באפליקציה בקשה לאיפוס סיסמה עבור ${recoveryEmail}. מזהה הבקשה שלי: ${recoveryReference}. אשמח לעזרה בזיהוי ובאישור הבקשה.`
        : "שלום, שלחתי באפליקציה בקשה לאיפוס סיסמה. אשמח לעזרה בזיהוי ובאישור הבקשה.";
      const separator = contact.whatsappUrl.includes("?") ? "&" : "?";
      recoveryLink.href =
        contact.whatsappUrl +
        separator +
        "text=" +
        encodeURIComponent(message);
      recoveryLink.textContent = contact.name
        ? `פנייה למנהל ב־WhatsApp (${contact.name})`
        : "פנייה למנהל ב־WhatsApp";
      recoveryLink.classList.add("visible");
    }

    if (resetSupportLink) {
      const resetEmail = normalizeEmail(
        document.getElementById("emailInput") &&
        document.getElementById("emailInput").value
      );
      const resetMessage = resetEmail
        ? `שלום, אני זקוק/ה לעזרה בכניסה או באיפוס סיסמה עבור ${resetEmail}.`
        : "שלום, אני זקוק/ה לעזרה בכניסה או באיפוס סיסמה.";
      const separator = contact.whatsappUrl.includes("?") ? "&" : "?";
      resetSupportLink.href =
        contact.whatsappUrl +
        separator +
        "text=" +
        encodeURIComponent(resetMessage);
      resetSupportLink.textContent = contact.name
        ? `פנייה למנהל ב־WhatsApp (${contact.name})`
        : "פנייה למנהל ב־WhatsApp";
      resetSupportLink.classList.add("visible");
    }

    const approvalButton = document.getElementById("manualApprovalRequestBtn");
    if (approvalButton && !approvalButton.disabled && contact.name) {
      approvalButton.textContent =
        `בקשת אישור מנהל (${contact.name})`;
    }
  } catch (error) {
    console.warn("Could not load active manager WhatsApp link", error);
  }
}

function setPasswordResetHelpStatus_(message = "", isError = false) {
  const status = document.getElementById("passwordResetHelpStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("visible", Boolean(message));
  status.style.borderColor = isError ? "#fecdd3" : "#d7ebe1";
  status.style.background = isError ? "#fff1f2" : "#f7fbf9";
  status.style.color = isError ? "#be123c" : "#49685c";
}

function showPasswordRecoveryOptions_() {
  if (authMode === "register") return;
  const entryPanel = document.getElementById("authPasswordEntry");
  const recoveryPanel = document.getElementById("passwordRecoveryOptions");
  if (entryPanel) entryPanel.style.display = "none";
  if (recoveryPanel) recoveryPanel.style.display = "block";
  authStage = "password_recovery_options";
  setLoginStatus("", "");
  setPasswordResetHelpStatus_("", false);
  updateAuthProgress_("password_help");
  const firstAction = document.getElementById("passwordResetBtn");
  setTimeout(() => {
    if (firstAction) firstAction.focus();
  }, 0);
}

function showPasswordLoginOptions_() {
  const entryPanel = document.getElementById("authPasswordEntry");
  const recoveryPanel = document.getElementById("passwordRecoveryOptions");
  if (entryPanel) entryPanel.style.display = "block";
  if (recoveryPanel) recoveryPanel.style.display = "none";
  authStage = "password";
  updateAuthProgress_("password");
  setLoginStatus("", "");
  const passwordInput = document.getElementById("passwordInput");
  setTimeout(() => {
    if (passwordInput) passwordInput.focus();
  }, 0);
}

function setPasswordRecoveryActionsBusy_(busy, activeButtonId = "") {
  ["passwordResetBtn", "passwordResetHelpBtn"].forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.disabled = Boolean(busy);
    button.classList.toggle(
      "authButtonBusy",
      Boolean(busy && buttonId === activeButtonId)
    );
    button.setAttribute(
      "aria-busy",
      String(Boolean(busy && buttonId === activeButtonId))
    );
  });
}

function submitAuthRouterForm_(action, fields, expectedSource) {
  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 16)}`;
  const frameName =
    `authActionFrame_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const iframe = document.createElement("iframe");
  const form = document.createElement("form");

  iframe.name = frameName;
  iframe.style.display = "none";
  form.method = "post";
  form.action = AUTH_ROUTER_URL;
  form.target = frameName;
  form.style.display = "none";

  Object.entries({ action, nonce, ...(fields || {}) }).forEach(
    ([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = String(value === undefined || value === null ? "" : value);
      form.appendChild(input);
    }
  );

  document.body.appendChild(iframe);
  document.body.appendChild(form);

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timeout);
      form.remove();
      iframe.remove();
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onMessage = event => {
      const data = event && event.data;
      if (
        !data ||
        data.source !== expectedSource ||
        data.nonce !== nonce
      ) {
        return;
      }

      if (data.ok === true) {
        finish(resolve, data);
      } else {
        finish(
          reject,
          new Error(data.message || "הפעולה נכשלה.")
        );
      }
    };
    const timeout = setTimeout(() => {
      finish(
        reject,
        new Error("הפעולה נמשכה זמן רב מדי. בדקו את החיבור ונסו שוב.")
      );
    }, 120000);

    window.addEventListener("message", onMessage);
    form.submit();
  });
}

async function invalidatePublicAuthRouteCacheFromAdmin_(email) {
  const normalizedEmail = normalizeEmail(email);
  const currentUser = auth && auth.currentUser;
  if (!normalizedEmail || !currentUser || !currentUserIsAdmin) return;

  clearCachedAuthRoute_("email", normalizedEmail);

  let idToken;
  try {
    idToken = await currentUser.getIdToken(true);
  } catch (refreshError) {
    idToken = await currentUser.getIdToken(false);
  }

  await submitAuthRouterForm_(
    "invalidateAuthRouteCache",
    { idToken, email: normalizedEmail },
    "contacts-auth-cache-invalidation"
  );
}

async function syncAppUserMirrorFromClient_(email = "") {
  const currentUser = auth && auth.currentUser;
  if (!currentUser) return { ok: false };
  let idToken;
  try {
    idToken = await currentUser.getIdToken(true);
  } catch (refreshError) {
    idToken = await currentUser.getIdToken(false);
  }
  return submitAuthRouterForm_(
    "syncAppUserMirror",
    { idToken, email: normalizeEmail(email || currentUser.email) },
    "contacts-app-users-mirror"
  );
}

function requestPasswordResetAssistance_(email) {
  const normalizedEmail = normalizeEmail(email);

  return new Promise((resolve, reject) => {
    const callbackName = `__contactsPasswordHelp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement("script");
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { delete window[callbackName]; } catch (error) { window[callbackName] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("PASSWORD_HELP_TIMEOUT"));
    }, PASSWORD_HELP_TIMEOUT_MS);

    window[callbackName] = payload => {
      cleanup();
      if (!payload || payload.ok !== true) {
        reject(new Error(payload && payload.message ? payload.message : "PASSWORD_HELP_FAILED"));
        return;
      }
      resolve(payload);
    };

    const params = new URLSearchParams({
      action: "passwordResetRequest",
      email: normalizedEmail,
      callback: callbackName,
      _: String(Date.now())
    });
    script.src = `${AUTH_ROUTER_URL}?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      cleanup();
      reject(new Error("PASSWORD_HELP_NETWORK"));
    };
    document.head.appendChild(script);
  });
}

function requestManagerPasswordRecoveryClaim_(email, phone) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  return new Promise((resolve, reject) => {
    const callbackName =
      `__contactsManagerPasswordClaim_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement("script");
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        delete window[callbackName];
      } catch (error) {
        window[callbackName] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("אימות מספר הטלפון נמשך זמן רב מדי. נסו שוב."));
    }, PASSWORD_HELP_TIMEOUT_MS);

    window[callbackName] = payload => {
      cleanup();
      if (!payload || payload.ok !== true) {
        reject(
          new Error(
            payload && payload.message
              ? payload.message
              : "לא ניתן לפתוח את איפוס הסיסמה כרגע."
          )
        );
        return;
      }
      resolve(payload);
    };

    const params = new URLSearchParams({
      action: "claimManagerPasswordReset",
      email: normalizedEmail,
      phone: normalizedPhone,
      callback: callbackName,
      _: String(Date.now())
    });
    script.src = `${AUTH_ROUTER_URL}?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      cleanup();
      reject(new Error("לא ניתן להתחבר לשירות האיפוס כרגע."));
    };
    document.head.appendChild(script);
  });
}

function savePendingPasswordRecovery_(recovery) {
  activePasswordRecovery = recovery && typeof recovery === "object"
    ? { ...recovery }
    : null;
  try {
    if (activePasswordRecovery) {
      localStorage.setItem(
        PENDING_PASSWORD_RECOVERY_STORAGE_KEY,
        JSON.stringify(activePasswordRecovery)
      );
    } else {
      localStorage.removeItem(PENDING_PASSWORD_RECOVERY_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Could not store password recovery state", error);
  }
}

function loadPendingPasswordRecovery_() {
  try {
    const raw = localStorage.getItem(
      PENDING_PASSWORD_RECOVERY_STORAGE_KEY
    );
    const parsed = raw ? JSON.parse(raw) : null;
    if (
      !parsed ||
      !isValidEmail(normalizeEmail(parsed.email)) ||
      !String(parsed.requestId || "") ||
      !String(parsed.recoveryToken || "")
    ) {
      return null;
    }
    return {
      email: normalizeEmail(parsed.email),
      requestId: String(parsed.requestId),
      recoveryToken: String(parsed.recoveryToken),
      createdAt: Number(parsed.createdAt) || Date.now()
    };
  } catch (error) {
    return null;
  }
}

function stopPasswordRecoveryStatusPolling_() {
  if (passwordRecoveryStatusTimer) {
    clearInterval(passwordRecoveryStatusTimer);
  }
  passwordRecoveryStatusTimer = null;
}

function setPasswordRecoveryStatus_(message, type = "") {
  const status = document.getElementById("passwordRecoveryStatus");
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("visible", Boolean(message));
  status.style.borderColor = type === "error" ? "#fecdd3" : "#d7ebe1";
  status.style.background = type === "error" ? "#fff1f2" : "#f7fbf9";
  status.style.color = type === "error" ? "#be123c" : "#49685c";
}

function showPasswordRecoveryPanel_(recovery) {
  if (!recovery) return;
  savePendingPasswordRecovery_(recovery);
  authStage = "password_recovery";
  showLoginScreen();
  setPasswordRecoveryPanelVisible_(true);
  setLoginStatus("", "");

  const email = document.getElementById("passwordRecoveryEmail");
  const reference = document.getElementById(
    "passwordRecoveryReference"
  );
  const title = document.getElementById("passwordRecoveryTitle");
  const lead = document.getElementById("passwordRecoveryLead");
  const waiting = document.getElementById("passwordRecoveryWaiting");
  const form = document.getElementById("passwordRecoveryForm");
  if (title) {
    title.textContent = recovery.managerPrepared === true
      ? "צור סיסמה חדשה"
      : "איפוס סיסמה באישור מנהל";
  }
  if (lead) {
    lead.textContent = recovery.managerPrepared === true
      ? "המנהל אישר את האיפוס. לאחר התאמת מספר הטלפון אפשר לבחור כעת סיסמה חדשה."
      : "הבקשה נשלחה וממתינה לאישור מנהל.";
  }
  if (email) email.textContent = recovery.email;
  if (reference) {
    reference.textContent =
      "מזהה בקשה: " +
      String(recovery.requestId || "").slice(-6).toUpperCase();
  }
  if (waiting) waiting.style.display = "block";
  if (form) form.style.display = "none";
  setPasswordRecoveryStatus_(
    recovery.managerPrepared === true
      ? "אישור המנהל נמצא. פותח את טופס יצירת הסיסמה החדשה..."
      : "הבקשה ממתינה לאישור מנהל. האישור, אם יינתן, יהיה תקף עד 23:59 היום."
  );
  updateManagerWhatsappLink_().catch(error => {
    console.warn("Password recovery support link failed", error);
  });

  stopPasswordRecoveryStatusPolling_();
  checkPasswordRecoveryStatus_().catch(error => {
    console.error("Password recovery status check failed", error);
  });
  passwordRecoveryStatusTimer = setInterval(() => {
    checkPasswordRecoveryStatus_().catch(error => {
      console.error("Password recovery status refresh failed", error);
    });
  }, PASSWORD_RECOVERY_STATUS_INTERVAL_MS);
}

function requestPasswordRecoveryStatus_(recovery) {
  return new Promise((resolve, reject) => {
    const callbackName =
      `__contactsPasswordStatus_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement("script");
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        delete window[callbackName];
      } catch (error) {
        window[callbackName] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("PASSWORD_RECOVERY_STATUS_TIMEOUT"));
    }, AUTH_ROUTE_TIMEOUT_MS);

    window[callbackName] = payload => {
      cleanup();
      if (!payload || payload.ok !== true) {
        reject(
          new Error(
            payload && payload.message
              ? payload.message
              : "PASSWORD_RECOVERY_STATUS_FAILED"
          )
        );
        return;
      }
      resolve(payload);
    };

    const params = new URLSearchParams({
      action: "passwordResetStatus",
      email: recovery.email,
      requestId: recovery.requestId,
      callback: callbackName,
      _: String(Date.now())
    });
    script.src = `${AUTH_ROUTER_URL}?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      cleanup();
      reject(new Error("PASSWORD_RECOVERY_STATUS_NETWORK"));
    };
    document.head.appendChild(script);
  });
}

async function checkPasswordRecoveryStatus_() {
  const recovery = activePasswordRecovery;
  if (!recovery || authStage !== "password_recovery") return;

  const result = await requestPasswordRecoveryStatus_(recovery);
  const status = String(result.status || "missing");
  const waiting = document.getElementById("passwordRecoveryWaiting");
  const form = document.getElementById("passwordRecoveryForm");

  if (status === "approved") {
    stopPasswordRecoveryStatusPolling_();
    if (waiting) waiting.style.display = "none";
    if (form) form.style.display = "block";
    updateAuthProgress_("password_recovery_new");
    setPasswordRecoveryStatus_(
      "המנהל אישר את האיפוס. אפשר לבחור כעת סיסמה חדשה. האישור תקף עד 23:59 היום."
    );
    const input = document.getElementById("recoveryPasswordInput");
    if (input) input.focus();
    return;
  }

  if (status === "pending") {
    setPasswordRecoveryStatus_(
      "הבקשה התקבלה וממתינה לאישור מנהל. המסך יתעדכן אוטומטית."
    );
    return;
  }

  if (status === "consuming") {
    stopPasswordRecoveryStatusPolling_();
    setPasswordRecoveryStatus_(
      "הסיסמה מתעדכנת. אין לשלוח בקשה נוספת."
    );
    return;
  }

  if (status === "used") {
    stopPasswordRecoveryStatusPolling_();
    savePendingPasswordRecovery_(null);
    showAuthEmailStep_({ preserveEmail: true });
    setLoginStatus(
      "הסיסמה עודכנה. אפשר להיכנס עם הסיסמה החדשה.",
      "success"
    );
    return;
  }

  if (["closed", "rejected", "expired", "missing"].includes(status)) {
    stopPasswordRecoveryStatusPolling_();
    const messages = {
      closed: "הבקשה נסגרה על ידי מנהל. אפשר לפנות אליו או לשלוח בקשה חדשה.",
      rejected: "הבקשה נדחתה. אפשר לפנות למנהל לבירור.",
      expired: "האישור פג בחצות. יש לשלוח בקשה חדשה.",
      missing: "הבקשה אינה זמינה עוד. יש לשלוח בקשה חדשה."
    };
    setPasswordRecoveryStatus_(messages[status], "error");
  }
}

function cancelPasswordRecovery_() {
  stopPasswordRecoveryStatusPolling_();
  savePendingPasswordRecovery_(null);
  setPasswordRecoveryPanelVisible_(false);
  showAuthEmailStep_({ preserveEmail: true });
}

async function submitApprovedPasswordRecovery_() {
  const recovery = activePasswordRecovery;
  const password = document.getElementById(
    "recoveryPasswordInput"
  ).value;
  const confirmation = document.getElementById(
    "recoveryPasswordConfirmInput"
  ).value;
  const button = document.getElementById("passwordRecoverySubmitBtn");

  if (!recovery) {
    setPasswordRecoveryStatus_(
      "בקשת האיפוס אינה זמינה. יש לשלוח בקשה חדשה.",
      "error"
    );
    return;
  }
  if (password.length < PASSWORD_RECOVERY_MIN_LENGTH) {
    setPasswordRecoveryStatus_(
      `הסיסמה חייבת להכיל לפחות ${PASSWORD_RECOVERY_MIN_LENGTH} תווים.`,
      "error"
    );
    return;
  }
  if (password !== confirmation) {
    setPasswordRecoveryStatus_("הסיסמאות אינן תואמות.", "error");
    return;
  }

  if (button) button.disabled = true;
  setPasswordRecoveryStatus_("מעדכן את הסיסמה בצורה מאובטחת...");
  try {
    await submitAuthRouterForm_(
      "consumePasswordRecovery",
      {
        email: recovery.email,
        requestId: recovery.requestId,
        recoveryToken: recovery.recoveryToken,
        password
      },
      "contacts-auth-management"
    );
    stopPasswordRecoveryStatusPolling_();
    savePendingPasswordRecovery_(null);
    document.getElementById("recoveryPasswordInput").value = "";
    document.getElementById("recoveryPasswordConfirmInput").value = "";
    setPasswordRecoveryPanelVisible_(false);
    const emailInput = document.getElementById("emailInput");
    if (emailInput) emailInput.value = recovery.email;
    showAuthPasswordStep_(recovery.email, "login");
    setLoginStatus(
      "הסיסמה עודכנה בהצלחה. אפשר להיכנס כעת.",
      "success"
    );
  } catch (error) {
    console.error("Approved password recovery failed", error);
    setPasswordRecoveryStatus_(
      error && error.message
        ? error.message
        : "עדכון הסיסמה נכשל. נסו שוב.",
      "error"
    );
  } finally {
    if (button) button.disabled = false;
  }
}

async function requestPasswordResetHelp_() {
  const email = normalizeEmail(document.getElementById("emailInput").value);
  if (!isValidEmail(email)) {
    setPasswordResetHelpStatus_("הכניסו תחילה כתובת מייל תקינה.", true);
    return;
  }

  const button = document.getElementById("passwordResetHelpBtn");
  let keepRequestDisabled = false;
  setPasswordRecoveryActionsBusy_(true, "passwordResetHelpBtn");
  setPasswordResetHelpStatus_("שולח בקשת עזרה למנהל...", false);

  try {
    const result = await requestPasswordResetAssistance_(email);
    const managerName = String(result.managerName || "").trim();
    if (!result.requestId || !result.recoveryToken) {
      keepRequestDisabled = result.duplicate === true;
      setPasswordResetHelpStatus_(
        result.duplicate
          ? "כבר קיימת בקשת איפוס פעילה למייל הזה. מטעמי אבטחה היא לא הוחלפה. אם זו אינה הבקשה שלך, יש לפנות למנהל כדי לסגור אותה."
          : "הבקשה נקלטה, אך לא נמצאה הרשאת כניסה פעילה עבור המייל הזה. אפשר לפנות למנהל לבירור.",
        true
      );
      updateManagerWhatsappLink_().catch(error => {
        console.warn("Password reset support link failed", error);
      });
      return;
    }

    const recovery = {
      email,
      requestId: String(result.requestId),
      recoveryToken: String(result.recoveryToken),
      createdAt: Date.now(),
      managerName
    };
    showPasswordRecoveryPanel_(recovery);
  } catch (error) {
    console.error("Password reset assistance request failed", error);
    setPasswordResetHelpStatus_(
      "לא הצלחנו לשלוח בקשה למנהל. אפשר להשתמש בקישור האיפוס הרגיל או לנסות שוב.",
      true
    );
    updateManagerWhatsappLink_().catch(linkError => {
      console.warn("Password reset support link failed", linkError);
    });
  } finally {
    setPasswordRecoveryActionsBusy_(false);
    if (button && keepRequestDisabled) {
      button.disabled = true;
      button.textContent = "בקשת איפוס כבר ממתינה לאישור";
    }
  }
}

function setStepButtonBusy_(buttonId, busy, busyText, normalText) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  button.disabled = Boolean(busy);
  button.textContent = busy ? busyText : normalText;
}

async function continueFromEmailStep(options = {}) {
  const input = document.getElementById("emailInput");
  const email = normalizeEmail(input ? input.value : "");

  if (!isValidEmail(email)) {
    setLoginStatus("הכניסו כתובת מייל תקינה.", "error");
    return;
  }

  rememberPendingAuthEmail_(email);
  invalidateEmailAuthFlow_();
  const flowToken = authEmailFlowToken;
  const canUseImmediatePasswordPath = options.returning === true;

  if (canUseImmediatePasswordPath) {
    showAuthPasswordStep_(email, "login", {
      preserveFlow: true,
      returning: true
    });

    // במכשיר שמכיר את המשתמש, הסיסמה זמינה מיד והנתב ממשיך ברקע.
    getEmailAuthRoutePromise_(email, options)
      .then(result =>
        handleBackgroundEmailAuthRoute_(email, result, flowToken)
      )
      .catch(error => {
        // כשל בבדיקת הרקע אינו חוסם כניסה לחשבון Firebase קיים.
        console.warn("Background auth route lookup failed", error);
      });
    return;
  }

  // בזהות שאינה מוכרת למכשיר, הנתב קובע אם להציג סיסמה, טלפון,
  // אישור מנהל או מצב גישה אחר. מצב ההמתנה משקף רק את זמן הבדיקה.
  showAuthRoutingStep_();
  try {
    const result = await getEmailAuthRoutePromise_(email, options);
    if (flowToken !== authEmailFlowToken) return;
    applyResolvedEmailAuthRoute_(email, result, { flowToken });

    if (authStage === "routing") {
      markAuthRouteUnavailable_(email);
      showAuthPasswordStep_(email, "login", {
        preserveFlow: true,
        returning: false
      });
      setLoginStatus(
        "לא הצלחנו לבדוק כרגע את מסלול הכניסה. אפשר לנסות להיכנס או לנסות שוב בעוד רגע.",
        "error"
      );
    }
  } catch (error) {
    if (flowToken !== authEmailFlowToken) return;
    console.warn("Auth route lookup failed", error);
    markAuthRouteUnavailable_(email);
    showAuthPasswordStep_(email, "login", {
      preserveFlow: true,
      returning: false
    });
    setLoginStatus(
      "לא הצלחנו לבדוק כרגע את מסלול הכניסה. אפשר לנסות להיכנס או לנסות שוב בעוד רגע.",
      "error"
    );
  }
}

function isValidPhoneForRouting_(phone) {
  const digits = normalizePhone(phone).replace(/\D/g, "");
  return digits.startsWith("972") && digits.length >= 11 && digits.length <= 12;
}

function showAuthRedirectPanel_(title, message, href, linkText, autoOpen = false) {
  authStage = "redirect";
  if (pendingAuthRedirectTimer) {
    clearTimeout(pendingAuthRedirectTimer);
    pendingAuthRedirectTimer = null;
  }
  setVerificationPanelVisible_(false);
  const form = document.getElementById("authForm");
  if (form) form.style.display = "none";
  setAuthRedirectPanelVisible_(true);

  const titleElement = document.getElementById("authRedirectTitle");
  const messageElement = document.getElementById("authRedirectMessage");
  const link = document.getElementById("authRedirectLink");
  if (titleElement) titleElement.textContent = title;
  if (messageElement) messageElement.textContent = message;
  if (link) {
    link.href = href;
    link.textContent = linkText;
  }
  setLoginStatus("", "");

  if (autoOpen) {
    pendingAuthRedirectTimer = setTimeout(() => {
      window.location.assign(href);
    }, 650);
  }
}

async function continueFromPhoneStep() {
  const input = document.getElementById("phoneInput");
  const phone = normalizePhone(input ? input.value : "");

  if (!isValidPhoneForRouting_(phone)) {
    setLoginStatus("הכניסו מספר טלפון ישראלי תקין.", "error");
    return;
  }

  const isManagerPasswordReset =
    authStage === "password_recovery_claim";
  const phoneInputValue = input ? input.value : "";
  const phoneStepEmail = normalizeEmail(
    isManagerPasswordReset
      ? managerPasswordResetEmail
      : lastUnknownEmail
  );
  const phoneStepPurpose = isManagerPasswordReset
    ? "password_reset"
    : "email_update";
  const phoneButtonLabel = isManagerPasswordReset
    ? "המשך ליצירת סיסמה חדשה"
    : "המשך";
  setStepButtonBusy_(
    "phoneContinueBtn",
    true,
    phoneButtonLabel,
    phoneButtonLabel
  );
  showAuthRoutingStep_();

  try {
    if (isManagerPasswordReset) {
      const email = normalizeEmail(managerPasswordResetEmail);
      const result = await requestManagerPasswordRecoveryClaim_(
        email,
        phone
      );
      if (!result.requestId || !result.recoveryToken) {
        throw new Error(
          "אישור האיפוס אינו זמין עוד. יש לפנות למנהל."
        );
      }

      showPasswordRecoveryPanel_({
        email,
        requestId: String(result.requestId),
        recoveryToken: String(result.recoveryToken),
        createdAt: Date.now(),
        managerPrepared: true
      });
      return;
    }

    const result = await submitAuthRouterForm_(
      "registerAccess",
      {
        email: phoneStepEmail,
        phone,
        website: ""
      },
      "contacts-access-registration"
    );
    const route = String(result.route || "SYSTEM_ERROR");

    if (route === "DETAILS_REQUIRED") {
      showAuthRegistrationDetailsStep_(phoneStepEmail, phone);
      return;
    }

    if (route === "PROVISIONAL_SETUP_READY") {
      authAccountSetupEmail = phoneStepEmail;
      provisionalRegistrationPhone = phone;
      authAccountSetupFallback = false;
      clearCachedAuthRoute_("email", phoneStepEmail);
      showAuthPasswordStep_(phoneStepEmail, "register", {
        preserveFlow: true
      });
      setLoginStatus(
        "נמצאה התאמה לספר אנשי הקשר. בחרו סיסמה כדי להיכנס בגישה זמנית עד לאישור מנהל.",
        "success"
      );
      return;
    }

    if (route === "ACTIVE") {
      clearCachedAuthRoute_("email", phoneStepEmail);
      await continueFromEmailStep({ forceFresh: true });
      return;
    }

    if (route === "PENDING_ADMIN") {
      showAuthNotice_(
        "הבקשה נשלחה למנהל",
        "הבקשה נשמרה ותמתין לבדיקה. לאחר אישור תוכלו לחזור ולבחור סיסמה."
      );
      return;
    }

    showAuthPhoneStep_(phoneStepEmail, phoneStepPurpose);
    const restoredInput = document.getElementById("phoneInput");
    if (restoredInput) restoredInput.value = phoneInputValue;
    setLoginStatus("לא הצלחנו לבדוק את מספר הטלפון כרגע. נסו שוב בעוד רגע.", "error");
  } catch (error) {
    console.error("Phone route lookup failed", error);
    showAuthPhoneStep_(phoneStepEmail, phoneStepPurpose);
    const restoredInput = document.getElementById("phoneInput");
    if (restoredInput) restoredInput.value = phoneInputValue;
    const publicErrorMessage = String(error && error.message || "");
    setLoginStatus(
      publicErrorMessage && !publicErrorMessage.startsWith("AUTH_ROUTE_")
        ? publicErrorMessage
        : "בדיקת מספר הטלפון נכשלה זמנית. בדקו את החיבור ונסו שוב.",
      "error"
    );
  } finally {
    setStepButtonBusy_(
      "phoneContinueBtn",
      false,
      phoneButtonLabel,
      phoneButtonLabel
    );
  }
}

async function useDifferentAccount() {
  authActionInProgress = true;
  try {
    if (auth && auth.currentUser) await firebaseApi.signOut(auth);
  } catch (error) {
    console.error("Could not switch account", error);
  } finally {
    authActionInProgress = false;
  }

  currentUserHasAppAccess = false;
  stopVerificationAccessListener_();
  const emailInput = document.getElementById("emailInput");
  const phoneInput = document.getElementById("phoneInput");
  const passwordInput = document.getElementById("passwordInput");
  const confirmInput = document.getElementById("confirmPasswordInput");
  if (emailInput) emailInput.value = "";
  if (phoneInput) phoneInput.value = "";
  if (passwordInput) passwordInput.value = "";
  if (confirmInput) confirmInput.value = "";
  lastUnknownEmail = "";
  authRouteIsAdmin = false;
  pendingManualApprovalIntentEmail = "";
  pendingManualApprovalIntentHandled = false;
  verificationSuccessUser = null;
  setVerificationSuccessPanelVisible_(false);
  clearPendingAuthEmail_();
  showAuthEmailStep_({ forceEmailEntry: true });
}

function stopVerificationAccessListener_() {
  if (typeof verificationAccessListenerUnsubscribe === "function") {
    verificationAccessListenerUnsubscribe();
  }
  verificationAccessListenerUnsubscribe = null;
}

function setManualApprovalRequestState_(state = "idle", message = "") {
  const button = document.getElementById("manualApprovalRequestBtn");
  const status = document.getElementById("manualApprovalRequestStatus");
  const disclosure = document.querySelector(
    ".verificationHelpDisclosure"
  );
  const disclosureSummary = disclosure
    ? disclosure.querySelector("summary")
    : null;
  const normalizedState = String(state || "idle");
  const managerSuffix = activeManagerSupportName
    ? ` (${activeManagerSupportName})`
    : "";

  if (button) {
    button.disabled = ["pending", "approved", "sending"].includes(normalizedState);
    button.textContent = normalizedState === "pending"
      ? "הבקשה נשלחה וממתינה לאישור מנהל"
      : normalizedState === "approved"
        ? "הגישה אושרה על ידי מנהל"
        : normalizedState === "sending"
          ? "שולח בקשה..."
          : normalizedState === "rejected"
            ? `שליחת בקשה חדשה למנהל${managerSuffix}`
            : `בקשת אישור מנהל${managerSuffix}`;
  }

  if (disclosureSummary) {
    disclosureSummary.textContent = normalizedState === "pending"
      ? "ממתין לאישור מנהל"
      : normalizedState === "approved"
        ? "האישור התקבל"
        : "המייל לא הגיע?";
  }
  if (
    disclosure &&
    ["pending", "approved", "rejected"].includes(normalizedState)
  ) {
    disclosure.open = true;
  }

  if (status) {
    status.textContent = message || "";
    status.classList.toggle("visible", Boolean(message));
  }
}

async function loadOwnVerificationRequestState_() {
  if (!firebaseApi || !db || !auth || !auth.currentUser) return;
  const email = normalizeEmail(auth.currentUser.email);
  if (!email) return;

  try {
    const snapshot = await firebaseApi.getDoc(
      firebaseApi.doc(db, "verificationRequests", email)
    );
    if (!snapshot.exists()) {
      setManualApprovalRequestState_("idle", "");
      return;
    }

    const data = snapshot.data() || {};
    const state = String(data.status || "pending");
    if (state === "pending") {
      setManualApprovalRequestState_(
        "pending",
        "הבקשה התקבלה. אם המסך נשאר פתוח, הכניסה תתבצע אוטומטית לאחר האישור. אם יוצאים, אפשר לחזור ולהתחבר באותו מייל וסיסמה — האישור נשמר."
      );
    } else if (state === "temporary_active") {
      setManualApprovalRequestState_(
        "approved",
        "הגישה אושרה עד 23:59 היום. המערכת מכניסה אותך כעת."
      );
    } else if (state === "approved") {
      setManualApprovalRequestState_(
        "approved",
        "הבקשה אושרה. המערכת בודקת כעת את ההרשאה."
      );
    } else if (state === "rejected" || state === "revoked") {
      setManualApprovalRequestState_(
        "rejected",
        state === "revoked"
          ? "האישור הידני הקודם בוטל. ניתן להשלים אימות מייל או לשלוח בקשה חדשה לפי הצורך."
          : "הבקשה הקודמת נדחתה. ניתן לפנות למנהל ולשלוח בקשה חדשה לפי הצורך."
      );
    } else {
      setManualApprovalRequestState_("idle", "");
    }
  } catch (error) {
    console.error("Could not load verification request state", error);
    setManualApprovalRequestState_("idle", "");
  }
}

function startVerificationAccessListener_(user) {
  stopVerificationAccessListener_();
  const email = normalizeEmail(user && user.email);
  if (!email || !firebaseApi || !db) return;

  verificationAccessListenerUnsubscribe = firebaseApi.onSnapshot(
    firebaseApi.doc(db, "allowedUsers", email),
    snapshot => {
      const data = snapshot.exists() ? snapshot.data() || {} : null;
      if (!data || data.active !== true) return;
      const temporaryAccess = Boolean(
        data.accessReviewRequired === true &&
        !["rejected", "revoked"].includes(
          String(data.accessReviewStatus || "")
        ) &&
        getAdminTimestampMillis_(data.temporaryAccessUntil) > Date.now()
      );
      if (
        (
          data.manualApproved !== true &&
          !temporaryAccess
        ) ||
        verificationAccessTransitionInProgress
      ) {
        return;
      }
      if (!auth || !auth.currentUser || normalizeEmail(auth.currentUser.email) !== email) return;

      verificationAccessTransitionInProgress = true;
      setManualApprovalRequestState_(
        "approved",
        temporaryAccess
          ? "הגישה אושרה עד 23:59. מכניסים אותך לאפליקציה..."
          : "הגישה אושרה על ידי מנהל. מכניסים אותך לאפליקציה..."
      );
      setLoginStatus("האישור התקבל. מכניסים אותך לאפליקציה...", "success");
      handleAuthenticatedUser(auth.currentUser)
        .catch(error => {
          console.error("Manual approval transition failed", error);
          setLoginStatus("האישור התקבל, אך הכניסה נכשלה זמנית. לחצו על ‘כבר אימתתי — המשך’.", "error");
        })
        .finally(() => {
          verificationAccessTransitionInProgress = false;
        });
    },
    error => {
      console.error("Verification approval listener failed", error);
    }
  );
}

async function requestManualApproval_() {
  if (!firebaseApi || !db || !auth || !auth.currentUser) {
    setLoginStatus("החיבור לחשבון הסתיים. התחברו מחדש כדי לשלוח בקשה.", "error");
    return;
  }

  const user = auth.currentUser;
  const email = normalizeEmail(user.email);
  if (!email || user.emailVerified) {
    setLoginStatus("החשבון כבר מאומת או שאינו זמין לבקשה.", "error");
    return;
  }

  setManualApprovalRequestState_("sending", "שולח בקשה למנהל...");

  try {
    const permission = await getCurrentUserPermission(email);
    if (
      !permission.exists ||
      !permission.active ||
      !(await permissionHasActivePhonePair_(permission, email))
    ) {
      setManualApprovalRequestState_("idle", "");
      setLoginStatus(
        "לא נמצאה התאמה פעילה בין כתובת המייל למספר הטלפון הרשום.",
        "error"
      );
      return;
    }

    if (permission.manualApproved) {
      setManualApprovalRequestState_("approved", "הגישה כבר אושרה ידנית. מכניסים אותך לאפליקציה...");
      await handleAuthenticatedUser(user);
      return;
    }

    const now = firebaseApi.serverTimestamp();
    await firebaseApi.setDoc(
      firebaseApi.doc(db, "verificationRequests", email),
      {
        email,
        status: "pending",
        requestedAt: now,
        updatedAt: now,
        handledBy: "",
        handledAt: null
      },
      { merge: false }
    );

    setManualApprovalRequestState_(
      "pending",
      "הבקשה נשלחה למנהל. אם המסך נשאר פתוח, הכניסה תתבצע אוטומטית לאחר האישור. אם יוצאים, אפשר לחזור ולהתחבר באותו מייל וסיסמה."
    );
    setLoginStatus("בקשת האישור נשלחה בהצלחה.", "success");
  } catch (error) {
    console.error("Manual approval request failed", error);
    setManualApprovalRequestState_("idle", "");
    setLoginStatus("לא הצלחנו לשלוח את הבקשה. בדקו את החיבור ונסו שוב.", "error");
  }
}

function showVerificationPanel_(user, email = "") {
  const targetEmail = normalizeEmail(email || (user && user.email) || lastUnverifiedEmail);
  authStage = "verification";
  lastUnverifiedEmail = targetEmail;
  rememberPendingAuthEmail_(targetEmail);
  clearCachedAuthRoute_("email", targetEmail);
  showLoginScreen();
  setVerificationPanelVisible_(true);
  const emailLabel = document.getElementById("verificationEmail");
  if (emailLabel) emailLabel.textContent = targetEmail;
  setManualApprovalRequestState_("idle", "");
  setLoginStatus("", "");
  startVerificationAccessListener_(user || (auth && auth.currentUser));
  updateManagerWhatsappLink_().catch(error => {
    console.warn("Manager support link refresh failed", error);
  });
  loadOwnVerificationRequestState_().catch(error => {
    console.error("Verification request state refresh failed", error);
  });

  if (
    pendingManualApprovalIntentEmail === targetEmail &&
    !pendingManualApprovalIntentHandled
  ) {
    pendingManualApprovalIntentHandled = true;
    setTimeout(() => {
      requestManualApproval_().catch(error => {
        console.error("Automatic manual approval request failed", error);
      });
    }, 350);
  }
}

function openGmailInbox() {
  window.open("https://mail.google.com/", "_blank", "noopener");
}

async function checkVerificationAndContinue() {
  if (!firebaseApi || !auth || !auth.currentUser) {
    setLoginStatus("החיבור לחשבון הסתיים. חזרו למסך הכניסה והתחברו מחדש.", "error");
    return;
  }

  setLoginButtonDisabled(true);
  setLoginStatus("בודק אם כתובת המייל אומתה...", "loading");
  authActionInProgress = true;

  try {
    await firebaseApi.reload(auth.currentUser);
    if (!auth.currentUser.emailVerified) {
      const permission = await getCurrentUserPermission(auth.currentUser.email);
      if (!(permission && permission.active && permission.manualApproved)) {
        setLoginStatus("כתובת המייל עדיין לא אומתה והאישור הידני טרם התקבל.", "error");
        return;
      }
    }

    if (auth.currentUser.emailVerified) {
      showVerificationSuccessPanel_(auth.currentUser);
      return;
    }

    rememberSuccessfulEmail_(auth.currentUser.email);
    setVerificationPanelVisible_(false);
    await handleAuthenticatedUser(auth.currentUser, { skipVerificationSuccess: true });
  } catch (error) {
    console.error("Verification check failed", error);
    setLoginStatus("לא הצלחנו לבדוק את האימות. בדקו את החיבור ונסו שוב.", "error");
  } finally {
    authActionInProgress = false;
    setLoginButtonDisabled(false);
  }
}

// קישור האימות יכול להיפתח בטאב או בדפדפן אחר. כאשר המשתמש חוזר
// לטאב המקורי, מרעננים את משתמש Firebase הפעיל ומכניסים אותו מיד אם
// האימות הושלם. כך לא נשארים במסך סיסמה ישן ולא נדרשת סיסמה נוספת.
async function refreshVerificationSessionAfterReturn_() {
  if (
    verificationReturnCheckInProgress ||
    authActionInProgress ||
    !firebaseApi ||
    !auth ||
    !auth.currentUser
  ) {
    return false;
  }

  const user = auth.currentUser;
  const email = normalizeEmail(user.email || "");
  const pendingEmail = getPendingAuthEmail_();
  if (!email || pendingEmail !== email) return false;

  verificationReturnCheckInProgress = true;
  try {
    await firebaseApi.reload(user);
    if (!user.emailVerified) return false;

    rememberSuccessfulEmail_(email);
    await handleAuthenticatedUser(user, { skipVerificationSuccess: true });
    return true;
  } catch (error) {
    console.warn("Could not refresh verification state after return", error);
    return false;
  } finally {
    verificationReturnCheckInProgress = false;
  }
}

function initVerificationReturnMonitor_() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshVerificationSessionAfterReturn_();
    }
  });
  window.addEventListener("pageshow", () => {
    refreshVerificationSessionAfterReturn_();
  });
}

async function resendVerificationFromPanel() {
  if (!firebaseApi || !auth || !db || !auth.currentUser) {
    setLoginStatus("החיבור לחשבון הסתיים. התחברו מחדש כדי לשלוח אימות.", "error");
    return;
  }

  const user = auth.currentUser;
  const email = normalizeEmail(user.email);
  if (!ensureAuthEmailCooldownFinished("verification", email)) return;

  setLoginStatus("שולח מייל אימות חדש...", "loading");
  try {
    const eligibility = await getEmailEntryEligibility_(email);
    if (!eligibility.allowed) {
      setLoginStatus(
        "לא נמצאה הרשאת כניסה פעילה עבור כתובת המייל ומספר הטלפון.",
        "error"
      );
      return;
    }
    await firebaseApi.sendEmailVerification(user, { url: PASSWORD_AUTH_RETURN_URL });
    startAuthEmailCooldown("verification", email);
    recordOwnAuthState_("verification_sent");
    setLoginStatus("נשלח מייל אימות חדש. חשוב לבדוק גם בתיקיות ספאם ודואר זבל.", "success");
  } catch (error) {
    console.error("Verification resend failed", error);
    setLoginStatus(getAuthErrorMessage(error), "error");
  }
}

async function sendVerificationForSignedInUser_(user, email) {
  const normalizedEmail = normalizeEmail(email || (user && user.email));
  if (!user || !normalizedEmail) return false;
  if (!ensureAuthEmailCooldownFinished("verification", normalizedEmail)) return false;

  const eligibility = await getEmailEntryEligibility_(normalizedEmail);
  if (!eligibility.allowed) {
    throw new Error("PERMISSION_INACTIVE");
  }

  await firebaseApi.sendEmailVerification(user, { url: PASSWORD_AUTH_RETURN_URL });
  startAuthEmailCooldown("verification", normalizedEmail);
  recordOwnAuthState_("verification_sent");
  return true;
}


function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input || !button) return;
  const shouldShow = input.type === "password";
  input.type = shouldShow ? "text" : "password";
  button.textContent = shouldShow ? "הסתר" : "הצג";
  button.setAttribute("aria-label", shouldShow ? "הסתרת הסיסמה" : "הצגת הסיסמה");
}

function getAuthInputs() {
  return {
    email: normalizeEmail(document.getElementById("emailInput").value),
    password: document.getElementById("passwordInput").value,
    confirmPassword: document.getElementById("confirmPasswordInput").value
  };
}

const AUTH_EMAIL_ACTION_COOLDOWN_MS = 60 * 1000;
const AUTH_EMAIL_COOLDOWN_PREFIX = "contacts_auth_email_cooldown_";

function getAuthEmailCooldownKey(action, email) {
  return (
    AUTH_EMAIL_COOLDOWN_PREFIX +
    String(action || "action") +
    "_" +
    normalizeEmail(email)
  );
}

function getAuthEmailCooldownRemaining(action, email) {
  try {
    const key = getAuthEmailCooldownKey(action, email);
    const nextAllowedAt = Number(localStorage.getItem(key) || 0);
    return Math.max(0, nextAllowedAt - Date.now());
  } catch (error) {
    return 0;
  }
}

function startAuthEmailCooldown(action, email) {
  try {
    const key = getAuthEmailCooldownKey(action, email);
    localStorage.setItem(
      key,
      String(Date.now() + AUTH_EMAIL_ACTION_COOLDOWN_MS)
    );
  } catch (error) {
    console.warn("Could not store email cooldown", error);
  }
}

function ensureAuthEmailCooldownFinished(action, email) {
  const remainingMs = getAuthEmailCooldownRemaining(action, email);

  if (remainingMs <= 0) {
    return true;
  }

  const remainingSeconds = Math.ceil(remainingMs / 1000);

  setLoginStatus(
    `כדי למנוע שליחות כפולות, ניתן לנסות שוב בעוד ${remainingSeconds} שניות.`,
    "error"
  );

  return false;
}

async function getCurrentUserPermission(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!db || !firebaseApi || !normalizedEmail) {
    return {
      exists: false,
      active: false,
      phone: "",
      phoneKey: ""
    };
  }

  const permissionSnapshot = await firebaseApi.getDoc(
    firebaseApi.doc(db, "allowedUsers", normalizedEmail)
  );

  if (!permissionSnapshot.exists()) {
    return {
      exists: false,
      active: false,
      phone: "",
      phoneKey: ""
    };
  }

  const data = permissionSnapshot.data() || {};

  return {
    exists: true,
    active: data.active === true,
    phone: normalizePhone(data.phone || ""),
    phoneKey: String(data.phoneKey || ""),
    manualApproved: data.manualApproved === true,
    authState: String(data.authState || ""),
    verificationSentAt: data.verificationSentAt || null,
    lastVerifiedLoginAt: data.lastVerifiedLoginAt || null,
    lastAccessAt: data.lastAccessAt || null,
    manualApprovedAt: data.manualApprovedAt || null,
    manualApprovedBy: normalizeEmail(data.manualApprovedBy || ""),
    manualApprovalReason: String(data.manualApprovalReason || ""),
    accessReviewRequired: data.accessReviewRequired === true,
    accessReviewStatus: String(data.accessReviewStatus || ""),
    accessLevel: String(data.accessLevel || ""),
    provisionalAt: data.provisionalAt || null,
    temporaryAccessUntil: data.temporaryAccessUntil || null,
    temporaryAccessReason: String(data.temporaryAccessReason || ""),
    temporaryAccessGrantedAt: data.temporaryAccessGrantedAt || null,
    temporaryAccessGrantedBy: String(
      data.temporaryAccessGrantedBy || ""
    ),
    permanentApprovedAt: data.permanentApprovedAt || null,
    permanentApprovedBy: normalizeEmail(
      data.permanentApprovedBy || ""
    )
  };
}

function permissionHasProvisionalAccess_(permission) {
  return Boolean(
    permission &&
    permission.active === true &&
    permission.accessReviewRequired === true &&
    permission.accessReviewStatus === "pending" &&
    permission.accessLevel === "provisional"
  );
}

function permissionHasTemporaryAccess_(permission) {
  if (!permission || permission.accessReviewRequired !== true) return false;
  if (
    ["rejected", "revoked"].includes(
      String(permission.accessReviewStatus || "")
    )
  ) {
    return false;
  }
  return getAdminTimestampMillis_(
    permission.temporaryAccessUntil
  ) > Date.now();
}

async function requestTemporaryAccessActivation_(user) {
  if (!user) return { ok: false };

  let idToken;
  try {
    idToken = await user.getIdToken(true);
  } catch (error) {
    idToken = await user.getIdToken(false);
  }

  return await submitAuthRouterForm_(
    "activateTemporaryAccess",
    { idToken },
    "contacts-temporary-access"
  );
}

async function getCurrentUserPhonePermission_(permission, email) {
  const normalizedEmail = normalizeEmail(email);
  const phoneKey = String(permission && permission.phoneKey || "");
  const phone = normalizePhone(permission && permission.phone || "");

  if (!phoneKey || !phone) {
    return {
      exists: false,
      active: false,
      email: "",
      phone: "",
      phoneKey: ""
    };
  }

  const snapshot = await firebaseApi.getDoc(
    firebaseApi.doc(db, ALLOWED_PHONES_COLLECTION_NAME, phoneKey)
  );

  if (!snapshot.exists()) {
    return {
      exists: false,
      active: false,
      email: "",
      phone: "",
      phoneKey
    };
  }

  const data = snapshot.data() || {};
  return {
    exists: true,
    active: data.active === true,
    email: normalizeEmail(data.email || ""),
    phone: normalizePhone(data.phone || ""),
    phoneKey: String(data.phoneKey || snapshot.id)
  };
}

async function permissionHasActivePhonePair_(permission, email) {
  if (!permission || permission.active !== true) return false;

  const normalizedEmail = normalizeEmail(email);
  const phonePermission = await getCurrentUserPhonePermission_(
    permission,
    normalizedEmail
  );

  permission.phonePermission = phonePermission;
  permission.phoneAccess = Boolean(
    phonePermission.exists &&
    phonePermission.active &&
    phonePermission.email === normalizedEmail &&
    phonePermission.phone === permission.phone &&
    phonePermission.phoneKey === permission.phoneKey
  );

  return permission.phoneAccess;
}

async function getEmailEntryEligibility_(email) {
  const normalizedEmail = normalizeEmail(email);
  const emptyPermission = {
    exists: false,
    active: false,
    phone: "",
    phoneKey: ""
  };
  let permission = emptyPermission;
  const signedInEmail = normalizeEmail(
    auth && auth.currentUser && auth.currentUser.email
  );

  // לפני יצירת חשבון Firebase אין למשתמש זהות מאומתת. כללי Firestore
  // במכוון חוסמים קריאה ישירה ל-allowedUsers/allowedPhones במצב זה.
  // לכן בודקים הרשאה דרך נתיב ה-Apps Script הציבורי, שמחזיר מסלול רק
  // כאשר זוג המייל-טלפון הפעיל קיים. אחרי יצירת החשבון אפשר להיעזר גם
  // בקריאה הישירה, כי כעת המשתמש קורא רק את מסמך ההרשאה של עצמו.
  if (signedInEmail === normalizedEmail) {
    try {
      permission = await getCurrentUserPermission(normalizedEmail);
      if (
        permission.exists &&
        permission.active &&
        await permissionHasActivePhonePair_(permission, normalizedEmail)
      ) {
        return { allowed: true, isAdmin: false, permission };
      }
    } catch (error) {
      console.warn("Signed-in permission lookup failed", error);
    }
  }

  try {
    const route = await requestPublicAuthRoute_(
      "email",
      normalizedEmail,
      { forceFresh: true }
    );
    const routeName = String(route && route.route || "");
    const routeAllowsEntry = [
      "PASSWORD",
      "PASSWORD_SETUP",
      "PASSWORD_RESET_READY"
    ].includes(routeName);

    if (routeAllowsEntry) {
      const isAdmin = route && route.admin === true;
      authRouteIsAdmin = isAdmin;
      return { allowed: true, isAdmin, permission };
    }
  } catch (error) {
    console.warn("Server-side entry eligibility lookup failed", error);
  }

  return { allowed: false, isAdmin: false, permission };
}

async function recordOwnAuthState_(state) {
  if (!firebaseApi || !db || !auth || !auth.currentUser) return;
  const user = auth.currentUser;
  const email = normalizeEmail(user.email);
  if (!email) return;

  const normalizedState = String(state || "");
  const telemetryKey = AUTH_STATUS_TELEMETRY_PREFIX + normalizedState + "_" + email;
  if (normalizedState !== "verification_sent") {
    try {
      const lastWrittenAt = Number(localStorage.getItem(telemetryKey) || 0);
      if (lastWrittenAt && Date.now() - lastWrittenAt < AUTH_STATUS_TELEMETRY_INTERVAL_MS) {
        return;
      }
    } catch (error) {
      // Local storage is an optimization only.
    }
  }

  const now = firebaseApi.serverTimestamp();
  let payload = null;

  if (normalizedState === "verification_sent") {
    payload = {
      authState: "verification_sent",
      verificationSentAt: now,
      updatedAt: now
    };
  } else if (normalizedState === "verified") {
    payload = {
      authState: "verified",
      lastVerifiedLoginAt: now,
      lastAccessAt: now,
      updatedAt: now
    };
  } else if (normalizedState === "manual_approved") {
    payload = {
      authState: "manual_approved",
      lastAccessAt: now,
      updatedAt: now
    };
  } else if (normalizedState === "temporary_approved") {
    payload = {
      authState: "temporary_approved",
      lastAccessAt: now,
      updatedAt: now
    };
  } else if (normalizedState === "provisional") {
    payload = {
      authState: "provisional",
      lastAccessAt: now,
      updatedAt: now
    };
  }

  if (!payload) return;

  try {
    await firebaseApi.setDoc(
      firebaseApi.doc(db, "allowedUsers", email),
      payload,
      { merge: true }
    );
    if (normalizedState !== "verification_sent") {
      try {
        localStorage.setItem(telemetryKey, String(Date.now()));
      } catch (error) {
        // Local storage is an optimization only.
      }
    }
  } catch (error) {
    // Telemetry must never block login or verification.
    console.warn("Could not update authentication status", error);
  }
}

async function deleteNewAuthUserSafely(user) {
  if (!user || !firebaseApi || !auth) return;

  try {
    await firebaseApi.deleteUser(user);
  } catch (deleteError) {
    console.error("Could not delete unapproved new user", deleteError);

    try {
      await firebaseApi.signOut(auth);
    } catch (signOutError) {
      console.error("Could not sign out unapproved new user", signOutError);
    }
  }
}

async function applySelectedAuthPersistence() {
  if (!firebaseApi || !auth) return;
  // משתמש שכבר התחבר במכשיר נשאר מחובר עד יציאה יזומה.
  await firebaseApi.setPersistence(auth, firebaseApi.browserLocalPersistence);
}

async function handlePrimaryAuthAction() {
  if (authActionInProgress) return;

  if (authStage === "routing") return;

  if (authStage === "email") {
    await continueFromEmailStep();
    return;
  }

  if (
    authStage === "phone" ||
    authStage === "password_recovery_claim"
  ) {
    await continueFromPhoneStep();
    return;
  }

  if (authStage === "password_recovery_options") {
    return;
  }

  if (authStage === "registration_details") {
    await submitRegistrationDetails_();
    return;
  }

  authActionInProgress = true;
  try {
    await applySelectedAuthPersistence();
  } catch (error) {
    console.error("Could not update authentication persistence", error);
    setLoginStatus("לא הצלחנו לשמור את ההתחברות במכשיר. נסו שוב.", "error");
    return;
  } finally {
    authActionInProgress = false;
  }

  if (authMode === "register") {
    await registerWithPassword();
  } else {
    await loginWithPassword();
  }
}

async function loginOrCreateWithPassword() {
  if (!firebaseApi || !auth || !db) {
    setLoginStatus("המערכת עדיין נטענת. נסו שוב בעוד רגע.", "loading");
    return;
  }

  const { email, password } = getAuthInputs();

  if (!isValidEmail(email)) {
    setLoginStatus("הכניסו כתובת מייל תקינה.", "error");
    return;
  }

  if (!password) {
    setLoginStatus("הכניסו סיסמה.", "error");
    return;
  }

  if (password.length < 6) {
    setLoginStatus("הסיסמה חייבת להכיל לפחות 6 תווים.", "error");
    return;
  }

  setLoginButtonDisabled(true);
  setLoginStatus("בודק את החשבון...", "loading");
  authActionInProgress = true;

  try {
    try {
      const credential = await firebaseApi.signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      if (!credential.user.emailVerified) {
        await firebaseApi.reload(credential.user);
      }

      if (!credential.user.emailVerified) {
        lastUnverifiedEmail = email;
        showVerificationPanel_(credential.user, email);

        try {
          const remaining = getAuthEmailCooldownRemaining(
            "verification",
            email
          );
          if (remaining <= 0) {
            const sent = await sendVerificationForSignedInUser_(
              credential.user,
              email
            );
            if (sent) {
              setLoginStatus(
                "נשלח מייל אימות. חשוב לבדוק גם בתיקיות ספאם ודואר זבל.",
                "success"
              );
            }
          } else {
            setLoginStatus(
              "מייל אימות כבר נשלח לאחרונה. פתחו אותו ולחצו על הקישור.",
              "success"
            );
          }
        } catch (verificationError) {
          console.error(
            "Automatic verification send failed",
            verificationError
          );
          if (
            verificationError &&
            verificationError.message === "PERMISSION_INACTIVE"
          ) {
            await firebaseApi.signOut(auth);
            showAuthEmailStep_({
              forceEmailEntry: true,
              preserveEmail: true
            });
            setLoginStatus(
              "הגישה לכתובת המייל הזו אינה פעילה.",
              "error"
            );
          } else {
            setLoginStatus(
              "החשבון ממתין לאימות. ניתן לשלוח מייל אימות מחדש מהכפתור למטה.",
              "error"
            );
          }
        }
        return;
      }

      rememberSuccessfulEmail_(email);
      await handleAuthenticatedUser(credential.user);
      return;
    } catch (signInError) {
      const code = signInError && signInError.code
        ? signInError.code
        : "";

      const canTryCreate = [
        "auth/invalid-credential",
        "auth/invalid-login-credentials",
        "auth/wrong-password",
        "auth/user-not-found"
      ].includes(code);

      if (!canTryCreate) {
        throw signInError;
      }
    }

    setLoginStatus("בודק אם זו כניסה ראשונה...", "loading");

    let createdUser = null;
    let verificationSent = false;

    try {
      const credential = await firebaseApi.createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      createdUser = credential.user;

      const eligibility = await getEmailEntryEligibility_(email);
      if (!eligibility.allowed) {
        await deleteNewAuthUserSafely(createdUser);
        createdUser = null;
        showAuthEmailStep_({
          forceEmailEntry: true,
          preserveEmail: true
        });
        setLoginStatus(
          "לא נמצאה התאמה פעילה בין המייל למספר הטלפון.",
          "error"
        );
        return;
      }

      auth.languageCode = "he";
      await firebaseApi.sendEmailVerification(createdUser, {
        url: PASSWORD_AUTH_RETURN_URL
      });
      verificationSent = true;
      startAuthEmailCooldown("verification", email);
      recordOwnAuthState_("verification_sent");

      lastUnverifiedEmail = email;
      rememberPendingAuthEmail_(email);
      document.getElementById("passwordInput").value = "";
      document.getElementById("confirmPasswordInput").value = "";
      showVerificationPanel_(createdUser, email);
      setLoginStatus(
        "החשבון נוצר ונשלח מייל אימות. חשוב לבדוק גם בתיקיות ספאם ודואר זבל.",
        "success"
      );
    } catch (createError) {
      if (createdUser && !verificationSent) {
        await deleteNewAuthUserSafely(createdUser);
      }

      const createCode =
        createError && createError.code ? createError.code : "";

      if (createCode === "auth/email-already-in-use") {
        setLoginStatus(
          "הסיסמה אינה נכונה. נסו שוב או השתמשו ב„שכחתי סיסמה”.",
          "error"
        );
        return;
      }

      throw createError;
    }
  } catch (error) {
    console.error("Guided password flow failed", error);
    setLoginStatus(getAuthErrorMessage(error), "error");
  } finally {
    authActionInProgress = false;
    setLoginButtonDisabled(false);
  }
}

async function registerWithPassword() {
  if (!firebaseApi || !auth || !db) {
    setLoginStatus("המערכת עדיין נטענת. נסו שוב בעוד רגע.", "loading");
    return;
  }

  const { email, password, confirmPassword } = getAuthInputs();

  if (!isValidEmail(email)) {
    setLoginStatus("הכניסו כתובת מייל תקינה.", "error");
    return;
  }

  if (
    authPurpose !== "register" ||
    authAccountSetupEmail !== email
  ) {
    // דף ההרשמה יכול להישאר בזיכרון הדפדפן בזמן שהמשתמש פותח
    // את קישור האימות. במקרה כזה החשבון כבר נוצר, ולכן אסור להציג
    // שגיאה או לנסות ליצור אותו פעם שנייה. אם הסשן עדיין קיים, נרענן
    // אותו ונמשיך ישירות; אחרת ננתב למסך הסיסמה הרגיל של החשבון הקיים.
    const currentUser = auth && auth.currentUser;
    if (
      currentUser &&
      normalizeEmail(currentUser.email || "") === email
    ) {
      try {
        await firebaseApi.reload(currentUser);
        if (currentUser.emailVerified) {
          rememberSuccessfulEmail_(email);
          await handleAuthenticatedUser(currentUser, {
            skipVerificationSuccess: true
          });
          return;
        }

        showVerificationPanel_(currentUser, email);
        setLoginStatus(
          "החשבון כבר נוצר. השלימו את אימות המייל כדי להיכנס.",
          "success"
        );
        return;
      } catch (sessionError) {
        console.warn(
          "Could not recover the existing registration session",
          sessionError
        );
      }
    }

    try {
      const route = await requestPublicAuthRoute_("email", email, {
        forceFresh: true
      });
      const routeName = String(route && route.route || "");

      if (routeName === "PASSWORD") {
        showAuthPasswordStep_(email, "login", {
          preserveFlow: true
        });
        setLoginStatus(
          "החשבון כבר נוצר. הזינו את הסיסמה כדי להיכנס.",
          "success"
        );
        return;
      }

      if (routeName === "PASSWORD_SETUP") {
        authAccountSetupEmail = email;
        showAuthPasswordStep_(email, "register", {
          preserveFlow: true
        });
        setLoginStatus(
          "אפשר להמשיך ביצירת החשבון.",
          "success"
        );
        return;
      }
    } catch (routeError) {
      console.warn("Could not recover stale registration route", routeError);
    }

    showAuthEmailStep_({
      forceEmailEntry: true,
      preserveEmail: true
    });
    setLoginStatus(
      "לא הצלחנו לרענן את מצב ההרשמה. נסו שוב בעוד רגע.",
      "error"
    );
    return;
  }

  if (!password) {
    setLoginStatus("הכניסו סיסמה.", "error");
    return;
  }

  if (password.length < 6) {
    setLoginStatus("הסיסמה חייבת להכיל לפחות 6 תווים.", "error");
    return;
  }

  if (password !== confirmPassword) {
    setLoginStatus("הסיסמאות אינן תואמות.", "error");
    return;
  }

  if (!ensureAuthEmailCooldownFinished("verification", email)) {
    return;
  }

  setLoginButtonBusy_(true, "יוצר חשבון...");
  setLoginStatus("בודק הרשאה ויוצר חשבון...", "loading");
  authActionInProgress = true;

  let createdUser = null;
  let verificationSent = false;
  let verificationError = null;

  try {
    let eligibility = null;
    const hasProvisionalRegistration = Boolean(
      provisionalRegistrationPhone &&
      isValidPhoneForRouting_(provisionalRegistrationPhone) &&
      authAccountSetupEmail === email
    );
    if (!authAccountSetupFallback && !hasProvisionalRegistration) {
      eligibility = await getEmailEntryEligibility_(email);

      if (!eligibility.allowed) {
        setLoginStatus(
          "לא נמצאה התאמה פעילה בין המייל למספר הטלפון. חזרו לשלב המייל כדי להמשיך במסלול המתאים.",
          "error"
        );
        return;
      }
    }

    const credential = await firebaseApi.createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    createdUser = credential.user;

    if (hasProvisionalRegistration) {
      try {
        const idToken = await createdUser.getIdToken(true);
        const finalized = await submitAuthRouterForm_(
          "finalizeProvisionalAccess",
          {
            idToken,
            phone: provisionalRegistrationPhone
          },
          "contacts-provisional-access-finalize"
        );
        if (
          String(finalized && finalized.route || "") !==
            "PROVISIONAL_READY"
        ) {
          throw new Error(
            "יצירת ההרשאה הזמנית לא הושלמה. נסו שוב או פנו למנהל."
          );
        }
      } catch (finalizeError) {
        let savedPermission = null;
        try {
          savedPermission = await getCurrentUserPermission(email);
        } catch (permissionError) {
          console.warn(
            "Could not verify provisional authorization after finalize failure",
            permissionError
          );
        }
        if (!permissionHasProvisionalAccess_(savedPermission)) {
          await deleteNewAuthUserSafely(createdUser);
          createdUser = null;
          throw finalizeError;
        }
      }
    }

    // כאשר נתב ההרשאות אינו זמין, אין אפשרות לקרוא הרשאה לפני
    // התחברות. אחרי יצירת חשבון Firebase המשתמשת רשאית לקרוא רק את
    // מסמך ההרשאה של עצמה; לכן אפשר לאמת כאן את אותה התאמה בבטחה.
    if (authAccountSetupFallback) {
      eligibility = await getEmailEntryEligibility_(email);
      if (!eligibility.allowed) {
        await deleteNewAuthUserSafely(createdUser);
        createdUser = null;
        showAuthEmailStep_({
          forceEmailEntry: true,
          preserveEmail: true
        });
        setLoginStatus(
          "לא נמצאה התאמה פעילה בין המייל למספר הטלפון.",
          "error"
        );
        return;
      }
    }

    auth.languageCode = "he";

    try {
      await firebaseApi.sendEmailVerification(createdUser, {
        url: PASSWORD_AUTH_RETURN_URL
      });
      verificationSent = true;
    } catch (error) {
      verificationError = error;
      console.error("Verification email could not be sent", error);
    }

    authAccountSetupEmail = "";
    provisionalRegistrationPhone = "";
    authAccountSetupFallback = false;
    authRouteUnavailableEmail = "";
    clearCachedAuthRoute_("email", email);
    if (verificationSent) {
      startAuthEmailCooldown("verification", email);
      recordOwnAuthState_("verification_sent");
    }

    let permission = null;
    try {
      permission = await getCurrentUserPermission(email);
    } catch (permissionError) {
      console.warn("Could not read new-user permission", permissionError);
    }

    document.getElementById("passwordInput").value = "";
    document.getElementById("confirmPasswordInput").value = "";

    if (permissionHasProvisionalAccess_(permission)) {
      lastUnverifiedEmail = "";
      rememberSuccessfulEmail_(email);
      await handleAuthenticatedUser(createdUser, {
        skipVerificationSuccess: true
      });
      setLoginStatus(
        "החשבון נוצר בגישה זמנית וממתין לאישור מנהל.",
        "success"
      );
      return;
    }

    if (permission && permission.active && permission.manualApproved) {
      lastUnverifiedEmail = "";
      rememberSuccessfulEmail_(email);
      await handleAuthenticatedUser(createdUser);
      setLoginStatus(
        verificationError
          ? "החשבון נוצר והגישה אושרה על ידי מנהל. מייל האימות לא נשלח כרגע; אפשר להיכנס כעת."
          : "החשבון נוצר ונשלח מייל אימות. הגישה אושרה על ידי מנהל ונפתחת כעת.",
        verificationError ? "error" : "success"
      );
      return;
    }

    lastUnverifiedEmail = email;
    showVerificationPanel_(createdUser, email);
    if (verificationError) {
      setLoginStatus(
        "החשבון נוצר, אך מייל האימות לא נשלח. " +
          getAuthErrorMessage(verificationError),
        "error"
      );
    } else {
      setLoginStatus(
        "החשבון נוצר ונשלח מייל אימות. חשוב לבדוק גם בתיקיות ספאם ודואר זבל.",
        "success"
      );
    }
  } catch (error) {
    console.error("Registration failed", error);

    if (createdUser && !verificationSent) {
      // החשבון כבר נוצר, אך שליחת מייל האימות נכשלה. אין למחוק אותו:
      // מחיקה יכולה להיכשל ולהשאיר את המשתמשת במסלול לא עקבי. נשמור
      // את הסשן הלא-מאומת כדי שאפשר יהיה לשלוח את מייל האימות מחדש
      // לאחר שהתקלה בהגדרת Firebase תטופל.
      lastUnverifiedEmail = email;
      document.getElementById("passwordInput").value = "";
      document.getElementById("confirmPasswordInput").value = "";
      showVerificationPanel_(createdUser, email);
      setLoginStatus(
        "החשבון נוצר, אך מייל האימות לא נשלח. " +
          getAuthErrorMessage(error),
        "error"
      );
      return;
    }

    const code = error && error.code ? error.code : "";
    if (code === "auth/email-already-in-use") {
      const input = document.getElementById("emailInput");
      if (input) input.value = email;
      if (authAccountSetupFallback) {
        authAccountSetupFallback = false;
        authAccountSetupEmail = "";
        authRouteUnavailableEmail = "";
        showAuthPasswordStep_(email, "login", { preserveFlow: true });
        setLoginStatus(
          "כבר קיים חשבון לכתובת הזו. הזינו את הסיסמה או בחרו ב„שכחתי סיסמה”.",
          "error"
        );
        return;
      }
      try {
        await continueFromEmailStep({ forceFresh: true });
        setLoginStatus("כבר קיים חשבון לכתובת הזו. המשיכו במסלול שמוצג.", "success");
      } catch (routeError) {
        setLoginStatus("כבר קיים חשבון לכתובת הזו. חזרו לשלב המייל ונסו שוב.", "error");
      }
    } else {
      setLoginStatus(getAuthErrorMessage(error), "error");
    }
  } finally {
    authActionInProgress = false;
    setLoginButtonBusy_(false);
  }
}

async function loginWithPassword() {
  if (!firebaseApi || !auth) {
    setLoginStatus("המערכת עדיין נטענת. נסו שוב בעוד רגע.", "loading");
    return;
  }

  const { email, password } = getAuthInputs();

  if (!isValidEmail(email)) {
    setLoginStatus("הכניסו כתובת מייל תקינה.", "error");
    return;
  }

  if (!password) {
    setLoginStatus("הכניסו סיסמה.", "error");
    return;
  }

  setLoginButtonBusy_(true, "מתחבר...");
  setLoginStatus("מתחבר...", "loading");
  authActionInProgress = true;

  try {
    const credential = await firebaseApi.signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (!credential.user.emailVerified) {
      await firebaseApi.reload(credential.user);
    }

    if (!credential.user.emailVerified) {
      let provisionalPermission = null;
      try {
        provisionalPermission = await getCurrentUserPermission(email);
      } catch (permissionError) {
        console.warn("Provisional permission lookup failed", permissionError);
      }
      if (permissionHasProvisionalAccess_(provisionalPermission)) {
        rememberSuccessfulEmail_(email);
        await handleAuthenticatedUser(credential.user, {
          skipVerificationSuccess: true
        });
        return;
      }

      lastUnverifiedEmail = email;
      showVerificationPanel_(credential.user, email);

      try {
        const remaining = getAuthEmailCooldownRemaining("verification", email);
        if (remaining <= 0) {
          const sent = await sendVerificationForSignedInUser_(credential.user, email);
          if (sent) {
            setLoginStatus("נשלח מייל אימות. חשוב לבדוק גם בתיקיות ספאם ודואר זבל.", "success");
          }
        } else {
          setLoginStatus("מייל אימות כבר נשלח לאחרונה. פתחו אותו ולחצו על הקישור.", "success");
        }
      } catch (verificationError) {
        console.error("Automatic verification send failed", verificationError);
        if (verificationError && verificationError.message === "PERMISSION_INACTIVE") {
          await firebaseApi.signOut(auth);
          showAuthEmailStep_({ forceEmailEntry: true, preserveEmail: true });
          setLoginStatus("הגישה לכתובת המייל הזו אינה פעילה.", "error");
        } else {
          setLoginStatus("החשבון ממתין לאימות. ניתן לשלוח מייל אימות מחדש מהכפתור למטה.", "error");
        }
      }
      return;
    }

    rememberSuccessfulEmail_(email);
    await handleAuthenticatedUser(credential.user);
  } catch (error) {
    console.error("Password sign-in failed", error);
    const code = error && error.code ? error.code : "";
    if (["auth/invalid-credential", "auth/invalid-login-credentials", "auth/wrong-password", "auth/user-not-found"].includes(code)) {
      const flowToken = authEmailFlowToken;
      showAuthRoutingStep_();
      try {
        const result = await getEmailAuthRoutePromise_(email, {
          forceFresh: code === "auth/user-not-found"
        });
        if (
          flowToken === authEmailFlowToken &&
          !(auth && auth.currentUser)
        ) {
          if (String(result && result.route || "") === "SYSTEM_ERROR") {
            markAuthRouteUnavailable_(email);
          }
          const changedState = applyResolvedEmailAuthRoute_(email, result, {
            flowToken,
            afterPasswordFailure: true
          });
          if (!changedState && String(result && result.route) !== "PASSWORD") {
            markAuthRouteUnavailable_(email);
            setLoginStatus(
              "לא הצלחנו לבדוק את מסלול הכניסה. אפשר לנסות שוב או להגדיר סיסמה.",
              "error"
            );
          }
        }
      } catch (routeError) {
        if (flowToken === authEmailFlowToken) {
          markAuthRouteUnavailable_(email);
          showAuthPasswordStep_(email, "login", {
            preserveFlow: true,
            returning: authReturningUser
          });
          setLoginStatus(
            "לא הצלחנו לבדוק את מסלול הכניסה. אפשר לנסות שוב או להגדיר סיסמה.",
            "error"
          );
        }
      }
    } else {
      setLoginStatus(getAuthErrorMessage(error), "error");
    }
  } finally {
    authActionInProgress = false;
    setLoginButtonBusy_(false);
  }
}

async function sendPasswordReset() {
  if (!firebaseApi || !auth) {
    setLoginStatus("המערכת עדיין נטענת. נסו שוב בעוד רגע.", "loading");
    return;
  }

  const email = normalizeEmail(
    document.getElementById("emailInput").value
  );

  if (!isValidEmail(email)) {
    setLoginStatus(
      "הכניסו תחילה את כתובת המייל שעבורה תרצו לקבוע או לאפס סיסמה.",
      "error"
    );
    return;
  }

  if (!ensureAuthEmailCooldownFinished("password-reset", email)) {
    return;
  }

  const resetButton = document.getElementById("passwordResetBtn");
  const resetLabel = resetButton ? resetButton.textContent : "";
  setPasswordRecoveryActionsBusy_(true, "passwordResetBtn");
  if (resetButton) resetButton.textContent = "שולח קישור...";
  setPasswordResetHelpStatus_("שולח קישור לאיפוס סיסמה...", false);

  try {
    auth.languageCode = "he";

    await firebaseApi.sendPasswordResetEmail(auth, email, {
      url: PASSWORD_AUTH_RETURN_URL
    });

    startAuthEmailCooldown("password-reset", email);

    setPasswordResetHelpStatus_(
      "אם קיים חשבון עבור כתובת המייל הזו, נשלח קישור. בדקו גם בספאם ובדואר זבל.",
      false
    );
  } catch (error) {
    console.error("Password reset failed", error);
    setPasswordResetHelpStatus_(getAuthErrorMessage(error), true);
  } finally {
    setPasswordRecoveryActionsBusy_(false);
    if (resetButton) resetButton.textContent = resetLabel;
  }
}

function showLoginScreen() {
  document.getElementById("login").style.display = "block";
  document.getElementById("app").style.display = "none";
}

function updateUserInfoForUser_(user) {
  const normalizedUserEmail = normalizeEmail(user && user.email);
  const matchingContact = contacts.find(
    contact => normalizeEmail(contact.email) === normalizedUserEmail
  );

  const displayIdentity = getAccountDisplayName_(
    normalizedUserEmail,
    matchingContact && matchingContact.name
      ? matchingContact.name
      : normalizedUserEmail
  );

  const userInfoText = document.getElementById("userInfoText");
  if (userInfoText) {
    userInfoText.textContent = "מחובר/ת כ: " + displayIdentity;
  }
}

function getMyProfileContact_() {
  const currentEmail = normalizeEmail(
    auth && auth.currentUser && auth.currentUser.email
  );
  const permissionPhone = normalizePhone(
    currentUserPermissionData && currentUserPermissionData.phone
  );

  return contacts.find(contact =>
    currentEmail &&
    normalizeEmail(contact.email) === currentEmail
  ) || contacts.find(contact =>
    permissionPhone &&
    normalizePhone(contact.phone) === permissionPhone
  ) || null;
}

function setMyProfileStatus_(message = "", type = "") {
  setStatus("myProfileStatus", message, type);
}

function openMyProfileModal() {
  if (!auth || !auth.currentUser || !currentUserHasAppAccess) {
    alert("יש להתחבר לאפליקציה כדי לראות את הפרטים האישיים.");
    return;
  }

  const contact = getMyProfileContact_();
  if (!contact) {
    alert(
      "לא נמצאה רשומת איש קשר המקושרת לחשבון שלך. " +
      "אפשר לשלוח דיווח דרך מנהל המערכת."
    );
    return;
  }

  myProfileContact = contact;

  document.getElementById("myProfileFirstName").value = contact.first || "";
  document.getElementById("myProfileLastName").value = contact.last || "";
  document.getElementById("myProfileTitlePrefix").value = contact.title || "";
  document.getElementById("myProfileRole").value = contact.role || "";
  document.getElementById("myProfileDepartment").value = contact.dept || "";
  document.getElementById("myProfilePhone").value =
    formatPhoneForDisplay(contact.phone || "");
  document.getElementById("myProfileEmail").value =
    normalizeEmail(contact.email || auth.currentUser.email || "");

  const identity = document.getElementById("myProfileIdentity");
  if (identity) {
    identity.innerHTML =
      "<strong>הפרטים שמזהים את החשבון:</strong><br>" +
      escapeHtml(formatPhoneForDisplay(contact.phone || "")) +
      " · " +
      escapeHtml(normalizeEmail(contact.email || auth.currentUser.email || ""));
  }

  setMyProfileStatus_("", "");
  const submitButton = document.getElementById("myProfileSubmitBtn");
  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = "שליחה לאישור מנהל";
  }

  document.getElementById("myProfileModal").classList.add("visible");
  document.body.style.overflow = "hidden";
}

function closeMyProfileModal() {
  const modal = document.getElementById("myProfileModal");
  if (modal) modal.classList.remove("visible");
  document.body.style.overflow = "";
  myProfileContact = null;
  setMyProfileStatus_("", "");
}

async function submitMyProfileUpdate_() {
  if (!myProfileContact || !auth || !auth.currentUser || !currentUserHasAppAccess) {
    setMyProfileStatus_("לא ניתן לשלוח את הבקשה כרגע.", "error");
    return;
  }

  const values = {
    firstName: document.getElementById("myProfileFirstName").value.trim(),
    lastName: document.getElementById("myProfileLastName").value.trim(),
    titlePrefix: document.getElementById("myProfileTitlePrefix").value.trim(),
    role: document.getElementById("myProfileRole").value.trim(),
    department: document.getElementById("myProfileDepartment").value.trim()
  };
  const currentValues = {
    firstName: String(myProfileContact.first || "").trim(),
    lastName: String(myProfileContact.last || "").trim(),
    titlePrefix: String(myProfileContact.title || "").trim(),
    role: String(myProfileContact.role || "").trim(),
    department: String(myProfileContact.dept || "").trim()
  };

  if (!Object.keys(values).some(key => values[key] !== currentValues[key])) {
    setMyProfileStatus_("לא בוצעו שינויים בפרטים.", "empty");
    return;
  }

  const submitButton = document.getElementById("myProfileSubmitBtn");
  submitButton.disabled = true;
  setMyProfileStatus_("שולח את השינויים לאישור מנהל...", "loading");
  const requestId = `self_${String(auth.currentUser.uid || "user")}_${getIsraelDateKey_().replace(/-/g, "")}`;

  try {
    await firebaseApi.setDoc(
      firebaseApi.doc(db, "contactAddRequests", requestId),
      {
        firstName: values.firstName,
        lastName: values.lastName,
        titlePrefix: values.titlePrefix,
        role: values.role,
        department: values.department,
        phone: normalizePhone(myProfileContact.phone || ""),
        email: normalizeEmail(myProfileContact.email || auth.currentUser.email || ""),
        reporterEmail: normalizeEmail(auth.currentUser.email || ""),
        source: "self_profile",
        requestType: "self_update",
        originalContactId: String(myProfileContact.docId || ""),
        originalPhone: normalizePhone(myProfileContact.phone || ""),
        originalEmail: normalizeEmail(myProfileContact.email || auth.currentUser.email || ""),
        status: "pending",
        createdAt: firebaseApi.serverTimestamp(),
        updatedAt: firebaseApi.serverTimestamp(),
        handledAt: null,
        handledBy: "",
        approvedContactId: ""
      },
      { merge: false }
    );

    setMyProfileStatus_("השינויים נשלחו לאישור מנהל. הפרטים יתעדכנו לאחר האישור.", "success");
    submitButton.textContent = "נשלח לאישור";
    setTimeout(closeMyProfileModal, 1800);
  } catch (error) {
    console.error("Self profile update request failed", error);
    const alreadySent = error && ["permission-denied", "firestore/permission-denied"].includes(error.code);
    setMyProfileStatus_(
      alreadySent
        ? "כבר נשלחה היום בקשה לעדכון הפרטים. המנהל יטפל בבקשה הקיימת."
        : "שליחת השינויים נכשלה. בדקו את החיבור ונסו שוב.",
      alreadySent ? "empty" : "error"
    );
    submitButton.disabled = false;
  }
}

function updateAdminEntryVisibility_() {
  const menuButton = document.getElementById("adminOpenBtn");
  if (menuButton) {
    menuButton.classList.toggle("visible", currentUserIsAdmin);
  }

}

function isCurrentUserProvisional_() {
  return permissionHasProvisionalAccess_(currentUserPermissionData);
}

function updateProvisionalAccessUi_() {
  const provisional = isCurrentUserProvisional_();
  const card = document.getElementById("provisionalAccessCard");
  if (card) card.hidden = !provisional;

  ["importAllBtn", "recentContactsBtn", "selectionModeBtn"].forEach(id => {
    const element = document.getElementById(id);
    if (!element) return;
    element.disabled = provisional;
    element.setAttribute("aria-disabled", String(provisional));
    if (provisional) {
      element.title = "זמין לאחר אישור גישה קבועה";
    } else {
      element.removeAttribute("title");
    }
  });
  if (provisional && selectionMode) exitSelectionMode();
}

async function requestPermanentAccessReview_() {
  const user = auth && auth.currentUser;
  const button = document.getElementById("requestPermanentAccessBtn");
  const status = document.getElementById("provisionalAccessStatus");
  const whatsapp = document.getElementById("provisionalAdminWhatsappLink");
  if (!user || !isCurrentUserProvisional_()) return;
  if (button) button.disabled = true;
  if (status) status.textContent = "מעביר את הבקשה למנהל...";
  if (whatsapp) whatsapp.hidden = true;
  try {
    let idToken;
    try {
      idToken = await user.getIdToken(true);
    } catch (refreshError) {
      idToken = await user.getIdToken(false);
    }
    const result = await submitAuthRouterForm_(
      "requestPermanentAccessReview",
      { idToken },
      "contacts-permanent-access-review"
    );
    if (status) status.textContent = "הבקשה הועברה למנהל";
    if (button) button.textContent = "הבקשה הועברה למנהל";
    if (
      whatsapp &&
      String(result.whatsappUrl || "").startsWith("https://wa.me/")
    ) {
      whatsapp.href = result.whatsappUrl;
      whatsapp.hidden = false;
    }
  } catch (error) {
    console.error("Permanent access review request failed", error);
    if (status) status.textContent = error.message || "שליחת הבקשה נכשלה.";
    if (button) button.disabled = false;
  }
}

function showAppForUser(user) {
  closeAllDirectoryMenus_();
  closeContactDetail_();
  closeDepartmentBrowser_();
  closeMonthlyInternsView_();
  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("adminPanel").style.display = "none";
  if (!isQuickFilterActive()) activeQuickFilter = "all";
  directoryBrowseActivated = false;
  selectionMode = false;
  selectedContactIds.clear();
  updateUserInfoForUser_(user);
  updateAdminEntryVisibility_();
  updateProvisionalAccessUi_();
  setLoginStatus("", "");
  renderCurrentSearchResults();
  loadCurrentMonthInterns_().catch(() => {});
}

function isPermissionDeniedError(error) {
  const code = error && error.code ? error.code : "";
  return code === "permission-denied" || code === "firestore/permission-denied";
}

async function finalizePendingReplacedEmailPermissions_(user) {
  const currentEmail = normalizeEmail(user && user.email);

  if (!currentEmail || !user || !user.emailVerified) return;

  try {
    const ownRef = firebaseApi.doc(db, "allowedUsers", currentEmail);
    const ownSnapshot = await firebaseApi.getDoc(ownRef);

    if (!ownSnapshot.exists()) return;

    const ownData = ownSnapshot.data() || {};
    const pendingOldEmails = Array.isArray(ownData.pendingOldEmails)
      ? [
          ...new Set(
            ownData.pendingOldEmails
              .map(normalizeEmail)
              .filter(
                email =>
                  email &&
                  email !== currentEmail
              )
          )
        ]
      : [];

    if (
      ownData.pendingEmailReplacement !== true ||
      !pendingOldEmails.length
    ) {
      return;
    }

    const oldSnapshots = await Promise.all(
      pendingOldEmails.map(email =>
        firebaseApi.getDoc(
          firebaseApi.doc(db, "allowedUsers", email)
        )
      )
    );
    const batch = firebaseApi.writeBatch(db);

    oldSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) return;

      batch.set(
        firebaseApi.doc(db, "allowedUsers", pendingOldEmails[index]),
        {
          active: false,
          source: "replaced-after-verified-login",
          updatedAt: firebaseApi.serverTimestamp()
        },
        { merge: true }
      );
    });

    batch.set(
      ownRef,
      {
        pendingOldEmails: [],
        pendingEmailReplacement: false,
        replacementCompletedAt: firebaseApi.serverTimestamp(),
        updatedAt: firebaseApi.serverTimestamp()
      },
      { merge: true }
    );

    await batch.commit();
  } catch (error) {
    // הכניסה עצמה אינה נחסמת אם סגירת ההרשאה הישנה נכשלה.
    // המידע הממתין נשאר במסמך וינוסה שוב בכניסה הבאה.
    console.error(
      "Could not finalize replaced email permissions",
      error
    );
  }
}

async function handleAuthenticatedUser(user, options = {}) {
  if (!user) {
    currentUserHasAppAccess = false;
    currentUserPermissionData = null;
    contacts = [];
    stopVerificationAccessListener_();
    showLoginScreen();
    return;
  }

  if (!user.emailVerified) {
    await firebaseApi.reload(user);
  }

  const normalizedUserEmail = normalizeEmail(user.email || "");
  const pendingVerificationEmail = getPendingAuthEmail_();
  if (
    user.emailVerified &&
    options.skipVerificationSuccess !== true &&
    pendingVerificationEmail &&
    pendingVerificationEmail === normalizedUserEmail
  ) {
    showLoginScreen();
    showVerificationSuccessPanel_(user);
    return;
  }

  try {
    setLoginStatus("בודק הרשאה...", "loading");

    let permission = null;
    let isAdmin = false;

    if (user.emailVerified) {
      // משתמש מאומת: בדיקת הרשאה ובדיקת מנהל רצות במקביל.
      [permission, isAdmin] = await Promise.all([
        getCurrentUserPermission(user.email),
        detectAdminAccess(user)
      ]);
    } else {
      // משתמש שלא אימת את המייל יכול לקבל גישה זמנית רק אם
      // מייל קודם שלו אומת, או לאחר אישור מפורש של מנהל.
      permission = await getCurrentUserPermission(user.email);
      currentUserIsAdmin = false;
      currentUserIsSuperAdmin = false;
      currentAdminRole = "";
      currentAdminEmail = normalizeEmail(user.email);
      updateAdminEntryVisibility_();
    }

    let accessActivationError = null;
    if (
      !isAdmin &&
      permission &&
      permission.active &&
      permission.accessReviewRequired &&
      !permissionHasProvisionalAccess_(permission) &&
      !permissionHasTemporaryAccess_(permission)
    ) {
      try {
        const activation = await requestTemporaryAccessActivation_(user);
        if (
          activation &&
          (
            activation.temporary === true ||
            activation.permanent === true
          )
        ) {
          permission = await getCurrentUserPermission(user.email);
        }
      } catch (error) {
        console.error("Temporary access activation failed", error);
        accessActivationError = error;
      }
    }

    const hasTemporaryAccess = permissionHasTemporaryAccess_(permission);
    const hasProvisionalAccess = permissionHasProvisionalAccess_(permission);
    if (
      !user.emailVerified &&
      !isAdmin &&
      !(
        permission &&
        permission.active &&
        (
          permission.manualApproved ||
          hasTemporaryAccess ||
          hasProvisionalAccess
        )
      )
    ) {
      currentUserHasAppAccess = false;
      lastUnverifiedEmail = normalizeEmail(user.email);
      showVerificationPanel_(user, user.email);
      return;
    }

    const hasPhoneAccess = permission && permission.active
      ? await permissionHasActivePhonePair_(permission, user.email)
      : false;

    const permissionAllowsAccess = Boolean(
      isAdmin ||
      (
        permission &&
        permission.active &&
        hasPhoneAccess &&
        (
          (
            permission.accessReviewRequired === true &&
            (hasTemporaryAccess || hasProvisionalAccess)
          )
          ||
          (
            permission.accessReviewRequired !== true &&
            (user.emailVerified || permission.manualApproved)
          )
        )
      )
    );

    if (
      !permissionAllowsAccess &&
      accessActivationError &&
      user.emailVerified &&
      permission &&
      permission.active &&
      permission.accessReviewRequired
    ) {
      currentUserHasAppAccess = false;
      showLoginScreen();
      showAccessActivationRetryState_();
      return;
    }

    if (!permissionAllowsAccess) {
      const accessError = new Error(
        permission && permission.active && !hasPhoneAccess
          ? "לא נמצאה התאמה פעילה בין המייל למספר הטלפון."
          : "הגישה לחשבון אינה פעילה."
      );
      accessError.code = "permission-denied";
      throw accessError;
    }

    currentUserPermissionData = permission;
    currentUserHasAppAccess = true;
    updateProvisionalAccessUi_();
    rememberSuccessfulEmail_(user.email);
    setVerificationPanelVisible_(false);

    // עדכון סטטוס ההתחברות הוא כתיבה קטנה שאינה מעכבת את פתיחת האפליקציה.
    recordOwnAuthState_(
      user.emailVerified
        ? "verified"
        : hasProvisionalAccess
          ? "provisional"
        : hasTemporaryAccess
          ? "temporary_approved"
          : "manual_approved"
    );

    if (getPendingContactUseCount_() > 0) {
      scheduleUsageFlush_(USAGE_CONTACT_FLUSH_DELAY_MS);
    }
    recordDailyActiveUser_(user);

    const hasCachedContacts = loadContactsFromCache_();

    if (hasCachedContacts) {
      // מציגים מיד את הנתונים השמורים לאחר בדיקת ההרשאה.
      showAppForUser(user);
      startPermissionListener(user);

      // בדיקת גרסה ועדכון הרשימה מתבצעים ברקע ואינם מעכבים כניסה.
      loadContacts()
        .then(() => {
          updateUserInfoForUser_(user);
          renderCurrentSearchResults();
        })
        .catch(error => {
          console.error("Background contacts refresh failed", error);
          setListStatus(
            "מוצגים אנשי הקשר השמורים במכשיר. בדיקת העדכונים נכשלה זמנית.",
            "empty"
          );
          setTimeout(() => setListStatus("", ""), 5000);
        });
    } else {
      // במכשיר חדש אין עדיין מטמון, ולכן מורידים את העמודים הקטנים במקביל.
      setLoginStatus("טוען אנשי קשר...", "loading");
      await loadContacts();
      showAppForUser(user);
      startPermissionListener(user);
    }

    // פעולות תחזוקה שאינן נחוצות להצגת האפליקציה אינן מעכבות את הכניסה.
    if (user.emailVerified) {
      Promise.resolve()
        .then(() => finalizePendingReplacedEmailPermissions_(user))
        .catch(error => console.error("Email replacement finalization failed", error));
    }
  } catch (error) {
    currentUserHasAppAccess = false;
    currentUserPermissionData = null;
    if (isPermissionDeniedError(error)) {
      await firebaseApi.signOut(auth);
      showLoginScreen();
      setLoginStatus(
        "כתובת המייל אינה מורשית או שהגישה אליה הושבתה. בדקו שהמייל מעודכן בספר אנשי הקשר.",
        "error"
      );
      return;
    }

    showLoginScreen();
    setLoginStatus("שגיאה בטעינת הנתונים. נסו לרענן את הדף.", "error");
  }
}

async function logout() {
  if (!firebaseApi || !auth) return;

  try {
    stopPermissionListener();
    stopVerificationAccessListener_();
    await flushUsageMetrics_().catch(() => {});
    await firebaseApi.signOut(auth);
    currentUserHasAppAccess = false;
    currentUserPermissionData = null;
    contacts = [];
    // ביציאה יזומה מנקים את ספריית אנשי הקשר מהמכשיר המשותף.
    // סגירת הדפדפן או רענון אינם מגיעים לכאן ולכן ממשיכים ליהנות
    // מהמטמון ומהכניסה המהירה באותו מכשיר.
    clearContactsBundleCache_();
    currentUserIsAdmin = false;
    currentUserIsSuperAdmin = false;
    currentAdminRole = "";
    currentAdminEmail = "";
    updateAdminEntryVisibility_();
    document.getElementById("adminPanel").style.display = "none";
    closeRecentContactsModal();
    selectedContactIds.clear();
    currentDisplayedContacts = [];
    selectionMode = false;
    activeQuickFilter = "all";
    directoryBrowseActivated = false;
    resetMonthlyInternsState_();
    resetUserRequestState_();
    closeAllDirectoryMenus_();
    closeContactDetail_();
    closeDepartmentBrowser_();
    closeMonthlyInternsView_();
    updateQuickFilterButtons();
    document.getElementById("list").innerHTML = "";
    showLoginScreen();
    const savedEmail = getSavedLoginEmail_();
    const emailInput = document.getElementById("emailInput");
    if (savedEmail && emailInput) {
      emailInput.value = savedEmail;
      await continueFromEmailStep({ returning: true });
    } else {
      showAuthEmailStep_({ keepStatus: true });
    }
    setLoginStatus("התנתקת מהמערכת. אפשר להתחבר שוב.", "empty");
  } catch (error) {
    console.error(error);
    alert("לא הצלחנו להתנתק. נסו שוב.");
  }
}


function setAdminStatus(message = "", type = "") {
  setStatus("adminStatus", message, type);
}

function setAdminEditStatus(message = "", type = "") {
  setStatus("adminEditStatus", message, type);
}

async function detectAdminAccess(user) {
  currentUserIsAdmin = false;
  currentUserIsSuperAdmin = false;
  currentAdminRole = "";
  currentAdminEmail = normalizeEmail(user && user.email);

  updateAdminEntryVisibility_();

  if (!currentAdminEmail || !firebaseApi || !db) return false;

  try {
    const adminSnapshot = await firebaseApi.getDoc(
      firebaseApi.doc(db, "admins", currentAdminEmail)
    );

    const adminData = adminSnapshot.exists() ? adminSnapshot.data() : null;
    currentAdminRole = String(adminData && adminData.role || "admin");
    currentUserIsAdmin = Boolean(
      adminData && adminData.active === true
    );
    currentUserIsSuperAdmin = Boolean(
      currentUserIsAdmin && currentAdminRole === "super_admin"
    );

    updateAdminEntryVisibility_();

    if (currentUserIsAdmin) {
      loadAdminPendingSummary_().catch(error => {
        console.error("Admin pending summary refresh failed", error);
      });
    } else {
      adminPendingSummary.loaded = false;
      adminPendingSummaryLoadedAt = 0;
      updateAdminPendingBadges_();
    }

    return currentUserIsAdmin;
  } catch (error) {
    console.error("Admin detection failed", error);
    return false;
  }
}

function stopPermissionListener() {
  if (typeof permissionListenerUnsubscribe === "function") {
    permissionListenerUnsubscribe();
  }
  if (typeof phonePermissionListenerUnsubscribe === "function") {
    phonePermissionListenerUnsubscribe();
  }
  permissionListenerUnsubscribe = null;
  phonePermissionListenerUnsubscribe = null;
  if (permissionExpiryTimer) clearTimeout(permissionExpiryTimer);
  permissionExpiryTimer = null;
}

function schedulePermissionExpiryCheck_(email, temporaryAccessUntil) {
  if (permissionExpiryTimer) clearTimeout(permissionExpiryTimer);
  permissionExpiryTimer = null;

  const expiresAt = getAdminTimestampMillis_(temporaryAccessUntil);
  if (!expiresAt) return;
  const delay = Math.max(0, expiresAt - Date.now() + 750);

  permissionExpiryTimer = setTimeout(() => {
    const currentEmail = normalizeEmail(
      auth && auth.currentUser && auth.currentUser.email
    );
    if (currentEmail !== normalizeEmail(email)) return;
    signOutForPermissionLoss_(
      "הגישה הזמנית הסתיימה בחצות. יש להמתין לאישור קבוע של מנהל."
    );
  }, Math.min(delay, 2147483000));
}

function signOutForPermissionLoss_(message) {
  currentUserHasAppAccess = false;
  currentUserPermissionData = null;
  contacts = [];
  document.getElementById("list").innerHTML = "";
  firebaseApi.signOut(auth).catch(() => {});
  showLoginScreen();
  setLoginStatus(message, "error");
}

function startPhonePermissionListener_(email, permission) {
  if (typeof phonePermissionListenerUnsubscribe === "function") {
    phonePermissionListenerUnsubscribe();
    phonePermissionListenerUnsubscribe = null;
  }

  const phoneKey = String(permission && permission.phoneKey || "");
  const phone = normalizePhone(permission && permission.phone || "");
  if (!phoneKey || !phone) {
    signOutForPermissionLoss_(
      "לא נמצאה הרשאת מספר טלפון פעילה עבור החשבון."
    );
    return;
  }

  phonePermissionListenerUnsubscribe = firebaseApi.onSnapshot(
    firebaseApi.doc(db, ALLOWED_PHONES_COLLECTION_NAME, phoneKey),
    snapshot => {
      const data = snapshot.exists() ? snapshot.data() || {} : null;
      const hasAccess = Boolean(
        data &&
        data.active === true &&
        normalizeEmail(data.email || "") === email &&
        normalizePhone(data.phone || "") === phone
      );

      if (!hasAccess) {
        setTimeout(async () => {
          try {
            const refreshedPermission = await getCurrentUserPermission(email);
            const permissionMoved = Boolean(
              refreshedPermission &&
              refreshedPermission.active === true &&
              refreshedPermission.phoneKey &&
              refreshedPermission.phone &&
              (
                refreshedPermission.phoneKey !== phoneKey ||
                normalizePhone(refreshedPermission.phone) !== phone
              )
            );

            if (permissionMoved) {
              currentUserPermissionData = refreshedPermission;
              startPhonePermissionListener_(email, refreshedPermission);
              return;
            }
          } catch (error) {
            console.error("Phone permission refresh failed", error);
          }

          signOutForPermissionLoss_(
            "הרשאת מספר הטלפון של החשבון הוסרה או נחסמה."
          );
        }, 350);
      }
    },
    error => {
      console.error("Phone permission listener failed", error);
    }
  );
}

function startPermissionListener(user) {
  stopPermissionListener();

  const email = normalizeEmail(user && user.email);
  if (!email || !firebaseApi || !db) return;

  if (currentUserIsAdmin) {
    permissionListenerUnsubscribe = firebaseApi.onSnapshot(
      firebaseApi.doc(db, "admins", email),
      snapshot => {
        const data = snapshot.exists() ? snapshot.data() : null;
        const nextRole = String(data && data.role || "admin");
        const nextIsAdmin = Boolean(data && data.active === true);

        currentAdminRole = nextRole;
        currentUserIsAdmin = nextIsAdmin;
        currentUserIsSuperAdmin = Boolean(
          nextIsAdmin && nextRole === "super_admin"
        );

        updateAdminEntryVisibility_();

        if (!currentUserIsAdmin) {
          if (document.getElementById("adminPanel").style.display === "block") {
            closeAdminPanel();
          }

          const signedInUser = auth && auth.currentUser;
          if (signedInUser) {
            handleAuthenticatedUser(signedInUser).catch(error => {
              console.error("Regular-access recheck after admin removal failed", error);
              signOutForPermissionLoss_(
                "הרשאת הניהול הוסרה ולא נמצאה הרשאת משתמש רגילה תקינה."
              );
            });
          } else {
            signOutForPermissionLoss_("הרשאת הניהול הוסרה.");
          }
          return;
        }

        updateAdminTabs();
      },
      error => {
        console.error("Admin permission listener failed", error);
      }
    );

    return;
  }

  permissionListenerUnsubscribe = firebaseApi.onSnapshot(
    firebaseApi.doc(db, "allowedUsers", email),
    snapshot => {
      const data = snapshot.exists() ? snapshot.data() || {} : null;
      const verified = Boolean(
        auth &&
        auth.currentUser &&
        auth.currentUser.emailVerified
      );
      const temporaryAccess = Boolean(
        data &&
        data.accessReviewRequired === true &&
        !["rejected", "revoked"].includes(
          String(data.accessReviewStatus || "")
        ) &&
        getAdminTimestampMillis_(data.temporaryAccessUntil) > Date.now()
      );
      const provisionalAccess = Boolean(
        data &&
        data.active === true &&
        data.accessReviewRequired === true &&
        String(data.accessReviewStatus || "") === "pending" &&
        String(data.accessLevel || "") === "provisional"
      );
      const hasEmailAccess = Boolean(
        data &&
        data.active === true &&
        (
          (
            data.accessReviewRequired === true &&
            (temporaryAccess || provisionalAccess)
          )
          ||
          (
            data.accessReviewRequired !== true &&
            (verified || data.manualApproved === true)
          )
        )
      );

      if (!hasEmailAccess) {
        signOutForPermissionLoss_(
          data && data.active === true
            ? data.accessReviewRequired === true
              ? "הגישה הזמנית הסתיימה או בוטלה. יש להמתין לאישור מנהל."
              : "האישור הידני בוטל. יש להשלים אימות מייל כדי להיכנס מחדש."
            : "הגישה לחשבון נחסמה על ידי מנהל המערכת."
        );
        return;
      }

      currentUserPermissionData = {
        ...(currentUserPermissionData || {}),
        exists: true,
        active: true,
        phone: normalizePhone(data.phone || ""),
        phoneKey: String(data.phoneKey || ""),
        manualApproved: data.manualApproved === true,
        accessReviewRequired: data.accessReviewRequired === true,
        accessReviewStatus: String(data.accessReviewStatus || ""),
        accessLevel: String(data.accessLevel || ""),
        provisionalAt: data.provisionalAt || null,
        temporaryAccessUntil: data.temporaryAccessUntil || null
      };
      updateProvisionalAccessUi_();
      if (temporaryAccess) {
        schedulePermissionExpiryCheck_(
          email,
          data.temporaryAccessUntil
        );
      } else if (permissionExpiryTimer) {
        clearTimeout(permissionExpiryTimer);
        permissionExpiryTimer = null;
      }
      startPhonePermissionListener_(
        email,
        currentUserPermissionData
      );
    },
    error => {
      console.error("Permission listener failed", error);
    }
  );
}

function openAdminPanel() {
  if (!currentUserIsAdmin) {
    alert("אין הרשאת מנהל.");
    return;
  }

  resetAdminDataCache_();
  syncAdminContactsFromDirectory_();
  document.getElementById("app").style.display = "none";
  document.getElementById("adminPanel").style.display = "block";
  document.getElementById("adminSearchInput").value = "";
  adminActiveTab = "attention";
  adminActiveFilter = "all";
  resetAdminVisibleItems_();
  updateAdminTabs();
  loadAdminData({ section: "attention", force: false });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function closeAdminPanel() {
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("app").style.display = "block";
  closeAdminFocusSheet_();
  closeMonthlyInternsAdmin_();
  resolveAdminConfirmation_(false);
  closeAdminEditModal();
  closeManagerModal();
  renderCurrentSearchResults();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function setAdminTab(tabName) {
  const normalizedTab = tabName === "more" ? "system" : tabName;
  const requestedTab = ["attention", "people", "system"].includes(normalizedTab)
    ? normalizedTab
    : "attention";

  adminActiveTab = requestedTab;
  adminActiveFilter = "all";
  document.getElementById("adminSearchInput").value = "";
  resetAdminVisibleItems_();
  updateAdminTabs();
  loadAdminData({ section: requestedTab, force: false });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function getAdminPendingCollectionCount_(collectionName, status) {
  const countQuery = firebaseApi.query(
    firebaseApi.collection(db, collectionName),
    firebaseApi.where("status", "==", status)
  );
  const snapshot = await firebaseApi.getCountFromServer(countQuery);
  const data = snapshot.data() || {};
  return Number(data.count) || 0;
}

async function getAdminActiveCollectionCount_(collectionName, statuses) {
  const uniqueStatuses = [...new Set(
    (Array.isArray(statuses) ? statuses : [statuses]).filter(Boolean)
  )];
  const counts = await Promise.all(
    uniqueStatuses.map(status =>
      getAdminPendingCollectionCount_(collectionName, status)
    )
  );
  return counts.reduce((sum, count) => sum + count, 0);
}

async function loadAdminPendingSummary_(options = {}) {
  if (!currentUserIsAdmin || !firebaseApi || !db) return adminPendingSummary;

  const force = options.force === true;
  if (
    !force &&
    adminPendingSummary.loaded &&
    Date.now() - adminPendingSummaryLoadedAt < ADMIN_PENDING_SUMMARY_CACHE_MS
  ) {
    updateAdminPendingBadges_();
    return adminPendingSummary;
  }

  const countRequests = [
    ["verificationRequests", ["pending", "temporary_active"]],
    [PASSWORD_RESET_REQUESTS_COLLECTION_NAME, ["pending", "approved"]],
    ["contactAddRequests", ["pending"]],
    ["contactReports", ["open"]]
  ];
  const results = await Promise.all(
    countRequests.map(([collectionName, statuses]) =>
      getAdminActiveCollectionCount_(collectionName, statuses)
        .catch(error => {
          console.error(
            `Pending count failed for ${collectionName}`,
            error
          );
          return null;
        })
    )
  );

  const [
    verificationRequests,
    passwordResetRequests,
    contactRequests,
    contactReports
  ] = results;

  adminPendingSummary = {
    verificationRequests: verificationRequests === null
      ? adminPendingSummary.verificationRequests
      : verificationRequests,
    passwordResetRequests: passwordResetRequests === null
      ? adminPendingSummary.passwordResetRequests
      : passwordResetRequests,
    contactRequests: contactRequests === null
      ? adminPendingSummary.contactRequests
      : contactRequests,
    contactReports: contactReports === null
      ? adminPendingSummary.contactReports
      : contactReports,
    loaded: results.some(value => value !== null)
  };
  adminPendingSummaryLoadedAt = adminPendingSummary.loaded
    ? Date.now()
    : 0;
  updateAdminPendingBadges_();
  return adminPendingSummary;
}

function getAdminPendingCounts_() {
  const usersLoaded =
    adminLoadedSections.has("users") ||
    adminLoadedSections.has("attention") ||
    adminLoadedSections.has("people");
  const reportsLoaded =
    adminLoadedSections.has("reports") ||
    adminLoadedSections.has("attention");
  const verificationRequests = usersLoaded
    ? adminAllowedUsers.filter(user => {
        const request = getEffectiveVerificationRequestForUser_(user);
        const accessState = getUserAccessState_(user);
        return Boolean(
          request &&
          ["pending", "temporary_active"].includes(request.status) &&
          ["pending", "temporary", "expired"].includes(accessState.key)
        );
      }).length
    : adminPendingSummary.verificationRequests;
  const passwordResetRequests = usersLoaded
    ? adminPasswordResetRequests.filter(request =>
        (
          request.status === "pending" &&
          (
            !request.requestExpiresAt ||
            getAdminTimestampMillis_(request.requestExpiresAt) > Date.now()
          )
        ) ||
        (
          request.status === "approved" &&
          getAdminTimestampMillis_(request.approvedUntil) > Date.now()
        )
      ).length
    : adminPendingSummary.passwordResetRequests;
  const contactRequests = reportsLoaded
    ? adminContactAddRequests.filter(request => request.status === "pending").length
    : adminPendingSummary.contactRequests;
  const contactReports = reportsLoaded
    ? adminReports.filter(report => report.status === "open").length
    : adminPendingSummary.contactReports;
  // עדכוני "עובד נוסף" ו"מייל הוחלף" הם אירועי מידע ביומן הפעילות,
  // לא בקשות שממתינות לטיפול. רק בקשות אמיתיות נספרות בתג המשימות.
  const notifications = 0;
  const users = verificationRequests + passwordResetRequests;
  const reports = contactRequests + contactReports;

  return {
    verificationRequests,
    passwordResetRequests,
    contactRequests,
    contactReports,
    notifications,
    users,
    reports,
    total: users + reports + notifications,
    loaded:
      adminPendingSummary.loaded ||
      usersLoaded ||
      reportsLoaded
  };
}

function updateAdminPendingBadges_() {
  const counts = getAdminPendingCounts_();
  const attentionBadge = document.getElementById(
    "adminAttentionPendingBadge"
  );
  if (attentionBadge) {
    attentionBadge.hidden = counts.total < 1;
    attentionBadge.textContent =
      counts.total > 99 ? "99+" : String(counts.total);
  }

  const mainBadge = document.getElementById("adminOpenPendingBadge");
  if (mainBadge) {
    mainBadge.hidden = !counts.loaded || counts.total < 1;
    mainBadge.textContent = counts.total > 99
      ? "99+ לטיפול"
      : `${counts.total} לטיפול`;
  }

  const homeCard = document.getElementById("adminPendingHomeCard");
  const homeSummary = document.getElementById("adminPendingHomeSummary");
  const highPriorityCount = adminVerificationRequests.filter(request =>
    request.status === "pending" && request.reviewRequestedNow === true
  ).length;
  if (homeCard) {
    homeCard.hidden = !currentUserIsAdmin || counts.verificationRequests < 1;
  }
  if (homeSummary) {
    homeSummary.textContent = highPriorityCount > 0
      ? `${counts.verificationRequests} ממתינים · ${highPriorityCount} ביקשו טיפול כעת`
      : `${counts.verificationRequests} ממתינים לאישור גישה`;
  }

  const headerBadge = document.getElementById("adminHeaderPendingBadge");
  if (headerBadge) {
    headerBadge.hidden = !counts.loaded || counts.total < 1;
    headerBadge.textContent = counts.total > 99
      ? "99+ לטיפול"
      : `${counts.total} לטיפול`;
  }

  const filterCounts = {
    adminFilterCountAll: counts.total,
    adminFilterCountAccess: counts.verificationRequests,
    adminFilterCountReset: counts.passwordResetRequests,
    adminFilterCountContacts: counts.contactRequests,
    adminFilterCountReports: counts.contactReports
  };
  Object.entries(filterCounts).forEach(([elementId, count]) => {
    const element = document.getElementById(elementId);
    if (element) element.textContent = counts.loaded ? String(count) : "";
  });
}

function updateAdminTabs() {
  const attentionTab = document.getElementById("adminAttentionTab");
  const peopleTab = document.getElementById("adminPeopleTab");
  const systemTab = document.getElementById("adminSystemTab");
  const adminToolbar = document.getElementById("adminToolbar");
  const attentionFilters = document.getElementById(
    "adminAttentionFilters"
  );
  const peopleFilters = document.getElementById("adminPeopleFilters");

  [
    [attentionTab, "attention"],
    [peopleTab, "people"],
    [systemTab, "system"]
  ].forEach(([button, tabName]) => {
    if (!button) return;
    const isActive = adminActiveTab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  if (adminToolbar) {
    adminToolbar.style.display =
      adminActiveTab === "system" ? "none" : "block";
  }

  if (attentionFilters) {
    attentionFilters.style.display =
      adminActiveTab === "attention" ? "flex" : "none";
  }
  if (peopleFilters) {
    peopleFilters.style.display =
      adminActiveTab === "people" ? "flex" : "none";
  }

  const searchInput = document.getElementById("adminSearchInput");
  if (searchInput) {
    const placeholders = {
      attention: "חיפוש בקשה לפי שם, מייל או טלפון",
      people: "שם, מחלקה, מייל או טלפון"
    };
    searchInput.placeholder = placeholders[adminActiveTab] || "חיפוש";
  }

  updateAdminPendingBadges_();
  updateAdminFilterButtons();

  const activeTabButton = document.querySelector(".adminTabBtn.active");
  const adminPanel = document.getElementById("adminPanel");
  if (
    adminPanel &&
    adminPanel.style.display === "block" &&
    activeTabButton &&
    typeof activeTabButton.scrollIntoView === "function"
  ) {
    activeTabButton.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
  }
}

function setAdminFilter(filterName) {
  adminActiveFilter = filterName || "all";
  resetAdminVisibleItems_();
  updateAdminFilterButtons();
  renderAdminList();
}

function handleAdminSearchInput_() {
  resetAdminVisibleItems_();
  renderAdminList();
}

function updateAdminFilterButtons() {
  if (adminActiveTab === "system") return;

  const containerId = adminActiveTab === "attention"
    ? "adminAttentionFilters"
    : "adminPeopleFilters";

  document
    .querySelectorAll(`#${containerId} .adminFilterBtn`)
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.filter === adminActiveFilter
      );
    });
}

function resetAdminVisibleItems_() {
  adminVisibleItemCount = ADMIN_LIST_PAGE_SIZE;
}

function resetAdminDataCache_() {
  adminLoadedSections = new Set();
  adminSectionLoadPromises = new Map();
  adminDataPartLoadPromises = new Map();
  adminDataLoading = false;
  adminRemovedContacts = [];
  adminAllowedUsers = [];
  adminAllowedPhones = [];
  adminManagers = [];
  adminActivity = [];
  adminDailyActiveUsers = [];
  adminPasswordResetRequests = [];
  adminReports = [];
  adminContactAddRequests = [];
  adminVerificationRequests = [];
  adminMonthlyInternsActive = null;
  adminMonthlyInternsPrevious = null;
  updateAdminPendingBadges_();
}

function syncAdminContactsFromDirectory_() {
  adminContacts = contacts.map((contact, index) => ({
    ...contact,
    id: index,
    deleted: false
  }));
}

function renderAdminLoading_(section) {
  const labels = {
    attention: "טוען את הפריטים שממתינים לטיפול...",
    people: "טוען אנשי קשר והרשאות כניסה...",
    system: "טוען פעילות ונתוני מערכת..."
  };
  const summary = document.getElementById("adminSummary");
  if (summary) summary.textContent = "";
  document.getElementById("adminList").innerHTML =
    `<div class="adminLoadingCard">${escapeHtml(labels[section] || "טוען נתונים...")}</div>`;
}

async function loadAdminGeneralData_() {
  const todayKey = getIsraelDateKey_();
  const [activeUsers] = await Promise.all([
    loadDailyActiveUserCounts_([todayKey]),
    loadAdminPendingSummary_({ force: true })
  ]);

  adminDailyActiveUsers = activeUsers;
}

async function loadAdminContactsData_() {
  syncAdminContactsFromDirectory_();
  const overridesSnapshot = await firebaseApi.getDocs(
    firebaseApi.collection(db, "contactOverrides")
  );

  adminRemovedContacts = overridesSnapshot.docs
    .map((document, index) => {
      const data = document.data() || {};
      return {
        ...mapFirestoreContact({ id: document.id, data }, index),
        deleted: data.deleted === true,
        updatedBy: data.updatedBy || ""
      };
    })
    .filter(contact => contact.deleted);
}

async function loadAdminUsersData_() {
  const requests = [
    firebaseApi.getDocs(firebaseApi.collection(db, "allowedUsers")),
    firebaseApi.getDocs(
      firebaseApi.collection(db, ALLOWED_PHONES_COLLECTION_NAME)
    ).catch(error => {
      console.error("Phone permissions data load failed", error);
      return { docs: [] };
    }),
    firebaseApi.getDocs(
      firebaseApi.collection(db, "verificationRequests")
    ).catch(error => {
      console.error("Verification requests load failed", error);
      return { docs: [] };
    }),
    firebaseApi.getDocs(
      firebaseApi.collection(db, PASSWORD_RESET_REQUESTS_COLLECTION_NAME)
    ).catch(error => {
      console.error("Password reset requests load failed", error);
      return { docs: [] };
    })
  ];

  if (currentUserIsSuperAdmin) {
    requests.push(
      firebaseApi.getDocs(firebaseApi.collection(db, "admins"))
    );
  }

  const results = await Promise.all(requests);
  const usersSnapshot = results[0];
  const phonePermissionsSnapshot = results[1] || { docs: [] };
  const verificationRequestsSnapshot = results[2] || { docs: [] };
  const passwordResetRequestsSnapshot = results[3] || { docs: [] };
  const managersSnapshot = results[4] || null;

  adminAllowedPhones = phonePermissionsSnapshot.docs.map(document => {
    const data = document.data() || {};
    return {
      docId: document.id,
      phoneKey: String(data.phoneKey || document.id),
      phone: normalizePhone(data.phone || ""),
      email: normalizeEmail(data.email || ""),
      active: data.active === true,
      source: String(data.source || ""),
      updatedAt: data.updatedAt || null
    };
  });

  adminAllowedUsers = usersSnapshot.docs.map(document => {
    const data = document.data() || {};
    return {
      docId: document.id,
      email: normalizeEmail(data.email || document.id),
      active: data.active === true,
      phone: normalizePhone(data.phone || ""),
      phoneKey: String(data.phoneKey || ""),
      source: String(data.source || ""),
      updatedAt: data.updatedAt || null,
      accessGrantedAt: data.accessGrantedAt || null,
      accessGrantSource: String(data.accessGrantSource || ""),
      authState: String(data.authState || ""),
      verificationSentAt: data.verificationSentAt || null,
      lastVerifiedLoginAt: data.lastVerifiedLoginAt || null,
      lastAccessAt: data.lastAccessAt || null,
      manualApproved: data.manualApproved === true,
      manualApprovedAt: data.manualApprovedAt || null,
      manualApprovedBy: normalizeEmail(data.manualApprovedBy || ""),
      manualApprovalReason: String(data.manualApprovalReason || ""),
      accessReviewRequired: data.accessReviewRequired === true,
      accessReviewStatus: String(data.accessReviewStatus || ""),
      accessLevel: String(data.accessLevel || ""),
      provisionalAt: data.provisionalAt || null,
      temporaryAccessUntil: data.temporaryAccessUntil || null,
      temporaryAccessReason: String(data.temporaryAccessReason || ""),
      temporaryAccessGrantedAt: data.temporaryAccessGrantedAt || null,
      temporaryAccessGrantedBy: String(
        data.temporaryAccessGrantedBy || ""
      ),
      permanentApprovedAt: data.permanentApprovedAt || null,
      permanentApprovedBy: normalizeEmail(
        data.permanentApprovedBy || ""
      )
    };
  }).map(user => {
    const phonePermission = adminAllowedPhones.find(item =>
      item.phoneKey === user.phoneKey
    ) || null;

    return {
      ...user,
      phonePermissionActive: Boolean(
        phonePermission &&
        phonePermission.active &&
        phonePermission.email === user.email &&
        phonePermission.phone === user.phone
      ),
      phonePermission
    };
  });

  adminVerificationRequests = verificationRequestsSnapshot.docs.map(document => {
    const data = document.data() || {};
    return {
      docId: document.id,
      email: normalizeEmail(data.email || document.id),
      status: [
        "pending",
        "temporary_active",
        "approved",
        "rejected",
        "revoked"
      ].includes(data.status)
        ? data.status
        : "pending",
      requestType: String(data.requestType || "manual_verification"),
      phone: normalizePhone(data.phone || ""),
      name: String(data.name || ""),
      role: String(data.role || ""),
      department: String(data.department || ""),
      contactId: String(data.contactId || ""),
      provisional: data.provisional === true,
      provisionalAt: data.provisionalAt || null,
      reviewRequestedNow: data.reviewRequestedNow === true,
      reviewRequestedAt: data.reviewRequestedAt || null,
      priority: String(data.priority || "normal"),
      automaticReason: String(data.automaticReason || ""),
      temporaryAccessUntil: data.temporaryAccessUntil || null,
      requestedAt: data.requestedAt || null,
      requestExpiresAt: data.requestExpiresAt || null,
      updatedAt: data.updatedAt || null,
      handledAt: data.handledAt || null,
      handledBy: normalizeEmail(data.handledBy || "")
    };
  });

  adminPasswordResetRequests = passwordResetRequestsSnapshot.docs.map(document => {
    const data = document.data() || {};
    return {
      docId: document.id,
      email: normalizeEmail(data.email || document.id),
      status: [
        "pending",
        "manager_ready",
        "approved",
        "consuming",
        "used",
        "expired",
        "sent",
        "closed",
        "rejected"
      ].includes(data.status)
        ? data.status
        : "pending",
      requestId: String(data.requestId || ""),
      requestedAt: data.requestedAt || null,
      requestExpiresAt: data.requestExpiresAt || null,
      updatedAt: data.updatedAt || null,
      handledAt: data.handledAt || null,
      handledBy: normalizeEmail(data.handledBy || ""),
      sentAt: data.sentAt || null,
      approvedAt: data.approvedAt || null,
      approvedUntil: data.approvedUntil || null,
      preparedAt: data.preparedAt || null,
      claimedAt: data.claimedAt || null,
      consumedAt: data.consumedAt || null
    };
  });

  if (managersSnapshot) {
    adminManagers = mapAdminManagersSnapshot_(managersSnapshot);
    adminLoadedSections.add("managers");
  }
}

async function loadAdminActivityData_() {
  const activityQuery = firebaseApi.query(
    firebaseApi.collection(db, "admin_actions"),
    firebaseApi.orderBy("timestamp", "desc"),
    // ההתראות בדף הניהול מציגות פעילות רלוונטית מהשבוע האחרון.
    firebaseApi.limit(30)
  );
  const activitySnapshot = await firebaseApi.getDocs(activityQuery);
  const recordedActivity = activitySnapshot.docs.map(document => {
    const data = document.data() || {};
    return {
      docId: document.id,
      ...data
    };
  });

  syncAdminContactsFromDirectory_();
  adminActivity = mergeActivityWithDetectedContacts(
    recordedActivity,
    adminContacts
  );
}

async function loadAdminInternsData_() {
  const [activeSnapshot, previousSnapshot] = await Promise.all([
    firebaseApi.getDoc(
      firebaseApi.doc(
        db,
        MONTHLY_INTERNS_COLLECTION_NAME,
        MONTHLY_INTERNS_ACTIVE_DOCUMENT_ID
      )
    ).catch(error => {
      console.warn("Active monthly interns data could not be loaded", error);
      return null;
    }),
    firebaseApi.getDoc(
      firebaseApi.doc(
        db,
        MONTHLY_INTERNS_COLLECTION_NAME,
        MONTHLY_INTERNS_PREVIOUS_DOCUMENT_ID
      )
    ).catch(error => {
      console.warn("Previous monthly interns data could not be loaded", error);
      return null;
    })
  ]);
  adminMonthlyInternsActive = activeSnapshot && activeSnapshot.exists()
    ? activeSnapshot.data() || null
    : null;
  adminMonthlyInternsPrevious = previousSnapshot && previousSnapshot.exists()
    ? previousSnapshot.data() || null
    : null;
}

async function loadAdminReportsData_() {
  const reportsQuery = firebaseApi.query(
    firebaseApi.collection(db, "contactReports"),
    firebaseApi.orderBy("createdAt", "desc"),
    firebaseApi.limit(150)
  );
  const contactAddRequestsQuery = firebaseApi.query(
    firebaseApi.collection(db, "contactAddRequests"),
    firebaseApi.orderBy("createdAt", "desc"),
    firebaseApi.limit(150)
  );

  const [reportsSnapshot, contactAddRequestsSnapshot] = await Promise.all([
    firebaseApi.getDocs(reportsQuery).catch(error => {
      console.error("Reports data load failed", error);
      return { docs: [] };
    }),
    firebaseApi.getDocs(contactAddRequestsQuery).catch(error => {
      console.error("Contact addition requests load failed", error);
      return { docs: [] };
    })
  ]);

  adminReports = reportsSnapshot.docs.map(document => {
    const data = document.data() || {};
    return {
      docId: document.id,
      subjectType: data.subjectType === "intern" ? "intern" : "contact",
      internId: String(data.internId || ""),
      internVersion: String(data.internVersion || ""),
      internDepartment: String(data.internDepartment || ""),
      contactDocId: String(data.contactDocId || ""),
      contactPhone: String(data.contactPhone || ""),
      contactName: String(data.contactName || ""),
      issueType: String(data.issueType || "other"),
      details: String(data.details || ""),
      reporterEmail: normalizeEmail(data.reporterEmail || ""),
      status: data.status === "resolved" ? "resolved" : "open",
      createdAt: data.createdAt || null,
      resolvedAt: data.resolvedAt || null,
      resolvedBy: normalizeEmail(data.resolvedBy || "")
    };
  });

  adminContactAddRequests = contactAddRequestsSnapshot.docs.map(document => {
    const data = document.data() || {};
    return {
      docId: document.id,
      firstName: String(data.firstName || ""),
      lastName: String(data.lastName || ""),
      titlePrefix: String(data.titlePrefix || ""),
      role: String(data.role || ""),
      department: String(data.department || ""),
      phone: String(data.phone || ""),
      email: normalizeEmail(data.email || ""),
      reporterEmail: normalizeEmail(data.reporterEmail || ""),
      source: ["device_picker", "self_profile", "contact_detail", "google_form"].includes(data.source)
        ? data.source
        : "manual",
      requestType: ["self_update", "contact_update"].includes(data.requestType)
        ? data.requestType
        : "contact_add",
      originalContactId: String(data.originalContactId || ""),
      originalPhone: normalizePhone(data.originalPhone || ""),
      originalEmail: normalizeEmail(data.originalEmail || ""),
      status: ["pending", "approved", "rejected"].includes(data.status)
        ? data.status
        : "pending",
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
      handledAt: data.handledAt || null,
      handledBy: normalizeEmail(data.handledBy || ""),
      approvedContactId: String(data.approvedContactId || ""),
      grantAccessOnApproval: data.grantAccessOnApproval === true,
      accessApprovalReason: String(data.accessApprovalReason || "")
    };
  });
}

function mapAdminManagersSnapshot_(snapshot) {
  return snapshot.docs.map(document => {
    const data = document.data() || {};
    return {
      docId: document.id,
      email: normalizeEmail(data.email || document.id),
      active: data.active === true,
      role: data.role === "super_admin" ? "super_admin" : "admin",
      createdBy: normalizeEmail(data.createdBy || ""),
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null
    };
  });
}

async function loadAdminManagersData_() {
  if (!currentUserIsSuperAdmin) {
    adminManagers = [];
    return;
  }

  const managersSnapshot = await firebaseApi.getDocs(
    firebaseApi.collection(db, "admins")
  );
  adminManagers = mapAdminManagersSnapshot_(managersSnapshot);
}

async function loadAdminDataPart_(section, loader) {
  if (adminLoadedSections.has(section)) return;
  if (adminDataPartLoadPromises.has(section)) {
    await adminDataPartLoadPromises.get(section);
    return;
  }

  const loadPromise = (async () => {
    await loader();
    adminLoadedSections.add(section);
  })();
  adminDataPartLoadPromises.set(section, loadPromise);

  try {
    await loadPromise;
  } finally {
    adminDataPartLoadPromises.delete(section);
  }
}

async function loadAdminAttentionData_() {
  await Promise.all([
    loadAdminDataPart_("users", loadAdminUsersData_),
    loadAdminDataPart_("reports", loadAdminReportsData_),
    // התראות על הוספת עובד או שינוי מייל נשמרות ביומן הפעילות הקיים.
    loadAdminDataPart_("activity", loadAdminActivityData_)
  ]);
}

async function loadAdminPeopleData_() {
  await Promise.all([
    loadAdminDataPart_("contacts", loadAdminContactsData_),
    loadAdminDataPart_("users", loadAdminUsersData_)
  ]);
}

async function loadAdminSystemData_() {
  const loaders = [
    loadAdminDataPart_("general", loadAdminGeneralData_),
    loadAdminDataPart_("activity", loadAdminActivityData_),
    loadAdminDataPart_("interns", loadAdminInternsData_)
  ];

  if (currentUserIsSuperAdmin) {
    loaders.push(
      loadAdminDataPart_("managers", loadAdminManagersData_)
    );
  }

  await Promise.all(loaders);
}

function getAdminCompositeParts_(section) {
  return {
    attention: ["users", "reports"],
    people: ["contacts", "users"],
    system: currentUserIsSuperAdmin
      ? ["general", "activity", "interns", "managers"]
      : ["general", "activity", "interns"]
  }[section] || [];
}

function getAdminSectionLoader_(section) {
  return {
    attention: loadAdminAttentionData_,
    people: loadAdminPeopleData_,
    system: loadAdminSystemData_
  }[section] || loadAdminAttentionData_;
}

async function loadAdminData(options = null) {
  if (!currentUserIsAdmin) return;

  const explicitOptions = options && typeof options === "object";
  const section = explicitOptions && options.section
    ? options.section
    : adminActiveTab;
  let force = explicitOptions ? options.force === true : true;

  if (!explicitOptions) {
    adminLoadedSections = new Set();
    adminDataPartLoadPromises = new Map();
    force = true;
  }

  if (force) {
    adminLoadedSections.delete(section);
    getAdminCompositeParts_(section).forEach(part => {
      adminLoadedSections.delete(part);
    });
  }

  if (adminLoadedSections.has(section)) {
    if (adminActiveTab === section) {
      setAdminStatus("", "");
      renderAdminList();
    }
    return;
  }

  if (adminSectionLoadPromises.has(section)) {
    await adminSectionLoadPromises.get(section);
    return;
  }

  if (adminActiveTab === section) {
    setAdminStatus("", "");
    renderAdminLoading_(section);
  }

  const loadPromise = (async () => {
    await getAdminSectionLoader_(section)();
    adminLoadedSections.add(section);
    updateAdminPendingBadges_();
    if (adminActiveTab === section) {
      setAdminStatus("", "");
      renderAdminList();
    }
  })();

  adminSectionLoadPromises.set(section, loadPromise);
  adminDataLoading = true;

  try {
    await loadPromise;
  } catch (error) {
    console.error("Admin data load failed", error);
    if (adminActiveTab === section) {
      setAdminStatus(
        "לא הצלחנו לטעון את הנתונים בלשונית הזו. נסו לרענן.",
        "error"
      );
      document.getElementById("adminList").innerHTML =
        '<div class="adminEmpty">טעינת הנתונים נכשלה.</div>';
    }
  } finally {
    adminSectionLoadPromises.delete(section);
    adminDataLoading = adminSectionLoadPromises.size > 0;
  }
}

function getAdminSearchQuery() {
  const input = document.getElementById("adminSearchInput");
  return normalizeSearchText(input ? input.value : "");
}

function adminContactMatchesQuery(contact, query) {
  if (!query) return true;

  const searchable = normalizeSearchText([
    contact.title,
    contact.first,
    contact.last,
    contact.firstEn,
    contact.lastEn,
    contact.role,
    contact.dept,
    contact.hospital,
    contact.phone,
    formatPhoneForDisplay(contact.phone),
    contact.email
  ].filter(Boolean).join(" "));

  return searchable.includes(query);
}

function adminUserMatchesQuery(user, query) {
  if (!query) return true;

  const contact = findContactByEmail(user.email);
  const accessState = getUserAccessState_(user);
  const searchable = normalizeSearchText([
    user.email,
    accessState.label,
    accessState.note,
    user.source,
    user.phone,
    contact ? contact.name : "",
    contact ? contact.phone : "",
    contact ? contact.dept : ""
  ].filter(Boolean).join(" "));

  return searchable.includes(query);
}

function adminManagerMatchesQuery(manager, query) {
  if (!query) return true;

  const contact = findContactByEmail(manager.email);
  const searchable = normalizeSearchText([
    manager.email,
    manager.role,
    manager.createdBy,
    contact ? contact.name : "",
    contact ? contact.phone : "",
    contact ? contact.dept : ""
  ].filter(Boolean).join(" "));

  return searchable.includes(query);
}


function getDetectedContactActivityTimestamp(contact) {
  const date = getContactCreationDate(contact);
  return date ? date.getTime() : 0;
}

function getActivityTargetKey(activity) {
  const phone = normalizePhone(activity && activity.targetPhone || "");
  const email = normalizeEmail(activity && activity.targetEmail || "");
  const timestamp = getActivityTimestamp(activity);
  const day = timestamp ? new Date(timestamp).toISOString().slice(0, 10) : "";
  return `${phone || email}|${day}`;
}

function mergeActivityWithDetectedContacts(activityItems, contactItems) {
  const actualActivities = Array.isArray(activityItems) ? activityItems : [];
  const additionKeys = new Set(actualActivities.filter(item => ["worker_added", "contact_add_form", "form_submission", "contact_add_detected"].includes(item.action)).map(getActivityTargetKey).filter(key => key !== "|"));
  const detectedActivities = (Array.isArray(contactItems) ? contactItems : []).map(contact => {
    const timestamp = getDetectedContactActivityTimestamp(contact);
    if (!timestamp) return null;
    return {
      docId: `detected-${contact.docId || contact.phone}`,
      action: "contact_add_detected",
      targetId: contact.docId || "",
      targetEmail: contact.email || "",
      targetPhone: contact.phone || "",
      displayName: contact.name || "",
      actorEmail: "",
      source: contact.source || "contacts-sync",
      timestamp: new Date(timestamp).toISOString(),
      detectedFromContact: true
    };
  }).filter(Boolean).filter(item => !additionKeys.has(getActivityTargetKey(item)));
  return [...actualActivities, ...detectedActivities].sort((a, b) => getActivityTimestamp(b) - getActivityTimestamp(a));
}

function getActivityTimestamp(activity) {
  const value = activity && activity.timestamp;

  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatActivityTimestamp(activity) {
  const timestamp = getActivityTimestamp(activity);
  if (!timestamp) return "מועד לא ידוע";

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function getActivityCategory(action) {
  if (["worker_added", "contact_add_form", "form_submission", "contact_add_detected", "contact_add_request_approved", "form_access_request_approved", "access_auto_granted", "manager_add"].includes(action)) {
    return "added";
  }

  if (["contact_remove", "manager_remove", "permission_delete"].includes(action)) {
    return "removed";
  }

  return "changed";
}

function getActivityTitle(activity) {
  const labels = {
    worker_added: "עובד חדש נוסף",
    worker_details_updated: "פרטי עובד עודכנו",
    worker_email_changed: "כתובת המייל של עובד שונתה",
    contact_add_form: "נשלח טופס הצטרפות חדש",
    form_submission: "נשלח טופס הצטרפות",
    contact_add_detected: "איש קשר נוסף למערכת",
    contact_add_request_approved: "בקשת הוספת איש קשר אושרה",
    contact_update_request_approved: "בקשת עדכון איש קשר אושרה",
    form_access_request_approved: "בקשת הצטרפות וגישה אושרה",
    form_access_pending_admin: "בקשת הצטרפות ממתינה למנהל",
    contact_add_request_rejected: "בקשת הוספת איש קשר נדחתה",
    contact_update_request_rejected: "בקשת עדכון איש קשר נדחתה",
    self_profile_update_approved: "עדכון פרטים אישיים אושר",
    self_profile_update_rejected: "עדכון פרטים אישיים נדחה",
    email_self_update: "כתובת מייל עודכנה",
    contact_edit: "פרטי איש קשר נערכו",
    contact_remove: "איש קשר הוסר מהאפליקציה",
    contact_restore: "איש קשר הוחזר לאפליקציה",
    user_block: "גישה נחסמה",
    user_unblock: "גישה הוחזרה",
    permission_delete: "הרשאת כניסה נמחקה",
    manager_add: "מנהל נוסף",
    manager_remove: "מנהל הוסר",
    manager_enable: "מנהל הופעל",
    manager_disable: "מנהל הושבת",
    access_auto_granted: "הרשאת כניסה נוצרה וממתינה לבדיקה",
    temporary_access_automatic: "גישה זמנית אושרה אוטומטית עד 23:59",
    manual_approval_grant: "גישה אושרה ידנית",
    manual_approval_reject: "בקשת אישור נדחתה",
    manual_approval_revoke: "אישור ידני בוטל",
    monthly_interns_publish: "רשימת הסטאז׳רים פורסמה",
    monthly_interns_rollback: "רשימת הסטאז׳רים הקודמת שוחזרה"
  };

  return labels[activity.action] || "פעילות מערכת";
}

function getActivityActor(activity) {
  if (activity && activity.detectedFromContact === true) {
    return activity.source ? `סנכרון (${activity.source})` : "סנכרון אנשי קשר";
  }
  return normalizeEmail(
    activity.adminEmail ||
    activity.actorEmail ||
    activity.performedBy ||
    ""
  ) || String(activity.source || "מערכת");
}

function adminActivityMatchesQuery(activity, query) {
  if (!query) return true;

  const searchable = normalizeSearchText([
    getActivityTitle(activity),
    activity.action,
    activity.targetEmail,
    activity.targetPhone,
    activity.displayName,
    getActivityActor(activity),
    activity.source,
    Array.isArray(activity.changedFields)
      ? activity.changedFields.join(" ")
      : activity.changedFields
  ].filter(Boolean).join(" "));

  return searchable.includes(query);
}

function canManagerForceApproveAccess_(user) {
  if (
    !user ||
    user.active !== true ||
    user.phonePermissionActive !== true ||
    user.manualApproved === true ||
    normalizeEmail(user.email) === currentAdminEmail
  ) {
    return false;
  }

  const accessState = getUserAccessState_(user);
  return Boolean(
    accessState &&
    ["pending", "temporary", "expired", "rejected", "waiting", "unknown"].includes(
      accessState.key
    )
  );
}

function getManagerActivityApprovalTarget_(activity) {
  if (!activity || ![
    "worker_added",
    "worker_email_changed",
    "access_auto_granted"
  ].includes(String(activity.action || ""))) {
    return null;
  }

  const candidates = [
    activity.newEmail,
    activity.targetEmail
  ].map(normalizeEmail).filter(Boolean);
  const user = candidates
    .map(email => getAllowedUserByEmail(email))
    .find(Boolean);

  return canManagerForceApproveAccess_(user) ? user : null;
}

function renderAdminActivity() {
  const query = getAdminSearchQuery();

  const activities = adminActivity
    .filter(activity => {
      const category = getActivityCategory(activity.action);

      if (adminActiveFilter === "added" && category !== "added") return false;
      if (adminActiveFilter === "changed" && category === "added") return false;

      return adminActivityMatchesQuery(activity, query);
    })
    .slice(0, 10);

  document.getElementById("adminSummary").textContent =
    activities.length === 1
      ? "נמצאה פעולה אחת"
      : `נמצאו ${activities.length} פעולות אחרונות`;

  if (!activities.length) {
    document.getElementById("adminList").innerHTML =
      '<div class="adminEmpty">עדיין לא נרשמה פעילות התואמת לחיפוש.</div>';
    return;
  }

  document.getElementById("adminList").innerHTML = activities.map(activity => {
    const category = getActivityCategory(activity.action);
    const target = activity.displayName ||
      activity.targetEmail ||
      activity.targetPhone ||
      activity.targetId ||
      "ללא יעד";
    const actor = getActivityActor(activity);
    const changedFields = Array.isArray(activity.changedFields)
      ? activity.changedFields.filter(Boolean)
      : [];
    const oldEmails = Array.isArray(activity.oldEmails)
      ? activity.oldEmails.filter(Boolean)
      : [];
    const approvalTarget = getManagerActivityApprovalTarget_(activity);

    const details = [
      changedFields.length
        ? "שדות ששונו: " + changedFields.join(", ")
        : "",
      oldEmails.length
        ? "מייל קודם: " + oldEmails.join(", ")
        : "",
      activity.newEmail
        ? "מייל חדש: " + activity.newEmail
        : "",
      activity.source
        ? "מקור: " + activity.source
        : "",
      activity.reason
        ? "הערה: " + activity.reason
        : ""
    ].filter(Boolean);

    return `
      <div class="adminCard activityCard ${category}">
        <div class="adminCardTop">
          <div>
            <div class="adminCardName">${escapeHtml(getActivityTitle(activity))}</div>
            <div class="adminCardMeta">
              יעד: ${escapeHtml(target)}<br>
              בוצע על ידי: ${escapeHtml(actor)}
            </div>
            <div class="activityTime">${escapeHtml(formatActivityTimestamp(activity))}</div>
          </div>
          <span class="adminStatusBadge">${category === "added" ? "נוסף" : category === "removed" ? "הוסר" : "עודכן"}</span>
        </div>
        ${details.length
          ? `<div class="activityDetails">${details.map(escapeHtml).join("<br>")}</div>`
          : ""}
        ${approvalTarget
          ? `<div class="adminCardActions activityApprovalActions">
               <button type="button" class="adminActionBtn primary" onclick="approveManualAccess_('${escapeJsString(approvalTarget.email)}', false, true)">אישור גישה קבועה</button>
               <button type="button" class="adminActionBtn secondary" onclick="openAdminPerson_('', '${escapeJsString(approvalTarget.email)}')">פתיחת כרטיס העובד</button>
             </div>`
          : ""}
      </div>
    `;
  }).join("");
}

function findContactByEmail(email) {
  const normalized = normalizeEmail(email);
  return [...adminContacts, ...adminRemovedContacts].find(
    contact => normalizeEmail(contact.email) === normalized
  ) || null;
}

function findAdminContactByPhone_(phone) {
  const normalized = normalizePhone(phone);
  return [...adminContacts, ...adminRemovedContacts].find(
    contact => normalizePhone(contact.phone) === normalized
  ) || null;
}

function getAllowedUserByEmail(email) {
  const normalized = normalizeEmail(email);
  return adminAllowedUsers.find(
    user => normalizeEmail(user.email) === normalized
  ) || null;
}


function getTimestampMillis_(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getReportTimestamp_(report) {
  return getTimestampMillis_(report && report.createdAt);
}

function formatReportTimestamp_(report) {
  const timestamp = getReportTimestamp_(report);
  return timestamp
    ? new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(timestamp))
    : "מועד לא ידוע";
}

function getReportTypeLabel_(type) {
  return ({
    phone: "מספר טלפון",
    email: "כתובת מייל",
    name: "שם או תואר",
    role: "תפקיד",
    department: "מחלקה / מכון",
    other: "אחר"
  })[type] || "אחר";
}

function adminReportMatchesQuery_(report, query) {
  if (!query) return true;
  return normalizeSearchText([
    report.contactName,
    report.contactPhone,
    report.internDepartment,
    report.reporterEmail,
    report.details,
    getReportTypeLabel_(report.issueType)
  ].join(" ")).includes(query);
}

function getContactAddRequestName_(request) {
  return [request.titlePrefix, request.firstName, request.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function adminContactAddRequestMatchesQuery_(request, query) {
  if (!query) return true;
  return normalizeSearchText([
    getContactAddRequestName_(request),
    request.role,
    request.department,
    request.phone,
    formatPhoneForDisplay(request.phone),
    request.email,
    request.reporterEmail,
    request.status
  ].filter(Boolean).join(" ")).includes(query);
}

function getContactAddRequestTimestamp_(request) {
  return getTimestampMillis_(request && request.createdAt);
}

function formatContactAddRequestTimestamp_(request) {
  const timestamp = getContactAddRequestTimestamp_(request);
  return timestamp
    ? new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(timestamp))
    : "מועד לא ידוע";
}

async function setContactReportStatus_(reportId, status) {
  if (!currentUserIsAdmin || !reportId) return;
  const nextStatus = status === "resolved" ? "resolved" : "open";
  try {
    await firebaseApi.updateDoc(
      firebaseApi.doc(db, "contactReports", reportId),
      {
        status: nextStatus,
        resolvedAt: nextStatus === "resolved" ? firebaseApi.serverTimestamp() : null,
        resolvedBy: nextStatus === "resolved" ? currentAdminEmail : ""
      }
    );
    const report = adminReports.find(item => item.docId === reportId);
    if (report) {
      report.status = nextStatus;
      report.resolvedBy = nextStatus === "resolved" ? currentAdminEmail : "";
    }
    updateAdminPendingBadges_();
    renderAdminList();
  } catch (error) {
    console.error("Report status update failed", error);
    setAdminStatus("לא הצלחנו לעדכן את מצב הדיווח.", "error");
  }
}

function findExistingContactForAddRequest_(values, request = null) {
  const originalContactId = String(
    request && request.originalContactId || ""
  );

  if (originalContactId) {
    const exact = adminContacts.find(
      contact => String(contact.docId || "") === originalContactId
    );
    if (exact) return exact;
  }

  const originalPhone = normalizePhone(
    request && request.originalPhone || ""
  );
  if (originalPhone) {
    const exactByPhone = adminContacts.find(
      contact => normalizePhone(contact.phone) === originalPhone
    );
    if (exactByPhone) return exactByPhone;
  }

  const phone = normalizePhone(values.phone || "");
  const email = normalizeEmail(values.email || "");
  return adminContacts.find(contact =>
    (phone && normalizePhone(contact.phone) === phone) ||
    (email && normalizeEmail(contact.email) === email)
  ) || null;
}

function buildApprovedContactPayload_(request, values, existingContact) {
  const now = new Date().toISOString();
  const base = existingContact ? contactToFirestorePayload(existingContact) : {
    id: "",
    first_name_he: "",
    last_name_he: "",
    first_name_en: "",
    last_name_en: "",
    title_prefix: "",
    role: "",
    department: "",
    hospital: "",
    phone: "",
    email: "",
    source: "user-submission-approved",
    status: "active",
    created_at: now,
    first_seen_at: now,
    is_new_contact: true,
    updated_at: now
  };

  const isSelfUpdate = Boolean(
    request && request.requestType === "self_update" && existingContact
  );
  const isContactUpdate = Boolean(
    request && request.requestType === "contact_update" && existingContact
  );
  const choose = (nextValue, currentValue) => {
    const normalized = String(nextValue || "").trim();
    return normalized || String(currentValue || "").trim();
  };
  const editableValue = (nextValue, currentValue) =>
    (isSelfUpdate || isContactUpdate)
      ? String(nextValue || "").trim()
      : choose(nextValue, currentValue);

  return {
    ...base,
    first_name_he: choose(values.firstName, base.first_name_he),
    last_name_he: choose(values.lastName, base.last_name_he),
    title_prefix: editableValue(values.titlePrefix, base.title_prefix),
    role: editableValue(values.role, base.role),
    department: editableValue(values.department, base.department),
    phone: isSelfUpdate
      ? normalizePhone(base.phone)
      : normalizePhone(values.phone || base.phone),
    email: normalizeEmail(
      isSelfUpdate
        ? base.email
        : isContactUpdate ? values.email : values.email || base.email
    ),
    source: existingContact
      ? String(base.source || "admin-approved-update")
      : "user-submission-approved",
    status: String(base.status || "active"),
    created_at: String(base.created_at || now),
    first_seen_at: String(base.first_seen_at || base.created_at || now),
    is_new_contact: existingContact ? base.is_new_contact === true : true,
    updated_at: now
  };
}

function hasUsableContactPhone_(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function getContactAddFormValues_() {
  return {
    firstName: document.getElementById("contactAddFirstName").value.trim(),
    lastName: document.getElementById("contactAddLastName").value.trim(),
    titlePrefix: document.getElementById("contactAddTitlePrefix").value.trim(),
    role: document.getElementById("contactAddRole").value.trim(),
    department: document.getElementById("contactAddDepartment").value.trim(),
    phone: document.getElementById("contactAddPhone").value.trim(),
    email: normalizeEmail(document.getElementById("contactAddEmail").value)
  };
}

async function submitContactAddApprovalToScript_(requestId, values) {
  const currentUser = auth && auth.currentUser;
  if (!currentUser || !currentUserIsAdmin) {
    throw new Error("יש להתחבר מחדש כמנהל כדי לאשר את הבקשה.");
  }

  let idToken;
  try {
    idToken = await currentUser.getIdToken(true);
  } catch (refreshError) {
    // כשל רשת רגעי ברענון האסימון לא צריך לחסום מנהל שכבר מחובר.
    idToken = await currentUser.getIdToken(false);
  }
  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
  const frameName = `contactApprovalFrame_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const iframe = document.createElement("iframe");
  const form = document.createElement("form");

  iframe.name = frameName;
  iframe.style.display = "none";
  form.method = "post";
  form.action = AUTH_ROUTER_URL;
  form.target = frameName;
  form.style.display = "none";

  const fields = {
    action: "approveContactAddRequest",
    idToken,
    nonce,
    requestId,
    firstName: values.firstName || "",
    lastName: values.lastName || "",
    titlePrefix: values.titlePrefix || "",
    role: values.role || "",
    department: values.department || "",
    phone: values.phone || "",
    email: values.email || ""
  };

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value || "");
    form.appendChild(input);
  });

  document.body.appendChild(iframe);
  document.body.appendChild(form);

  return await new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;
    let pollTimer = null;
    let pollInFlight = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (timeoutId) clearTimeout(timeoutId);
      if (pollTimer) clearInterval(pollTimer);
      form.remove();
      iframe.remove();
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onMessage = event => {
      const data = event && event.data;
      if (
        !data ||
        data.source !== "contacts-admin-approval" ||
        data.nonce !== nonce
      ) {
        return;
      }

      if (data.ok === true) {
        finish(resolve, data);
      } else {
        finish(
          reject,
          new Error(data.message || "אישור איש הקשר נכשל.")
        );
      }
    };
    const checkApprovalStatus = async () => {
      if (settled || pollInFlight || !firebaseApi || !db) return;
      pollInFlight = true;

      try {
        const requestSnapshot = await firebaseApi.getDoc(
          firebaseApi.doc(db, "contactAddRequests", requestId)
        );
        if (!requestSnapshot.exists()) return;

        const status = String(requestSnapshot.data().status || "");
        if (status === "approved") {
          finish(resolve, {
            ok: true,
            requestId,
            recoveredFromStatus: true
          });
        } else if (status === "rejected") {
          finish(
            reject,
            new Error("הבקשה נדחתה בזמן ניסיון האישור.")
          );
        }
      } catch (pollError) {
        // ה-iframe עדיין יכול להחזיר תשובה; ממשיכים לנסות עד פסק הזמן.
      } finally {
        pollInFlight = false;
      }
    };

    timeoutId = setTimeout(() => {
      finish(
        reject,
        new Error(
          "האישור נמשך זמן רב מהצפוי. טענו מחדש את מסך הניהול לפני ניסיון נוסף."
        )
      );
    }, 120000);

    window.addEventListener("message", onMessage);
    pollTimer = setInterval(checkApprovalStatus, 2000);
    form.submit();
    setTimeout(checkApprovalStatus, 1200);
  });
}

async function approveContactAddRequest_(requestId, editedValues = null) {
  if (!currentUserIsAdmin || !requestId) return;
  const request = adminContactAddRequests.find(item => item.docId === requestId);
  if (!request || request.status !== "pending") {
    setAdminStatus("הבקשה כבר טופלה או שאינה זמינה.", "error");
    return;
  }

  const values = editedValues || {
    firstName: request.firstName,
    lastName: request.lastName,
    titlePrefix: request.titlePrefix,
    role: request.role,
    department: request.department,
    phone: request.phone,
    email: request.email
  };

  if (!hasUsableContactPhone_(values.phone)) {
    openContactAddRequestForApproval_(requestId, "כדי לפרסם איש קשר באפליקציה יש להשלים מספר טלפון תקין.");
    return;
  }

  if (values.email && !isValidEmail(values.email)) {
    openContactAddRequestForApproval_(requestId, "כתובת המייל אינה תקינה.");
    return;
  }

  const existingContact = findExistingContactForAddRequest_(values, request);
  const isSelfUpdate = request.requestType === "self_update";
  const isContactUpdate = request.requestType === "contact_update";
  const isUpdateRequest = isSelfUpdate || isContactUpdate;
  const grantsFormAccess = request.grantAccessOnApproval === true;
  const existingMessage = existingContact
    ? isSelfUpdate
      ? `לאשר את עדכון הפרטים של ${existingContact.name || formatPhoneForDisplay(existingContact.phone)}? מספר הטלפון והמייל לא ישתנו.`
      : isContactUpdate
        ? `לאשר את השינויים בפרטי ${existingContact.name || formatPhoneForDisplay(existingContact.phone)}?`
      : grantsFormAccess
        ? `נמצא איש קשר קיים בשם ${existingContact.name || formatPhoneForDisplay(existingContact.phone)}. האישור יעדכן את הפרטים ויאשר במפורש גישה למייל ${values.email}. להמשיך?`
        : `נמצא איש קשר קיים בשם ${existingContact.name || formatPhoneForDisplay(existingContact.phone)}. האישור יעדכן רק את הפרטים שמולאו בבקשה; מספר הטלפון של הרשומה הקיימת לא ישתנה. להמשיך?`
    : grantsFormAccess
      ? `לאשר את הוספת ${getContactAddRequestName_({ ...request, ...values }) || formatPhoneForDisplay(values.phone)} וגם להעניק גישה למייל ${values.email}?`
      : `לאשר ולהוסיף את ${getContactAddRequestName_({ ...request, ...values }) || formatPhoneForDisplay(values.phone)} לרשימה?`;

  if (!await requestAdminConfirmation_({
    title: isUpdateRequest ? "אישור עדכון פרטים" : existingContact ? "עדכון איש קשר קיים" : "הוספת איש קשר",
    message: existingMessage,
    confirmLabel: isUpdateRequest ? "אישור ועדכון" : "אישור והוספה",
    tone: "primary"
  })) return;

  const payload = buildApprovedContactPayload_(request, values, existingContact);
  const docId = existingContact && existingContact.docId
    ? existingContact.docId
    : normalizePhone(payload.phone).replace(/\D/g, "") || `request_${requestId}`;

  setAdminStatus(isUpdateRequest ? "מאשר את עדכון הפרטים..." : "מאשר ומוסיף את איש הקשר...", "loading");

  if (!isSelfUpdate) {
    try {
      await submitContactAddApprovalToScript_(requestId, {
        firstName: payload.first_name_he,
        lastName: payload.last_name_he,
        titlePrefix: payload.title_prefix,
        role: payload.role,
        department: payload.department,
        phone: payload.phone,
        email: payload.email
      });

      clearContactsBundleCache_();
      closeContactAddModal_();
      await loadContacts();
      await loadAdminData();
      setAdminStatus(
        isContactUpdate
          ? "עדכון הפרטים אושר ונשמר במקור הנתונים."
          : grantsFormAccess
          ? "בקשת ההצטרפות אושרה: איש הקשר והגישה עודכנו."
          : existingContact
          ? "איש הקשר הקיים עודכן גם בגיליון המקור."
          : "איש הקשר אושר, נשמר בגיליון ונוסף לרשימה.",
        "success"
      );
    } catch (error) {
      console.error("Contact addition approval failed", error);
      setAdminStatus(
        error && error.message
          ? error.message
          : "אישור הבקשה נכשל. נסו שוב.",
        "error"
      );
    }
    return;
  }

  try {
    const batch = firebaseApi.writeBatch(db);
    const now = firebaseApi.serverTimestamp();

    batch.set(firebaseApi.doc(db, "contacts", docId), payload, { merge: true });
    batch.set(
      firebaseApi.doc(db, "contactOverrides", docId),
      {
        ...payload,
        deleted: false,
        updatedBy: currentAdminEmail,
        updatedAt: now
      },
      { merge: false }
    );

    // תחילה נשמר איש הקשר. הבקשה נשארת pending עד שספריית
    // אנשי הקשר המהירה עודכנה בהצלחה, כדי שניתן יהיה לנסות שוב במקרה תקלה.
    await batch.commit();
    await updateOptimizedContactBundle_(docId, payload, {
      deleted: false,
      countDelta: existingContact ? 0 : 1
    });

    const completionBatch = firebaseApi.writeBatch(db);
    const completionTime = firebaseApi.serverTimestamp();
    completionBatch.update(firebaseApi.doc(db, "contactAddRequests", requestId), {
      firstName: values.firstName,
      lastName: values.lastName,
      titlePrefix: values.titlePrefix,
      role: values.role,
      department: values.department,
      phone: payload.phone,
      email: payload.email,
      status: "approved",
      updatedAt: completionTime,
      handledAt: completionTime,
      handledBy: currentAdminEmail,
      approvedContactId: docId
    });
    completionBatch.set(firebaseApi.doc(firebaseApi.collection(db, "admin_actions")), {
      action: isSelfUpdate
        ? "self_profile_update_approved"
        : "contact_add_request_approved",
      targetId: docId,
      targetEmail: payload.email || "",
      targetPhone: payload.phone || "",
      displayName: [payload.title_prefix, payload.first_name_he, payload.last_name_he].filter(Boolean).join(" "),
      requesterEmail: request.reporterEmail || "",
      adminEmail: currentAdminEmail,
      timestamp: completionTime
    });
    await completionBatch.commit();

    clearContactsBundleCache_();
    closeContactAddModal_();
    await loadContacts();
    await loadAdminData();
    setAdminStatus(
      isSelfUpdate
        ? "עדכון הפרטים אושר והופץ באפליקציה."
        : existingContact
          ? "איש הקשר הקיים עודכן."
          : "איש הקשר אושר ונוסף לרשימה.",
      "success"
    );
  } catch (error) {
    console.error("Contact addition approval failed", error);
    setAdminStatus("אישור הבקשה נכשל. בדקו את כללי Firestore ונסו שוב.", "error");
  }
}

async function rejectContactAddRequest_(requestId) {
  if (!currentUserIsAdmin || !requestId) return;
  const request = adminContactAddRequests.find(item => item.docId === requestId);
  if (!request || request.status !== "pending") return;
  if (!await requestAdminConfirmation_({
    title: "דחיית הבקשה",
    message: ["self_update", "contact_update"].includes(request.requestType)
      ? "בקשת עדכון הפרטים תסומן כנדחתה."
      : "בקשת הוספת איש הקשר תסומן כנדחתה.",
    confirmLabel: "דחיית הבקשה",
    tone: "warning"
  })) return;

  try {
    const batch = firebaseApi.writeBatch(db);
    const now = firebaseApi.serverTimestamp();
    batch.update(firebaseApi.doc(db, "contactAddRequests", requestId), {
      status: "rejected",
      updatedAt: now,
      handledAt: now,
      handledBy: currentAdminEmail,
      approvedContactId: ""
    });
    batch.set(firebaseApi.doc(firebaseApi.collection(db, "admin_actions")), {
      action: request.requestType === "self_update"
        ? "self_profile_update_rejected"
        : request.requestType === "contact_update"
          ? "contact_update_request_rejected"
          : "contact_add_request_rejected",
      displayName: getContactAddRequestName_(request),
      targetEmail: request.email || "",
      targetPhone: request.phone || "",
      requesterEmail: request.reporterEmail || "",
      adminEmail: currentAdminEmail,
      timestamp: now
    });
    await batch.commit();
    await loadAdminData();
    setAdminStatus("הבקשה נדחתה.", "success");
  } catch (error) {
    console.error("Contact addition rejection failed", error);
    setAdminStatus("דחיית הבקשה נכשלה.", "error");
  }
}

function renderAdminReports() {
  const query = getAdminSearchQuery();

  const additionItems = adminContactAddRequests
    .filter(request => {
      if (adminActiveFilter === "pending_additions" && request.status !== "pending") return false;
      if (adminActiveFilter === "open_reports") return false;
      if (adminActiveFilter === "handled" && request.status === "pending") return false;
      return adminContactAddRequestMatchesQuery_(request, query);
    })
    .map(request => ({ kind: "addition", timestamp: getContactAddRequestTimestamp_(request), data: request }));

  const reportItems = adminReports
    .filter(report => {
      if (adminActiveFilter === "pending_additions") return false;
      if (adminActiveFilter === "open_reports" && report.status !== "open") return false;
      if (adminActiveFilter === "handled" && report.status !== "resolved") return false;
      return adminReportMatchesQuery_(report, query);
    })
    .map(report => ({ kind: "report", timestamp: getReportTimestamp_(report), data: report }));

  const items = [...additionItems, ...reportItems].sort((a, b) => b.timestamp - a.timestamp);
  const pendingAdditions = adminContactAddRequests.filter(
    request => request.status === "pending"
  ).length;
  const openReports = adminReports.filter(report => report.status === "open").length;
  const visibleItems = getVisibleAdminItems_(items);

  document.getElementById("adminSummary").textContent =
    `${items.length === 1 ? "נמצא פריט אחד" : `נמצאו ${items.length} פריטים`}` +
    (visibleItems.length < items.length ? ` · מוצגים ${visibleItems.length}` : "") +
    (pendingAdditions ? ` · ${pendingAdditions} בקשות הוספה או עדכון ממתינות` : "") +
    (openReports ? ` · ${openReports} דיווחים פתוחים` : "");

  if (!items.length) {
    document.getElementById("adminList").innerHTML = '<div class="adminEmpty">אין דיווחים או בקשות עדכון/הוספה התואמים לסינון.</div>';
    return;
  }

  const reportsHtml = visibleItems.map(item => {
    if (item.kind === "addition") {
      const request = item.data;
      const displayName = getContactAddRequestName_(request) || formatPhoneForDisplay(request.phone) || request.email || "איש קשר ללא שם";
      const statusLabel = request.status === "approved" ? "אושר" : request.status === "rejected" ? "נדחה" : "ממתין";
      const statusClass = request.status === "pending" ? "pending" : request.status;
      const isSelfUpdate = request.requestType === "self_update";
      const isContactUpdate = request.requestType === "contact_update";
      const isUpdateRequest = isSelfUpdate || isContactUpdate;
      const grantsFormAccess = request.grantAccessOnApproval === true;
      const requestLabel = isUpdateRequest
        ? isSelfUpdate ? "בקשת עדכון פרטים אישיים" : "בקשת עדכון פרטי איש קשר"
        : grantsFormAccess
          ? "בקשת הצטרפות ואישור גישה"
        : "בקשת הוספת איש קשר";
      const sourceLabel = request.source === "device_picker"
        ? "ספר הטלפונים במכשיר"
          : request.source === "self_profile"
            ? "כפתור „אני” באפליקציה"
            : request.source === "contact_detail"
              ? "כרטיס איש הקשר באפליקציה"
            : request.source === "google_form"
            ? "Google Form"
          : "טופס ידני";
      const details = [
        request.role ? `<b>תפקיד:</b> ${escapeHtml(request.role)}` : "",
        request.department ? `<b>מחלקה:</b> ${escapeHtml(request.department)}` : "",
        request.phone ? `<b>טלפון:</b> ${escapeHtml(formatPhoneForDisplay(request.phone))}` : "",
        request.email ? `<b>מייל:</b> ${escapeHtml(request.email)}` : "",
        `<b>נשלח על ידי:</b> ${escapeHtml(request.reporterEmail || "לא ידוע")}`,
        `<b>מקור:</b> ${sourceLabel}`,
        request.handledBy ? `<b>טופל על ידי:</b> ${escapeHtml(request.handledBy)}` : ""
      ].filter(Boolean).join("<br>");

      return `
        <div class="adminCard contactAddRequestCard ${statusClass}">
          <div class="adminCardTop">
            <div>
              <div class="adminCardName">${escapeHtml(displayName)}</div>
              <div class="adminCardMeta">${requestLabel}<br>${escapeHtml(formatContactAddRequestTimestamp_(request))}</div>
            </div>
            <span class="adminStatusBadge ${request.status === "pending" ? "pending" : ""}">${statusLabel}</span>
          </div>
          <details class="adminCardMore" ${request.status === "pending" ? "open" : ""}>
            <summary>פרטים ופעולות</summary>
            <div class="adminCardMoreBody">
              <div class="adminCardDetailsList">${details}</div>
              ${request.status === "pending" ? `
                <div class="adminCardActions">
                  <button type="button" class="adminActionBtn primary" onclick="approveContactAddRequest_('${escapeJsString(request.docId)}')">${isUpdateRequest ? "אישור ועדכון" : grantsFormAccess ? "אישור איש קשר וגישה" : "אישור והוספה"}</button>
                  <button type="button" class="adminActionBtn secondary" onclick="openContactAddRequestForApproval_('${escapeJsString(request.docId)}')">עריכה לפני אישור</button>
                  <details class="adminActionMenu">
                    <summary>פעולות נוספות</summary>
                    <div class="adminActionMenuBody">
                      <button type="button" class="adminActionBtn danger" onclick="rejectContactAddRequest_('${escapeJsString(request.docId)}')">דחיית הבקשה</button>
                    </div>
                  </details>
                </div>` : ""}
            </div>
          </details>
        </div>
      `;
    }

    const report = item.data;
    return `
      <div class="adminCard reportCard ${report.status === "resolved" ? "resolved" : ""}">
        <div class="adminCardTop">
          <div>
            <div class="adminCardName">${escapeHtml(report.contactName || formatPhoneForDisplay(report.contactPhone) || "איש קשר")}</div>
            <div class="adminCardMeta">
              ${escapeHtml(getReportTypeLabel_(report.issueType))}<br>
              ${report.contactPhone ? escapeHtml(formatPhoneForDisplay(report.contactPhone)) + "<br>" : ""}
              דווח על ידי: ${escapeHtml(report.reporterEmail || "לא ידוע")}<br>
              ${escapeHtml(formatReportTimestamp_(report))}
            </div>
          </div>
          <span class="adminStatusBadge ${report.status === "resolved" ? "" : "blocked"}">${report.status === "resolved" ? "טופל" : "פתוח"}</span>
        </div>
        <details class="adminCardMore" ${report.status === "resolved" ? "" : "open"}>
          <summary>פרטים ופעולות</summary>
          <div class="adminCardMoreBody">
            <div class="adminCardDetailsList">${escapeHtml(report.details) || "לא נמסרו פרטים נוספים."}</div>
            <div class="adminCardActions">
              <button type="button" class="adminActionBtn ${report.status === "resolved" ? "secondary" : "primary"}" onclick="setContactReportStatus_('${report.docId}', '${report.status === "resolved" ? "open" : "resolved"}')">
                ${report.status === "resolved" ? "פתיחה מחדש" : "סימון כטופל"}
              </button>
            </div>
          </div>
        </details>
      </div>
    `;
  }).join("");

  document.getElementById("adminList").innerHTML =
    reportsHtml + renderAdminLoadMore_(items.length, visibleItems.length);
}

function getAdminAttentionItems_() {
  const accessItems = adminAllowedUsers
    .map(user => {
      const accessState = getUserAccessState_(user);
      const request = getEffectiveVerificationRequestForUser_(user);
      if (
        !["pending", "temporary", "expired"].includes(accessState.key) ||
        !request ||
        !["pending", "temporary_active"].includes(request.status)
      ) {
        return null;
      }

      return {
        kind: "access",
        priority: request.reviewRequestedNow === true ? 1 : 0,
        timestamp: getAdminTimestampMillis_(
          request.reviewRequestedAt || request.requestedAt || request.updatedAt
        ),
        data: { user, request, accessState }
      };
    })
    .filter(Boolean);

  const resetItems = getPendingPasswordResetRequests_().map(request => ({
    kind: "reset",
    timestamp: getAdminTimestampMillis_(request.requestedAt),
    data: request
  }));
  const contactItems = adminContactAddRequests
    .filter(request => request.status === "pending")
    .map(request => ({
      kind: "contact",
      timestamp: getContactAddRequestTimestamp_(request),
      data: request
    }));
  const reportItems = adminReports
    .filter(report => report.status === "open")
    .map(report => ({
      kind: "report",
      timestamp: getReportTimestamp_(report),
      data: report
    }));
  return [
    ...accessItems,
    ...resetItems,
    ...contactItems,
    ...reportItems
  ].sort((a, b) =>
    Number(b.priority || 0) - Number(a.priority || 0) ||
    b.timestamp - a.timestamp
  );
}

function getAdminRecentChangeNotificationItems_() {
  const notificationActions = new Set([
    "worker_added",
    "worker_details_updated",
    "worker_email_changed"
  ]);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return (Array.isArray(adminActivity) ? adminActivity : [])
    .filter(activity => notificationActions.has(activity.action))
    .map(activity => ({
      kind: "notification",
      timestamp: getActivityTimestamp(activity),
      data: activity
    }))
    .filter(item => item.timestamp >= weekAgo);
}

function adminAttentionItemMatchesQuery_(item, query) {
  if (!query) return true;

  if (item.kind === "access") {
    return adminUserMatchesQuery(item.data.user, query);
  }
  if (item.kind === "contact") {
    return adminContactAddRequestMatchesQuery_(item.data, query);
  }
  if (item.kind === "report") {
    return adminReportMatchesQuery_(item.data, query);
  }
  if (item.kind === "notification") {
    const activity = item.data;
    return normalizeSearchText([
      getActivityTitle(activity),
      activity.displayName,
      activity.targetEmail,
      activity.targetPhone,
      activity.oldEmails,
      activity.newEmail
    ].filter(Boolean).join(" ")).includes(query);
  }

  const request = item.data;
  const contact = findContactByEmail(request.email);
  const searchable = normalizeSearchText([
    request.email,
    request.requestId,
    contact ? contact.name : "",
    contact ? contact.phone : ""
  ].filter(Boolean).join(" "));
  return searchable.includes(query);
}

function renderAdminAttentionAccessCard_(item) {
  const { user, request, accessState } = item.data;
  const contact = findContactByEmail(user.email) ||
    findAdminContactByPhone_(request.phone || user.phone);
  const phone = contact && contact.phone ? contact.phone : user.phone;
  const isTemporary = accessState.key === "temporary";
  const allowTemporary = accessState.key === "pending";

  return `
    <article class="adminCard adminFocusCard">
      <div class="adminCardTop">
        <div>
          <div class="adminCardName">${escapeHtml(request.name || (contact && contact.name) || user.email)}</div>
          <div class="adminCardMeta">
            ${request.role || contact && contact.role ? escapeHtml(request.role || contact.role) : ""}${request.department || contact && contact.dept ? `${request.role || contact && contact.role ? " · " : ""}${escapeHtml(request.department || contact.dept)}` : ""}<br>
            ${request.provisional ? `גישה זמנית מאז ${escapeHtml(formatAdminRelativeTime_(request.provisionalAt || user.provisionalAt))}<br>` : "בקשת אישור כניסה<br>"}
            ${request.reviewRequestedNow ? "<strong>ביקש אישור קבוע כעת</strong><br>" : ""}
            ${escapeHtml(user.email)}
            ${phone ? "<br>" + escapeHtml(formatPhoneForDisplay(phone)) : ""}
          </div>
        </div>
        <span class="adminStatusBadge pending">${isTemporary ? "עד 23:59" : "ממתין"}</span>
      </div>
      <details class="adminFocusAction">
        <summary>טיפול בבקשה</summary>
        <div class="adminFocusActionBody">
          <div class="accessStateLine ${escapeHtml(accessState.key)}">
            ${escapeHtml(accessState.label)}
            ${accessState.note ? `<span class="accessStateNote">${escapeHtml(accessState.note)}</span>` : ""}
          </div>
          <div class="adminCardActions">
            ${allowTemporary
              ? `<button type="button" class="adminActionBtn secondary" onclick="approveManualAccess_('${escapeJsString(user.email)}', true)">אישור עד 23:59</button>`
              : ""}
            <button type="button" class="adminActionBtn primary" onclick="approveManualAccess_('${escapeJsString(user.email)}', false)">אישור קבוע</button>
            <button type="button" class="adminActionBtn warning" onclick="${isTemporary ? "revokeManualAccess_" : "rejectManualAccess_"}('${escapeJsString(user.email)}')">${isTemporary ? "ביטול מיידי" : "דחיית הבקשה"}</button>
          </div>
        </div>
      </details>
    </article>
  `;
}

function renderAdminAttentionResetCard_(item) {
  const request = item.data;
  const contact = findContactByEmail(request.email);
  const isApproved = request.status === "approved";

  return `
    <article class="adminCard adminFocusCard">
      <div class="adminCardTop">
        <div>
          <div class="adminCardName">${escapeHtml(contact && contact.name ? contact.name : request.email)}</div>
          <div class="adminCardMeta">
            בקשת עזרה באיפוס סיסמה<br>
            ${escapeHtml(request.email)}<br>
            התקבלה: ${escapeHtml(formatAdminTimestamp_(request.requestedAt))}
          </div>
        </div>
        <span class="adminStatusBadge pending">${isApproved ? "אושר עד 23:59" : "ממתין"}</span>
      </div>
      <details class="adminFocusAction">
        <summary>טיפול באיפוס הסיסמה</summary>
        <div class="adminFocusActionBody">
          <p class="adminFocusHelp">בחרו את מסלול העזרה המתאים למשתמש.</p>
          <div class="adminCardActions">
            ${isApproved
              ? ""
              : `<button type="button" class="adminActionBtn primary" onclick="approvePasswordRecoveryForUser_('${escapeJsString(request.email)}')">אישור איפוס באפליקציה עד 23:59</button>
                 <button type="button" class="adminActionBtn secondary" onclick="sendPasswordResetForUser_('${escapeJsString(request.email)}')">שליחת קישור במייל</button>`}
            <button type="button" class="adminActionBtn warning" onclick="closePasswordResetRequest_('${escapeJsString(request.email)}')">${isApproved ? "ביטול האישור" : "סגירה ללא אישור"}</button>
          </div>
        </div>
      </details>
    </article>
  `;
}

function renderAdminAttentionContactCard_(item) {
  const request = item.data;
  const displayName =
    getContactAddRequestName_(request) ||
    formatPhoneForDisplay(request.phone) ||
    request.email ||
    "איש קשר ללא שם";
  const isSelfUpdate = request.requestType === "self_update";
  const isContactUpdate = request.requestType === "contact_update";
  const isUpdateRequest = isSelfUpdate || isContactUpdate;
  const grantsFormAccess = request.grantAccessOnApproval === true;
  const requestLabel = isUpdateRequest
    ? isSelfUpdate ? "בקשת עדכון פרטים אישיים" : "בקשת עדכון פרטי איש קשר"
    : grantsFormAccess
      ? "בקשת הצטרפות ואישור גישה"
      : "בקשת הוספת איש קשר";

  return `
    <article class="adminCard adminFocusCard">
      <div class="adminCardTop">
        <div>
          <div class="adminCardName">${escapeHtml(displayName)}</div>
          <div class="adminCardMeta">
            ${requestLabel}<br>
            ${escapeHtml(formatContactAddRequestTimestamp_(request))}
          </div>
        </div>
        <span class="adminStatusBadge pending">ממתין</span>
      </div>
      <details class="adminFocusAction">
        <summary>בדיקת הבקשה</summary>
        <div class="adminFocusActionBody">
          <div class="adminCardDetailsList">
            ${request.role ? `<b>תפקיד:</b> ${escapeHtml(request.role)}<br>` : ""}
            ${request.department ? `<b>מחלקה:</b> ${escapeHtml(request.department)}<br>` : ""}
            ${request.phone ? `<b>טלפון:</b> ${escapeHtml(formatPhoneForDisplay(request.phone))}<br>` : ""}
            ${request.email ? `<b>מייל:</b> ${escapeHtml(request.email)}` : ""}
          </div>
          <div class="adminCardActions">
            <button type="button" class="adminActionBtn primary" onclick="approveContactAddRequest_('${escapeJsString(request.docId)}')">${isUpdateRequest ? "אישור ועדכון" : grantsFormAccess ? "אישור איש קשר וגישה" : "אישור והוספה"}</button>
            <button type="button" class="adminActionBtn secondary" onclick="openContactAddRequestForApproval_('${escapeJsString(request.docId)}')">עריכה לפני אישור</button>
            <button type="button" class="adminActionBtn warning" onclick="rejectContactAddRequest_('${escapeJsString(request.docId)}')">דחיית הבקשה</button>
          </div>
        </div>
      </details>
    </article>
  `;
}

function renderAdminAttentionReportCard_(item) {
  const report = item.data;
  const title =
    report.contactName ||
    formatPhoneForDisplay(report.contactPhone) ||
    "איש קשר";

  return `
    <article class="adminCard adminFocusCard">
      <div class="adminCardTop">
        <div>
          <div class="adminCardName">${escapeHtml(title)}</div>
          <div class="adminCardMeta">
            ${escapeHtml(getReportTypeLabel_(report.issueType))}<br>
            דווח על ידי: ${escapeHtml(report.reporterEmail || "לא ידוע")}<br>
            ${escapeHtml(formatReportTimestamp_(report))}
          </div>
        </div>
        <span class="adminStatusBadge pending">פתוח</span>
      </div>
      <details class="adminFocusAction">
        <summary>טיפול בדיווח</summary>
        <div class="adminFocusActionBody">
          <div class="adminCardDetailsList">${escapeHtml(report.details) || "לא נמסרו פרטים נוספים."}</div>
          <div class="adminCardActions">
            <button type="button" class="adminActionBtn primary" onclick="setContactReportStatus_('${escapeJsString(report.docId)}', 'resolved')">סימון כטופל</button>
          </div>
        </div>
      </details>
    </article>
  `;
}

function formatAdminRelativeTime_(value) {
  const timestamp = getAdminTimestampMillis_(value);
  if (!timestamp) return "מועד לא ידוע";
  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return "עכשיו";
  if (diffMinutes < 60) return `לפני ${diffMinutes} דקות`;
  const today = getIsraelDateKey_();
  if (getIsraelDateKey_(new Date(timestamp)) === today) {
    return "היום " + new Intl.DateTimeFormat("he-IL", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(timestamp));
  }
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function getAdminAttentionRowPresentation_(item) {
  if (item.kind === "access") {
    const { user, request, accessState } = item.data;
    const contact = findContactByEmail(user.email) ||
      findAdminContactByPhone_(request.phone || user.phone);
    return {
      title: request.name || (contact && contact.name) || user.email,
      type: request.reviewRequestedNow
        ? "ביקש אישור קבוע כעת"
        : request.provisional
          ? "גישה זמנית · ממתין לאישור"
          : "בקשת אישור כניסה",
      time: formatAdminRelativeTime_(
        request.reviewRequestedAt || request.requestedAt || request.updatedAt
      ),
      status: accessState.key === "temporary"
        ? "עד סוף היום"
        : request.provisional
          ? "זמני"
          : "ממתין",
      tone: "access",
      id: user.email
    };
  }
  if (item.kind === "reset") {
    const request = item.data;
    const contact = findContactByEmail(request.email);
    return {
      title: contact && contact.name ? contact.name : request.email,
      type: "בקשת איפוס סיסמה",
      time: formatAdminRelativeTime_(request.requestedAt),
      status: request.status === "approved" ? "אושר" : "ממתין",
      tone: "reset",
      id: request.docId
    };
  }
  if (item.kind === "contact") {
    const request = item.data;
    const isUpdateRequest = ["self_update", "contact_update"].includes(request.requestType);
    return {
      title: getContactAddRequestName_(request) || request.email || formatPhoneForDisplay(request.phone) || "איש קשר",
      type: isUpdateRequest
        ? "בקשת עדכון פרטים"
        : request.grantAccessOnApproval === true
          ? "בקשת איש קשר וגישה"
          : "בקשת הוספת איש קשר",
      time: formatAdminRelativeTime_(request.createdAt),
      status: "ממתין",
      tone: "contact",
      id: request.docId
    };
  }
  if (item.kind === "notification") {
    const activity = item.data;
    const contact = findContactByEmail(activity.targetEmail);
    return {
      title: activity.displayName || (contact && contact.name) || activity.targetEmail || "עובד",
      type: getActivityTitle(activity),
      time: formatAdminRelativeTime_(activity.timestamp),
      status: "חדש",
      tone: "notification",
      id: activity.docId
    };
  }
  const report = item.data;
  if (report.subjectType === "intern") {
    return {
      title: report.contactName || formatPhoneForDisplay(report.contactPhone) || "סטאז׳ר",
      type: "דיווח על סטאז׳ר · " + getReportTypeLabel_(report.issueType),
      time: formatAdminRelativeTime_(report.createdAt),
      status: "ממתין",
      tone: "report",
      id: report.docId
    };
  }
  return {
    title: report.contactName || formatPhoneForDisplay(report.contactPhone) || "איש קשר",
    type: "דיווח על " + getReportTypeLabel_(report.issueType),
    time: formatAdminRelativeTime_(report.createdAt),
    status: "פתוח",
    tone: "report",
    id: report.docId
  };
}

function renderAdminInboxRow_(item) {
  const presentation = getAdminAttentionRowPresentation_(item);
  return `
    <button type="button" class="adminInboxRow ${presentation.tone}" onclick="openAdminAttentionItem_('${escapeJsString(item.kind)}', '${escapeJsString(presentation.id)}')">
      <span class="adminInboxRowIcon" aria-hidden="true">${getAdminIconSvg_(presentation.tone)}</span>
      <span class="adminInboxRowContent">
        <strong>${escapeHtml(presentation.title)}</strong>
        <span>${escapeHtml(presentation.type)} · ${escapeHtml(presentation.time)}</span>
      </span>
      <span class="adminInboxRowEnd">
        <span class="adminInboxStatus">${escapeHtml(presentation.status)}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
      </span>
    </button>
  `;
}

function getAdminIconSvg_(kind) {
  const icons = {
    access: '<svg viewBox="0 0 24 24"><path d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2ZM5 20a7 7 0 0 1 14 0"/><path d="m16 11 1.6 1.6L21 9.2"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10m-10 0h11a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10Z"/><path d="M12 14v2"/></svg>',
    contact: '<svg viewBox="0 0 24 24"><path d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2ZM5 20a7 7 0 0 1 14 0"/><path d="M19 4v5m-2.5-2.5h5"/></svg>',
    report: '<svg viewBox="0 0 24 24"><path d="M12 4 3.5 20h17L12 4Zm0 5v5m0 3v.1"/></svg>',
    notification: '<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
    system: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
  };
  return icons[kind] || icons.system;
}

function openAdminFocusSheet_(options) {
  const sheet = document.getElementById("adminFocusSheet");
  if (!sheet) return;
  document.getElementById("adminFocusEyebrow").textContent = options.eyebrow || "";
  document.getElementById("adminFocusTitle").textContent = options.title || "";
  document.getElementById("adminFocusSubtitle").textContent = options.subtitle || "";
  document.getElementById("adminFocusBody").innerHTML = options.html || "";
  sheet.classList.add("visible");
  sheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("directorySheetOpen");
  const firstAction = sheet.querySelector("button:not(.directorySheetBackdrop):not(.directorySheetClose)");
  if (firstAction) setTimeout(() => firstAction.focus(), 80);
}

function closeAdminFocusSheet_() {
  const sheet = document.getElementById("adminFocusSheet");
  if (!sheet) return;
  sheet.classList.remove("visible");
  sheet.setAttribute("aria-hidden", "true");
  adminActiveFocus = null;
  if (!document.querySelector(".directorySheet.visible")) {
    document.body.classList.remove("directorySheetOpen");
  }
}

function renderAdminInfoRows_(rows) {
  return `<dl class="adminFocusInfo">${rows.filter(row => row && row.value).map(row => `
    <div><dt>${escapeHtml(row.label)}</dt><dd ${row.ltr ? 'dir="ltr"' : ""}>${escapeHtml(row.value)}</dd></div>
  `).join("")}</dl>`;
}

function getContactRequestDiffHtml_(request) {
  const existing = findExistingContactForAddRequest_({
    phone: request.phone,
    email: request.email
  }, request);
  if (!existing || !["self_update", "contact_update"].includes(request.requestType)) return "";
  const isContactUpdate = request.requestType === "contact_update";
  const current = {
    "שם פרטי": existing.first || "",
    "שם משפחה": existing.last || "",
    "תואר": existing.title || "",
    "תפקיד": existing.role || "",
    "מחלקה": existing.dept || "",
    "טלפון": formatPhoneForDisplay(existing.phone || ""),
    "מייל": existing.email || ""
  };
  const requested = {
    "שם פרטי": isContactUpdate ? request.firstName : request.firstName || current["שם פרטי"],
    "שם משפחה": isContactUpdate ? request.lastName : request.lastName || current["שם משפחה"],
    "תואר": request.titlePrefix,
    "תפקיד": request.role,
    "מחלקה": request.department,
    "טלפון": formatPhoneForDisplay(request.phone || existing.phone || ""),
    "מייל": isContactUpdate ? request.email : request.email || current["מייל"]
  };
  const changes = Object.keys(current).filter(label =>
    normalizeSearchText(current[label]) !== normalizeSearchText(requested[label])
  );
  if (!changes.length) {
    return '<div class="adminFocusNotice neutral">לא נמצאו הבדלים בתוכן הבקשה.</div>';
  }
  return `<div class="adminRequestDiff"><h4>מה ישתנה</h4>${changes.map(label => `
    <div class="adminDiffRow">
      <strong>${escapeHtml(label)}</strong>
      <span class="adminDiffBefore">${escapeHtml(current[label] || "ריק")}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>
      <span class="adminDiffAfter">${escapeHtml(requested[label] || "ריק")}</span>
    </div>
  `).join("")}</div>`;
}

function getPossibleDuplicateWarningHtml_(request) {
  if (["self_update", "contact_update"].includes(request.requestType)) return "";
  const duplicate = findExistingContactForAddRequest_({
    phone: request.phone,
    email: request.email
  }, request);
  if (!duplicate) return "";
  return `
    <div class="adminFocusNotice warning">
      <strong>ייתכן שאיש הקשר כבר קיים</strong>
      <span>${escapeHtml(duplicate.name || formatPhoneForDisplay(duplicate.phone))}${duplicate.phone ? " · " + escapeHtml(formatPhoneForDisplay(duplicate.phone)) : ""}</span>
    </div>
  `;
}

function openAdminAttentionItem_(kind, itemId) {
  let item = null;
  if (kind === "access") {
    item = getAdminAttentionItems_().find(candidate =>
      candidate.kind === kind && normalizeEmail(candidate.data.user.email) === normalizeEmail(itemId)
    );
  } else {
    item = getAdminAttentionItems_().find(candidate => {
      if (candidate.kind !== kind) return false;
      return String(candidate.data.docId || "") === String(itemId || "");
    });
  }
  if (!item) {
    setAdminStatus("הפריט כבר אינו ממתין לטיפול. רעננו את הרשימה.", "error");
    return;
  }
  adminActiveFocus = { type: "attention", kind, itemId };

  if (kind === "access") {
    const { user, request, accessState } = item.data;
    const contact = findContactByEmail(user.email);
    const name = contact && contact.name ? contact.name : user.email;
    const phone = contact && contact.phone ? contact.phone : user.phone;
    const isTemporary = accessState.key === "temporary";
    openAdminFocusSheet_({
      eyebrow: "בקשת אישור כניסה",
      title: name,
      subtitle: formatAdminRelativeTime_(request.requestedAt || request.updatedAt),
      html: `
        ${renderAdminInfoRows_([
          { label: "מייל", value: user.email, ltr: true },
          { label: "טלפון", value: phone ? formatPhoneForDisplay(phone) : "", ltr: true },
          { label: "מצב גישה", value: accessState.label },
          { label: "סיבת הבקשה", value: request.automaticReason || "אישור מנהל נדרש" }
        ])}
        ${accessState.note ? `<p class="adminFocusDescription">${escapeHtml(accessState.note)}</p>` : ""}
        <div class="adminFocusPrimaryActions">
          <button type="button" class="adminActionBtn primary" onclick="closeAdminFocusSheet_(); approveManualAccess_('${escapeJsString(user.email)}', false)">אישור קבוע</button>
          ${isTemporary ? "" : `<button type="button" class="adminActionBtn secondary" onclick="closeAdminFocusSheet_(); approveManualAccess_('${escapeJsString(user.email)}', true)">אישור עד סוף היום</button>`}
        </div>
        <div class="adminFocusSecondaryActions">
          <button type="button" class="adminActionBtn warning" onclick="closeAdminFocusSheet_(); ${isTemporary ? "revokeManualAccess_" : "rejectManualAccess_"}('${escapeJsString(user.email)}')">${isTemporary ? "ביטול האישור הזמני" : "דחיית הבקשה"}</button>
        </div>
      `
    });
    return;
  }

  if (kind === "notification") {
    const activity = item.data;
    const target = activity.displayName || activity.targetEmail || "עובד";
    const oldEmails = Array.isArray(activity.oldEmails)
      ? activity.oldEmails.filter(Boolean).join(", ")
      : "";
    openAdminFocusSheet_({
      eyebrow: "עדכון מערכת",
      title: target,
      subtitle: formatAdminRelativeTime_(activity.timestamp),
      html: `
        ${renderAdminInfoRows_([
          { label: "סוג העדכון", value: getActivityTitle(activity) },
          { label: "מייל נוכחי", value: activity.targetEmail || activity.newEmail, ltr: true },
          { label: "מייל קודם", value: oldEmails, ltr: true },
          { label: "טלפון", value: activity.targetPhone ? formatPhoneForDisplay(activity.targetPhone) : "", ltr: true },
          { label: "מקור", value: activity.source === "google-form" ? "טופס הצטרפות" : "עדכון עצמי" }
        ])}
        <p class="adminFocusDescription">העדכון נרשם ביומן המערכת. אם זו החלפת מייל, בקשת אישור הגישה מופיעה גם ברשימת המשימות עד לאימות המייל או לאישור מנהל.</p>
      `
    });
    return;
  }

  if (kind === "reset") {
    const request = item.data;
    const contact = findContactByEmail(request.email);
    const name = contact && contact.name ? contact.name : request.email;
    const isApproved = request.status === "approved";
    openAdminFocusSheet_({
      eyebrow: "בקשת איפוס סיסמה",
      title: name,
      subtitle: formatAdminRelativeTime_(request.requestedAt),
      html: `
        ${renderAdminInfoRows_([
          { label: "מייל", value: request.email, ltr: true },
          { label: "מזהה בקשה", value: request.requestId, ltr: true },
          { label: "מצב", value: isApproved ? "האיפוס מאושר עד סוף היום" : "ממתין לאישור מנהל" }
        ])}
        <p class="adminFocusDescription">האישור באפליקציה מאפשר למשתמש לבחור סיסמה חדשה בלי לעבור דרך המייל.</p>
        <div class="adminFocusPrimaryActions">
          ${isApproved ? "" : `<button type="button" class="adminActionBtn primary" onclick="closeAdminFocusSheet_(); approvePasswordRecoveryForUser_('${escapeJsString(request.email)}')">אישור איפוס סיסמה</button>`}
          ${isApproved ? "" : `<button type="button" class="adminActionBtn secondary" onclick="closeAdminFocusSheet_(); sendPasswordResetForUser_('${escapeJsString(request.email)}')">שליחת קישור במייל</button>`}
        </div>
        <div class="adminFocusSecondaryActions">
          <button type="button" class="adminActionBtn warning" onclick="closeAdminFocusSheet_(); closePasswordResetRequest_('${escapeJsString(request.email)}')">${isApproved ? "ביטול אישור האיפוס" : "סגירה ללא אישור"}</button>
        </div>
      `
    });
    return;
  }

  if (kind === "contact") {
    const request = item.data;
    const name = getContactAddRequestName_(request) || request.email || formatPhoneForDisplay(request.phone) || "איש קשר";
    const isSelfUpdate = request.requestType === "self_update";
    const isContactUpdate = request.requestType === "contact_update";
    const isUpdateRequest = isSelfUpdate || isContactUpdate;
    openAdminFocusSheet_({
      eyebrow: isUpdateRequest ? "בקשת עדכון פרטים" : "בקשת הוספת איש קשר",
      title: name,
      subtitle: formatAdminRelativeTime_(request.createdAt),
      html: `
        ${getPossibleDuplicateWarningHtml_(request)}
        ${getContactRequestDiffHtml_(request)}
        ${renderAdminInfoRows_([
          { label: "תפקיד", value: request.role },
          { label: "מחלקה", value: request.department },
          { label: "טלפון", value: request.phone ? formatPhoneForDisplay(request.phone) : "", ltr: true },
          { label: "מייל", value: request.email, ltr: true },
          { label: "נשלח על ידי", value: request.reporterEmail, ltr: true }
        ])}
        <div class="adminFocusPrimaryActions">
          <button type="button" class="adminActionBtn primary" onclick="closeAdminFocusSheet_(); approveContactAddRequest_('${escapeJsString(request.docId)}')">${isUpdateRequest ? "אישור ועדכון" : request.grantAccessOnApproval === true ? "אישור איש קשר וגישה" : "אישור והוספה"}</button>
          <button type="button" class="adminActionBtn secondary" onclick="closeAdminFocusSheet_(); openContactAddRequestForApproval_('${escapeJsString(request.docId)}')">עריכה לפני אישור</button>
        </div>
        <div class="adminFocusSecondaryActions">
          <button type="button" class="adminActionBtn warning" onclick="closeAdminFocusSheet_(); rejectContactAddRequest_('${escapeJsString(request.docId)}')">דחיית הבקשה</button>
        </div>
      `
    });
    return;
  }

  const report = item.data;
  if (report.subjectType === "intern") {
    const samePublishedList = !report.internVersion ||
      !monthlyInternsState.version ||
      report.internVersion === monthlyInternsState.version;
    const currentIntern = samePublishedList
      ? getMonthlyInternById_(report.internId)
      : null;
    openAdminFocusSheet_({
      eyebrow: "דיווח על סטאז׳ר",
      title: report.contactName || "סטאז׳ר",
      subtitle: formatAdminRelativeTime_(report.createdAt),
      html: `
        ${currentIntern
          ? renderAdminInfoRows_([
              { label: "שם נוכחי", value: currentIntern.name },
              { label: "טלפון נוכחי", value: formatPhoneForDisplay(currentIntern.phone), ltr: true },
              { label: "מחלקה נוכחית", value: currentIntern.department || "ללא מחלקה" }
            ])
          : '<div class="adminFocusNotice warning">הסטאז׳ר כבר אינו מופיע ברשימה הפעילה</div>'}
        ${renderAdminInfoRows_([
          { label: "סוג הדיווח", value: getReportTypeLabel_(report.issueType) },
          { label: "שם בעת הדיווח", value: report.contactName },
          { label: "טלפון בעת הדיווח", value: formatPhoneForDisplay(report.contactPhone), ltr: true },
          { label: "מחלקה בעת הדיווח", value: report.internDepartment || "ללא מחלקה" },
          { label: "דווח על ידי", value: report.reporterEmail, ltr: true }
        ])}
        <div class="adminFocusReportText">${escapeHtml(report.details) || "לא נמסרו פרטים נוספים."}</div>
        <div class="adminFocusPrimaryActions">
          ${currentIntern ? `<button type="button" class="adminActionBtn primary" onclick="openMonthlyInternEditor_('${escapeJsString(currentIntern.id)}', '${escapeJsString(report.docId)}')">עריכת הסטאז׳ר</button>` : ""}
          <button type="button" class="adminActionBtn ${currentIntern ? "secondary" : "primary"}" onclick="closeAdminFocusSheet_(); setContactReportStatus_('${escapeJsString(report.docId)}', 'resolved')">סימון כטופל ללא שינוי</button>
        </div>
      `
    });
    return;
  }
  const matchingContact = adminContacts.find(contact =>
    (report.contactDocId && String(contact.docId) === String(report.contactDocId)) ||
    (report.contactPhone && normalizePhone(contact.phone) === normalizePhone(report.contactPhone))
  ) || null;
  openAdminFocusSheet_({
    eyebrow: "דיווח על פרטים שגויים",
    title: report.contactName || formatPhoneForDisplay(report.contactPhone) || "איש קשר",
    subtitle: formatAdminRelativeTime_(report.createdAt),
    html: `
      ${renderAdminInfoRows_([
        { label: "סוג הדיווח", value: getReportTypeLabel_(report.issueType) },
        { label: "טלפון", value: report.contactPhone ? formatPhoneForDisplay(report.contactPhone) : "", ltr: true },
        { label: "דווח על ידי", value: report.reporterEmail, ltr: true }
      ])}
      <div class="adminFocusReportText">${escapeHtml(report.details) || "לא נמסרו פרטים נוספים."}</div>
      <div class="adminFocusPrimaryActions">
        ${matchingContact ? `<button type="button" class="adminActionBtn primary" onclick="closeAdminFocusSheet_(); openAdminEditModal('${escapeJsString(matchingContact.docId)}')">פתיחת איש הקשר לעריכה</button>` : ""}
        <button type="button" class="adminActionBtn ${matchingContact ? "secondary" : "primary"}" onclick="closeAdminFocusSheet_(); setContactReportStatus_('${escapeJsString(report.docId)}', 'resolved')">סימון הדיווח כטופל</button>
      </div>
    `
  });
}

function renderAdminAttention_() {
  const query = getAdminSearchQuery();
  const items = getAdminAttentionItems_()
    .filter(item => {
      if (adminActiveFilter === "access" && item.kind !== "access") return false;
      if (adminActiveFilter === "reset" && item.kind !== "reset") return false;
      if (adminActiveFilter === "contacts" && item.kind !== "contact") return false;
      if (adminActiveFilter === "reports" && item.kind !== "report") return false;
      return adminAttentionItemMatchesQuery_(item, query);
    });
  const visibleItems = getVisibleAdminItems_(items);

  document.getElementById("adminSummary").textContent =
    items.length === 1
      ? "פריט אחד ממתין לטיפול"
      : `${items.length} פריטים ממתינים לטיפול`;

  if (!items.length) {
    document.getElementById("adminList").innerHTML = `
      <div class="adminFocusEmpty">
        <span aria-hidden="true">✓</span>
        <strong>אין כרגע פריטי ניהול חדשים</strong>
        <small>בקשות ועדכוני עובדים חדשים יופיעו כאן באופן מרוכז.</small>
      </div>
    `;
    return;
  }

  const html = visibleItems.map(renderAdminInboxRow_).join("");

  document.getElementById("adminList").innerHTML =
    html + renderAdminLoadMore_(items.length, visibleItems.length);
}

function getAdminPeople_() {
  const userByEmail = new Map();
  const userByPhone = new Map();
  const matchedUserEmails = new Set();

  adminAllowedUsers.forEach(user => {
    if (user.email) userByEmail.set(normalizeEmail(user.email), user);
    if (user.phone) userByPhone.set(normalizePhone(user.phone), user);
  });

  const people = [...adminContacts, ...adminRemovedContacts].map(contact => {
    const email = normalizeEmail(contact.email || "");
    const phone = normalizePhone(contact.phone || "");
    const user =
      (email && userByEmail.get(email)) ||
      (phone && userByPhone.get(phone)) ||
      null;
    if (user && user.email) matchedUserEmails.add(user.email);
    return { contact, user };
  });

  adminAllowedUsers.forEach(user => {
    if (!matchedUserEmails.has(user.email)) {
      people.push({ contact: null, user });
    }
  });

  return people;
}

function adminPersonMatchesQuery_(person, query) {
  if (!query) return true;
  const { contact, user } = person;
  const accessState = user ? getUserAccessState_(user) : null;
  const searchable = normalizeSearchText([
    contact ? contact.name : "",
    contact ? contact.role : "",
    contact ? contact.dept : "",
    contact ? contact.hospital : "",
    contact ? contact.phone : "",
    contact ? contact.email : "",
    user ? user.email : "",
    user ? user.phone : "",
    accessState ? accessState.label : ""
  ].filter(Boolean).join(" "));
  return searchable.includes(query);
}

function renderAdminPersonManagement_(contact, user) {
  const accessState = user ? getUserAccessState_(user) : null;
  const request = user
    ? getVerificationRequestByEmail_(user.email)
    : null;
  const passwordRecovery = user
    ? getActivePasswordRecoveryForUser_(user.email)
    : null;
  const isSelf = Boolean(
    user && normalizeEmail(user.email) === currentAdminEmail
  );
  const hasPendingRequest = Boolean(
    request &&
    ["pending", "temporary_active"].includes(request.status) &&
    accessState &&
    ["pending", "temporary", "expired"].includes(accessState.key)
  );
  const canForceApproveAccess = canManagerForceApproveAccess_(user);

  const primaryActions = [];
  const additionalActions = [];

  if (contact) {
    if (contact.deleted) {
      primaryActions.push(
        `<button type="button" class="adminActionBtn primary" onclick="restoreAdminContact('${escapeJsString(contact.docId)}')">החזרה לאפליקציה</button>`
      );
    } else {
      primaryActions.push(
        `<button type="button" class="adminActionBtn secondary" onclick="openAdminEditModal('${escapeJsString(contact.docId)}')">עריכת פרטים</button>`
      );
      additionalActions.push(
        `<button type="button" class="adminActionBtn danger" onclick="removeAdminContact('${escapeJsString(contact.docId)}')">הסרה מהאפליקציה</button>`
      );
    }
  }

  let cancelResetAction = "";
  if (user && !isSelf && user.active) {
    if (!passwordRecovery) {
      primaryActions.push(
        `<button type="button" class="adminActionBtn secondary" onclick="preparePasswordRecoveryForUser_('${escapeJsString(user.email)}')">עזרה באיפוס סיסמה</button>`
      );
    } else if (passwordRecovery.status === "pending") {
      primaryActions.push(
        '<button type="button" class="adminActionBtn secondary" onclick="setAdminTab(\'attention\')">מעבר לבקשת האיפוס</button>'
      );
    } else if (passwordRecovery.status === "consuming") {
      primaryActions.push(
        '<button type="button" class="adminActionBtn secondary" disabled>הסיסמה מתעדכנת כעת</button>'
      );
    } else {
      primaryActions.push(
        '<button type="button" class="adminActionBtn secondary" disabled>איפוס מאושר עד 23:59</button>'
      );
      cancelResetAction =
        `<button type="button" class="adminActionBtn warning" onclick="cancelPreparedPasswordRecoveryForUser_('${escapeJsString(user.email)}')">ביטול אישור האיפוס</button>`;
    }
  }

  if (hasPendingRequest) {
    primaryActions.push(
      '<button type="button" class="adminActionBtn primary" onclick="setAdminTab(\'attention\')">מעבר לבקשה שממתינה</button>'
    );
  }
  if (canForceApproveAccess) {
    primaryActions.push(
      `<button type="button" class="adminActionBtn primary" onclick="approveManualAccess_('${escapeJsString(user.email)}', false, true)">אישור כניסה קבוע — גם בלי מייל אימות</button>`
    );
  }

  if (user) {
    if (isSelf) {
      primaryActions.push(
        '<button type="button" class="adminActionBtn secondary" disabled>חשבון המנהל הנוכחי</button>'
      );
    } else {
      additionalActions.unshift(
        `<button type="button" class="adminActionBtn ${user.active ? "warning" : "primary"}" onclick="toggleUserAccess('${escapeJsString(user.email)}', ${!user.active})">${user.active ? "חסימת גישה" : "החזרת גישה"}</button>`,
        `<button type="button" class="adminActionBtn danger" onclick="deleteUserPermission('${escapeJsString(user.email)}')">איפוס מלא של חשבון הכניסה</button>`
      );
      if (user.manualApproved) {
        additionalActions.push(
          `<button type="button" class="adminActionBtn warning" onclick="revokeManualAccess_('${escapeJsString(user.email)}')">ביטול אישור ידני</button>`
        );
      }
      if (cancelResetAction) {
        additionalActions.push(cancelResetAction);
      }
    }
  }

  const contactDetails = contact
    ? [
        contact.role
          ? `<b>תפקיד:</b> ${escapeHtml(contact.role)}`
          : "",
        contact.dept
          ? `<b>מחלקה:</b> ${escapeHtml(contact.dept)}`
          : "",
        contact.hospital
          ? `<b>בית חולים:</b> ${escapeHtml(contact.hospital)}`
          : "",
        contact.email
          ? `<b>מייל:</b> ${escapeHtml(contact.email)}`
          : ""
      ].filter(Boolean).join("<br>")
    : "";

  return `
    <div class="adminPersonManagement">
      ${contactDetails
        ? `<div class="adminCardDetailsList">${contactDetails}</div>`
        : '<p class="adminFocusHelp">לא נמצאה רשומת איש קשר תואמת.</p>'}
      ${accessState && accessState.note
        ? `<p class="adminFocusHelp">${escapeHtml(accessState.note)}</p>`
        : !user
          ? '<p class="adminFocusHelp">אין לאיש הקשר הרשאת כניסה פעילה.</p>'
          : ""}
      <div class="adminCardActions">
        ${primaryActions.join("")}
        ${additionalActions.length
          ? `<details class="adminActionMenu">
               <summary>פעולות נוספות</summary>
               <div class="adminActionMenuBody">
                 ${additionalActions.join("")}
               </div>
             </details>`
          : ""}
      </div>
    </div>
  `;
}

function openAdminPerson_(contactDocId, userEmail) {
  const contact = [...adminContacts, ...adminRemovedContacts].find(item =>
    String(item.docId || "") === String(contactDocId || "")
  ) || null;
  const user = getAllowedUserByEmail(userEmail || (contact && contact.email)) || null;
  if (!contact && !user) {
    setAdminStatus("האדם שבחרתם כבר אינו זמין ברשימה. רעננו את העמוד.", "error");
    return;
  }
  const displayName =
    (contact && contact.name) ||
    (user && getAccountDisplayName_(user.email, user.email)) ||
    formatPhoneForDisplay((contact && contact.phone) || (user && user.phone)) ||
    "ללא שם";
  const email = (user && user.email) || (contact && contact.email) || "";
  const phone = (contact && contact.phone) || (user && user.phone) || "";
  const accessState = user ? getUserAccessState_(user) : null;
  const verificationRequest = user
    ? getEffectiveVerificationRequestForUser_(user)
    : null;
  const passwordRecovery = user
    ? getActivePasswordRecoveryForUser_(user.email)
    : null;
  const isSelf = Boolean(user && normalizeEmail(user.email) === currentAdminEmail);
  const hasPendingAccess = Boolean(
    verificationRequest &&
    ["pending", "temporary_active"].includes(verificationRequest.status) &&
    accessState &&
    ["pending", "temporary", "expired"].includes(accessState.key)
  );
  const canForceApproveAccess = canManagerForceApproveAccess_(user);
  const contactStatus = contact
    ? contact.deleted ? "הוסר מהספר" : "מופיע בספר"
    : "אין רשומת איש קשר";
  const passwordStatus = !user
    ? "אין חשבון עם הרשאת כניסה"
    : !passwordRecovery
      ? "אין בקשת איפוס פעילה"
      : passwordRecovery.status === "pending"
        ? "בקשת איפוס ממתינה"
        : passwordRecovery.status === "consuming"
          ? "הסיסמה מתעדכנת כעת"
          : "איפוס מאושר עד סוף היום";
  const routineContactAction = contact
    ? contact.deleted
      ? `<button type="button" class="adminActionBtn primary" onclick="closeAdminFocusSheet_(); restoreAdminContact('${escapeJsString(contact.docId)}')">החזרה לספר</button>`
      : `<button type="button" class="adminActionBtn secondary" onclick="closeAdminFocusSheet_(); openAdminEditModal('${escapeJsString(contact.docId)}')">עריכת פרטים</button>`
    : "";
  let passwordAction = "";
  if (user && !isSelf && user.active) {
    if (!passwordRecovery) {
      passwordAction = `<button type="button" class="adminActionBtn secondary" onclick="closeAdminFocusSheet_(); preparePasswordRecoveryForUser_('${escapeJsString(user.email)}')">עזרה באיפוס סיסמה</button>`;
    } else if (passwordRecovery.status === "pending") {
      passwordAction = '<button type="button" class="adminActionBtn secondary" onclick="closeAdminFocusSheet_(); setAdminTab(\'attention\')">פתיחת בקשת האיפוס</button>';
    } else if (!["consuming"].includes(passwordRecovery.status)) {
      passwordAction = `<button type="button" class="adminActionBtn warning" onclick="closeAdminFocusSheet_(); cancelPreparedPasswordRecoveryForUser_('${escapeJsString(user.email)}')">ביטול אישור האיפוס</button>`;
    }
  }
  const accessActions = [];
  if (hasPendingAccess) {
    accessActions.push(
      `<button type="button" class="adminActionBtn primary" onclick="approveManualAccess_('${escapeJsString(user.email)}', false, true)">אישור כניסה קבוע — גם בלי מייל אימות</button>`,
      '<button type="button" class="adminActionBtn secondary" onclick="closeAdminFocusSheet_(); setAdminTab(\'attention\')">פתיחת הבקשה המלאה</button>'
    );
  } else if (canForceApproveAccess) {
    accessActions.push(
      `<button type="button" class="adminActionBtn primary" onclick="approveManualAccess_('${escapeJsString(user.email)}', false, true)">אישור כניסה קבוע — גם בלי מייל אימות</button>`
    );
  } else if (user && !isSelf) {
    accessActions.push(
      `<button type="button" class="adminActionBtn ${user.active ? "warning" : "primary"}" onclick="closeAdminFocusSheet_(); toggleUserAccess('${escapeJsString(user.email)}', ${!user.active})">${user.active ? "חסימת גישה" : "החזרת גישה"}</button>`
    );
  }

  const advancedActions = [];
  if (contact && !contact.deleted) {
    advancedActions.push(
      `<button type="button" class="adminActionBtn danger" onclick="closeAdminFocusSheet_(); removeAdminContact('${escapeJsString(contact.docId)}')">הסרה מהאפליקציה</button>`
    );
  }
  if (user && !isSelf) {
    advancedActions.push(
      `<button type="button" class="adminActionBtn danger" onclick="closeAdminFocusSheet_(); deleteUserPermission('${escapeJsString(user.email)}')">איפוס מלא של חשבון הכניסה</button>`
    );
    if (user.manualApproved) {
      advancedActions.push(
        `<button type="button" class="adminActionBtn warning" onclick="closeAdminFocusSheet_(); revokeManualAccess_('${escapeJsString(user.email)}')">ביטול אישור ידני</button>`
      );
    }
  }

  adminActiveFocus = { type: "person", contactDocId, userEmail: email };
  openAdminFocusSheet_({
    eyebrow: "ניהול איש הקשר",
    title: displayName,
    subtitle: [contact && contact.role, contact && contact.dept].filter(Boolean).join(" · ") || email || formatPhoneForDisplay(phone),
    html: `
      ${renderAdminInfoRows_([
        { label: "טלפון", value: phone ? formatPhoneForDisplay(phone) : "", ltr: true },
        { label: "מייל", value: email, ltr: true }
      ])}
      <section class="adminPersonSection">
        <div class="adminPersonSectionHeader">
          <span aria-hidden="true">${getAdminIconSvg_("contact")}</span>
          <div><h4>בספר אנשי הקשר</h4><p>${escapeHtml(contactStatus)}</p></div>
        </div>
        ${contact && (contact.role || contact.dept || contact.hospital) ? `<div class="adminPersonSectionMeta">${escapeHtml([contact.role, contact.dept, contact.hospital].filter(Boolean).join(" · "))}</div>` : ""}
        ${routineContactAction ? `<div class="adminPersonSectionActions">${routineContactAction}</div>` : ""}
      </section>
      <section class="adminPersonSection">
        <div class="adminPersonSectionHeader">
          <span aria-hidden="true">${getAdminIconSvg_("access")}</span>
          <div><h4>גישה לאפליקציה</h4><p>${escapeHtml(accessState ? accessState.label : "ללא הרשאת כניסה")}</p></div>
        </div>
        ${accessState && accessState.note ? `<div class="adminPersonSectionMeta">${escapeHtml(accessState.note)}</div>` : ""}
        ${isSelf ? '<div class="adminPersonSectionMeta">זהו חשבון המנהל הנוכחי.</div>' : ""}
        ${accessActions.length ? `<div class="adminPersonSectionActions">${accessActions.join("")}</div>` : ""}
      </section>
      <section class="adminPersonSection">
        <div class="adminPersonSectionHeader">
          <span aria-hidden="true">${getAdminIconSvg_("reset")}</span>
          <div><h4>סיסמה ואימות</h4><p>${escapeHtml(passwordStatus)}</p></div>
        </div>
        ${passwordAction ? `<div class="adminPersonSectionActions">${passwordAction}</div>` : ""}
      </section>
      ${advancedActions.length ? `
        <details class="adminAdvancedActions">
          <summary>פעולות מתקדמות</summary>
          <p>פעולות אלה משנות או מסירות מידע והרשאות. יש להשתמש בהן רק כשנדרש.</p>
          <div>${advancedActions.join("")}</div>
        </details>
      ` : ""}
    `
  });
}

function renderAdminPeople_() {
  const query = getAdminSearchQuery();
  const people = getAdminPeople_()
    .filter(person => {
      if (
        adminActiveFilter === "access" &&
        (!person.user || !person.user.active)
      ) {
        return false;
      }
      if (
        adminActiveFilter === "restricted" &&
        !(
          (person.contact && person.contact.deleted) ||
          (person.user && !person.user.active)
        )
      ) {
        return false;
      }
      return adminPersonMatchesQuery_(person, query);
    })
    .sort((a, b) => {
      const aLabel =
        (a.contact && a.contact.name) ||
        (a.user && a.user.email) ||
        "";
      const bLabel =
        (b.contact && b.contact.name) ||
        (b.user && b.user.email) ||
        "";
      return aLabel.localeCompare(bLabel, "he");
    });
  const visiblePeople = getVisibleAdminItems_(people);

  document.getElementById("adminSummary").textContent =
    `${people.length === 1 ? "נמצא אדם אחד" : `נמצאו ${people.length} אנשים`}` +
    (visiblePeople.length < people.length
      ? ` · מוצגים ${visiblePeople.length}`
      : "");

  if (!people.length) {
    document.getElementById("adminList").innerHTML =
      '<div class="adminEmpty">לא נמצאו אנשים התואמים לחיפוש.</div>';
    return;
  }

  const html = visiblePeople.map(({ contact, user }) => {
    const displayName =
      (contact && contact.name) ||
      (user && getAccountDisplayName_(user.email, user.email)) ||
      formatPhoneForDisplay(contact && contact.phone) ||
      "ללא שם";
    const email =
      (user && user.email) ||
      (contact && contact.email) ||
      "";
    const phone =
      (contact && contact.phone) ||
      (user && user.phone) ||
      "";
    const accessState = user ? getUserAccessState_(user) : null;

    const secondary = [
      contact && contact.role,
      contact && contact.dept,
      phone && formatPhoneForDisplay(phone),
      email
    ].filter(Boolean);
    return `
      <button type="button" class="adminPersonRow ${(contact && contact.deleted) || (user && !user.active) ? "restricted" : ""}" onclick="openAdminPerson_('${escapeJsString(contact && contact.docId || "")}', '${escapeJsString(user && user.email || email)}')">
        <span class="adminPersonRowContent">
          <strong>${escapeHtml(displayName)}</strong>
          <span>${secondary.map(escapeHtml).join(" · ")}</span>
        </span>
        <span class="adminPersonRowState">
          <span class="adminMiniStatus ${accessState ? escapeHtml(accessState.badgeClass) : ""}">${accessState ? escapeHtml(accessState.label) : "ללא כניסה"}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </span>
      </button>
    `;
  }).join("");

  document.getElementById("adminList").innerHTML =
    html + renderAdminLoadMore_(people.length, visiblePeople.length);
}

function renderAdminMoreActivityHtml_() {
  if (!adminActivity.length) {
    return '<div class="adminEmpty">עדיין לא נרשמה פעילות.</div>';
  }

  return adminActivity.slice(0, 10).map(activity => {
    const category = getActivityCategory(activity.action);
    const target =
      activity.displayName ||
      activity.targetEmail ||
      activity.targetPhone ||
      activity.targetId ||
      "ללא יעד";
    return `
      <div class="adminMoreRow">
        <div>
          <strong>${escapeHtml(getActivityTitle(activity))}</strong>
          <span>${escapeHtml(target)}</span>
        </div>
        <time>${escapeHtml(formatActivityTimestamp(activity))}</time>
      </div>
    `;
  }).join("");
}

function renderAdminMoreManagersHtml_() {
  if (!currentUserIsSuperAdmin) return "";

  const managers = [...adminManagers].sort((a, b) => {
    if (a.role !== b.role) return a.role === "super_admin" ? -1 : 1;
    return a.email.localeCompare(b.email);
  });

  return `
    <details class="adminMoreSection">
      <summary>
        <span>מנהלים</span>
        <small>${escapeHtml(String(managers.length))} מנהלים</small>
      </summary>
      <div class="adminMoreSectionBody">
        <button type="button" class="adminActionBtn primary adminMoreAddManager" onclick="openAddManagerModal()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> הוספת מנהל</button>
        ${managers.map(manager => {
          const contact = findContactByEmail(manager.email);
          const isSuperAdmin = manager.role === "super_admin";
          return `
            <div class="adminMoreManager">
              <div>
                <strong>${escapeHtml(getAccountDisplayName_(manager.email, contact && contact.name ? contact.name : manager.email))}</strong>
                <span>${escapeHtml(manager.email)} · ${isSuperAdmin ? "מנהל־על" : "מנהל רגיל"}</span>
              </div>
              ${isSuperAdmin
                ? '<span class="adminMiniStatus">קבוע</span>'
                : `<details class="adminActionMenu">
                     <summary>פעולות</summary>
                     <div class="adminActionMenuBody">
                       <button type="button" class="adminActionBtn danger" onclick="removeManager('${escapeJsString(manager.email)}')">הסרת מנהל</button>
                     </div>
                   </details>`}
            </div>
          `;
        }).join("")}
      </div>
    </details>
  `;
}

function formatMonthlyInternMonthLabel_(monthValue) {
  const match = String(monthValue || "").match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
  if (!match) return "חודש לא ידוע";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: MONTHLY_INTERNS_TIME_ZONE,
    year: "numeric",
    month: "long"
  }).format(new Date(`${match[1]}-${match[2]}-15T12:00:00`));
}

function getPublishedInternCount_(data) {
  return Array.isArray(data && data.entries) ? data.entries.length : 0;
}

function renderAdminInternsSystemCard_() {
  const active = adminMonthlyInternsActive;
  const activeCount = getPublishedInternCount_(active);
  const activeLabel = active
    ? String(active.monthLabel || formatMonthlyInternMonthLabel_(active.monthKey))
    : "טרם פורסמה רשימה";
  const previousCount = getPublishedInternCount_(adminMonthlyInternsPrevious);
  return `
    <section class="adminSystemFeatureCard adminInternsSystemCard">
      <span class="adminSystemFeatureIcon" aria-hidden="true">${getAdminIconSvg_("contact")}</span>
      <div class="adminSystemFeatureContent">
        <div class="adminSystemFeatureHeading">
          <div><h3>סטאז׳רים החודש</h3><p>${escapeHtml(activeLabel)}${active ? ` · ${escapeHtml(String(activeCount))} ברשימה` : ""}</p></div>
          ${active ? '<span class="adminMiniStatus">פעיל</span>' : '<span class="adminMiniStatus pending">לא פורסם</span>'}
        </div>
        <p class="adminSystemFeatureDescription">העלאת Excel יוצרת רשימת חיוג ו־WhatsApp בלבד. היא אינה מוסיפה משתמשים או הרשאות.</p>
        <div class="adminSystemFeatureActions">
          <button type="button" class="adminActionBtn primary" onclick="openMonthlyInternsAdmin_()">ניהול והעלאת Excel</button>
          ${previousCount ? `<button type="button" class="adminActionBtn secondary" onclick="rollbackMonthlyInterns_()">שחזור הרשימה הקודמת</button>` : ""}
        </div>
      </div>
    </section>
  `;
}

function renderAdminSystem_() {
  const todayKey = getIsraelDateKey_();
  const activeUsersByDate = new Map(
    adminDailyActiveUsers.map(item => [item.date, item.activeUserCount])
  );
  const todayActiveUsers = activeUsersByDate.get(todayKey) || 0;
  document.getElementById("adminSummary").textContent = "";
  document.getElementById("adminList").innerHTML = `
    <div class="adminMorePage">
      <section class="adminDailyUseCard" aria-label="שימוש היום">
        <span class="adminDailyUseValue">${escapeHtml(String(todayActiveUsers))}</span>
        <div>
          <strong>אנשים השתמשו באפליקציה היום</strong>
          <small>כל משתמש נספר פעם אחת בלבד.</small>
        </div>
      </section>

      ${renderAdminInternsSystemCard_()}

      <details class="adminMoreSection" open>
        <summary>
          <span>פעילות אחרונה</span>
          <small>${escapeHtml(String(Math.min(10, adminActivity.length)))} פעולות</small>
        </summary>
        <div class="adminMoreSectionBody">
          ${renderAdminMoreActivityHtml_()}
        </div>
      </details>

      ${renderAdminMoreManagersHtml_()}

      <button type="button" id="adminRefreshBtn" class="adminRefreshBtn adminMoreRefresh" onclick="refreshAdminPage()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8.2A7 7 0 0 1 18.7 7M17.9 15.8A7 7 0 0 1 5.3 17"/></svg> רענון נתוני העמוד</button>
    </div>
  `;
}

function requestAdminConfirmation_(options = {}) {
  const modal = document.getElementById("adminConfirmModal");
  if (!modal) return Promise.resolve(false);
  if (adminConfirmationResolve) {
    adminConfirmationResolve(false);
    adminConfirmationResolve = null;
  }
  document.getElementById("adminConfirmTitle").textContent =
    options.title || "אישור פעולה";
  document.getElementById("adminConfirmMessage").textContent =
    options.message || "האם להמשיך?";
  const actionButton = document.getElementById("adminConfirmActionBtn");
  actionButton.textContent = options.confirmLabel || "אישור";
  actionButton.className = `adminActionBtn ${options.tone === "warning" ? "warning" : options.tone === "primary" ? "primary" : "danger"}`;
  modal.classList.add("visible");
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => actionButton.focus(), 60);
  return new Promise(resolve => {
    adminConfirmationResolve = resolve;
  });
}

function resolveAdminConfirmation_(approved) {
  const modal = document.getElementById("adminConfirmModal");
  if (modal) {
    modal.classList.remove("visible");
    modal.setAttribute("aria-hidden", "true");
  }
  const resolve = adminConfirmationResolve;
  adminConfirmationResolve = null;
  if (resolve) resolve(Boolean(approved));
}

function openMonthlyInternsAdmin_() {
  if (!currentUserIsAdmin) return;
  monthlyInternsImportState = {
    phase: "idle",
    fileName: "",
    analysis: null,
    parsed: null,
    monthValue: "",
    error: ""
  };
  const modal = document.getElementById("monthlyInternsAdminModal");
  modal.classList.add("visible");
  modal.setAttribute("aria-hidden", "false");
  renderMonthlyInternsAdmin_();
}

function closeMonthlyInternsAdmin_() {
  const modal = document.getElementById("monthlyInternsAdminModal");
  if (modal) {
    modal.classList.remove("visible");
    modal.setAttribute("aria-hidden", "true");
  }
  const input = document.getElementById("monthlyInternsWorkbookInput");
  if (input) input.value = "";
}

function chooseMonthlyInternsWorkbook_() {
  const input = document.getElementById("monthlyInternsWorkbookInput");
  if (input) input.click();
}

function loadXlsxLibrary_() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxLibraryLoadPromise) return xlsxLibraryLoadPromise;
  xlsxLibraryLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-xlsx-vendor="0.20.3"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.XLSX), { once: true });
      existing.addEventListener("error", () => reject(new Error("XLSX_LOAD_FAILED")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = XLSX_VENDOR_URL;
    script.async = true;
    script.dataset.xlsxVendor = "0.20.3";
    script.onload = () => window.XLSX
      ? resolve(window.XLSX)
      : reject(new Error("XLSX_GLOBAL_MISSING"));
    script.onerror = () => reject(new Error("XLSX_LOAD_FAILED"));
    document.head.appendChild(script);
  }).catch(error => {
    xlsxLibraryLoadPromise = null;
    throw error;
  });
  return xlsxLibraryLoadPromise;
}

function getKnownInternDepartments_() {
  return [...new Set(
    contacts.map(contact => String(contact.dept || "").trim()).filter(Boolean)
  )];
}

async function handleMonthlyInternsWorkbookSelected_(event) {
  const file = event && event.target && event.target.files
    ? event.target.files[0]
    : null;
  if (!file) return;
  if (!/\.xlsx$/i.test(file.name || "")) {
    monthlyInternsImportState = {
      ...monthlyInternsImportState,
      phase: "error",
      error: "יש לבחור קובץ Excel בפורמט ‎.xlsx."
    };
    renderMonthlyInternsAdmin_();
    return;
  }
  monthlyInternsImportState = {
    phase: "loading",
    fileName: file.name,
    analysis: null,
    parsed: null,
    monthValue: "",
    error: ""
  };
  renderMonthlyInternsAdmin_();
  try {
    const [xlsx, arrayBuffer] = await Promise.all([
      loadXlsxLibrary_(),
      file.arrayBuffer()
    ]);
    const workbook = xlsx.read(arrayBuffer, {
      type: "array",
      cellDates: false,
      cellText: true
    });
    const analysis = window.InternWorkbookImporter.analyzeWorkbook(
      workbook,
      xlsx,
      {
        normalizePhone,
        knownDepartments: getKnownInternDepartments_()
      }
    );
    const monthValue = window.InternWorkbookImporter.inferMonthYear(
      file.name,
      analysis.tables,
      new Date()
    );
    monthlyInternsImportState = {
      phase: analysis.status === "ready" ? "preview" : "mapping",
      fileName: file.name,
      analysis,
      parsed: analysis.parsed,
      monthValue,
      selectedSheet: analysis.selectedSheet || (analysis.tables[0] && analysis.tables[0].name) || "",
      error: analysis.status === "empty"
        ? "לא נמצאו בקובץ שורות הכוללות שם ומספר טלפון תקין."
        : ""
    };
    renderMonthlyInternsAdmin_();
  } catch (error) {
    console.error("Monthly interns workbook parsing failed", error);
    monthlyInternsImportState = {
      ...monthlyInternsImportState,
      phase: "error",
      error: "לא הצלחנו לקרוא את קובץ ה־Excel. ודאו שהוא תקין ונסו שוב."
    };
    renderMonthlyInternsAdmin_();
  }
}

function selectMonthlyInternsMappingSheet_(sheetName) {
  monthlyInternsImportState.selectedSheet = String(sheetName || "");
  renderMonthlyInternsAdmin_();
}

function getMonthlyInternMappingDefaults_() {
  const analysis = monthlyInternsImportState.analysis;
  const selectedSheet = monthlyInternsImportState.selectedSheet;
  const selectedAnalysis = analysis && analysis.analyses
    ? analysis.analyses.find(item => item.table.name === selectedSheet)
    : null;
  return selectedAnalysis && selectedAnalysis.mapping
    ? selectedAnalysis.mapping
    : { nameColumn: null, phoneColumn: null, departmentColumn: null };
}

function renderMonthlyInternColumnOptions_(options, selectedIndex, includeNone) {
  const noneOption = includeNone ? '<option value="">ללא מחלקה</option>' : '<option value="">בחירה</option>';
  return noneOption + options.map(option => `
    <option value="${escapeHtml(String(option.columnIndex))}" ${option.columnIndex === selectedIndex ? "selected" : ""}>${escapeHtml(option.label)}</option>
  `).join("");
}

function applyMonthlyInternsManualMapping_() {
  const analysis = monthlyInternsImportState.analysis;
  const sheetName = document.getElementById("internMappingSheet").value;
  const nameValue = document.getElementById("internMappingName").value;
  const phoneValue = document.getElementById("internMappingPhone").value;
  const departmentValue = document.getElementById("internMappingDepartment").value;
  try {
    const parsed = window.InternWorkbookImporter.parseManualMapping(
      analysis,
      {
        sheetName,
        nameColumn: nameValue === "" ? null : Number(nameValue),
        phoneColumn: phoneValue === "" ? null : Number(phoneValue),
        departmentColumn: departmentValue === "" ? null : Number(departmentValue)
      },
      { normalizePhone }
    );
    if (!parsed.entries.length) {
      throw new Error("לא נמצאו שורות תקינות לפי המיפוי שנבחר.");
    }
    monthlyInternsImportState = {
      ...monthlyInternsImportState,
      phase: "preview",
      selectedSheet: sheetName,
      parsed,
      error: ""
    };
    renderMonthlyInternsAdmin_();
  } catch (error) {
    monthlyInternsImportState.error = error && error.message
      ? error.message
      : "המיפוי שבחרתם אינו תקין.";
    renderMonthlyInternsAdmin_();
  }
}

function renderMonthlyInternPreviewRows_(entries) {
  const visibleEntries = entries.slice(0, 100);
  return visibleEntries.map(entry => `
    <div class="internPreviewRow">
      <div><strong>${escapeHtml(entry.name)}</strong>${entry.department ? `<span>${escapeHtml(entry.department)}</span>` : ""}</div>
      <span dir="ltr">${escapeHtml(formatPhoneForDisplay(entry.phone))}</span>
    </div>
  `).join("") + (entries.length > visibleEntries.length
    ? `<div class="internPreviewMore">ועוד ${escapeHtml(String(entries.length - visibleEntries.length))} רשומות</div>`
    : "");
}

function renderMonthlyInternsAdmin_() {
  const body = document.getElementById("monthlyInternsAdminBody");
  if (!body) return;
  const state = monthlyInternsImportState;
  const active = adminMonthlyInternsActive;

  if (state.phase === "loading" || state.phase === "publishing") {
    body.innerHTML = `
      <div class="internImportProgress" role="status">
        <span class="internImportProgressIcon" aria-hidden="true">${getAdminIconSvg_(state.phase === "loading" ? "system" : "contact")}</span>
        <strong>${state.phase === "loading" ? "קורא את קובץ ה־Excel" : "מפרסם את הרשימה"}</strong>
        <span>${state.phase === "loading" ? "הקובץ נשאר במכשיר; רק התוצאה הנקייה תישמר." : "הרשימה הקודמת נשמרת עד שההחלפה מסתיימת."}</span>
      </div>
    `;
    return;
  }

  if (state.phase === "success") {
    body.innerHTML = `
      <div class="internImportSuccess">
        <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.2 4.2L19 7"/></svg></span>
        <h4>הרשימה פורסמה בהצלחה</h4>
        <p>${escapeHtml(formatMonthlyInternMonthLabel_(state.monthValue))} · ${escapeHtml(String(state.parsed.entries.length))} סטאז׳רים</p>
        <button type="button" class="adminActionBtn primary" onclick="closeMonthlyInternsAdmin_()">סיום</button>
      </div>
    `;
    return;
  }

  if (state.phase === "mapping") {
    const analysis = state.analysis;
    const selectedTable = analysis && analysis.tables
      ? analysis.tables.find(table => table.name === state.selectedSheet) || analysis.tables[0]
      : null;
    const options = selectedTable
      ? window.InternWorkbookImporter.getMappingOptions(selectedTable)
      : [];
    const defaults = getMonthlyInternMappingDefaults_();
    body.innerHTML = `
      <div class="internImportIntro compact">
        <span class="internImportSafetyIcon" aria-hidden="true">${getAdminIconSvg_("system")}</span>
        <div><h4>נדרש מיפוי קצר</h4><p>לא הצלחנו לזהות בוודאות את מבנה הקובץ. בחרו רק שם וטלפון; מחלקה אינה חובה.</p></div>
      </div>
      ${state.error ? `<div class="internImportError">${escapeHtml(state.error)}</div>` : ""}
      <div class="adminFormGrid internMappingGrid">
        <div class="adminFormField full">
          <label for="internMappingSheet">גיליון</label>
          <select id="internMappingSheet" onchange="selectMonthlyInternsMappingSheet_(this.value)">
            ${(analysis && analysis.tables || []).map(table => `<option value="${escapeHtml(table.name)}" ${table.name === (selectedTable && selectedTable.name) ? "selected" : ""}>${escapeHtml(table.name)}</option>`).join("")}
          </select>
        </div>
        <div class="adminFormField">
          <label for="internMappingName">עמודת שם</label>
          <select id="internMappingName">${renderMonthlyInternColumnOptions_(options, defaults.nameColumn, false)}</select>
        </div>
        <div class="adminFormField">
          <label for="internMappingPhone">עמודת טלפון</label>
          <select id="internMappingPhone">${renderMonthlyInternColumnOptions_(options, defaults.phoneColumn, false)}</select>
        </div>
        <div class="adminFormField full">
          <label for="internMappingDepartment">עמודת מחלקה — לא חובה</label>
          <select id="internMappingDepartment">${renderMonthlyInternColumnOptions_(options, defaults.departmentColumn, true)}</select>
        </div>
      </div>
      <div class="adminModalActions">
        <button type="button" class="adminActionBtn secondary" onclick="chooseMonthlyInternsWorkbook_()">בחירת קובץ אחר</button>
        <button type="button" class="adminActionBtn primary" onclick="applyMonthlyInternsManualMapping_()">יצירת תצוגה מקדימה</button>
      </div>
    `;
    return;
  }

  if (state.phase === "preview" && state.parsed) {
    const parsed = state.parsed;
    body.innerHTML = `
      <div class="internPreviewSummary">
        <div><span>נמצאו</span><strong>${escapeHtml(String(parsed.entries.length))}</strong><span>סטאז׳רים</span></div>
        <p>${escapeHtml(state.fileName)}</p>
      </div>
      <div class="adminFormField full internMonthField">
        <label for="internPublicationMonth">חודש הפרסום</label>
        <input id="internPublicationMonth" type="month" value="${escapeHtml(state.monthValue)}" min="2020-01" max="2100-12" onchange="monthlyInternsImportState.monthValue = this.value">
      </div>
      <div class="internPreviewStats">
        <span>${escapeHtml(String(parsed.entries.length))} ייכנסו לרשימה</span>
        <span>${escapeHtml(String(parsed.rejected.length))} שורות דולגו</span>
        ${parsed.duplicates ? `<span>${escapeHtml(String(parsed.duplicates))} כפילויות אוחדו</span>` : ""}
      </div>
      ${parsed.warnings.length ? `<div class="internImportWarning">נמצאו ${escapeHtml(String(parsed.warnings.length))} מספרים עם שמות שונים. השם הראשון נשמר בתצוגה המקדימה.</div>` : ""}
      <div class="internPreviewList">${renderMonthlyInternPreviewRows_(parsed.entries)}</div>
      <div class="internAccessBoundary"><strong>ללא שינוי הרשאות</strong><span>הפרסום אינו מוסיף משתמשים, אנשי קשר או גישה לאפליקציה.</span></div>
      <div class="adminModalActions">
        <button type="button" class="adminActionBtn secondary" onclick="chooseMonthlyInternsWorkbook_()">בחירת קובץ אחר</button>
        <button type="button" class="adminActionBtn primary" onclick="publishMonthlyInterns_()">החלפה ופרסום</button>
      </div>
    `;
    return;
  }

  const error = state.phase === "error" ? state.error : "";
  body.innerHTML = `
    <div class="internImportIntro">
      <span class="internImportSafetyIcon" aria-hidden="true">${getAdminIconSvg_("contact")}</span>
      <div>
        <h4>העלאת קובץ Excel</h4>
        <p>המערכת תזהה שם, טלפון ומחלקה, ותציג תצוגה מקדימה לפני פרסום.</p>
      </div>
    </div>
    ${active ? `<div class="internCurrentList"><span>הרשימה הפעילה</span><strong>${escapeHtml(String(active.monthLabel || formatMonthlyInternMonthLabel_(active.monthKey)))}</strong><small>${escapeHtml(String(getPublishedInternCount_(active)))} סטאז׳רים</small></div>` : '<div class="internCurrentList empty"><span>עדיין לא פורסמה רשימה</span></div>'}
    ${error ? `<div class="internImportError">${escapeHtml(error)}</div>` : ""}
    <div class="internAccessBoundary"><strong>רשימת תצוגה בלבד</strong><span>הקובץ אינו משנה אנשי קשר, משתמשים, סיסמאות או הרשאות כניסה.</span></div>
    <button type="button" class="adminActionBtn primary internChooseFileBtn" onclick="chooseMonthlyInternsWorkbook_()">העלאת קובץ Excel</button>
  `;
}

function sanitizePublishedInternEntries_(entries) {
  const unique = new Map();
  (Array.isArray(entries) ? entries : []).forEach(entry => {
    const name = String(entry && entry.name || "").trim();
    const phone = normalizePhone(entry && entry.phone || "");
    const department = String(entry && entry.department || "").trim();
    if (!name || !isValidPhoneForRouting_(phone)) return;
    if (!unique.has(phone)) {
      unique.set(phone, {
        id: String(entry && entry.id || createMonthlyInternId_(name, phone)),
        name,
        phone,
        department
      });
    }
  });
  return [...unique.values()];
}

async function publishMonthlyInterns_() {
  if (!currentUserIsAdmin || !firebaseApi || !db) return;
  const state = monthlyInternsImportState;
  const monthValue = String(
    document.getElementById("internPublicationMonth")?.value || state.monthValue || ""
  );
  const entries = sanitizePublishedInternEntries_(state.parsed && state.parsed.entries);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(monthValue)) {
    state.error = "יש לבחור חודש פרסום תקין.";
    renderMonthlyInternsAdmin_();
    return;
  }
  if (!entries.length) {
    state.error = "אין ברשימה שורות תקינות לפרסום.";
    renderMonthlyInternsAdmin_();
    return;
  }
  if (entries.length > MONTHLY_INTERNS_MAX_RECORDS) {
    state.error = `ניתן לפרסם עד ${MONTHLY_INTERNS_MAX_RECORDS} רשומות בחודש.`;
    renderMonthlyInternsAdmin_();
    return;
  }
  const confirmed = await requestAdminConfirmation_({
    title: "החלפת רשימת הסטאז׳רים",
    message: `הרשימה הפעילה תוחלף ב-${entries.length} סטאז׳רים עבור ${formatMonthlyInternMonthLabel_(monthValue)}. הרשימה הנוכחית תישמר לשחזור.`,
    confirmLabel: "החלפה ופרסום",
    tone: "primary"
  });
  if (!confirmed) return;

  monthlyInternsImportState = { ...state, phase: "publishing", monthValue };
  renderMonthlyInternsAdmin_();
  const activeRef = firebaseApi.doc(
    db,
    MONTHLY_INTERNS_COLLECTION_NAME,
    MONTHLY_INTERNS_ACTIVE_DOCUMENT_ID
  );
  const previousRef = firebaseApi.doc(
    db,
    MONTHLY_INTERNS_COLLECTION_NAME,
    MONTHLY_INTERNS_PREVIOUS_DOCUMENT_ID
  );
  const version = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const payload = {
    kind: "monthly_interns_active",
    schemaVersion: MONTHLY_INTERNS_SCHEMA_VERSION,
    version,
    monthKey: monthValue,
    monthLabel: formatMonthlyInternMonthLabel_(monthValue),
    entries,
    recordCount: entries.length,
    sourceFileName: String(state.fileName || "").slice(0, 240),
    publishedAt: firebaseApi.serverTimestamp(),
    publishedBy: currentAdminEmail
  };
  try {
    await firebaseApi.runTransaction(db, async transaction => {
      const currentSnapshot = await transaction.get(activeRef);
      if (currentSnapshot.exists()) {
        transaction.set(previousRef, {
          ...currentSnapshot.data(),
          kind: "monthly_interns_previous",
          snapshotSavedAt: firebaseApi.serverTimestamp(),
          snapshotSavedBy: currentAdminEmail
        });
      }
      transaction.set(activeRef, payload);
    });
    adminMonthlyInternsPrevious = adminMonthlyInternsActive;
    adminMonthlyInternsActive = {
      ...payload,
      publishedAt: new Date(),
      entries
    };
    monthlyInternsState = {
      status: "ready",
      descriptor: getMonthlyInternsDescriptorFromData_(adminMonthlyInternsActive, getCurrentMonthlyInternsDescriptor_()),
      version,
      entries
    };
    renderMonthlyInterns_();
    logAdminAction("monthly_interns_publish", "", monthValue).catch(() => {});
    monthlyInternsImportState = {
      ...state,
      phase: "success",
      monthValue,
      parsed: { ...state.parsed, entries }
    };
    renderMonthlyInternsAdmin_();
    if (adminActiveTab === "system") renderAdminSystem_();
  } catch (error) {
    console.error("Monthly interns publication failed", error);
    monthlyInternsImportState = {
      ...state,
      phase: "error",
      monthValue,
      error: "הפרסום נכשל. הרשימה הפעילה הקודמת לא השתנתה."
    };
    renderMonthlyInternsAdmin_();
  }
}

async function rollbackMonthlyInterns_() {
  if (!currentUserIsAdmin || !adminMonthlyInternsPrevious) return;
  const previousLabel = String(
    adminMonthlyInternsPrevious.monthLabel ||
    formatMonthlyInternMonthLabel_(adminMonthlyInternsPrevious.monthKey)
  );
  const confirmed = await requestAdminConfirmation_({
    title: "שחזור הרשימה הקודמת",
    message: `הרשימה הפעילה תוחלף ברשימת ${previousLabel}. הרשימה הנוכחית תישמר כרשימת החזרה הבאה.`,
    confirmLabel: "שחזור הרשימה",
    tone: "warning"
  });
  if (!confirmed) return;
  const activeRef = firebaseApi.doc(db, MONTHLY_INTERNS_COLLECTION_NAME, MONTHLY_INTERNS_ACTIVE_DOCUMENT_ID);
  const previousRef = firebaseApi.doc(db, MONTHLY_INTERNS_COLLECTION_NAME, MONTHLY_INTERNS_PREVIOUS_DOCUMENT_ID);
  try {
    await firebaseApi.runTransaction(db, async transaction => {
      const [activeSnapshot, previousSnapshot] = await Promise.all([
        transaction.get(activeRef),
        transaction.get(previousRef)
      ]);
      if (!previousSnapshot.exists()) throw new Error("NO_PREVIOUS_INTERNS_LIST");
      const current = activeSnapshot.exists() ? activeSnapshot.data() : null;
      const restored = previousSnapshot.data();
      transaction.set(activeRef, {
        ...restored,
        kind: "monthly_interns_active",
        version: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        publishedAt: firebaseApi.serverTimestamp(),
        publishedBy: currentAdminEmail,
        restoredFromPrevious: true
      });
      if (current) {
        transaction.set(previousRef, {
          ...current,
          kind: "monthly_interns_previous",
          snapshotSavedAt: firebaseApi.serverTimestamp(),
          snapshotSavedBy: currentAdminEmail
        });
      }
    });
    const current = adminMonthlyInternsActive;
    adminMonthlyInternsActive = {
      ...adminMonthlyInternsPrevious,
      kind: "monthly_interns_active",
      publishedAt: new Date(),
      publishedBy: currentAdminEmail,
      restoredFromPrevious: true
    };
    adminMonthlyInternsPrevious = current;
    monthlyInternsState = {
      status: "ready",
      descriptor: getMonthlyInternsDescriptorFromData_(adminMonthlyInternsActive, getCurrentMonthlyInternsDescriptor_()),
      version: String(adminMonthlyInternsActive.version || ""),
      entries: (adminMonthlyInternsActive.entries || []).map(normalizeMonthlyInternEntry_)
    };
    renderMonthlyInterns_();
    logAdminAction("monthly_interns_rollback", "", adminMonthlyInternsActive.monthKey || "").catch(() => {});
    renderAdminSystem_();
    setAdminStatus("הרשימה הקודמת שוחזרה בהצלחה.", "success");
  } catch (error) {
    console.error("Monthly interns rollback failed", error);
    setAdminStatus("השחזור נכשל. הרשימה הפעילה לא השתנתה.", "error");
  }
}

async function refreshAdminPage() {
  if (
    !currentUserIsAdmin ||
    adminSectionLoadPromises.has(adminActiveTab)
  ) {
    return;
  }

  const button = document.getElementById("adminRefreshBtn");
  if (button) {
    button.disabled = true;
    button.textContent = "מרענן...";
  }

  try {
    await flushUsageMetrics_();
    await loadAdminData({
      section: adminActiveTab,
      force: true
    });
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8.2A7 7 0 0 1 18.7 7M17.9 15.8A7 7 0 0 1 5.3 17"/></svg> רענון נתוני העמוד';
    }
  }
}

function renderAdminList() {
  if (!currentUserIsAdmin) return;

  if (!adminLoadedSections.has(adminActiveTab)) {
    renderAdminLoading_(adminActiveTab);
    return;
  }

  updateAdminFilterButtons();

  if (adminActiveTab === "people") {
    renderAdminPeople_();
  } else if (adminActiveTab === "system") {
    renderAdminSystem_();
  } else {
    renderAdminAttention_();
  }
}

function getVisibleAdminItems_(items) {
  return items.slice(0, adminVisibleItemCount);
}

function renderAdminLoadMore_(totalCount, visibleCount) {
  if (visibleCount >= totalCount) return "";

  const remaining = totalCount - visibleCount;
  return `
    <div class="adminLoadMore">
      <button type="button" class="adminLoadMoreBtn" onclick="showMoreAdminItems_()">
        הצגת עוד ${escapeHtml(Math.min(ADMIN_LIST_PAGE_SIZE, remaining))} מתוך ${escapeHtml(remaining)}
      </button>
    </div>
  `;
}

function showMoreAdminItems_() {
  adminVisibleItemCount += ADMIN_LIST_PAGE_SIZE;
  renderAdminList();
}

function renderAdminContacts() {
  const query = getAdminSearchQuery();
  let items = [];

  if (adminActiveFilter !== "removed") {
    items.push(...adminContacts.map(contact => ({
      ...contact,
      deleted: false
    })));
  }

  if (adminActiveFilter !== "active") {
    items.push(...adminRemovedContacts.map(contact => ({
      ...contact,
      deleted: true
    })));
  }

  items = items
    .filter(contact => adminContactMatchesQuery(contact, query))
    .sort(compareContactsByName);

  const visibleItems = getVisibleAdminItems_(items);
  document.getElementById("adminSummary").textContent =
    items.length === 1
      ? "נמצא איש קשר אחד"
      : `נמצאו ${items.length} אנשי קשר` +
        (visibleItems.length < items.length
          ? ` · מוצגים ${visibleItems.length}`
          : "");

  if (!items.length) {
    document.getElementById("adminList").innerHTML =
      '<div class="adminEmpty">לא נמצאו אנשי קשר התואמים לחיפוש.</div>';
    return;
  }

  const contactsHtml = visibleItems.map(contact => {
    const accessAction = contact.email && normalizeEmail(contact.email) !== currentAdminEmail
      ? `<button type="button" class="adminActionBtn secondary" onclick="openAdminPermissionForEmail_('${escapeJsString(contact.email)}')">פתיחת הרשאה</button>`
      : "";
    const details = [
      contact.dept ? `<b>מחלקה:</b> ${escapeHtml(contact.dept)}` : "",
      contact.hospital ? `<b>בית חולים:</b> ${escapeHtml(contact.hospital)}` : "",
      contact.email ? `<b>מייל:</b> ${escapeHtml(contact.email)}` : ""
    ].filter(Boolean).join("<br>") || "אין פרטים נוספים.";

    return `
      <div class="adminCard ${contact.deleted ? "removed" : ""}">
        <div class="adminCardTop">
          <div>
            <div class="adminCardName">${escapeHtml(contact.name || formatPhoneForDisplay(contact.phone))}</div>
            <div class="adminCardMeta">
              ${contact.role ? escapeHtml(contact.role) + "<br>" : ""}
              ${escapeHtml(formatPhoneForDisplay(contact.phone))}
            </div>
          </div>
          <span class="adminStatusBadge ${contact.deleted ? "removed" : ""}">${contact.deleted ? "הוסר" : "מופיע"}</span>
        </div>

        <details class="adminCardMore" ${contact.deleted ? "open" : ""}>
          <summary>פרטים ופעולות</summary>
          <div class="adminCardMoreBody">
            <div class="adminCardDetailsList">${details}</div>
            <div class="adminCardActions">
              ${contact.deleted
                ? `<button type="button" class="adminActionBtn primary" onclick="restoreAdminContact('${escapeJsString(contact.docId)}')">החזרה לאפליקציה</button>`
                : `<button type="button" class="adminActionBtn secondary" onclick="openAdminEditModal('${escapeJsString(contact.docId)}')">עריכת פרטים</button>`}
              ${accessAction}
              ${contact.deleted ? "" : `
                <details class="adminActionMenu">
                  <summary>פעולות נוספות</summary>
                  <div class="adminActionMenuBody">
                    <button type="button" class="adminActionBtn danger" onclick="removeAdminContact('${escapeJsString(contact.docId)}')">הסרה מהאפליקציה</button>
                  </div>
                </details>`}
            </div>
          </div>
        </details>
      </div>
    `;
  }).join("");

  document.getElementById("adminList").innerHTML =
    contactsHtml + renderAdminLoadMore_(items.length, visibleItems.length);
}

function openAdminPermissionForEmail_(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  setAdminTab("people");
  const searchInput = document.getElementById("adminSearchInput");
  if (searchInput) {
    searchInput.value = normalizedEmail;
  }
  resetAdminVisibleItems_();
  if (adminLoadedSections.has("people")) {
    renderAdminList();
  }
}

function getVerificationRequestByEmail_(email) {
  const normalized = normalizeEmail(email);
  return adminVerificationRequests.find(
    request => normalizeEmail(request.email) === normalized
  ) || null;
}

function getEffectiveVerificationRequestForUser_(user) {
  const request = getVerificationRequestByEmail_(user && user.email);
  if (request) return request;

  if (
    !user ||
    user.accessReviewRequired !== true ||
    !["", "pending", "temporary_active"].includes(
      String(user.accessReviewStatus || "")
    )
  ) {
    return null;
  }

  return {
    docId: normalizeEmail(user.email),
    email: normalizeEmail(user.email),
    status: user.accessReviewStatus === "temporary_active"
      ? "temporary_active"
      : "pending",
    requestType: "access_review",
    requestedAt: user.accessGrantedAt || user.updatedAt || null,
    updatedAt: user.updatedAt || null,
    temporaryAccessUntil: user.temporaryAccessUntil || null,
    synthetic: true
  };
}

function getUserAccessState_(user) {
  const request = getEffectiveVerificationRequestForUser_(user);
  const isAdminAccount = normalizeEmail(user && user.email) === currentAdminEmail ||
    adminManagers.some(manager =>
      manager.active && normalizeEmail(manager.email) === normalizeEmail(user && user.email)
    );

  if (!user || user.active !== true) {
    return { key: "blocked", label: "גישה חסומה", note: "המשתמש אינו יכול להיכנס לאפליקציה.", badgeClass: "blocked" };
  }

  if (!isAdminAccount && !user.phonePermissionActive) {
    return {
      key: "phone_missing",
      label: "חסר קישור פעיל למספר טלפון",
      note: user.phone
        ? "הרשאת המייל קיימת אך הרשאת הטלפון חסרה או אינה תואמת."
        : "לא נשמר מספר טלפון בהרשאת המשתמש.",
      badgeClass: "blocked"
    };
  }

  if (user.accessReviewRequired) {
    const temporaryUntil = getAdminTimestampMillis_(
      user.temporaryAccessUntil
    );
    const status = String(user.accessReviewStatus || "");

    if (
      status === "pending" &&
      String(user.accessLevel || "") === "provisional"
    ) {
      return {
        key: "pending",
        label: "גישה זמנית פעילה — ממתין לאישור קבוע",
        note: user.provisionalAt
          ? "גישה זמנית מאז " + formatAdminTimestamp_(user.provisionalAt)
          : "המשתמש יכול להיכנס, ללא הורדה מרוכזת.",
        badgeClass: "pending"
      };
    }

    if (
      status === "temporary_active" &&
      temporaryUntil > Date.now()
    ) {
      return {
        key: "temporary",
        label: "גישה זמנית פעילה עד 23:59",
        note:
          "הגישה מסתיימת היום ב־" +
          formatAdminTimestamp_(user.temporaryAccessUntil),
        badgeClass: "pending"
      };
    }

    if (["rejected", "revoked"].includes(status)) {
      return {
        key: "rejected",
        label: status === "revoked"
          ? "הגישה הזמנית בוטלה"
          : "בקשת הגישה נדחתה",
        note: "נדרש אישור חדש של מנהל לפני כניסה.",
        badgeClass: "blocked"
      };
    }

    if (status === "temporary_active" && temporaryUntil <= Date.now()) {
      return {
        key: "expired",
        label: "הגישה הזמנית הסתיימה בחצות",
        note: "המנהל יכול לאשר גישה קבועה או לדחות את הבקשה.",
        badgeClass: "blocked"
      };
    }

    return {
      key: "pending",
      label: "ממתין לבדיקה ולאישור מנהל",
      note: request && request.requestedAt
        ? "הבקשה נשלחה: " +
          formatAdminTimestamp_(request.requestedAt)
        : "המשתמש טרם קיבל גישה זמנית.",
      badgeClass: "pending"
    };
  }

  if (user.authState === "verified" || user.lastVerifiedLoginAt) {
    return {
      key: "verified",
      label: "מייל מאומת ויכול להיכנס",
      note: user.lastVerifiedLoginAt
        ? "כניסה מאומתת אחרונה: " + formatAdminTimestamp_(user.lastVerifiedLoginAt)
        : "החשבון השלים אימות מייל",
      badgeClass: "verified"
    };
  }

  if (user.manualApproved) {
    return {
      key: "manual",
      label: "אושר ידנית ויכול להיכנס",
      note: user.manualApprovedBy
        ? `אושר על ידי ${user.manualApprovedBy}${user.manualApprovalReason ? " · " + user.manualApprovalReason : ""}`
        : "אישור ידני של מנהל",
      badgeClass: "manual"
    };
  }

  if (request && request.status === "pending") {
    return {
      key: "pending",
      label: "ממתין לאישור מנהל",
      note: request.requestedAt
        ? "הבקשה נשלחה: " + formatAdminTimestamp_(request.requestedAt)
        : "נשלחה בקשת אישור ידני",
      badgeClass: "pending"
    };
  }

  if (user.authState === "verification_sent" || user.verificationSentAt) {
    return {
      key: "waiting",
      label: "ממתין לאימות מייל",
      note: user.verificationSentAt
        ? "מייל אימות נשלח: " + formatAdminTimestamp_(user.verificationSentAt)
        : "החשבון נוצר אך טרם נרשמה כניסה מאומתת",
      badgeClass: "pending"
    };
  }

  if (request && request.status === "rejected") {
    return {
      key: "rejected",
      label: "בקשת האישור נדחתה",
      note: request.handledAt ? "טופל: " + formatAdminTimestamp_(request.handledAt) : "",
      badgeClass: "blocked"
    };
  }

  return {
    key: "unknown",
    label: "סטטוס אימות טרם נבדק",
    note: "הסטטוס יתעדכן לאחר כניסה או שליחת מייל אימות בגרסה זו.",
    badgeClass: ""
  };
}

function formatAdminTimestamp_(value) {
  if (!value) return "מועד לא ידוע";
  let date = null;
  if (typeof value.toDate === "function") date = value.toDate();
  else if (typeof value.toMillis === "function") date = new Date(value.toMillis());
  else if (typeof value.seconds === "number") date = new Date(value.seconds * 1000);
  else date = new Date(value);
  if (!date || Number.isNaN(date.getTime())) return "מועד לא ידוע";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function requestAdminReason_({
  title,
  intro,
  identity,
  defaultValue = "זוהה טלפונית"
}) {
  const modal = document.getElementById("adminReasonModal");
  const titleElement = document.getElementById("adminReasonModalTitle");
  const introElement = document.getElementById("adminReasonIntro");
  const identityElement = document.getElementById("adminReasonIdentity");
  const input = document.getElementById("adminReasonInput");
  const status = document.getElementById("adminReasonStatus");

  if (!modal || !titleElement || !introElement || !identityElement || !input || !status) {
    return Promise.resolve(null);
  }

  if (adminReasonResolve) {
    closeAdminReasonModal_(null);
  }

  titleElement.textContent = title || "אישור מנהל";
  introElement.textContent = intro || "";
  identityElement.textContent = identity || "";
  input.value = defaultValue;
  status.textContent = "";
  status.className = "statusMessage adminSavingStatus";
  modal.classList.add("visible");
  modal.setAttribute("aria-hidden", "false");

  return new Promise(resolve => {
    adminReasonResolve = resolve;
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  });
}

function submitAdminReasonModal_() {
  const input = document.getElementById("adminReasonInput");
  const status = document.getElementById("adminReasonStatus");
  const reason = String(input && input.value ? input.value : "").trim();

  if (reason.length < 3) {
    if (status) {
      status.textContent = "יש לרשום דרך זיהוי קצרה לפני האישור.";
      status.className = "statusMessage adminSavingStatus error";
    }
    if (input) input.focus();
    return;
  }

  closeAdminReasonModal_(reason.slice(0, 300));
}

function closeAdminReasonModal_(value = null) {
  const modal = document.getElementById("adminReasonModal");
  if (modal) {
    modal.classList.remove("visible");
    modal.setAttribute("aria-hidden", "true");
  }

  const resolve = adminReasonResolve;
  adminReasonResolve = null;
  if (resolve) resolve(value);
}

async function approveManualAccess_(email, temporary = false, force = false) {
  if (!currentUserIsAdmin) {
    setAdminStatus("רק מנהל פעיל יכול לאשר גישה.", "error");
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const user = getAllowedUserByEmail(normalizedEmail);
  const contact = findContactByEmail(normalizedEmail) ||
    findAdminContactByPhone_(user && user.phone);
  const request = getEffectiveVerificationRequestForUser_(user);
  const hasActionableRequest = Boolean(
    request &&
    ["pending", "temporary_active"].includes(request.status)
  );
  const canForceApprove = Boolean(
    force === true &&
    temporary !== true &&
    canManagerForceApproveAccess_(user)
  );
  if (
    !user ||
    !user.active ||
    (!hasActionableRequest && !canForceApprove)
  ) {
    setAdminStatus(
      "לא נמצאה בקשת אישור פעילה או הרשאה שממתינה לאישור מרחוק.",
      "error"
    );
    return;
  }

  if (!user.phonePermissionActive) {
    setAdminStatus(
      "לא ניתן לאשר גישה לפני שקיים קישור פעיל בין המייל למספר הטלפון.",
      "error"
    );
    return;
  }

  const identity = [
    contact && contact.name
      ? contact.name
      : user && user.name
        ? user.name
        : "ללא שם",
    normalizedEmail,
    contact && contact.phone
      ? formatPhoneForDisplay(contact.phone)
      : user && user.phone
        ? formatPhoneForDisplay(user.phone)
        : "ללא טלפון"
  ].join("\n");

  const reason = await requestAdminReason_({
    title: temporary
      ? "אישור גישה עד 23:59"
      : canForceApprove
        ? "אישור כניסה קבוע — גם בלי מייל אימות"
        : "אישור גישה קבועה",
    intro: temporary
      ? "האישור יאפשר כניסה עד 23:59 היום. יש לוודא תחילה את זהות המשתמש."
      : canForceApprove
        ? "המשתמש יקבל גישה גם ללא אימות מייל. ודאו את זהותו בשיחה ורשמו כיצד זוהה."
        : "האישור יאפשר כניסה גם ללא אימות מייל. יש לוודא תחילה את זהות המשתמש.",
    identity
  });

  if (reason === null) return;
  const cleanReason = String(reason || "").trim();
  if (cleanReason.length < 3) {
    setAdminStatus("יש לרשום סיבה קצרה או אופן זיהוי לפני האישור.", "error");
    return;
  }

  setAdminStatus(
    temporary ? "מאשר גישה עד 23:59..." : "מאשר גישה קבועה...",
    "loading"
  );
  try {
    const batch = firebaseApi.writeBatch(db);
    const now = firebaseApi.serverTimestamp();
    const temporaryUntil = getEndOfIsraelDayDate_();
    batch.set(
      firebaseApi.doc(db, "allowedUsers", normalizedEmail),
      temporary
        ? {
            accessReviewRequired: true,
            accessReviewStatus: "temporary_active",
            temporaryAccessUntil: temporaryUntil,
            temporaryAccessReason: "manager_approved",
            temporaryAccessGrantedAt: now,
            temporaryAccessGrantedBy: currentAdminEmail,
            updatedAt: now
          }
        : {
            accessReviewRequired: false,
            accessReviewStatus: "approved",
            temporaryAccessUntil: null,
            temporaryAccessReason: "",
            temporaryAccessGrantedAt: null,
            temporaryAccessGrantedBy: "",
            permanentApprovedAt: now,
            permanentApprovedBy: currentAdminEmail,
            manualApproved: true,
            manualApprovedAt: now,
            manualApprovedBy: currentAdminEmail,
            manualApprovalReason: cleanReason.slice(0, 300),
            accessLevel: "active",
            updatedAt: now
          },
      { merge: true }
    );
    if (hasActionableRequest && !request.synthetic) {
      batch.set(
        firebaseApi.doc(db, "verificationRequests", normalizedEmail),
        {
          status: temporary ? "temporary_active" : "approved",
          temporaryAccessUntil: temporary ? temporaryUntil : null,
          handledAt: now,
          handledBy: currentAdminEmail,
          updatedAt: now
        },
        { merge: true }
      );
    }
    batch.set(firebaseApi.doc(firebaseApi.collection(db, "admin_actions")), {
      action: temporary
        ? "temporary_access_manager_grant"
        : canForceApprove
          ? "manual_approval_forced"
          : "manual_approval_grant",
      targetEmail: normalizedEmail,
      displayName: contact && contact.name ? contact.name : "",
      adminEmail: currentAdminEmail,
      reason: cleanReason.slice(0, 300),
      timestamp: now
    });
    await batch.commit();
    syncAppUserMirrorFromClient_(normalizedEmail).catch(error => {
      console.warn("app_users mirror sync failed after approval", error);
    });
    invalidatePublicAuthRouteCacheFromAdmin_(normalizedEmail).catch(error => {
      console.warn("Auth route cache invalidation failed", error);
    });
    await loadAdminData();
    setAdminStatus(
      temporary
        ? "הגישה אושרה עד 23:59 היום."
        : "הגישה אושרה באופן קבוע.",
      "success"
    );
  } catch (error) {
    console.error("Manual approval failed", error);
    setAdminStatus("אישור הגישה נכשל. בדקו את כללי Firestore ונסו שוב.", "error");
  }
}

async function rejectManualAccess_(email) {
  if (!currentUserIsAdmin) return;
  const normalizedEmail = normalizeEmail(email);
  const user = getAllowedUserByEmail(normalizedEmail);
  const request = getEffectiveVerificationRequestForUser_(user);
  if (!await requestAdminConfirmation_({
    title: "דחיית בקשת כניסה",
    message: `בקשת האישור של ${normalizedEmail} תידחה.`,
    confirmLabel: "דחיית הבקשה",
    tone: "warning"
  })) return;

  setAdminStatus("דוחה את הבקשה...", "loading");
  try {
    const batch = firebaseApi.writeBatch(db);
    const now = firebaseApi.serverTimestamp();
    batch.set(
      firebaseApi.doc(db, "allowedUsers", normalizedEmail),
      {
        accessReviewRequired: true,
        accessReviewStatus: "rejected",
        temporaryAccessUntil: null,
        temporaryAccessReason: "",
        temporaryAccessGrantedAt: null,
        temporaryAccessGrantedBy: "",
        accessLevel: "revoked",
        updatedAt: now
      },
      { merge: true }
    );
    if (request && !request.synthetic) {
      batch.set(
        firebaseApi.doc(db, "verificationRequests", normalizedEmail),
        {
          status: "rejected",
          handledAt: now,
          handledBy: currentAdminEmail,
          updatedAt: now
        },
        { merge: true }
      );
    }
    batch.set(firebaseApi.doc(firebaseApi.collection(db, "admin_actions")), {
      action: "manual_approval_reject",
      targetEmail: normalizedEmail,
      adminEmail: currentAdminEmail,
      timestamp: now
    });
    await batch.commit();
    syncAppUserMirrorFromClient_(normalizedEmail).catch(error => {
      console.warn("app_users mirror sync failed after rejection", error);
    });
    invalidatePublicAuthRouteCacheFromAdmin_(normalizedEmail).catch(error => {
      console.warn("Auth route cache invalidation failed", error);
    });
    await loadAdminData();
    setAdminStatus("הבקשה נדחתה.", "success");
  } catch (error) {
    console.error("Manual approval rejection failed", error);
    setAdminStatus("דחיית הבקשה נכשלה.", "error");
  }
}

async function revokeManualAccess_(email) {
  if (!currentUserIsAdmin) return;
  const normalizedEmail = normalizeEmail(email);
  if (!await requestAdminConfirmation_({
    title: "ביטול אישור ידני",
    message: `האישור הידני של ${normalizedEmail} יבוטל. אם המייל לא אומת, המשתמש ינותק ויידרש להשלים אימות.`,
    confirmLabel: "ביטול האישור",
    tone: "warning"
  })) return;

  setAdminStatus("מבטל אישור ידני...", "loading");
  try {
    const batch = firebaseApi.writeBatch(db);
    const now = firebaseApi.serverTimestamp();
    batch.set(
      firebaseApi.doc(db, "allowedUsers", normalizedEmail),
      {
        accessReviewRequired: true,
        accessReviewStatus: "revoked",
        temporaryAccessUntil: null,
        temporaryAccessReason: "",
        temporaryAccessGrantedAt: null,
        temporaryAccessGrantedBy: "",
        manualApproved: false,
        manualApprovedAt: null,
        manualApprovedBy: "",
        manualApprovalReason: "",
        accessLevel: "revoked",
        updatedAt: now
      },
      { merge: true }
    );
    batch.set(
      firebaseApi.doc(db, "verificationRequests", normalizedEmail),
      {
        status: "revoked",
        handledAt: now,
        handledBy: currentAdminEmail,
        updatedAt: now
      },
      { merge: true }
    );
    batch.set(firebaseApi.doc(firebaseApi.collection(db, "admin_actions")), {
      action: "manual_approval_revoke",
      targetEmail: normalizedEmail,
      adminEmail: currentAdminEmail,
      timestamp: now
    });
    await batch.commit();
    syncAppUserMirrorFromClient_(normalizedEmail).catch(error => {
      console.warn("app_users mirror sync failed after revocation", error);
    });
    invalidatePublicAuthRouteCacheFromAdmin_(normalizedEmail).catch(error => {
      console.warn("Auth route cache invalidation failed", error);
    });
    await loadAdminData();
    setAdminStatus("האישור הידני בוטל.", "success");
  } catch (error) {
    console.error("Manual approval revocation failed", error);
    setAdminStatus("ביטול האישור נכשל.", "error");
  }
}

function getAdminTimestampMillis_(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getUserAccessGrantTimestamp_(user) {
  return Math.max(
    getAdminTimestampMillis_(user && user.accessGrantedAt),
    getAdminTimestampMillis_(user && user.manualApprovedAt),
    getAdminTimestampMillis_(user && user.temporaryAccessGrantedAt),
    getAdminTimestampMillis_(user && user.permanentApprovedAt)
  );
}

function isUserNewToday_(user) {
  const timestamp = getUserAccessGrantTimestamp_(user);
  if (!timestamp) return false;
  return getIsraelDateKey_(new Date(timestamp)) === getIsraelDateKey_();
}

function getUserAccessGrantLabel_(user) {
  const automaticAt = getAdminTimestampMillis_(user && user.accessGrantedAt);
  const manualAt = getAdminTimestampMillis_(user && user.manualApprovedAt);
  const temporaryAt = getAdminTimestampMillis_(
    user && user.temporaryAccessGrantedAt
  );
  const permanentAt = getAdminTimestampMillis_(
    user && user.permanentApprovedAt
  );

  if (temporaryAt >= Math.max(automaticAt, manualAt, permanentAt)) {
    return "גישה זמנית ניתנה היום";
  }

  if (permanentAt >= Math.max(automaticAt, manualAt) && permanentAt > 0) {
    return "גישה קבועה אושרה היום";
  }

  if (manualAt >= automaticAt && manualAt > 0) {
    return "אישור ידני היום";
  }

  if (user && user.accessGrantSource === "google-form") {
    return "נוסף היום דרך הטופס";
  }

  if (user && user.accessGrantSource === "self-service-email-update") {
    return "נוסף היום דרך עדכון מייל";
  }

  return "קיבל גישה היום";
}


async function logAdminAction(action, targetEmail = "", targetId = "") {
  if (!firebaseApi || !db || !currentUserIsAdmin) return;

  await firebaseApi.setDoc(
    firebaseApi.doc(firebaseApi.collection(db, "admin_actions")),
    {
      action: String(action || "admin_action"),
      targetEmail: normalizeEmail(targetEmail || ""),
      targetId: String(targetId || ""),
      adminEmail: currentAdminEmail,
      timestamp: firebaseApi.serverTimestamp()
    }
  );
}

function getPendingPasswordResetRequests_() {
  return adminPasswordResetRequests
    .filter(request =>
      (
        request.status === "pending" &&
        (
          !request.requestExpiresAt ||
          getAdminTimestampMillis_(request.requestExpiresAt) > Date.now()
        )
      ) ||
      (
        request.status === "approved" &&
        getAdminTimestampMillis_(request.approvedUntil) > Date.now()
      )
    )
    .sort((a, b) =>
      getAdminTimestampMillis_(b.requestedAt) -
      getAdminTimestampMillis_(a.requestedAt)
    );
}

function getActivePasswordRecoveryForUser_(email) {
  const normalizedEmail = normalizeEmail(email);
  return adminPasswordResetRequests.find(request => {
    if (request.email !== normalizedEmail) return false;
    if (
      ![
        "pending",
        "manager_ready",
        "approved",
        "consuming"
      ].includes(request.status)
    ) {
      return false;
    }
    if (request.status === "consuming") return true;
    const expiry = getAdminTimestampMillis_(
      ["manager_ready", "approved"].includes(request.status)
        ? request.approvedUntil
        : request.requestExpiresAt
    );
    return !expiry || expiry > Date.now();
  }) || null;
}

async function preparePasswordRecoveryForUser_(email) {
  const normalizedEmail = normalizeEmail(email);
  const user = getAllowedUserByEmail(normalizedEmail);
  if (
    !user ||
    user.active !== true ||
    !auth ||
    !auth.currentUser ||
    !currentUserIsAdmin
  ) {
    return;
  }

  const activeRecovery = getActivePasswordRecoveryForUser_(
    normalizedEmail
  );
  if (activeRecovery) {
    setAdminStatus(
      activeRecovery.status === "pending"
        ? "כבר קיימת בקשה של המשתמש. אשרו אותה בכרטיס בקשת האיפוס."
        : "כבר קיים אישור איפוס פעיל לחשבון הזה.",
      "error"
    );
    return;
  }

  const contact = findContactByEmail(normalizedEmail);
  const identity = [
    contact && contact.name
      ? contact.name
      : user.name || "ללא שם תואם",
    normalizedEmail,
    contact && contact.phone
      ? formatPhoneForDisplay(contact.phone)
      : user.phone
        ? formatPhoneForDisplay(user.phone)
        : "ללא טלפון תואם"
  ].join("\n");
  const reason = await requestAdminReason_({
    title: "אישור יזום לאיפוס סיסמה",
    intro: "האישור יהיה תקף עד 23:59. בכניסה הבאה המשתמש יזין את מספר הטלפון שמקושר לחשבון, ולאחר ההתאמה יוכל ליצור סיסמה חדשה בלי מייל.",
    identity
  });
  if (reason === null) return;
  const cleanReason = String(reason || "").trim();
  if (cleanReason.length < 3) {
    setAdminStatus("יש לרשום דרך זיהוי קצרה לפני האישור.", "error");
    return;
  }

  setAdminStatus("מכין איפוס סיסמה עד 23:59...", "loading");
  try {
    const idToken = await auth.currentUser.getIdToken(true);
    const result = await submitAuthRouterForm_(
      "preparePasswordRecovery",
      {
        idToken,
        email: normalizedEmail,
        reason: cleanReason.slice(0, 300)
      },
      "contacts-auth-management"
    );
    clearCachedAuthRoute_("email", normalizedEmail);
    setAdminStatus(
      result.duplicate
        ? "כבר קיים אישור איפוס פעיל עד 23:59."
        : "האיפוס אושר. בכניסה הבאה המשתמש יוכל ליצור סיסמה חדשה לאחר התאמת מספר הטלפון.",
      "success"
    );
    await loadAdminData();
  } catch (error) {
    console.error("Password recovery preparation failed", error);
    setAdminStatus(
      error && error.message
        ? error.message
        : "הכנת איפוס הסיסמה נכשלה.",
      "error"
    );
  }
}

async function cancelPreparedPasswordRecoveryForUser_(email) {
  const normalizedEmail = normalizeEmail(email);
  const request = getActivePasswordRecoveryForUser_(
    normalizedEmail
  );
  if (
    !request ||
    !request.requestId ||
    !auth ||
    !auth.currentUser ||
    !currentUserIsAdmin
  ) {
    return;
  }

  if (!await requestAdminConfirmation_({
    title: "ביטול אישור איפוס",
    message: `אישור איפוס הסיסמה של ${normalizedEmail} יבוטל מיד.`,
    confirmLabel: "ביטול האישור",
    tone: "warning"
  })) {
    return;
  }

  setAdminStatus("מבטל את אישור האיפוס...", "loading");
  try {
    const idToken = await auth.currentUser.getIdToken(true);
    await submitAuthRouterForm_(
      "cancelPasswordRecovery",
      {
        idToken,
        email: normalizedEmail,
        requestId: request.requestId
      },
      "contacts-auth-management"
    );
    clearCachedAuthRoute_("email", normalizedEmail);
    setAdminStatus("אישור האיפוס בוטל.", "success");
    await loadAdminData();
  } catch (error) {
    console.error("Password recovery cancellation failed", error);
    setAdminStatus(
      error && error.message
        ? error.message
        : "ביטול אישור האיפוס נכשל.",
      "error"
    );
  }
}

async function approvePasswordRecoveryForUser_(email) {
  const normalizedEmail = normalizeEmail(email);
  const request = adminPasswordResetRequests.find(item =>
    item.email === normalizedEmail &&
    item.status === "pending" &&
    item.requestId
  );
  if (
    !request ||
    !auth ||
    !auth.currentUser ||
    !currentUserIsAdmin
  ) {
    return;
  }

  const contact = findContactByEmail(normalizedEmail);
  const user = getAllowedUserByEmail(normalizedEmail);
  const identity = [
    contact && contact.name
      ? contact.name
      : user && user.name
        ? user.name
        : "ללא שם תואם",
    normalizedEmail,
    contact && contact.phone
      ? formatPhoneForDisplay(contact.phone)
      : user && user.phone
        ? formatPhoneForDisplay(user.phone)
        : "ללא טלפון תואם"
  ].join("\n");
  const reason = await requestAdminReason_({
    title: "אישור איפוס סיסמה עד 23:59",
    intro: "האישור יאפשר למשתמש לבחור סיסמה חדשה באותו מכשיר עד 23:59 היום. יש לאמת את זהותו מחוץ לאפליקציה, בלי לבקש או למסור סיסמה.",
    identity
  });
  if (reason === null) return;
  const cleanReason = String(reason || "").trim();
  if (cleanReason.length < 3) {
    setAdminStatus("יש לרשום דרך זיהוי קצרה לפני האישור.", "error");
    return;
  }

  setAdminStatus("מאשר איפוס סיסמה עד 23:59...", "loading");
  try {
    const idToken = await auth.currentUser.getIdToken(true);
    await submitAuthRouterForm_(
      "approvePasswordRecovery",
      {
        idToken,
        email: normalizedEmail,
        requestId: request.requestId,
        reason: cleanReason.slice(0, 300)
      },
      "contacts-auth-management"
    );
    setAdminStatus(
      "האיפוס אושר. במסך המשתמש ייפתח אוטומטית טופס לבחירת סיסמה חדשה.",
      "success"
    );
    await loadAdminData();
  } catch (error) {
    console.error("Password recovery approval failed", error);
    setAdminStatus(
      error && error.message
        ? error.message
        : "אישור האיפוס נכשל.",
      "error"
    );
  }
}

async function sendPasswordResetForUser_(email) {
  const normalizedEmail = normalizeEmail(email);
  const request = adminPasswordResetRequests.find(item =>
    item.email === normalizedEmail && item.status === "pending"
  );
  if (!request || !auth || !firebaseApi || !db) return;

  setAdminStatus("שולח קישור לאיפוס הסיסמה...", "loading");
  try {
    auth.languageCode = "he";
    await firebaseApi.sendPasswordResetEmail(auth, normalizedEmail, {
      url: PASSWORD_AUTH_RETURN_URL
    });

    await firebaseApi.updateDoc(
      firebaseApi.doc(db, PASSWORD_RESET_REQUESTS_COLLECTION_NAME, request.docId),
      {
        status: "sent",
        sentAt: firebaseApi.serverTimestamp(),
        handledAt: firebaseApi.serverTimestamp(),
        handledBy: currentAdminEmail,
        updatedAt: firebaseApi.serverTimestamp()
      }
    );

    await logAdminAction("password_reset_link_sent", normalizedEmail, "");
    setAdminStatus(
      `קישור האיפוס נשלח למייל ${normalizedEmail}. המשתמש יקבל הודעת Firebase עם הקישור, ועליו לבדוק גם בספאם ובדואר זבל.`,
      "success"
    );
    await loadAdminData();
  } catch (error) {
    console.error("Admin password reset send failed", error);
    setAdminStatus("שליחת קישור האיפוס נכשלה.", "error");
  }
}

async function closePasswordResetRequest_(email) {
  const normalizedEmail = normalizeEmail(email);
  const request = adminPasswordResetRequests.find(item =>
    item.email === normalizedEmail &&
    ["pending", "manager_ready", "approved"].includes(item.status)
  );
  if (
    !request ||
    !request.requestId ||
    !auth ||
    !auth.currentUser ||
    !currentUserIsAdmin
  ) {
    return;
  }

  try {
    const idToken = await auth.currentUser.getIdToken(true);
    await submitAuthRouterForm_(
      "cancelPasswordRecovery",
      {
        idToken,
        email: normalizedEmail,
        requestId: request.requestId
      },
      "contacts-auth-management"
    );
    clearCachedAuthRoute_("email", normalizedEmail);
    setAdminStatus("בקשת האיפוס נסגרה.", "success");
    await loadAdminData();
  } catch (error) {
    console.error("Password reset request close failed", error);
    setAdminStatus("סגירת בקשת האיפוס נכשלה.", "error");
  }
}

function renderAdminUsers() {
  const query = getAdminSearchQuery();

  const users = adminAllowedUsers
    .filter(user => {
      const accessState = getUserAccessState_(user);
      if (adminActiveFilter === "active" && !user.active) return false;
      if (adminActiveFilter === "blocked" && user.active) return false;
      if (adminActiveFilter === "verified" && accessState.key !== "verified") return false;
      if (adminActiveFilter === "manual" && accessState.key !== "manual") return false;
      if (
        adminActiveFilter === "pending" &&
        !["pending", "temporary", "expired"].includes(accessState.key)
      ) return false;
      return adminUserMatchesQuery(user, query);
    })
    .sort((a, b) => {
      const aGrant = getUserAccessGrantTimestamp_(a);
      const bGrant = getUserAccessGrantTimestamp_(b);
      if (aGrant !== bGrant) {
        if (!aGrant) return 1;
        if (!bGrant) return -1;
        return bGrant - aGrant;
      }

      const aState = getUserAccessState_(a).key;
      const bState = getUserAccessState_(b).key;
      if (aState === "pending" && bState !== "pending") return -1;
      if (bState === "pending" && aState !== "pending") return 1;
      return a.email.localeCompare(b.email);
    });

  const reviewCount = adminAllowedUsers.filter(user =>
    ["pending", "temporary", "expired"].includes(
      getUserAccessState_(user).key
    )
  ).length;
  const newTodayCount = adminAllowedUsers.filter(isUserNewToday_).length;
  const resetRequests = getPendingPasswordResetRequests_();
  const visibleUsers = getVisibleAdminItems_(users);
  document.getElementById("adminSummary").textContent =
    `${users.length === 1 ? "נמצא משתמש אחד" : `נמצאו ${users.length} משתמשים`}` +
    (visibleUsers.length < users.length ? ` · מוצגים ${visibleUsers.length}` : "") +
    (newTodayCount ? ` · ${newTodayCount} קיבלו גישה היום ומוצגים ראשונים` : "") +
    (reviewCount ? ` · ${reviewCount} בקשות כניסה פעילות לבדיקה` : "") +
    (resetRequests.length ? ` · ${resetRequests.length} בקשות עזרה באיפוס סיסמה` : "");

  const resetRequestHtml = resetRequests.map(request => {
    const contact = findContactByEmail(request.email);
    const isApproved = request.status === "approved";
    return `
      <div class="adminCard reportCard">
        <div class="adminCardTop">
          <div>
            <div class="adminCardName">בקשת עזרה באיפוס סיסמה</div>
            <div class="adminCardMeta">
              ${escapeHtml(contact && contact.name ? contact.name : request.email)}<br>
              ${escapeHtml(request.email)}<br>
              התקבלה: ${escapeHtml(formatAdminTimestamp_(request.requestedAt))}
              <br>מזהה בקשה: ${escapeHtml(String(request.requestId || "").slice(-6).toUpperCase())}
              ${isApproved
                ? `<br>האישור תקף עד: ${escapeHtml(formatAdminTimestamp_(request.approvedUntil))}`
                : ""}
            </div>
          </div>
          <span class="adminStatusBadge pending">${isApproved ? "אושר עד 23:59" : "ממתין"}</span>
        </div>
        <div class="adminCardActions">
          ${isApproved
            ? ""
            : `<button type="button" class="adminActionBtn primary" onclick="approvePasswordRecoveryForUser_('${escapeJsString(request.email)}')">אישור איפוס באפליקציה עד 23:59</button>
               <button type="button" class="adminActionBtn secondary" onclick="sendPasswordResetForUser_('${escapeJsString(request.email)}')">שליחת קישור במייל</button>`}
          <button type="button" class="adminActionBtn secondary" onclick="closePasswordResetRequest_('${escapeJsString(request.email)}')">${isApproved ? "ביטול האישור" : "סגירה ללא אישור"}</button>
        </div>
      </div>
    `;
  }).join("");

  if (!users.length && !resetRequests.length) {
    document.getElementById("adminList").innerHTML =
      '<div class="adminEmpty">לא נמצאו משתמשים התואמים לחיפוש.</div>';
    return;
  }

  const usersHtml = visibleUsers.map(user => {
    const contact = findContactByEmail(user.email);
    const isSelf = normalizeEmail(user.email) === currentAdminEmail;
    const accessState = getUserAccessState_(user);
    const request = getEffectiveVerificationRequestForUser_(user);
    const passwordRecovery =
      getActivePasswordRecoveryForUser_(user.email);
    const isNewToday = isUserNewToday_(user);
    const lastAccess = user.lastAccessAt
      ? `<span class="accessStateNote">גישה אחרונה שנרשמה: ${escapeHtml(formatAdminTimestamp_(user.lastAccessAt))}</span>`
      : "";
    const accessBadgeText = ({
      blocked: "חסום",
      verified: "מאומת",
      manual: "ידני",
      pending: "ממתין",
      temporary: "עד 23:59",
      expired: "פג",
      waiting: "אימות",
      rejected: "נדחה",
      phone_missing: "טלפון חסר",
      unknown: "פעיל"
    })[accessState.key] || (user.active ? "פעיל" : "חסום");
    const phone = contact && contact.phone ? contact.phone : user.phone;
    const userDetails = [
      contact && contact.dept ? `<b>מחלקה:</b> ${escapeHtml(contact.dept)}` : "",
      user.source ? `<b>מקור:</b> ${escapeHtml(user.source)}` : "",
      `<div class="accessStateLine ${escapeHtml(accessState.key)}">
        ${escapeHtml(accessState.label)}
        ${accessState.note ? `<span class="accessStateNote">${escapeHtml(accessState.note)}</span>` : ""}
        ${lastAccess}
      </div>`
    ].filter(Boolean).join("<br>");

    let approvalActions = "";
    if (
      ["pending", "temporary", "expired"].includes(accessState.key) &&
      request &&
      ["pending", "temporary_active"].includes(request.status)
    ) {
      approvalActions = `
        ${accessState.key === "pending"
          ? `<button type="button" class="adminActionBtn secondary" onclick="approveManualAccess_('${escapeJsString(user.email)}', true)">אישור עד 23:59</button>`
          : ""}
        <button type="button" class="adminActionBtn primary" onclick="approveManualAccess_('${escapeJsString(user.email)}', false)">אישור קבוע</button>
        ${accessState.key === "temporary"
          ? `<button type="button" class="adminActionBtn warning" onclick="revokeManualAccess_('${escapeJsString(user.email)}')">ביטול מיידי</button>`
          : `<button type="button" class="adminActionBtn warning" onclick="rejectManualAccess_('${escapeJsString(user.email)}')">דחיית בקשה</button>`}
      `;
    } else if (user.manualApproved && currentUserIsAdmin) {
      approvalActions = `<button type="button" class="adminActionBtn warning" onclick="revokeManualAccess_('${escapeJsString(user.email)}')">ביטול אישור ידני</button>`;
    }

    let passwordRecoveryActions = "";
    if (!isSelf && user.active) {
      if (!passwordRecovery) {
        passwordRecoveryActions =
          `<button type="button" class="adminActionBtn secondary" onclick="preparePasswordRecoveryForUser_('${escapeJsString(user.email)}')">אישור איפוס סיסמה</button>`;
      } else if (passwordRecovery.status === "pending") {
        passwordRecoveryActions =
          '<button type="button" class="adminActionBtn secondary" disabled>בקשת איפוס ממתינה לטיפול</button>';
      } else if (passwordRecovery.status === "consuming") {
        passwordRecoveryActions =
          '<button type="button" class="adminActionBtn secondary" disabled>הסיסמה מתעדכנת כעת</button>';
      } else {
        passwordRecoveryActions = `
          <button type="button" class="adminActionBtn secondary" disabled>${passwordRecovery.status === "manager_ready" ? "איפוס מאושר עד 23:59" : "ממתין לבחירת סיסמה חדשה"}</button>
          <button type="button" class="adminActionBtn warning" onclick="cancelPreparedPasswordRecoveryForUser_('${escapeJsString(user.email)}')">ביטול אישור האיפוס</button>
        `;
      }
    }

    return `
      <div class="adminCard ${user.active ? "" : "blocked"} ${isNewToday ? "newAccess" : ""}">
        <div class="adminCardTop">
          <div>
            <div class="adminCardName">${escapeHtml(contact && contact.name ? contact.name : user.email)}</div>
            ${isNewToday ? `<span class="adminNewAccessBadge">${escapeHtml(getUserAccessGrantLabel_(user))}</span>` : ""}
            <div class="adminCardMeta">
              ${escapeHtml(user.email)}
              ${phone ? "<br>" + escapeHtml(formatPhoneForDisplay(phone)) : ""}
            </div>
          </div>
          <span class="adminStatusBadge ${escapeHtml(accessState.badgeClass)}">${escapeHtml(accessBadgeText)}</span>
        </div>

        <details class="adminCardMore" ${["pending", "temporary", "expired"].includes(accessState.key) ? "open" : ""}>
          <summary>פרטים ופעולות</summary>
          <div class="adminCardMoreBody">
            <div class="adminCardDetailsList">${userDetails}</div>
            <div class="adminCardActions">
              ${approvalActions}
              ${passwordRecoveryActions}
              ${isSelf
                ? '<button type="button" class="adminActionBtn secondary" disabled>חשבון המנהל הנוכחי</button>'
                : `<button type="button" class="adminActionBtn ${user.active ? "warning" : "primary"}" onclick="toggleUserAccess('${escapeJsString(user.email)}', ${!user.active})">${user.active ? "חסימת גישה" : "החזרת גישה"}</button>
                   <details class="adminActionMenu">
                     <summary>פעולות נוספות</summary>
                     <div class="adminActionMenuBody">
                       <button type="button" class="adminActionBtn danger" onclick="deleteUserPermission('${escapeJsString(user.email)}')">איפוס מלא של חשבון הכניסה</button>
                     </div>
                   </details>`}
            </div>
          </div>
        </details>
      </div>
    `;
  }).join("");

  document.getElementById("adminList").innerHTML =
    resetRequestHtml +
    usersHtml +
    renderAdminLoadMore_(users.length, visibleUsers.length);
}


function renderAdminManagers() {
  if (!currentUserIsSuperAdmin) {
    document.getElementById("adminSummary").textContent = "";
    document.getElementById("adminList").innerHTML =
      '<div class="adminEmpty">רק מנהל־על יכול לנהל מנהלים.</div>';
    return;
  }

  const query = getAdminSearchQuery();

  const managers = adminManagers
    .filter(manager => adminManagerMatchesQuery(manager, query))
    .sort((a, b) => {
      if (a.role !== b.role) {
        return a.role === "super_admin" ? -1 : 1;
      }
      return a.email.localeCompare(b.email);
    });

  document.getElementById("adminSummary").textContent =
    managers.length === 1
      ? "נמצא מנהל אחד"
      : `נמצאו ${managers.length} מנהלים`;

  if (!managers.length) {
    document.getElementById("adminList").innerHTML =
      '<div class="adminEmpty">לא נמצאו מנהלים התואמים לחיפוש.</div>';
    return;
  }

  document.getElementById("adminList").innerHTML = managers.map(manager => {
    const contact = findContactByEmail(manager.email);
    const isSuperAdmin = manager.role === "super_admin";
    const roleLabel = isSuperAdmin ? "מנהל־על קבוע" : "מנהל רגיל";

    return `
      <div class="adminCard ${manager.active ? "" : "blocked"}">
        <div class="adminCardTop">
          <div>
            <div class="adminCardName">${escapeHtml(getAccountDisplayName_(manager.email, contact && contact.name ? contact.name : manager.email))}</div>
            <div class="adminCardMeta">
              ${escapeHtml(manager.email)}
              ${contact && contact.phone ? "<br>" + escapeHtml(formatPhoneForDisplay(contact.phone)) : ""}
            </div>
            <span class="adminRoleBadge ${isSuperAdmin ? "super" : ""}">${roleLabel}</span>
          </div>
          <span class="adminStatusBadge ${manager.active ? "" : "blocked"}">${manager.active ? "פעיל" : "מושבת"}</span>
        </div>

        <details class="adminCardMore">
          <summary>פרטים ופעולות</summary>
          <div class="adminCardMoreBody">
            <div class="adminCardDetailsList">
              ${contact && contact.dept ? `<b>מחלקה:</b> ${escapeHtml(contact.dept)}<br>` : ""}
              ${manager.createdBy ? `<b>נוסף על ידי:</b> ${escapeHtml(manager.createdBy)}` : "אין פרטים נוספים."}
            </div>
            <div class="adminCardActions">
              ${isSuperAdmin
                ? '<button type="button" class="adminActionBtn secondary" disabled>לא ניתן לשנות את מנהל־העל</button>'
                : `<details class="adminActionMenu">
                     <summary>פעולות נוספות</summary>
                     <div class="adminActionMenuBody">
                       <button type="button" class="adminActionBtn danger" onclick="removeManager('${escapeJsString(manager.email)}')">הסרת מנהל</button>
                     </div>
                   </details>`}
            </div>
          </div>
        </details>
      </div>
    `;
  }).join("");
}

function setAdminManagerModalStatus(message = "", type = "") {
  setStatus("adminManagerModalStatus", message, type);
}

function openAddManagerModal() {
  if (!currentUserIsSuperAdmin) {
    setAdminStatus("רק מנהל־על יכול להוסיף מנהלים.", "error");
    return;
  }

  document.getElementById("adminManagerEmail").value = "";
  document.getElementById("adminManagerModalTitle").textContent = "הוספת מנהל רגיל";
  document.getElementById("adminSaveManagerBtn").textContent = "הוספת מנהל";
  setAdminManagerModalStatus("", "");
  document.getElementById("adminManagerModal").classList.add("visible");
  document.body.style.overflow = "hidden";
  setTimeout(() => document.getElementById("adminManagerEmail").focus(), 50);
}

function closeManagerModal() {
  const modal = document.getElementById("adminManagerModal");
  if (modal) modal.classList.remove("visible");
  document.body.style.overflow = "";
  setAdminManagerModalStatus("", "");
}

async function saveNewManager() {
  if (!currentUserIsSuperAdmin) return;

  const email = normalizeEmail(document.getElementById("adminManagerEmail").value);
  const role = "admin";

  if (!isValidEmail(email)) {
    setAdminManagerModalStatus("כתובת המייל אינה תקינה.", "error");
    return;
  }

  if (adminManagers.some(manager => manager.email === email)) {
    setAdminManagerModalStatus("כתובת המייל כבר מופיעה ברשימת המנהלים.", "error");
    return;
  }

  const saveButton = document.getElementById("adminSaveManagerBtn");
  saveButton.disabled = true;
  setAdminManagerModalStatus("מוסיף מנהל...", "loading");

  try {
    const batch = firebaseApi.writeBatch(db);
    const now = firebaseApi.serverTimestamp();

    batch.set(
      firebaseApi.doc(db, "admins", email),
      {
        email,
        active: true,
        role,
        createdBy: currentAdminEmail,
        createdAt: now,
        updatedAt: now
      },
      { merge: false }
    );

    batch.set(
      firebaseApi.doc(db, "allowedUsers", email),
      {
        email,
        active: true,
        source: "super-admin",
        updatedAt: now
      },
      { merge: true }
    );

    batch.set(
      firebaseApi.doc(firebaseApi.collection(db, "admin_actions")),
      {
        action: "manager_add",
        targetEmail: email,
        newRole: role,
        adminEmail: currentAdminEmail,
        timestamp: now
      }
    );

    await batch.commit();
    await loadAdminData();
    closeManagerModal();
  } catch (error) {
    console.error("Adding manager failed", error);
    setAdminManagerModalStatus("לא הצלחנו להוסיף את המנהל. נסו שוב.", "error");
  } finally {
    saveButton.disabled = false;
  }
}

async function removeManager(email) {
  if (!currentUserIsSuperAdmin) return;

  const normalizedEmail = normalizeEmail(email);
  const manager = adminManagers.find(item => item.email === normalizedEmail);

  if (!manager || manager.role === "super_admin" || normalizedEmail === currentAdminEmail) {
    setAdminStatus("לא ניתן להסיר את מנהל־העל.", "error");
    return;
  }

  if (!await requestAdminConfirmation_({
    title: "הסרת מנהל",
    message: `הרשאת הניהול של ${normalizedEmail} תוסר. הרשאת הכניסה הרגילה לאפליקציה תישאר ללא שינוי.`,
    confirmLabel: "הסרת מנהל",
    tone: "danger"
  })) return;

  try {
    const batch = firebaseApi.writeBatch(db);
    const now = firebaseApi.serverTimestamp();

    batch.delete(firebaseApi.doc(db, "admins", normalizedEmail));
    batch.set(
      firebaseApi.doc(firebaseApi.collection(db, "admin_actions")),
      {
        action: "manager_remove",
        targetEmail: normalizedEmail,
        adminEmail: currentAdminEmail,
        timestamp: now
      }
    );

    await batch.commit();
    await loadAdminData();
  } catch (error) {
    console.error("Removing manager failed", error);
    setAdminStatus("לא הצלחנו להסיר את הרשאת המנהל.", "error");
  }
}

function escapeJsString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n");
}

function getAdminContactByDocId(docId) {
  return [...adminContacts, ...adminRemovedContacts].find(
    contact => contact.docId === docId
  ) || null;
}

function openAdminEditModal(docId) {
  const contact = getAdminContactByDocId(docId);
  if (!contact || contact.deleted) return;

  adminEditingContact = contact;
  setAdminEditStatus("", "");

  document.getElementById("adminFirstHe").value = contact.first || "";
  document.getElementById("adminLastHe").value = contact.last || "";
  document.getElementById("adminFirstEn").value = contact.firstEn || "";
  document.getElementById("adminLastEn").value = contact.lastEn || "";
  document.getElementById("adminTitlePrefix").value = contact.title || "";
  document.getElementById("adminRole").value = contact.role || "";
  document.getElementById("adminDepartment").value = contact.dept || "";
  document.getElementById("adminHospital").value = contact.hospital || "";
  document.getElementById("adminPhone").value = formatPhoneForDisplay(contact.phone);
  document.getElementById("adminEmail").value = contact.email || "";

  document.getElementById("adminEditModal").classList.add("visible");
  document.body.style.overflow = "hidden";
}

function closeAdminEditModal() {
  adminEditingContact = null;
  const modal = document.getElementById("adminEditModal");
  if (modal) modal.classList.remove("visible");
  document.body.style.overflow = "";
  setAdminEditStatus("", "");
}

function buildAdminContactPayload(contact) {
  const now = new Date().toISOString();

  return {
    id: String(contact.raw && contact.raw.id || ""),
    first_name_he: document.getElementById("adminFirstHe").value.trim(),
    last_name_he: document.getElementById("adminLastHe").value.trim(),
    first_name_en: document.getElementById("adminFirstEn").value.trim(),
    last_name_en: document.getElementById("adminLastEn").value.trim(),
    title_prefix: document.getElementById("adminTitlePrefix").value.trim(),
    role: document.getElementById("adminRole").value.trim(),
    department: document.getElementById("adminDepartment").value.trim(),
    hospital: document.getElementById("adminHospital").value.trim(),
    phone: normalizePhone(document.getElementById("adminPhone").value),
    email: normalizeEmail(document.getElementById("adminEmail").value),
    source: String(contact.source || contact.raw && contact.raw.source || "admin"),
    status: String(contact.status || contact.raw && contact.raw.status || ""),
    created_at: String(contact.createdAt || contact.raw && contact.raw.created_at || ""),
    first_seen_at: String(contact.firstSeenAt || contact.raw && contact.raw.first_seen_at || contact.createdAt || ""),
    is_new_contact: contact.isNewContact === true,
    updated_at: now
  };
}

async function saveAdminContactEdit() {
  if (!currentUserIsAdmin || !adminEditingContact) return;

  const payload = buildAdminContactPayload(adminEditingContact);
  const originalPhone = normalizePhone(adminEditingContact.phone);
  const newPhone = normalizePhone(payload.phone);
  const oldEmail = normalizeEmail(adminEditingContact.email);
  const newEmail = normalizeEmail(payload.email);
  const phoneChanged = newPhone !== originalPhone;
  const emailChanged = newEmail !== oldEmail;
  const oldPhoneKey = originalPhone.replace(/\D/g, "");
  const newPhoneKey = newPhone.replace(/\D/g, "");
  const existingPermission = getAllowedUserByEmail(oldEmail) ||
    getAllowedUserByEmail(newEmail);
  const permissionEmail = newEmail || oldEmail;

  if (!payload.first_name_he && !payload.last_name_he) {
    setAdminEditStatus("יש להזין לפחות שם פרטי או שם משפחה.", "error");
    return;
  }

  if (!isValidPhoneForRouting_(newPhone)) {
    setAdminEditStatus("יש להזין מספר טלפון ישראלי תקין.", "error");
    return;
  }

  if (payload.email && !isValidEmail(payload.email)) {
    setAdminEditStatus("כתובת המייל אינה תקינה.", "error");
    return;
  }

  if (emailChanged && newEmail) {
    const permissionForNewEmail = getAllowedUserByEmail(newEmail);
    if (
      permissionForNewEmail &&
      permissionForNewEmail.email !== oldEmail &&
      permissionForNewEmail.phoneKey &&
      permissionForNewEmail.phoneKey !== newPhoneKey
    ) {
      setAdminEditStatus(
        "המייל החדש כבר מקושר למספר טלפון אחר. יש לטפל קודם בהרשאה הקיימת.",
        "error"
      );
      return;
    }
  }

  const conflictingPhonePermission = adminAllowedPhones.find(item =>
    item.phoneKey === newPhoneKey &&
    normalizeEmail(item.email) !== permissionEmail
  );
  if (permissionEmail && conflictingPhonePermission) {
    setAdminEditStatus(
      "מספר הטלפון כבר מקושר להרשאת משתמש אחרת. יש לטפל קודם בהרשאה הקיימת.",
      "error"
    );
    return;
  }

  if (phoneChanged) {
    const duplicateContact = adminContacts.find(contact =>
      contact.docId !== adminEditingContact.docId &&
      normalizePhone(contact.phone) === newPhone
    );

    if (duplicateContact) {
      setAdminEditStatus(
        `המספר החדש כבר משויך ל-${duplicateContact.name || formatPhoneForDisplay(duplicateContact.phone)}.`,
        "error"
      );
      return;
    }

  }

  const saveButton = document.getElementById("adminSaveContactBtn");
  saveButton.disabled = true;
  setAdminEditStatus("שומר שינויים...", "loading");

  try {
    const batch = firebaseApi.writeBatch(db);
    const contactRef = firebaseApi.doc(db, "contacts", adminEditingContact.docId);
    const overrideRef = firebaseApi.doc(db, "contactOverrides", adminEditingContact.docId);
    const actionRef = firebaseApi.doc(firebaseApi.collection(db, "admin_actions"));
    const now = firebaseApi.serverTimestamp();

    batch.set(contactRef, payload, { merge: true });
    batch.set(overrideRef, {
      ...payload,
      deleted: false,
      updatedBy: currentAdminEmail,
      updatedAt: now
    }, { merge: false });

    const changedFieldMap = {
      first_name_he: "שם פרטי בעברית",
      last_name_he: "שם משפחה בעברית",
      first_name_en: "שם פרטי באנגלית",
      last_name_en: "שם משפחה באנגלית",
      title_prefix: "תואר",
      role: "תפקיד",
      department: "מחלקה / מכון",
      hospital: "בית חולים",
      phone: "מספר טלפון",
      email: "מייל"
    };

    const originalPayload = contactToFirestorePayload(adminEditingContact);
    const changedFields = Object.keys(changedFieldMap).filter(field =>
      String(originalPayload[field] || "").trim() !==
      String(payload[field] || "").trim()
    ).map(field => changedFieldMap[field]);

    batch.set(actionRef, {
      action: "contact_edit",
      targetId: adminEditingContact.docId,
      targetEmail: newEmail || "",
      targetPhone: newPhone || "",
      previousPhone: originalPhone || "",
      displayName: [payload.first_name_he, payload.last_name_he].filter(Boolean).join(" "),
      changedFields,
      adminEmail: currentAdminEmail,
      timestamp: now
    });

    const permissionPairMissing = Boolean(
      existingPermission &&
      (
        !normalizePhone(existingPermission.phone) ||
        !String(existingPermission.phoneKey || "")
      )
    );
    const shouldUpdatePermissionPair = Boolean(
      permissionEmail &&
      (
        emailChanged ||
        (phoneChanged && existingPermission) ||
        permissionPairMissing
      )
    );

    if (shouldUpdatePermissionPair) {
      const permissionActive = existingPermission
        ? existingPermission.active === true
        : true;

      batch.set(
        firebaseApi.doc(db, "allowedUsers", permissionEmail),
        {
          email: permissionEmail,
          phone: newPhone,
          phoneKey: newPhoneKey,
          active: permissionActive,
          source: phoneChanged
            ? "admin-contact-phone-edit"
            : emailChanged
              ? "admin-contact-email-edit"
              : "admin-contact-permission-repair",
          updatedAt: now
        },
        { merge: true }
      );

      batch.set(
        firebaseApi.doc(db, ALLOWED_PHONES_COLLECTION_NAME, newPhoneKey),
        {
          phone: newPhone,
          phoneKey: newPhoneKey,
          email: permissionEmail,
          active: permissionActive,
          source: phoneChanged
            ? "admin-contact-phone-edit"
            : emailChanged
              ? "admin-contact-email-edit"
              : "admin-contact-permission-repair",
          updatedAt: now
        },
        { merge: true }
      );

      if (oldPhoneKey && oldPhoneKey !== newPhoneKey) {
        const oldPhonePermission = adminAllowedPhones.find(item =>
          item.phoneKey === oldPhoneKey
        );

        if (
          !oldPhonePermission ||
          [oldEmail, newEmail].includes(normalizeEmail(oldPhonePermission.email))
        ) {
          batch.delete(
            firebaseApi.doc(db, ALLOWED_PHONES_COLLECTION_NAME, oldPhoneKey)
          );
        }
      }
    }

    if (emailChanged && oldEmail) {
      const oldEmailUsedElsewhere = adminContacts.some(contact =>
        contact.docId !== adminEditingContact.docId &&
        normalizeEmail(contact.email) === oldEmail
      );

      if (!oldEmailUsedElsewhere && oldEmail !== currentAdminEmail) {
        batch.set(
          firebaseApi.doc(db, "allowedUsers", oldEmail),
          {
            email: oldEmail,
            active: false,
            source: "admin-email-replaced",
            updatedAt: now
          },
          { merge: true }
        );
      }
    }

    await batch.commit();
    await updateOptimizedContactBundle_(
      adminEditingContact.docId,
      payload,
      { deleted: false, countDelta: 0 }
    );
    setAdminEditStatus("השינויים נשמרו.", "success");
    await loadContacts();
    await loadAdminData();
    setTimeout(closeAdminEditModal, 450);
  } catch (error) {
    console.error("Admin contact save failed", error);
    setAdminEditStatus(
      "שמירת השינויים נכשלה. בדקו את כללי Firestore ונסו שוב.",
      "error"
    );
  } finally {
    saveButton.disabled = false;
  }
}

function buildBundleContactFromPayload_(docId, payload) {
  return {
    docId: String(docId || ""),
    id: String(payload.id || ""),
    first_name_he: String(payload.first_name_he || ""),
    last_name_he: String(payload.last_name_he || ""),
    first_name_en: String(payload.first_name_en || ""),
    last_name_en: String(payload.last_name_en || ""),
    title_prefix: String(payload.title_prefix || ""),
    role: String(payload.role || ""),
    department: String(payload.department || ""),
    hospital: String(payload.hospital || ""),
    phone: String(payload.phone || ""),
    email: normalizeEmail(payload.email),
    source: String(payload.source || ""),
    status: String(payload.status || ""),
    created_at: String(payload.created_at || ""),
    first_seen_at: String(payload.first_seen_at || payload.created_at || ""),
    is_new_contact: payload.is_new_contact === true,
    updated_at: String(payload.updated_at || "")
  };
}

function buildDirectoryContactFromMappedContact_(contact) {
  return {
    docId: String(contact.docId || normalizePhone(contact.phone).replace(/\D/g, "")),
    id: String(contact.raw && contact.raw.id || ""),
    first_name_he: String(contact.first || ""),
    last_name_he: String(contact.last || ""),
    first_name_en: String(contact.firstEn || ""),
    last_name_en: String(contact.lastEn || ""),
    title_prefix: String(contact.title || ""),
    role: String(contact.role || ""),
    department: String(contact.dept || ""),
    hospital: String(contact.hospital || ""),
    phone: String(contact.phone || ""),
    email: normalizeEmail(contact.email),
    source: String(contact.source || ""),
    status: String(contact.status || ""),
    created_at: String(contact.createdAt || ""),
    first_seen_at: String(contact.firstSeenAt || contact.createdAt || ""),
    is_new_contact: contact.isNewContact === true,
    updated_at: String(contact.updatedAt || "")
  };
}

function packDirectoryContactsForClient_(items) {
  const pages = [];
  let currentPage = [];
  let currentBytes = 1024;

  items.forEach(item => {
    const itemBytes = new Blob([JSON.stringify(item)]).size + 2;

    if (
      currentPage.length &&
      currentBytes + itemBytes > CONTACT_DIRECTORY_TARGET_BYTES
    ) {
      pages.push(currentPage);
      currentPage = [];
      currentBytes = 1024;
    }

    currentPage.push(item);
    currentBytes += itemBytes;
  });

  if (currentPage.length || pages.length === 0) pages.push(currentPage);
  return pages;
}

async function updateOptimizedContactBundle_(docId, payload, options = {}) {
  const normalizedDocId = String(docId || "");
  if (!normalizedDocId) return;

  const deleted = options.deleted === true;
  const sourceContacts = adminContacts.length ? adminContacts : contacts;
  const directoryContacts = sourceContacts.map(buildDirectoryContactFromMappedContact_);
  const existingIndex = directoryContacts.findIndex(
    contact => String(contact.docId || "") === normalizedDocId
  );

  if (deleted) {
    if (existingIndex >= 0) directoryContacts.splice(existingIndex, 1);
  } else {
    const nextContact = buildBundleContactFromPayload_(normalizedDocId, payload);
    if (existingIndex >= 0) directoryContacts[existingIndex] = nextContact;
    else directoryContacts.push(nextContact);
  }

  directoryContacts.sort((a, b) => {
    const lastCompare = String(a.last_name_he || "")
      .localeCompare(String(b.last_name_he || ""), "he", { sensitivity: "base" });
    if (lastCompare !== 0) return lastCompare;
    return String(a.first_name_he || "")
      .localeCompare(String(b.first_name_he || ""), "he", { sensitivity: "base" });
  });

  const pages = packDirectoryContactsForClient_(directoryContacts);
  const pageIds = pages.map((_, index) => CONTACT_DIRECTORY_PAGE_PREFIX + index);
  const metaRef = firebaseApi.doc(
    db,
    CONTACT_DIRECTORY_COLLECTION_NAME,
    CONTACT_DIRECTORY_META_ID
  );
  const previousMetaSnapshot = await firebaseApi.getDoc(metaRef);
  const previousPageIds = previousMetaSnapshot.exists()
    ? (Array.isArray(previousMetaSnapshot.data().pageIds)
        ? previousMetaSnapshot.data().pageIds.map(String)
        : [])
    : [];
  const nextVersion = new Date().toISOString() + "_" + Math.random().toString(36).slice(2, 10);
  const batch = firebaseApi.writeBatch(db);
  const now = firebaseApi.serverTimestamp();

  pages.forEach((pageContacts, index) => {
    batch.set(
      firebaseApi.doc(
        db,
        CONTACT_DIRECTORY_COLLECTION_NAME,
        pageIds[index]
      ),
      {
        kind: "contacts_page",
        schemaVersion: 3,
        version: nextVersion,
        pageIndex: index,
        contacts: pageContacts,
        updatedAt: now
      },
      { merge: false }
    );
  });

  previousPageIds
    .filter(pageId => !pageIds.includes(pageId))
    .forEach(pageId => {
      batch.delete(
        firebaseApi.doc(db, CONTACT_DIRECTORY_COLLECTION_NAME, pageId)
      );
    });

  batch.set(
    metaRef,
    {
      kind: "contacts_directory_meta",
      schemaVersion: 3,
      version: nextVersion,
      pageCount: pages.length,
      pageIds,
      contactCount: directoryContacts.length,
      rebuildPending: false,
      updatedAt: now
    },
    { merge: false }
  );

  await batch.commit();
  clearContactsBundleCache_();
}

function contactToFirestorePayload(contact) {
  return {
    id: String(contact.raw && contact.raw.id || contact.id || ""),
    first_name_he: String(contact.first || ""),
    last_name_he: String(contact.last || ""),
    first_name_en: String(contact.firstEn || ""),
    last_name_en: String(contact.lastEn || ""),
    title_prefix: String(contact.title || ""),
    role: String(contact.role || ""),
    department: String(contact.dept || ""),
    hospital: String(contact.hospital || ""),
    phone: String(contact.phone || ""),
    email: normalizeEmail(contact.email),
    source: String(contact.source || ""),
    status: String(contact.status || ""),
    created_at: String(contact.createdAt || ""),
    first_seen_at: String(contact.firstSeenAt || contact.createdAt || ""),
    is_new_contact: contact.isNewContact === true,
    updated_at: new Date().toISOString()
  };
}

async function removeAdminContact(docId) {
  const contact = getAdminContactByDocId(docId);
  if (!contact || contact.deleted) return;

  if (!await requestAdminConfirmation_({
    title: "הסרת איש קשר",
    message: `${contact.name || formatPhoneForDisplay(contact.phone)} יוסר מהאפליקציה. ניתן יהיה להחזיר את הרשומה בהמשך.`,
    confirmLabel: "הסרה מהאפליקציה",
    tone: "danger"
  })) {
    return;
  }

  setAdminStatus("מסיר את איש הקשר...", "loading");

  try {
    const payload = contactToFirestorePayload(contact);
    const batch = firebaseApi.writeBatch(db);

    batch.set(
      firebaseApi.doc(db, "contactOverrides", docId),
      {
        ...payload,
        deleted: true,
        updatedBy: currentAdminEmail,
        updatedAt: firebaseApi.serverTimestamp()
      },
      { merge: false }
    );

    batch.delete(firebaseApi.doc(db, "contacts", docId));
    batch.set(firebaseApi.doc(firebaseApi.collection(db, "admin_actions")), {
      action: "contact_remove",
      targetId: docId,
      targetEmail: payload.email || "",
      adminEmail: currentAdminEmail,
      timestamp: firebaseApi.serverTimestamp()
    });

    await batch.commit();
    await updateOptimizedContactBundle_(docId, payload, { deleted: true, countDelta: -1 });
    await loadContacts();
    await loadAdminData();
    setAdminStatus("איש הקשר הוסר מהאפליקציה.", "success");
  } catch (error) {
    console.error("Contact removal failed", error);
    setAdminStatus("הסרת איש הקשר נכשלה.", "error");
  }
}

async function restoreAdminContact(docId) {
  const contact = getAdminContactByDocId(docId);
  if (!contact || !contact.deleted) return;

  if (!await requestAdminConfirmation_({
    title: "החזרת איש קשר",
    message: `${contact.name || formatPhoneForDisplay(contact.phone)} יחזור להופיע בספר אנשי הקשר.`,
    confirmLabel: "החזרה לאפליקציה",
    tone: "primary"
  })) {
    return;
  }

  setAdminStatus("מחזיר את איש הקשר...", "loading");

  try {
    const payload = contactToFirestorePayload(contact);
    const batch = firebaseApi.writeBatch(db);

    batch.set(firebaseApi.doc(db, "contacts", docId), payload, { merge: false });
    batch.set(
      firebaseApi.doc(db, "contactOverrides", docId),
      {
        ...payload,
        deleted: false,
        updatedBy: currentAdminEmail,
        updatedAt: firebaseApi.serverTimestamp()
      },
      { merge: false }
    );

    batch.set(firebaseApi.doc(firebaseApi.collection(db, "admin_actions")), {
      action: "contact_restore",
      targetId: docId,
      targetEmail: payload.email || "",
      adminEmail: currentAdminEmail,
      timestamp: firebaseApi.serverTimestamp()
    });

    await batch.commit();
    await updateOptimizedContactBundle_(docId, payload, { deleted: false, countDelta: 1 });
    await loadContacts();
    await loadAdminData();
    setAdminStatus("איש הקשר הוחזר לאפליקציה.", "success");
  } catch (error) {
    console.error("Contact restoration failed", error);
    setAdminStatus("החזרת איש הקשר נכשלה.", "error");
  }
}

async function toggleUserAccess(email, shouldActivate) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || normalizedEmail === currentAdminEmail) {
    setAdminStatus("לא ניתן לשנות את הגישה של חשבון המנהל הנוכחי.", "error");
    return;
  }

  if (!await requestAdminConfirmation_({
    title: shouldActivate ? "החזרת גישה" : "חסימת גישה",
    message: shouldActivate
      ? `הגישה של ${normalizedEmail} ושל מספר הטלפון המקושר תוחזר.`
      : `${normalizedEmail} ומספר הטלפון המקושר ייחסמו לכניסה ולהרשמה חוזרת עד להחזרת הגישה.`,
    confirmLabel: shouldActivate ? "החזרת גישה" : "חסימת גישה",
    tone: shouldActivate ? "primary" : "warning"
  })) return;

  setAdminStatus(shouldActivate ? "מחזיר גישה..." : "חוסם גישה...", "loading");

  try {
    const userPermission = getAllowedUserByEmail(normalizedEmail);
    const phonePermission = userPermission && userPermission.phoneKey
      ? adminAllowedPhones.find(item =>
          item.phoneKey === userPermission.phoneKey
        ) || null
      : null;

    if (
      shouldActivate &&
      (!userPermission || !userPermission.phoneKey || !userPermission.phone)
    ) {
      setAdminStatus(
        "לא ניתן להחזיר גישה לפני שקיים קישור תקין בין המייל למספר הטלפון.",
        "error"
      );
      return;
    }

    if (
      shouldActivate &&
      phonePermission &&
      phonePermission.email !== normalizedEmail
    ) {
      setAdminStatus(
        "לא ניתן להחזיר גישה: מספר הטלפון מקושר להרשאת משתמש אחרת.",
        "error"
      );
      return;
    }

    const batch = firebaseApi.writeBatch(db);
    const now = firebaseApi.serverTimestamp();
    batch.set(
      firebaseApi.doc(db, "allowedUsers", normalizedEmail),
      {
        email: normalizedEmail,
        active: Boolean(shouldActivate),
        source: shouldActivate ? "admin-unblock" : "admin-block",
        updatedAt: now
      },
      { merge: true }
    );

    if (
      userPermission &&
      userPermission.phoneKey &&
      (!phonePermission || phonePermission.email === normalizedEmail)
    ) {
      batch.set(
        firebaseApi.doc(
          db,
          ALLOWED_PHONES_COLLECTION_NAME,
          userPermission.phoneKey
        ),
        {
          phone: userPermission.phone,
          phoneKey: userPermission.phoneKey,
          email: normalizedEmail,
          active: Boolean(shouldActivate),
          source: shouldActivate ? "admin-unblock" : "admin-block",
          updatedAt: now
        },
        { merge: true }
      );
    }

    batch.set(firebaseApi.doc(firebaseApi.collection(db, "admin_actions")), {
      action: shouldActivate ? "user_unblock" : "user_block",
      targetEmail: normalizedEmail,
      targetPhone: userPermission && userPermission.phone
        ? userPermission.phone
        : "",
      adminEmail: currentAdminEmail,
      timestamp: now
    });

    await batch.commit();
    syncAppUserMirrorFromClient_(normalizedEmail).catch(error => {
      console.warn("app_users mirror sync failed after access change", error);
    });
    invalidatePublicAuthRouteCacheFromAdmin_(normalizedEmail).catch(error => {
      console.warn("Auth route cache invalidation failed", error);
    });
    await loadAdminData();
    setAdminStatus(shouldActivate ? "הגישה הוחזרה." : "הגישה נחסמה.", "success");
  } catch (error) {
    console.error("User access update failed", error);
    setAdminStatus("עדכון ההרשאה נכשל.", "error");
  }
}

async function deleteUserPermission(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || normalizedEmail === currentAdminEmail) {
    setAdminStatus("לא ניתן לאפס את חשבון המנהל הנוכחי.", "error");
    return;
  }

  if (!await requestAdminConfirmation_({
    title: "איפוס מלא של חשבון הכניסה",
    message: `חשבון Firebase, הרשאות הכניסה ובקשות האישור והאיפוס של ${normalizedEmail} יימחקו. איש הקשר יישאר בספר, והאדם יוכל להירשם מחדש מאפס.`,
    confirmLabel: "איפוס החשבון",
    tone: "danger"
  })) {
    return;
  }

  setAdminStatus("מאפס את חשבון הכניסה...", "loading");

  try {
    const idToken = await auth.currentUser.getIdToken(true);
    await submitAuthRouterForm_(
      "resetUserLogin",
      { idToken, email: normalizedEmail },
      "contacts-auth-management"
    );
    await loadAdminData();
    setAdminStatus(
      "חשבון הכניסה אופס. איש הקשר נשאר בספר וניתן להירשם מחדש.",
      "success"
    );
  } catch (error) {
    console.error("Full login reset failed", error);
    setAdminStatus(
      error && error.message
        ? error.message
        : "איפוס חשבון הכניסה נכשל.",
      "error"
    );
  }
}


async function initializeFirebase() {
  const baseUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(`${baseUrl}/firebase-app.js`),
    import(`${baseUrl}/firebase-auth.js`),
    import(`${baseUrl}/firebase-firestore.js`)
  ]);

  firebaseApi = {
    initializeApp: appModule.initializeApp,
    getAuth: authModule.getAuth,
    setPersistence: authModule.setPersistence,
    browserLocalPersistence: authModule.browserLocalPersistence,
    browserSessionPersistence: authModule.browserSessionPersistence,
    createUserWithEmailAndPassword: authModule.createUserWithEmailAndPassword,
    signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
    sendEmailVerification: authModule.sendEmailVerification,
    sendPasswordResetEmail: authModule.sendPasswordResetEmail,
    deleteUser: authModule.deleteUser,
    onAuthStateChanged: authModule.onAuthStateChanged,
    reload: authModule.reload,
    signOut: authModule.signOut,
    getFirestore: firestoreModule.getFirestore,
    collection: firestoreModule.collection,
    doc: firestoreModule.doc,
    getDoc: firestoreModule.getDoc,
    getDocs: firestoreModule.getDocs,
    getCountFromServer: firestoreModule.getCountFromServer,
    setDoc: firestoreModule.setDoc,
    updateDoc: firestoreModule.updateDoc,
    deleteDoc: firestoreModule.deleteDoc,
    addDoc: firestoreModule.addDoc,
    writeBatch: firestoreModule.writeBatch,
    runTransaction: firestoreModule.runTransaction,
    serverTimestamp: firestoreModule.serverTimestamp,
    increment: firestoreModule.increment,
    onSnapshot: firestoreModule.onSnapshot,
    query: firestoreModule.query,
    where: firestoreModule.where,
    orderBy: firestoreModule.orderBy,
    limit: firestoreModule.limit
  };

  firebaseApp = firebaseApi.initializeApp(FIREBASE_CONFIG);
  auth = firebaseApi.getAuth(firebaseApp);
  db = firebaseApi.getFirestore(firebaseApp);

  auth.languageCode = "he";

  await firebaseApi.setPersistence(
    auth,
    firebaseApi.browserLocalPersistence
  );

  return await new Promise(resolve => {
    let initialStateResolved = false;

    firebaseApi.onAuthStateChanged(auth, user => {
      if (!initialStateResolved) {
        initialStateResolved = true;
        resolve(user || null);
      }

      if (authActionInProgress) return;

      handleAuthenticatedUser(user).catch(error => {
        console.error("Authentication state handling failed", error);
        showLoginScreen();
        setLoginStatus("שגיאה בכניסה למערכת. נסו לרענן את הדף.", "error");
      });
    });
  });
}

function setDirectoryMenuOpen_(menuId, buttonId, open) {
  const menu = document.getElementById(menuId);
  const button = document.getElementById(buttonId);
  if (menu) {
    menu.classList.toggle("visible", Boolean(open));
    menu.setAttribute("aria-hidden", String(!open));
  }
  if (button) button.setAttribute("aria-expanded", String(Boolean(open)));
}

function closeAllDirectoryMenus_() {
  setDirectoryMenuOpen_("accountMenu", "accountMenuBtn", false);
  setDirectoryMenuOpen_(
    "directoryToolsMenu",
    "directoryToolsMenuBtn",
    false
  );
}

function toggleAccountMenu_() {
  const menu = document.getElementById("accountMenu");
  const shouldOpen = !menu || !menu.classList.contains("visible");
  closeAllDirectoryMenus_();
  setDirectoryMenuOpen_("accountMenu", "accountMenuBtn", shouldOpen);
}

function toggleDirectoryToolsMenu_() {
  const menu = document.getElementById("directoryToolsMenu");
  const shouldOpen = !menu || !menu.classList.contains("visible");
  closeAllDirectoryMenus_();
  setDirectoryMenuOpen_(
    "directoryToolsMenu",
    "directoryToolsMenuBtn",
    shouldOpen
  );
}

function initMainDirectoryUx_() {
  if (document.body.dataset.mainDirectoryUxInitialized === "true") return;
  document.body.dataset.mainDirectoryUxInitialized = "true";

  const departmentList = document.getElementById("departmentList");
  if (departmentList) {
    departmentList.addEventListener("click", event => {
      const button = event.target.closest("[data-department-key]");
      if (!button) return;
      selectDepartmentFilter_(button.dataset.departmentKey || "");
    });
  }

  document.addEventListener("click", event => {
    if (!event.target.closest(".directoryMenuHost")) {
      closeAllDirectoryMenus_();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    closeAllDirectoryMenus_();
    if (document.getElementById("contactDetailSheet")?.classList.contains("visible")) {
      closeContactDetail_();
      return;
    }
    if (document.getElementById("departmentSheet")?.classList.contains("visible")) {
      closeDepartmentBrowser_();
      return;
    }
    if (document.getElementById("app")?.classList.contains("internsViewActive")) {
      closeMonthlyInternsView_();
    }
  });
}

function updateSearchUI() {
  const input = document.getElementById("searchInput");
  const q = input ? input.value.trim() : "";
  const clearButton = document.getElementById("clearSearchBtn");
  if (clearButton) clearButton.classList.toggle("visible", Boolean(q));
  updateQuickFilterButtons();
  updateMainSearchActionVisibility_();
}

function updateMainSearchActionVisibility_() {
  updateHomeDashboardVisibility_();
}

function shouldShowHomeDashboard_() {
  return Boolean(
    !selectionMode &&
    !isSearchActive() &&
    activeQuickFilter === "all" &&
    !directoryBrowseActivated
  );
}

function updateHomeDashboardVisibility_() {
  const dashboard = document.getElementById("homeDashboard");
  if (!dashboard) return;
  dashboard.hidden = !shouldShowHomeDashboard_();
}

function clearSearch() {
  const input = document.getElementById("searchInput");
  if (input) input.value = "";
  selectionMode = false;
  selectedContactIds.clear();
  updateSearchUI();
  renderCurrentSearchResults();
  if (input) input.focus();
}

function shouldShowNoResults() {
  return isSearchActive() || directoryBrowseActivated ||
    activeQuickFilter !== "all";
}

function updateResultsSummary(list) {
  const summary = document.getElementById("resultsSummary");
  if (!summary) return;
  if (!shouldShowNoResults()) {
    summary.textContent = "";
    return;
  }
  const count = Array.isArray(list) ? list.length : 0;
  summary.textContent = count === 0
    ? "לא נמצאו אנשי קשר"
    : count === 1
      ? "נמצא איש קשר אחד"
      : `נמצאו ${count} אנשי קשר`;
}

function updateDirectoryListToolbar_() {
  const toolbar = document.querySelector("#app .directoryListToolbar");
  if (!toolbar) return;
  toolbar.hidden = Boolean(
    !selectionMode &&
    !currentDisplayedContacts.length &&
    !shouldShowNoResults()
  );
}

function updateBulkActions() {
  const selectedCount = selectedContactIds.size;
  const bulkActions = document.getElementById("bulkActions");
  const info = document.getElementById("bulkActionsInfo");

  info.textContent = `נבחרו ${selectedCount} אנשי קשר`;

  if (selectionMode && selectedCount > 0) {
    bulkActions.classList.add("visible");
    document.body.classList.add("bulkBarVisible");
  } else {
    bulkActions.classList.remove("visible");
    document.body.classList.remove("bulkBarVisible");
  }
}

function toggleContactSelection(id) {
  if (!selectionMode) return;

  if (selectedContactIds.has(id)) selectedContactIds.delete(id);
  else selectedContactIds.add(id);

  updateBulkActions();
  refreshSelectedCardsUI();
}

function refreshSelectedCardsUI() {
  document.querySelectorAll(".contact").forEach(card => {
    const id = Number(card.dataset.id);
    card.classList.toggle("selected", selectionMode && selectedContactIds.has(id));
    const button = card.querySelector(".contactRowMain");
    if (button && selectionMode) {
      button.setAttribute(
        "aria-pressed",
        String(selectedContactIds.has(id))
      );
    }
    const indicator = card.querySelector(".contactSelectionIndicator");
    if (indicator) {
      indicator.classList.toggle("selected", selectedContactIds.has(id));
    }
  });
}

function clearSelectedContacts() {
  selectedContactIds.clear();
  updateBulkActions();
  refreshSelectedCardsUI();
}

function escapeVCardValue(value) {
  return (value || "")
    .toString()
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildContactVCard(c) {
  const vcardLines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "PRODID:-//Contacts App//HE",
    `N;CHARSET=UTF-8:${escapeVCardValue(c.last)};${escapeVCardValue(c.first)};;${escapeVCardValue(c.title)};`,
    `FN;CHARSET=UTF-8:${escapeVCardValue(c.name)}`,
    `ORG;CHARSET=UTF-8:${escapeVCardValue(c.dept)}`,
    `TITLE;CHARSET=UTF-8:${escapeVCardValue(c.role)}`,
    `TEL;TYPE=CELL:${escapeVCardValue(c.phone)}`
  ];

  if (c.email) vcardLines.push(`EMAIL:${escapeVCardValue(c.email)}`);
  if (c.firstEn) vcardLines.push(`X-PHONETIC-FIRST-NAME:${escapeVCardValue(c.firstEn)}`);
  if (c.lastEn) vcardLines.push(`X-PHONETIC-LAST-NAME:${escapeVCardValue(c.lastEn)}`);

  vcardLines.push("END:VCARD");
  return vcardLines.join("\r\n");
}
async function shareOrDownloadVCard(vcardContent, fileName, options = {}) {
  const { preferDirectOpen = false } = options;
  const mimeType = "text/vcard";
  const blob = new Blob([vcardContent], { type: mimeType + ";charset=utf-8" });

  if (preferDirectOpen) {
    const dataUrl = "data:text/vcard;charset=utf-8," + encodeURIComponent(vcardContent);
    window.location.href = dataUrl;
    return true;
  }

  if (typeof File !== "undefined" && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], fileName, { type: mimeType });
      const shareData = { files: [file] };

      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    } catch (error) {
      if (error && error.name === "AbortError") return false;
      console.warn("Native share failed, falling back to download", error);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

function cleanupOldImportPayloads() {
  const now = Date.now();
  const maxAge = 1000 * 60 * 60 * 24;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(IMPORT_STORAGE_PREFIX)) continue;

    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "{}");
      if (!parsed.createdAt || now - parsed.createdAt > maxAge) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      localStorage.removeItem(key);
    }
  }
}

function saveImportPayload(vcardContent, fileName, count, titleText, options = {}) {
  const key = IMPORT_STORAGE_PREFIX + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const payload = {
    vcardContent,
    fileName,
    count,
    titleText,
    markRecentImported: options.markRecentImported === true,
    markRecentImportCutoff: options.markRecentImportCutoff === true,
    importedRecentPhones: Array.isArray(options.importedRecentPhones)
      ? options.importedRecentPhones.map(normalizePhone).filter(Boolean)
      : [],
    createdAt: Date.now()
  };

  localStorage.setItem(key, JSON.stringify(payload));
  return key;
}

function openImportGuide(vcardContent, fileName, count, titleText, options = {}) {
  const key = saveImportPayload(
    vcardContent,
    fileName,
    count,
    titleText,
    options
  );
  const guideUrl = window.location.pathname + "?importKey=" + encodeURIComponent(key);
  window.open(guideUrl, "_blank");
}

function showGuideError(message) {
  const errorEl = document.getElementById("guideError");
  errorEl.style.display = "block";
  errorEl.textContent = message;
}

function goBackToMainApp() {
  window.location.href = window.location.pathname;
}

function renderImportGuide(importKey) {
  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "none";
  document.getElementById("importGuidePage").style.display = "block";

  const raw = localStorage.getItem(importKey);
  if (!raw) {
    showGuideError("לא נמצא מידע להורדה. חזרו לאפליקציה ונסו שוב.");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    showGuideError("קובץ ההורדה אינו תקין. חזרו לאפליקציה ונסו שוב.");
    return;
  }

  if (!payload || !payload.vcardContent || !payload.fileName) {
    showGuideError("חסר מידע להורדה. חזרו לאפליקציה ונסו שוב.");
    return;
  }

  document.getElementById("guideTitle").textContent = payload.titleText || "הורדת אנשי קשר";
  const guideContactCount = Math.max(0, Number(payload.count) || 0);
  document.getElementById("guideCountBox").innerHTML = guideContactCount === 1
    ? "הקובץ מוכן וכולל <b>איש קשר אחד</b>."
    : `הקובץ מוכן וכולל <b>${guideContactCount}</b> אנשי קשר.`;

  const finalBtn = document.getElementById("finalGuideBtn");
  finalBtn.onclick = async function () {
    const downloadCompleted = await shareOrDownloadVCard(payload.vcardContent, payload.fileName);
    if (downloadCompleted !== true) return;

    if (payload.markRecentImported === true) {
      markRecentContactPhonesImported_(payload.importedRecentPhones || []);

      if (payload.markRecentImportCutoff === true) {
        localStorage.setItem(
          RECENT_CONTACTS_STORAGE_KEY,
          String(Date.now())
        );
      }
    }
  };
}

async function downloadSelectedContacts() {
  if (isCurrentUserProvisional_()) {
    alert("הורדה מרוכזת זמינה לאחר אישור גישה קבועה.");
    return;
  }
  const selectedContacts = contacts.filter(c => selectedContactIds.has(c.id));

  if (!selectedContacts.length) {
    alert("לא נבחרו אנשי קשר");
    return;
  }

  const multiVCard = selectedContacts.map(buildContactVCard).join("\r\n\r\n") + "\r\n";
  openImportGuide(multiVCard, "selected-contacts.vcf", selectedContacts.length, "הורדת אנשי קשר");
}



function contactPickerSupported_() {
  return Boolean(
    window.isSecureContext &&
    navigator.contacts &&
    typeof navigator.contacts.select === "function"
  );
}

function setContactAddStatus_(message = "", type = "") {
  setStatus("contactAddStatus", message, type);
}

function resetContactAddDuplicateWarning_() {
  contactAddDuplicateConfirmed = false;
  const warning = document.getElementById("contactAddDuplicateWarning");
  if (warning) {
    warning.hidden = true;
    warning.innerHTML = "";
  }
  const submitButton = document.getElementById("contactAddSubmitBtn");
  if (submitButton && contactAddModalMode !== "admin") {
    submitButton.textContent = activeContactUpdate ? "שליחת העדכון לאישור" : "שליחה לבדיקה";
  }
}

function getLikelyDuplicateContact_(values) {
  const phone = normalizePhone(values && values.phone || "");
  if (!phone) return null;
  return contacts.find(contact =>
    normalizePhone(contact.phone || "") === phone &&
    (!activeContactUpdate || String(contact.docId || "") !== String(activeContactUpdate.docId || ""))
  ) || null;
}

function showContactDuplicateWarning_(contact) {
  const warning = document.getElementById("contactAddDuplicateWarning");
  if (!warning || !contact) return;
  warning.hidden = false;
  warning.innerHTML = `
    <strong>ייתכן שאיש הקשר כבר קיים</strong>
    <span>${escapeHtml(getContactDisplayName_(contact))} · ${escapeHtml(formatPhoneForDisplay(contact.phone))}</span>
    <small>בדקו את הרשומה. אם זה אדם אחר, אפשר לשלוח בכל זאת.</small>
  `;
  const submitButton = document.getElementById("contactAddSubmitBtn");
  if (submitButton) submitButton.textContent = "שליחה בכל זאת";
}

function resetContactAddForm_() {
  [
    "contactAddFirstName",
    "contactAddLastName",
    "contactAddTitlePrefix",
    "contactAddRole",
    "contactAddDepartment",
    "contactAddPhone",
    "contactAddEmail"
  ].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.value = "";
  });
  contactAddSource = "manual";
  activeContactUpdate = null;
  resetContactAddDuplicateWarning_();
  setContactAddStatus_("", "");
}

function setContactAddFormValues_(values = {}) {
  document.getElementById("contactAddFirstName").value = values.firstName || "";
  document.getElementById("contactAddLastName").value = values.lastName || "";
  document.getElementById("contactAddTitlePrefix").value = values.titlePrefix || "";
  document.getElementById("contactAddRole").value = values.role || "";
  document.getElementById("contactAddDepartment").value = values.department || "";
  document.getElementById("contactAddPhone").value = values.phone ? formatPhoneForDisplay(values.phone) : "";
  document.getElementById("contactAddEmail").value = values.email || "";
}

function bindContactAddDuplicateReset_() {
  [
    "contactAddFirstName", "contactAddLastName", "contactAddTitlePrefix",
    "contactAddRole", "contactAddDepartment", "contactAddPhone", "contactAddEmail"
  ].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.oninput = resetContactAddDuplicateWarning_;
  });
}

function openContactAddModal_() {
  contactAddModalMode = "user";
  activeContactAddRequestId = "";
  resetContactAddForm_();
  bindContactAddDuplicateReset_();
  document.getElementById("contactAddModalTitle").textContent = "הוספת איש קשר";
  document.getElementById("contactAddIntro").textContent = "לא חייבים למלא את כל השדות. יש להזין לפחות פרט אחד, והמנהל יבדוק את הבקשה לפני הפרסום.";
  document.getElementById("contactAddSubmitBtn").textContent = "שליחה לבדיקה";
  document.getElementById("contactAddPhone").readOnly = false;
  document.getElementById("contactAddEmail").readOnly = false;
  document.getElementById("contactAddPhone").classList.remove("myProfileReadOnly");
  document.getElementById("contactAddEmail").classList.remove("myProfileReadOnly");
  document.getElementById("contactPickerBox").classList.toggle("visible", contactPickerSupported_());
  document.getElementById("contactAddModal").classList.add("visible");
  document.body.style.overflow = "hidden";
  loadUserRequestStatuses_().then(() => {
    if (activeContactUpdate || contactAddModalMode !== "user") return;
    const latest = userRequestState.contactRequests
      .filter(request => String(request.requestType || "contact_add") === "contact_add")
      .sort((left, right) => getTimestampMillis_(right.updatedAt || right.createdAt) - getTimestampMillis_(left.updatedAt || left.createdAt))[0];
    if (!latest) return;
    const presentation = getUserRequestStatusPresentation_(latest.status);
    setContactAddStatus_(`מצב הבקשה האחרונה: ${presentation.label}.`, presentation.tone === "rejected" ? "error" : presentation.tone === "pending" ? "empty" : "success");
  });
}

function openContactUpdateModal_(contactId) {
  const contact = contacts.find(item => item.id === Number(contactId));
  if (!contact) return;
  contactAddModalMode = "user";
  activeContactAddRequestId = "";
  activeContactUpdate = contact;
  contactAddSource = "contact_detail";
  bindContactAddDuplicateReset_();
  contactAddDuplicateConfirmed = true;
  resetContactAddDuplicateWarning_();
  contactAddDuplicateConfirmed = true;
  setContactAddFormValues_({
    firstName: contact.first,
    lastName: contact.last,
    titlePrefix: contact.title,
    role: contact.role,
    department: contact.dept,
    phone: contact.phone,
    email: contact.email
  });
  document.getElementById("contactAddModalTitle").textContent = "עדכון פרטי איש קשר";
  document.getElementById("contactAddIntro").textContent = "הפרטים הנוכחיים כבר מולאו. שנו רק את מה שדורש תיקון; העדכון יפורסם לאחר אישור מנהל.";
  document.getElementById("contactAddSubmitBtn").textContent = "שליחת העדכון לאישור";
  document.getElementById("contactAddPhone").readOnly = false;
  document.getElementById("contactAddEmail").readOnly = false;
  document.getElementById("contactAddPhone").classList.remove("myProfileReadOnly");
  document.getElementById("contactAddEmail").classList.remove("myProfileReadOnly");
  document.getElementById("contactPickerBox").classList.remove("visible");
  setContactAddStatus_("", "");
  document.getElementById("contactAddModal").classList.add("visible");
  document.body.style.overflow = "hidden";

  loadUserRequestStatuses_().then(() => {
    const pending = findLatestUserContactRequest_(contact, ["pending"]);
    if (pending && activeContactUpdate && activeContactUpdate.id === contact.id) {
      setContactAddStatus_("כבר נשלחה בקשה והיא ממתינה לטיפול.", "empty");
    }
  });
}

function openContactAddRequestForApproval_(requestId, message = "") {
  if (!currentUserIsAdmin) return;
  const request = adminContactAddRequests.find(item => item.docId === requestId);
  if (!request || request.status !== "pending") return;

  contactAddModalMode = "admin";
  activeContactAddRequestId = requestId;
  contactAddSource = request.source || "manual";
  setContactAddFormValues_(request);

  const isSelfUpdate = request.requestType === "self_update";
  const isContactUpdate = request.requestType === "contact_update";
  const isUpdateRequest = isSelfUpdate || isContactUpdate;
  document.getElementById("contactAddModalTitle").textContent =
    isSelfUpdate ? "בדיקת עדכון הפרטים האישיים" : isContactUpdate ? "בדיקת עדכון איש קשר" : "עריכת בקשה לפני אישור";
  document.getElementById("contactAddIntro").textContent = isSelfUpdate
    ? "המשתמש ביקש לעדכן את הפרטים שלו. אפשר לתקן את הנוסח לפני האישור; מספר הטלפון והמייל נשארים ללא שינוי."
    : isContactUpdate
      ? "המשתמש ביקש לעדכן איש קשר קיים. אפשר להשוות, לתקן ולאשר את הפרטים החדשים."
      : "אפשר לתקן או להשלים פרטים. מספר טלפון נדרש רק בשלב האישור כדי שאיש הקשר יופיע באפליקציה.";
  document.getElementById("contactAddSubmitBtn").textContent =
    isUpdateRequest ? "אישור ועדכון" : "אישור והוספה";
  document.getElementById("contactAddPhone").readOnly = isSelfUpdate;
  document.getElementById("contactAddEmail").readOnly = isSelfUpdate;
  document.getElementById("contactAddPhone").classList.toggle(
    "myProfileReadOnly",
    isSelfUpdate
  );
  document.getElementById("contactAddEmail").classList.toggle(
    "myProfileReadOnly",
    isSelfUpdate
  );
  document.getElementById("contactPickerBox").classList.remove("visible");
  setContactAddStatus_(message, message ? "error" : "");
  document.getElementById("contactAddModal").classList.add("visible");
  document.body.style.overflow = "hidden";
}

function closeContactAddModal_() {
  const modal = document.getElementById("contactAddModal");
  if (modal) modal.classList.remove("visible");
  document.body.style.overflow = "";
  contactAddModalMode = "user";
  activeContactAddRequestId = "";
  activeContactUpdate = null;
  resetContactAddDuplicateWarning_();
  document.getElementById("contactAddPhone").readOnly = false;
  document.getElementById("contactAddEmail").readOnly = false;
  document.getElementById("contactAddPhone").classList.remove("myProfileReadOnly");
  document.getElementById("contactAddEmail").classList.remove("myProfileReadOnly");
  setContactAddStatus_("", "");
}

function splitPickedContactName_(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1]
  };
}

async function pickContactFromDevice_() {
  if (!contactPickerSupported_()) {
    setContactAddStatus_("בחירת איש קשר מהמכשיר אינה נתמכת בדפדפן הזה. אפשר למלא את הטופס ידנית.", "error");
    return;
  }

  const button = document.getElementById("contactPickerBtn");
  button.disabled = true;
  setContactAddStatus_("פותח את אנשי הקשר במכשיר...", "loading");

  try {
    // הקריאה מתבצעת ישירות מתוך לחיצת המשתמש כדי לשמור על הרשאת
    // ה-user gesture הנדרשת לבורר אנשי הקשר.
    const selected = await navigator.contacts.select(
      ["name", "tel", "email"],
      { multiple: false }
    );
    const contact = Array.isArray(selected) ? selected[0] : null;
    if (!contact) {
      setContactAddStatus_("לא נבחר איש קשר.", "");
      return;
    }

    const rawName = Array.isArray(contact.name) ? contact.name[0] : contact.name;
    const nameParts = splitPickedContactName_(rawName);
    const rawPhone = Array.isArray(contact.tel) ? contact.tel[0] : contact.tel;
    const rawEmail = Array.isArray(contact.email) ? contact.email[0] : contact.email;

    setContactAddFormValues_({
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      phone: rawPhone || "",
      email: rawEmail || ""
    });
    contactAddSource = "device_picker";
    setContactAddStatus_("הפרטים הועתקו מהמכשיר. אפשר לתקן או להשלים לפני השליחה.", "success");
  } catch (error) {
    console.error("Contact picker failed", error);
    const cancelled = error && ["AbortError", "NotAllowedError"].includes(error.name);
    setContactAddStatus_(
      cancelled
        ? "הבחירה בוטלה. אפשר למלא את הפרטים ידנית."
        : "לא הצלחנו לפתוח את אנשי הקשר במכשיר. אפשר למלא את הפרטים ידנית.",
      cancelled ? "" : "error"
    );
  } finally {
    button.disabled = false;
  }
}

async function submitContactAddRequest_() {
  const values = getContactAddFormValues_();
  const hasAnyValue = Object.values(values).some(value => String(value || "").trim());

  if (!hasAnyValue) {
    setContactAddStatus_("יש להזין לפחות פרט אחד על איש הקשר.", "error");
    return;
  }

  if (values.email && !isValidEmail(values.email)) {
    setContactAddStatus_("כתובת המייל אינה תקינה.", "error");
    return;
  }

  if (values.phone && !hasUsableContactPhone_(values.phone)) {
    setContactAddStatus_("מספר הטלפון אינו תקין.", "error");
    return;
  }

  if (contactAddModalMode === "admin") {
    await approveContactAddRequest_(activeContactAddRequestId, values);
    return;
  }

  const requestType = activeContactUpdate ? "contact_update" : "contact_add";
  if (activeContactUpdate) {
    const currentValues = {
      firstName: String(activeContactUpdate.first || "").trim(),
      lastName: String(activeContactUpdate.last || "").trim(),
      titlePrefix: String(activeContactUpdate.title || "").trim(),
      role: String(activeContactUpdate.role || "").trim(),
      department: String(activeContactUpdate.dept || "").trim(),
      phone: normalizePhone(activeContactUpdate.phone || ""),
      email: normalizeEmail(activeContactUpdate.email || "")
    };
    const normalizedValues = {
      ...values,
      phone: normalizePhone(values.phone || ""),
      email: normalizeEmail(values.email || "")
    };
    if (!Object.keys(currentValues).some(key => currentValues[key] !== normalizedValues[key])) {
      setContactAddStatus_("לא בוצעו שינויים בפרטים.", "empty");
      return;
    }
  } else if (!contactAddDuplicateConfirmed) {
    const duplicate = getLikelyDuplicateContact_(values);
    if (duplicate) {
      showContactDuplicateWarning_(duplicate);
      contactAddDuplicateConfirmed = true;
      setContactAddStatus_("בדקו אם זו אותה רשומה לפני שליחה.", "empty");
      return;
    }
  }

  const currentUser = auth && auth.currentUser;
  if (!currentUser || !currentUserHasAppAccess) {
    setContactAddStatus_("יש להתחבר לאפליקציה כדי לשלוח בקשה.", "error");
    return;
  }

  const submitButton = document.getElementById("contactAddSubmitBtn");
  submitButton.disabled = true;
  setContactAddStatus_(activeContactUpdate ? "שולח את העדכון לאישור..." : "שולח את הבקשה...", "loading");

  try {
    await loadUserRequestStatuses_({ force: true });
    const pendingRequest = findEquivalentPendingContactRequest_(values, {
      requestType,
      originalContactId: activeContactUpdate
        ? String(activeContactUpdate.docId || normalizePhone(activeContactUpdate.phone || "").replace(/\D/g, ""))
        : ""
    });
    if (pendingRequest) {
      setContactAddStatus_("כבר נשלחה בקשה והיא ממתינה לטיפול.", "empty");
      return;
    }

    const requestId = getCooldownSubmissionDocumentId_(activeContactUpdate ? "update" : "add", currentUser);
    const originalContact = activeContactUpdate;
    const requestPayload = {
      firstName: values.firstName,
      lastName: values.lastName,
      titlePrefix: values.titlePrefix,
      role: values.role,
      department: values.department,
      phone: values.phone ? normalizePhone(values.phone) : "",
      email: values.email,
      reporterEmail: normalizeEmail(currentUser.email || ""),
      source: activeContactUpdate
        ? "contact_detail"
        : contactAddSource === "device_picker" ? "device_picker" : "manual",
      requestType,
      originalContactId: originalContact
        ? String(originalContact.docId || normalizePhone(originalContact.phone || "").replace(/\D/g, ""))
        : "",
      originalPhone: originalContact ? normalizePhone(originalContact.phone || "") : "",
      originalEmail: originalContact ? normalizeEmail(originalContact.email || "") : "",
      status: "pending",
      createdAt: firebaseApi.serverTimestamp(),
      updatedAt: firebaseApi.serverTimestamp(),
      handledAt: null,
      handledBy: "",
      approvedContactId: ""
    };
    await firebaseApi.setDoc(
      firebaseApi.doc(db, "contactAddRequests", requestId),
      requestPayload,
      { merge: false }
    );

    userRequestState.contactRequests.unshift({
      docId: requestId,
      ...requestPayload,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    userRequestState.loadedAt = Date.now();
    setContactAddStatus_(
      activeContactUpdate
        ? "העדכון נשלח. מצב: ממתין לאישור."
        : "הבקשה נשלחה. מצב: ממתין לאישור.",
      "success"
    );
    document.getElementById("contactAddSubmitBtn").textContent = "ממתין לאישור";
    setTimeout(closeContactAddModal_, 1900);
  } catch (error) {
    console.error("Contact addition request failed", error);
    const isCooldown = error && [
      "permission-denied",
      "firestore/permission-denied"
    ].includes(error.code);
    setContactAddStatus_(
      isCooldown
        ? "כבר נשלחה בקשה בדקות האחרונות. המתינו מעט לפני שליחה נוספת."
        : "שליחת הבקשה נכשלה. בדקו את החיבור ונסו שוב.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
  }
}

function openContactReportModal(id) {
  const contact = contacts.find(item => item.id === id);
  if (!contact) return;

  activeReportContact = { ...contact, reportSubject: "contact" };
  const contactBox = document.getElementById("contactReportContact");
  const details = document.getElementById("contactReportDetails");
  const type = document.getElementById("contactReportType");
  const detailsLabel = document.getElementById("contactReportDetailsLabel");
  if (detailsLabel) detailsLabel.textContent = "מה צריך להיות מעודכן?";
  if (type) {
    type.innerHTML = `
      <option value="phone">מספר טלפון</option>
      <option value="email">כתובת מייל</option>
      <option value="name">שם או תואר</option>
      <option value="role">תפקיד</option>
      <option value="department">מחלקה / מכון</option>
      <option value="other">אחר</option>
    `;
  }
  if (contactBox) {
    contactBox.textContent = `${contact.name || "איש קשר"} · ${formatPhoneForDisplay(contact.phone)}`;
  }
  if (details) details.value = "";
  if (type) type.value = "phone";
  setStatus("contactReportStatus", "", "");
  const modal = document.getElementById("contactReportModal");
  if (modal) modal.classList.add("visible");
  document.body.style.overflow = "hidden";
}

function openMonthlyInternReport_(internId) {
  const intern = getMonthlyInternById_(internId);
  if (!intern || !auth || !auth.currentUser) return;
  activeReportContact = { ...intern, reportSubject: "intern" };
  document.getElementById("contactReportModalTitle").textContent = "דיווח על טעות בפרטי סטאז׳ר";
  document.getElementById("contactReportContact").textContent =
    `${intern.name} · ${formatPhoneForDisplay(intern.phone)}`;
  const type = document.getElementById("contactReportType");
  const detailsLabel = document.getElementById("contactReportDetailsLabel");
  if (detailsLabel) detailsLabel.textContent = "מה צריך לתקן? — לא חובה";
  if (type) {
    type.innerHTML = `
      <option value="name">שם שגוי</option>
      <option value="phone">מספר טלפון שגוי</option>
      <option value="department">מחלקה שגויה</option>
      <option value="other">אחר</option>
    `;
    type.value = "phone";
  }
  const details = document.getElementById("contactReportDetails");
  if (details) details.value = "";
  setStatus("contactReportStatus", "", "");
  document.getElementById("contactReportModal")?.classList.add("visible");
  document.body.style.overflow = "hidden";
}

function closeContactReportModal() {
  const modal = document.getElementById("contactReportModal");
  if (modal) modal.classList.remove("visible");
  document.body.style.overflow = "";
  activeReportContact = null;
  const title = document.getElementById("contactReportModalTitle");
  if (title) title.textContent = "דיווח על פרטים שגויים";
  setStatus("contactReportStatus", "", "");
}

async function submitContactReport() {
  if (!activeReportContact || !auth || !auth.currentUser || !db || !firebaseApi) return;

  const typeInput = document.getElementById("contactReportType");
  const detailsInput = document.getElementById("contactReportDetails");
  const button = document.getElementById("contactReportSubmitBtn");
  const issueType = String(typeInput ? typeInput.value : "other");
  const details = String(detailsInput ? detailsInput.value : "").trim();

  if (activeReportContact.reportSubject !== "intern" && details.length < 3) {
    setStatus("contactReportStatus", "כתבו בקצרה מה דורש תיקון.", "error");
    return;
  }

  if (button) button.disabled = true;
  setStatus("contactReportStatus", "שולח את הדיווח...", "loading");

  try {
    await loadUserRequestStatuses_({ force: true });
    const equivalentReport = findEquivalentOpenReport_({
      ...activeReportContact,
      issueType
    });
    if (equivalentReport) {
      setStatus("contactReportStatus", "כבר נשלחה בקשה והיא ממתינה לטיפול.", "empty");
      return;
    }

    const reportId = getCooldownSubmissionDocumentId_(
      "report",
      auth.currentUser
    );
    const isInternReport = activeReportContact.reportSubject === "intern";
    const reportPayload = {
      contactDocId: isInternReport ? "" : String(activeReportContact.docId || ""),
      contactPhone: String(activeReportContact.phone || ""),
      contactName: String(activeReportContact.name || ""),
      issueType,
      details,
      reporterEmail: normalizeEmail(auth.currentUser.email),
      status: "open",
      createdAt: firebaseApi.serverTimestamp()
    };
    if (isInternReport) {
      Object.assign(reportPayload, {
        subjectType: "intern",
        internId: String(activeReportContact.id || ""),
        internVersion: String(monthlyInternsState.version || ""),
        internDepartment: String(activeReportContact.department || "")
      });
    }
    await firebaseApi.setDoc(
      firebaseApi.doc(db, "contactReports", reportId),
      reportPayload,
      { merge: false }
    );

    userRequestState.reports.unshift({
      docId: reportId,
      ...reportPayload,
      createdAt: new Date()
    });
    userRequestState.loadedAt = Date.now();
    setStatus("contactReportStatus", "הדיווח נשלח. מצב: ממתין לטיפול.", "success");
    setTimeout(closeContactReportModal, 1300);
  } catch (error) {
    console.error("Contact report submission failed", error);
    const isCooldown = error && [
      "permission-denied",
      "firestore/permission-denied"
    ].includes(error.code);
    setStatus(
      "contactReportStatus",
      isCooldown
        ? "כבר נשלח דיווח בדקות האחרונות. המתינו מעט לפני דיווח נוסף."
        : "לא הצלחנו לשלוח את הדיווח. נסו שוב.",
      "error"
    );
  } finally {
    if (button) button.disabled = false;
  }
}

function getRecentContactSelectionKey_(contact) {
  return normalizePhone(contact && contact.phone);
}

function updateRecentContactsSelectionUi_() {
  const recentContacts = getRecentContacts();
  const selectedCount = recentContacts.filter(contact =>
    selectedRecentContactPhones.has(getRecentContactSelectionKey_(contact))
  ).length;
  const countBox = document.getElementById("recentContactsCount");
  const importButton = document.getElementById("recentContactsImportBtn");

  if (countBox) {
    if (!recentContacts.length) {
      countBox.textContent = "לא נמצאו כרגע אנשי קשר חדשים להורדה.";
    } else {
      const foundText = recentContacts.length === 1
        ? "נמצא איש קשר חדש אחד."
        : `נמצאו ${recentContacts.length} אנשי קשר חדשים.`;
      const selectedText = selectedCount === 1
        ? " נבחר איש קשר אחד להורדה."
        : ` נבחרו ${selectedCount} להורדה.`;
      countBox.textContent = foundText + selectedText;
    }
  }

  if (importButton) {
    importButton.disabled = selectedCount === 0;
    importButton.textContent = selectedCount > 0
      ? `הורדת ${selectedCount} אנשי קשר`
      : "בחרו אנשי קשר להורדה";
  }
}

function toggleRecentContactSelection_(phone, checked) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return;
  if (checked) selectedRecentContactPhones.add(normalizedPhone);
  else selectedRecentContactPhones.delete(normalizedPhone);
  updateRecentContactsSelectionUi_();
}

function selectAllRecentContacts_() {
  selectedRecentContactPhones = new Set(
    getRecentContacts().map(getRecentContactSelectionKey_).filter(Boolean)
  );
  document.querySelectorAll('#recentContactsList input[type="checkbox"]').forEach(input => {
    input.checked = true;
  });
  updateRecentContactsSelectionUi_();
}

function clearRecentContactsSelection_() {
  selectedRecentContactPhones.clear();
  document.querySelectorAll('#recentContactsList input[type="checkbox"]').forEach(input => {
    input.checked = false;
  });
  updateRecentContactsSelectionUi_();
}

function openRecentContactsModal() {
  if (isCurrentUserProvisional_()) {
    alert("הורדת אנשי קשר חדשים זמינה לאחר אישור גישה קבועה.");
    return;
  }
  const recentContacts = getRecentContacts();
  const hasPreviousImport =
    Number(localStorage.getItem(RECENT_CONTACTS_STORAGE_KEY) || 0) > 0 ||
    getImportedRecentContactPhones_().size > 0;
  const explanation = document.getElementById("recentContactsExplanation");
  const list = document.getElementById("recentContactsList");
  const selectionTools = document.getElementById("recentContactsSelectionTools");

  selectedRecentContactPhones = new Set(
    recentContacts.map(getRecentContactSelectionKey_).filter(Boolean)
  );

  if (explanation) {
    explanation.textContent = hasPreviousImport
      ? "הרשימה כוללת רק מספרי טלפון חדשים שנוספו למערכת מאז ההורדה האחרונה מהמכשיר הזה. שינוי שם, תפקיד, מייל או מחלקה של מספר קיים אינו נכלל. אפשר לבחור אילו אנשי קשר להוריד."
      : `זהו השימוש הראשון בכפתור, ולכן מוצגים רק מספרי טלפון חדשים שנוספו ב-${RECENT_CONTACTS_DEFAULT_DAYS} הימים האחרונים. שינוי פרטים של מספר קיים אינו נכלל. אפשר לבחור אילו אנשי קשר להוריד.`;
  }

  if (selectionTools) {
    selectionTools.classList.toggle("visible", recentContacts.length > 0);
  }

  if (list) {
    list.innerHTML = recentContacts.length ? recentContacts.map(contact => {
      const phone = getRecentContactSelectionKey_(contact);
      const date = getContactCreationDate(contact);
      const dateLabel = date ? new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(date) : "";
      const details = [contact.dept, formatPhoneForDisplay(contact.phone)].filter(Boolean).map(escapeHtml).join(" · ");
      return `<li><label class="recentContactOption"><input type="checkbox" checked onchange="toggleRecentContactSelection_('${escapeHtml(phone)}', this.checked)"><span class="recentContactCheckmark">✓</span><span class="recentContactText"><b>${escapeHtml(contact.name || formatPhoneForDisplay(contact.phone))}</b>${details ? "<br><small>" + details + "</small>" : ""}${dateLabel ? "<br><small>נוסף: " + escapeHtml(dateLabel) + "</small>" : ""}</span></label></li>`;
    }).join("") : '<li class="recentModalEmpty">לא נמצאו כרגע מספרי טלפון חדשים. שינוי פרטים של איש קשר קיים אינו מופיע ברשימה זו.</li>';
  }

  updateRecentContactsSelectionUi_();
  const modal = document.getElementById("recentContactsModal");
  if (modal) modal.classList.add("visible");
  document.body.style.overflow = "hidden";
}

function closeRecentContactsModal() {
  const modal = document.getElementById("recentContactsModal");
  if (modal) modal.classList.remove("visible");
  document.body.style.overflow = "";
}

async function downloadRecentContacts() {
  if (isCurrentUserProvisional_()) {
    alert("הורדת אנשי קשר חדשים זמינה לאחר אישור גישה קבועה.");
    return;
  }
  const recentContacts = getRecentContacts();
  const selectedContacts = recentContacts.filter(contact =>
    selectedRecentContactPhones.has(getRecentContactSelectionKey_(contact))
  );

  if (!selectedContacts.length) {
    alert("לא נבחרו אנשי קשר חדשים להורדה.");
    return;
  }

  const multiVCard = selectedContacts.map(buildContactVCard).join("\r\n\r\n") + "\r\n";
  const selectedPhones = selectedContacts.map(getRecentContactSelectionKey_).filter(Boolean);
  const allRecentSelected = selectedContacts.length === recentContacts.length;
  closeRecentContactsModal();
  openImportGuide(
    multiVCard,
    "new-contacts.vcf",
    selectedContacts.length,
    "הורדת אנשי קשר חדשים",
    {
      markRecentImported: true,
      markRecentImportCutoff: allRecentSelected,
      importedRecentPhones: selectedPhones
    }
  );
}

async function downloadAllContacts() {
  if (isCurrentUserProvisional_()) {
    alert("הורדת כל אנשי הקשר זמינה לאחר אישור גישה קבועה.");
    return;
  }
  if (!contacts.length) {
    alert("לא נמצאו אנשי קשר");
    return;
  }

  const multiVCard = contacts.map(buildContactVCard).join("\r\n\r\n") + "\r\n";
  openImportGuide(multiVCard, "all-contacts.vcf", contacts.length, "הורדת כל אנשי הקשר");
}

function downloadContact(id) {
  const c = contacts.find(contact => contact.id === id);

  if (!c) {
    alert("איש הקשר לא נמצא. נסו לרענן את החיפוש.");
    return;
  }

  recordContactUse_(id, "download");

  const vcard = buildContactVCard(c) + "\r\n";
  const displayName = String(
    c.name || formatPhoneForDisplay(c.phone) || "contact"
  ).trim();
  const safeFileName =
    displayName.replace(/[\\/:*?"<>|]+/g, "-") + ".vcf";

  const blob = new Blob([vcard], {
    type: "text/vcard;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = safeFileName;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

async function downloadMonthlyIntern_(internId) {
  const intern = getMonthlyInternById_(internId);
  if (!intern) return;
  const displayName = String(intern.name || "סטאז׳ר").trim();
  const nameParts = splitPickedContactName_(displayName);
  const vcard = buildContactVCard({
    first: nameParts.firstName,
    last: nameParts.lastName,
    title: "",
    name: displayName,
    dept: String(intern.department || ""),
    role: "סטאז׳ר/ית",
    phone: normalizePhone(intern.phone || ""),
    email: "",
    firstEn: "",
    lastEn: ""
  }) + "\r\n";
  const safeFileName = displayName.replace(/[\\/:*?"<>|]+/g, "-") + ".vcf";
  const completed = await shareOrDownloadVCard(vcard, safeFileName);
  if (completed) recordContactUse_(intern.phone, "download");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightSearchText(value) {
  const rawValue = String(value || "");
  const searchInput = document.getElementById("searchInput");
  const query = searchInput ? normalizeSearchText(searchInput.value) : "";
  const terms = query.split(" ").map(term => term.trim()).filter(term => term.length >= 2).sort((a, b) => b.length - a.length);
  if (!terms.length || !rawValue) return escapeHtml(rawValue);

  const pattern = new RegExp(terms.map(escapeRegExp).join("|"), "gi");
  let result = "";
  let lastIndex = 0;

  rawValue.replace(pattern, (match, offset) => {
    result += escapeHtml(rawValue.slice(lastIndex, offset));
    result += `<mark class="searchHighlight">${escapeHtml(match)}</mark>`;
    lastIndex = offset + match.length;
    return match;
  });

  result += escapeHtml(rawValue.slice(lastIndex));
  return result;
}

function renderContactName(contact) {
  const first = String(contact && contact.first || "").trim();
  const last = String(contact && contact.last || "").trim();
  const firstEn = String(contact && contact.firstEn || "").trim();
  const lastEn = String(contact && contact.lastEn || "").trim();
  const renderedName = [
    escapeHtml(contact.title),
    highlightSearchText(first || firstEn),
    highlightSearchText(last || lastEn)
  ].filter(Boolean).join(" ").trim();

  return renderedName || escapeHtml(contact.name || formatPhoneForDisplay(contact.phone));
}

function getContactDisplayName_(contact) {
  const hebrewName = [contact && contact.first, contact && contact.last]
    .filter(Boolean)
    .join(" ")
    .trim();
  const englishName = [contact && contact.firstEn, contact && contact.lastEn]
    .filter(Boolean)
    .join(" ")
    .trim();
  return [contact && contact.title, hebrewName || englishName]
    .filter(Boolean)
    .join(" ")
    .trim() || formatPhoneForDisplay(contact && contact.phone);
}

function getDirectoryIconSvg_(iconName) {
  const paths = {
    phone: '<path d="M7.2 3.5 9.5 8l-2 1.6a15 15 0 0 0 6.9 6.9l1.6-2 4.5 2.3-.7 3a2 2 0 0 1-2 1.6C9.4 20.7 3.3 14.6 2.6 6.2a2 2 0 0 1 1.6-2z"/>',
    whatsapp: '<path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/><path d="M8.5 8.4c.6 3 2.1 4.5 5.1 5.1"/>',
    saveContact: '<path d="M9.5 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 20a6 6 0 0 1 10.7-3.7M18 12v7m-3.5-3.5h7"/>',
    chevron: '<path d="m14.5 6-6 6 6 6"/>',
    check: '<path d="m5 12.5 4.2 4.2L19 7"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[iconName] || ""}</svg>`;
}

function closeContactDetail_() {
  const sheet = document.getElementById("contactDetailSheet");
  if (sheet) {
    sheet.classList.remove("visible");
    sheet.setAttribute("aria-hidden", "true");
  }
  activeContactDetailId = null;
  if (!document.querySelector(".directorySheet.visible")) {
    document.body.classList.remove("directorySheetOpen");
  }
}

function openContactDetail_(id) {
  if (selectionMode) {
    toggleContactSelection(id);
    return;
  }

  const contact = contacts.find(item => item.id === Number(id));
  if (!contact) return;
  activeContactDetailId = contact.id;
  closeAllDirectoryMenus_();

  const name = getContactDisplayName_(contact);
  const englishName = [contact.firstEn, contact.lastEn]
    .filter(Boolean)
    .join(" ")
    .trim();
  const meta = [contact.role, getVisibleDepartment_(contact)]
    .filter(Boolean)
    .join(" · ");
  const displayPhone = formatPhoneForDisplay(contact.phone);
  const cleanPhone = normalizePhone(contact.phone).replace("+", "");
  const hideWhatsapp = isNoWhatsappPhone(contact.phone);

  document.getElementById("contactDetailName").textContent = name;
  const englishNameElement = document.getElementById("contactDetailEnglishName");
  if (englishNameElement) {
    englishNameElement.textContent = englishName;
    englishNameElement.hidden = !englishName;
  }
  document.getElementById("contactDetailMeta").textContent = meta;
  document.getElementById("contactDetailPhone").textContent = displayPhone;

  const callLink = document.getElementById("contactDetailCall");
  callLink.href = `tel:${contact.phone}`;
  callLink.setAttribute("aria-label", `חיוג אל ${name}`);
  callLink.onclick = () => recordContactUse_(contact.id, "call");

  const whatsappLink = document.getElementById("contactDetailWhatsapp");
  whatsappLink.hidden = hideWhatsapp;
  whatsappLink.href = `https://wa.me/${cleanPhone}`;
  whatsappLink.setAttribute("aria-label", `פתיחת WhatsApp עם ${name}`);
  whatsappLink.onclick = () => recordContactUse_(contact.id, "whatsapp");

  const emailLink = document.getElementById("contactDetailEmail");
  const emailRow = document.getElementById("contactDetailEmailRow");
  const emailText = document.getElementById("contactDetailEmailText");
  emailLink.hidden = !contact.email;
  emailRow.hidden = !contact.email;
  emailLink.href = contact.email ? `mailto:${contact.email}` : "#";
  emailLink.setAttribute("aria-label", `שליחת מייל אל ${name}`);
  emailLink.onclick = () => recordContactUse_(contact.id, "email");
  emailText.textContent = contact.email || "";

  updateContactDetailRequestStatus_(contact);
  loadUserRequestStatuses_().then(() => {
    if (activeContactDetailId === contact.id) updateContactDetailRequestStatus_(contact);
  });

  const sheet = document.getElementById("contactDetailSheet");
  sheet.classList.add("visible");
  sheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("directorySheetOpen");
  window.setTimeout(() => {
    const closeButton = sheet.querySelector(".directorySheetClose");
    if (closeButton) closeButton.focus();
  }, 0);
}

function downloadActiveContact_() {
  if (activeContactDetailId === null) return;
  downloadContact(activeContactDetailId);
}

function reportActiveContact_() {
  if (activeContactDetailId === null) return;
  const id = activeContactDetailId;
  closeContactDetail_();
  openContactReportModal(id);
}

function updateContactDetailRequestStatus_(contact) {
  const element = document.getElementById("contactDetailRequestStatus");
  if (!element) return;
  const updateRequest = findLatestUserContactRequest_(contact);
  const report = userRequestState.reports
    .filter(item => item.subjectType !== "intern" && (
      (contact.docId && String(item.contactDocId || "") === String(contact.docId)) ||
      normalizePhone(item.contactPhone || "") === normalizePhone(contact.phone || "")
    ))
    .sort((left, right) => getTimestampMillis_(right.resolvedAt || right.createdAt) - getTimestampMillis_(left.resolvedAt || left.createdAt))[0] || null;
  const current = updateRequest
    ? { ...getUserRequestStatusPresentation_(updateRequest.status), prefix: "עדכון פרטים" }
    : report
      ? { ...getUserRequestStatusPresentation_(report.status, "report"), prefix: "דיווח" }
      : null;
  element.hidden = !current;
  element.className = `userRequestStatus${current ? ` ${current.tone}` : ""}`;
  element.textContent = current ? `${current.prefix}: ${current.label}` : "";
}

function updateActiveContact_() {
  if (activeContactDetailId === null) return;
  const id = activeContactDetailId;
  closeContactDetail_();
  openContactUpdateModal_(id);
}

function getVisibleDepartment_(contact) {
  const department = String(contact && contact.dept || "").trim();
  if (!department || !activeQuickFilter || activeQuickFilter === "all") {
    return department;
  }

  const normalized = normalizeSearchText(department);
  const genericLabels = new Set([
    "vpn",
    "תורן vpn",
    "תורנים vpn",
    "תורני vpn",
    "vpn תורן",
    "vpn תורנים",
    "מעבדה",
    "מעבדות",
    "מכון",
    "מכונים"
  ]);

  return genericLabels.has(normalized) ? "" : department;
}

function show(list) {
  currentDisplayedContacts = list;

  if (selectionMode && !canUseMultiSelection()) {
    selectionMode = false;
    selectedContactIds.clear();
  }

  updateMainActionButton();
  updateResultsSummary(list);
  updateDirectoryListToolbar_();

  if (!list.length) {
    document.getElementById("list").innerHTML = "";

    if (shouldShowNoResults()) {
      setListStatus(
        "לא נמצאו אנשי קשר. נסו שם, תפקיד או מחלקה.",
        "empty"
      );
    } else {
      setListStatus("", "");
    }

    updateBulkActions();
    return;
  }

  setListStatus("", "");
  let html = "";

  list.forEach(c => {
    const cleanPhone = normalizePhone(c.phone).replace("+", "");
    const displayPhone = formatPhoneForDisplay(c.phone);
    const isSelected = selectionMode && selectedContactIds.has(c.id);
    const hideWhatsapp = isNoWhatsappPhone(c.phone);
    const visibleDepartment = getVisibleDepartment_(c);
    const meta = [c.role, visibleDepartment]
      .filter(Boolean)
      .map(highlightSearchText)
      .join('<span class="contactMetaSeparator" aria-hidden="true"> · </span>');
    const displayName = getContactDisplayName_(c);
    const rowAction = selectionMode
      ? `toggleContactSelection(${c.id})`
      : `openContactDetail_(${c.id})`;
    const rowLabel = selectionMode
      ? `${isSelected ? "ביטול בחירת" : "בחירת"} ${displayName}`
      : `פתיחת פרטי ${displayName}`;

    html += `
      <article class="contact ${isSelected ? "selected" : ""}" data-id="${c.id}">
        <button type="button" class="contactRowMain" onclick="${rowAction}" aria-label="${escapeHtml(rowLabel)}" ${selectionMode ? `aria-pressed="${isSelected}"` : ""}>
          ${selectionMode ? `<span class="contactSelectionIndicator ${isSelected ? "selected" : ""}" data-id="${c.id}">${getDirectoryIconSvg_("check")}</span>` : ""}
          <span class="contactRowContent">
            <span class="contactName">${renderContactName(c)}</span>
            ${meta ? `<span class="contactRowMeta">${meta}</span>` : ""}
            <span class="contactRowPhone" dir="ltr">${escapeHtml(displayPhone)}</span>
          </span>
          ${selectionMode ? "" : `<span class="contactRowChevron">${getDirectoryIconSvg_("chevron")}</span>`}
        </button>
        ${selectionMode ? "" : `
          <div class="contactRowActions">
            <a class="contactIconAction call" href="tel:${c.phone}" aria-label="חיוג אל ${escapeHtml(displayName)}" onclick="recordContactUse_(${c.id}, 'call')">${getDirectoryIconSvg_("phone")}</a>
            ${hideWhatsapp ? "" : `<a class="contactIconAction whatsapp" href="https://wa.me/${cleanPhone}" target="_blank" rel="noopener" aria-label="פתיחת WhatsApp עם ${escapeHtml(displayName)}" onclick="recordContactUse_(${c.id}, 'whatsapp')">${getDirectoryIconSvg_("whatsapp")}</a>`}
            <button type="button" class="contactIconAction saveContact" aria-label="הוספת ${escapeHtml(displayName)} לאנשי הקשר בטלפון" onclick="downloadContact(${c.id})">${getDirectoryIconSvg_("saveContact")}</button>
          </div>
        `}
      </article>
    `;
  });

  document.getElementById("list").innerHTML = html;
  updateBulkActions();
}

function renderCurrentSearchResults() {
  const input = document.getElementById("searchInput");
  const logo = document.getElementById("logo");
  const rawQuery = input ? input.value : "";
  const q = normalizeSearchText(rawQuery);
  const qNoHyphen = rawQuery.replace(/\D/g, "");
  const baseContacts = getQuickFilterContacts();

  updateSearchUI();
  if (selectionMode) selectedContactIds.clear();

  if (q.length < 1) {
    if (shouldShowHomeDashboard_()) {
      selectionMode = false;
      if (logo) logo.classList.remove("hidden");
      show([]);
      return;
    }

    if (logo) logo.classList.add("hidden");
    show([...baseContacts].sort(compareContactsByName));
    return;
  }

  if (logo) logo.classList.add("hidden");

  const ranked = baseContacts
    .map(contact => ({ contact, priority: getSearchPriority(contact, q, qNoHyphen) }))
    .filter(item => item.priority !== null)
    .sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : compareContactsByName(a.contact, b.contact))
    .map(item => item.contact);

  show(ranked);
}

function search() {
  renderCurrentSearchResults();
}



document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushUsageMetrics_().catch(() => {});
  }
});

window.addEventListener("pagehide", () => {
  flushUsageMetrics_().catch(() => {});
});

/* PROTECTED_EASTER_EGG_START */
/* Permanent owner signature — do not remove or modify without explicit owner approval. */
function initHiddenGreenSignature_() {
  const roots = document.querySelectorAll("[data-green-signature-root]");
  const tapResetDurationMs = 1600;
  const visibleDurationMs = 5000;
  const returnDurationMs = 700;
  const movementLimitPx = 12;

  roots.forEach(root => {
    if (root.dataset.greenSignatureInitialized === "true") return;

    const copy = root.querySelector(".green-signature-copy");
    const showsCopy =
      root.dataset.greenSignatureCopy === "true" && Boolean(copy);
    let tapResetTimer = null;
    let restoreTimer = null;
    let finishTimer = null;
    let activePointerId = null;
    let startX = 0;
    let startY = 0;
    let tapCount = 0;
    let isActive = false;

    root.dataset.greenSignatureInitialized = "true";

    const clearTimer_ = timer => {
      if (timer !== null) window.clearTimeout(timer);
    };

    const resetTapSequence_ = () => {
      clearTimer_(tapResetTimer);
      tapResetTimer = null;
      tapCount = 0;
      activePointerId = null;
    };

    const finishReturn_ = () => {
      clearTimer_(finishTimer);
      finishTimer = null;
      root.classList.remove("green-signature-returning");
      if (showsCopy) copy.setAttribute("aria-hidden", "true");
      isActive = false;
    };

    const restoreOriginalLogo_ = () => {
      clearTimer_(restoreTimer);
      restoreTimer = null;
      root.classList.remove("green-signature-active");
      root.classList.add("green-signature-returning");
      finishTimer = window.setTimeout(finishReturn_, returnDurationMs);
    };

    const activateSignature_ = () => {
      resetTapSequence_();
      if (isActive) return;

      isActive = true;
      if (showsCopy) copy.setAttribute("aria-hidden", "false");
      root.classList.add("green-signature-active");
      restoreTimer = window.setTimeout(
        restoreOriginalLogo_,
        visibleDurationMs
      );
    };

    const registerTap_ = () => {
      tapCount += 1;
      clearTimer_(tapResetTimer);

      if (tapCount >= 3) {
        activateSignature_();
        return;
      }

      tapResetTimer = window.setTimeout(
        resetTapSequence_,
        tapResetDurationMs
      );
    };

    root.addEventListener("pointerdown", event => {
      if (
        isActive ||
        activePointerId !== null ||
        event.isPrimary === false ||
        (event.pointerType === "mouse" && event.button !== 0)
      ) {
        return;
      }

      activePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      if (event.cancelable) event.preventDefault();
    });

    root.addEventListener("pointermove", event => {
      if (event.pointerId !== activePointerId) return;

      const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
      if (moved > movementLimitPx) resetTapSequence_();
    });

    root.addEventListener("pointerup", event => {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      registerTap_();
    });

    ["pointerleave", "pointercancel"].forEach(eventName => {
      root.addEventListener(eventName, event => {
        if (event.pointerId === activePointerId) resetTapSequence_();
      });
    });

    root.addEventListener("contextmenu", event => {
      event.preventDefault();
    });

    root.addEventListener("dragstart", event => event.preventDefault());
  });
}
/* PROTECTED_EASTER_EGG_END */

function init() {
  initHiddenGreenSignature_();
  initAuthInputEnhancements_();
  initVerificationReturnMonitor_();
  initMainDirectoryUx_();
  cleanupOldImportPayloads();

  const params = new URLSearchParams(window.location.search);
  const importKey = params.get("importKey");

  if (importKey) {
    renderImportGuide(importKey);
    return;
  }

  const requestedEmail = normalizeEmail(params.get("email") || "");
  const forceFreshRoute = params.get("fresh") === "1";
  const manualApprovalIntent = params.get("manualApproval") === "1";
  if (manualApprovalIntent && isValidEmail(requestedEmail)) {
    pendingManualApprovalIntentEmail = requestedEmail;
    pendingManualApprovalIntentHandled = false;
  }
  const pendingEmail = getPendingAuthEmail_();
  const savedEmail = getSavedLoginEmail_();
  const autoRouteEmail = isValidEmail(requestedEmail)
    ? requestedEmail
    : pendingEmail || savedEmail;
  const isReturningEmail = Boolean(
    !requestedEmail &&
    !pendingEmail &&
    savedEmail &&
    autoRouteEmail === savedEmail
  );

  loadPendingUsage_();
  showAuthEmailStep_({ keepStatus: true });

  const emailInput = document.getElementById("emailInput");
  if (emailInput && autoRouteEmail) emailInput.value = autoRouteEmail;

  setLoginStatus("טוען את המערכת...", "loading");
  setLoginButtonDisabled(true);
  setStepButtonBusy_("emailContinueBtn", true, "טוען...", "המשך");

  // מונע מהמאזין לבצע במקביל את אותה פעולת כניסה ראשונית.
  // לאחר קבלת מצב הסשן הראשוני, init מנתב פעם אחת בלבד.
  authActionInProgress = true;

  initializeFirebase()
    .then(async initialUser => {
      setLoginButtonDisabled(false);
      setStepButtonBusy_("emailContinueBtn", false, "טוען...", "המשך");

      const shouldSwitchAfterEmailUpdate = Boolean(
        initialUser &&
        forceFreshRoute &&
        isValidEmail(requestedEmail) &&
        normalizeEmail(initialUser.email) !== requestedEmail
      );

      if (shouldSwitchAfterEmailUpdate) {
        try {
          await firebaseApi.signOut(auth);
        } catch (error) {
          console.error("Could not switch to the updated email", error);
        }
        initialUser = null;
      }

      authActionInProgress = false;

      if (initialUser) {
        // סשן מקומי תקף נכנס אוטומטית, בלי מסך מייל או סיסמה.
        await handleAuthenticatedUser(initialUser);
        return;
      }

      const pendingRecovery = loadPendingPasswordRecovery_();
      if (pendingRecovery) {
        showPasswordRecoveryPanel_(pendingRecovery);
        return;
      }

      setLoginStatus("", "");
      showLoginScreen();
      if (autoRouteEmail) {
        await continueFromEmailStep({
          forceFresh: forceFreshRoute,
          returning: isReturningEmail
        });
      } else {
        showAuthEmailStep_({ forceEmailEntry: true });
      }
    })
    .catch(error => {
      authActionInProgress = false;
      console.error("Firebase initialization failed", error);
      showLoginScreen();
      setLoginButtonDisabled(false);
      setStepButtonBusy_("emailContinueBtn", false, "טוען...", "המשך");
      setLoginStatus(
        "לא הצלחנו לטעון את מערכת ההתחברות. נסו לרענן את הדף.",
        "error"
      );
    });
}
init();
