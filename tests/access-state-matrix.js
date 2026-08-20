const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const serverSource = fs.readFileSync(path.join(root, "WebEndpoints.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
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

const state = {
  emailVerified: false,
  allowedUser: null,
  commits: []
};

const sandbox = {
  console,
  Date,
  ACCESS_REVIEW_STATUS_REJECTED: "rejected",
  ACCESS_REVIEW_STATUS_REVOKED: "revoked",
  ACCESS_REVIEW_STATUS_APPROVED: "approved",
  ACCESS_REVIEW_STATUS_TEMPORARY: "temporary_active",
  verifyFirebaseUserIdToken_: () => ({
    email: "new@example.com",
    emailVerified: state.emailVerified
  }),
  getAllowedUser_: () => state.allowedUser,
  isAllowedEmailPhonePairActive_: () => true,
  getAuthFlowDocument_: () => null,
  getFirestoreDocumentName_: (collection, id) => `${collection}/${id}`,
  commitFirestoreWrites_: writes => { state.commits.push(writes); },
  Utilities: { getUuid: () => "12345678-1234-1234-1234-123456789012" },
  getPreviousVerifiedAccessEmail_: () => "",
  getEndOfIsraelDay_: date => new Date(date.getTime() + 60 * 60 * 1000),
  cleanSheetValue_: value => String(value || "").trim(),
  maskEmailAddress_: value => value
};

vm.createContext(sandbox);
vm.runInContext(
  extractFunction(serverSource, "activateTemporaryAccessFromWeb_"),
  sandbox
);

function provisionalPermission(overrides = {}) {
  return {
    active: true,
    accessReviewRequired: true,
    accessReviewStatus: "pending",
    accessLevel: "provisional",
    phone: "0501234567",
    updateTime: "2026-08-20T10:00:00.000Z",
    ...overrides
  };
}

state.allowedUser = provisionalPermission();
state.emailVerified = false;
state.commits = [];
let result = sandbox.activateTemporaryAccessFromWeb_({ idToken: "token" });
assert.equal(result.needsManager, true);
assert.equal(result.provisional, false);
assert.equal(state.commits.length, 0, "unverified email must not activate access");

state.allowedUser = provisionalPermission();
state.emailVerified = true;
state.commits = [];
const beforeActivation = Date.now();
result = sandbox.activateTemporaryAccessFromWeb_({ idToken: "token" });
assert.equal(result.provisional, true);
assert.equal(result.permanent, false);
assert.equal(state.commits.length, 1);
assert.equal(state.commits[0].length, 2);
const approvedUntil = new Date(result.approvedUntil).getTime();
assert(approvedUntil >= beforeActivation + 24 * 60 * 60 * 1000 - 1000);

state.allowedUser = provisionalPermission({
  provisionalActivatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
});
state.commits = [];
result = sandbox.activateTemporaryAccessFromWeb_({ idToken: "token" });
assert.equal(result.expired, true);
assert.equal(result.needsManager, true);
assert.equal(state.commits.length, 0);

assert.match(
  appSource,
  /async function approveManualAccess_\([\s\S]*?accessReviewRequired: false[\s\S]*?accessReviewStatus: "approved"[\s\S]*?manualApproved: true[\s\S]*?accessLevel: "active"/,
  "manager permanent approval must grant full access even without email verification"
);
assert.match(
  appSource,
  /function downloadAllContacts\(\)[\s\S]*?isCurrentUserProvisional_\(\)/,
  "provisional users must not download all contacts"
);
assert.match(
  appSource,
  /function downloadRecentContacts\(\)[\s\S]*?isCurrentUserProvisional_\(\)/,
  "provisional users must not use bulk recent-contact download"
);

console.log("access state matrix: OK");
