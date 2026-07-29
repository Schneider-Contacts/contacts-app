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
    if (email === "blocked@example.com") return { active: false };
    return null;
  },
  isAllowedEmailPhonePairActive_: email => email === "active@example.com",
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
  /id="adminUsersPendingBadge"[^>]+hidden/,
  "Users tab must expose a pending-items badge"
);
assert.match(
  indexSource,
  /id="adminReportsPendingBadge"[^>]+hidden/,
  "Reports tab must expose a pending-items badge"
);
assert.match(
  indexSource,
  /id="adminOpenPendingBadge"[^>]+hidden/,
  "Main admin button must expose a central pending-items badge"
);
assert.match(
  appSource,
  /<details class="adminCardMore"/,
  "Admin cards must render expandable details"
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
  /class="adminAttentionBanner/,
  "Admin overview must render the central attention banner"
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
  webEndpointsSource,
  /function savePasswordResetRequest_\(email\)[\s\S]*?if \(existingActive\)[\s\S]*?duplicate: true/,
  "An active password recovery request must not be silently replaced"
);
assert.match(
  webEndpointsSource,
  /function createEmailUpdateChoicePage_[\s\S]*?<base target="_top">[\s\S]*?<form method="post" target="_top"/,
  "Email replacement confirmation must escape the Apps Script iframe"
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
