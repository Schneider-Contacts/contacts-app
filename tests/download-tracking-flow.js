const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'app.js'), 'utf8');
const extract = name => {
  const match = source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, 'm'));
  assert(match, `${name} must exist`);
  return match[0];
};
const recentModalSource = extract('openRecentContactsModal');
assert(recentModalSource.includes('שטרם נכללו בהורדת כל אנשי הקשר או בהורדת אנשי קשר חדשים במכשיר הזה'));
assert(!recentModalSource.includes('מאז ההורדה האחרונה'));
const cutoffKey = 'contacts_last_recent_import_at_v2';
const phonesKey = 'contacts_recent_imported_phones_v1';
const start = Date.parse('2026-11-09T10:00:00Z');
const initialCutoff = start - 30 * 86400000;
function setup() {
  let now = start;
  const storage = new Map();
  const elements = new Map();
  const opened = [];
  const alerts = [];
  const context = {
    console, Set, Number, JSON, Math, Blob, encodeURIComponent,
    Date: class extends Date { static now() { return now; } },
    IMPORT_STORAGE_PREFIX: 'import_',
    RECENT_CONTACTS_STORAGE_KEY: cutoffKey,
    RECENT_CONTACTS_IMPORTED_PHONES_KEY: phonesKey,
    RECENT_CONTACTS_DEFAULT_DAYS: 30,
    contacts: [], selectedRecentContactPhones: new Set(), selectedContactIds: new Set(),
    normalizePhone: value => String(value || '').replace(/\D/g, ''),
    isCurrentUserProvisional_: () => false,
    closeRecentContactsModal: () => {},
    alert: message => alerts.push(message),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    window: { location: { pathname: '/index.html' }, open: url => opened.push(url) },
    document: { getElementById: id => {
      if (!elements.has(id)) elements.set(id, { style: {} });
      return elements.get(id);
    } },
    shareOrDownloadVCard: async () => true
  };
  vm.createContext(context);
  vm.runInContext([
    'getRecentContactsCutoff', 'getImportedRecentContactPhones_', 'markRecentContactPhonesImported_',
    'parseContactDate', 'getContactCreationDate', 'getRecentContacts', 'getRecentContactSelectionKey_',
    'escapeVCardValue', 'buildContactVCard', 'saveImportPayload', 'openImportGuide', 'showGuideError',
    'getContactSelectionKey_', 'renderImportGuide', 'downloadAllContacts', 'downloadRecentContacts', 'downloadSelectedContacts'
  ].map(extract).join('\n'), context);
  return {
    context, storage, elements, opened, alerts,
    advance: milliseconds => { now += milliseconds; },
    latestGuide() {
      const key = new URL(opened.at(-1), 'https://example.invalid').searchParams.get('importKey');
      return { key, payload: JSON.parse(storage.get(key)) };
    },
    complete(key) { context.renderImportGuide(key); return elements.get('finalGuideBtn').onclick(); }
  };
}
const contact = (phone, time = start - 3600000) => ({ phone, name: phone, isNewContact: true, firstSeenAt: new Date(time) });
const recentPhones = context => Array.from(context.getRecentContacts(), c => c.phone).sort();

(async () => {
  const full = setup();
  full.context.contacts = [contact('0501111111'), contact('0502222222', start - 40 * 86400000)];
  await full.context.downloadAllContacts();
  const { key, payload } = full.latestGuide();
  assert.equal(payload.fileName, 'all-contacts.vcf');
  assert.equal(payload.count, 2);
  assert.equal(payload.markRecentImported, true);
  assert.equal(payload.markRecentImportCutoff, true);
  assert.equal(payload.recentImportCutoffAt, initialCutoff);
  assert.deepEqual(payload.importedRecentPhones, ['0501111111', '0502222222']);
  assert(payload.vcardContent.includes('TEL;TYPE=CELL:0501111111'));
  assert.equal(full.storage.has(cutoffKey), false, 'Opening the guide is not a download');
  assert.equal(full.storage.has(phonesKey), false);
  full.advance(60000);
  full.context.contacts.push(contact('0503333333', start + 1000));
  await full.complete(key);
  assert.equal(full.storage.get(cutoffKey), String(initialCutoff));
  assert.deepEqual(recentPhones(full.context), ['0503333333'], 'Arrival while guide is open stays new');
  full.context.contacts.push(contact('0504444444', start + 90000));
  assert.deepEqual(recentPhones(full.context), ['0503333333', '0504444444']);
  await full.complete(key);
  assert.equal(JSON.parse(full.storage.get(phonesKey)).length, 2, 'Repeated completion is idempotent');
  full.storage.set(cutoffKey, String(start + 100));
  await full.complete(key);
  assert.equal(full.storage.get(cutoffKey), String(start + 100), 'Older guides cannot rewind baseline');

  for (const outcome of ['cancel', 'failure']) {
    const env = setup();
    env.context.contacts = [contact('0501111111')];
    await env.context.downloadAllContacts();
    env.context.shareOrDownloadVCard = async () => {
      if (outcome === 'failure') throw new Error('download failed');
      return false;
    };
    const completion = env.complete(env.latestGuide().key);
    if (outcome === 'failure') await assert.rejects(completion, /download failed/);
    else await completion;
    assert.equal(env.storage.has(cutoffKey), false);
    assert.equal(env.storage.has(phonesKey), false);
    assert.deepEqual(recentPhones(env.context), ['0501111111']);
  }

  const partial = setup();
  partial.context.contacts = [contact('0501111111'), contact('0502222222')];
  partial.context.selectedRecentContactPhones.add('0501111111');
  await partial.context.downloadRecentContacts();
  assert.equal(partial.latestGuide().payload.markRecentImportCutoff, false);
  await partial.complete(partial.latestGuide().key);
  assert.equal(partial.storage.has(cutoffKey), false);
  assert.deepEqual(recentPhones(partial.context), ['0502222222']);
  partial.context.selectedRecentContactPhones = new Set(['0502222222']);
  await partial.context.downloadRecentContacts();
  const recentGuide = partial.latestGuide();
  partial.advance(60000);
  partial.context.contacts.push(contact('0503333333', start + 1000));
  await partial.complete(recentGuide.key);
  assert.deepEqual(recentPhones(partial.context), ['0503333333']);
  assert.deepEqual(JSON.parse(partial.storage.get(phonesKey)).sort(), ['0501111111', '0502222222']);

  const stale = setup();
  stale.storage.set(cutoffKey, String(start - 86400000));
  stale.context.contacts = [contact('0501111111')];
  await stale.context.downloadAllContacts();
  await stale.complete(stale.latestGuide().key);
  stale.context.contacts.push(contact('0502222222', start - 1000));
  assert.deepEqual(recentPhones(stale.context), ['0502222222'], 'Refresh must reveal unexported contacts older than export time');
  assert.equal(stale.storage.get(cutoffKey), String(start - 86400000));
  stale.context.selectedRecentContactPhones.add('0502222222');
  await stale.context.downloadRecentContacts();
  await stale.complete(stale.latestGuide().key);
  stale.context.contacts.push(contact('0503333333', start - 500));
  assert.deepEqual(recentPhones(stale.context), ['0503333333'], 'New-only export must not hide an omitted cached contact either');

  const pending = setup();
  pending.context.contacts = [contact('0501111111')];
  await pending.context.downloadAllContacts();
  let resolveShare;
  pending.context.shareOrDownloadVCard = () => new Promise(resolve => { resolveShare = resolve; });
  const inFlight = pending.complete(pending.latestGuide().key);
  assert.equal(pending.storage.has(phonesKey), false, 'Pending share has not succeeded');
  pending.advance(60000);
  pending.context.contacts.push(contact('0502222222', start + 1000));
  resolveShare(true);
  await inFlight;
  assert.deepEqual(recentPhones(pending.context), ['0502222222'], 'Arrival during native share stays new');

  const legacy = setup();
  const legacyKey = 'import_legacy';
  legacy.storage.set(legacyKey, JSON.stringify({ ...payload, recentImportCutoffAt: undefined, createdAt: start - 1000 }));
  legacy.advance(60000);
  await legacy.complete(legacyKey);
  assert.equal(legacy.storage.get(cutoffKey), String(initialCutoff - 1000), 'Legacy guide uses saved creation time');
  legacy.storage.set(legacyKey, JSON.stringify({ ...payload, recentImportCutoffAt: undefined, createdAt: undefined }));
  await legacy.complete(legacyKey);
  assert.equal(legacy.storage.get(cutoffKey), String(initialCutoff - 1000), 'Missing timestamp never uses completion time');

  const empty = setup();
  await empty.context.downloadAllContacts();
  await empty.context.downloadRecentContacts();
  assert.equal(empty.opened.length, 0);
  assert.equal(empty.storage.size, 0);
  assert.equal(empty.alerts.length, 2);
  empty.context.contacts = [contact('0501111111')];
  empty.context.isCurrentUserProvisional_ = () => true;
  await empty.context.downloadAllContacts();
  await empty.context.downloadRecentContacts();
  assert.equal(empty.opened.length, 0, 'Provisional restrictions remain in place');

  const selected = setup();
  selected.context.contacts = [{ ...contact('0501111111'), id: 1 }];
  selected.context.selectedContactIds.add(selected.context.getContactSelectionKey_(selected.context.contacts.find(c => c.id === 1)));
  await selected.context.downloadSelectedContacts();
  await selected.complete(selected.latestGuide().key);
  assert.equal(selected.storage.has(phonesKey), false, 'Unrelated selected export is unchanged');
  assert.equal(selected.storage.has(cutoffKey), false);

  // Exercise the actual native-share cancellation branch without opening anything.
  const share = setup();
  share.context.File = class {};
  share.context.navigator = { canShare: () => true, share: async () => { throw { name: 'AbortError' }; } };
  vm.runInContext(extract('shareOrDownloadVCard'), share.context);
  assert.equal(await share.context.shareOrDownloadVCard('VCARD', 'test.vcf'), false);
  console.log('Download tracking flow tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
