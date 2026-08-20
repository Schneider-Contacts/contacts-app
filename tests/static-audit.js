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
const internImporterSource = read("intern-import.js");
const internImporter = require(path.join(root, "intern-import.js"));
const xlsxVendorPath = path.join(root, "vendor", "xlsx.full.min.js");
const appsScriptFiles = [
  "Code.gs",
  "FormAccess.gs",
  "DirectorySync.gs",
  "ReportsAutomation.gs",
  "FirestoreData.gs",
  "AppUsersMirror.gs",
  "WebEndpoints.gs",
  "EmailUpdateLogic.gs"
];
const appsScriptSource = appsScriptFiles
  .map(read)
  .join("\n");
const directorySyncSource = read("DirectorySync.gs");
const webEndpointsSource = read("WebEndpoints.gs");
const emailUpdateLogicSource = read("EmailUpdateLogic.gs");
const reportsAutomationSource = read("ReportsAutomation.gs");
const codeSource = read("Code.gs");
const rulesSource = read("firestore.rules");
const manifestSource = read("appsscript.json");
const obsoleteAuthRouterId =
  "AKfycbw1aJRjfWl-fYiZveZ5oKdvtv9v_UGUa6JUzv9G1GKQZVK4SKsYdt0GTCgI50fyLE5V";
const activeAuthRouterId =
  "AKfycbwqwWDEUgxLRWIOEGX3TaK0tmdacrl-CG_kkdK01dlfAeGcDq3fXdHIjtSjQ2NwZvBK";

new vm.Script(appSource, { filename: "app.js" });
new vm.Script(internImporterSource, { filename: "intern-import.js" });
assert(fs.existsSync(xlsxVendorPath), "The pinned local XLSX parser must exist");
assert(
  fs.statSync(xlsxVendorPath).size > 900000,
  "The vendored SheetJS standalone build must not be replaced by a stub"
);
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

const accountRouteState = { firebaseUser: null };
const accountRouteSandbox = {
  PUBLIC_AUTH_ACCOUNT_ROUTING_CLIENT: "login-ux-v2",
  cleanSheetValue_: value => String(value || "").trim(),
  findFirebaseUserByEmailAdmin_: () => accountRouteState.firebaseUser
};
vm.createContext(accountRouteSandbox);
vm.runInContext(
  extractAppsScriptFunction(
    webEndpointsSource,
    "getPublicEmailAccountRoute_"
  ),
  accountRouteSandbox
);
assert.strictEqual(
  accountRouteSandbox.getPublicEmailAccountRoute_(
    "new@example.com",
    "PASSWORD",
    ""
  ),
  "PASSWORD",
  "Legacy clients must keep the existing public-router contract"
);
assert.strictEqual(
  accountRouteSandbox.getPublicEmailAccountRoute_(
    "new@example.com",
    "PASSWORD",
    "login-ux-v2"
  ),
  "PASSWORD_SETUP",
  "An authorized user without Firebase credentials must reach setup"
);
accountRouteState.firebaseUser = {
  localId: "firebase-user",
  disabled: false
};
assert.strictEqual(
  accountRouteSandbox.getPublicEmailAccountRoute_(
    "active@example.com",
    "PASSWORD",
    "login-ux-v2"
  ),
  "PASSWORD"
);
accountRouteState.firebaseUser = {
  localId: "disabled-user",
  disabled: true
};
assert.strictEqual(
  accountRouteSandbox.getPublicEmailAccountRoute_(
    "blocked@example.com",
    "PASSWORD",
    "login-ux-v2"
  ),
  "BLOCKED"
);

let capturedAuthFetchRequests = [];
const authPrefetchPayloads = [
  { decoded: { active: true }, updateTime: "admin-time" },
  {
    decoded: {
      email: "ACTIVE@EXAMPLE.COM",
      active: true,
      phone: "054-123-4567",
      phoneKey: "972541234567"
    },
    updateTime: "user-time"
  },
  {
    decoded: {
      status: "manager_ready",
      approvedUntil: "2099-01-01T21:59:59.999Z"
    },
    updateTime: "reset-time"
  }
];
const authPrefetchSandbox = {
  FIREBASE_PROJECT_ID: "test-project",
  PASSWORD_RECOVERY_REQUEST_COLLECTION: "passwordResetRequests",
  normalizeEmail_: authRouteSandbox.normalizeEmail_,
  normalizeIsraeliPhone: authRouteSandbox.normalizeIsraeliPhone,
  isValidEmail_: authRouteSandbox.isValidEmail_,
  cleanSheetValue_: value => String(value || "").trim(),
  firestoreDocumentToJs_: document => document.decoded || {},
  ScriptApp: { getOAuthToken: () => "test-token" },
  UrlFetchApp: {
    fetchAll(requests) {
      capturedAuthFetchRequests = requests;
      return authPrefetchPayloads.map(payload => ({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify(payload)
      }));
    }
  }
};
vm.createContext(authPrefetchSandbox);
vm.runInContext(
  extractAppsScriptFunction(webEndpointsSource, "getPublicEmailAuthState_"),
  authPrefetchSandbox
);
const prefetchedAuthState =
  authPrefetchSandbox.getPublicEmailAuthState_("ACTIVE@EXAMPLE.COM");
assert.strictEqual(capturedAuthFetchRequests.length, 3);
assert(capturedAuthFetchRequests.every(request => request.method === "get"));
assert.strictEqual(prefetchedAuthState.isAdminEmail, true);
assert.strictEqual(prefetchedAuthState.allowedUser.email, "active@example.com");
assert.strictEqual(prefetchedAuthState.allowedUser.phone, "+972541234567");
assert.strictEqual(prefetchedAuthState.passwordRecovery.status, "manager_ready");
assert.strictEqual(
  authRouteSandbox.getPublicEmailAuthRoute_(
    "reset-ready@example.com",
    {
      prefetched: true,
      allowedUser: { active: true },
      passwordRecovery: prefetchedAuthState.passwordRecovery
    }
  ),
  "PASSWORD_RESET_READY"
);

assert.match(
  appSource,
  /function requestPublicAuthRouteWithRetry_\([\s\S]*?maxWaitRetries = 3[\s\S]*?!== "WAIT"[\s\S]*?setTimeout\(resolve, 1200 \+ attempt \* 800\)/,
  "Transient WAIT auth routes must retry automatically"
);
assert.match(
  appSource,
  /function getEmailAuthRoutePromise_\([\s\S]*?requestPublicAuthRouteWithRetry_\(\s*"email"/,
  "Email routing must use the retrying auth helper"
);
assert.match(
  appSource,
  /async function continueFromEmailStep\([\s\S]*?canUseImmediatePasswordPath = options\.returning === true[\s\S]*?if \(canUseImmediatePasswordPath\) \{[\s\S]*?showAuthPasswordStep_\(email, "login"[\s\S]*?getEmailAuthRoutePromise_\(email, options\)/,
  "Remembered existing users must retain the immediate password fast path"
);
assert.match(
  appSource,
  /async function continueFromEmailStep\([\s\S]*?showAuthRoutingStep_\(\);[\s\S]*?await getEmailAuthRoutePromise_\(email, options\)[\s\S]*?applyResolvedEmailAuthRoute_/,
  "An identity unknown to the device must show the routing state while the router decides"
);
assert.match(
  appSource,
  /async function loginWithPassword\(\)[\s\S]*?signInWithEmailAndPassword\([\s\S]*?getEmailAuthRoutePromise_\(email/,
  "A normal password login must try Firebase first and consult routing only after failure"
);
assert.strictEqual(
  (appSource.match(/\bloginOrCreateWithPassword\s*\(/g) || []).length,
  1,
  "The legacy login-or-create helper must not be called by Login UX v2"
);
assert.match(
  appSource,
  /async function registerWithPassword\(\)[\s\S]*?authPurpose !== "register"[\s\S]*?authAccountSetupEmail !== email[\s\S]*?getEmailEntryEligibility_\(email\)[\s\S]*?if \(!eligibility\.allowed\)[\s\S]*?createUserWithEmailAndPassword\(/,
  "Firebase account creation must require a server-approved setup state and a fresh authorization check"
);
assert.match(
  appSource,
  /function handleBackgroundEmailAuthRoute_\([\s\S]*?flowToken !== authEmailFlowToken[\s\S]*?authActionInProgress[\s\S]*?auth\.currentUser/,
  "Stale router responses must not overwrite a newer or authenticated UI state"
);
assert.match(
  appSource,
  /function initAuthInputEnhancements_\(\)[\s\S]*?"emailInput"[\s\S]*?"confirmPasswordInput"[\s\S]*?event\.key !== "Enter"[\s\S]*?handlePrimaryAuthAction\(\)/,
  "Enter must submit the current logical login action"
);
assert.match(
  appSource,
  /async function handlePrimaryAuthAction\(\) \{[\s\S]*?if \(authActionInProgress\) return;[\s\S]*?authActionInProgress = true;[\s\S]*?applySelectedAuthPersistence\(\)[\s\S]*?finally \{[\s\S]*?authActionInProgress = false/,
  "Password submission must stay single-flight while persistence is confirmed"
);
assert.match(
  appSource,
  /const AUTH_ROUTE_TIMEOUT_MS = 20 \* 1000;/,
  "Authentication routing must continue to tolerate slow Apps Script starts"
);
assert.doesNotMatch(
  appSource,
  /AUTH_ROUTE_SLOW_NOTICE_MS|בודק את מסלול הכניסה|הבדיקה לוקחת מעט יותר מהרגיל\. ממשיכים לבדוק/,
  "The routing transition must not show technical loading copy or a delayed slow notice"
);
assert.match(
  appSource,
  /continueFromPhoneStep\([\s\S]*?submitAuthRouterForm_\([\s\S]*?"registerAccess"[\s\S]*?PROVISIONAL_SETUP_READY/,
  "Unknown-email phone submission must use the centralized registration endpoint"
);
assert.match(
  appSource,
  /createUserWithEmailAndPassword\([\s\S]*?finalizeProvisionalAccess[\s\S]*?PROVISIONAL_READY/,
  "Provisional authorization must be finalized only after Firebase account creation"
);
assert.match(
  read("WebEndpoints.gs"),
  /registerAccessFromWeb_\([\s\S]*?deferProvisionalGrant: true[\s\S]*?finalizeProvisionalAccessFromWeb_\([\s\S]*?verifyFirebaseUserIdToken_/,
  "Anonymous registration must only preflight; final authorization must require a Firebase identity"
);
assert.match(
  indexSource,
  /id="authRegistrationDetailsStep"[\s\S]*?id="registrationFirstName"[\s\S]*?id="registrationLastName"[\s\S]*?id="registrationTitlePrefix"[\s\S]*?id="registrationRole"[\s\S]*?id="registrationRoleOther"[\s\S]*?id="registrationDepartment"[\s\S]*?id="registrationDepartmentOther"/,
  "Unknown contacts must receive an in-app registration-details step"
);
assert.doesNotMatch(
  indexSource,
  /id="registration(?:FirstName|LastName|Role|Department)"[^>]*(?:^|\s)required(?:\s|=|>)/m,
  "Hidden registration fields must not block earlier auth form stages with native required validation"
);
assert.match(
  appSource,
  /function populateRegistrationSelect_\(/,
  "Registration must populate role and department choices returned by the server"
);
assert.match(
  appSource,
  /showAuthRegistrationDetailsStep_\([\s\S]*?result\.registrationOptions/,
  "Registration must use the canonical options returned by the server"
);
assert.match(
  appSource,
  /registrationRoleOther[\s\S]*?registrationDepartmentOther/,
  "Registration must offer an Other fallback for role and department"
);
assert.match(
  appSource,
  /route === "DETAILS_REQUIRED"[\s\S]*?showAuthRegistrationDetailsStep_/,
  "The app must route unknown contacts to the in-app details step"
);
assert.match(
  appSource,
  /async function submitRegistrationDetails_\(\)[\s\S]*?submitAuthRouterForm_\([\s\S]*?"submitRegistrationDetails"/,
  "The app must submit unknown-contact details without redirecting to Forms"
);
assert.match(
  read("WebEndpoints.gs"),
  /submitAccessRegistrationDetailsFromWeb_\([\s\S]*?!firstName \|\| !lastName[\s\S]*?roleMode[\s\S]*?departmentMode[\s\S]*?submitUnknownDetails: true/,
  "The server must require names and validate role/department selections before queuing an unknown-contact request"
);
assert.match(
  read("FormAccess.gs"),
  /submitUnknownDetails === true && matchingContact[\s\S]*?RETRY_PHONE_CHECK/,
  "An anonymous details submission must never grant access if the contact state changed"
);
assert.match(
  read("FormAccess.gs"),
  /function processAccessRegistration_\([\s\S]*?getAccessReviewReason_\([\s\S]*?upsertAllowedUserPairAtomically_/,
  "App and legacy Form registration must share one authoritative processor"
);
assert.match(
  read("FirestoreData.gs"),
  /provisionalApproval[\s\S]*?accessLevel = \{ stringValue: "provisional" \}[\s\S]*?"verificationRequests"/,
  "Provisional permission and its approval request must be committed together"
);
assert.match(
  rulesSource,
  /accessReviewStatus == "pending"[\s\S]*?accessLevel == "provisional"[\s\S]*?provisionalActivatedAt \+ duration\.value\(24, 'h'\) > request\.time[\s\S]*?hasVerifiedEmail/,
  "Firestore rules must limit provisional access to 24 hours after verified email or manager approval"
);
assert.match(
  appSource,
  /function permissionHasProvisionalAccess_\([\s\S]*?emailVerified[\s\S]*?PROVISIONAL_ACCESS_DURATION_MS/,
  "The client must enforce the same verified 24-hour provisional window"
);
assert.match(
  appSource,
  /hasProvisionalAccess = permissionHasProvisionalAccess_[\s\S]*?user\.getIdToken\(true\)/,
  "Verified provisional entry must refresh the Firebase token before Firestore reads"
);
assert.match(
  read("WebEndpoints.gs"),
  /allowedUser\.accessLevel === "provisional"[\s\S]*?identity\.emailVerified !== true[\s\S]*?provisionalActivatedAt[\s\S]*?provisional_access_activated[\s\S]*?approvedUntil/,
  "Verified email must start, rather than merely consume, the 24-hour provisional window"
);
assert.match(
  read("FormAccess.gs"),
  /function canonicalizeRegistrationRole_\([\s\S]*?return "מנהל\/ת"[\s\S]*?function getRegistrationFieldOptions_\([\s\S]*?preferredRoles[\s\S]*?excludedDepartmentKeys[\s\S]*?\.slice\(0, 18\)/,
  "Registration must present a curated set of common canonical roles and departments"
);
assert.match(
  appSource,
  /function downloadAllContacts\(\)[\s\S]*?isCurrentUserProvisional_\(\)/,
  "Bulk Download All must be blocked for provisional users"
);
assert.match(
  appSource,
  /function downloadRecentContacts\(\)[\s\S]*?isCurrentUserProvisional_\(\)/,
  "Bulk Download New must be blocked for provisional users"
);
assert.match(
  read("AppUsersMirror.gs"),
  /const APP_USERS_SHEET_NAME = "app_users";[\s\S]*?function syncAppUsersMirrorFromFirestore\(\)/,
  "The operational app_users mirror must provide reconciliation"
);
assert.match(
  read("FirestoreData.gs"),
  /getActiveManagerSupportContact_\([\s\S]*?a\.email === CONTACT_MANAGER_EMAIL[\s\S]*?whatsappUrl: "https:\/\/wa\.me\/"/,
  "Approval WhatsApp must prefer the configured contact manager"
);
const authRoutingMarkup = indexSource.match(
  /<div id="authRoutingStep"[\s\S]*?(?=\n\s*<div id="authNoticeStep")/
);
assert(authRoutingMarkup, "The login must include a dedicated routing transition state");
assert.match(
  authRoutingMarkup[0],
  /<img class="authRoutingLogo" src="app-logo\.png\?v=20260722-v16"/,
  "The routing transition must reuse the existing Contacts App logo"
);
assert.match(
  authRoutingMarkup[0],
  /class="authRoutingLabel">טעינה<[\s\S]*?class="authRoutingDots"[\s\S]*?<span><\/span><span><\/span><span><\/span>/,
  "The routing transition must show only the compact loading label and three CSS dots"
);
assert.doesNotMatch(
  authRoutingMarkup[0],
  /בודק|מאמת|מחפש|שרת|Apps Script|spinner|progress/i,
  "The routing transition must not expose technical routing explanations"
);
assert.match(
  stylesSource,
  /#login \.authRoutingStep \{[\s\S]*?min-height: 178px;[\s\S]*?#login \.authRoutingLogo \{[\s\S]*?width: 96px;[\s\S]*?#login \.authRoutingDots span \{[\s\S]*?animation: authRoutingDot 1\.2s/,
  "The routing transition must be compact, centered, and use a subtle three-dot animation"
);
assert.match(
  stylesSource,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?#login \.authRoutingDots span \{[\s\S]*?animation: none !important/,
  "The routing dots must respect reduced-motion preferences"
);
assert.match(
  appSource,
  /function showAuthRoutingStep_\(\) \{[\s\S]*?authStage = "routing";[\s\S]*?updateAuthProgress_\(""\);[\s\S]*?setLoginStatus\("", ""\);/,
  "The routing transition must hide progress and status copy"
);
assert.match(
  appSource,
  /async function loginWithPassword\(\)[\s\S]*?showAuthRoutingStep_\(\);[\s\S]*?getEmailAuthRoutePromise_\(email/,
  "A failed password sign-in must use the branded transition while routing resolves"
);
assert.match(
  appSource,
  /async function continueFromPhoneStep\(\)[\s\S]*?showAuthRoutingStep_\(\);[\s\S]*?submitAuthRouterForm_\([\s\S]*?"registerAccess"/,
  "Phone registration must use the branded transition while the central processor resolves"
);
assert.match(
  appSource,
  /publicErrorMessage && !publicErrorMessage\.startsWith\("AUTH_ROUTE_"\)[\s\S]*?בדיקת מספר הטלפון נכשלה זמנית/,
  "Router timeout codes must not be exposed to users"
);
assert.match(
  appSource,
  /async function handlePrimaryAuthAction\(\) \{[\s\S]*?if \(authStage === "routing"\) return;/,
  "The routing transition must ignore duplicate form submissions"
);
assert.doesNotMatch(
  indexSource,
  /כבר נכנסתי בעבר|זו הכניסה הראשונה שלי|שלב\s+\d+\s+מתוך/,
  "Login UX v2 must not ask users to classify their technical account state"
);
assert.match(
  emailUpdateLogicSource,
  /getAuthFlowDocument_\("verificationRequests", normalizedEmail\)[\s\S]*?requestType: \{ stringValue: "access_review" \}[\s\S]*?status: \{ stringValue: ACCESS_REVIEW_STATUS_PENDING \}[\s\S]*?commitFirestoreWrites_\(\[[\s\S]*?accessReviewWrite/,
  "New email permissions must atomically create a manager review request"
);
assert.match(
  appSource,
  /function getEffectiveVerificationRequestForUser_\([\s\S]*?synthetic: true/,
  "Admin UI must recover legacy pending users without a review document"
);
assert.match(
  appSource,
  /async function approveManualAccess_\([\s\S]*?if \(hasActionableRequest && !request\.synthetic\) \{[\s\S]*?verificationRequests/,
  "Approving a synthetic legacy review must not attempt a forbidden request create"
);
assert.match(
  webEndpointsSource,
  /ACCESS_REVIEW_STATUS_REJECTED[\s\S]*?ACCESS_REVIEW_STATUS_REVOKED[\s\S]*?if \(identity\.emailVerified === true\)/,
  "A manager block must take precedence over verified-email activation"
);
assert.match(
  emailUpdateLogicSource,
  /function rollbackMatchedEmailCells_\([\s\S]*?normalizeEmail_\(cell\.getDisplayValue\(\)\)[\s\S]*?cell\.setValue/,
  "Email replacement must provide a conflict-safe Sheets rollback"
);
assert.match(
  webEndpointsSource,
  /function resetUserLoginFromWeb_\([\s\S]*?allowedUsers[\s\S]*?ALLOWED_PHONES_COLLECTION_NAME[\s\S]*?verificationRequests[\s\S]*?PASSWORD_RECOVERY_REQUEST_COLLECTION[\s\S]*?deleteFirebaseUserAdmin_[\s\S]*?clearRecentSubmissionRecordsForUser_/,
  "A full login reset must clear auth state while preserving the contact directory"
);
assert.match(
  appSource,
  /function showAccessActivationRetryState_\([\s\S]*?החשבון נשאר מחובר/,
  "A transient post-verification activation failure must not sign the user out"
);
assert.match(
  appSource,
  /access_auto_granted: "הרשאת כניסה נוצרה וממתינה לבדיקה"/,
  "Pending permissions must not be described as approved"
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
assert.match(
  indexSource,
  /id="login"[^>]*style="display:none;"/,
  "The login card must remain hidden until Firebase session restoration finishes"
);
assert.match(
  appSource,
  /const savedEmail = getSavedLoginEmail_\(\)[\s\S]*?pendingEmail \|\| savedEmail[\s\S]*?if \(initialUser\) \{[\s\S]*?handleAuthenticatedUser\(initialUser\)[\s\S]*?continueFromEmailStep\(\{[\s\S]*?returning: isReturningEmail/,
  "Initialization must bypass login for a valid session and reuse remembered email otherwise"
);
assert.match(
  appSource,
  /function forgetRememberedLoginIdentity_\(\)[\s\S]*?clearSavedLoginEmail_\(\)[\s\S]*?clearPendingAuthEmail_\(\)[\s\S]*?showAuthEmailStep_\(\{ forceEmailEntry: true \}\)/,
  "The not-me action must clear only remembered login identity"
);
const duplicateIds = [...indexSource.matchAll(/\bid="([^"]+)"/g)]
  .map(match => match[1])
  .filter((id, index, ids) => ids.indexOf(id) !== index);
assert.deepStrictEqual(
  duplicateIds,
  [],
  `index.html contains duplicate IDs: ${duplicateIds.join(", ")}`
);
const localImageSources = [
  ...indexSource.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)
].map(match => match[1].split("?")[0]);
localImageSources.forEach(source => {
  assert(
    fs.existsSync(path.join(root, source)),
    `Missing local image referenced by index.html: ${source}`
  );
});
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

  const parametersStart = source.indexOf("(", start);
  let parameterDepth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0) {
      parametersEnd = index;
      break;
    }
  }
  const bodyStart = source.indexOf("{", parametersEnd + 1);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error(`Could not extract complete function: ${functionName}`);
};

const createTestClassList = () => {
  const values = new Set();
  return {
    toggle(name, force) {
      if (force) values.add(name);
      else values.delete(name);
    },
    contains(name) {
      return values.has(name);
    }
  };
};
const authPasswordToggle = { textContent: "", setAttribute() {} };
const authConfirmToggle = { textContent: "", setAttribute() {} };
const authPasswordElements = {
  loginTitle: { textContent: "" },
  authModeDescription: { textContent: "" },
  loginButton: {
    textContent: "",
    disabled: false,
    dataset: {},
    classList: createTestClassList(),
    setAttribute() {}
  },
  passwordInput: {
    autocomplete: "",
    disabled: false,
    type: "password",
    value: "temporary",
    setAttribute(name, value) { this[name] = value; }
  },
  confirmPasswordGroup: { style: { display: "" } },
  confirmPasswordInput: {
    autocomplete: "",
    type: "password",
    value: "",
    setAttribute() {}
  },
  authModeNote: { style: { display: "" }, textContent: "" },
  authPasswordEntry: { style: { display: "" } },
  passwordRecoveryOptions: { style: { display: "" } },
  authPasswordSecondaryActions: { style: { display: "" } }
};
const authPasswordSandbox = {
  authPurpose: "login",
  authMode: "login",
  authReturningUser: false,
  document: {
    getElementById: id => authPasswordElements[id] || null,
    querySelectorAll: selector =>
      selector === ".passwordToggle"
        ? [authPasswordToggle, authConfirmToggle]
        : []
  }
  ,
  setLoginStatus() {}
};
vm.createContext(authPasswordSandbox);
vm.runInContext(
  [
    extractCompleteFunction(appSource, "setLoginButtonLabel_"),
    extractCompleteFunction(appSource, "setLoginButtonBusy_"),
    extractCompleteFunction(appSource, "setAuthMode")
  ].join("\n"),
  authPasswordSandbox
);

authPasswordSandbox.setAuthMode("login");
assert.strictEqual(authPasswordElements.loginTitle.textContent, "כניסה לחשבון");
assert.strictEqual(authPasswordElements.loginButton.textContent, "כניסה");
assert.strictEqual(authPasswordElements.passwordInput.autocomplete, "current-password");
assert.strictEqual(authPasswordElements.confirmPasswordGroup.style.display, "none");
assert.strictEqual(authPasswordElements.authPasswordSecondaryActions.style.display, "flex");

authPasswordSandbox.authReturningUser = true;
authPasswordSandbox.setAuthMode("login");
assert.strictEqual(authPasswordElements.loginTitle.textContent, "ברוך שובך");

authPasswordSandbox.setAuthMode("register");
assert.strictEqual(authPasswordElements.loginTitle.textContent, "כמעט סיימנו");
assert.strictEqual(
  authPasswordElements.confirmPasswordGroup.style.display,
  "block"
);
assert.strictEqual(
  authPasswordElements.loginButton.textContent,
  "המשך"
);
assert.strictEqual(
  authPasswordElements.authPasswordSecondaryActions.style.display,
  "none"
);

authPasswordSandbox.setAuthMode("guided");
assert.strictEqual(
  authPasswordElements.loginButton.textContent,
  "כניסה",
  "Unknown legacy mode values must degrade safely to normal login"
);

const phoneFormatSandbox = {};
vm.createContext(phoneFormatSandbox);
vm.runInContext(
  extractCompleteFunction(appSource, "formatIsraeliPhoneInput_"),
  phoneFormatSandbox
);
assert.strictEqual(
  phoneFormatSandbox.formatIsraeliPhoneInput_("0501234567"),
  "050 123 4567"
);
assert.strictEqual(
  phoneFormatSandbox.formatIsraeliPhoneInput_("+972501234567"),
  "050 123 4567"
);

const authRouteTransitionCalls = [];
const authRouteTransitionSandbox = {
  authEmailFlowToken: 7,
  auth: null,
  authRouteIsAdmin: false,
  authAccountSetupEmail: "",
  authMode: "login",
  authStage: "password",
  authReturningUser: false,
  normalizeEmail: value => String(value || "").trim().toLowerCase(),
  getCurrentAuthEmail_: () => "person@example.com",
  showAuthPhoneStep_: (...args) =>
    authRouteTransitionCalls.push(["phone", ...args]),
  showAuthNotice_: (...args) =>
    authRouteTransitionCalls.push(["notice", ...args]),
  showAuthPasswordStep_: (...args) =>
    authRouteTransitionCalls.push(["password", ...args]),
  setLoginStatus: (...args) =>
    authRouteTransitionCalls.push(["status", ...args]),
  document: {
    getElementById: () => ({ focus() {} })
  }
};
vm.createContext(authRouteTransitionSandbox);
vm.runInContext(
  extractCompleteFunction(appSource, "applyResolvedEmailAuthRoute_"),
  authRouteTransitionSandbox
);
assert.strictEqual(
  authRouteTransitionSandbox.applyResolvedEmailAuthRoute_(
    "person@example.com",
    { route: "PASSWORD_SETUP" },
    { flowToken: 6 }
  ),
  false,
  "A stale router result must be ignored"
);
assert.strictEqual(authRouteTransitionCalls.length, 0);
assert.strictEqual(
  authRouteTransitionSandbox.applyResolvedEmailAuthRoute_(
    "person@example.com",
    { route: "PASSWORD_SETUP" },
    { flowToken: 7 }
  ),
  true
);
assert.strictEqual(
  authRouteTransitionSandbox.authAccountSetupEmail,
  "person@example.com"
);
assert.strictEqual(authRouteTransitionCalls[0][0], "password");
assert.strictEqual(authRouteTransitionCalls[0][2], "register");

authRouteTransitionCalls.length = 0;
authRouteTransitionSandbox.applyResolvedEmailAuthRoute_(
  "person@example.com",
  { route: "PASSWORD_RESET_READY" },
  { flowToken: 7 }
);
assert.deepStrictEqual(
  authRouteTransitionCalls[0].slice(0, 3),
  ["phone", "person@example.com", "password_reset"]
);

authRouteTransitionCalls.length = 0;
authRouteTransitionSandbox.applyResolvedEmailAuthRoute_(
  "person@example.com",
  { route: "ASK_PHONE" },
  { flowToken: 7 }
);
assert.strictEqual(authRouteTransitionCalls[0][0], "phone");

authRouteTransitionCalls.length = 0;
authRouteTransitionSandbox.applyResolvedEmailAuthRoute_(
  "person@example.com",
  { route: "BLOCKED" },
  { flowToken: 7 }
);
assert.strictEqual(authRouteTransitionCalls[0][0], "notice");

authRouteTransitionCalls.length = 0;
authRouteTransitionSandbox.applyResolvedEmailAuthRoute_(
  "person@example.com",
  { route: "PASSWORD" },
  { flowToken: 7, afterPasswordFailure: true }
);
assert.strictEqual(authRouteTransitionCalls[0][0], "status");

authRouteTransitionCalls.length = 0;
authRouteTransitionSandbox.authStage = "routing";
authRouteTransitionSandbox.applyResolvedEmailAuthRoute_(
  "person@example.com",
  { route: "PASSWORD" },
  { flowToken: 7, afterPasswordFailure: true }
);
assert.strictEqual(authRouteTransitionCalls[0][0], "password");
assert.strictEqual(authRouteTransitionCalls[1][0], "status");

authRouteTransitionCalls.length = 0;
authRouteTransitionSandbox.auth = { currentUser: { uid: "signed-in" } };
assert.strictEqual(
  authRouteTransitionSandbox.applyResolvedEmailAuthRoute_(
    "person@example.com",
    { route: "BLOCKED" },
    { flowToken: 7 }
  ),
  false,
  "A late router response must never replace a successful Firebase login"
);
assert.strictEqual(authRouteTransitionCalls.length, 0);

const continueEmailCalls = [];
const continueEmailSandbox = {
  authEmailFlowToken: 0,
  authStage: "email",
  document: {
    getElementById: id => id === "emailInput"
      ? { value: "person@example.com" }
      : null
  },
  console,
  normalizeEmail: value => String(value || "").trim().toLowerCase(),
  isValidEmail: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  setLoginStatus: (...args) => continueEmailCalls.push(["status", ...args]),
  rememberPendingAuthEmail_: email =>
    continueEmailCalls.push(["remember", email]),
  invalidateEmailAuthFlow_() {
    this.authEmailFlowToken += 1;
  },
  showAuthPasswordStep_: (...args) => {
    continueEmailSandbox.authStage = "password";
    continueEmailCalls.push(["password", ...args]);
  },
  showAuthRoutingStep_: () => {
    continueEmailSandbox.authStage = "routing";
    continueEmailCalls.push(["routing"]);
  },
  getEmailAuthRoutePromise_: async () => ({ route: "ASK_PHONE" }),
  handleBackgroundEmailAuthRoute_: (...args) =>
    continueEmailCalls.push(["background", ...args]),
  applyResolvedEmailAuthRoute_: (...args) => {
    continueEmailSandbox.authStage = "phone";
    continueEmailCalls.push(["resolved", ...args]);
    return true;
  }
};
vm.createContext(continueEmailSandbox);
vm.runInContext(
  "async " + extractCompleteFunction(appSource, "continueFromEmailStep"),
  continueEmailSandbox
);
const continueEmailTestPromise = (async () => {
  await continueEmailSandbox.continueFromEmailStep({ returning: true });
  await Promise.resolve();
  assert.strictEqual(continueEmailCalls[1][0], "password");
  assert.strictEqual(
    continueEmailCalls.some(call => call[0] === "routing"),
    false,
    "A remembered user must not be delayed by the router loader"
  );

  continueEmailCalls.length = 0;
  continueEmailSandbox.authStage = "email";
  await continueEmailSandbox.continueFromEmailStep({ returning: false });
  assert.deepStrictEqual(
    continueEmailCalls.map(call => call[0]).slice(0, 3),
    ["remember", "routing", "resolved"],
    "An identity unknown to the device must show the loader before router resolution"
  );
  assert.strictEqual(continueEmailSandbox.authStage, "phone");
})();

const homeDashboardSandbox = {
  selectionMode: false,
  activeQuickFilter: "all",
  directoryBrowseActivated: false,
  isSearchActive: () => false
};
vm.createContext(homeDashboardSandbox);
vm.runInContext(
  extractCompleteFunction(appSource, "shouldShowHomeDashboard_"),
  homeDashboardSandbox
);
assert.strictEqual(homeDashboardSandbox.shouldShowHomeDashboard_(), true);
homeDashboardSandbox.directoryBrowseActivated = true;
assert.strictEqual(homeDashboardSandbox.shouldShowHomeDashboard_(), false);
homeDashboardSandbox.directoryBrowseActivated = false;
homeDashboardSandbox.activeQuickFilter = "vpn";
assert.strictEqual(homeDashboardSandbox.shouldShowHomeDashboard_(), false);

assert.doesNotMatch(
  indexSource,
  /id="directoryToolsMenuBtn"|>כלים<\/span>/,
  "The vague standalone tools entry must be removed"
);
assert.match(
  indexSource,
  /id="homeDashboard"[\s\S]*?כלים שימושיים[\s\S]*?id="suggestContactBtn"[\s\S]*?id="importAllBtn"[\s\S]*?id="recentContactsBtn"[\s\S]*?id="homeProfileBtn"/,
  "The home dashboard must expose the focused useful tools with clear labels"
);
assert.doesNotMatch(
  indexSource,
  /id="homeSelectionModeBtn"|id="homeAdminToolBtn"/,
  "Admin and multi-selection must not be duplicated in Useful Tools"
);
assert.match(
  indexSource,
  /id="suggestContactBtn"[\s\S]*?>הוספת איש קשר למאגר</,
  "Adding a person to the directory must remain distinct from downloading an existing contact"
);
assert.match(
  indexSource,
  /id="accountMenu"[\s\S]*?id="myProfileBtn"[\s\S]*?id="adminOpenBtn"[\s\S]*?logout\(\)/,
  "Profile editing, admin access, and logout must remain in the account menu"
);
assert.match(
  indexSource,
  /id="monthlyInternsQuickEntry"[\s\S]*?סטאז׳רים החודש[\s\S]*?id="monthlyInternsView"[\s\S]*?id="monthlyInternsTitle"[\s\S]*?id="monthlyInternsMonthLabel"[\s\S]*?id="monthlyInternsSearchInput"[\s\S]*?id="monthlyInternsSearchClear"[\s\S]*?id="monthlyInternsStatus"[\s\S]*?id="monthlyInternsList"/,
  "Quick Access must open the current-month interns list in a dedicated app view"
);
assert.doesNotMatch(
  indexSource,
  /id="monthlyInternsSheet"|class="[^"]*monthlyInternsSheet/,
  "The interns directory must not use a bottom sheet"
);
assert.doesNotMatch(
  indexSource.match(/id="homeDashboard"[\s\S]*?<!-- PROTECTED_EASTER_EGG_START -->/)?.[0] || "",
  /id="monthlyInternsList"/,
  "Intern rows must not be displayed directly on Home"
);
assert.match(
  codeSource,
  /const MONTHLY_INTERNS_SHEET_PREFIX = "interns_";[\s\S]*?const MONTHLY_INTERNS_TIME_ZONE = "Asia\/Jerusalem";/,
  "Monthly intern sheets must use the documented interns_YYYY_MM convention in Israel time"
);
assert.match(
  directorySyncSource,
  /function readCurrentMonthlyInternsSheet_\(\)[\s\S]*?columnIndex\("phone"\)[\s\S]*?columnIndex\("name"\)[\s\S]*?columnIndex\("role"\)[\s\S]*?columnIndex\("department"\)/,
  "The monthly interns sync must require only phone and support the documented optional fallback columns"
);
assert.match(
  directorySyncSource,
  /function syncCurrentMonthlyInternsToFirestore_\([\s\S]*?kind: "monthly_interns"[\s\S]*?buildDirectoryDocumentPatchRequest_\([\s\S]*?source\.sheetName/,
  "The monthly tab must be mirrored to the existing protected contactDirectory collection"
);
assert.match(
  directorySyncSource,
  /function processPendingDirectoryRebuildScheduled\(\)[\s\S]*?maybeSyncCurrentMonthlyInterns_\(\)/,
  "The existing scheduled sync must refresh monthly interns without new infrastructure"
);
assert.match(
  appSource,
  /function showAppForUser\(user\)[\s\S]*?renderCurrentSearchResults\(\);[\s\S]*?loadCurrentMonthInterns_\(\)\.catch/,
  "Interns loading must start only after the usable directory screen is rendered"
);
assert.match(
  appSource,
  /function renderMonthlyInterns_\([\s\S]*?אין כרגע רשימת סטאז׳רים פעילה[\s\S]*?ללא מחלקה[\s\S]*?localeCompare[\s\S]*?monthlyInternPhone[\s\S]*?monthlyInternActions[\s\S]*?tel:[\s\S]*?wa\.me[\s\S]*?monthlyInternDepartment/,
  "Interns must be grouped by department, Hebrew-sorted, and expose only direct call and WhatsApp actions"
);
assert.match(
  appSource,
  /function monthlyInternMatchesSearch_[\s\S]*?normalizeSearchText[\s\S]*?normalizePhone[\s\S]*?function handleMonthlyInternsSearch_[\s\S]*?renderMonthlyInterns_[\s\S]*?לא נמצאו סטאז׳רים[\s\S]*?נסה שם, מחלקה או מספר טלפון/,
  "Monthly interns search must filter locally by normalized text and phone with a clear empty state"
);
const monthlyInternSearchSandbox = {
  normalizeSearchText: value => String(value || "")
    .replace(/[״"'׳]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase(),
  normalizePhone: value => {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
    if (!digits.startsWith("972")) digits = `972${digits}`;
    return `+${digits}`;
  }
};
vm.createContext(monthlyInternSearchSandbox);
vm.runInContext(
  extractCompleteFunction(appSource, "monthlyInternMatchesSearch_"),
  monthlyInternSearchSandbox
);
const monthlyInternSearchEntry = {
  name: "Gal Cohen",
  phone: "050-123-4567",
  department: "ילדים א׳"
};
assert(monthlyInternSearchSandbox.monthlyInternMatchesSearch_(monthlyInternSearchEntry, "cohen"));
assert(monthlyInternSearchSandbox.monthlyInternMatchesSearch_(monthlyInternSearchEntry, "ילדים א"));
assert(monthlyInternSearchSandbox.monthlyInternMatchesSearch_(monthlyInternSearchEntry, "050"));
assert(!monthlyInternSearchSandbox.monthlyInternMatchesSearch_(monthlyInternSearchEntry, "כירורגיה"));
assert.doesNotMatch(
  extractCompleteFunction(appSource, "renderMonthlyInterns_"),
  /openContactDetail_|data-monthly-intern-contact-id|downloadActiveContact_|reportActiveContact_/,
  "Interns must remain a lightweight display-only list rather than normal directory contacts"
);
assert.match(
  extractCompleteFunction(appSource, "renderMonthlyInterns_"),
  /currentUserIsAdmin[\s\S]*?openMonthlyInternEditor_[\s\S]*?deleteMonthlyIntern_[\s\S]*?openMonthlyInternReport_/,
  "Only admins may see intern edit/delete actions while ordinary users receive the report action"
);
assert.match(
  appSource,
  /function createMonthlyInternId_[\s\S]*?function getMonthlyInternById_[\s\S]*?function updateActiveMonthlyInterns_[\s\S]*?function saveMonthlyInternChanges_[\s\S]*?function deleteMonthlyIntern_/,
  "Monthly interns must have stable identifiers and isolated admin edit/delete operations"
);
const monthlyInternMutationSource = appSource.slice(
  appSource.indexOf("function updateActiveMonthlyInterns_"),
  appSource.indexOf("async function loadCurrentMonthInterns_")
);
assert.doesNotMatch(
  monthlyInternMutationSource,
  /allowedUsers|allowedPhones|verificationRequests|createUser|contacts\//,
  "Editing or deleting an intern must not touch Contacts or access systems"
);
assert.match(
  appSource,
  /function openMonthlyInternReport_[\s\S]*?subjectType: "intern"[\s\S]*?internId[\s\S]*?internVersion[\s\S]*?internDepartment/,
  "Intern reports must retain stable identity, published version, and report-time details"
);
assert.match(
  appSource,
  /report\.subjectType === "intern"[\s\S]*?הסטאז׳ר כבר אינו מופיע ברשימה הפעילה[\s\S]*?עריכת הסטאז׳ר[\s\S]*?סימון כטופל ללא שינוי/,
  "Admin Inbox must support editing, resolving, and deleted-intern reports"
);
const monthlyInternsServerSource = directorySyncSource.slice(
  directorySyncSource.indexOf("function getCurrentMonthlyInternsDescriptor_"),
  directorySyncSource.indexOf("function queueDirectoryRebuild_")
);
assert.doesNotMatch(
  monthlyInternsServerSource,
  /allowedUsers|allowedPhones|createUser|Firebase Authentication/,
  "Monthly interns are display-only and must never create login access"
);
assert.match(
  rulesSource,
  /match \/monthlyInterns\/\{docId\} \{[\s\S]*?docId == "active" && isAllowed\(\)[\s\S]*?allow create, update: if isAdmin\(\)[\s\S]*?allow delete: if false/,
  "Only authenticated app users may read the active interns list and only admins may publish it"
);
assert.match(
  rulesSource,
  /match \/contactReports\/\{docId\} \{[\s\S]*?subjectType[\s\S]*?internId[\s\S]*?internVersion[\s\S]*?internDepartment[\s\S]*?allow read: if isAdmin\(\)/,
  "Authenticated users may submit structured intern reports while only admins may review them"
);

const monthlyDescriptorSandbox = {
  MONTHLY_INTERNS_DOCUMENT_PREFIX: "interns_",
  MONTHLY_INTERNS_TIME_ZONE: "Asia/Jerusalem"
};
vm.createContext(monthlyDescriptorSandbox);
vm.runInContext(
  extractCompleteFunction(appSource, "getCurrentMonthlyInternsDescriptor_"),
  monthlyDescriptorSandbox
);
const augustDescriptor = monthlyDescriptorSandbox.getCurrentMonthlyInternsDescriptor_(
  new Date("2026-08-13T09:00:00.000Z")
);
assert.strictEqual(augustDescriptor.key, "interns_2026_08");
assert.strictEqual(augustDescriptor.label, "אוגוסט 2026");

let monthlySheetFixture = null;
const monthlySheetSandbox = {
  MONTHLY_INTERNS_SHEET_PREFIX: "interns_",
  MONTHLY_INTERNS_TIME_ZONE: "Asia/Jerusalem",
  Utilities: {
    formatDate: () => "2026_08"
  },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getSheetByName: () => monthlySheetFixture
    })
  },
  cleanSheetValue_: value => String(value || "").trim(),
  normalizeIsraeliPhone: value => {
    let digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
    else if (!digits.startsWith("972")) digits = `972${digits}`;
    return `+${digits}`;
  }
};
vm.createContext(monthlySheetSandbox);
vm.runInContext(
  [
    extractCompleteFunction(directorySyncSource, "getCurrentMonthlyInternsDescriptor_"),
    extractCompleteFunction(directorySyncSource, "readCurrentMonthlyInternsSheet_")
  ].join("\n"),
  monthlySheetSandbox
);
assert.strictEqual(
  monthlySheetSandbox.readCurrentMonthlyInternsSheet_().sourceSheetPresent,
  false,
  "A missing current-month tab must be treated as a normal empty state"
);
monthlySheetFixture = {
  getLastRow: () => 4,
  getLastColumn: () => 4,
  getRange: () => ({
    getDisplayValues: () => [
      ["phone", "name", "role", "department"],
      ["0501234567", "נועה כהן", "סטאז׳רית", "ילדים א׳"],
      ["0547654321", "דניאל לוי", "סטאז׳ר", "מיון"],
      ["0501234567", "נועה כהן", "סטאז׳רית", "ילדים ב׳"]
    ]
  })
};
const monthlySheetResult =
  monthlySheetSandbox.readCurrentMonthlyInternsSheet_();
assert.strictEqual(monthlySheetResult.sheetName, "interns_2026_08");
assert.strictEqual(monthlySheetResult.entries.length, 2);
assert.strictEqual(monthlySheetResult.entries[0].phone, "+972501234567");
assert.strictEqual(
  monthlySheetResult.entries[0].department,
  "ילדים ב׳",
  "Duplicate intern rows must resolve deterministically by normalized phone"
);

const importerFixture = internImporter.analyzeTables([
  {
    name: "נתונים",
    rows: [
      ["אוניברסיטה", "טלפון", "שם הסטאז׳ר", "שיבוץ"],
      ["תל אביב", "050-1234567", "נועה כהן", "ילדים א׳"],
      ["חיפה", 547654321, "דניאל לוי", "מיון"],
      ["תל אביב", "+972501234567", "נועה כהן", "ילדים א׳"]
    ]
  }
], {
  normalizePhone: value => {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
    else if (digits && !digits.startsWith("972")) digits = `972${digits}`;
    return digits ? `+${digits}` : "";
  },
  knownDepartments: ["ילדים א׳", "מיון"]
});
assert.strictEqual(importerFixture.status, "ready");
assert.strictEqual(importerFixture.mapping.phoneColumn, 1);
assert.strictEqual(importerFixture.mapping.nameColumn, 2);
assert.strictEqual(importerFixture.mapping.departmentColumn, 3);
assert.strictEqual(importerFixture.parsed.entries.length, 2);
assert.strictEqual(importerFixture.parsed.duplicates, 1);
assert.strictEqual(importerFixture.parsed.entries[1].phone, "+972547654321");
assert.strictEqual(
  internImporter.inferMonthYear("עותק של סטאזרים אוגוסט1 2026.xlsx", [], new Date("2025-01-01")),
  "2026-08",
  "The publication month should be inferred from a Hebrew filename"
);
const internPublishFunctionSource = extractCompleteFunction(
  appSource,
  "publishMonthlyInterns_"
);
assert.match(internPublishFunctionSource, /firebaseApi\.runTransaction/);
assert.match(internPublishFunctionSource, /MONTHLY_INTERNS_ACTIVE_DOCUMENT_ID/);
assert.match(internPublishFunctionSource, /MONTHLY_INTERNS_PREVIOUS_DOCUMENT_ID/);
assert.match(internPublishFunctionSource, /transaction\.set\(previousRef/);
assert.match(internPublishFunctionSource, /transaction\.set\(activeRef/);
const internPublicationSource = [
  extractCompleteFunction(appSource, "sanitizePublishedInternEntries_"),
  extractCompleteFunction(appSource, "publishMonthlyInterns_"),
  extractCompleteFunction(appSource, "rollbackMonthlyInterns_")
].join("\n");
assert.doesNotMatch(
  internPublicationSource,
  /allowedUsers|allowedPhones|createUser|verificationRequests|contactAddRequests|contacts\//,
  "Intern publication must never touch contacts, Firebase accounts, access data, or approval requests"
);

const directorySearchSandbox = {};
vm.createContext(directorySearchSandbox);
vm.runInContext(
  [
    extractCompleteFunction(appSource, "normalizePhone"),
    extractCompleteFunction(appSource, "formatPhoneForDisplay"),
    extractCompleteFunction(appSource, "getPhoneSearchValue"),
    extractCompleteFunction(appSource, "normalizeSearchText"),
    extractCompleteFunction(appSource, "buildContactSearchIndex_"),
    extractCompleteFunction(appSource, "getContactSearchIndex_"),
    extractCompleteFunction(appSource, "getSearchTokenPriority_"),
    extractCompleteFunction(appSource, "getSearchPriority")
  ].join("\n"),
  directorySearchSandbox
);

const indexedContact = {
  first: "ישראל",
  last: "כהן",
  firstEn: "Israel",
  lastEn: "Cohen",
  title: "ד״ר",
  role: "קרדיולוג",
  dept: "קרדיולוגיה ילדים",
  hospital: "שניידר",
  phone: "0501234567",
  email: "israel@example.com"
};
indexedContact._search = directorySearchSandbox.buildContactSearchIndex_(
  indexedContact
);
const metadataOnlyContact = {
  first: "דנה",
  last: "לוי",
  role: "רכזת כהן",
  dept: "שירות מטופלים",
  phone: "0507654321"
};
metadataOnlyContact._search = directorySearchSandbox.buildContactSearchIndex_(
  metadataOnlyContact
);
const priorityFor = (contact, query) =>
  directorySearchSandbox.getSearchPriority(
    contact,
    directorySearchSandbox.normalizeSearchText(query),
    String(query).replace(/\D/g, "")
  );

assert.strictEqual(priorityFor(indexedContact, "ישראל כהן"), 1);
assert.strictEqual(priorityFor(indexedContact, "ISRAEL COHEN"), 1);
assert.notStrictEqual(priorityFor(indexedContact, "קרדיולוג"), null);
assert.notStrictEqual(priorityFor(indexedContact, "קרדיולוגיה"), null);
assert.notStrictEqual(priorityFor(indexedContact, "כהן קרדיולוגיה"), null);
assert.notStrictEqual(priorityFor(indexedContact, "0501234567"), null);
assert(
  priorityFor(indexedContact, "כהן") <
    priorityFor(metadataOnlyContact, "כהן"),
  "A name match must rank above the same text in role metadata"
);
assert.strictEqual(priorityFor(indexedContact, "אונקולוגיה"), null);
assert.match(
  appSource,
  /function applyRawContacts_\([\s\S]*?_search: buildContactSearchIndex_\(contact\)/,
  "Every normalized contact must receive a precomputed in-memory search index"
);
assert.match(
  indexSource,
  /id="contactDetailSheet"[\s\S]*?id="contactDetailCall"[\s\S]*?id="contactDetailWhatsapp"[\s\S]*?id="contactDetailEmail"[\s\S]*?downloadActiveContact_\(\)[\s\S]*?reportActiveContact_\(\)/,
  "The contact detail sheet must preserve all secondary contact actions"
);
assert.match(
  indexSource,
  /id="departmentsFilterBtn"[\s\S]*?id="departmentSheet"[\s\S]*?id="departmentList"/,
  "A dynamic department browser must remain available from quick access"
);

const directoryFilterSandbox = {
  contacts: [
    { dept: "VPN", phone: "0501234567" },
    { dept: "VPN מכון דימות", phone: "039999991" },
    { dept: "מעבדת המטולוגיה", phone: "0507654321" },
    { dept: "טיפול נמרץ ילדים", phone: "0501112233" },
    { dept: "טיפול נמרץ ילדים", phone: "0502223344" },
    { dept: "", phone: "0503334455" }
  ]
};
vm.createContext(directoryFilterSandbox);
vm.runInContext(
  [
    extractCompleteFunction(appSource, "normalizePhone"),
    extractCompleteFunction(appSource, "formatPhoneForDisplay"),
    extractCompleteFunction(appSource, "normalizeSearchText"),
    extractCompleteFunction(appSource, "getLocalPhoneDigits"),
    extractCompleteFunction(appSource, "isMobilePhone"),
    extractCompleteFunction(appSource, "isInstituteLandline"),
    extractCompleteFunction(appSource, "contactMatchesQuickFilter"),
    extractCompleteFunction(appSource, "getDepartmentOptions_")
  ].join("\n"),
  directoryFilterSandbox
);

assert.strictEqual(
  directoryFilterSandbox.contacts.filter(contact =>
    directoryFilterSandbox.contactMatchesQuickFilter(contact, "vpn")
  ).length,
  1,
  "The VPN quick filter must retain its existing mobile-phone semantics"
);
assert.strictEqual(
  directoryFilterSandbox.contacts.filter(contact =>
    directoryFilterSandbox.contactMatchesQuickFilter(contact, "institutes")
  ).length,
  1,
  "The institutes quick filter must retain its existing landline semantics"
);
assert.strictEqual(
  directoryFilterSandbox.contacts.filter(contact =>
    directoryFilterSandbox.contactMatchesQuickFilter(contact, "labs")
  ).length,
  1,
  "The laboratories quick filter must retain its existing department semantics"
);
assert.strictEqual(
  directoryFilterSandbox.contacts.filter(contact =>
    directoryFilterSandbox.contactMatchesQuickFilter(contact, "all")
  ).length,
  directoryFilterSandbox.contacts.length,
  "The explicit all-contacts filter must display the full directory"
);
assert.strictEqual(
  directoryFilterSandbox.getDepartmentOptions_().length,
  4,
  "The department browser must deduplicate departments and ignore empty values"
);
assert.strictEqual(
  directoryFilterSandbox.contacts.filter(contact =>
    directoryFilterSandbox.contactMatchesQuickFilter(
      contact,
      "department:טיפול נמרץ ילדים"
    )
  ).length,
  2,
  "An exact dynamic department filter must include every contact in that department"
);
assert.match(
  appSource,
  /function returnToHome_\(\)[\s\S]*?activeQuickFilter = "all";[\s\S]*?directoryBrowseActivated = false;[\s\S]*?searchInput\.value = "";[\s\S]*?renderCurrentSearchResults\(\)/,
  "Clearing a category must return to Home instead of rendering the full directory"
);
assert.match(
  appSource,
  /function updateQuickFilterButtons\(\)[\s\S]*?activeQuickFilter === filterName[\s\S]*?isDepartmentFilterActive_\(\)/,
  "Quick-filter visual state must derive from one exclusive active filter"
);
assert.doesNotMatch(indexSource, /id="allFilterBtn"/, "Quick Access must not show an All button");

const quickFilterSearchInput = { value: "כהן" };
const quickFilterStateSandbox = {
  activeQuickFilter: "all",
  directoryBrowseActivated: false,
  selectionMode: false,
  selectedContactIds: new Set(),
  document: { getElementById: id => id === "searchInput" ? quickFilterSearchInput : null },
  normalizeSearchText: value => String(value || "").trim().toLowerCase(),
  closeDepartmentBrowser_: () => {},
  updateQuickFilterButtons: () => {},
  renderCurrentSearchResults: () => {},
  openDepartmentBrowserCalls: 0,
  openDepartmentBrowser_() {
    this.openDepartmentBrowserCalls += 1;
  }
};
vm.createContext(quickFilterStateSandbox);
vm.runInContext(
  [
    extractCompleteFunction(appSource, "isDepartmentFilterActive_"),
    extractCompleteFunction(appSource, "toggleQuickFilter"),
    extractCompleteFunction(appSource, "returnToHome_"),
    extractCompleteFunction(appSource, "clearActiveDirectoryFilter_"),
    extractCompleteFunction(appSource, "handleDepartmentsFilterClick_"),
    extractCompleteFunction(appSource, "selectDepartmentFilter_")
  ].join("\n"),
  quickFilterStateSandbox
);
quickFilterStateSandbox.toggleQuickFilter("vpn");
assert.strictEqual(quickFilterStateSandbox.activeQuickFilter, "vpn");
quickFilterStateSandbox.toggleQuickFilter("institutes");
assert.strictEqual(quickFilterStateSandbox.activeQuickFilter, "institutes");
quickFilterStateSandbox.toggleQuickFilter("labs");
assert.strictEqual(quickFilterStateSandbox.activeQuickFilter, "labs");
quickFilterStateSandbox.toggleQuickFilter("labs");
assert.strictEqual(
  quickFilterStateSandbox.activeQuickFilter,
  "all",
  "Tapping an active non-all filter must clear the filter"
);
assert.strictEqual(quickFilterStateSandbox.directoryBrowseActivated, false, "Clearing a quick filter must restore Home");
assert.strictEqual(quickFilterStateSandbox.document.getElementById("searchInput").value, "", "Returning Home must not leave an active search results view");
quickFilterStateSandbox.document.getElementById("searchInput").value = "כהן";
quickFilterStateSandbox.selectDepartmentFilter_("טיפול נמרץ ילדים");
assert.strictEqual(
  quickFilterStateSandbox.activeQuickFilter,
  "department:טיפול נמרץ ילדים"
);
quickFilterStateSandbox.handleDepartmentsFilterClick_();
assert.strictEqual(
  quickFilterStateSandbox.activeQuickFilter,
  "all",
  "Tapping an active department context must clear the department"
);
assert.strictEqual(quickFilterStateSandbox.directoryBrowseActivated, false, "Clearing a department must restore Home");
assert.strictEqual(quickFilterStateSandbox.document.getElementById("searchInput").value, "", "Returning from a department must not show the full directory");

const quickFilterVisualElements = Object.fromEntries(
  [
    "vpnFilterBtn",
    "institutesFilterBtn",
    "labsFilterBtn",
    "departmentsFilterBtn"
  ].map(id => [
    id,
    {
      classList: createTestClassList(),
      setAttribute() {}
    }
  ])
);
quickFilterVisualElements.activeDirectoryFilter = { hidden: true };
quickFilterVisualElements.activeDirectoryFilterText = { textContent: "" };
const quickFilterVisualSandbox = {
  activeQuickFilter: "all",
  document: {
    getElementById: id => quickFilterVisualElements[id] || null
  },
  isDepartmentFilterActive_: () =>
    String(quickFilterVisualSandbox.activeQuickFilter).startsWith("department:"),
  getActiveDirectoryFilterLabel_: () => ""
};
vm.createContext(quickFilterVisualSandbox);
vm.runInContext(
  extractCompleteFunction(appSource, "updateQuickFilterButtons"),
  quickFilterVisualSandbox
);
const activeVisualFilterCount = () =>
  [
    "vpnFilterBtn",
    "institutesFilterBtn",
    "labsFilterBtn",
    "departmentsFilterBtn"
  ].filter(id => quickFilterVisualElements[id].classList.contains("active"))
    .length;
quickFilterVisualSandbox.updateQuickFilterButtons();
assert.strictEqual(activeVisualFilterCount(), 0);
quickFilterVisualSandbox.activeQuickFilter = "vpn";
quickFilterVisualSandbox.updateQuickFilterButtons();
assert.strictEqual(activeVisualFilterCount(), 1);
assert.strictEqual(
  quickFilterVisualElements.vpnFilterBtn.classList.contains("active"),
  true
);
quickFilterVisualSandbox.activeQuickFilter = "department:מיון";
quickFilterVisualSandbox.updateQuickFilterButtons();
assert.strictEqual(activeVisualFilterCount(), 1);
assert.strictEqual(
  quickFilterVisualElements.departmentsFilterBtn.classList.contains("active"),
  true
);

[
  "buildContactVCard",
  "downloadContact",
  "downloadSelectedContacts",
  "downloadAllContacts",
  "downloadRecentContacts",
  "openContactReportModal",
  "openContactAddModal_",
  "openMyProfileModal",
  "openAdminPanel",
  "logout"
].forEach(functionName => {
  assert.match(
    appSource,
    new RegExp(`\\bfunction\\s+${functionName}\\s*\\(`),
    `Main-screen redesign must preserve ${functionName}()`
  );
});
assert.match(
  appSource,
  /const rowAction = selectionMode[\s\S]*?openContactDetail_[\s\S]*?<button type="button" class="contactRowMain"[\s\S]*?class="contactIconAction call"[\s\S]*?class="contactIconAction whatsapp"/,
  "Contact rows must open details while call and WhatsApp remain separate explicit actions"
);

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
    { email: "orphan@example.com", phone: "+972502222222", active: false },
    {
      email: "missing-request@example.com",
      phone: "+972504444444",
      active: true,
      accessReviewRequired: true,
      accessReviewStatus: "pending",
      updatedAt: 45
    }
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
    extractCompleteFunction(
      appSource,
      "getEffectiveVerificationRequestForUser_"
    ),
    extractCompleteFunction(appSource, "getAdminAttentionItems_"),
    extractCompleteFunction(appSource, "getAdminPeople_")
  ].join("\n"),
  adminFocusSandbox
);

const focusedPeople = adminFocusSandbox.getAdminPeople_();
assert.strictEqual(
  focusedPeople.length,
  4,
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
  ["access", "access", "reset", "contact", "report"],
  "The attention queue must consolidate and sort every pending request type"
);
assert(
  attentionItems.some(
    item =>
      item.kind === "access" &&
      item.data.request.synthetic === true &&
      item.data.user.email === "missing-request@example.com"
  ),
  "Legacy pending users without a request document must remain actionable"
);

const systemRendererSource = extractCompleteFunction(
  appSource,
  "renderAdminSystem_"
);
assert.match(
  systemRendererSource,
  /אנשים השתמשו באפליקציה היום/,
  "The System view must show one clear daily-usage number"
);
assert.doesNotMatch(
  systemRendererSource,
  /%|14 הימים|השתמשו בפרטי איש קשר/,
  "The System view must not show percentages or detailed usage analytics"
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
  findAdminContactByPhone_: phone =>
    adminFocusSandbox.adminContacts.find(
      contact => String(contact.phone || "") === String(phone || "")
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
  formatActivityTimestamp: () => "עכשיו",
  adminMonthlyInternsActive: null,
  adminMonthlyInternsPrevious: null
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
    extractCompleteFunction(appSource, "getAdminIconSvg_"),
    extractCompleteFunction(appSource, "formatAdminRelativeTime_"),
    extractCompleteFunction(appSource, "getAdminAttentionRowPresentation_"),
    extractCompleteFunction(appSource, "renderAdminInboxRow_"),
    extractCompleteFunction(appSource, "renderAdminAttention_"),
    extractCompleteFunction(appSource, "adminPersonMatchesQuery_"),
    extractCompleteFunction(appSource, "renderAdminPeople_"),
    extractCompleteFunction(appSource, "renderAdminMoreActivityHtml_"),
    extractCompleteFunction(appSource, "renderAdminMoreManagersHtml_"),
    extractCompleteFunction(appSource, "formatMonthlyInternMonthLabel_"),
    extractCompleteFunction(appSource, "getPublishedInternCount_"),
    extractCompleteFunction(appSource, "renderAdminInternsSystemCard_"),
    extractCompleteFunction(appSource, "renderAdminSystem_")
  ].join("\n"),
  adminFocusSandbox
);

adminFocusSandbox.renderAdminAttention_();
assert.match(
  adminFocusElements.adminList.innerHTML,
  /בקשת אישור כניסה[\s\S]*?בקשת איפוס סיסמה[\s\S]*?בקשת הוספת איש קשר[\s\S]*?דיווח על/,
  "Every pending request type must render as a compact inbox row"
);

adminFocusSandbox.renderAdminPeople_();
assert.match(
  adminFocusElements.adminList.innerHTML,
  /adminPersonRow[\s\S]*?openAdminPerson_/,
  "Each person must open one consolidated management view"
);

adminFocusSandbox.renderAdminSystem_();
assert.match(
  adminFocusElements.adminList.innerHTML,
  />7<[\s\S]*?אנשים השתמשו באפליקציה היום[\s\S]*?סטאז׳רים החודש/,
  "The System view must render usage and monthly interns management"
);

const focusedAdminRenderSource = [
  "openAdminAttentionItem_",
  "openAdminPerson_",
  "renderAdminMoreManagersHtml_",
  "renderAdminSystem_"
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
  adminSystemTab: createAdminTabElement(),
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
  "שם, מחלקה, מייל או טלפון"
);

adminTabsSandbox.adminActiveTab = "system";
adminTabsSandbox.updateAdminTabs();
assert.strictEqual(
  adminTabElements.adminToolbar.style.display,
  "none",
  "The System tab must hide people/request search and filters"
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
assert.match(
  indexSource,
  /id="adminAttentionTab"[\s\S]*?>\s*לטיפול[\s\S]*?id="adminPeopleTab"[\s\S]*?>אנשים<[\s\S]*?id="adminSystemTab"[\s\S]*?>מערכת</,
  "Admin navigation must be organized as Attention, People, and System"
);
assert.doesNotMatch(indexSource, /id="adminSystemTab"[^>]*>עוד</);
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
  /class="adminInboxRow[\s\S]*?openAdminAttentionItem_/,
  "Pending work must render as a compact inbox that opens focused review"
);
assert.match(
  appSource,
  /<details class="adminAdvancedActions"/,
  "Destructive person actions must render in a separate advanced section"
);
assert.match(
  indexSource,
  /id="adminFocusSheet"[\s\S]*?id="adminFocusBody"[\s\S]*?id="adminConfirmModal"/,
  "Admin reviews and confirmations must use polished in-app surfaces"
);
assert.match(
  indexSource,
  /id="monthlyInternsAdminModal"[\s\S]*?id="monthlyInternsWorkbookInput"[^>]*accept="\.xlsx/,
  "System administration must expose a local Excel upload flow"
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
  /function deleteUserPermission\(email\)[\s\S]*?resetUserLogin[\s\S]*?contacts-auth-management/,
  "A full login reset must use the authenticated server action"
);
assert.doesNotMatch(
  appSource,
  /window\.prompt\(/,
  "Manager approval flows must not rely on native prompt dialogs"
);
assert.match(
  appSource,
  /permission\.accessReviewRequired\s*&&\s*!permissionHasProvisionalAccess_\(permission\)\s*&&\s*!permissionHasTemporaryAccess_\(permission\)/,
  "Temporary and provisional sessions must not wait for redundant server activation"
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
  "syncCurrentMonthlyInternsToFirestore",
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
  /function getPublicEmailAuthState_\(email\)[\s\S]*?collection: "admins"[\s\S]*?collection: "allowedUsers"[\s\S]*?collection: PASSWORD_RECOVERY_REQUEST_COLLECTION[\s\S]*?UrlFetchApp\.fetchAll\(/,
  "Independent email-auth Firestore reads must run in parallel"
);
assert.match(
  codeSource,
  /const PUBLIC_AUTH_ROUTE_CACHE_SECONDS = 10 \* 60;/,
  "Stable authentication routes must be cached for ten minutes"
);
assert.match(
  codeSource,
  /const PUBLIC_AUTH_ACCOUNT_ROUTING_CLIENT = "login-ux-v2";/,
  "Account-aware routing must be explicitly versioned for backward compatibility"
);
assert.match(
  appSource,
  /const AUTH_ROUTER_CLIENT = "login-ux-v2";[\s\S]*?client: AUTH_ROUTER_CLIENT/,
  "Login UX v2 must identify its account-aware router contract"
);
assert.match(
  webEndpointsSource,
  /function getPublicEmailAccountRoute_\([\s\S]*?findFirebaseUserByEmailAdmin_\(email\)[\s\S]*?return "PASSWORD_SETUP"/,
  "The router must distinguish authorized first-time users using Firebase Admin lookup"
);
assert.match(
  webEndpointsSource,
  /if \(!\["SYSTEM_ERROR", "WAIT", "PASSWORD_SETUP"\]\.includes\(route\)\) \{[\s\S]*?cache\.put/,
  "Transient no-account results must not be cached after account creation"
);
assert.match(
  webEndpointsSource,
  /\["EMAIL_NOT_FOUND", "USER_NOT_FOUND"\]\.includes\(apiMessage\)[\s\S]*?return null/,
  "Firebase Admin must treat an explicit missing-account response as a setup state"
);
assert.match(
  webEndpointsSource,
  /action === "invalidateAuthRouteCache"[\s\S]*?createAuthRouteCacheInvalidationPostResponse_\(e\)/,
  "Authenticated admin changes must be able to invalidate the public auth cache"
);
assert.match(
  appSource,
  /function invalidatePublicAuthRouteCacheFromAdmin_\(email\)[\s\S]*?getIdToken\(true\)[\s\S]*?"invalidateAuthRouteCache"[\s\S]*?"contacts-auth-cache-invalidation"/,
  "The admin client must invalidate cached routes after permission changes"
);

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
  /route === "PASSWORD_RESET_READY"[\s\S]*?showAuthPhoneStep_\(normalizedEmail,\s*"password_reset"\)/,
  "The next login after manager approval must open the password-reset identity step"
);
assert.match(
  appSource,
  /recovery\.managerPrepared === true[\s\S]*?"צור סיסמה חדשה"/,
  "A manager-prepared reset must clearly label the new-password step"
);
assert.match(
  indexSource,
  /id="authEmailStep"[\s\S]*?כניסה לספר אנשי הקשר[\s\S]*?id="emailInput"[\s\S]*?id="emailContinueBtn"/,
  "Unknown devices must start with one focused email action"
);
assert.match(
  indexSource,
  /id="authPasswordSecondaryActions"[\s\S]*?שכחתי סיסמה[\s\S]*?זה לא אני/,
  "The returning-user screen must keep recovery and identity change quiet"
);
assert.match(
  indexSource,
  /id="passwordRecoveryOptions"[\s\S]*?id="passwordResetBtn"[\s\S]*?id="passwordResetHelpBtn"[\s\S]*?showPasswordLoginOptions_\(\)/,
  "Password recovery capabilities must remain available through progressive disclosure"
);
assert.match(
  indexSource,
  /<details class="verificationHelpDisclosure">[\s\S]*?id="manualApprovalRequestBtn"[\s\S]*?id="managerWhatsappLink"/,
  "Email-verification admin approval and manager support must remain contextually available"
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

continueEmailTestPromise
  .then(() => console.log("static audit: OK"))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
