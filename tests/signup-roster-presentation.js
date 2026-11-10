const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const app = read('app.js');
const html = read('index.html');
const css = read('styles.css');
const extract = name => {
  const start = app.indexOf(`function ${name}(`);
  assert(start >= 0);
  return app.slice(start, app.indexOf('\n}', start) + 2);
};
const sandbox = {
  Intl, Date, MONTHLY_INTERNS_TIME_ZONE: 'Asia/Jerusalem',
  getCurrentMonthlyInternsDescriptor_: () => ({key:'monthly_interns_2026_11', year:'2026', month:'11'})
};
vm.createContext(sandbox);
vm.runInContext(extract('getMonthlyInternsFreshnessHint_') + '\n' + extract('getMonthlyInternsDescriptorFromData_'), sandbox);
assert.match(sandbox.getMonthlyInternsFreshnessHint_('2026-09'), /מחודש קודם/);
assert.equal(sandbox.getMonthlyInternsFreshnessHint_('2026-11'), '');
assert.match(sandbox.getMonthlyInternsFreshnessHint_('2026-12'), /עתידי/);
assert.match(sandbox.getMonthlyInternsFreshnessHint_('2026-13'), /אינו ידוע/);
assert.match(sandbox.getMonthlyInternsFreshnessHint_(''), /אינו ידוע/);
assert.match(sandbox.getMonthlyInternsFreshnessHint_('2026-12', '2027-01'), /מחודש קודם/);
const data = {monthKey:'2026-09', monthLabel:'נובמבר 2026', entries:[{name:'Synthetic'}]};
const before = JSON.stringify(data);
const descriptor = sandbox.getMonthlyInternsDescriptorFromData_(data, {});
assert.equal(descriptor.key, '2026-09');
assert.match(descriptor.label, /ספטמבר/);
assert.equal(JSON.stringify(data), before, 'Presentation must not mutate source data');
assert.match(html, /המשך לבחירת סיסמה/);
assert.match(app, /לאחר אימות המייל תיפתח גישה זמנית ל־24 שעות/);
assert.match(app, /6 תווים לפחות/);
assert.match(html, /id="loginStatus"[^>]*role="status"[^>]*aria-live="polite"/);
assert.match(css, /#app \.searchWrap input \{\s*font-size: 16px;/);
const luminance = hex => hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[0.2126,0.7152,0.0722][i],0);
assert(1.05/(luminance('53675d')+0.05)>=4.5);
console.log('Signup and roster presentation checks passed');
