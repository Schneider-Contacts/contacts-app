const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.resolve(__dirname, "..", "FirestoreData.gs"),
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

let committedWrites = null;
const existingUser = {
  active: true,
  phone: "0501234567",
  phoneKey: "phone-key",
  accessLevel: "provisional",
  accessReviewRequired: true,
  updateTime: "user-update-time"
};
const existingPhone = {
  active: true,
  email: "new@example.com",
  updateTime: "phone-update-time"
};
const sandbox = {
  console,
  Set,
  Date,
  Logger: { log: () => {} },
  ACCESS_REVIEW_STATUS_APPROVED: "approved",
  ACCESS_REVIEW_STATUS_PENDING: "pending",
  ALLOWED_PHONES_COLLECTION_NAME: "allowedPhones",
  normalizeEmail_: value => String(value || "").trim().toLowerCase(),
  normalizeIsraeliPhone: value => String(value || "").replace(/\D/g, ""),
  cleanSheetValue_: value => String(value || "").trim(),
  isValidEmail_: value => /^[^@]+@[^@]+\.[^@]+$/.test(value),
  isValidNormalizedIsraeliPhone_: value => /^0\d{9}$/.test(value),
  getAllowedPhoneDocumentId_: () => "phone-key",
  getAllowedUser_: () => existingUser,
  getAllowedPhonePermission_: () => existingPhone,
  getFirestoreDocumentName_: (collection, id) => `${collection}/${id}`,
  commitFirestoreWrites_: writes => { committedWrites = writes; }
};
vm.createContext(sandbox);
vm.runInContext(
  extractFunction("upsertAllowedUserPairAtomically_"),
  sandbox
);

const result = sandbox.upsertAllowedUserPairAtomically_(
  "new@example.com",
  "app-registration-admin-approved",
  "0501234567",
  {
    existingUser,
    existingPhonePermission: existingPhone,
    permanentApproval: true,
    approvedBy: "admin@example.com",
    approvalReason: "אישור בקשת הצטרפות"
  }
);

assert.equal(result.provisional, false);
const userWrite = committedWrites[0].update;
assert.equal(userWrite.fields.accessReviewRequired.booleanValue, false);
assert.equal(userWrite.fields.accessReviewStatus.stringValue, "approved");
assert.equal(userWrite.fields.manualApproved.booleanValue, true);
assert.equal(userWrite.fields.manualApprovedBy.stringValue, "admin@example.com");
assert.equal(userWrite.fields.accessLevel.stringValue, "active");
assert.equal(userWrite.fields.provisionalActivatedAt.nullValue, null);
assert.equal(
  new Set(committedWrites[0].updateMask.fieldPaths).size,
  committedWrites[0].updateMask.fieldPaths.length,
  "Firestore update masks must not contain duplicate field paths"
);

console.log("permanent approval flow: OK");
