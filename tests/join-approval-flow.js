// Offline regression coverage: evaluate real functions with all I/O mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const backend = fs.readFileSync(path.join(__dirname, '..', 'WebEndpoints.gs'), 'utf8');
function extract(source, name) {
  const match = new RegExp(`(?:async )?function ${name}\\(`).exec(source);
  assert(match, name);
  // Top-level functions are separated by a newline and closing brace.
  return source.slice(match.index, source.indexOf('\n}', match.index) + 2);
}
const normEmail = v => String(v || '').trim().toLowerCase();
const user = { email: 'new@example.com', phone: '+972501234567', active: true, phonePermissionActive: true };
const join = { docId: 'join', status: 'pending', requestType: 'contact_add', grantAccessOnApproval: true, email: ' NEW@example.com ', phone: '050-1234567', createdAt: 20 };
let verification;
const ctx = {
  adminAllowedUsers: [user], adminContactAddRequests: [join], adminReports: [],
  normalizeEmail: normEmail,
  getEffectiveVerificationRequestForUser_: () => verification,
  getUserAccessState_: u => ({ key: u.state || 'pending' }),
  getAdminTimestampMillis_: v => Number(v) || 0,
  getPendingPasswordResetRequests_: () => [],
  getContactAddRequestTimestamp_: r => r.createdAt,
  getReportTimestamp_: r => r.createdAt,
};
vm.createContext(ctx);
vm.runInContext(['normalizePhone', 'getLinkedJoinRequestForUser_', 'getAdminAttentionItems_'].map(n => extract(app, n)).join('\n'), ctx);
function reset() {
  ctx.adminAllowedUsers = [{ ...user }];
  ctx.adminContactAddRequests = [{ ...join }];
  verification = { email: user.email, phone: user.phone, status: 'pending', requestedAt: 10, reviewRequestedNow: true };
}
reset();
let items = ctx.getAdminAttentionItems_();
assert.equal(items.length, 1);
assert.equal(items[0].kind, 'contact');
assert.equal(items[0].priority, 1, 'Urgent access review survives merging');
for (const change of [
  r => r.grantAccessOnApproval = false,
  r => r.requestType = 'contact_update',
  r => r.requestType = 'self_update',
  r => r.email = 'other@example.com',
  r => r.phone = '0509999999',
  r => r.phone = '',
]) {
  reset(); change(ctx.adminContactAddRequests[0]);
  assert.equal(ctx.getAdminAttentionItems_().length, 2, 'Unrelated contact request stays separate');
}
reset(); verification.phone = '0509999999';
assert.equal(ctx.getAdminAttentionItems_().length, 2, 'Mismatched verification phone stays separate');
reset(); verification.email = 'other@example.com';
assert.equal(ctx.getAdminAttentionItems_().length, 2);
reset(); ctx.adminContactAddRequests.push({ ...join, docId: 'duplicate' });
assert.equal(ctx.getAdminAttentionItems_().length, 3, 'Ambiguous join requests must not be merged');
reset(); verification = { ...verification, phone: '', synthetic: true };
assert.equal(ctx.getAdminAttentionItems_().length, 1, 'Synthetic review uses verified user phone');
reset(); ctx.adminAllowedUsers[0].state = 'manual';
assert.equal(ctx.getLinkedJoinRequestForUser_(ctx.adminAllowedUsers[0]), null, 'Existing permanent access is not linked');
reset(); verification.status = 'rejected';
assert.equal(ctx.getLinkedJoinRequestForUser_(user), null);
reset(); ctx.adminAllowedUsers[0].phonePermissionActive = false;
assert.equal(ctx.getLinkedJoinRequestForUser_(ctx.adminAllowedUsers[0]), null);

// Real backend completion function: only the exact original/approved identity
// is completed; the request and verification writes share one guarded commit.
let written, backendVerification;
const server = {
  Date, Utilities: { getUuid: () => 'audit' },
  normalizeEmail_: normEmail,
  normalizeIsraeliPhone: ctx.normalizePhone,
  getContactDocumentId_: () => 'contact',
  getFirestoreDocumentName_: (c, id) => `${c}/${id}`,
  getAuthFlowDocument_: (collection, email) => {
    assert.equal(collection, 'verificationRequests');
    assert.equal(email, 'new@example.com');
    return backendVerification;
  },
  commitFirestoreWrites_: writes => { written = writes; }
};
vm.createContext(server);
vm.runInContext(extract(backend, 'completeApprovedContactRequest_'), server);
const approvedContact = { phone: user.phone, email: user.email };
const request = { id: 'join', updateTime: 'request-v1', data: { ...join } };
function complete(req = request, contact = approvedContact) {
  server.completeApprovedContactRequest_(req, {}, contact, 'admin@example.com');
}
backendVerification = { updateTime: 'verification-v1', data: { email: user.email, phone: user.phone, status: 'pending' } };
complete();
assert.equal(written.length, 3);
assert.equal(written[2].update.name, 'verificationRequests/new@example.com');
assert.equal(written[2].update.fields.status.stringValue, 'approved');
assert.equal(written[2].update.fields.temporaryAccessUntil.nullValue, null);
assert.equal(written[2].currentDocument.updateTime, 'verification-v1');
assert.equal(written[0].currentDocument.updateTime, 'request-v1');
assert(written.every(w => !w.update.name.startsWith('allowed')), 'Completion never revokes or changes access');
backendVerification.data.status = 'temporary_active'; complete(); assert.equal(written.length, 3);
for (const status of ['approved', 'rejected', 'revoked']) {
  backendVerification.data.status = status; complete(); assert.equal(written.length, 2);
}
backendVerification.data.status = 'pending';
backendVerification.data.phone = '0509999999'; complete(); assert.equal(written.length, 2);
backendVerification.data.phone = user.phone;
backendVerification.data.email = 'other@example.com'; complete(); assert.equal(written.length, 2);
backendVerification.data.email = user.email;
complete(request, { ...approvedContact, phone: '0509999999' }); assert.equal(written.length, 2);
complete({ ...request, data: { ...join, grantAccessOnApproval: false } }); assert.equal(written.length, 2);
complete({ ...request, data: { ...join, requestType: 'contact_update' } }); assert.equal(written.length, 2);
backendVerification = null; complete(); assert.equal(written.length, 2);
console.log('join approval flow: OK');

// Permanent shortcuts delegate to combined confirmation; temporary-only and
// unrelated actions keep their original validation/behavior.
(async () => {
  reset();
  let combined = 0, accessReason = 0;
  Object.assign(ctx, {
    currentUserIsAdmin: true,
    adminLoadedSections: new Set(['reports']),
    getAllowedUserByEmail: () => ctx.adminAllowedUsers[0],
    approveContactAddRequest_: async id => { assert.equal(id, 'join'); combined++; },
    findContactByEmail: () => null,
    findAdminContactByPhone_: () => null,
    canManagerForceApproveAccess_: () => false,
    formatPhoneForDisplay: p => p,
    requestAdminReason_: async () => { accessReason++; return null; },
    setAdminStatus: () => {}
  });
  vm.runInContext(extract(app, 'approveManualAccess_'), ctx);
  await ctx.approveManualAccess_(user.email, false);
  assert.equal(combined, 1);
  assert.equal(accessReason, 0);
  await ctx.approveManualAccess_(user.email, true);
  assert.equal(combined, 1);
  assert.equal(accessReason, 1, 'Temporary access remains access-only');
  ctx.adminContactAddRequests = [];
  await ctx.approveManualAccess_(user.email, false);
  assert.equal(combined, 1);
  assert.equal(accessReason, 2, 'Unrelated permanent access remains access-only');

  // A permanent action from an unloaded screen must await join data, or stop.
  reset();
  ctx.adminLoadedSections = new Set();
  let loadedReports = 0;
  ctx.loadAdminReportsData_ = () => {};
  ctx.loadAdminDataPart_ = async section => {
    assert.equal(section, 'reports');
    loadedReports++;
    ctx.adminLoadedSections.add('reports');
  };
  await ctx.approveManualAccess_(user.email, false);
  assert.equal(loadedReports, 1);
  assert.equal(combined, 2);
  ctx.adminLoadedSections.clear();
  ctx.loadAdminDataPart_ = async () => { throw new Error('mock read denied'); };
  await ctx.approveManualAccess_(user.email, false);
  assert.equal(combined, 2, 'Do not approve when join data cannot be read');
  assert.equal(accessReason, 2);

  // A combined rejection changes only the contact request, with explicit copy.
  reset();
  let confirmation, operations = [];
  Object.assign(ctx, {
    currentAdminEmail: 'admin@example.com', db: {},
    requestAdminConfirmation_: async options => { confirmation = options; return true; },
    getContactAddRequestName_: () => 'New Person',
    loadAdminData: async () => { ctx.adminContactAddRequests[0].status = 'rejected'; },
    firebaseApi: {
      doc: (_, collection, id) => ({ collection, id }),
      collection: (_, name) => name,
      serverTimestamp: () => 'now',
      writeBatch: () => ({
        update: (ref, data) => operations.push({ ref, data }),
        set: (ref, data) => operations.push({ ref, data }),
        commit: async () => {}
      })
    }
  });
  vm.runInContext(extract(app, 'rejectContactAddRequest_'), ctx);
  await ctx.rejectContactAddRequest_('join');
  assert.match(confirmation.message, /לא תבוטל/);
  assert.equal(operations[0].ref.collection, 'contactAddRequests');
  assert.equal(operations[0].data.status, 'rejected');
  assert.equal(operations.length, 2, 'Only contact rejection and audit are written');
  assert.equal(ctx.getAdminAttentionItems_().length, 1);
  assert.equal(ctx.getAdminAttentionItems_()[0].kind, 'access', 'Pending access returns for explicit review after rejection');
  console.log('join approval actions: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });

let stages = [], failAccess = false, released = 0;
Object.assign(server, {
  verifyFirebaseAdminIdToken_: () => ({ email: 'admin@example.com' }),
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => released++ }) },
  readContactAddRequestForApproval_: () => request,
  getContactApprovalValues_: () => approvedContact,
  upsertApprovedContactInContactsSheet_: () => ({ contact: approvedContact, created: true }),
  writeApprovedContactOverride_: () => stages.push('override'),
  upsertContact_: () => stages.push('contact'),
  readAndDeduplicateContacts_: () => [],
  buildEffectiveDirectoryContacts_: c => c,
  writeSmartContactDirectory_: () => stages.push('directory'),
  isValidEmail_: () => true,
  upsertAllowedUserPairAtomically_: (email, source, phone, options) => {
    stages.push('access');
    assert.equal(options.permanentApproval, true);
    if (failAccess) throw new Error('mock access failure');
    return {};
  },
  clearPublicAuthRouteCache_: () => {},
  completeApprovedContactRequest_: () => stages.push('complete')
});
vm.runInContext(extract(backend, 'approveContactAddRequestFromWeb_'), server);
assert.equal(server.approveContactAddRequestFromWeb_({}).accessGranted, true);
assert.deepEqual(stages, ['override', 'contact', 'directory', 'access', 'complete']);
failAccess = true; stages = [];
assert.throws(() => server.approveContactAddRequestFromWeb_({}), /mock access failure/);
assert(!stages.includes('complete'), 'Failed access grant must leave request pending for retry');
assert.equal(released, 2, 'Lock is released after success and failure');
console.log('join approval ordering: OK');

// Aggregate counts do not know identity overlap: no misleading double-count
// is shown until both users and requests are loaded.
const badges = {};
const countContext = {
  ...ctx,
  adminLoadedSections: new Set(),
  adminPendingSummary: { loaded: true, verificationRequests: 1, passwordResetRequests: 0, contactRequests: 1, contactReports: 0 },
  adminPasswordResetRequests: [],
  currentUserIsAdmin: true,
  document: { getElementById: id => badges[id] ||= {} },
};
vm.createContext(countContext);
vm.runInContext(['getAdminPendingCounts_', 'updateAdminPendingBadges_'].map(n => extract(app, n)).join('\n'), countContext);
countContext.updateAdminPendingBadges_();
assert.equal(badges.adminOpenPendingBadge.textContent, 'ממתין לטיפול');
assert.equal(badges.adminAttentionPendingBadge.textContent, '•');
countContext.adminLoadedSections.add('users');
countContext.adminLoadedSections.add('reports');
countContext.getLinkedJoinRequestForUser_ = () => join;
countContext.getEffectiveVerificationRequestForUser_ = () => ({ status: 'pending' });
countContext.adminContactAddRequests = [join];
countContext.updateAdminPendingBadges_();
assert.equal(badges.adminOpenPendingBadge.textContent, '1 לטיפול');
assert.equal(badges.adminAttentionPendingBadge.textContent, '1');
assert.equal(countContext.getAdminPendingCounts_().total, 1);
console.log('join approval counts: OK');
