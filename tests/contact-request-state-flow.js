// Regression tests execute production functions with only DOM/network services mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const functions = [
  'splitPickedContactName_', 'pickContactFromDevice_', 'startRequestModalSession_', 'setMyProfileStatus_', 'openMyProfileModal', 'closeMyProfileModal', 'submitMyProfileUpdate_',
  'setContactAddStatus_', 'resetContactAddDuplicateWarning_', 'getLikelyDuplicateContact_', 'showContactDuplicateWarning_',
  'resetContactAddForm_', 'setContactAddFormValues_', 'bindContactAddDuplicateReset_', 'openContactAddModal_',
  'openContactUpdateModal_', 'openContactAddRequestForApproval_', 'closeContactAddModal_', 'submitContactAddRequest_',
  'openContactReportModal', 'openMonthlyInternReport_', 'closeContactReportModal', 'submitContactReport',
  'getContactAddFormValues_', 'findEquivalentPendingContactRequest_', 'findEquivalentOpenReport_',
  'findLatestUserContactRequest_', 'getTimestampMillis_', 'getUserRequestStatusPresentation_', 'updateContactDetailRequestStatus_'
];
function extract(name) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(source);
  assert.ok(match, name);
  return source.slice(match.index, source.indexOf('\n}', match.index) + 2);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup() {
  const nodes = new Map(), writes = [], timers = [];
  const el = id => {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, { value: '', disabled: false, textContent: '', hidden: false, style: {},
        classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
          toggle: (c, on) => on ? classes.add(c) : classes.delete(c) } });
    }
    return nodes.get(id);
  };
  const contacts = [1, 2].map(id => ({ id, docId: `contact-${id}`, first: `First${id}`, last: `Last${id}`,
    name: `Name${id}`, title: '', role: '', dept: '', phone: `050000000${id}`, email: `person${id}@example.test` }));
  const context = vm.createContext({
    console: { error() {}, warn() {} }, Date, Set, Map,
    requestModalSessions_: {}, activeContactUpdate: null, contactAddSource: 'manual', contactAddModalMode: 'user',
    activeContactAddRequestId: '', contactAddDuplicateConfirmed: false, activeReportContact: null, myProfileContact: null,
    contacts, currentUserHasAppAccess: true, auth: { currentUser: { uid: 'synthetic', email: 'user@example.test' } },
    db: {}, monthlyInternsState: { version: 'v1' }, userRequestState: { contactRequests: [], reports: [], loadedAt: 0 },
    document: { getElementById: el, body: { style: {} } },
    normalizePhone: v => String(v || '').replace(/\D/g, ''), normalizeEmail: v => String(v || '').trim().toLowerCase(),
    formatPhoneForDisplay: v => v, escapeHtml: v => v, getContactDisplayName_: c => c.name,
    isValidEmail: v => v.includes('@'), hasUsableContactPhone_: v => /^\d{10}$/.test(v),
    contactPickerSupported_: () => false, getIsraelDateKey_: () => '2026-11-09',
    getMyProfileContact_: () => contacts[0], getMonthlyInternById_: id => ({ id, name: 'Intern', phone: '0511111111', department: 'A' }),
    setStatus: (id, text, type) => { el(id).textContent = text; el(id).statusType = type; },
    setTimeout: callback => timers.push(callback), alert: message => { throw new Error(message); },
    getCooldownSubmissionDocumentId_: (kind, user) => `${kind}_${user.uid}`,
    loadUserRequestStatuses_: async () => {},
    firebaseApi: { serverTimestamp: () => 'server-time', doc: (_db, collection, id) => ({ collection, id }),
      setDoc: async (ref, payload) => { writes.push({ ref, payload }); } }
  });
  vm.runInContext(functions.map(extract).join('\n'), context);
  return { c: context, el, writes, timers, contacts };
}
async function flush() { await Promise.resolve(); await Promise.resolve(); }
function editAdd(h, text = 'Edited') { h.el('contactAddFirstName').value = text; }

(async () => {
  // Picker starts in the click's synchronous turn; normal selections and cancellation reset correctly.
  for (const result of ['selection', 'empty', 'cancel', 'error']) {
    const h = setup(), gate = deferred(); let calls = 0;
    h.c.contactPickerSupported_ = () => true;
    h.c.navigator = { contacts: { select: () => { calls += 1; return gate.promise; } } };
    h.c.openContactAddModal_(); await flush();
    const pick = h.c.pickContactFromDevice_();
    assert.equal(calls, 1, 'Do not defer the native picker beyond the user gesture');
    await h.c.pickContactFromDevice_(); assert.equal(calls, 1);
    if (result === 'cancel') gate.reject({ name: 'AbortError' });
    else if (result === 'error') gate.reject(new Error('picker failure'));
    else gate.resolve(result === 'empty' ? [] : [{ name: ['Test Person'], tel: ['0501234567'], email: ['test@example.test'] }]);
    await pick;
    assert.equal(h.el('contactPickerBtn').disabled, false);
    if (result === 'selection') {
      assert.equal(h.el('contactAddFirstName').value, 'Test');
      assert.equal(h.el('contactAddLastName').value, 'Person');
      assert.equal(h.el('contactAddPhone').value, '0501234567');
      assert.equal(h.el('contactAddEmail').value, 'test@example.test');
      assert.equal(h.c.contactAddSource, 'device_picker');
      assert.equal(h.el('contactAddStatus').statusType, 'success');
    } else {
      assert.equal(h.el('contactAddFirstName').value, '');
      assert.equal(h.c.contactAddSource, 'manual');
      assert.equal(h.el('contactAddStatus').statusType, result === 'error' ? 'error' : '');
    }
  }
  // A delayed selection/error cannot touch the next form or enable its own pending picker.
  for (const fail of [false, true]) {
    const h = setup(), oldGate = deferred(), newGate = deferred(); let calls = 0;
    h.c.contactPickerSupported_ = () => true;
    h.c.navigator = { contacts: { select: () => ++calls === 1 ? oldGate.promise : newGate.promise } };
    h.c.openContactAddModal_(); await flush();
    const oldPick = h.c.pickContactFromDevice_();
    h.c.closeContactAddModal_(); h.c.openContactAddModal_(); await flush();
    assert.equal(h.el('contactPickerBtn').disabled, false);
    editAdd(h, 'Fresh'); h.el('contactAddPhone').value = '0500000002'; h.el('contactAddEmail').value = 'fresh@example.test';
    const newPick = h.c.pickContactFromDevice_();
    if (fail) oldGate.reject(new Error('late failure'));
    else oldGate.resolve([{ name: ['Old Person'], tel: ['0501111111'], email: ['old@example.test'] }]);
    await oldPick;
    assert.equal(h.el('contactAddFirstName').value, 'Fresh');
    assert.equal(h.el('contactAddPhone').value, '0500000002');
    assert.equal(h.el('contactAddEmail').value, 'fresh@example.test');
    assert.equal(h.c.contactAddSource, 'manual');
    assert.equal(h.el('contactAddStatus').statusType, 'loading');
    assert.equal(h.el('contactPickerBtn').disabled, true);
    newGate.resolve([]); await newPick;
    assert.equal(h.el('contactPickerBtn').disabled, false);
  }
  // Submitting invalidates outstanding picker results even when that submission subsequently fails.
  for (const order of ['picker-first', 'success-first', 'failure-first']) {
    const h = setup(), pickerGate = deferred(), writeGate = deferred();
    h.c.contactPickerSupported_ = () => true;
    h.c.navigator = { contacts: { select: () => pickerGate.promise } };
    h.c.firebaseApi.setDoc = () => writeGate.promise;
    h.c.openContactAddModal_(); await flush(); editAdd(h, 'Submitted');
    const pick = h.c.pickContactFromDevice_();
    const submit = h.c.submitContactAddRequest_(); await flush();
    if (order === 'success-first') { writeGate.resolve(); await submit; }
    if (order === 'failure-first') { writeGate.reject(new Error('offline')); await submit; }
    const beforeStatus = h.el('contactAddStatus').textContent;
    pickerGate.resolve([{ name: ['Must Not Apply'], tel: ['0501111111'] }]); await pick;
    assert.equal(h.el('contactAddFirstName').value, 'Submitted');
    assert.equal(h.c.contactAddSource, 'manual');
    assert.equal(h.el('contactAddStatus').textContent, beforeStatus);
    if (order === 'picker-first') { writeGate.reject(new Error('offline')); await submit; }
    assert.equal(h.el('contactPickerBtn').disabled, order === 'success-first');
  }
  // Switch contacts while preflight is pending: payload must stay A and B stays editable.
  {
    const h = setup(), { c, el, writes } = h;
    c.openContactUpdateModal_(1); await flush(); editAdd(h, 'Edited A');
    const gate = deferred(); c.loadUserRequestStatuses_ = () => gate.promise;
    const pending = c.submitContactAddRequest_();
    await c.submitContactAddRequest_(); // double click does not start another write
    c.closeContactAddModal_(); c.openContactUpdateModal_(2); editAdd(h, 'Edited B');
    gate.resolve(); await pending; await flush();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].payload.firstName, 'Edited A');
    assert.equal(writes[0].payload.originalContactId, 'contact-1');
    assert.equal(writes[0].payload.originalPhone, h.contacts[0].phone);
    assert.equal(writes[0].payload.originalEmail, h.contacts[0].email);
    assert.equal(writes[0].payload.source, 'contact_detail');
    assert.match(writes[0].ref.id, /^update_/);
    assert.equal(el('contactAddFirstName').value, 'Edited B');
    assert.equal(el('contactAddSubmitBtn').disabled, false);
    assert.equal(el('contactAddStatus').textContent, '');
    assert.equal(h.timers.length, 0);
    await c.submitContactAddRequest_(); assert.equal(writes[1].payload.originalContactId, 'contact-2');
  }
  // Equivalent-request lookup also uses A's identity, without marking B as pending.
  {
    const h = setup(); h.c.openContactUpdateModal_(1); await flush(); editAdd(h);
    const gate = deferred(); h.c.loadUserRequestStatuses_ = () => gate.promise;
    const pending = h.c.submitContactAddRequest_();
    h.c.closeContactAddModal_(); h.c.openContactUpdateModal_(2);
    h.c.userRequestState.contactRequests.push({ requestType: 'contact_update', originalContactId: 'contact-1', status: 'pending' });
    gate.resolve(); await pending; await flush();
    assert.equal(h.writes.length, 0);
    assert.equal(h.el('contactAddStatus').textContent, '');
    assert.equal(h.el('contactAddSubmitBtn').disabled, false);
  }
  // A stale opener's status lookup must not overwrite a later opening of the same form.
  {
    const h = setup(), gate = deferred();
    h.c.loadUserRequestStatuses_ = () => gate.promise;
    h.c.openContactAddModal_(); h.c.closeContactAddModal_();
    h.c.loadUserRequestStatuses_ = async () => {};
    h.c.openContactAddModal_(); await flush();
    h.c.userRequestState.contactRequests.push({ requestType: 'contact_add', status: 'approved' });
    gate.resolve(); await flush();
    assert.equal(h.el('contactAddStatus').textContent, '');
  }
  // The source is frozen before preflight, even if the reopened form resets it.
  {
    const h = setup(); h.c.openContactAddModal_(); await flush(); editAdd(h);
    h.c.contactAddSource = 'device_picker';
    const gate = deferred(); h.c.loadUserRequestStatuses_ = () => gate.promise;
    const pending = h.c.submitContactAddRequest_();
    h.c.closeContactAddModal_(); h.c.openContactAddModal_();
    gate.resolve(); await pending;
    assert.equal(h.writes[0].payload.source, 'device_picker');
    assert.equal(h.writes[0].payload.requestType, 'contact_add');
    assert.match(h.writes[0].ref.id, /^add_/);
  }
  // Closing without reopening still sends the captured request, with no stale UI.
  {
    const h = setup(); h.c.openContactUpdateModal_(1); await flush(); editAdd(h);
    const gate = deferred(); h.c.loadUserRequestStatuses_ = () => gate.promise;
    const pending = h.c.submitContactAddRequest_(); h.c.closeContactAddModal_();
    gate.resolve(); await pending;
    assert.equal(h.writes[0].payload.originalContactId, 'contact-1');
    assert.equal(h.el('contactAddStatus').textContent, '');
  }
  // Capture add-source too, and never enable a newer in-flight form on old failure.
  {
    const h = setup(); h.c.openContactAddModal_(); await flush(); editAdd(h);
    h.c.contactAddSource = 'device_picker';
    const writeA = deferred(), writeB = deferred();
    h.c.firebaseApi.setDoc = async (ref, payload) => {
      h.writes.push({ ref, payload }); return h.writes.length === 1 ? writeA.promise : writeB.promise;
    };
    const a = h.c.submitContactAddRequest_(); await flush();
    h.c.closeContactAddModal_(); h.c.openContactUpdateModal_(2); editAdd(h, 'B');
    const b = h.c.submitContactAddRequest_(); await flush();
    writeA.reject(new Error('network')); await a;
    assert.equal(h.writes[0].payload.source, 'device_picker');
    assert.equal(h.el('contactAddSubmitBtn').disabled, true);
    assert.equal(h.el('contactAddStatus').statusType, 'loading');
    writeB.resolve(); await b;
  }
  // An actual rejected write is recoverable; successful repeats are blocked; old timers cannot close a fresh form.
  {
    const h = setup(); h.c.openContactAddModal_(); await flush(); editAdd(h);
    h.c.firebaseApi.setDoc = async () => { throw new Error('offline'); };
    await h.c.submitContactAddRequest_();
    assert.equal(h.el('contactAddStatus').statusType, 'error');
    assert.equal(h.el('contactAddSubmitBtn').disabled, false);
    h.c.firebaseApi.setDoc = async (ref, payload) => h.writes.push({ ref, payload });
    await h.c.submitContactAddRequest_(); await h.c.submitContactAddRequest_();
    assert.equal(h.writes.length, 1);
    h.c.closeContactAddModal_(); h.c.openContactAddModal_(); editAdd(h, 'Fresh');
    h.timers.forEach(run => run());
    assert.equal(h.el('contactAddModal').classList.contains('visible'), true);
    assert.equal(h.el('contactAddFirstName').value, 'Fresh');
    assert.equal(h.el('contactAddSubmitBtn').disabled, false);
  }
  // The same interruption hazards apply to reports, including monthly intern metadata.
  for (const intern of [false, true]) {
    const h = setup();
    if (intern) h.c.openMonthlyInternReport_('intern-a'); else h.c.openContactReportModal(1);
    h.el('contactReportDetails').value = 'Wrong number';
    const gate = deferred(); h.c.loadUserRequestStatuses_ = () => gate.promise;
    const a = h.c.submitContactReport(); await h.c.submitContactReport();
    h.c.closeContactReportModal(); h.c.openContactReportModal(2);
    h.c.monthlyInternsState.version = 'v2';
    h.el('contactReportDetails').value = 'New details';
    gate.resolve(); await a;
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].payload.details, 'Wrong number');
    if (intern) {
      assert.equal(h.writes[0].payload.internId, 'intern-a');
      assert.equal(h.writes[0].payload.internVersion, 'v1');
    } else assert.equal(h.writes[0].payload.contactDocId, 'contact-1');
    assert.equal(h.el('contactReportDetails').value, 'New details');
    assert.equal(h.el('contactReportSubmitBtn').disabled, false);
    assert.equal(h.el('contactReportStatus').textContent, '');
    await h.c.submitContactReport();
    h.c.closeContactReportModal(); h.c.openContactReportModal(1);
    h.timers.forEach(run => run());
    assert.equal(h.el('contactReportModal').classList.contains('visible'), true);
  }
  // Late success/failure from profile and report must not overwrite a newly opened form.
  for (const kind of ['profile', 'report']) for (const fail of [false, true]) {
    const h = setup(), { c, el } = h;
    const open = () => kind === 'profile' ? c.openMyProfileModal() : c.openContactReportModal(1);
    const close = () => kind === 'profile' ? c.closeMyProfileModal() : c.closeContactReportModal();
    const submit = () => kind === 'profile' ? c.submitMyProfileUpdate_() : c.submitContactReport();
    const prefix = kind === 'profile' ? 'myProfile' : 'contactReport';
    const field = kind === 'profile' ? 'myProfileFirstName' : 'contactReportDetails';
    open(); el(field).value = 'Changed';
    const gate = deferred(); c.firebaseApi.setDoc = () => gate.promise;
    const old = submit(); await flush(); await submit();
    close(); open(); el(field).value = 'Fresh';
    if (fail) gate.reject(new Error('rejected')); else gate.resolve();
    await old;
    assert.equal(el(prefix + 'Status').textContent, '');
    assert.equal(el(prefix + 'SubmitBtn').disabled, false);
    assert.equal(el(field).value, 'Fresh');
    c.firebaseApi.setDoc = async () => {};
    await submit(); await submit();
    close(); open(); h.timers.forEach(run => run());
    assert.equal(el(prefix + 'Modal').classList.contains('visible'), true);
  }
  // Pending and resolved statuses remain independently visible, in either chronological order.
  for (const updateStatus of ['approved', 'rejected', 'pending']) for (const reportStatus of ['open', 'resolved']) {
    for (const newerReport of [true, false]) {
      const h = setup();
      h.c.userRequestState.contactRequests = [{ requestType: 'contact_update', originalContactId: 'contact-1', status: updateStatus, createdAt: newerReport ? 100 : 200 }];
      h.c.userRequestState.reports = [{ contactDocId: 'contact-1', status: reportStatus, createdAt: newerReport ? 200 : 100 }];
      h.c.updateContactDetailRequestStatus_(h.contacts[0]);
      const status = h.el('contactDetailRequestStatus');
      assert.match(status.textContent, /עדכון פרטים:/); assert.match(status.textContent, /דיווח:/);
      assert.ok(status.textContent.includes(h.c.getUserRequestStatusPresentation_(updateStatus).label));
      assert.ok(status.textContent.includes(h.c.getUserRequestStatusPresentation_(reportStatus, 'report').label));
      if (updateStatus === 'pending' || reportStatus === 'open') assert.match(status.className, /pending/);
    }
  }
  // Older outstanding work must not disappear behind newer resolved work of the same kind.
  {
    const h = setup();
    h.c.userRequestState.contactRequests = ['pending', 'approved'].map((status, i) => ({ requestType: 'contact_update', originalContactId: 'contact-1', status, createdAt: 100 + i }));
    h.c.userRequestState.reports = ['open', 'resolved'].map((status, i) => ({ contactDocId: 'contact-1', status, createdAt: 100 + i }));
    h.c.updateContactDetailRequestStatus_(h.contacts[0]);
    assert.equal(h.el('contactDetailRequestStatus').textContent, 'עדכון פרטים: ממתין לאישור · דיווח: ממתין לטיפול');
    h.c.updateContactDetailRequestStatus_({ docId: 'other', phone: '' });
    assert.equal(h.el('contactDetailRequestStatus').hidden, true);
  }
  console.log('Contact request state regressions passed (synthetic services; no real writes).');
})().catch(error => { console.error(error); process.exitCode = 1; });
