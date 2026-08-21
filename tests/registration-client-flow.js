const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (["\"", "'", "`"].includes(character)) quote = character;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

const calls = [];
const passwordElements = {
  passwordInput: { value: "Secret123" },
  confirmPasswordInput: { value: "Secret123" },
  registrationFirstName: { value: "ישראל" },
  registrationLastName: { value: "ישראלי" },
  registrationTitlePrefix: { value: "ד״ר" },
  registrationRole: { value: "מומחה/ית" },
  registrationRoleOther: { value: "" },
  registrationDepartment: { value: "ילדים א׳" },
  registrationDepartmentOther: { value: "" },
  registrationWebsite: { value: "" },
  registrationDetailsSubmitBtn: { disabled: false }
};
const createdUser = {
  email: "new@example.com",
  emailVerified: false,
  getIdToken: async force => {
    calls.push(["token", force]);
    return "verified-firebase-id-token";
  }
};
const sandbox = {
  console,
  firebaseApi: {
    createUserWithEmailAndPassword: async (_auth, email, password) => {
      calls.push(["create", email, password]);
      return { user: createdUser };
    },
    sendEmailVerification: async (user, options) => {
      calls.push(["verify", user.email, options.url]);
    },
    reload: async () => {}
  },
  auth: { currentUser: null, languageCode: "" },
  db: {},
  authPurpose: "register",
  authAccountSetupEmail: "new@example.com",
  provisionalRegistrationPhone: "+972501234567",
  authAccountSetupFallback: false,
  authRouteUnavailableEmail: "",
  authActionInProgress: false,
  pendingRegistrationEmail: "new@example.com",
  pendingRegistrationPhone: "0501234567",
  lastUnverifiedEmail: "",
  PASSWORD_AUTH_RETURN_URL: "https://example.invalid/return",
  document: {
    getElementById: id => passwordElements[id] || null
  },
  getAuthInputs: () => ({
    email: "new@example.com",
    password: "Secret123",
    confirmPassword: "Secret123"
  }),
  isValidEmail: () => true,
  normalizeEmail: value => String(value || "").trim().toLowerCase(),
  isValidPhoneForRouting_: () => true,
  ensureAuthEmailCooldownFinished: () => true,
  setLoginButtonBusy_: value => calls.push(["busy", value]),
  setLoginButtonDisabled: () => {},
  setLoginStatus: (message, type) => calls.push(["status", message, type]),
  getEmailEntryEligibility_: async () => ({ allowed: true }),
  submitAuthRouterForm_: async (action, payload, sourceName) => {
    calls.push(["router", action, payload, sourceName]);
    if (action === "finalizeProvisionalAccess") {
      return { route: "PROVISIONAL_READY" };
    }
    if (action === "submitRegistrationDetails") {
      return { route: "PROVISIONAL_SETUP_READY" };
    }
    return { ok: true, deliveredBy: "apps_script" };
  },
  getCurrentUserPermission: async () => ({
    active: true,
    accessLevel: "provisional",
    accessReviewRequired: true
  }),
  permissionHasProvisionalAccess_: () => false,
  deleteNewAuthUserSafely: async () => calls.push(["delete"]),
  clearCachedAuthRoute_: (...args) => calls.push(["clear-route", ...args]),
  startAuthEmailCooldown: () => {},
  recordOwnAuthState_: () => {},
  rememberSuccessfulEmail_: () => {},
  handleAuthenticatedUser: async () => {},
  showVerificationPanel_: (user, email) => calls.push([
    "verification-panel",
    user.email,
    email
  ]),
  getAuthErrorMessage: error => error.message,
  showAuthEmailStep_: () => {},
  showAuthPasswordStep_: (...args) => calls.push(["password-step", ...args]),
  showAuthRegistrationDetailsStep_: (...args) => calls.push([
    "details-step",
    ...args
  ]),
  requestPublicAuthRoute_: async () => ({ route: "PASSWORD_SETUP" }),
  continueFromEmailStep: async () => {}
};

vm.createContext(sandbox);
vm.runInContext(
  [
    extractFunction("sendVerificationEmailReliably_"),
    extractFunction("registerWithPassword"),
    extractFunction("submitRegistrationDetails_")
  ].join("\n"),
  sandbox
);

(async () => {
  await sandbox.registerWithPassword();

  assert.deepEqual(calls.find(call => call[0] === "create"), [
    "create",
    "new@example.com",
    "Secret123"
  ]);
  assert.deepEqual(calls.find(call => call[0] === "token"), ["token", true]);
  const routerCall = calls.find(call => call[0] === "router");
  assert.equal(routerCall[1], "finalizeProvisionalAccess");
  assert.equal(routerCall[2].idToken, "verified-firebase-id-token");
  assert.equal(routerCall[2].phone, "+972501234567");
  assert.equal(routerCall[3], "contacts-provisional-access-finalize");
  assert(
    extractFunction("registerWithPassword").includes(
      '["PROVISIONAL_READY", "ACTIVE"].includes(finalizedRoute)'
    ),
    "a manager approval that completes before account creation must remain valid"
  );
  const verificationCall = calls.find(
    call => call[0] === "router" && call[1] === "sendVerificationEmail"
  );
  assert.equal(verificationCall[2].idToken, "verified-firebase-id-token");
  assert.equal(verificationCall[3], "contacts-verification-email");
  assert(!calls.some(call => call[0] === "verify"));
  assert(calls.some(call => call[0] === "verification-panel"));
  assert(!calls.some(call => call[0] === "delete"));

  const registrationBody = extractFunction("registerWithPassword");
  assert(!registrationBody.includes("REGISTRATION_FORM_URL"));
  assert(!registrationBody.includes("docs.google.com/forms"));

  const detailsBodyStart = source.indexOf(
    "async function submitRegistrationDetails_()"
  );
  const detailsBodyEnd = source.indexOf(
    "function showAuthPhoneStep_",
    detailsBodyStart
  );
  const detailsBody = source.slice(detailsBodyStart, detailsBodyEnd);
  assert(detailsBody.includes('route !== "PROVISIONAL_SETUP_READY"'));
  assert(detailsBody.includes("provisionalRegistrationPhone ="));
  assert(detailsBody.includes(
    'showAuthPasswordStep_(pendingRegistrationEmail, "register"'
  ));
  assert(!detailsBody.includes('showAuthNotice_(\n      "הבקשה נשלחה למנהל"'));

  sandbox.authActionInProgress = false;
  sandbox.pendingRegistrationEmail = "new@example.com";
  sandbox.pendingRegistrationPhone = "0501234567";
  sandbox.authAccountSetupEmail = "";
  sandbox.provisionalRegistrationPhone = "";
  calls.length = 0;
  await sandbox.submitRegistrationDetails_();
  const detailsRouterCall = calls.find(
    call => call[0] === "router" && call[1] === "submitRegistrationDetails"
  );
  assert(detailsRouterCall, "registration details must be saved first");
  assert.equal(sandbox.authAccountSetupEmail, "new@example.com");
  assert.equal(sandbox.provisionalRegistrationPhone, "0501234567");
  const passwordStepCall = calls.find(call => call[0] === "password-step");
  assert.equal(passwordStepCall[1], "new@example.com");
  assert.equal(passwordStepCall[2], "register");
  assert.equal(passwordStepCall[3].preserveFlow, true);
  assert(!calls.some(call => call[0] === "details-step"));

  console.log("registration client flow: OK");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
