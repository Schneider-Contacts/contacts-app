const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function extract(name) {
  const match = source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
  assert(match, `${name} exists`);
  return match[0];
}
function classes() {
  const values = new Set();
  return { add: v => values.add(v), remove: v => values.delete(v),
    contains: v => values.has(v), toggle(v, on) { if (on) values.add(v); else values.delete(v); } };
}
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '',
    hidden: false, classList: classes(), setAttribute() {}, focus() {} });
  return elements.get(id);
}
const s = {
  contacts: [], currentDisplayedContacts: [], selectedContactIds: new Set(),
  selectionMode: false, activeQuickFilter: 'all', directoryBrowseActivated: false,
  document: { getElementById: element, querySelector: () => element('toolbar'),
    querySelectorAll: () => [], body: { classList: classes() } },
  closeDepartmentBrowser_: () => {}, updateQuickFilterButtons: () => {},
  updateMainActionButton: () => {},
  setListStatus(message, type) { s.status = { message, type }; },
  getLaboratoryGroupedDisplayList_: list => list.map(contact => ({ contact })),
  getVisibleDepartment_: c => c.dept,
  highlightSearchText: v => v, escapeHtml: v => v || '',
  getContactDisplayName_: c => c.first, renderContactName: c => c.first,
  getDirectoryIconSvg_: () => '',
};
vm.createContext(s);
for (const name of ['normalizePhone', 'formatPhoneForDisplay', 'getPhoneSearchValue',
  'normalizeSearchText', 'buildContactSearchIndex_', 'getContactSearchIndex_',
  'getSearchTokenPriority_', 'getSearchPriority', 'compareContactsByName',
  'isSearchActive', 'isDepartmentFilterActive_', 'isQuickFilterActive',
  'contactMatchesQuickFilter', 'getQuickFilterContacts', 'clearActiveDirectoryFilter_',
  'returnToHome_', 'clearSearch', 'updateSearchUI', 'updateMainSearchActionVisibility_',
  'shouldShowHomeDashboard_', 'updateHomeDashboardVisibility_', 'shouldShowNoResults',
  'updateResultsSummary', 'updateDirectoryListToolbar_', 'getContactSelectionKey_',
  'pruneUnavailableSelections_', 'updateBulkActions', 'toggleContactSelection',
  'refreshSelectedCardsUI', 'clearSelectedContacts', 'isNoWhatsappPhone',
  'show', 'renderCurrentSearchResults']) vm.runInContext(extract(name), s);
const alice = { id: 0, docId: 'alice', first: 'אליס', last: 'כהן', firstEn: 'Alice',
  lastEn: 'Cohen', phone: '+972501234567', dept: 'קרדיולוגיה', role: 'רופאה' };
const bob = { id: 1, docId: 'bob', first: 'בוב', last: 'לוי', firstEn: 'Bob',
  lastEn: 'Levi', phone: '+972509876543', dept: 'מעבדה', role: 'אח' };
s.contacts = [alice, bob];
function priority(contact, query) { return s.getSearchPriority(contact, query, query.replace(/\D/g, '')); }
for (const query of ['אליס 050', 'Alice 050-123-4567', 'אליס +972 50 123 4567',
  'כהן רופאה 4567', '050-123-4567', '+972 (50) 123-4567', '1234567']) {
  assert.notEqual(priority(alice, query), null, `Matches all terms: ${query}`);
}
for (const query of ['בוב 0501234567', 'Alice 9876543', 'NoSuchName 050',
  'אליס 99999', 'AliceXYZ050', 'NoSuchName0501234567']) {
  assert.equal(priority(alice, query), null, `Must not discard text or numeric terms: ${query}`);
}
assert.equal(priority(alice, ''), null);
function query(value) { element('searchInput').value = value; s.renderCurrentSearchResults(); }
function displayed() { return Array.from(s.currentDisplayedContacts, c => c.docId); }
s.selectionMode = true;
query('Alice');
s.toggleContactSelection(0);
assert.deepEqual([...s.selectedContactIds], ['doc:alice']);
query('Bob');
assert.deepEqual(displayed(), ['bob']);
assert.match(element('bulkActionsInfo').textContent, /1 מחוץ לתוצאות/);
s.toggleContactSelection(1);
query('no results');
assert.equal(s.selectedContactIds.size, 2);
assert.equal(s.selectionMode, true);
assert.equal(s.status.type, 'empty');
assert.equal(element('directoryNoResultsActions').hidden, false);
assert.equal(element('directorySearchAllBtn').hidden, true);
assert.equal(element('bulkActions').classList.contains('visible'), true);
assert.equal(element('list').innerHTML, '');
s.activeQuickFilter = 'department:קרדיולוגיה';
query('');
assert.deepEqual(displayed(), ['alice']);
assert.equal(s.selectedContactIds.size, 2);
// Clear a filter while keeping an active query, including one with no matches.
query('Bob');
assert.deepEqual(displayed(), []);
assert.equal(element('directorySearchAllBtn').hidden, false);
s.clearActiveDirectoryFilter_();
assert.equal(element('searchInput').value, 'Bob');
assert.deepEqual(displayed(), ['bob']);
s.activeQuickFilter = 'labs';
query('absent');
s.clearActiveDirectoryFilter_();
assert.equal(element('searchInput').value, 'absent');
assert.equal(s.status.type, 'empty');
assert.equal(s.shouldShowHomeDashboard_(), false);
// Refresh/reorder changes numeric row IDs but never the selected contact identity.
s.contacts = [{ ...bob, id: 0 }, { ...alice, id: 1, phone: '+972502222222' }];
query('');
assert.equal(s.selectedContactIds.size, 2);
assert.match(element('list').innerHTML, /aria-pressed="true"/);
s.toggleContactSelection(0);
assert.deepEqual([...s.selectedContactIds], ['doc:alice']);
s.contacts = [s.contacts[0]];
s.renderCurrentSearchResults();
assert.equal(s.selectedContactIds.size, 0, 'Only removed contacts are pruned');
// Legacy contacts without document IDs retain normalized phone identity.
s.contacts = [{ ...alice, docId: '', id: 7, phone: '050-123-4567' }];
s.toggleContactSelection(7);
s.contacts = [{ ...s.contacts[0], id: 2, phone: '+972501234567' }];
s.renderCurrentSearchResults();
assert.deepEqual([...s.selectedContactIds], ['phone:+972501234567']);
s.clearSelectedContacts();
assert.equal(s.selectedContactIds.size, 0);
// Clearing the final filter remains a directory view, even with zero contacts.
s.selectionMode = false;
s.contacts = [];
s.activeQuickFilter = 'labs';
query('');
s.clearActiveDirectoryFilter_();
assert.equal(s.status.type, 'empty');
assert.equal(s.shouldShowHomeDashboard_(), false);
s.returnToHome_();
assert.equal(s.shouldShowHomeDashboard_(), true);
assert.equal(s.status.type, '');
console.log('Directory search and stable selection flow passed.');
