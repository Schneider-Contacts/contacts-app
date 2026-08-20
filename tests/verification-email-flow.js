const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.resolve(__dirname, "..", "WebEndpoints.gs"),
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
  identity: {
    email: "new@example.com",
    uid: "firebase-user-1",
    emailVerified: false
  },
  allowed: true,
  firebaseUid: "firebase-user-1",
  fetches: [],
  messages: [],
  cache: new Map()
};

const sandbox = {
  console,
  FIREBASE_PROJECT_ID: "test-project",
  DEFAULT_MAIN_APP_URL: "https://example.invalid/contacts/",
  verifyFirebaseUserIdToken_: () => ({ ...state.identity }),
  getAllowedUser_: () => state.allowed ? { active: true } : null,
  isAllowedEmailPhonePairActive_: () => state.allowed,
  isActiveAdminEmail_: () => false,
  getFirebaseUserByEmailAdmin_: () => ({ localId: state.firebaseUid }),
  cleanSheetValue_: value => String(value || "").trim(),
  escapeHtmlForOutput_: value => String(value).replace(/&/g, "&amp;"),
  ScriptApp: { getOAuthToken: () => "oauth-token" },
  CacheService: {
    getScriptCache: () => ({
      get: key => state.cache.get(key) || null,
      put: (key, value) => state.cache.set(key, value)
    })
  },
  UrlFetchApp: {
    fetch: (url, options) => {
      state.fetches.push({ url, options });
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          oobLink: "https://test-project.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=test"
        })
      };
    }
  },
  MailApp: {
    sendEmail: message => state.messages.push(message)
  }
};

vm.createContext(sandbox);
vm.runInContext(
  extractFunction("sendFirebaseVerificationEmailFromWeb_"),
  sandbox
);

let result = sandbox.sendFirebaseVerificationEmailFromWeb_({
  idToken: "firebase-id-token"
});
assert.equal(result.ok, true);
assert.equal(result.deliveredBy, "apps_script");
assert.equal(state.fetches.length, 1);
const request = JSON.parse(state.fetches[0].options.payload);
assert.equal(request.requestType, "VERIFY_EMAIL");
assert.equal(request.email, "new@example.com");
assert.equal(request.targetProjectId, "test-project");
assert.equal(request.returnOobLink, true);
assert.equal(state.messages.length, 1);
assert.equal(state.messages[0].to, "new@example.com");
assert.match(state.messages[0].body, /oobCode=test/);
assert.equal(Object.prototype.hasOwnProperty.call(result, "oobLink"), false);

state.cache.clear();
state.fetches.length = 0;
state.messages.length = 0;
state.firebaseUid = "different-user";
assert.throws(
  () => sandbox.sendFirebaseVerificationEmailFromWeb_({ idToken: "token" }),
  /אינו תואם/
);
assert.equal(state.messages.length, 0);

state.firebaseUid = "firebase-user-1";
state.allowed = false;
assert.throws(
  () => sandbox.sendFirebaseVerificationEmailFromWeb_({ idToken: "token" }),
  /לא נמצאה התאמה פעילה/
);

state.allowed = true;
state.identity.emailVerified = true;
result = sandbox.sendFirebaseVerificationEmailFromWeb_({ idToken: "token" });
assert.equal(result.alreadyVerified, true);
assert.equal(state.messages.length, 0);

console.log("verification email flow: OK");
