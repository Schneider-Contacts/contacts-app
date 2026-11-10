/* Protected monthly roster. No personal data or AI service is embedded here. */
const PHARMACOLOGY_COLLECTION = "pharmacologyRosters";
let pharmacologyState = { open: false, token: 0, date: "", status: "idle", roster: null, previous: null, loadedAt: 0 };
let pharmacologyAdmin = { session: 0, open: false, draft: null, input: "", expectedVersion: null, busy: false };
let pharmacologyTimer = null;
let pharmacologyHomeScrollY = 0;
let pharmacologyAdminReturnFocus = null;

function pharmacologyCanRead_() {
  return Boolean(auth && auth.currentUser && (currentUserHasAppAccess || currentUserIsAdmin));
}

function pharmacologyDateLabel_(key) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${key}T12:00:00Z`));
}

function pharmacologyShiftLabel_(entry) {
  const hours = entry.start && entry.end ? `${entry.start}–${entry.end}${entry.endNextDay ? " (למחרת)" : ""}` : "שעות לא צוינו";
  return `${entry.shift} · ${hours}`;
}

function pharmacologyCards_(entries, current = null, preview = false) {
  return entries.map(entry => {
    const canCall = !preview && !entry.uncertain && Boolean(entry.phone);
    return `<article class="pharmacologyCard${entry === current ? " current" : ""}">
      <div class="pharmacologyPerson"><strong>${escapeHtml(entry.name)}</strong>
        ${entry === current ? '<span class="pharmacologyBadge">לפי שעות הלוח, כעת</span>' : ""}
        <span>${escapeHtml(pharmacologyShiftLabel_(entry))}</span>
        ${!preview && entry.date !== pharmacologyState.date ? `<small>המשמרת התחילה ב־${escapeHtml(pharmacologyDateLabel_(entry.date))}</small>` : ""}
        ${entry.phone ? `<span dir="ltr">${escapeHtml(formatPhoneForDisplay(entry.phone))}</span>` : '<span class="pharmacologyWarning">אין מספר לחיוג</span>'}
        ${entry.uncertain ? '<span class="pharmacologyWarning">פרט לא ודאי בלוח. יש לברר לפני חיוג.</span>' : ""}
        ${entry.note ? `<small>${escapeHtml(entry.note)}</small>` : ""}
      </div>
      ${canCall ? `<a class="pharmacologyCall" href="tel:${escapeHtml(entry.phone)}" onclick="return validatePharmacologyCall_(event)" aria-label="חיוג אל ${escapeHtml(entry.name)}">${getDirectoryIconSvg_("phone")}<span>חיוג</span></a>` : ""}
    </article>`;
  }).join("");
}

function renderPharmacology_() {
  const status = document.getElementById("pharmacologyStatus");
  const list = document.getElementById("pharmacologyList");
  if (!status || !list) return;
  const state = pharmacologyState;
  document.getElementById("pharmacologyDateInput").value = state.date;
  document.getElementById("pharmacologyDateLabel").textContent = state.date ? pharmacologyDateLabel_(state.date) : "";
  status.hidden = false;
  list.innerHTML = "";
  if (state.status === "loading" || state.status === "idle") { status.textContent = "טוען לוח מאומת…"; return; }
  if (state.status === "unavailable") { status.textContent = "לא ניתן לאמת את הלוח כרגע. התחברו לאינטרנט ונסו לרענן. לא מוצגים מספרים ממטמון."; return; }
  if (state.status === "invalid") { status.textContent = "הלוח שפורסם אינו תקין. יש לפנות למנהל המערכת."; return; }
  const today = PharmacologyRoster.israelDateKey();
  const isToday = state.date === today;
  let entries = state.roster ? state.roster.entries.filter(entry => entry.date === state.date) : [];
  let current = null;
  let ambiguous = false;
  if (isToday) {
    const combined = [state.previous, state.roster].filter(Boolean);
    const selection = PharmacologyRoster.selectDay(combined, new Date());
    entries = selection.entries;
    current = selection.current;
    ambiguous = selection.ambiguous;
  }
  if (!entries.length) { status.textContent = state.roster ? "לא מופיע שיבוץ לתאריך הזה. יש לברר עם המעבדה." : "טרם פורסם לוח לחודש הזה. יש לברר עם המעבדה."; return; }
  status.textContent = ambiguous || (!isToday && entries.some(entry => !entry.start || entry.uncertain))
    ? "השיבוצים מוצגים כפי שנכתבו בלוח. חסרות שעות או שיש פרט לא ודאי, ולכן לא נקבע מי כונן ברגע זה."
    : "השיבוצים ושעות הכוננות הם לפי הלוח שפורסם. יש לתאם מראש עם הכונן.";
  list.innerHTML = pharmacologyCards_(entries, current) + (state.roster?.notes ? `<p class="pharmacologyNotes">${escapeHtml(state.roster.notes)}</p>` : "");
}

async function loadPharmacology_() {
  if (!pharmacologyState.open || !pharmacologyCanRead_()) return;
  const token = ++pharmacologyState.token;
  const selectedDate = pharmacologyState.date;
  const month = selectedDate.slice(0, 7);
  pharmacologyState.status = "loading";
  pharmacologyState.roster = null;
  pharmacologyState.previous = null;
  pharmacologyState.loadedAt = 0;
  renderPharmacology_();
  try {
    const months = [month];
    // A shift explicitly crossing midnight on the last day belongs to the previous roster.
    if (selectedDate.endsWith("-01") && selectedDate === PharmacologyRoster.israelDateKey()) {
      const previous = new Date(`${selectedDate}T12:00:00Z`);
      previous.setUTCDate(0);
      months.push(previous.toISOString().slice(0, 7));
    }
    const snapshots = await Promise.all(months.map(key => firebaseApi.getDocFromServer(firebaseApi.doc(db, PHARMACOLOGY_COLLECTION, key))));
    if (token !== pharmacologyState.token || !pharmacologyState.open || !pharmacologyCanRead_()) return;
    const rosters = snapshots.map((snapshot, index) => {
      if (!snapshot.exists()) return null;
      const data = snapshot.data();
      const result = PharmacologyRoster.analyze({ schemaVersion: data.schemaVersion, month: data.month, timeZone: data.timeZone, notes: data.notes, entries: data.entries });
      if (!result.valid || data.month !== months[index] || data.reviewed !== true || data.schemaVersion !== 1) throw new Error("INVALID_ROSTER");
      return result.roster;
    });
    pharmacologyState.roster = rosters[0];
    pharmacologyState.previous = rosters[1] || null;
    pharmacologyState.status = "ready";
    pharmacologyState.loadedAt = Date.now();
  } catch (error) {
    if (token !== pharmacologyState.token) return;
    pharmacologyState.status = error.message === "INVALID_ROSTER" ? "invalid" : "unavailable";
    pharmacologyState.roster = null;
    pharmacologyState.previous = null;
  }
  if (token === pharmacologyState.token) renderPharmacology_();
}

function openPharmacologyView_() {
  if (!pharmacologyCanRead_() || pharmacologyState.open) return;
  closeAllDirectoryMenus_();
  closeDepartmentBrowser_();
  closeMonthlyInternsView_();
  pharmacologyHomeScrollY = window.scrollY;
  pharmacologyState.open = true;
  pharmacologyState.date = PharmacologyRoster.israelDateKey();
  pharmacologyState.followToday = true;
  document.getElementById("pharmacologyView").hidden = false;
  document.getElementById("app").classList.add("pharmacologyViewActive");
  window.scrollTo({ top: 0, behavior: "auto" });
  document.getElementById("pharmacologyBack").focus();
  loadPharmacology_();
  clearInterval(pharmacologyTimer);
  pharmacologyTimer = setInterval(refreshPharmacologyClock_, 60000);
}

function closePharmacologyView_() {
  if (!pharmacologyState.open) return;
  pharmacologyState.open = false;
  pharmacologyState.token += 1;
  pharmacologyState.roster = null;
  pharmacologyState.previous = null;
  clearInterval(pharmacologyTimer);
  pharmacologyTimer = null;
  document.getElementById("pharmacologyView").hidden = true;
  document.getElementById("pharmacologyList").innerHTML = "";
  document.getElementById("app").classList.remove("pharmacologyViewActive");
  window.scrollTo({ top: pharmacologyHomeScrollY, behavior: "auto" });
  document.getElementById("pharmacologyQuickEntry").focus();
}

function resetPharmacology_() {
  if (pharmacologyAdmin.open && pharmacologyAdmin.publishing) resolveAdminConfirmation_(false);
  closePharmacologyView_();
  pharmacologyState.token += 1;
  pharmacologyState.roster = null;
  pharmacologyState.previous = null;
  closePharmacologyAdmin_(true);
}

function refreshPharmacologyClock_() {
  if (!pharmacologyState.open || document.visibilityState === "hidden") return;
  if (pharmacologyState.followToday) pharmacologyState.date = PharmacologyRoster.israelDateKey();
  loadPharmacology_();
}

function setPharmacologyDate_(value) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) return;
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return;
  pharmacologyState.date = value;
  pharmacologyState.followToday = value === PharmacologyRoster.israelDateKey();
  loadPharmacology_();
}

function showPharmacologyToday_() {
  setPharmacologyDate_(PharmacologyRoster.israelDateKey());
}

function shiftPharmacologyDate_(offset) {
  const date = new Date(`${pharmacologyState.date}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  setPharmacologyDate_(date.toISOString().slice(0, 10));
}

function validatePharmacologyCall_(event) {
  if (!pharmacologyCanRead_() || pharmacologyState.status !== "ready" || Date.now() - pharmacologyState.loadedAt >= 60000 ||
      (pharmacologyState.followToday && pharmacologyState.date !== PharmacologyRoster.israelDateKey())) {
    event.preventDefault();
    refreshPharmacologyClock_();
    return false;
  }
  return true;
}

function renderAdminPharmacologyCard_() {
  return `<section class="adminSystemSection"><button type="button" class="adminSystemLinkRow" onclick="openPharmacologyAdmin_()"><span><strong>כוננות פרמקולוגיה</strong><small>הדבקת פלט AI, בדיקה ופרסום לוח חודשי</small></span><span aria-hidden="true">‹</span></button></section>`;
}

function openPharmacologyAdmin_() {
  if (!currentUserIsAdmin || !auth?.currentUser) return;
  if (pharmacologyAdmin.open) return;
  pharmacologyAdminReturnFocus = document.activeElement;
  pharmacologyAdmin = { session: pharmacologyAdmin.session + 1, open: true, draft: null, input: "", expectedVersion: null, busy: false };
  document.getElementById("pharmacologyJsonInput").value = "";
  document.getElementById("pharmacologyFileInput").value = "";
  document.getElementById("pharmacologySourceInfo").textContent = "קובץ טקסט UTF-8 עד 100KB, המכיל את פלט ה־JSON המלא.";
  document.getElementById("pharmacologyAiPrompt").value = PharmacologyRoster.buildAiPrompt();
  document.getElementById("pharmacologyPromptStatus").textContent = "";
  document.getElementById("pharmacologyReview").checked = false;
  document.getElementById("pharmacologyPreview").innerHTML = "";
  document.getElementById("pharmacologyAdminStatus").textContent = "";
  setPharmacologyAdminBusy_(false);
  const modal = document.getElementById("pharmacologyAdminModal");
  modal.classList.add("visible");
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("pharmacologyJsonInput").focus();
}

function closePharmacologyAdmin_(force = false) {
  if (pharmacologyAdmin.publishing && !force) return;
  pharmacologyAdmin = { session: pharmacologyAdmin.session + 1, open: false, draft: null, input: "", expectedVersion: null, busy: false };
  const modal = document.getElementById("pharmacologyAdminModal");
  if (!modal) return;
  modal.classList.remove("visible");
  modal.setAttribute("aria-hidden", "true");
  document.getElementById("pharmacologyJsonInput").value = "";
  document.getElementById("pharmacologyFileInput").value = "";
  document.getElementById("pharmacologySourceInfo").textContent = "קובץ טקסט UTF-8 עד 100KB, המכיל את פלט ה־JSON המלא.";
  document.getElementById("pharmacologyPreview").innerHTML = "";
  document.getElementById("pharmacologyAdminStatus").textContent = "";
  if (!force && pharmacologyAdminReturnFocus?.isConnected) pharmacologyAdminReturnFocus.focus();
  pharmacologyAdminReturnFocus = null;
}

function setPharmacologyAdminBusy_(busy) {
  pharmacologyAdmin.busy = busy;
  if (!busy) pharmacologyAdmin.publishing = false;
  document.getElementById("pharmacologyAdminClose").disabled = pharmacologyAdmin.publishing === true;
  for (const id of ["pharmacologyPreviewBtn", "pharmacologyJsonInput", "pharmacologyReview", "pharmacologyChooseFile", "pharmacologyFileInput"]) document.getElementById(id).disabled = busy;
  updatePharmacologyPublishButton_();
}

function invalidatePharmacologyPreview_() {
  pharmacologyAdmin.draft = null;
  document.getElementById("pharmacologyReview").checked = false;
  document.getElementById("pharmacologyPreview").innerHTML = "";
  document.getElementById("pharmacologyAdminStatus").textContent = "";
  updatePharmacologyPublishButton_();
}

function updatePharmacologyPublishButton_() {
  const reviewed = document.getElementById("pharmacologyReview").checked;
  const label = document.getElementById("pharmacologyReviewLabel");
  label.classList[reviewed ? "add" : "remove"]("isReviewed");
  document.getElementById("pharmacologyReviewState").textContent = reviewed ? "✓ הבדיקה סומנה" : "יש לסמן לאחר הבדיקה";
  document.getElementById("pharmacologyPublishBtn").disabled = pharmacologyAdmin.busy || !pharmacologyAdmin.draft || !reviewed;
}

function choosePharmacologyFile_() {
  if (!pharmacologyAdmin.open || pharmacologyAdmin.busy || !currentUserIsAdmin || !auth?.currentUser) return;
  document.getElementById("pharmacologyFileInput").click();
}

function editPharmacologyInput_() {
  invalidatePharmacologyPreview_();
  document.getElementById("pharmacologySourceInfo").textContent = "הטקסט נערך. יש לבדוק את התצוגה המקדימה מחדש.";
}

async function copyPharmacologyPrompt_() {
  if (!pharmacologyAdmin.open || !currentUserIsAdmin || !auth?.currentUser) return false;
  const session = pharmacologyAdmin.session;
  const uid = auth.currentUser.uid;
  const isCurrent = () => session === pharmacologyAdmin.session && pharmacologyAdmin.open && currentUserIsAdmin && auth?.currentUser?.uid === uid;
  const field = document.getElementById("pharmacologyAiPrompt");
  const status = document.getElementById("pharmacologyPromptStatus");
  const text = PharmacologyRoster.buildAiPrompt();
  field.value = text;
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE");
    await navigator.clipboard.writeText(text);
    if (isCurrent()) status.textContent = "ההוראות הועתקו. הדביקו אותן בצ׳אט וצרפו את תמונת הלוח.";
    return true;
  } catch (_) {
    if (!isCurrent()) return false;
    // Older/mobile browsers may deny Clipboard API; keep a selectable manual fallback.
    const priorFocus = document.activeElement;
    const details = field.closest("details");
    if (details) details.open = true;
    field.focus();
    field.select();
    field.setSelectionRange(0, text.length);
    let copied = false;
    try { copied = typeof document.execCommand === "function" && document.execCommand("copy"); } catch (_) { /* Manual selection remains available. */ }
    status.textContent = copied ? "ההוראות הועתקו. הדביקו אותן בצ׳אט וצרפו את תמונת הלוח."
      : "ההעתקה האוטומטית חסומה. ההוראות מסומנות להעתקה: לחצו לחיצה ארוכה ובחרו ׳העתקה׳, או העתיקו במקלדת.";
    if (copied && priorFocus?.isConnected) priorFocus.focus();
    return Boolean(copied);
  }
}

function pharmacologyServiceError_(error, publishing = false) {
  const code = String(error?.code || "").replace(/^firestore\//, "");
  const reason = code === "permission-denied" ? "אין הרשאה לפעולה. ודאו שאתם מחוברים כמנהלי מערכת ורעננו את האפליקציה."
    : code === "unauthenticated" ? "החיבור לחשבון פג. יש להתחבר מחדש כמנהל מערכת."
    : ["unavailable", "deadline-exceeded"].includes(code) ? "לא ניתן להתחבר לשרת כעת. בדקו את חיבור האינטרנט ונסו שוב."
    : code === "resource-exhausted" ? "השירות הגיע למגבלת שימוש זמנית. נסו שוב מאוחר יותר."
    : "לא ניתן להשלים את הבדיקה מול השרת כעת. נסו שוב; אם הבעיה חוזרת, פנו למנהל המערכת.";
  return (publishing ? "לא התקבל אישור שהלוח פורסם. " : "הקלט תקין והתצוגה המקדימה זמינה, אך הפרסום חסום עד בדיקת השרת. ")
    + reason + (publishing ? " לפני ניסיון פרסום נוסף, לחצו שוב על בדיקה ותצוגה מקדימה כדי לוודא את מצב הלוח." : "");
}

async function handlePharmacologyFile_(event) {
  const picker = event.target;
  const file = picker.files?.[0];
  picker.value = ""; // Allows selecting the same file after a correction or failed read.
  if (!file || !pharmacologyAdmin.open || pharmacologyAdmin.busy || !currentUserIsAdmin || !auth?.currentUser) return;
  invalidatePharmacologyPreview_();
  const status = document.getElementById("pharmacologyAdminStatus");
  const info = document.getElementById("pharmacologySourceInfo");
  if (!/\.(json|txt)$/i.test(file.name)) {
    status.textContent = "בחרו קובץ JSON או TXT שמכיל את פלט ה־JSON. תמונה ו־Excel אינם נתמכים כאן. הטקסט הקודם לא השתנה.";
    return;
  }
  if (file.size > 100 * 1024) {
    status.textContent = "הקובץ גדול מ־100KB. בחרו את קובץ הטקסט של הלוח בלבד. הטקסט הקודם לא השתנה.";
    return;
  }
  const session = pharmacologyAdmin.session;
  const uid = auth.currentUser.uid;
  const isCurrent = () => session === pharmacologyAdmin.session && pharmacologyAdmin.open && currentUserIsAdmin && auth?.currentUser?.uid === uid;
  setPharmacologyAdminBusy_(true);
  info.textContent = `קורא את הקובץ ${file.name} במכשיר…`;
  let loaded = false;
  try {
    const input = await file.text();
    if (!isCurrent()) return;
    document.getElementById("pharmacologyJsonInput").value = input;
    info.textContent = `הקובץ ${file.name} נקרא במכשיר. עדיין לא פורסם דבר.`;
    loaded = true;
  } catch (_) {
    if (isCurrent()) {
      info.textContent = "קריאת הקובץ נכשלה. הטקסט הקודם לא השתנה.";
      status.textContent = "לא ניתן לקרוא את הקובץ. שמרו אותו כטקסט UTF-8 ונסו שוב, או הדביקו את תוכנו בשדה.";
    }
  } finally {
    if (session === pharmacologyAdmin.session) setPharmacologyAdminBusy_(false);
  }
  if (loaded && isCurrent()) await previewPharmacology_();
}

function renderPharmacologyPreview_(result) {
  const entries = result.roster.entries;
  const groups = new Map();
  entries.forEach(entry => {
    if (!groups.has(entry.date)) groups.set(entry.date, []);
    groups.get(entry.date).push(entry);
  });
  const callable = entries.filter(entry => !entry.uncertain && entry.phone).length;
  const uncertain = entries.filter(entry => entry.uncertain).length;
  const unknownHours = entries.filter(entry => !entry.start || !entry.end).length;
  document.getElementById("pharmacologyPreview").innerHTML = `<h4>תצוגה מקדימה · ${escapeHtml(result.roster.month)}</h4>
    ${result.repairs?.length ? `<div class="pharmacologyRepairNotice" role="status"><strong>תוקנו סימני עיצוב שהשתבשו בהעתקה</strong>
      <ul>${result.repairs.map(repair => `<li>${escapeHtml(repair)}</li>`).join("")}</ul>
      <p>לא הושלמו פרטים חסרים. בדקו את השמות, המספרים והשיבוצים מול התמונה לפני פרסום.</p>
      <details><summary>הצגת ה־JSON לאחר תיקון המבנה</summary><label class="srOnly" for="pharmacologyNormalizedJson">JSON לאחר תיקון מבנה ההעתקה</label><textarea id="pharmacologyNormalizedJson" class="pharmacologyJson" dir="ltr" rows="5" readonly>${escapeHtml(result.normalizedInput || "")}</textarea></details></div>` : ""}
    <div class="pharmacologyPreviewSummary" role="status">${entries.length} שיבוצים ב־${groups.size} תאריכים. כפתור חיוג יופיע ב־${callable} שיבוצים.<br>
      ${unknownHours} שיבוצים ללא שעות: לא ייקבע עבורם מי כונן כעת.
      ${uncertain ? `<br><strong>${uncertain} שיבוצים מסומנים כלא ודאיים ולא יציגו כפתור חיוג. סימון ״בדקתי״ אינו מבטל אי־ודאות. יש לתקן את הפלט רק לאחר אימות מול המקור.</strong>` : ""}</div>
    ${result.warnings.length ? `<details class="pharmacologyWarning"><summary>פירוט האזהרות (${result.warnings.length})</summary><ul>${result.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></details>` : ""}
    ${[...groups].sort(([left], [right]) => left.localeCompare(right)).map(([date, rows]) => `<section><h5>${escapeHtml(pharmacologyDateLabel_(date))}</h5>${pharmacologyCards_(rows, null, true)}</section>`).join("")}
    ${result.roster.notes ? `<p class="pharmacologyNotes">${escapeHtml(result.roster.notes)}</p>` : ""}`;
}

async function previewPharmacology_() {
  if (!currentUserIsAdmin || !auth?.currentUser || pharmacologyAdmin.busy || !pharmacologyAdmin.open) return;
  invalidatePharmacologyPreview_();
  const input = document.getElementById("pharmacologyJsonInput").value;
  const result = PharmacologyRoster.analyze(input);
  const status = document.getElementById("pharmacologyAdminStatus");
  if (!result.valid) { status.textContent = result.errors.join("\n"); return; }
  renderPharmacologyPreview_(result); // Show local validation even if server access fails.
  const session = pharmacologyAdmin.session;
  const uid = auth.currentUser.uid;
  setPharmacologyAdminBusy_(true);
  status.textContent = "הקלט תקין. בודק אם קיים לוח לחודש הזה לפני פתיחת אפשרות הפרסום…";
  try {
    const snapshot = await firebaseApi.getDocFromServer(firebaseApi.doc(db, PHARMACOLOGY_COLLECTION, result.roster.month));
    if (session !== pharmacologyAdmin.session || !currentUserIsAdmin || auth?.currentUser?.uid !== uid) return;
    if (input !== document.getElementById("pharmacologyJsonInput").value) { invalidatePharmacologyPreview_(); return; }
    pharmacologyAdmin.expectedVersion = snapshot.exists() ? String(snapshot.data().version || "") : null;
    pharmacologyAdmin.draft = result.roster;
    pharmacologyAdmin.input = input;
    status.textContent = snapshot.exists() ? "קיים לוח לחודש הזה. הפרסום יחליף אותו לאחר אישורך." : "הטיוטה מוכנה לבדיקה. היא עדיין לא פורסמה.";
  } catch (error) {
    if (session === pharmacologyAdmin.session && auth?.currentUser?.uid === uid) status.textContent = pharmacologyServiceError_(error);
  } finally {
    if (session === pharmacologyAdmin.session) setPharmacologyAdminBusy_(false);
  }
}

async function publishPharmacology_() {
  const state = pharmacologyAdmin;
  if (!currentUserIsAdmin || !auth?.currentUser || !state.open || state.busy || !state.draft || !document.getElementById("pharmacologyReview").checked) return;
  if (document.getElementById("pharmacologyJsonInput").value !== state.input) { invalidatePharmacologyPreview_(); return; }
  const session = state.session;
  const user = auth.currentUser;
  const draft = state.draft;
  const expectedVersion = state.expectedVersion;
  state.publishing = true;
  setPharmacologyAdminBusy_(true);
  const noCall = draft.entries.filter(entry => entry.uncertain || !entry.phone).length;
  const approved = await requestAdminConfirmation_({ title: "פרסום לוח כוננות", message: `לפרסם את לוח ${draft.month} לכל המשתמשים המורשים? יש לוודא שכל השמות, המספרים והשיבוצים נבדקו מול התמונה.${noCall ? ` ב־${noCall} שיבוצים לא יוצג כפתור חיוג בגלל אי־ודאות או מספר חסר.` : ""}`, confirmLabel: "פרסום הלוח", tone: "primary" });
  if (session !== pharmacologyAdmin.session) return;
  if (!approved || !currentUserIsAdmin || auth.currentUser?.uid !== user.uid) { setPharmacologyAdminBusy_(false); return; }
  const status = document.getElementById("pharmacologyAdminStatus");
  status.textContent = "מפרסם את הלוח…";
  const version = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  try {
    const ref = firebaseApi.doc(db, PHARMACOLOGY_COLLECTION, draft.month);
    await firebaseApi.runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const actualVersion = snapshot.exists() ? String(snapshot.data().version || "") : null;
      if (actualVersion !== expectedVersion) throw new Error("ROSTER_CHANGED");
      if (session !== pharmacologyAdmin.session || !currentUserIsAdmin || auth.currentUser?.uid !== user.uid) throw new Error("SESSION_CHANGED");
      transaction.set(ref, { ...draft, version, reviewed: true, publishedAt: firebaseApi.serverTimestamp(), publishedBy: user.email });
    });
    if (session !== pharmacologyAdmin.session) return;
    state.expectedVersion = version;
    state.draft = null;
    document.getElementById("pharmacologyReview").checked = false;
    if (pharmacologyState.open) loadPharmacology_();
    setPharmacologyAdminBusy_(false);
    closePharmacologyAdmin_();
    setAdminStatus(`לוח ${draft.month} פורסם בהצלחה למשתמשים המורשים.`, "success");
  } catch (error) {
    if (session !== pharmacologyAdmin.session) return;
    state.draft = null;
    document.getElementById("pharmacologyReview").checked = false;
    status.textContent = error.message === "ROSTER_CHANGED" ? "הלוח השתנה מאז הבדיקה. לחצו על תצוגה מקדימה ובדקו שוב לפני פרסום." : pharmacologyServiceError_(error, true);
  } finally {
    if (session === pharmacologyAdmin.session) setPharmacologyAdminBusy_(false);
  }
}

document.addEventListener("visibilitychange", refreshPharmacologyClock_);
window.addEventListener("focus", refreshPharmacologyClock_);
document.addEventListener("keydown", event => {
  if (event.defaultPrevented) return;
  if (pharmacologyAdmin.open && event.key === "Tab") {
    const confirmation = document.getElementById("adminConfirmModal");
    const modal = confirmation?.classList.contains("visible") ? confirmation : document.getElementById("pharmacologyAdminModal");
    const controls = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]')].filter(node => node.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    return;
  }
  if (event.key !== "Escape") return;
  if (pharmacologyAdmin.open && document.getElementById("adminConfirmModal")?.classList.contains("visible")) { resolveAdminConfirmation_(false); return; }
  if (pharmacologyAdmin.open) { closePharmacologyAdmin_(); return; }
  closePharmacologyView_();
});
