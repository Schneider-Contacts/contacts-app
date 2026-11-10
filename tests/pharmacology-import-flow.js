// Synthetic local file/clipboard/service doubles. No production data or clipboard access.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..');
const text=JSON.stringify({month:'2030-01',entries:[{date:'2030-01-01',name:'Synthetic Person',phone:'0500000000',shift:'כוננות',start:'',end:'',uncertain:false}]});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
function setup(){
 const nodes=new Map(),details={open:false};let c;
 const el=id=>{if(!nodes.has(id)){const cls=new Set();nodes.set(id,{id,value:'',textContent:'',innerHTML:'',hidden:false,checked:false,disabled:false,isConnected:true,style:{},classList:{add:n=>cls.add(n),remove:n=>cls.delete(n),contains:n=>cls.has(n)},setAttribute(){},focus(){c.document.activeElement=this},select(){this.selected=true},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b},closest:()=>details,querySelectorAll:()=>[]})}return nodes.get(id)};
 const counters={reads:0,writes:0};
 c={console,Intl,Date,TextEncoder,setInterval:()=>1,clearInterval(){},document:{getElementById:el,addEventListener(){},activeElement:null,execCommand:()=>false},navigator:{},addEventListener(){},scrollTo(){},scrollY:0,auth:{currentUser:{uid:'synthetic',email:'admin@example.test'}},currentUserIsAdmin:true,currentUserHasAppAccess:true,db:{},escapeHtml:s=>String(s).replace(/</g,'&lt;'),formatPhoneForDisplay:s=>s,getDirectoryIconSvg_:()=>'',resolveAdminConfirmation_(){},requestAdminConfirmation_:async()=>true,closeAllDirectoryMenus_(){},closeDepartmentBrowser_(){},closeMonthlyInternsView_(){},firebaseApi:{doc:(_db,col,id)=>({col,id}),getDocFromServer:async()=>{counters.reads++;return{exists:()=>false}},serverTimestamp:()=> 'synthetic',runTransaction:async()=>{counters.writes++}}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'pharmacology-roster.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'pharmacology-ui.js'),'utf8'),c);c.openPharmacologyAdmin_();
 return{c,el,details,counters,run:s=>vm.runInContext(s,c),file:(body=text,name='roster.json',extra={})=>({target:{files:[{name,size:Buffer.byteLength(body),text:async()=>body,...extra}],value:'chosen'}})};
}
test('copies exact prompt with Clipboard API without sending roster data',async()=>{
 const h=setup();let copied;h.c.navigator.clipboard={writeText:async value=>{copied=value}};
 assert.equal(await h.c.copyPharmacologyPrompt_(),true);assert.equal(copied,h.run('PharmacologyRoster.buildAiPrompt()'));assert.match(h.el('pharmacologyPromptStatus').textContent,/הועתקו/);assert.equal(h.counters.reads,0);assert.equal(h.counters.writes,0);
});
test('clipboard fallback copies or leaves visible selected text with honest manual instructions',async()=>{
 const h=setup();h.c.document.execCommand=()=>true;assert.equal(await h.c.copyPharmacologyPrompt_(),true);assert.equal(h.details.open,true);assert.ok(h.el('pharmacologyAiPrompt').selected);
 h.c.document.execCommand=()=>false;assert.equal(await h.c.copyPharmacologyPrompt_(),false);assert.match(h.el('pharmacologyPromptStatus').textContent,/לחיצה ארוכה/);assert.ok(h.el('pharmacologyAiPrompt').selectionEnd>100);assert.doesNotMatch(h.el('pharmacologyPromptStatus').textContent,/הועתקו/);
});
test('late clipboard failure never focuses or changes a closed/reopened editor',async()=>{
 const h=setup(),gate=deferred();h.c.navigator.clipboard={writeText:()=>gate.promise};const pending=h.c.copyPharmacologyPrompt_();h.c.closePharmacologyAdmin_();h.c.openPharmacologyAdmin_();gate.reject(Error('denied'));assert.equal(await pending,false);assert.equal(h.details.open,false);assert.equal(h.el('pharmacologyPromptStatus').textContent,'');
});
test('JSON/TXT selection reads locally, accepts BOM/fence and opens reviewed preview only',async()=>{
 const h=setup(),event=h.file('\uFEFF```json\n'+text+'\n```','roster.TXT');await h.c.handlePharmacologyFile_(event);
 assert.equal(event.target.value,'');assert.ok(h.run('pharmacologyAdmin.draft'));assert.equal(h.el('pharmacologyPublishBtn').disabled,true);assert.equal(h.counters.reads,1);assert.equal(h.counters.writes,0);assert.match(h.el('pharmacologySourceInfo').textContent,/נקרא במכשיר/);
});
test('wrong type and oversized files invalidate review but never read or replace text',async()=>{
 const h=setup();h.el('pharmacologyJsonInput').value=text;await h.c.previewPharmacology_();let reads=0;
 for(const extra of [{name:'image.png'},{size:102401}]){await h.c.handlePharmacologyFile_(h.file(text,extra.name||'roster.json',{...extra,text:async()=>{reads++;return text}}));assert.equal(h.run('pharmacologyAdmin.draft'),null);assert.equal(h.el('pharmacologyJsonInput').value,text);assert.equal(h.el('pharmacologyPublishBtn').disabled,true)}assert.equal(reads,0);
});
test('malformed JSON and read failure give separate errors and never write',async()=>{
 const h=setup();await h.c.handlePharmacologyFile_(h.file('{'));assert.match(h.el('pharmacologyAdminStatus').textContent,/JSON תקין/);assert.equal(h.counters.reads,0);
 await h.c.handlePharmacologyFile_(h.file(text,'roster.txt',{text:async()=>{throw Error('read error')}}));assert.match(h.el('pharmacologyAdminStatus').textContent,/לקרוא את הקובץ/);assert.equal(h.counters.writes,0);
});
test('late file read cannot overwrite new editor or another signed-in account',async()=>{
 for(const action of ['reopen','account']){const h=setup(),gate=deferred();const pending=h.c.handlePharmacologyFile_(h.file(text,'roster.json',{text:()=>gate.promise}));if(action==='reopen'){h.c.closePharmacologyAdmin_();h.c.openPharmacologyAdmin_()}else h.c.auth.currentUser={uid:'other'};h.el('pharmacologyJsonInput').value='new draft';gate.resolve(text);await pending;assert.equal(h.el('pharmacologyJsonInput').value,'new draft');assert.equal(h.counters.reads,0);assert.equal(h.counters.writes,0)}
});
test('local preview remains visible but publishing blocked when server read fails',async()=>{
 const h=setup(),gate=deferred();h.el('pharmacologyJsonInput').value=text;h.c.firebaseApi.getDocFromServer=()=>gate.promise;const pending=h.c.previewPharmacology_();assert.match(h.el('pharmacologyPreview').innerHTML,/כפתור חיוג יופיע ב־1/);assert.equal(h.run('pharmacologyAdmin.draft'),null);assert.equal(h.el('pharmacologyPublishBtn').disabled,true);gate.reject({code:'permission-denied'});await pending;assert.match(h.el('pharmacologyAdminStatus').textContent,/אין הרשאה/);assert.doesNotMatch(h.el('pharmacologyAdminStatus').textContent,/חיבור האינטרנט/);assert.match(h.el('pharmacologyPreview').innerHTML,/Synthetic Person/);assert.equal(h.el('pharmacologyPublishBtn').disabled,true);
});
test('all uncertain rows remain blocked for calling and summarized rather than silently corrected',async()=>{
 const h=setup(),data=JSON.parse(text);data.entries[0].uncertain=true;h.el('pharmacologyJsonInput').value=JSON.stringify(data);await h.c.previewPharmacology_();assert.match(h.el('pharmacologyPreview').innerHTML,/כפתור חיוג יופיע ב־0/);assert.match(h.el('pharmacologyPreview').innerHTML,/אינו מבטל אי־ודאות/);h.el('pharmacologyReview').checked=true;h.c.updatePharmacologyPublishButton_();assert.equal(h.run('pharmacologyAdmin.draft.entries[0].uncertain'),true);
});
test('service failure messages distinguish offline, identity and unknown publication outcome',()=>{
 const h=setup();assert.match(h.c.pharmacologyServiceError_({code:'firestore/unavailable'}),/חיבור האינטרנט/);assert.match(h.c.pharmacologyServiceError_({code:'unauthenticated'}),/להתחבר מחדש/);assert.match(h.c.pharmacologyServiceError_({},true),/לא התקבל אישור/);assert.match(h.c.pharmacologyServiceError_({},true),/לפני ניסיון פרסום נוסף/);
});
