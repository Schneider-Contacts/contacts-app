const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "FormAccess.gs"), "utf8");

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
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

const state = {
  contact: { phone: "0501234567", name: "Test Contact" },
  allowedUser: null,
  allowedPhone: null,
  queued: 0,
  queuedValues: null,
  upserts: 0,
  queuedUnknownEligible: false
};
const sandbox = {
  console,
  Date,
  LockService: {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} })
  },
  normalizeEmail_: value => String(value || "").trim().toLowerCase(),
  normalizeIsraeliPhone: value => {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.startsWith("972") ? `0${digits.slice(3)}` : digits;
  },
  normalizeDateToIso_: value => value || "",
  isValidEmail_: value => /^[^@]+@[^@]+\.[^@]+$/.test(value),
  isValidNormalizedIsraeliPhone_: value => /^0\d{9}$/.test(value),
  cleanSheetValue_: value => String(value || "").trim(),
  readAndDeduplicateContacts_: () => state.contact ? [state.contact] : [],
  getAllowedUser_: () => state.allowedUser,
  getAllowedPhonePermission_: () => state.allowedPhone,
  getRegistrationContactProfile_: contact => ({
    name: contact ? contact.name : "",
    role: "",
    department: "",
    contactId: "contact-1"
  }),
  queueAccessRequestForAdmin_: (_contact, values) => {
    state.queued += 1;
    state.queuedValues = values;
    return { requestId: "pending-1", duplicate: false };
  },
  getQueuedUnknownRegistrationForFinalization_: () =>
    state.queuedUnknownEligible
      ? {
          requestId: "pending-1",
          profile: {
            name: "ישראל ישראלי",
            role: "רופא",
            department: "ילדים א׳",
            contactId: ""
          }
        }
      : null,
  upsertAllowedUserPairAtomically_: () => {
    state.upserts += 1;
    return {
      provisional: true,
      accessGrantedAt: "2026-08-20T10:00:00.000Z"
    };
  },
  appendFirestoreActivity_: () => {},
  syncAppUserMirrorBestEffort_: () => ({}),
  clearPublicAuthRouteCache_: () => {},
  getRegistrationFormUrl_: () => "https://example.invalid/form"
};
vm.createContext(sandbox);
vm.runInContext(
  [
    extractFunction("getAccessReviewReason_"),
    extractFunction("normalizeRegistrationOptionKey_"),
    extractFunction("canonicalizeRegistrationRole_"),
    extractFunction("getRegistrationFieldOptions_"),
    extractFunction("resolveRequiredRegistrationOption_"),
    extractFunction("processAccessRegistration_")
  ].join("\n"),
  sandbox
);

const queuedRequestState = { request: null };
const queuedRequestSandbox = {
  normalizeEmail_: value => String(value || "").trim().toLowerCase(),
  normalizeIsraeliPhone: value => {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.startsWith("972") ? `0${digits.slice(3)}` : digits;
  },
  cleanSheetValue_: value => String(value || "").trim(),
  getAccessRequestId_: () => "access-request-1",
  getAuthFlowDocument_: () => queuedRequestState.request
};
vm.createContext(queuedRequestSandbox);
vm.runInContext(
  extractFunction("getQueuedUnknownRegistrationForFinalization_"),
  queuedRequestSandbox
);

queuedRequestState.request = {
  data: {
    status: "pending",
    requestType: "contact_add",
    grantAccessOnApproval: true,
    email: "unknown@example.com",
    phone: "+972501234567",
    firstName: "ישראל",
    lastName: "ישראלי",
    role: "רופא",
    department: "ילדים א׳"
  }
};
const queuedProfile =
  queuedRequestSandbox.getQueuedUnknownRegistrationForFinalization_(
    "unknown@example.com",
    "0501234567"
  );
assert.equal(queuedProfile.profile.name, "ישראל ישראלי");
assert.equal(queuedProfile.profile.department, "ילדים א׳");

queuedRequestState.request.data.status = "rejected";
assert.equal(
  queuedRequestSandbox.getQueuedUnknownRegistrationForFinalization_(
    "unknown@example.com",
    "0501234567"
  ),
  null,
  "a rejected manager request must not authorize provisional setup"
);
queuedRequestState.request.data.status = "pending";
queuedRequestState.request.data.phone = "0509999999";
assert.equal(
  queuedRequestSandbox.getQueuedUnknownRegistrationForFinalization_(
    "unknown@example.com",
    "0501234567"
  ),
  null,
  "the queued request must match the verified email and phone pair"
);

function reset() {
  state.contact = { phone: "0501234567", name: "Test Contact" };
  state.allowedUser = null;
  state.allowedPhone = null;
  state.queued = 0;
  state.queuedValues = null;
  state.upserts = 0;
  state.queuedUnknownEligible = false;
}

reset();
let result = sandbox.processAccessRegistration_(
  { email: "new@example.com", phone: "050-1234567" },
  "app",
  { deferProvisionalGrant: true }
);
assert.equal(result.route, "PROVISIONAL_SETUP_READY");
assert.equal(state.upserts, 0, "anonymous preflight must not grant access");

reset();
result = sandbox.processAccessRegistration_(
  { email: "new@example.com", phone: "0501234567" },
  "app"
);
assert.equal(result.route, "PROVISIONAL_READY");
assert.equal(state.upserts, 1, "authenticated finalization must grant access");

reset();
state.allowedPhone = {
  active: true,
  email: "someone-else@example.com"
};
result = sandbox.processAccessRegistration_(
  { email: "new@example.com", phone: "0501234567" },
  "app",
  { deferProvisionalGrant: true }
);
assert.equal(result.route, "PENDING_ADMIN");
assert.equal(state.queued, 1);
assert.equal(state.upserts, 0, "conflicting identity must never be provisional");

reset();
state.contact = null;
result = sandbox.processAccessRegistration_(
  { email: "unknown@example.com", phone: "0501234567" },
  "app",
  { deferProvisionalGrant: true }
);
assert.equal(result.route, "DETAILS_REQUIRED");
assert.equal(state.queued, 0, "preflight must wait for required identity details");
assert.equal(Array.from(result.registrationOptions.roles).length, 7);

const canonicalOptions = sandbox.getRegistrationFieldOptions_([
  { role: "מומחה/ית", department: "ילדים א׳" },
  { role: "מומחה/ית", department: "ילדים א" },
  { role: "אח/ות", department: "טיפול נמרץ ילדים" }
]);
assert.deepEqual(Array.from(canonicalOptions.roles), [
  "אח/ות",
  "דיאטן/ית",
  "מומחה/ית",
  "מזכיר/ה",
  "מנהל/ת",
  "מתמחה",
  "עובד/ת סוציאלי/ת"
]);
assert.equal(
  Array.from(canonicalOptions.departments).filter(value =>
    sandbox.normalizeRegistrationOptionKey_(value) === "ילדים א"
  ).length,
  1,
  "equivalent department spellings must produce one canonical choice"
);

const manyRegistrationOptions = sandbox.getRegistrationFieldOptions_(
  Array.from({ length: 25 }, (_, index) => ({
    role: index % 2 ? "מנהל המחלקה" : "מנהלת מחלקה",
    department: `מחלקה ${String(index + 1).padStart(2, "0")}`
  }))
);
assert.equal(Array.from(manyRegistrationOptions.departments).length, 18);
assert.deepEqual(
  Array.from(manyRegistrationOptions.roles),
  [
    "אח/ות",
    "דיאטן/ית",
    "מומחה/ית",
    "מזכיר/ה",
    "מנהל/ת",
    "מתמחה",
    "עובד/ת סוציאלי/ת"
  ],
  "registration must expose only the curated role choices"
);

const filteredDepartments = sandbox.getRegistrationFieldOptions_([
  { role: "מומחה/ית", department: "VPN" },
  { role: "מומחה/ית", department: "תורנים VPN" },
  { role: "מומחה/ית", department: "מעבדות" },
  { role: "מומחה/ית", department: "מרפאות ומכונים" },
  { role: "מומחה/ית", department: "ילדים א׳" }
]);
assert.deepEqual(
  Array.from(filteredDepartments.departments),
  ["ילדים א׳"],
  "generic quick-access categories must not appear as registration departments"
);

reset();
state.contact = null;
result = sandbox.processAccessRegistration_(
  {
    email: "unknown@example.com",
    phone: "0501234567",
    firstName: "ישראל",
    lastName: "ישראלי",
    role: "רופא",
    roleMode: "other",
    department: "ילדים א׳",
    departmentMode: "other"
  },
  "app",
  { submitUnknownDetails: true }
);
assert.equal(result.route, "PROVISIONAL_SETUP_READY");
assert.equal(state.queued, 1);
assert.equal(state.queuedValues.firstName, "ישראל");
assert.equal(state.queuedValues.department, "ילדים א׳");

reset();
state.contact = null;
state.queuedUnknownEligible = true;
result = sandbox.processAccessRegistration_(
  { email: "unknown@example.com", phone: "0501234567" },
  "app",
  { allowQueuedUnknownRegistration: true }
);
assert.equal(result.route, "PROVISIONAL_READY");
assert.equal(state.upserts, 1);

reset();
state.contact = null;
assert.throws(
  () => sandbox.processAccessRegistration_(
    { email: "unknown@example.com", phone: "0501234567" },
    "app",
    { allowQueuedUnknownRegistration: true }
  ),
  /בקשת ההצטרפות אינה זמינה/
);

reset();
state.contact = null;
state.queuedUnknownEligible = true;
state.allowedPhone = {
  active: true,
  email: "someone-else@example.com"
};
result = sandbox.processAccessRegistration_(
  { email: "unknown@example.com", phone: "0501234567" },
  "app",
  { allowQueuedUnknownRegistration: true }
);
assert.equal(result.route, "PENDING_ADMIN");
assert.equal(result.reason, "phone_linked_to_other_email");
assert.equal(state.upserts, 0);

assert.throws(
  () => sandbox.processAccessRegistration_(
    {
      email: "missing-fields@example.com",
      phone: "0501234567",
      firstName: "ישראל",
      lastName: "ישראלי",
      role: "",
      roleMode: "other",
      department: "ילדים א׳",
      departmentMode: "other"
    },
    "app",
    { submitUnknownDetails: true }
  ),
  /יש לבחור תפקיד/
);

reset();
result = sandbox.processAccessRegistration_(
  {
    email: "late-match@example.com",
    phone: "0501234567",
    firstName: "ישראל",
    lastName: "ישראלי"
  },
  "app",
  { submitUnknownDetails: true }
);
assert.equal(result.route, "RETRY_PHONE_CHECK");
assert.equal(state.upserts, 0, "an anonymous details request must never grant access");

reset();
state.allowedUser = {
  active: true,
  phone: "0501234567",
  accessReviewRequired: false,
  accessLevel: "active"
};
state.allowedPhone = { active: true, email: "active@example.com" };
result = sandbox.processAccessRegistration_(
  { email: "active@example.com", phone: "0501234567" },
  "app",
  { deferProvisionalGrant: true }
);
assert.equal(result.route, "ACTIVE");
assert.equal(state.upserts, 0, "existing permanent access must remain unchanged");

reset();
state.allowedUser = {
  active: true,
  phone: "0501234567",
  accessReviewRequired: true,
  accessReviewStatus: "rejected",
  accessLevel: "revoked"
};
state.allowedPhone = { active: true, email: "blocked@example.com" };
result = sandbox.processAccessRegistration_(
  { email: "blocked@example.com", phone: "0501234567" },
  "app",
  { deferProvisionalGrant: true }
);
assert.equal(result.route, "PENDING_ADMIN");
assert.equal(result.reason, "blocked_permission");
assert.equal(state.upserts, 0, "rejected access must never become provisional");

console.log("provisional access flow: OK");
