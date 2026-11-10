// Production UI functions with synthetic DOM and Firestore. No real writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const fixture = (month='2026-11', date=month+'-09', extra={}) => ({schemaVersion:1,month,timeZone:'Asia/Jerusalem',notes:'Synthetic only',entries:[{date,name:'Synthetic Person',phone:'0500000000',shift:'On call',start:'',end:'',endNextDay:false,uncertain:false,note:'',...extra}]});
function setup() {
  const nodes = new Map();
  const el = id => {
    if (!nodes.has(id)) { const classes=new Set(); nodes.set(id,{id,value:'',textContent:'',innerHTML:'',hidden:false,checked:false,disabled:false,isConnected:true,style:{},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)},setAttribute(){},focus(){},querySelectorAll(){return []}}); }
    return nodes.get(id);
  };
  const c={ console, Intl, Date, TextEncoder, setInterval:()=>1, clearInterval(){},
    document:{getElementById:el,addEventListener(){},visibilityState:'visible',activeElement:null},
    addEventListener(){},scrollY:0,scrollTo(){},
    auth:{currentUser:{uid:'synthetic',email:'admin@example.test'}},currentUserHasAppAccess:true,currentUserIsAdmin:true,db:{},
    escapeHtml:s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),formatPhoneForDisplay:s=>s,getDirectoryIconSvg_:()=>'<svg></svg>',
    closeAllDirectoryMenus_(){},closeDepartmentBrowser_(){},closeMonthlyInternsView_(){},
    requestAdminConfirmation_:async()=>true,resolveAdminConfirmation_(){},
    setAdminStatus:(message,type)=>{el('adminStatus').textContent=message;el('adminStatus').statusType=type;},
    firebaseApi:{doc:(_db,col,id)=>({col,id}),getDocFromServer:async()=>({exists:()=>false}),serverTimestamp:()=> 'server-time',runTransaction:async (_db,cb)=>cb({get:async()=>({exists:()=>false}),set(){}})}
  };
  c.window=c; vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(root,'pharmacology-roster.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'pharmacology-ui.js'),'utf8'),c);
  const run=s=>vm.runInContext(s,c);
  const snap=(data=null)=>run(`({exists:()=>${data!==null},data:()=>JSON.parse(${JSON.stringify(JSON.stringify(data))})})`);
  return {c,el,run,snap};
}
(async()=>{
  // Protected load strips metadata and never shows cached content after failed refresh.
  const h=setup(), today=h.run('PharmacologyRoster.israelDateKey()');
  h.c.firebaseApi.getDocFromServer=async()=>h.snap({...fixture(today.slice(0,7),today),version:'v1',reviewed:true,publishedBy:'admin@example.test',publishedAt:'synthetic'});
  h.run(`pharmacologyState.open=true; pharmacologyState.date=${JSON.stringify(today)}`);
  await h.c.loadPharmacology_(); assert.equal(h.run('pharmacologyState.status'),'ready');
  assert.match(h.el('pharmacologyList').innerHTML,/tel:\+972500000000/); assert.doesNotMatch(h.el('pharmacologyList').innerHTML,/לפי שעות הלוח, כעת/);
  h.c.firebaseApi.getDocFromServer=async()=>{throw Error('offline')}; await h.c.loadPharmacology_();
  assert.equal(h.run('pharmacologyState.status'),'unavailable'); assert.equal(h.el('pharmacologyList').innerHTML,'');
  // A late response cannot overwrite newer date/closed view/logout state.
  for (const action of ['date','close','logout']) {
    const s=setup(), gate=deferred(); s.c.firebaseApi.getDocFromServer=()=>gate.promise;
    s.run(`pharmacologyState.open=true; pharmacologyState.date=${JSON.stringify(today)}`);
    const pending=s.c.loadPharmacology_();
    if(action==='date'){s.run('pharmacologyState.date="2026-12-12"; pharmacologyState.token++');}
    else if(action==='close')s.c.closePharmacologyView_(); else {s.c.currentUserHasAppAccess=false;s.c.currentUserIsAdmin=false;s.c.resetPharmacology_();}
    gate.resolve(s.snap({...fixture(today.slice(0,7),today),reviewed:true})); await pending;
    assert.equal(s.run('pharmacologyState.roster'),null);
  }
  // Uncertain entries show no call; HTML is escaped; stale links are interrupted.
  h.run(`pharmacologyState.status='ready'; pharmacologyState.loadedAt=Date.now()-61000;`);
  let prevented=false; assert.equal(h.c.validatePharmacologyCall_({preventDefault(){prevented=true}}),false); assert.equal(prevented,true);
  const unsafe=h.run(`pharmacologyCards_([{name:'<img src=x>',phone:'+972500000000',date:${JSON.stringify(today)},shift:'<script>',start:'',end:'',uncertain:true,note:'<b>'}])`);
  assert.ok(!unsafe.includes('href="tel:')); assert.match(unsafe,/&lt;img/); assert.ok(!unsafe.includes('<script>'));
  // Admin draft remains private until preview + explicit review + confirmation.
  const a=setup(); a.c.openPharmacologyAdmin_(); a.el('pharmacologyJsonInput').value=JSON.stringify(fixture());
  await a.c.previewPharmacology_(); assert.ok(a.run('pharmacologyAdmin.draft')); assert.equal(a.el('pharmacologyPublishBtn').disabled,true);
  let writes=0; a.c.firebaseApi.runTransaction=async (_db,cb)=>cb({get:async()=>a.snap(),set(){writes++}});
  await a.c.publishPharmacology_(); assert.equal(writes,0);
  a.el('pharmacologyReview').checked=true; a.c.requestAdminConfirmation_=async()=>false;
  a.c.updatePharmacologyPublishButton_();
  assert.equal(a.el('pharmacologyReviewLabel').classList.contains('isReviewed'),true);
  assert.match(a.el('pharmacologyReviewState').textContent,/✓/);
  await a.c.publishPharmacology_(); assert.equal(writes,0); assert.equal(a.run('pharmacologyAdmin.busy'),false);
  assert.equal(a.run('pharmacologyAdmin.open'),true,'Cancel keeps the reviewed form open');
  a.c.requestAdminConfirmation_=async()=>true; await a.c.publishPharmacology_(); assert.equal(writes,1); assert.match(a.el('adminStatus').textContent,/פורסם בהצלחה/);
  assert.equal(a.run('pharmacologyAdmin.open'),false,'Successful publication closes the editor');
  assert.equal(a.el('pharmacologyAdminModal').classList.contains('visible'),false);
  assert.equal(a.el('pharmacologyJsonInput').value,'');
  assert.equal(a.el('pharmacologyReviewLabel').classList.contains('isReviewed'),false);
  await a.c.publishPharmacology_(); assert.equal(writes,1);
  // Editing invalidates review; concurrent publish fails without writing.
  a.c.openPharmacologyAdmin_();
  a.el('pharmacologyJsonInput').value=JSON.stringify(fixture()); await a.c.previewPharmacology_(); a.el('pharmacologyReview').checked=true;
  a.c.invalidatePharmacologyPreview_(); assert.equal(a.run('pharmacologyAdmin.draft'),null); assert.equal(a.el('pharmacologyReview').checked,false);
  await a.c.previewPharmacology_(); a.el('pharmacologyReview').checked=true;
  a.c.firebaseApi.runTransaction=async (_db,cb)=>cb({get:async()=>a.snap({version:'changed'}),set(){writes++}});
  await a.c.publishPharmacology_(); assert.equal(writes,1); assert.match(a.el('pharmacologyAdminStatus').textContent,/השתנה/); assert.equal(a.run('pharmacologyAdmin.draft'),null);
  assert.equal(a.run('pharmacologyAdmin.open'),true,'Conflict keeps the editor open');
  assert.equal(a.el('pharmacologyReviewLabel').classList.contains('isReviewed'),false);
  // Pending publication cannot be dismissed or duplicated; failure retains the source.
  const f=setup(), publication=deferred(); f.c.openPharmacologyAdmin_();
  const original=JSON.stringify(fixture()); f.el('pharmacologyJsonInput').value=original;
  await f.c.previewPharmacology_(); f.el('pharmacologyReview').checked=true;
  let attempts=0; f.c.firebaseApi.runTransaction=()=>{attempts++;return publication.promise;};
  const publishing=f.c.publishPharmacology_(); await Promise.resolve();
  f.c.closePharmacologyAdmin_(); await f.c.publishPharmacology_();
  assert.equal(f.run('pharmacologyAdmin.open'),true); assert.equal(attempts,1);
  publication.reject(Object.assign(Error('offline'),{code:'unavailable'})); await publishing;
  assert.equal(f.run('pharmacologyAdmin.open'),true);
  assert.equal(f.el('pharmacologyJsonInput').value,original);
  assert.match(f.el('pharmacologyAdminStatus').textContent,/לא התקבל אישור/);
  assert.equal(f.el('pharmacologyPublishBtn').disabled,true);
  assert.equal(f.run('pharmacologyAdmin.busy'),false);
  // Closed preview can reopen without delayed old result changing the fresh form.
  const b=setup(), gate=deferred(); b.c.openPharmacologyAdmin_(); b.el('pharmacologyJsonInput').value=JSON.stringify(fixture()); b.c.firebaseApi.getDocFromServer=()=>gate.promise;
  const pending=b.c.previewPharmacology_(); b.c.closePharmacologyAdmin_(); b.c.openPharmacologyAdmin_(); b.el('pharmacologyJsonInput').value='new input';
  gate.resolve(b.snap()); await pending; assert.equal(b.el('pharmacologyJsonInput').value,'new input'); assert.equal(b.run('pharmacologyAdmin.draft'),null); assert.equal(b.run('pharmacologyAdmin.busy'),false);
  // Revoked admin/account switched while confirmation pending cannot write.
  for(const action of ['revoked','account','logout']){
    const s=setup(), confirmation=deferred(); s.c.openPharmacologyAdmin_(); s.el('pharmacologyJsonInput').value=JSON.stringify(fixture()); await s.c.previewPharmacology_(); s.el('pharmacologyReview').checked=true;
    s.c.requestAdminConfirmation_=()=>confirmation.promise; let attempts=0; s.c.firebaseApi.runTransaction=async()=>{attempts++};
    const pending=s.c.publishPharmacology_(); if(action==='revoked')s.c.currentUserIsAdmin=false; else if(action==='account')s.c.auth.currentUser={uid:'other'}; else s.c.resetPharmacology_();
    confirmation.resolve(true); await pending; assert.equal(attempts,0);
  }
  console.log('Pharmacology UI flows: protected reads, ambiguity, stale responses, logout, preview, review, cancel, publish, conflict and account changes passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
