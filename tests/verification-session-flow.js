// Synthetic sessions only. No Firebase/network access or persistent data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const extract=name=>{const match=source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));assert(match,name);return match[0];};
let checks=0;
function fixture(){
  const calls=[],elements={passwordInput:{value:'not-retained'},confirmPasswordInput:{value:'not-retained'},verificationContinueBtn:{disabled:false,textContent:''}};
  const user={email:'synthetic@example.test',emailVerified:false,getIdToken:async()=>{calls.push('token');return 'synthetic';}};
  const s={console:{error(){},warn(){}},auth:{currentUser:user},firebaseApi:{reload:async()=>calls.push('reload')},
    authActionInProgress:false,verificationReturnCheckInProgress:false,authEmailFlowToken:1,authStage:'verification',
    lastUnverifiedEmail:user.email,verificationSuccessUser:null,currentUserHasAppAccess:false,currentUserPermissionData:null,
    normalizeEmail:v=>String(v||'').trim().toLowerCase(),isValidEmail:v=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    getPendingAuthEmail_:()=>user.email,document:{getElementById:id=>elements[id]||null},
    getCurrentUserPermission:async()=>({active:true,manualApproved:false}),
    setVerificationSuccessPanelVisible_:v=>calls.push(['success-visible',v]),showLoginScreen:()=>calls.push('login-screen'),
    showAuthPasswordStep_:(email,mode)=>{s.authStage='password';s.authEmailFlowToken++;calls.push(['password',email,mode]);},
    showAuthEmailStep_:()=>{s.authStage='email';s.authEmailFlowToken++;calls.push('email');},
    setLoginStatus:(message,type)=>calls.push(['status',message,type]),
    showVerificationSuccessPanel_:u=>{calls.push(['success',u.email]);},
    rememberSuccessfulEmail_:email=>calls.push(['remember',email]),
    setVerificationPanelVisible_:v=>calls.push(['verification-visible',v]),
    handleAuthenticatedUser:async(u,options)=>calls.push(['authorized-entry-check',u.email,options])
  };
  vm.createContext(s);vm.runInContext(['showVerificationSignIn_','setVerificationCheckBusy_','checkVerificationAndContinue','refreshVerificationSessionAfterReturn_','continueAfterVerificationSuccess_'].map(extract).join('\n'),s);
  return {s,user,calls,elements};
}
const check=(value,message)=>{assert.ok(value,message);checks++;};
(async()=>{
  for(const entry of ['checkVerificationAndContinue','refreshVerificationSessionAfterReturn_','continueAfterVerificationSuccess_']){
    const {s,user,calls,elements}=fixture();s.auth.currentUser=null;s.verificationSuccessUser=user;
    await s[entry]();
    check(calls.some(c=>c[0]==='password'&&c[1]===user.email&&c[2]==='login'),entry+' returns to same email login');
    check(!calls.some(c=>['success','remember','authorized-entry-check'].includes(c[0])),entry+' cannot infer verified/access');
    check(elements.passwordInput.value===''&&elements.confirmPasswordInput.value==='',entry+' discards old passwords');
    check(s.verificationSuccessUser===null,entry+' clears stale success object');
  }
  {
    const {s,calls}=fixture();s.auth.currentUser=null;s.lastUnverifiedEmail='';s.getPendingAuthEmail_=()=>'';
    await s.checkVerificationAndContinue();check(calls.includes('email'),'unknown identity uses email entry');
  }
  {
    const {s,calls}=fixture();s.firebaseApi=null;
    await s.checkVerificationAndContinue();check(calls.some(c=>c[0]==='status'&&c[2]==='loading'),'initialization is not expiration');
    check(!calls.some(c=>c[0]==='password'),'no premature login when initializing');
  }
  for(const entry of ['checkVerificationAndContinue','refreshVerificationSessionAfterReturn_']){
    let f=fixture();await f.s[entry]();check(!f.calls.some(c=>['success','authorized-entry-check'].includes(c[0])),entry+' unverified cannot enter');
    f=fixture();f.user.emailVerified=true;await f.s[entry]();
    check(f.calls.includes('token'),entry+' requires fresh token');
    check(f.calls.some(c=>['success','authorized-entry-check'].includes(c[0])),entry+' verified continues');
    f=fixture();f.s.firebaseApi.reload=async()=>{throw Object.assign(Error('offline'),{code:'auth/network-request-failed'});};
    await f.s[entry]();check(!f.calls.some(c=>['success','password','authorized-entry-check'].includes(c[0])),entry+' network failure is not verification/session expiry');
    check(f.s.auth.currentUser===f.user,entry+' network failure retains session');
    f=fixture();f.user.emailVerified=true;f.user.getIdToken=async()=>{throw Error('offline');};await f.s[entry]();
    check(!f.calls.some(c=>['success','authorized-entry-check'].includes(c[0])),entry+' failed fresh token cannot enter');
    for(const rejects of [false,true]){
      f=fixture();f.s.firebaseApi.reload=async()=>{f.s.auth.currentUser=null;if(rejects)throw Error('session gone');};
      await f.s[entry]();check(f.calls.some(c=>c[0]==='password'),entry+' vanished session returns to login ('+rejects+')');
    }
    for(const interruption of ['account','flow']){
      f=fixture();let release;f.s.firebaseApi.reload=()=>new Promise(r=>release=r);
      const pending=f.s[entry]();
      if(interruption==='account')f.s.auth.currentUser={email:'other@example.test'};else f.s.authEmailFlowToken++;
      f.user.emailVerified=true;release();await pending;
      check(!f.calls.some(c=>['success','password','authorized-entry-check'].includes(c[0])),entry+' ignores stale '+interruption);
    }
    f=fixture();let release;let reloads=0;f.s.firebaseApi.reload=()=>{reloads++;return new Promise(r=>release=r);};
    const first=f.s[entry]();await f.s.checkVerificationAndContinue();await f.s.refreshVerificationSessionAfterReturn_();
    check(reloads===1,entry+' suppresses overlapping clicks/return events');release();await first;
    check(!f.elements.verificationContinueBtn.disabled,entry+' restores primary button');
  }
  for(const entry of ['checkVerificationAndContinue','refreshVerificationSessionAfterReturn_']){
    const {s,user,calls}=fixture();
    user.emailVerified=entry==='refreshVerificationSessionAfterReturn_';
    if(user.emailVerified){s.authStage='verification_success';s.verificationSuccessUser=user;}
    s.getCurrentUserPermission=async()=>({active:true,manualApproved:true});
    s.handleAuthenticatedUser=async()=>{s.auth.currentUser=null;calls.push(['status','access-denied','error']);};
    await s[entry]();
    check(!calls.some(c=>c[0]==='password'),entry+' preserves deliberate access-denial signout');
    check(calls.filter(c=>c[0]==='status').at(-1)[1]==='access-denied',entry+' retains access-denied reason');
    await s.refreshVerificationSessionAfterReturn_();
    check(s.verificationSuccessUser===null,entry+' clears stale success identity on denied access');
    check(calls.some(c=>c[0]==='success-visible'&&c[1]===false),entry+' hides stale success panel on denied access');
    check(!calls.some(c=>c[0]==='password'),entry+' later return cannot overwrite access denial');
    check(calls.filter(c=>c[0]==='status').at(-1)[1]==='access-denied',entry+' later return retains reason');
  }
  {
    const {s,calls}=fixture();s.getCurrentUserPermission=async()=>({active:true,manualApproved:true});
    await s.checkVerificationAndContinue();check(calls.some(c=>c[0]==='authorized-entry-check'),'manual approval still receives complete access check');
    check(!calls.some(c=>c[0]==='success'),'manual approval is not called verified email');
  }
  {
    const {s,calls,user}=fixture();s.verificationSuccessUser=user;s.auth.currentUser={email:'other@example.test',emailVerified:true};
    await s.continueAfterVerificationSuccess_();check(!calls.some(c=>c[0]==='authorized-entry-check'),'stale success cannot enter another account');
  }
  console.log(`Verification session recovery: ${checks} checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
