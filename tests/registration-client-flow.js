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
  confirmPasswordInput: { value: "Secret123" }
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
    return { route: "PROVISIONAL_READY" };
  },
  getCurrentUserPermission: async () => ({
    active: true,
    accessLevel: "provisional",
    accessReviewRequired: true
  }),
  permissionHasProvisionalAccess_: () => false,
  deleteNewAuthUserSafely: async () => calls.push(["delete"]),
  clearCachedAuthRoute_: () => {},
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
  showAuthPasswordStep_: () => {},
  requestPublicAuthRoute_: async () => ({ route: "PASSWORD_SETUP" }),
  continueFromEmailStep: async () => {}
};

vm.createContext(sandbox);
vm.runInContext(extractFunction("registerWithPassword"), sandbox);

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
  assert.deepEqual(calls.find(call => call[0] === "verify"), [
    "verify",
    "new@example.com",
    "https://example.invalid/return"
  ]);
  assert(calls.some(call => call[0] === "verification-panel"));
  assert(!calls.some(call => call[0] === "delete"));

  const registrationBody = extractFunction("registerWithPassword");
  assert(!registrationBody.includes("REGISTRATION_FORM_URL"));
  assert(!registrationBody.includes("docs.google.com/forms"));

  console.log("registration client flow: OK");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
