const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.resolve(__dirname, "..", "EmailUpdateLogic.gs"),
  "utf8"
);

function extractFunction(name) {
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
  existingUser: null,
  existingPhone: null,
  recentResult: null,
  recentPhoneUpdate: null,
  matches: [],
  commits: [],
  sheetWrites: 0,
  rollbacks: 0,
  remembered: 0,
  releaseCount: 0,
  failPermissionWrite: false
};

const normalizeEmail = value => String(value || "").trim().toLowerCase();
const normalizePhone = value => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  return digits;
};

const sandbox = {
  console,
  Date,
  ACCESS_REVIEW_STATUS_PENDING: "pending",
  ALLOWED_PHONES_COLLECTION_NAME: "allowedPhones",
  DISABLE_REPLACED_EMAIL_KEY: "disableReplacedEmail",
  MAIN_APP_URL_KEY: "mainAppUrl",
  DEFAULT_MAIN_APP_URL: "https://example.invalid/app",
  LockService: {
    getDocumentLock: () => ({
      tryLock: () => true,
      releaseLock: () => { state.releaseCount += 1; }
    }),
    getScriptLock: () => null
  },
  isEmailUpdatePortalOpen_: () => true,
  cleanSheetValue_: value => String(value || "").trim(),
  normalizeEmail_: normalizeEmail,
  normalizeIsraeliPhone: normalizePhone,
  isValidNormalizedIsraeliPhone_: value => /^05\d{8}$/.test(value),
  isValidEmail_: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  getAllowedPhoneDocumentId_: value => `phone-${normalizePhone(value)}`,
  getRecentEmailUpdateResult_: () => state.recentResult,
  getRecentEmailUpdateForPhone_: () => state.recentPhoneUpdate,
  getAllowedUser_: () => state.existingUser,
  getAllowedPhonePermission_: () => state.existingPhone,
  clearPublicAuthRouteCache_: () => {},
  getEmailUpdateSetting_: (_key, fallback) => fallback,
  findEmailUpdateMatches_: () => state.matches,
  appendEmailUpdateLog_: () => {},
  formatIsraeliPhoneForDisplay_: value => normalizePhone(value),
  getBestDisplayNameFromMatches_: () => "ישראל ישראלי",
  updateMatchedEmailCells_: () => { state.sheetWrites += 1; },
  getBooleanEmailUpdateSetting_: () => false,
  getEligiblePendingOldEmails_: () => [],
  queueDirectoryRebuild_: () => {},
  appendFirestoreActivity_: () => {},
  rememberEmailUpdateResult_: () => { state.remembered += 1; },
  rollbackMatchedEmailCells_: () => {
    state.rollbacks += 1;
    return state.matches.length;
  },
  getAuthFlowDocument_: () => null,
  getFirestoreDocumentName_: (collection, id) => `${collection}/${id}`,
  commitFirestoreWrites_: writes => { state.commits.push(writes); }
};

vm.createContext(sandbox);
vm.runInContext(
  [
    extractFunction("upsertAllowedUserForEmailReplacement_"),
    extractFunction("maskEmailAddress_"),
    extractFunction("submitEmailUpdate")
  ].join("\n"),
  sandbox
);

function reset() {
  state.existingUser = null;
  state.existingPhone = null;
  state.recentResult = null;
  state.recentPhoneUpdate = null;
  state.matches = [];
  state.commits = [];
  state.sheetWrites = 0;
  state.rollbacks = 0;
  state.remembered = 0;
  state.releaseCount = 0;
  state.failPermissionWrite = false;
  sandbox.upsertAllowedUserForEmailReplacement_ = (...args) => {
    if (state.failPermissionWrite) throw new Error("permission write failed");
    return { status: args[3] ? "updated" : "created" };
  };
}

reset();
state.existingUser = {
  active: true,
  phone: "0501234567",
  phoneKey: "phone-0501234567"
};
state.existingPhone = { active: true, email: "same@example.com" };
state.recentResult = { success: true, email: "same@example.com" };
let result = sandbox.submitEmailUpdate({
  phone: "050-1234567",
  email: "same@example.com",
  confirmEmail: "same@example.com"
});
assert.equal(result.duplicate, true, "same phone/email retry must be idempotent");
assert.equal(state.sheetWrites, 0);

reset();
state.existingPhone = { active: true, email: "old@example.com" };
result = sandbox.submitEmailUpdate({
  phone: "0501234567",
  email: "new@example.com",
  confirmEmail: "new@example.com"
});
assert.equal(result.requiresChoice, true, "a different email must require a choice");
assert.equal(result.previousEmail, "old@example.com");
assert.equal(state.sheetWrites, 0, "no source data may change before confirmation");

reset();
state.existingPhone = { active: true, email: "old@example.com" };
state.matches = [{
  sheetName: "contacts",
  row: 2,
  emailColumn: 5,
  oldEmail: "old@example.com"
}];
state.failPermissionWrite = true;
assert.throws(
  () => sandbox.submitEmailUpdate({
    phone: "0501234567",
    email: "new@example.com",
    confirmEmail: "new@example.com",
    confirmRecentChange: "1"
  }),
  /permission write failed/
);
assert.equal(state.sheetWrites, 1);
assert.equal(state.rollbacks, 1, "a failed permission write must roll Sheets back");

reset();
state.matches = [{
  sheetName: "contacts",
  row: 2,
  emailColumn: 5,
  oldEmail: "old@example.com"
}];
result = sandbox.submitEmailUpdate({
  phone: "0501234567",
  email: "new@example.com",
  confirmEmail: "new@example.com"
});
assert.equal(result.success, true);
assert.equal(state.sheetWrites, 1);
assert.equal(state.rollbacks, 0);
assert.equal(state.remembered, 1);

const atomicSandbox = {
  ...sandbox,
  getAllowedUser_: () => ({
    active: true,
    email: "new@example.com",
    phone: "0501234567",
    phoneKey: "phone-0501234567"
  }),
  getAllowedPhonePermission_: () => ({
    active: true,
    email: "new@example.com"
  }),
  commitFirestoreWrites_: writes => { state.commits.push(writes); }
};
vm.createContext(atomicSandbox);
vm.runInContext(
  extractFunction("upsertAllowedUserForEmailReplacement_"),
  atomicSandbox
);
state.commits = [];
result = atomicSandbox.upsertAllowedUserForEmailReplacement_(
  "new@example.com",
  [],
  ["old@example.com"],
  null,
  "0501234567",
  null
);
assert.equal(result.status, "created");
assert.equal(state.commits.length, 1);
assert.equal(
  state.commits[0].length,
  3,
  "allowedUsers, allowedPhones and manager review must commit atomically"
);
assert.match(state.commits[0][0].update.name, /^allowedUsers\//);
assert.match(state.commits[0][1].update.name, /^allowedPhones\//);
assert.match(state.commits[0][2].update.name, /^verificationRequests\//);

console.log("email update flow: OK");
