const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function extract(name) {
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
  assert(match, `${name} exists`);
  return match[0];
}
const elements = new Map();
const classes = () => ({ add() {}, remove() {} });
let focused = '';
const element = id => {
  if (!elements.has(id)) elements.set(id, {
    classList: classes(), style: {}, setAttribute() {},
    focus() { focused = id; }, textContent: '', innerHTML: ''
  });
  return elements.get(id);
};
const s = {
  adminContacts: [], adminRemovedContacts: [], adminActiveFocus: null,
  adminLoadedSections: new Set(['contacts']), adminDailyActiveUsers: [],
  currentAdminEmail: 'admin@example.org',
  document: { getElementById: element, body: { classList: classes() }, querySelector: () => null },
  normalizeEmail: v => String(v || '').trim().toLowerCase(),
  getAllowedUserByEmail: email => s.users.find(u => u.email === s.normalizeEmail(email)),
  users: [], getAccountDisplayName_: email => email,
  getContactDisplayName_: c => c.name, formatPhoneForDisplay: v => v || '',
  getUserAccessState_: () => ({ label: 'פעיל' }),
  getAdminRegistrationTimestamp_: () => 0, getAdminTimestampMillis_: () => 0,
  getEffectiveVerificationRequestForUser_: () => null,
  getActivePasswordRecoveryForUser_: () => null,
  canManagerForceApproveAccess_: () => false,
  getAdminIconSvg_: () => '', renderAdminInfoRows_: () => '',
  escapeHtml: v => String(v || ''), escapeJsString: v => String(v || ''),
  getAdminNewUsersThisMonth_: () => s.users,
  getAdminUsersActiveToday_: () => s.users.map(user => ({ user })),
  getIsraelDateKey_: () => '2026-11-09', formatAdminRelativeTime_: () => '',
  getAdminSearchQuery: () => '', adminPersonMatchesQuery_: () => true,
  getVisibleAdminItems_: v => v, renderAdminLoadMore_: () => '',
  getAdminPeople_: () => [{ contact: s.adminRemovedContacts[0], user: null }],
  setAdminStatus: text => { s.status = text; },
  loadAdminContactsData_: () => {},
  loadAdminDataPart_: async () => { s.adminLoadedSections.add('contacts'); }
};
vm.createContext(s);
for (const name of ['resolveAdminPersonContact_', 'getAdminActiveUserPresentation_',
  'openAdminFocusSheet_', 'closeAdminFocusSheet_', 'openAdminUsageMetric_',
  'openAdminPerson_', 'renderAdminPeople_']) vm.runInContext(extract(name), s);
(async () => {
  const active = { docId: 'active', email: ' Doctor@Example.org ', name: 'Doctor', phone: '0501234567' };
  const removed = { docId: 'removed', email: 'removed@example.org', name: 'Removed', deleted: true };
  s.adminContacts = [active]; s.adminRemovedContacts = [removed];
  assert.equal(s.resolveAdminPersonContact_('', 'doctor@example.org'), active);
  assert.equal(s.resolveAdminPersonContact_('removed', ''), removed);
  assert.equal(s.resolveAdminPersonContact_('', ' REMOVED@example.org '), removed);
  assert.equal(s.resolveAdminPersonContact_('', ''), null);
  s.adminContacts.push({ docId: 'duplicate', email: 'doctor@example.org' });
  assert.equal(s.resolveAdminPersonContact_('', 'doctor@example.org'), null, 'Ambiguous email is not a match');
  assert.equal(s.resolveAdminPersonContact_('active', 'doctor@example.org'), active, 'Stable ID disambiguates');
  s.adminContacts.pop();
  assert.equal(s.getAdminActiveUserPresentation_({ email: 'other@example.org', phone: active.phone }).name,
    'other@example.org', 'Phone-only matches must not label a different account');
  s.users = [{ email: 'doctor@example.org', active: true }];
  for (const kind of ['new', 'today']) {
    await s.openAdminUsageMetric_(kind);
    assert.match(element('adminFocusBody').innerHTML, new RegExp(`openAdminPerson_\\('', 'doctor@example.org', '${kind}'\\)`));
    s.openAdminPerson_('', 'doctor@example.org', kind);
    assert.equal(element('adminFocusTitle').textContent, 'Doctor');
    assert.equal(s.adminActiveFocus.contactDocId, 'active');
    assert.equal(focused, 'adminFocusTitle', 'Initial focus must not be an access-changing button');
    assert.match(element('adminFocusBody').innerHTML, /עריכת פרטים/);
    s.closeAdminFocusSheet_();
    assert.equal(s.adminActiveFocus.type, 'metric');
    assert.equal(s.adminActiveFocus.kind, kind);
  }
  s.openAdminPerson_('', 'doctor@example.org', 'today');
  s.closeAdminFocusSheet_(false);
  assert.equal(s.adminActiveFocus, null, 'Action transitions must not reopen a metric');
  s.renderAdminPeople_();
  assert.match(element('adminList').innerHTML, /הוסר מהספר/);
  assert.match(element('adminList').innerHTML, /ללא כניסה/, 'Removal and login permission are separate statuses');
  s.adminLoadedSections.clear();
  let finish;
  s.loadAdminDataPart_ = () => new Promise(resolve => { finish = resolve; });
  const pending = s.openAdminUsageMetric_('today');
  s.closeAdminFocusSheet_();
  finish(); await pending;
  assert.equal(s.adminActiveFocus, null, 'A dismissed loading sheet must not reopen');
  s.loadAdminDataPart_ = async () => { throw new Error('offline'); };
  await s.openAdminUsageMetric_('new');
  assert.match(s.status, /נכשלה/);
  assert.equal(s.adminActiveFocus, null);
  console.log('Admin UX identity, neutral focus, metric origin, removal and loading regressions passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });

// Home summary must describe the stored request kind, without implying access state.
vm.runInContext(extract('getAdminPendingHomeSummary_'), s);
const summaryCounts = { total: 1, unified: true, contactRequests: 1 };
s.adminContactAddRequests = [{ status: 'pending', requestType: 'contact_add', grantAccessOnApproval: true }];
assert.equal(s.getAdminPendingHomeSummary_(summaryCounts), 'פריט אחד מחכה לך · בקשת הצטרפות');
s.adminContactAddRequests = [{ status: 'pending', requestType: 'contact_update' }];
assert.equal(s.getAdminPendingHomeSummary_(summaryCounts), 'פריט אחד מחכה לך · עדכון פרטים');
s.adminContactAddRequests = [{ status: 'pending', requestType: 'contact_add', grantAccessOnApproval: false }];
assert.equal(s.getAdminPendingHomeSummary_(summaryCounts), 'פריט אחד מחכה לך · הוספת איש קשר');
s.adminContactAddRequests.push({ status: 'pending', requestType: 'self_update' });
assert.equal(s.getAdminPendingHomeSummary_({ ...summaryCounts, total: 2, contactRequests: 2 }),
  '2 פריטים מחכים לך · הוספת איש קשר, עדכון פרטים');
assert.match(s.getAdminPendingHomeSummary_({ ...summaryCounts, unified: false }), /המספר יוצג לאחר טעינת/);
assert.equal(s.getAdminPendingHomeSummary_({ ...summaryCounts, total: 0 }), '');
