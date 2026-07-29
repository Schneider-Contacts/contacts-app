

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
const REGISTRATION_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfY6dWQD_OH5oXS1vbyRJRU44S1HSmAb6BLrA-a7SljvoaxzQ/viewform?usp=header";
const AUTH_ROUTE_TIMEOUT_MS = 9000;
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
let activeQuickFilter = "";
let selectedRecentContactPhones = new Set();

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

let currentUserIsAdmin = false;
let currentUserIsSuperAdmin = false;
let currentUserHasAppAccess = false;
let verificationAccessListenerUnsubscribe = null;
let verificationAccessTransitionInProgress = false;
let currentAdminRole = "";
let currentAdminEmail = "";
let permissionListenerUnsubscribe = null;
let phonePermissionListenerUnsubscribe = null;
let permissionExpiryTimer = null;
let passwordRecoveryStatusTimer = null;
let activePasswordRecovery = null;
let adminActiveTab = "general";
let adminActiveFilter = "all";
let adminContacts = [];
let adminRemovedContacts = [];
let adminAllowedUsers = [];
let adminAllowedPhones = [];
let adminManagers = [];
let adminActivity = [];
let adminUsageDaily = [];
let adminDailyActiveUsers = [];
let adminDailyContactUsers = [];
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
let adminDataLoading = false;
const ADMIN_LIST_PAGE_SIZE = 25;
const ADMIN_PENDING_SUMMARY_CACHE_MS = 2 * 60 * 1000;
let adminVisibleItemCount = ADMIN_LIST_PAGE_SIZE;
let adminLoadedSections = new Set();
let adminSectionLoadPromises = new Map();
let adminUsageHistoryLoaded = false;
let adminUsageHistoryLoading = false;
let adminReasonResolve = null;


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

function getSearchPriority(contact, q, qNoHyphen) {
  const first = normalizeSearchText(contact.first);
  const last = normalizeSearchText(contact.last);
  const firstEn = normalizeSearchText(contact.firstEn);
  const lastEn = normalizeSearchText(contact.lastEn);
  const full = [first, last].filter(Boolean).join(" ");
  const fullEn = [firstEn, lastEn].filter(Boolean).join(" ");
  const nameParts = [first, last].filter(Boolean);
  const englishNameParts = [firstEn, lastEn].filter(Boolean);
  const queryTokens = q.split(" ").filter(Boolean);
  const phoneIntl = normalizeSearchText(contact.phone);
  const phoneLocal = getPhoneSearchValue(contact.phone);

  if (first === q || last === q || full === q) return 1;

  if (queryTokens.length > 1 && queryTokens.every((token, index) => !!nameParts[index] && nameParts[index].startsWith(token))) {
    return 2;
  }

  if (first.startsWith(q) || last.startsWith(q)) return 3;
  if (full.startsWith(q)) return 4;

  if (queryTokens.length > 1 && queryTokens.every(token => nameParts.some(namePart => namePart.startsWith(token)))) {
    return 5;
  }

  if (first.includes(q) || last.includes(q) || full.includes(q)) return 6;
  if (firstEn === q || lastEn === q || fullEn === q) return 7;
  if (firstEn.startsWith(q) || lastEn.startsWith(q) || fullEn.startsWith(q)) return 8;

  if (queryTokens.length > 1 && queryTokens.every(token => englishNameParts.some(namePart => namePart.startsWith(token)))) {
    return 9;
  }

  if (firstEn.includes(q) || lastEn.includes(q) || fullEn.includes(q)) return 10;
  if (qNoHyphen && phoneLocal.startsWith(qNoHyphen)) return 11;
  if (qNoHyphen && phoneIntl.replace(/\D/g, "").startsWith(qNoHyphen)) return 12;
  if (qNoHyphen && (phoneLocal.includes(qNoHyphen) || phoneIntl.replace(/\D/g, "").includes(qNoHyphen))) return 13;
  return null;
}

function compareContactsByName(a, b) {
  const lastComparison = (a.last || "").localeCompare(b.last || "", "he", { sensitivity: "base" });
  if (lastComparison !== 0) return lastComparison;
  return (a.first || "").localeCompare(b.first || "", "he", { sensitivity: "base" });
}

function isSearchActive() {
  const input = document.getElementById("searchInput");
  return !!input && normalizeSearchText(input.value).length >= 2;
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

function isQuickFilterActive() { return ["vpn", "institutes", "labs"].includes(activeQuickFilter); }
function canUseMultiSelection() { return isSearchActive() || isQuickFilterActive(); }
function contactMatchesQuickFilter(contact, filterName) {
  const department = normalizeSearchText(contact.dept);
  const belongsToVpnList = department.includes("vpn");
  if (filterName === "vpn") return belongsToVpnList && isMobilePhone(contact.phone);
  if (filterName === "institutes") return belongsToVpnList && isInstituteLandline(contact.phone);
  if (filterName === "labs") return department.includes("מעבד");
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
}

function toggleQuickFilter(filterName) {
  activeQuickFilter = activeQuickFilter === filterName ? "" : filterName;
  selectionMode = false;
  selectedContactIds.clear();
  updateQuickFilterButtons();
  renderCurrentSearchResults();
}

function updateMainActionButton() {
  const btn = document.getElementById("importAllBtn");
  if (!btn) return;

  if (selectionMode) {
    btn.disabled = false;
    btn.textContent = "בטל בחירה";
    return;
  }

  btn.disabled = false;

  if (canUseMultiSelection()) {
    btn.textContent = "בחירת כמה אנשי קשר";
    return;
  }

  btn.textContent = "הורדת כל אנשי הקשר";
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

function enterSelectionMode() {
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
    id: index
  }));

  return contacts;
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

  return "לא הצלחנו להשלים את הפעולה. בדקו את הפרטים ונסו שוב.";
}

function setAuthMode(mode) {
  authPurpose = ["login", "register", "verify_existing", "guided"].includes(mode)
    ? mode
    : "guided";
  authMode = authPurpose === "register"
    ? "register"
    : authPurpose === "guided"
      ? "guided"
      : "login";
  setLoginStatus("", "");

  const title = document.getElementById("loginTitle");
  const description = document.getElementById("authModeDescription");
  const button = document.getElementById("loginButton");
  const passwordInput = document.getElementById("passwordInput");
  const confirmGroup = document.getElementById("confirmPasswordGroup");
  const confirmInput = document.getElementById("confirmPasswordInput");
  const passwordResetButton = document.getElementById("passwordResetBtn");
  const modeNote = document.getElementById("authModeNote");
  const existingPathButton = document.getElementById(
    "existingAccountPathBtn"
  );
  const newPathButton = document.getElementById("newAccountPathBtn");

  if (existingPathButton) {
    existingPathButton.classList.toggle(
      "active",
      authPurpose === "login" || authPurpose === "verify_existing"
    );
  }
  if (newPathButton) {
    newPathButton.classList.toggle(
      "active",
      authPurpose === "register"
    );
  }

  [passwordInput, confirmInput].forEach(input => {
    if (input) input.type = "password";
  });

  document.querySelectorAll(".passwordToggle").forEach(toggle => {
    toggle.textContent = "הצג";
    toggle.setAttribute("aria-label", "הצגת הסיסמה");
  });

  if (authPurpose === "guided") {
    if (title) title.textContent = "כניסה או יצירת חשבון";
    if (description) {
      description.textContent = "המערכת תזהה אוטומטית אם מדובר בכניסה קיימת או ביצירת חשבון חדש.";
    }
    if (button) button.textContent = "המשך";
    if (passwordInput) passwordInput.autocomplete = "current-password";
    if (confirmGroup) confirmGroup.style.display = "none";
    if (confirmInput) confirmInput.value = "";
    if (passwordResetButton) passwordResetButton.style.display = "inline-block";
    if (modeNote) {
      modeNote.style.display = "block";
      modeNote.textContent =
        "בחרו תחילה אם זו כניסה לחשבון קיים או כניסה ראשונה.";
    }
    setLoginButtonDisabled(true);
    return;
  }

  if (authPurpose === "register") {
    if (title) title.textContent = "יצירת חשבון";
    if (description) description.textContent = "בחרו סיסמה חדשה. לאחר מכן יישלח מייל אימות חד־פעמי.";
    if (button) button.textContent = "יצירת חשבון";
    if (passwordInput) passwordInput.autocomplete = "new-password";
    if (confirmGroup) confirmGroup.style.display = "block";
    if (passwordResetButton) passwordResetButton.style.display = "none";
    if (modeNote) {
      modeNote.style.display = "block";
      modeNote.textContent =
        "לאחר יצירת החשבון יישלח מייל אימות חד־פעמי.";
    }
    setLoginButtonDisabled(false);
    return;
  }

  if (confirmGroup) confirmGroup.style.display = "none";
  if (confirmInput) confirmInput.value = "";
  if (passwordInput) passwordInput.autocomplete = "current-password";
  if (passwordResetButton) passwordResetButton.style.display = "inline-block";
  if (modeNote) modeNote.style.display = "none";

  if (authPurpose === "verify_existing") {
    if (title) title.textContent = "השלמת אימות החשבון";
    if (description) description.textContent = "הזינו את הסיסמה שבחרתם כדי לקבל או להשלים את אימות המייל.";
    if (button) button.textContent = "המשך לאימות";
  } else {
    if (title) title.textContent = "כניסה לחשבון";
    if (description) description.textContent = "הזינו את הסיסמה שלכם.";
    if (button) button.textContent = "כניסה לחשבון";
  }
  setLoginButtonDisabled(false);
}

function selectAuthPasswordPath_(mode) {
  const normalizedMode = mode === "register" ? "register" : "login";
  setAuthMode(normalizedMode);
  const passwordInput = document.getElementById("passwordInput");
  if (passwordInput) passwordInput.focus();
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

function setAuthRedirectPanelVisible_(visible) {
  const panel = document.getElementById("authRedirectPanel");
  if (panel) panel.classList.toggle("visible", Boolean(visible));
}

function setVerificationSuccessPanelVisible_(visible) {
  const panel = document.getElementById("verificationSuccessPanel");
  if (panel) panel.classList.toggle("visible", Boolean(visible));
}

function updateAuthProgress_(stage) {
  const progress = document.getElementById("authProgress");
  const label = document.getElementById("authProgressText");
  const labels = {
    email: "שלב 1 מתוך 3 — זיהוי באמצעות מייל",
    phone: "שלב 2 מתוך 3 — התאמה למספר הטלפון",
    password: "שלב 2 מתוך 3 — בחירת מסלול וסיסמה",
    verification: "שלב 3 מתוך 3 — אימות או אישור מנהל",
    verification_success: "האימות הושלם — אפשר להיכנס",
    password_recovery: "איפוס סיסמה — ממתינים לאישור מנהל",
    password_recovery_identity: "איפוס סיסמה — אימות מספר הטלפון",
    password_recovery_new: "איפוס סיסמה — יצירת סיסמה חדשה"
  };
  if (progress) {
    progress.style.display = stage ? "block" : "none";
  }
  if (label) label.textContent = labels[stage] || labels.email;
}

function setPasswordRecoveryPanelVisible_(visible) {
  const panel = document.getElementById("passwordRecoveryPanel");
  const form = document.getElementById("authForm");
  if (panel) panel.classList.toggle("visible", Boolean(visible));
  if (visible) {
    if (form) form.style.display = "none";
    const verificationPanel = document.getElementById("verificationPanel");
    if (verificationPanel) verificationPanel.classList.remove("visible");
    setAuthRedirectPanelVisible_(false);
    setVerificationSuccessPanelVisible_(false);
    updateAuthProgress_("password_recovery");
  }
}

function setVerificationPanelVisible_(visible) {
  const form = document.getElementById("authForm");
  const panel = document.getElementById("verificationPanel");
  if (form) form.style.display = visible ? "none" : "block";
  if (panel) panel.classList.toggle("visible", Boolean(visible));
  if (visible) {
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
  ["authEmailStep", "authPhoneStep", "authPasswordStep"].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.style.display = "none";
  });
}

function showAuthEmailStep_(options = {}) {
  authStage = "email";
  authPurpose = "login";
  authMode = "login";
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

  if (!options.preserveEmail && forceEmailEntry && input) input.value = "";
  if (input && !input.value) {
    input.value = getPendingAuthEmail_() || getSavedLoginEmail_() || "";
  }

  if (!options.keepStatus) setLoginStatus("", "");
  setTimeout(() => {
    if (input) input.focus();
  }, 0);
}

function showAuthPhoneStep_(email, purpose = "email_update") {
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

function showAuthPasswordStep_(email, mode = "login") {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    setLoginStatus("הכניסו כתובת מייל תקינה.", "error");
    return false;
  }

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
  if (emailInput) emailInput.value = normalized;
  if (selectedEmail) selectedEmail.textContent = normalized;
  if (form) form.style.display = "block";
  if (passwordStep) passwordStep.style.display = "block";
  setAuthMode(mode);
  updateAuthProgress_("password");
  setLoginStatus("", "");
  setTimeout(() => {
    const password = document.getElementById("passwordInput");
    if (password) password.focus();
  }, 0);
  return true;
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
  if (!payload || ["SYSTEM_ERROR", "WAIT"].includes(payload.route)) return;
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
        `לא קיבלתי מייל אימות — בקשת אישור ממנהל (${contact.name})`;
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
  if (button) button.disabled = true;
  setPasswordResetHelpStatus_("שולח בקשת עזרה למנהל...", false);

  try {
    const result = await requestPasswordResetAssistance_(email);
    const managerName = String(result.managerName || "").trim();
    if (!result.requestId || !result.recoveryToken) {
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
    if (button) button.disabled = false;
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

  setStepButtonBusy_("emailContinueBtn", true, "בודק...", "המשך");
  setLoginStatus("בודק את מסלול הכניסה המתאים...", "loading");

  try {
    const result = await requestPublicAuthRoute_("email", email, options);
    const route = String(result.route || "SYSTEM_ERROR");
    authRouteIsAdmin = result.admin === true;

    if (route === "PASSWORD") {
      rememberPendingAuthEmail_(email);
      showAuthPasswordStep_(email, "guided");
      return;
    }

    if (route === "PASSWORD_RESET_READY") {
      rememberPendingAuthEmail_(email);
      showAuthPhoneStep_(email, "password_reset");
      setLoginStatus(
        "המנהל אישר איפוס סיסמה עד 23:59. לאחר התאמת מספר הטלפון תוכלו ליצור סיסמה חדשה.",
        "success"
      );
      return;
    }

    if (route === "ASK_PHONE") {
      authRouteIsAdmin = false;
      showAuthPhoneStep_(email);
      return;
    }

    if (route === "BLOCKED") {
      setLoginStatus("הגישה לכתובת המייל הזו אינה פעילה. יש לפנות למנהל ספר אנשי הקשר.", "error");
      return;
    }

    setLoginStatus("לא הצלחנו לבדוק את פרטי הכניסה כרגע. נסו שוב בעוד רגע.", "error");
  } catch (error) {
    console.error("Auth route lookup failed", error);
    setLoginStatus("בדיקת פרטי הכניסה נכשלה זמנית. בדקו את החיבור ונסו שוב.", "error");
  } finally {
    setStepButtonBusy_("emailContinueBtn", false, "בודק...", "המשך");
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
  setStepButtonBusy_(
    "phoneContinueBtn",
    true,
    "בודק...",
    isManagerPasswordReset
      ? "המשך ליצירת סיסמה חדשה"
      : "המשך"
  );
  setLoginStatus(
    isManagerPasswordReset
      ? "מאמת את מספר הטלפון ופותח יצירת סיסמה חדשה..."
      : "מחפש את מספר הטלפון בספר אנשי הקשר...",
    "loading"
  );

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

    const result = await requestPublicAuthRoute_("phone", phone, { forceFresh: true });
    const route = String(result.route || "SYSTEM_ERROR");

    if (route === "UPDATE_EMAIL") {
      const params = new URLSearchParams({
        phone: formatPhoneForDisplay(phone),
        email: lastUnknownEmail,
        from: "login"
      });
      const href = `email-update.html?${params.toString()}`;
      showAuthRedirectPanel_(
        "מספר הטלפון נמצא",
        "מעביר אתכם לעדכון כתובת המייל. לאחר העדכון תחזרו ישירות למסלול הכניסה המתאים.",
        href,
        "מעבר לעדכון המייל",
        true
      );
      return;
    }

    if (route === "OPEN_FORM") {
      showAuthRedirectPanel_(
        "מספר הטלפון אינו מופיע במערכת",
        "מעביר אתכם לטופס ההצטרפות לספר אנשי הקשר.",
        REGISTRATION_FORM_URL,
        "מעבר לטופס ההצטרפות",
        true
      );
      return;
    }

    setLoginStatus("לא הצלחנו לבדוק את מספר הטלפון כרגע. נסו שוב בעוד רגע.", "error");
  } catch (error) {
    console.error("Phone route lookup failed", error);
    setLoginStatus(
      error && error.message
        ? error.message
        : "בדיקת מספר הטלפון נכשלה זמנית. בדקו את החיבור ונסו שוב.",
      "error"
    );
  } finally {
    setStepButtonBusy_(
      "phoneContinueBtn",
      false,
      "בודק...",
      isManagerPasswordReset
        ? "המשך ליצירת סיסמה חדשה"
        : "המשך"
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
            : `לא קיבלתי מייל אימות — בקשת אישור ממנהל${managerSuffix}`;
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
  const permission = await getCurrentUserPermission(normalizedEmail);

  if (
    permission.exists &&
    permission.active &&
    await permissionHasActivePhonePair_(permission, normalizedEmail)
  ) {
    return { allowed: true, isAdmin: false, permission };
  }

  try {
    const route = await requestPublicAuthRoute_(
      "email",
      normalizedEmail,
      { forceFresh: true }
    );
    if (route && route.admin === true) {
      authRouteIsAdmin = true;
      return { allowed: true, isAdmin: true, permission };
    }
  } catch (error) {
    console.warn("Admin route verification failed", error);
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

  try {
    await applySelectedAuthPersistence();
  } catch (error) {
    console.error("Could not update authentication persistence", error);
    setLoginStatus("לא הצלחנו לשמור את ההתחברות במכשיר. נסו שוב.", "error");
    return;
  }

  if (authMode === "register") {
    await registerWithPassword();
  } else if (authMode === "guided") {
    await loginOrCreateWithPassword();
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

  setLoginButtonDisabled(true);
  setLoginStatus("בודק הרשאה ויוצר חשבון...", "loading");
  authActionInProgress = true;

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

      setLoginStatus(
        "לא נמצאה התאמה פעילה בין המייל למספר הטלפון. חזרו לשלב המייל כדי להמשיך במסלול המתאים.",
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
    document.getElementById("passwordInput").value = "";
    document.getElementById("confirmPasswordInput").value = "";
    showVerificationPanel_(createdUser, email);
  } catch (error) {
    console.error("Registration failed", error);

    if (createdUser && !verificationSent) {
      await deleteNewAuthUserSafely(createdUser);
    }

    const code = error && error.code ? error.code : "";
    if (code === "auth/email-already-in-use") {
      const input = document.getElementById("emailInput");
      if (input) input.value = email;
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
    setLoginButtonDisabled(false);
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

  setLoginButtonDisabled(true);
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
      setLoginStatus(
        "כתובת המייל או הסיסמה אינן נכונות. בדקו את הסיסמה או השתמשו ב„שכחתי סיסמה”.",
        "error"
      );
    } else {
      setLoginStatus(getAuthErrorMessage(error), "error");
    }
  } finally {
    authActionInProgress = false;
    setLoginButtonDisabled(false);
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

  setLoginButtonDisabled(true);
  setLoginStatus("שולח קישור לקביעת סיסמה...", "loading");

  try {
    auth.languageCode = "he";

    await firebaseApi.sendPasswordResetEmail(auth, email, {
      url: PASSWORD_AUTH_RETURN_URL
    });

    startAuthEmailCooldown("password-reset", email);

    setLoginStatus(
      "אם קיים חשבון עבור כתובת המייל הזו, נשלח אליו עכשיו קישור לאיפוס הסיסמה. המייל עם הקישור הוא אישור שהאיפוס זמין; לאחר בחירת סיסמה חדשה חוזרים לאפליקציה ונכנסים. חשוב לבדוק גם בספאם ובדואר זבל.",
      "success"
    );
  } catch (error) {
    console.error("Password reset failed", error);
    setLoginStatus(getAuthErrorMessage(error), "error");
  } finally {
    setLoginButtonDisabled(false);
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

function showAppForUser(user) {
  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("adminPanel").style.display = "none";
  updateUserInfoForUser_(user);
  setLoginStatus("", "");
  show([]);
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
      const adminButton = document.getElementById("adminOpenBtn");
      if (adminButton) adminButton.classList.remove("visible");
    }

    if (
      !isAdmin &&
      permission &&
      permission.active &&
      permission.accessReviewRequired &&
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
      }
    }

    const hasTemporaryAccess = permissionHasTemporaryAccess_(permission);
    if (
      !user.emailVerified &&
      !isAdmin &&
      !(
        permission &&
        permission.active &&
        (
          permission.manualApproved ||
          hasTemporaryAccess
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
            hasTemporaryAccess
          )
          ||
          (
            permission.accessReviewRequired !== true &&
            (user.emailVerified || permission.manualApproved)
          )
        )
      )
    );

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
    rememberSuccessfulEmail_(user.email);
    setVerificationPanelVisible_(false);

    // עדכון סטטוס ההתחברות הוא כתיבה קטנה שאינה מעכבת את פתיחת האפליקציה.
    recordOwnAuthState_(
      user.emailVerified
        ? "verified"
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
    const adminButton = document.getElementById("adminOpenBtn");
    if (adminButton) adminButton.classList.remove("visible");
    document.getElementById("adminPanel").style.display = "none";
    closeRecentContactsModal();
    selectedContactIds.clear();
    currentDisplayedContacts = [];
    selectionMode = false;
    activeQuickFilter = "";
    updateQuickFilterButtons();
    document.getElementById("list").innerHTML = "";
    showLoginScreen();
    showAuthEmailStep_({ keepStatus: true });
    setLoginStatus("התנתקת מהמערכת.", "empty");
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

  const adminButton = document.getElementById("adminOpenBtn");
  if (adminButton) adminButton.classList.remove("visible");

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

    if (adminButton) {
      adminButton.classList.toggle("visible", currentUserIsAdmin);
    }

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

        const adminButton = document.getElementById("adminOpenBtn");
        if (adminButton) {
          adminButton.classList.toggle("visible", currentUserIsAdmin);
        }

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
      const hasEmailAccess = Boolean(
        data &&
        data.active === true &&
        (
          (
            data.accessReviewRequired === true &&
            temporaryAccess
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
        temporaryAccessUntil: data.temporaryAccessUntil || null
      };
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
  adminActiveTab = "general";
  adminActiveFilter = "all";
  resetAdminVisibleItems_();
  updateAdminTabs();
  loadAdminData({ section: "general", force: false });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function closeAdminPanel() {
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("app").style.display = "block";
  closeAdminEditModal();
  closeManagerModal();
  renderCurrentSearchResults();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function setAdminTab(tabName) {
  const requestedTab = ["general", "contacts", "users", "activity", "reports", "managers"].includes(tabName)
    ? tabName
    : "general";

  if (requestedTab === "managers" && !currentUserIsSuperAdmin) {
    alert("רק מנהל־על יכול לנהל מנהלים.");
    return;
  }

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
  const usersLoaded = adminLoadedSections.has("users");
  const reportsLoaded = adminLoadedSections.has("reports");
  const verificationRequests = usersLoaded
    ? adminVerificationRequests.filter(request =>
        ["pending", "temporary_active"].includes(request.status)
      ).length
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
  const users = verificationRequests + passwordResetRequests;
  const reports = contactRequests + contactReports;

  return {
    verificationRequests,
    passwordResetRequests,
    contactRequests,
    contactReports,
    users,
    reports,
    total: users + reports,
    loaded:
      adminPendingSummary.loaded ||
      usersLoaded ||
      reportsLoaded
  };
}

function updateAdminPendingBadges_() {
  const counts = getAdminPendingCounts_();
  [
    ["adminUsersPendingBadge", counts.users],
    ["adminReportsPendingBadge", counts.reports]
  ].forEach(([elementId, count]) => {
    const badge = document.getElementById(elementId);
    if (!badge) return;
    badge.hidden = count < 1;
    badge.textContent = count > 99 ? "99+" : String(count);
  });

  const mainBadge = document.getElementById("adminOpenPendingBadge");
  if (mainBadge) {
    mainBadge.hidden = !counts.loaded || counts.total < 1;
    mainBadge.textContent = counts.total > 99
      ? "99+ לטיפול"
      : `${counts.total} לטיפול`;
  }
}

function updateAdminTabs() {
  const generalTab = document.getElementById("adminGeneralTab");
  const contactsTab = document.getElementById("adminContactsTab");
  const usersTab = document.getElementById("adminUsersTab");
  const activityTab = document.getElementById("adminActivityTab");
  const reportsTab = document.getElementById("adminReportsTab");
  const managersTab = document.getElementById("adminManagersTab");
  const adminToolbar = document.getElementById("adminToolbar");
  const contactFilters = document.getElementById("adminContactFilters");
  const userFilters = document.getElementById("adminUserFilters");
  const activityFilters = document.getElementById("adminActivityFilters");
  const reportFilters = document.getElementById("adminReportFilters");
  const managerFilters = document.getElementById("adminManagerFilters");
  const addManagerButton = document.getElementById("adminAddManagerBtn");

  if (adminActiveTab === "managers" && !currentUserIsSuperAdmin) {
    adminActiveTab = "general";
  }

  [
    [generalTab, "general"],
    [contactsTab, "contacts"],
    [usersTab, "users"],
    [reportsTab, "reports"],
    [activityTab, "activity"],
    [managersTab, "managers"]
  ].forEach(([button, tabName]) => {
    if (!button) return;
    const isActive = adminActiveTab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  if (managersTab) {
    managersTab.classList.toggle("visible", currentUserIsSuperAdmin);

    const tabsContainer = managersTab.closest(".adminTabs");
    if (tabsContainer) {
      tabsContainer.classList.toggle("hasManagers", currentUserIsSuperAdmin);
    }
  }

  if (adminToolbar) {
    adminToolbar.style.display = adminActiveTab === "general" ? "none" : "block";
  }

  if (contactFilters) contactFilters.style.display = adminActiveTab === "contacts" ? "flex" : "none";
  if (userFilters) userFilters.style.display = adminActiveTab === "users" ? "flex" : "none";
  if (activityFilters) activityFilters.style.display = adminActiveTab === "activity" ? "flex" : "none";
  if (reportFilters) reportFilters.style.display = adminActiveTab === "reports" ? "flex" : "none";
  if (managerFilters) managerFilters.style.display = adminActiveTab === "managers" ? "flex" : "none";

  const searchInput = document.getElementById("adminSearchInput");
  if (searchInput) {
    const placeholders = {
      contacts: "חיפוש איש קשר לפי שם, מייל או טלפון",
      users: "חיפוש הרשאה לפי שם, מייל או טלפון",
      reports: "חיפוש בקשה או דיווח",
      activity: "חיפוש בפעילות האחרונה",
      managers: "חיפוש מנהל"
    };
    searchInput.placeholder = placeholders[adminActiveTab] || "חיפוש";
  }

  if (addManagerButton) {
    addManagerButton.classList.toggle(
      "visible",
      currentUserIsSuperAdmin && adminActiveTab === "managers"
    );
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
  if (adminActiveTab === "general") return;

  const containerId = adminActiveTab === "contacts"
    ? "adminContactFilters"
    : adminActiveTab === "users"
      ? "adminUserFilters"
      : adminActiveTab === "activity"
        ? "adminActivityFilters"
        : adminActiveTab === "reports"
          ? "adminReportFilters"
          : "adminManagerFilters";

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
  adminUsageHistoryLoaded = false;
  adminUsageHistoryLoading = false;
  adminDataLoading = false;
  adminRemovedContacts = [];
  adminAllowedUsers = [];
  adminAllowedPhones = [];
  adminManagers = [];
  adminActivity = [];
  adminUsageDaily = [];
  adminDailyActiveUsers = [];
  adminDailyContactUsers = [];
  adminPasswordResetRequests = [];
  adminReports = [];
  adminContactAddRequests = [];
  adminVerificationRequests = [];
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
    general: "טוען את נתוני היום...",
    contacts: "טוען את רשימת אנשי הקשר...",
    users: "טוען הרשאות כניסה...",
    activity: "טוען פעילות אחרונה...",
    reports: "טוען בקשות ודיווחים...",
    managers: "טוען מנהלים..."
  };
  const summary = document.getElementById("adminSummary");
  if (summary) summary.textContent = "";
  document.getElementById("adminList").innerHTML =
    `<div class="adminLoadingCard">${escapeHtml(labels[section] || "טוען נתונים...")}</div>`;
}

async function loadAdminGeneralData_() {
  const todayKey = getIsraelDateKey_();
  adminUsageHistoryLoaded = false;
  const [activeUsers, contactUsers] = await Promise.all([
    loadDailyActiveUserCounts_([todayKey]),
    loadDailyContactUserCounts_([todayKey]),
    loadAdminPendingSummary_({ force: true })
  ]);

  adminDailyActiveUsers = activeUsers;
  adminDailyContactUsers = contactUsers;
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
    firebaseApi.limit(10)
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
      source: ["device_picker", "self_profile", "google_form"].includes(data.source)
        ? data.source
        : "manual",
      requestType: data.requestType === "self_update"
        ? "self_update"
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

function getAdminSectionLoader_(section) {
  return {
    general: loadAdminGeneralData_,
    contacts: loadAdminContactsData_,
    users: loadAdminUsersData_,
    activity: loadAdminActivityData_,
    reports: loadAdminReportsData_,
    managers: loadAdminManagersData_
  }[section] || loadAdminGeneralData_;
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
    adminUsageHistoryLoaded = false;
    force = true;
  }

  if (force) {
    adminLoadedSections.delete(section);
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

async function loadAdminUsageHistory_() {
  if (
    adminUsageHistoryLoaded ||
    adminUsageHistoryLoading ||
    !currentUserIsAdmin
  ) {
    return;
  }

  adminUsageHistoryLoading = true;
  renderAdminGeneral();

  try {
    const dateKeys = getRecentIsraelDateKeys_(14);
    const [activeUsers, contactUsers] = await Promise.all([
      loadDailyActiveUserCounts_(dateKeys),
      loadDailyContactUserCounts_(dateKeys)
    ]);
    adminDailyActiveUsers = activeUsers;
    adminDailyContactUsers = contactUsers;
    adminUsageHistoryLoaded = true;
  } catch (error) {
    console.error("Admin usage history load failed", error);
    setAdminStatus("טעינת היסטוריית השימוש נכשלה.", "error");
  } finally {
    adminUsageHistoryLoading = false;
    if (adminActiveTab === "general") {
      renderAdminGeneral();
    }
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
  const additionKeys = new Set(actualActivities.filter(item => ["contact_add_form", "form_submission", "contact_add_detected"].includes(item.action)).map(getActivityTargetKey).filter(key => key !== "|"));
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
  if (["contact_add_form", "form_submission", "contact_add_detected", "contact_add_request_approved", "form_access_request_approved", "access_auto_granted", "manager_add"].includes(action)) {
    return "added";
  }

  if (["contact_remove", "manager_remove", "permission_delete"].includes(action)) {
    return "removed";
  }

  return "changed";
}

function getActivityTitle(activity) {
  const labels = {
    contact_add_form: "נשלח טופס הצטרפות חדש",
    form_submission: "נשלח טופס הצטרפות",
    contact_add_detected: "איש קשר נוסף למערכת",
    contact_add_request_approved: "בקשת הוספת איש קשר אושרה",
    form_access_request_approved: "בקשת הצטרפות וגישה אושרה",
    form_access_pending_admin: "בקשת הצטרפות ממתינה למנהל",
    contact_add_request_rejected: "בקשת הוספת איש קשר נדחתה",
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
    access_auto_granted: "גישה אושרה אוטומטית",
    manual_approval_grant: "גישה אושרה ידנית",
    manual_approval_reject: "בקשת אישור נדחתה",
    manual_approval_revoke: "אישור ידני בוטל"
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
    renderAdminReports();
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
  const choose = (nextValue, currentValue) => {
    const normalized = String(nextValue || "").trim();
    return normalized || String(currentValue || "").trim();
  };
  const editableValue = (nextValue, currentValue) =>
    isSelfUpdate
      ? String(nextValue || "").trim()
      : choose(nextValue, currentValue);

  return {
    ...base,
    first_name_he: choose(values.firstName, base.first_name_he),
    last_name_he: choose(values.lastName, base.last_name_he),
    title_prefix: editableValue(values.titlePrefix, base.title_prefix),
    role: editableValue(values.role, base.role),
    department: editableValue(values.department, base.department),
    // במסמך קיים לא משנים את מספר הטלפון, משום שהוא משמש כמזהה הרשומה.
    phone: existingContact ? normalizePhone(base.phone) : normalizePhone(values.phone),
    email: normalizeEmail(
      request && request.requestType === "self_update" && existingContact
        ? base.email
        : values.email || base.email
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
  const grantsFormAccess = request.grantAccessOnApproval === true;
  const existingMessage = existingContact
    ? isSelfUpdate
      ? `לאשר את עדכון הפרטים של ${existingContact.name || formatPhoneForDisplay(existingContact.phone)}? מספר הטלפון והמייל לא ישתנו.`
      : grantsFormAccess
        ? `נמצא איש קשר קיים בשם ${existingContact.name || formatPhoneForDisplay(existingContact.phone)}. האישור יעדכן את הפרטים ויאשר במפורש גישה למייל ${values.email}. להמשיך?`
        : `נמצא איש קשר קיים בשם ${existingContact.name || formatPhoneForDisplay(existingContact.phone)}. האישור יעדכן רק את הפרטים שמולאו בבקשה; מספר הטלפון של הרשומה הקיימת לא ישתנה. להמשיך?`
    : grantsFormAccess
      ? `לאשר את הוספת ${getContactAddRequestName_({ ...request, ...values }) || formatPhoneForDisplay(values.phone)} וגם להעניק גישה למייל ${values.email}?`
      : `לאשר ולהוסיף את ${getContactAddRequestName_({ ...request, ...values }) || formatPhoneForDisplay(values.phone)} לרשימה?`;

  if (!confirm(existingMessage)) return;

  const payload = buildApprovedContactPayload_(request, values, existingContact);
  const docId = existingContact && existingContact.docId
    ? existingContact.docId
    : normalizePhone(payload.phone).replace(/\D/g, "") || `request_${requestId}`;

  setAdminStatus(isSelfUpdate ? "מאשר את עדכון הפרטים..." : "מאשר ומוסיף את איש הקשר...", "loading");

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
        grantsFormAccess
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
  if (!confirm(
    request.requestType === "self_update"
      ? "לדחות את בקשת עדכון הפרטים?"
      : "לדחות את בקשת הוספת איש הקשר?"
  )) return;

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
      const grantsFormAccess = request.grantAccessOnApproval === true;
      const requestLabel = isSelfUpdate
        ? "בקשת עדכון פרטים אישיים"
        : grantsFormAccess
          ? "בקשת הצטרפות ואישור גישה"
        : "בקשת הוספת איש קשר";
      const sourceLabel = request.source === "device_picker"
        ? "ספר הטלפונים במכשיר"
        : request.source === "self_profile"
          ? "כפתור „אני” באפליקציה"
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
                  <button type="button" class="adminActionBtn primary" onclick="approveContactAddRequest_('${escapeJsString(request.docId)}')">${isSelfUpdate ? "אישור ועדכון" : grantsFormAccess ? "אישור איש קשר וגישה" : "אישור והוספה"}</button>
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

function renderAdminGeneral() {
  const pendingCounts = getAdminPendingCounts_();
  const pendingDetails = [
    pendingCounts.verificationRequests
      ? `${pendingCounts.verificationRequests} בקשות אישור כניסה`
      : "",
    pendingCounts.passwordResetRequests
      ? `${pendingCounts.passwordResetRequests} בקשות איפוס סיסמה`
      : "",
    pendingCounts.contactRequests
      ? `${pendingCounts.contactRequests} בקשות איש קשר`
      : "",
    pendingCounts.contactReports
      ? `${pendingCounts.contactReports} דיווחים פתוחים`
      : ""
  ].filter(Boolean);
  const todayKey = getIsraelDateKey_();
  const activeUsersByDate = new Map(
    adminDailyActiveUsers.map(item => [item.date, item.activeUserCount])
  );
  const contactUsersByDate = new Map(
    adminDailyContactUsers.map(item => [item.date, item.contactUserCount])
  );

  const todayActiveUsers = activeUsersByDate.get(todayKey) || 0;
  const todayContactUsers = contactUsersByDate.get(todayKey) || 0;
  const engagementPercent = todayActiveUsers > 0
    ? Math.round((todayContactUsers / todayActiveUsers) * 100)
    : 0;

  const historyHtml = adminUsageHistoryLoaded
    ? `
      <div class="adminUsageRow header">
        <div>תאריך</div>
        <div class="adminUsageNumber">פעילים</div>
        <div class="adminUsageNumber">השתמשו בפרטי קשר</div>
      </div>
      ${getRecentIsraelDateKeys_(14).map(date => `
        <div class="adminUsageRow">
          <div class="adminUsageDate">${escapeHtml(formatUsageDate_(date))}</div>
          <div class="adminUsageNumber">${escapeHtml(String(activeUsersByDate.get(date) || 0))}</div>
          <div class="adminUsageNumber">${escapeHtml(String(contactUsersByDate.get(date) || 0))}</div>
        </div>
      `).join("")}
      <p class="adminUsageNote">
        משתמש נספר פעם אחת ביום לאחר פעולה שימושית על איש קשר. מילות חיפוש וזהות איש הקשר אינן נשמרות.
      </p>
    `
    : `
      <div class="adminUsagePlaceholder">
        ההיסטוריה אינה נטענת אוטומטית, כדי לשמור על מסך מהיר ועל מספר קריאות נמוך.
        <br>
        <button type="button" class="adminInlineBtn" onclick="loadAdminUsageHistory_()" ${adminUsageHistoryLoading ? "disabled" : ""}>
          ${adminUsageHistoryLoading ? "טוען היסטוריה..." : "הצגת 14 הימים האחרונים"}
        </button>
      </div>
    `;

  document.getElementById("adminList").innerHTML = `
    <div class="adminOverview">
      <section class="adminAttentionBanner ${pendingCounts.total ? "hasItems" : "clear"}" aria-live="polite">
        <span class="adminAttentionIcon" aria-hidden="true">${pendingCounts.total ? "🔔" : "✓"}</span>
        <div class="adminAttentionContent">
          <strong class="adminAttentionTitle">
            ${pendingCounts.total
              ? `יש ${escapeHtml(String(pendingCounts.total))} פריטים שממתינים לטיפול`
              : pendingCounts.loaded
                ? "אין כרגע בקשות שממתינות לטיפול"
                : "בודק אם יש בקשות שממתינות לטיפול"}
          </strong>
          <span class="adminAttentionText">
            ${pendingDetails.length
              ? escapeHtml(pendingDetails.join(" · "))
              : pendingCounts.loaded
                ? "כל הבקשות והדיווחים הקיימים טופלו."
                : "הנתונים יופיעו כאן מיד לאחר הבדיקה."}
          </span>
          ${pendingCounts.total ? `
            <div class="adminAttentionActions">
              ${pendingCounts.users
                ? `<button type="button" onclick="setAdminTab('users')">הרשאות ואיפוס (${escapeHtml(String(pendingCounts.users))})</button>`
                : ""}
              ${pendingCounts.reports
                ? `<button type="button" onclick="setAdminTab('reports')">בקשות ודיווחים (${escapeHtml(String(pendingCounts.reports))})</button>`
                : ""}
            </div>` : ""}
        </div>
      </section>

      <div class="adminQuickGrid">
        <button type="button" class="adminQuickAction" onclick="setAdminTab('contacts')">
          <span class="adminQuickIcon" aria-hidden="true">👤</span>
          <span class="adminQuickTitle">אנשי קשר</span>
          <span class="adminQuickNote">חיפוש, עריכה והסרה מהספר</span>
        </button>
        <button type="button" class="adminQuickAction" onclick="setAdminTab('users')">
          <span class="adminQuickIcon" aria-hidden="true">🔑</span>
          <span class="adminQuickTitle">הרשאות כניסה</span>
          <span class="adminQuickNote">אימות, חסימה ובקשות סיסמה</span>
          ${pendingCounts.users ? `<span class="adminQuickBadge">${escapeHtml(String(pendingCounts.users))} לטיפול</span>` : ""}
        </button>
        <button type="button" class="adminQuickAction" onclick="setAdminTab('reports')">
          <span class="adminQuickIcon" aria-hidden="true">📥</span>
          <span class="adminQuickTitle">בקשות ודיווחים</span>
          <span class="adminQuickNote">פריטים שממתינים לטיפול מנהל</span>
          ${pendingCounts.reports ? `<span class="adminQuickBadge">${escapeHtml(String(pendingCounts.reports))} לטיפול</span>` : ""}
        </button>
        <button type="button" class="adminQuickAction" onclick="setAdminTab('activity')">
          <span class="adminQuickIcon" aria-hidden="true">🕘</span>
          <span class="adminQuickTitle">פעילות אחרונה</span>
          <span class="adminQuickNote">שינויים שבוצעו במערכת</span>
        </button>
      </div>

      <div class="adminOverviewCards">
        <div class="adminMetricCard">
          <span class="adminMetricValue">${escapeHtml(String(todayActiveUsers))}</span>
          <span class="adminMetricLabel">משתמשים פעילים היום</span>
        </div>
        <div class="adminMetricCard">
          <span class="adminMetricValue">${escapeHtml(String(todayContactUsers))}</span>
          <span class="adminMetricLabel">אנשים שהשתמשו בפרטי איש קשר</span>
        </div>
        <div class="adminMetricCard">
          <span class="adminMetricValue">${escapeHtml(String(engagementPercent))}%</span>
          <span class="adminMetricLabel">מהפעילים השתמשו באיש קשר</span>
        </div>
      </div>

      <div class="adminUsagePanel">
        <h3 class="adminUsageTitle">נתוני שימוש</h3>
        ${historyHtml}
      </div>
    </div>
  `;
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
      button.textContent = "↻ רענון נתוני העמוד";
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

  if (adminActiveTab === "general") {
    renderAdminGeneral();
  } else if (adminActiveTab === "users") {
    renderAdminUsers();
  } else if (adminActiveTab === "activity") {
    renderAdminActivity();
  } else if (adminActiveTab === "reports") {
    renderAdminReports();
  } else if (adminActiveTab === "managers") {
    renderAdminManagers();
  } else {
    renderAdminContacts();
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

  setAdminTab("users");
  const searchInput = document.getElementById("adminSearchInput");
  if (searchInput) {
    searchInput.value = normalizedEmail;
  }
  resetAdminVisibleItems_();
  if (adminLoadedSections.has("users")) {
    renderAdminList();
  }
}

function getVerificationRequestByEmail_(email) {
  const normalized = normalizeEmail(email);
  return adminVerificationRequests.find(
    request => normalizeEmail(request.email) === normalized
  ) || null;
}

function getUserAccessState_(user) {
  const request = getVerificationRequestByEmail_(user && user.email);
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

async function approveManualAccess_(email, temporary = false) {
  if (!currentUserIsAdmin) {
    alert("רק מנהל פעיל יכול לאשר גישה.");
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const user = getAllowedUserByEmail(normalizedEmail);
  const contact = findContactByEmail(normalizedEmail);
  const request = getVerificationRequestByEmail_(normalizedEmail);
  if (
    !user ||
    !user.active ||
    !request ||
    !["pending", "temporary_active"].includes(request.status)
  ) {
    alert("לא נמצאה בקשת אישור פעילה עבור המשתמש.");
    return;
  }

  if (!user.phonePermissionActive) {
    alert(
      "לא ניתן לאשר גישה לפני שקיים קישור פעיל בין המייל למספר הטלפון."
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
    title: temporary ? "אישור גישה עד 23:59" : "אישור גישה קבועה",
    intro: temporary
      ? "האישור יאפשר כניסה עד 23:59 היום. יש לוודא תחילה את זהות המשתמש."
      : "האישור יאפשר כניסה גם ללא אימות מייל. יש לוודא תחילה את זהות המשתמש.",
    identity
  });

  if (reason === null) return;
  const cleanReason = String(reason || "").trim();
  if (cleanReason.length < 3) {
    alert("יש לרשום סיבה קצרה או אופן זיהוי לפני האישור.");
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
            updatedAt: now
          },
      { merge: true }
    );
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
    batch.set(firebaseApi.doc(firebaseApi.collection(db, "admin_actions")), {
      action: temporary
        ? "temporary_access_manager_grant"
        : "manual_approval_grant",
      targetEmail: normalizedEmail,
      displayName: contact && contact.name ? contact.name : "",
      adminEmail: currentAdminEmail,
      reason: cleanReason.slice(0, 300),
      timestamp: now
    });
    await batch.commit();
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
  if (!confirm(`לדחות את בקשת האישור של ${normalizedEmail}?`)) return;

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
        updatedAt: now
      },
      { merge: true }
    );
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
    batch.set(firebaseApi.doc(firebaseApi.collection(db, "admin_actions")), {
      action: "manual_approval_reject",
      targetEmail: normalizedEmail,
      adminEmail: currentAdminEmail,
      timestamp: now
    });
    await batch.commit();
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
  if (!confirm(`לבטל את האישור הידני של ${normalizedEmail}?\nאם המייל לא אומת, המשתמש ינותק ויידרש להשלים אימות.`)) return;

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
    alert("יש לרשום דרך זיהוי קצרה לפני האישור.");
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

  if (!confirm(`לבטל את אישור איפוס הסיסמה של ${normalizedEmail}?`)) {
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
    alert("יש לרשום דרך זיהוי קצרה לפני האישור.");
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
    const request = getVerificationRequestByEmail_(user.email);
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
                       <button type="button" class="adminActionBtn danger" onclick="deleteUserPermission('${escapeJsString(user.email)}')">מחיקת הרשאה</button>
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
    alert("רק מנהל־על יכול להוסיף מנהלים.");
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
    alert("לא ניתן להסיר את מנהל־העל.");
    return;
  }

  if (!confirm(`להסיר את הרשאת הניהול של ${normalizedEmail}?\nהרשאת הכניסה הרגילה לאפליקציה תישאר ללא שינוי.`)) return;

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
    alert("לא הצלחנו להסיר את הרשאת המנהל.");
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

  if (!confirm(`להסיר את ${contact.name || formatPhoneForDisplay(contact.phone)} מהאפליקציה? ניתן יהיה להחזיר את הרשומה בהמשך.`)) {
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

  if (!confirm(`להחזיר את ${contact.name || formatPhoneForDisplay(contact.phone)} לאפליקציה?`)) {
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
    alert("לא ניתן לחסום את חשבון המנהל הנוכחי.");
    return;
  }

  const actionLabel = shouldActivate ? "להחזיר גישה" : "לחסום גישה";
  if (!confirm(`${actionLabel} עבור ${normalizedEmail}?`)) return;

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
    alert("לא ניתן למחוק את הרשאת המנהל הנוכחי.");
    return;
  }

  if (!confirm(`למחוק את הרשאת הכניסה של ${normalizedEmail} ואת הקישור למספר הטלפון שלו? חסימה עדיפה בדרך כלל, משום שמילוי טופס חדש עשוי ליצור הרשאה מחדש.`)) {
    return;
  }

  setAdminStatus("מוחק הרשאה...", "loading");

  try {
    const userPermission = getAllowedUserByEmail(normalizedEmail);
    const phonePermission = userPermission && userPermission.phoneKey
      ? adminAllowedPhones.find(item =>
          item.phoneKey === userPermission.phoneKey &&
          item.email === normalizedEmail
        ) || null
      : null;
    const verificationRequest = getVerificationRequestByEmail_(
      normalizedEmail
    );
    const batch = firebaseApi.writeBatch(db);
    const now = firebaseApi.serverTimestamp();

    batch.delete(
      firebaseApi.doc(
        db,
        "allowedUsers",
        userPermission && userPermission.docId
          ? userPermission.docId
          : normalizedEmail
      )
    );

    if (phonePermission) {
      batch.delete(
        firebaseApi.doc(
          db,
          ALLOWED_PHONES_COLLECTION_NAME,
          phonePermission.docId
        )
      );
    }

    if (
      verificationRequest &&
      ["pending", "temporary_active", "approved"].includes(
        verificationRequest.status
      )
    ) {
      batch.update(
        firebaseApi.doc(
          db,
          "verificationRequests",
          verificationRequest.docId
        ),
        {
          status: verificationRequest.status === "pending"
            ? "rejected"
            : "revoked",
          temporaryAccessUntil: null,
          handledAt: now,
          handledBy: currentAdminEmail,
          updatedAt: now
        }
      );
    }

    batch.set(firebaseApi.doc(firebaseApi.collection(db, "admin_actions")), {
      action: "permission_delete",
      targetEmail: normalizedEmail,
      targetPhone: userPermission && userPermission.phone
        ? userPermission.phone
        : "",
      adminEmail: currentAdminEmail,
      timestamp: now
    });

    await batch.commit();
    await loadAdminData();
    setAdminStatus("הרשאת המייל נמחקה. קישור טלפון תואם נמחק אם היה קיים.", "success");
  } catch (error) {
    console.error("Permission deletion failed", error);
    setAdminStatus("מחיקת ההרשאה נכשלה.", "error");
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

function updateSearchUI() {
  const input = document.getElementById("searchInput");
  const q = input ? input.value.trim() : "";
  const clearButton = document.getElementById("clearSearchBtn");
  if (clearButton) clearButton.classList.toggle("visible", Boolean(q));
  updateQuickFilterButtons();
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
  return isSearchActive() || isQuickFilterActive();
}

function updateResultsSummary(list) {
  const summary = document.getElementById("resultsSummary");
  if (!summary) return;
  if (!shouldShowNoResults()) {
    summary.textContent = "";
    return;
  }
  const count = Array.isArray(list) ? list.length : 0;
  summary.textContent = count === 1 ? "נמצא איש קשר אחד" : `נמצאו ${count} אנשי קשר`;
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
  });

  document.querySelectorAll(".contactSelect").forEach(label => {
    const id = Number(label.dataset.id);
    label.classList.toggle("selected", selectionMode && selectedContactIds.has(id));
  });

  document.querySelectorAll(".contactSelect input[type='checkbox']").forEach(checkbox => {
    const id = Number(checkbox.dataset.id);
    checkbox.checked = selectedContactIds.has(id);
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

function openContactAddModal_() {
  contactAddModalMode = "user";
  activeContactAddRequestId = "";
  resetContactAddForm_();
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
  document.getElementById("contactAddModalTitle").textContent =
    isSelfUpdate ? "בדיקת עדכון הפרטים האישיים" : "עריכת בקשה לפני אישור";
  document.getElementById("contactAddIntro").textContent = isSelfUpdate
    ? "המשתמש ביקש לעדכן את הפרטים שלו. אפשר לתקן את הנוסח לפני האישור; מספר הטלפון והמייל נשארים ללא שינוי."
    : "אפשר לתקן או להשלים פרטים. מספר טלפון נדרש רק בשלב האישור כדי שאיש הקשר יופיע באפליקציה.";
  document.getElementById("contactAddSubmitBtn").textContent =
    isSelfUpdate ? "אישור ועדכון" : "אישור והוספה";
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

  const currentUser = auth && auth.currentUser;
  if (!currentUser || !currentUserHasAppAccess) {
    setContactAddStatus_("יש להתחבר לאפליקציה כדי לשלוח בקשה.", "error");
    return;
  }

  const submitButton = document.getElementById("contactAddSubmitBtn");
  submitButton.disabled = true;
  setContactAddStatus_("שולח את הבקשה...", "loading");

  try {
    const requestId = getCooldownSubmissionDocumentId_("add", currentUser);
    await firebaseApi.setDoc(
      firebaseApi.doc(db, "contactAddRequests", requestId),
      {
        firstName: values.firstName,
        lastName: values.lastName,
        titlePrefix: values.titlePrefix,
        role: values.role,
        department: values.department,
        phone: values.phone ? normalizePhone(values.phone) : "",
        email: values.email,
        reporterEmail: normalizeEmail(currentUser.email || ""),
        source: contactAddSource === "device_picker" ? "device_picker" : "manual",
        requestType: "contact_add",
        originalContactId: "",
        originalPhone: "",
        originalEmail: "",
        status: "pending",
        createdAt: firebaseApi.serverTimestamp(),
        updatedAt: firebaseApi.serverTimestamp(),
        handledAt: null,
        handledBy: "",
        approvedContactId: ""
      },
      { merge: false }
    );

    setContactAddStatus_("תודה על הוספת איש הקשר.", "success");
    document.getElementById("contactAddSubmitBtn").textContent = "נשלח";
    setTimeout(closeContactAddModal_, 1500);
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

  activeReportContact = contact;
  const contactBox = document.getElementById("contactReportContact");
  const details = document.getElementById("contactReportDetails");
  const type = document.getElementById("contactReportType");
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

function closeContactReportModal() {
  const modal = document.getElementById("contactReportModal");
  if (modal) modal.classList.remove("visible");
  document.body.style.overflow = "";
  activeReportContact = null;
  setStatus("contactReportStatus", "", "");
}

async function submitContactReport() {
  if (!activeReportContact || !auth || !auth.currentUser || !db || !firebaseApi) return;

  const typeInput = document.getElementById("contactReportType");
  const detailsInput = document.getElementById("contactReportDetails");
  const button = document.getElementById("contactReportSubmitBtn");
  const issueType = String(typeInput ? typeInput.value : "other");
  const details = String(detailsInput ? detailsInput.value : "").trim();

  if (details.length < 3) {
    setStatus("contactReportStatus", "כתבו בקצרה מה דורש תיקון.", "error");
    return;
  }

  if (button) button.disabled = true;
  setStatus("contactReportStatus", "שולח את הדיווח...", "loading");

  try {
    const reportId = getCooldownSubmissionDocumentId_(
      "report",
      auth.currentUser
    );
    await firebaseApi.setDoc(
      firebaseApi.doc(db, "contactReports", reportId),
      {
        contactDocId: String(activeReportContact.docId || ""),
        contactPhone: String(activeReportContact.phone || ""),
        contactName: String(activeReportContact.name || ""),
        issueType,
        details,
        reporterEmail: normalizeEmail(auth.currentUser.email),
        status: "open",
        createdAt: firebaseApi.serverTimestamp()
      },
      { merge: false }
    );

    setStatus("contactReportStatus", "הדיווח נשלח למנהלי האפליקציה. תודה.", "success");
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
  const renderedName = [
    escapeHtml(contact.title),
    highlightSearchText(contact.first),
    highlightSearchText(contact.last)
  ].filter(Boolean).join(" ").trim();

  return renderedName || escapeHtml(contact.name || formatPhoneForDisplay(contact.phone));
}

function getVisibleDepartment_(contact) {
  const department = String(contact && contact.dept || "").trim();
  if (!department || !activeQuickFilter) return department;

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

  if (!list.length) {
    document.getElementById("list").innerHTML = "";

    if (shouldShowNoResults()) {
      setListStatus("לא נמצאו תוצאות", "empty");
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

    let metaRows = "";
    let actionChips = "";
    let selectionHtml = "";

    if (c.role) {
      metaRows += `<div class="contactMetaRow">${escapeHtml(c.role)}</div>`;
    }

    const visibleDepartment = getVisibleDepartment_(c);
    if (visibleDepartment) {
      metaRows += `<div class="contactMetaRow">${escapeHtml(visibleDepartment)}</div>`;
    }

    metaRows += `
      <div class="contactMetaRow phoneRow">
        📞 <a href="tel:${c.phone}" onclick="recordContactUse_(${c.id}, 'phone')">${displayPhone}</a>
      </div>
    `;

    actionChips += `
      <a class="actionChip" href="tel:${c.phone}" onclick="recordContactUse_(${c.id}, 'call')">חיוג</a>
    `;

    if (!hideWhatsapp) {
      actionChips += `
        <a class="actionChip" href="https://wa.me/${cleanPhone}" target="_blank" rel="noopener" onclick="recordContactUse_(${c.id}, 'whatsapp')">וואטסאפ</a>
      `;
    }

    if (c.email) {
      metaRows += `
        <div class="contactMetaRow">
          📧 <a href="mailto:${escapeHtml(c.email)}" onclick="recordContactUse_(${c.id}, 'email')">${escapeHtml(c.email)}</a>
        </div>
      `;

      actionChips += `
        <a class="actionChip" href="mailto:${escapeHtml(c.email)}" onclick="recordContactUse_(${c.id}, 'email')">מייל</a>
      `;
    }

    if (selectionMode) {
      selectionHtml = `
        <label class="contactSelect ${isSelected ? "selected" : ""}" data-id="${c.id}">
          <input type="checkbox" data-id="${c.id}" ${isSelected ? "checked" : ""} onchange="toggleContactSelection(${c.id})">
          <span class="contactSelectBox">✓</span>
          <span class="contactSelectText">בחר/י</span>
        </label>
      `;
    }

    html += `
      <div class="contact ${isSelected ? "selected" : ""}" data-id="${c.id}">
        <div class="contactTopRow">
          <div class="contactHeader">
            <span class="contactName">${renderContactName(c)}</span>
          </div>

          ${selectionHtml}
        </div>

        <div class="contactMeta">
          ${metaRows}
        </div>

        <div class="contactDivider"></div>

        <div class="contactActions">
          ${actionChips}
        </div>

        <button class="addContactBtn" onclick="downloadContact(${c.id})">הוסף לאנשי קשר</button>
        ${selectionMode ? "" : `<button class="contactReportBtn" onclick="openContactReportModal(${c.id})">הפרטים אינם מעודכנים? דווחו לנו</button>`}
      </div>
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

  if (q.length < 2) {
    if (!isQuickFilterActive()) {
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
  const root = document.querySelector("[data-green-signature-root]");
  if (!root || root.dataset.greenSignatureInitialized === "true") return;

  const host = root.closest(".appHeaderTop");
  const copy = root.querySelector(".green-signature-copy");
  if (!host || !copy) return;

  const holdDurationMs = 3000;
  const visibleDurationMs = 5000;
  const returnDurationMs = 700;
  const movementLimitPx = 12;

  let holdTimer = null;
  let restoreTimer = null;
  let finishTimer = null;
  let activePointerId = null;
  let startX = 0;
  let startY = 0;
  let isActive = false;

  root.dataset.greenSignatureInitialized = "true";

  const clearTimer_ = timer => {
    if (timer !== null) window.clearTimeout(timer);
  };

  const cancelPendingHold_ = () => {
    clearTimer_(holdTimer);
    holdTimer = null;
    activePointerId = null;
  };

  const finishReturn_ = () => {
    clearTimer_(finishTimer);
    finishTimer = null;
    root.classList.remove("green-signature-returning");
    copy.setAttribute("aria-hidden", "true");
    isActive = false;
  };

  const restoreOriginalLogo_ = () => {
    clearTimer_(restoreTimer);
    restoreTimer = null;
    root.classList.remove("green-signature-active");
    root.classList.add("green-signature-returning");
    host.classList.remove("green-signature-host-active");
    finishTimer = window.setTimeout(finishReturn_, returnDurationMs);
  };

  const activateSignature_ = () => {
    holdTimer = null;
    activePointerId = null;
    if (isActive) return;

    isActive = true;
    copy.setAttribute("aria-hidden", "false");
    host.classList.add("green-signature-host-active");
    root.classList.add("green-signature-active");
    restoreTimer = window.setTimeout(
      restoreOriginalLogo_,
      visibleDurationMs
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
    holdTimer = window.setTimeout(activateSignature_, holdDurationMs);
  });

  root.addEventListener("pointermove", event => {
    if (event.pointerId !== activePointerId || holdTimer === null) return;

    const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
    if (moved > movementLimitPx) cancelPendingHold_();
  });

  ["pointerup", "pointerleave", "pointercancel"].forEach(eventName => {
    root.addEventListener(eventName, event => {
      if (event.pointerId === activePointerId) cancelPendingHold_();
    });
  });

  root.addEventListener("contextmenu", event => {
    if (holdTimer !== null || isActive) event.preventDefault();
  });
}
/* PROTECTED_EASTER_EGG_END */

function init() {
  initHiddenGreenSignature_();
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
  const autoRouteEmail = isValidEmail(requestedEmail)
    ? requestedEmail
    : pendingEmail;

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
      if (autoRouteEmail) {
        await continueFromEmailStep({ forceFresh: forceFreshRoute });
      }
    })
    .catch(error => {
      authActionInProgress = false;
      console.error("Firebase initialization failed", error);
      setLoginButtonDisabled(false);
      setStepButtonBusy_("emailContinueBtn", false, "טוען...", "המשך");
      setLoginStatus(
        "לא הצלחנו לטעון את מערכת ההתחברות. נסו לרענן את הדף.",
        "error"
      );
    });
}
init();
