const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const endpointSource = fs.readFileSync(path.join(root, "WebEndpoints.gs"), "utf8");
const rulesSource = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} must exist`);
  const signatureEnd = source.indexOf(") {", start);
  const brace = source.indexOf("{", signatureEnd);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const sandbox = {
  pendingOperationalFailures: [],
  OPERATIONAL_FAILURE_DEDUPE_MS: 15 * 60 * 1000,
  auth: null,
  normalizeEmail: value => String(value || "").trim().toLowerCase(),
  document: { getElementById: () => ({ value: "doctor@example.org" }) },
  Date,
  Set,
  String,
  Number,
  Math
};
vm.createContext(sandbox);
vm.runInContext([
  extractFunction(appSource, "normalizeOperationalFailureReason_"),
  extractFunction(appSource, "getOperationalFailureClassification_"),
  extractFunction(appSource, "recordOperationalFailure_")
].join("\n"), sandbox);

assert.strictEqual(
  sandbox.getOperationalFailureClassification_("invalid_credentials"),
  "user",
  "Wrong credentials must not mark the system unhealthy"
);
assert.strictEqual(
  sandbox.getOperationalFailureClassification_("firebase_config_error"),
  "system"
);

sandbox.recordOperationalFailure_("login", { code: "auth/wrong-password" });
sandbox.recordOperationalFailure_("login", { code: "auth/wrong-password" });
assert.strictEqual(sandbox.pendingOperationalFailures.length, 1);
assert.strictEqual(sandbox.pendingOperationalFailures[0].count, 2);
assert.strictEqual(
  sandbox.pendingOperationalFailures[0].reason,
  "invalid_credentials"
);

const flushSource = extractFunction(appSource, "flushOperationalFailures_");
assert.doesNotMatch(flushSource, /password|token|identityEmail\s*:/i);
assert.match(flushSource, /uid,/);
assert.match(flushSource, /increment\(/);

assert.match(endpointSource, /function createOperationalHealthJsonp_/);
assert.match(endpointSource, /action\) === "health"/);
assert.doesNotMatch(
  extractFunction(endpointSource, "createOperationalHealthJsonp_"),
  /SpreadsheetApp|allowedUsers|allowedPhones|reconcil/i,
  "The Apps Script health endpoint must remain read-only and lightweight"
);

assert.match(rulesSource, /match \/operationalFailures\/\{eventId\}/);
assert.match(rulesSource, /request\.resource\.data\.uid == request\.auth\.uid/);
assert.match(rulesSource, /allow read: if isSuperAdmin\(\)/);
assert.match(rulesSource, /request\.resource\.data\.reason in \[/);
assert.match(rulesSource, /request\.resource\.data\.source == "authenticated_client"/);

assert.match(appSource, /function runDirectorySearchSelfTest_/);
assert.match(
  extractFunction(appSource, "runDirectorySearchSelfTest_"),
  /getSearchPriority\(/,
  "Search health must reuse production ranking"
);

assert.match(
  extractFunction(appSource, "showAppForUser"),
  /scheduleAdminHomeHealthCheck_\(\)/,
  "Admin health must start from the main screen"
);

const healthElements = {
  adminSystemHomeCard: { hidden: true },
  adminSystemHomeTitle: { textContent: "" },
  adminSystemHomeSummary: { textContent: "" },
  adminSystemHomeQuickFixBtn: { hidden: false, textContent: "" },
  adminSystemHomeHint: { hidden: true }
};
const homeHealthSandbox = {
  adminHealthState: {
    appsScript: { ok: false },
    frontend: { ok: true },
    firebase: { ok: true },
    directory: { ok: true },
    search: { ok: true }
  },
  adminHomeHealthIssueKind: "",
  currentUserIsAdmin: true,
  currentUserIsSuperAdmin: true,
  navigator: { onLine: true },
  document: {
    getElementById: id => healthElements[id] || null
  },
  getAdminOperationalFailureSummary_: () => ({
    affectedUsers: 0,
    hasSystemPattern: false
  })
};
vm.createContext(homeHealthSandbox);
vm.runInContext([
  extractFunction(appSource, "getAdminHomeHealthIssue_"),
  extractFunction(appSource, "updateAdminSystemHomeAlert_")
].join("\n"), homeHealthSandbox);

homeHealthSandbox.updateAdminSystemHomeAlert_();
assert.strictEqual(healthElements.adminSystemHomeCard.hidden, false);
assert.strictEqual(
  healthElements.adminSystemHomeTitle.textContent,
  "שרת ההרשמה אינו זמין"
);
assert.strictEqual(
  healthElements.adminSystemHomeQuickFixBtn.textContent,
  "פתיחת תיקון Google"
);

homeHealthSandbox.adminHealthState.appsScript.ok = true;
homeHealthSandbox.updateAdminSystemHomeAlert_();
assert.strictEqual(
  healthElements.adminSystemHomeCard.hidden,
  true,
  "Healthy state must stay quiet on the main screen"
);

console.log("admin health flow: OK");
