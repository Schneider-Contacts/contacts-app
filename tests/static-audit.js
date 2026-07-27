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

new vm.Script(appSource, { filename: "app.js" });
appsScriptFiles.forEach(fileName => {
  new vm.Script(read(fileName), { filename: fileName });
});

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
  "approveContactAddRequestFromWeb_"
];

requiredAppsScriptEntrypoints.forEach(name => {
  assert(
    new RegExp(`\\bfunction\\s+${name}\\s*\\(`).test(appsScriptSource),
    `Missing Apps Script entrypoint: ${name}`
  );
});

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
