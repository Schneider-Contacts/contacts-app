const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const extract = name => {
  const match = source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
  assert(match, `${name} exists`);
  return match[0];
};
const body = {innerHTML:''};
const c = {document:{getElementById:()=>body},
  monthlyInternsImportState:{phase:'idle'},
  adminMonthlyInternsActive:{monthKey:'2026-09',entries:[{name:'Synthetic'}]},
  adminMonthlyInternsPrevious:{entries:[{name:'Previous synthetic'}]},
  escapeHtml:s=>String(s),getAdminIconSvg_:()=>'<svg></svg>',
  formatMonthlyInternMonthLabel_:()=> 'ספטמבר 2026',
  getMonthlyInternsFreshnessHint_:()=> 'זו רשימה מחודש קודם, ולא רשימת החודש הנוכחי.'};
vm.createContext(c);
for(const name of ['getPublishedInternCount_','renderAdminInternsSystemCard_','renderMonthlyInternsAdmin_']) vm.runInContext(extract(name),c);
const row=c.renderAdminInternsSystemCard_();
assert.match(row,/class="adminSystemSection adminInternsSystemCard"/);
assert.match(row,/class="adminSystemLinkRow"/);
assert.equal((row.match(/<button/g)||[]).length,1,'One compact entry, matching pharmacology');
assert.match(row,/openMonthlyInternsAdmin_\(\)/);
assert.doesNotMatch(row,/rollbackMonthlyInterns_|adminSystemFeatureCard/);
c.renderMonthlyInternsAdmin_();
for(const text of ['ספטמבר 2026','1 סטאז׳רים','מחודש קודם','אינו משנה אנשי קשר','העלאת קובץ Excel','שחזור הרשימה הקודמת']) assert.ok(body.innerHTML.includes(text),text);
assert.match(body.innerHTML,/onclick="closeMonthlyInternsAdmin_\(\); rollbackMonthlyInterns_\(\)"/,'Dismiss the management sheet before the existing confirmation flow');
c.adminMonthlyInternsActive=null;c.adminMonthlyInternsPrevious=null;c.renderMonthlyInternsAdmin_();
assert.match(body.innerHTML,/עדיין לא פורסמה רשימה/);
assert.doesNotMatch(body.innerHTML,/rollbackMonthlyInterns_/);
c.monthlyInternsImportState={phase:'error',error:'Synthetic parse failure'};c.renderMonthlyInternsAdmin_();
assert.match(body.innerHTML,/Synthetic parse failure/);
assert.match(body.innerHTML,/chooseMonthlyInternsWorkbook_/);
const luminance=hex=>hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
assert(contrast('146c4e','eaf7ef')>=4.5,'Checked text and border have sufficient contrast');
assert(contrast('146c4e','ffffff')>=4.5,'White native check contrasts with green accent');
assert(contrast('73867c','ffffff')>=3,'Unchecked review boundary remains distinguishable');
console.log('Compact interns entry, current list details, restore availability and retry presentation passed.');
