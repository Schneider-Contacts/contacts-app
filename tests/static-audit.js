const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = fileName =>
  fs.readFileSync(path.join(root, fileName), "utf8");

const appSource = read("app.js");
const indexSource = read("index.html");
const emailUpdateSource = read("email-update.html");
const stylesSource = read("styles.css");
const appsScriptFiles = [
  "Code.gs",
  "FormAccess.gs",
  "DirectorySync.gs",
  "ReportsAutomation.gs",
  "FirestoreData.gs",
  "WebEndpoints.gs",
  "EmailUpdateLogic.gs"
];
const appsScriptSource = appsScriptFiles
  .map(read)
  .join("\n");
const directorySyncSource = read("DirectorySync.gs");
const webEndpointsSource = read("WebEndpoints.gs");
const reportsAutomationSource = read("ReportsAutomation.gs");
const codeSource = read("Code.gs");
const rulesSource = read("firestore.rules");
const manifestSource = read("appsscript.json");
const obsoleteAuthRouterId =
  "AKfycbw1aJRjfWl-fYiZveZ5oKdvtv9v_UGUa6JUzv9G1GKQZVK4SKsYdt0GTCgI50fyLE5V";
const activeAuthRouterId =
  "AKfycbwqwWDEUgxLRWIOEGX3TaK0tmdacrl-CG_kkdK01dlfAeGcDq3fXdHIjtSjQ2NwZvBK";

new vm.Script(appSource, { filename: "app.js" });
appsScriptFiles.forEach(fileName => {
  new vm.Script(read(fileName), { filename: fileName });
});

const extractAppsScriptFunction = (source, functionName) => {
  const match = source.match(
    new RegExp(
      `function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`
    )
  );
  assert(match, `Could not extract Apps Script function: ${functionName}`);
  return match[0];
};

const authRouteSandbox = {
  normalizeEmail_: value => String(value || "").trim().toLowerCase(),
  normalizeIsraeliPhone: value => {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
    else if (digits && !digits.startsWith("972")) digits = `972${digits}`;
    return digits ? `+${digits}` : "";
  },
  isValidEmail_: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  getAllowedUser_: email => {
    if (email === "active@example.com") return { active: true };
    if (email === "reset-ready@example.com") return { active: true };
    if (email === "blocked@example.com") return { active: false };
    return null;
  },
  isAllowedEmailPhonePairActive_: email =>
    ["active@example.com", "reset-ready@example.com"].includes(email),
  getPasswordResetRequest_: email =>
    email === "reset-ready@example.com"
      ? {
          status: "manager_ready",
          approvedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        }
      : null,
  isValidNormalizedIsraeliPhone_: phone => /^\+9725\d{8}$/.test(phone),
  findEmailUpdateMatches_: phone =>
    phone === "+972541234567" ? [{ phone }] : []
};
vm.createContext(authRouteSandbox);
vm.runInContext(
  [
    extractAppsScriptFunction(webEndpointsSource, "getPublicEmailAuthRoute_"),
    extractAppsScriptFunction(webEndpointsSource, "getPublicPhoneAuthRoute_")
  ].join("\n"),
  authRouteSandbox
);

assert.strictEqual(
  authRouteSandbox.getPublicEmailAuthRoute_("active@example.com"),
  "PASSWORD"
);
assert.strictEqual(
  authRouteSandbox.getPublicEmailAuthRoute_("reset-ready@example.com"),
  "PASSWORD_RESET_READY"
);
assert.strictEqual(
  authRouteSandbox.getPublicEmailAuthRoute_("new@example.com"),
  "ASK_PHONE"
);
assert.strictEqual(
  authRouteSandbox.getPublicEmailAuthRoute_("blocked@example.com"),
  "BLOCKED"
);
assert.strictEqual(
  authRouteSandbox.getPublicPhoneAuthRoute_("054-123-4567"),
  "UPDATE_EMAIL"
);
assert.strictEqual(
  authRouteSandbox.getPublicPhoneAuthRoute_("050-000-0000"),
  "OPEN_FORM"
);
assert.strictEqual(
  authRouteSandbox.getPublicPhoneAuthRoute_("123"),
  "INVALID_PHONE"
);

assert.match(
  indexSource,
  /<link[^>]+href="styles\.css\?[^"]+"/,
  "index.html must load styles.css"
);
assert.match(
  indexSource,
  /<script[^>]+src="app\.js\?[^"]+"/,
  "index.html must load app.js"
);
assert(
  appSource.includes(activeAuthRouterId) &&
    emailUpdateSource.includes(activeAuthRouterId),
  "Every public authentication form must use the active Apps Script deployment"
);
assert.match(
  appSource,
  /function initHiddenGreenSignature_\(\)/,
  "The permanent owner signature initializer must exist"
);
assert.match(
  appSource,
  /PROTECTED_EASTER_EGG_START[\s\S]*?PROTECTED_EASTER_EGG_END/,
  "The permanent owner signature JavaScript must remain protected"
);
assert.match(
  indexSource,
  /data-green-signature-root[\s\S]*?Since 1913[\s\S]*?Built with green intent\.[\s\S]*?G 💚/,
  "The permanent owner signature wording must remain intact"
);
assert.strictEqual(
  (indexSource.match(/data-green-signature-root/g) || []).length,
  2,
  "The hidden signature must target both in-app logos"
);
assert.strictEqual(
  (indexSource.match(/draggable="false"/g) || []).length,
  4,
  "All hidden-signature images must disable native image dragging"
);
assert.match(
  stylesSource,
  /\.green-signature-face img[\s\S]*?-webkit-touch-callout:\s*none/,
  "The hidden signature must disable the native image callout"
);
assert(
  fs.existsSync(path.join(root, "maccabi-haifa-symbol.svg")),
  "The local Maccabi Haifa symbol must exist"
);

const extractCompleteFunction = (source, functionName) => {
  const start = source.indexOf(`function ${functionName}(`);
  assert(start >= 0, `Could not find function: ${functionName}`);

  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error(`Could not extract complete function: ${functionName}`);
};

const createClassList = () => {
  const values = new Set();
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    contains: name => values.has(name),
    toggle: (name, force) => {
      if (force === true) {
        values.add(name);
        return true;
      }
      if (force === false) {
        values.delete(name);
        return false;
      }
      if (values.has(name)) {
        values.delete(name);
        return false;
      }
      values.add(name);
      return true;
    }
  };
};

const createSignatureRoot = showsCopy => {
  const listeners = new Map();
  const copyAttributes = {};
  const copy = showsCopy
    ? {
        setAttribute: (name, value) => {
          copyAttributes[name] = value;
        }
      }
    : null;
  const root = {
    dataset: {
      greenSignatureCopy: showsCopy ? "true" : "false"
    },
    classList: createClassList(),
    addEventListener: (eventName, listener) => {
      const eventListeners = listeners.get(eventName) || [];
      eventListeners.push(listener);
      listeners.set(eventName, eventListeners);
    },
    querySelector: selector =>
      selector === ".green-signature-copy" ? copy : null
  };

  return { root, listeners, copyAttributes };
};

const headerSignature = createSignatureRoot(false);
const largeSignature = createSignatureRoot(true);

let signatureClock = 0;
let signatureTimerId = 0;
const signatureTimers = new Map();
const advanceSignatureClock = durationMs => {
  const targetTime = signatureClock + durationMs;

  while (true) {
    const nextTimer = [...signatureTimers.entries()]
      .filter(([, timer]) => timer.time <= targetTime)
      .sort((left, right) => left[1].time - right[1].time)[0];
    if (!nextTimer) break;

    const [timerId, timer] = nextTimer;
    signatureTimers.delete(timerId);
    signatureClock = timer.time;
    timer.callback();
  }

  signatureClock = targetTime;
};
const dispatchSignaturePointer = (signature, eventName, overrides = {}) => {
  const event = {
    pointerId: 1,
    pointerType: "touch",
    button: 0,
    isPrimary: true,
    clientX: 10,
    clientY: 10,
    defaultPrevented: false,
    cancelable: true,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...overrides
  };
  (signature.listeners.get(eventName) || []).forEach(listener => listener(event));
  return event;
};

const signatureSandbox = {
  document: {
    querySelectorAll: selector =>
      selector === "[data-green-signature-root]"
        ? [headerSignature.root, largeSignature.root]
        : []
  },
  window: {
    setTimeout: (callback, durationMs) => {
      signatureTimerId += 1;
      signatureTimers.set(signatureTimerId, {
        callback,
        time: signatureClock + durationMs
      });
      return signatureTimerId;
    },
    clearTimeout: timerId => signatureTimers.delete(timerId)
  },
  Math
};
vm.createContext(signatureSandbox);
vm.runInContext(
  extractCompleteFunction(appSource, "initHiddenGreenSignature_"),
  signatureSandbox
);
signatureSandbox.initHiddenGreenSignature_();

assert(
  headerSignature.root.dataset.greenSignatureInitialized === "true" &&
    largeSignature.root.dataset.greenSignatureInitialized === "true",
  "Both in-app logos must initialize"
);

const firstShortPress = dispatchSignaturePointer(
  largeSignature,
  "pointerdown"
);
dispatchSignaturePointer(largeSignature, "pointerup");
advanceSignatureClock(1700);
assert(
  firstShortPress.defaultPrevented &&
    !largeSignature.root.classList.contains("green-signature-active"),
  "One tap must suppress native behavior without activating the signature"
);

dispatchSignaturePointer(largeSignature, "pointerdown");
dispatchSignaturePointer(largeSignature, "pointermove", { clientX: 30 });
advanceSignatureClock(1700);
assert(
  !largeSignature.root.classList.contains("green-signature-active"),
  "Significant movement must cancel the owner signature"
);

for (let tapIndex = 0; tapIndex < 3; tapIndex += 1) {
  dispatchSignaturePointer(largeSignature, "pointerdown");
  dispatchSignaturePointer(largeSignature, "pointerup");
  if (tapIndex < 2) advanceSignatureClock(200);
}
assert(
  largeSignature.root.classList.contains("green-signature-active") &&
    largeSignature.copyAttributes["aria-hidden"] === "false",
  "Three quick taps on the large logo must activate the signature and text"
);

dispatchSignaturePointer(largeSignature, "pointerdown", { pointerId: 2 });
dispatchSignaturePointer(largeSignature, "pointerup", { pointerId: 2 });
advanceSignatureClock(4999);
assert(
  largeSignature.root.classList.contains("green-signature-active"),
  "The active signature must ignore duplicate activation attempts"
);
advanceSignatureClock(1);
assert(
  !largeSignature.root.classList.contains("green-signature-active"),
  "The original logo must begin returning after five seconds"
);
advanceSignatureClock(700);
assert.strictEqual(
  signatureTimers.size,
  0,
  "The owner signature must leave no active timers after returning"
);

dispatchSignaturePointer(largeSignature, "pointerdown", { pointerId: 3 });
dispatchSignaturePointer(largeSignature, "pointerup", { pointerId: 3 });
dispatchSignaturePointer(largeSignature, "pointerdown", { pointerId: 4 });
dispatchSignaturePointer(largeSignature, "pointerup", { pointerId: 4 });
dispatchSignaturePointer(largeSignature, "pointerdown", { pointerId: 5 });
dispatchSignaturePointer(largeSignature, "pointerup", { pointerId: 5 });
assert(
  largeSignature.root.classList.contains("green-signature-active"),
  "The owner signature must work again after it has closed"
);

advanceSignatureClock(5700);
for (let tapIndex = 0; tapIndex < 3; tapIndex += 1) {
  dispatchSignaturePointer(headerSignature, "pointerdown");
  dispatchSignaturePointer(headerSignature, "pointerup");
}
assert(
  headerSignature.root.classList.contains("green-signature-active") &&
    Object.keys(headerSignature.copyAttributes).length === 0,
  "The header logo must change its symbol without showing signature text"
);

const adminFocusSandbox = {
  adminAllowedUsers: [
    { email: "one@example.com", phone: "+972501111111", active: true },
    { email: "orphan@example.com", phone: "+972502222222", active: false }
  ],
  adminContacts: [
    {
      docId: "contact-one",
      email: "one@example.com",
      phone: "+972501111111",
      name: "One"
    }
  ],
  adminRemovedContacts: [
    {
      docId: "contact-removed",
      email: "removed@example.com",
      phone: "+972503333333",
      name: "Removed",
      deleted: true
    }
  ],
  adminContactAddRequests: [
    { docId: "contact-request", status: "pending", createdAt: 30 }
  ],
  adminReports: [
    { docId: "report-request", status: "open", createdAt: 20 }
  ],
  normalizeEmail: value => String(value || "").trim().toLowerCase(),
  normalizePhone: value => String(value || "").replace(/\D/g, ""),
  getUserAccessState_: user => ({
    key: user.active ? "pending" : "blocked"
  }),
  getVerificationRequestByEmail_: email =>
    email === "one@example.com"
      ? { status: "pending", requestedAt: 50 }
      : null,
  getAdminTimestampMillis_: value => Number(value) || 0,
  getPendingPasswordResetRequests_: () => [
    { email: "reset@example.com", requestedAt: 40 }
  ],
  getContactAddRequestTimestamp_: request => Number(request.createdAt) || 0,
  getReportTimestamp_: report => Number(report.createdAt) || 0,
  Map,
  Set
};
vm.createContext(adminFocusSandbox);
vm.runInContext(
  [
    extractCompleteFunction(appSource, "getAdminAttentionItems_"),
    extractCompleteFunction(appSource, "getAdminPeople_")
  ].join("\n"),
  adminFocusSandbox
);

const focusedPeople = adminFocusSandbox.getAdminPeople_();
assert.strictEqual(
  focusedPeople.length,
  3,
  "The people view must merge matching contacts and access records"
);
assert(
  focusedPeople.some(
    person =>
      person.contact &&
      person.user &&
      person.user.email === "one@example.com"
  ),
  "A matching contact and access record must render as one person"
);

const attentionItems = adminFocusSandbox.getAdminAttentionItems_();
assert.deepStrictEqual(
  Array.from(attentionItems, item => item.kind),
  ["access", "reset", "contact", "report"],
  "The attention queue must consolidate and sort every pending request type"
);

const moreRendererSource = extractCompleteFunction(
  appSource,
  "renderAdminMore_"
);
assert.match(
  moreRendererSource,
  /אנשים השתמשו באפליקציה היום/,
  "The More view must show one clear daily-usage number"
);
assert.doesNotMatch(
  moreRendererSource,
  /%|14 הימים|השתמשו בפרטי איש קשר/,
  "The More view must not show percentages or detailed usage analytics"
);

const adminFocusElements = {
  adminSummary: { textContent: "" },
  adminList: { innerHTML: "" },
  adminSearchInput: { value: "" }
};
Object.assign(adminFocusSandbox, {
  document: {
    getElementById: id => adminFocusElements[id] || null
  },
  adminActiveFilter: "all",
  adminVisibleItemCount: 25,
  currentAdminEmail: "manager@example.com",
  currentUserIsSuperAdmin: false,
  adminDailyActiveUsers: [
    { date: "2026-07-29", activeUserCount: 7 }
  ],
  adminActivity: [],
  adminManagers: [],
  escapeHtml: value => String(value || ""),
  escapeJsString: value => String(value || ""),
  getAdminSearchQuery: () => "",
  getVisibleAdminItems_: items => items.slice(0, 25),
  renderAdminLoadMore_: () => "",
  findContactByEmail: email =>
    adminFocusSandbox.adminContacts.find(
      contact => contact.email === email
    ) || null,
  formatPhoneForDisplay: value => String(value || ""),
  formatAdminTimestamp_: value => String(value || ""),
  formatContactAddRequestTimestamp_: value =>
    String(value && value.createdAt || ""),
  getContactAddRequestName_: request =>
    [request.firstName, request.lastName].filter(Boolean).join(" "),
  getReportTypeLabel_: () => "פרטים לא מעודכנים",
  formatReportTimestamp_: value =>
    String(value && value.createdAt || ""),
  adminContactAddRequestMatchesQuery_: () => true,
  adminReportMatchesQuery_: () => true,
  adminUserMatchesQuery: () => true,
  getActivePasswordRecoveryForUser_: () => null,
  getAccountDisplayName_: (email, fallback) => fallback || email,
  getIsraelDateKey_: () => "2026-07-29",
  getActivityCategory: () => "changed",
  getActivityTitle: () => "פעילות",
  formatActivityTimestamp: () => "עכשיו"
});
adminFocusSandbox.getUserAccessState_ = user => ({
  key: user.active ? "pending" : "blocked",
  label: user.active ? "ממתין לאישור" : "גישה חסומה",
  note: "",
  badgeClass: user.active ? "pending" : "blocked"
});
vm.runInContext(
  [
    extractCompleteFunction(appSource, "adminAttentionItemMatchesQuery_"),
    extractCompleteFunction(appSource, "renderAdminAttentionAccessCard_"),
    extractCompleteFunction(appSource, "renderAdminAttentionResetCard_"),
    extractCompleteFunction(appSource, "renderAdminAttentionContactCard_"),
    extractCompleteFunction(appSource, "renderAdminAttentionReportCard_"),
    extractCompleteFunction(appSource, "renderAdminAttention_"),
    extractCompleteFunction(appSource, "adminPersonMatchesQuery_"),
    extractCompleteFunction(appSource, "renderAdminPersonManagement_"),
    extractCompleteFunction(appSource, "renderAdminPeople_"),
    extractCompleteFunction(appSource, "renderAdminMoreActivityHtml_"),
    extractCompleteFunction(appSource, "renderAdminMoreManagersHtml_"),
    extractCompleteFunction(appSource, "renderAdminMore_")
  ].join("\n"),
  adminFocusSandbox
);

adminFocusSandbox.renderAdminAttention_();
assert.match(
  adminFocusElements.adminList.innerHTML,
  /טיפול בבקשה[\s\S]*?טיפול באיפוס הסיסמה[\s\S]*?בדיקת הבקשה[\s\S]*?טיפול בדיווח/,
  "Every pending request type must render through one focused action"
);

adminFocusSandbox.renderAdminPeople_();
assert.match(
  adminFocusElements.adminList.innerHTML,
  /ניהול איש הקשר[\s\S]*?עריכת פרטים[\s\S]*?עזרה באיפוס סיסמה[\s\S]*?פעולות נוספות[\s\S]*?חסימת גישה[\s\S]*?מחיקת הרשאה[\s\S]*?הסרה מהאפליקציה/,
  "Each contact must expose one ordered management flow"
);
assert.doesNotMatch(
  adminFocusElements.adminList.innerHTML,
  /פרטי איש קשר[\s\S]*?כניסה והרשאות/,
  "Contact management must not be split into separate sections"
);

adminFocusSandbox.renderAdminMore_();
assert.match(
  adminFocusElements.adminList.innerHTML,
  />7<[\s\S]*?אנשים השתמשו באפליקציה היום/,
  "The More view must render the daily active-user count"
);

const focusedAdminRenderSource = [
  "renderAdminAttentionAccessCard_",
  "renderAdminAttentionResetCard_",
  "renderAdminAttentionContactCard_",
  "renderAdminAttentionReportCard_",
  "renderAdminPersonManagement_",
  "renderAdminMoreManagersHtml_",
  "renderAdminMore_"
].map(name => extractCompleteFunction(appSource, name)).join("\n");
const focusedAdminActionFunctions = [
  "approveManualAccess_",
  "rejectManualAccess_",
  "revokeManualAccess_",
  "approvePasswordRecoveryForUser_",
  "sendPasswordResetForUser_",
  "closePasswordResetRequest_",
  "approveContactAddRequest_",
  "openContactAddRequestForApproval_",
  "rejectContactAddRequest_",
  "setContactReportStatus_",
  "restoreAdminContact",
  "openAdminEditModal",
  "removeAdminContact",
  "preparePasswordRecoveryForUser_",
  "cancelPreparedPasswordRecoveryForUser_",
  "toggleUserAccess",
  "deleteUserPermission",
  "openAddManagerModal",
  "removeManager",
  "refreshAdminPage"
];

focusedAdminActionFunctions.forEach(name => {
  assert(
    focusedAdminRenderSource.includes(name),
    `Focused admin UI must keep the existing action wired: ${name}`
  );
  assert(
    new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(appSource),
    `Focused admin action function must still exist: ${name}`
  );
});
assert.match(
  extractCompleteFunction(appSource, "setContactReportStatus_"),
  /renderAdminList\(\)/,
  "Resolving a report must refresh the consolidated attention queue"
);

const createAdminTabElement = () => ({
  classList: createClassList(),
  style: {},
  attributes: {},
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
});
const adminTabElements = {
  adminAttentionTab: createAdminTabElement(),
  adminPeopleTab: createAdminTabElement(),
  adminMoreTab: createAdminTabElement(),
  adminToolbar: createAdminTabElement(),
  adminAttentionFilters: createAdminTabElement(),
  adminPeopleFilters: createAdminTabElement(),
  adminSearchInput: { value: "", placeholder: "" },
  adminPanel: { style: { display: "block" } }
};
const adminTabsSandbox = {
  adminActiveTab: "attention",
  document: {
    getElementById: id => adminTabElements[id] || null,
    querySelector: () => null
  },
  updateAdminPendingBadges_: () => {},
  updateAdminFilterButtons: () => {}
};
vm.createContext(adminTabsSandbox);
vm.runInContext(
  extractCompleteFunction(appSource, "updateAdminTabs"),
  adminTabsSandbox
);

adminTabsSandbox.updateAdminTabs();
assert.strictEqual(adminTabElements.adminToolbar.style.display, "block");
assert.strictEqual(
  adminTabElements.adminAttentionFilters.style.display,
  "flex"
);
assert.strictEqual(
  adminTabElements.adminPeopleFilters.style.display,
  "none"
);

adminTabsSandbox.adminActiveTab = "people";
adminTabsSandbox.updateAdminTabs();
assert.strictEqual(
  adminTabElements.adminAttentionFilters.style.display,
  "none"
);
assert.strictEqual(
  adminTabElements.adminPeopleFilters.style.display,
  "flex"
);
assert.strictEqual(
  adminTabElements.adminSearchInput.placeholder,
  "חיפוש אדם לפי שם, מייל או טלפון"
);

adminTabsSandbox.adminActiveTab = "more";
adminTabsSandbox.updateAdminTabs();
assert.strictEqual(
  adminTabElements.adminToolbar.style.display,
  "none",
  "The More tab must hide search and filters"
);

assert(
  !appSource.includes(obsoleteAuthRouterId) &&
    !emailUpdateSource.includes(obsoleteAuthRouterId),
  "Public pages must not reference the obsolete Apps Script deployment"
);
assert.match(
  indexSource,
  /class="adminStickyControls"/,
  "Admin navigation controls must use the sticky wrapper"
);
assert.match(
  indexSource,
  /id="adminAttentionPendingBadge"[^>]+hidden/,
  "The focused attention tab must expose one pending-items badge"
);
assert.strictEqual(
  (indexSource.match(/class="adminTabBtn/g) || []).length,
  3,
  "Admin navigation must expose exactly three primary tabs"
);
assert.doesNotMatch(
  indexSource,
  /id="admin(?:General|Contacts|Users|Reports|Activity|Managers)Tab"/,
  "Legacy admin tabs must not remain in the primary navigation"
);
assert.match(
  indexSource,
  /id="adminOpenPendingBadge"[^>]+hidden/,
  "Main admin button must expose a central pending-items badge"
);
assert.match(
  appSource,
  /<details class="adminFocusAction"/,
  "Focused admin cards must expose one expandable primary action"
);
assert.match(
  appSource,
  /<details class="adminActionMenu"/,
  "Destructive admin actions must render in a secondary action menu"
);
assert.match(
  appSource,
  /function updateAdminPendingBadges_\(\)/,
  "Admin pending badge updater must exist"
);
assert.match(
  appSource,
  /function renderAdminAttention_\(\)/,
  "Admin must render a single consolidated attention queue"
);
assert.match(
  appSource,
  /function renderAdminPeople_\(\)/,
  "Admin must render contacts and access permissions together"
);
assert.match(
  appSource,
  /אנשים השתמשו באפליקציה היום/,
  "Admin usage must be reduced to one clear daily number"
);
assert.doesNotMatch(
  indexSource,
  /הצגת 14 הימים האחרונים/,
  "The admin interface must not expose usage-history controls"
);
assert.match(
  appSource,
  /getCountFromServer\(countQuery\)/,
  "Admin overview must use lightweight aggregate counts"
);
assert.doesNotMatch(
  appSource,
  /function showAppForUser\(user\)[\s\S]*?if \(currentUserIsAdmin\) \{\s*openAdminPanel\(\);/,
  "Administrators must open on the regular contacts screen"
);
assert.match(
  indexSource,
  /id="adminReasonModal"[\s\S]*?id="adminReasonInput"/,
  "Manager approvals must use an accessible in-app reason dialog"
);
assert.match(
  appSource,
  /function requestAdminReason_\(/,
  "Manager approval reason dialog helper must exist"
);
assert.match(
  appSource,
  /function deleteUserPermission\(email\)[\s\S]*?verificationRequests[\s\S]*?status:[\s\S]*?"rejected"[\s\S]*?"revoked"/,
  "Deleting a permission must close its active verification request"
);
assert.doesNotMatch(
  appSource,
  /window\.prompt\(/,
  "Manager approval flows must not rely on native prompt dialogs"
);
assert.match(
  appSource,
  /permission\.accessReviewRequired\s*&&\s*!permissionHasTemporaryAccess_\(permission\)/,
  "A manager-approved temporary session must not wait for redundant server activation"
);
assert.match(
  appSource,
  /const PASSWORD_HELP_TIMEOUT_MS = 30000;/,
  "Manager password recovery requests must allow for an Apps Script cold start"
);
assert.match(
  appSource,
  /PASSWORD_HELP_TIMEOUT_MS\);/,
  "Password recovery assistance must use its longer timeout"
);
assert.match(
  appSource,
  /setPersistence\(\s*auth,\s*firebaseApi\.browserLocalPersistence\s*\)/,
  "Firebase sessions must persist across browser restarts"
);
assert.match(
  appSource,
  /permission\.accessReviewRequired !== true/,
  "Existing users without the new review flag must keep their access"
);

const functionPattern =
  /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
const appFunctions = new Set(
  [...appSource.matchAll(functionPattern)].map(match => match[1])
);
const inlineHandlers = [
  ...indexSource.matchAll(/\son[a-z]+="([^"]*)"/g)
].map(match => match[1]);

inlineHandlers.forEach(handler => {
  const calledFunctions = [
    ...handler.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)
  ]
    .map(match => match[1])
    .filter(name => name !== "preventDefault");

  calledFunctions.forEach(name => {
    assert(
      appFunctions.has(name),
      `Inline handler refers to missing function: ${name}`
    );
  });
});

const requiredAppsScriptEntrypoints = [
  "onFormSubmit",
  "syncContactsToFirestore",
  "sendDailyAccessReport",
  "doPost",
  "doGet",
  "submitEmailUpdate",
  "approveContactAddRequestFromWeb_",
  "activateTemporaryAccessFromWeb_",
  "approvePasswordRecoveryFromWeb_",
  "consumePasswordRecoveryFromWeb_"
];

requiredAppsScriptEntrypoints.forEach(name => {
  assert(
    new RegExp(`\\bfunction\\s+${name}\\s*\\(`).test(appsScriptSource),
    `Missing Apps Script entrypoint: ${name}`
  );
});

assert.match(
  webEndpointsSource,
  /function upsertApprovedContactInContactsSheet_\(values\)[\s\S]*?getSheetByName\(CONTACTS_OLD_SHEET_NAME\)/,
  "Approved contacts must be stored in the static contacts_old source"
);
assert.match(
  directorySyncSource,
  /assertDirectoryContactCountIsSafe_\(\s*existingDirectoryState\.contactCount,\s*normalizedContacts\.length\s*\)/,
  "Directory writes must enforce the contact-count shrink guard"
);
assert.match(
  directorySyncSource,
  /function assertDirectoryContactCountIsSafe_\(existingCount, nextCount\)/,
  "Directory shrink guard implementation must exist"
);

assert.match(
  indexSource,
  /id="passwordRecoveryPanel"[\s\S]*?id="passwordRecoveryReference"/,
  "Password recovery must expose a same-device waiting panel and request reference"
);
assert.match(
  appSource,
  /function approvePasswordRecoveryForUser_\(email\)/,
  "Regular admin UI must provide password recovery approval"
);
assert.match(
  appSource,
  /function preparePasswordRecoveryForUser_\(email\)[\s\S]*?"preparePasswordRecovery"/,
  "Every active permission must support manager-prepared password recovery"
);
assert.match(
  webEndpointsSource,
  /function preparePasswordRecoveryFromWeb_[\s\S]*?status:\s*\{\s*stringValue:\s*"manager_ready"\s*\}/,
  "Manager-prepared recovery must persist an expiring ready state"
);
assert.match(
  webEndpointsSource,
  /function doPost\(e\)[\s\S]*?action === "preparePasswordRecovery"[\s\S]*?action === "cancelPasswordRecovery"[\s\S]*?createAuthManagementPostResponse_\(e\)/,
  "Every manager password-recovery action must reach the authenticated POST router"
);
assert.match(
  webEndpointsSource,
  /function claimManagerPasswordRecovery_[\s\S]*?registeredPhone !== normalizedPhone[\s\S]*?recoveryTokenHash/,
  "A manager-prepared reset must verify the registered phone before releasing a one-time secret"
);
assert.match(
  appSource,
  /route === "PASSWORD_RESET_READY"[\s\S]*?showAuthPhoneStep_\(email,\s*"password_reset"\)/,
  "The next login after manager approval must open the password-reset identity step"
);
assert.match(
  appSource,
  /recovery\.managerPrepared === true[\s\S]*?"צור סיסמה חדשה"/,
  "A manager-prepared reset must clearly label the new-password step"
);
assert.match(
  indexSource,
  /authChoicePrompt">נא לבחור את האפשרות המתאימה:/,
  "The account-path choice must have an explicit instruction"
);
assert.match(
  indexSource,
  /authHelpStep regular[\s\S]*?passwordResetBtn[\s\S]*?authHelpStep manager[\s\S]*?passwordResetHelpBtn[\s\S]*?authHelpStep whatsapp/,
  "Password help actions must appear in chronological order"
);
assert.match(
  webEndpointsSource,
  /function savePasswordResetRequest_\(email\)[\s\S]*?if \(existingActive\)[\s\S]*?duplicate: true/,
  "An active password recovery request must not be silently replaced"
);
assert.match(
  webEndpointsSource,
  /function createEmailUpdateChoicePage_[\s\S]*?<base target="_top">[\s\S]*?<form method="post" target="_top"/,
  "Email replacement confirmation must escape the Apps Script iframe"
);
assert.doesNotMatch(
  webEndpointsSource,
  /window\.parent\.postMessage/,
  "Apps Script action responses must not stop at the nested wrapper iframe"
);
assert.match(
  webEndpointsSource,
  /window\.top\.postMessage/,
  "Apps Script action responses must reach the application window"
);
assert.match(
  webEndpointsSource,
  /recoveryTokenHash[\s\S]*?hashPasswordRecoverySecret_/,
  "Password recovery secrets must be stored only as a hash"
);
assert.doesNotMatch(
  webEndpointsSource,
  /password:\s*\{\s*stringValue:/,
  "Plaintext passwords must never be stored in Firestore"
);
assert.match(
  webEndpointsSource,
  /accounts:update[\s\S]*?validSince/,
  "Password recovery must revoke older Firebase sessions"
);
assert.match(
  rulesSource,
  /accessReviewStatus == "temporary_active"[\s\S]*?temporaryAccessUntil > request\.time/,
  "Temporary access must expire according to the server timestamp"
);
assert.match(
  rulesSource,
  /!\('accessReviewRequired' in get\([\s\S]*?\|\| get\([\s\S]*?\.data\.accessReviewRequired != true/,
  "Firestore rules must remain compatible with existing users"
);
assert.match(
  codeSource,
  /const SUPPORT_CONTACT_CACHE_KEY = "active-manager-support-contact-v2";/,
  "Support contact cache must be refreshed after the manager-phone fallback"
);
assert.match(
  read("FirestoreData.gs"),
  /function getActiveManagerSupportContact_\(\)[\s\S]*?isAllowedEmailPhonePairActive_\(admin\.email, allowedUser\)/,
  "Manager WhatsApp support must fall back to the linked allowed phone"
);
assert.match(
  rulesSource,
  /match \/verificationRequests\/\{docId\}[\s\S]*?\|\| \(\s*isAdmin\(\)/,
  "Any active admin must be able to handle verification requests"
);
assert.match(
  reportsAutomationSource,
  /function getActiveAuthenticationRequests_\(now\)/,
  "The daily email must include active authentication requests"
);
assert.match(
  codeSource,
  /const DAILY_ACCESS_REPORT_HOUR = 21;/,
  "The daily authentication report must run at 21:00"
);
assert.match(
  manifestSource,
  /https:\/\/www\.googleapis\.com\/auth\/identitytoolkit/,
  "Apps Script must request the Identity Toolkit scope for admin-approved reset"
);

const classNames = new Set(
  [...stylesSource.matchAll(/\.([A-Za-z_-][A-Za-z0-9_-]*)/g)]
    .map(match => match[1])
);
const renderedSources =
  indexSource + "\n" + appSource + "\n" + emailUpdateSource;
const unreferencedClasses = [...classNames]
  .filter(className => !renderedSources.includes(className));

assert.deepStrictEqual(
  unreferencedClasses,
  [],
  `Unreferenced CSS classes: ${unreferencedClasses.join(", ")}`
);

console.log("static audit: OK");
