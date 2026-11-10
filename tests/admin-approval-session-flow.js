const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const extract=name=>{const m=app.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));assert(m,name);return m[0];};
(async()=>{
  for(const requestType of ['contact_add','self_update'])for(const replace of [false,true]){
    let finish,marked=0,closed=0;
    const gate=new Promise(resolve=>finish=resolve);
    const request={docId:'request-a',status:'pending',requestType,phone:'0500000001',email:'synthetic@example.test'};
    const s={console,currentUserIsAdmin:true,currentAdminEmail:'admin@example.test',db:{},requestModalSessions_:{add:{}},activeContactAddRequestId:'request-a',adminContactAddRequests:[request],
      setAdminStatus(){},hasUsableContactPhone_:()=>true,isValidEmail:()=>true,
      findExistingContactForAddRequest_:()=>({docId:'contact-a',name:'Synthetic'}),
      getContactAddRequestName_:()=> 'Synthetic',formatPhoneForDisplay:v=>v,
      requestAdminConfirmation_:async()=>true,buildApprovedContactPayload_:()=>({phone:request.phone,email:request.email}),
      normalizePhone:v=>v,submitContactAddApprovalToScript_:()=>gate,clearContactsBundleCache_(){},
      loadContacts:async()=>{},loadAdminData:async()=>{},updateOptimizedContactBundle_:async()=>{},
      window:{markDialogSaved_:()=>marked++},closeContactAddModal_:()=>closed++,
      firebaseApi:{writeBatch:()=>({set(){},update(){},commit:()=>gate}),serverTimestamp:()=>0,doc:()=>({}),collection:()=>({})}
    };
    vm.createContext(s);vm.runInContext(extract('approveContactAddRequest_'),s);
    const pending=s.approveContactAddRequest_('request-a');await Promise.resolve();
    if(replace){s.requestModalSessions_.add={};s.activeContactAddRequestId='request-b';}
    finish();await pending;
    assert.equal(marked,replace?0:1,`${requestType}: only original draft may be marked saved`);
    assert.equal(closed,replace?0:1,`${requestType}: only original editor may close`);
  }
  const calls=[];
  const s={requestModalSessions_:{profile:{},add:{},report:{}},window:{confirmDialogClose_:()=>false},document:{getElementById(){throw Error('Cancelled close touched DOM');}}};
  vm.createContext(s);
  for(const fn of ['closeMyProfileModal','closeContactAddModal_','closeContactReportModal','closeAdminEditModal']){
    vm.runInContext(extract(fn),s);assert.equal(s[fn](),false,fn+' respects canceled discard');
  }
  console.log('Admin approval session and canceled draft dismissal regressions passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
