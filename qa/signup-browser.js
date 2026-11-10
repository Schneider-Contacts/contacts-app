// Isolated synthetic signup QA. Production init is disabled; external traffic is blocked.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 let activePage;let checks=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
 try{
  for(const width of [320,375,390,430,960]){
   const page=await browser.newPage({viewport:{width,height:844},locale:'he-IL',hasTouch:true});
   activePage=page;const errors=[];page.on('console',msg=>{if(msg.type()==='error')console.log('Fixture:',msg.text())});page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.hostname!=='signup.test')return route.abort();
    const file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
    if(file.includes('..')||!fs.existsSync(path.join(root,file)))return route.abort();
    let body=fs.readFileSync(path.join(root,file));
    if(file==='app.js')body=Buffer.from(body.toString().replace(/\ninit\(\);\s*$/,'\n// Synthetic QA: no production initialization.'));
    await route.fulfill({status:200,body,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html'});
   });
   await page.goto('http://signup.test/');
   await page.evaluate(()=>{
    auth={currentUser:null};db={};window.qaCalls=[];window.qaKnown=true;window.qaVerified=false;window.qaOffline=false;
    firebaseApi={setPersistence:async()=>{},createUserWithEmailAndPassword:async(_auth,email)=>{qaCalls.push(['create',email]);const user={uid:'synthetic',email,emailVerified:false,getIdToken:async()=>{qaCalls.push(['token']);return 'synthetic-token';}};auth.currentUser=user;return{user};},
     reload:async user=>{qaCalls.push(['reload']);if(qaOffline)throw Object.assign(Error('synthetic offline'),{code:'auth/network-request-failed'});user.emailVerified=qaVerified;},
     signOut:async()=>{auth.currentUser=null;},signInWithEmailAndPassword:async(_auth,email)=>{qaCalls.push(['sign-in',email]);const user={uid:'synthetic',email,emailVerified:qaVerified,getIdToken:async()=> 'synthetic-token'};auth.currentUser=user;return{user};}};
    requestPublicAuthRouteWithRetry_=async()=>({route:'ASK_PHONE'});
    submitAuthRouterForm_=async(action,payload)=>{qaCalls.push([action,payload]);if(action==='registerAccess')return{route:qaKnown?'PROVISIONAL_SETUP_READY':'DETAILS_REQUIRED',registrationOptions:{roles:['תפקיד בדוי'],departments:['מחלקה בדויה']}};if(action==='submitRegistrationDetails')return{route:'PROVISIONAL_SETUP_READY'};if(action==='finalizeProvisionalAccess')return{route:'PROVISIONAL_READY'};return{ok:true,deliveredBy:'synthetic'};};
    getCurrentUserPermission=async()=>({exists:true,active:true,accessReviewRequired:true,accessLevel:'provisional'});
    getEmailEntryEligibility_=async()=>({allowed:true});permissionHasProvisionalAccess_=()=>false;
    startVerificationAccessListener_=()=>{};stopVerificationAccessListener_=()=>{};
    updateManagerWhatsappLink_=async()=>{};loadOwnVerificationRequestState_=async()=>{};recordOwnAuthState_=()=>{};recordOperationalFailure_=()=>{};
    handleAuthenticatedUser=async user=>{qaCalls.push(['access-check',user.email,user.emailVerified]);};
    getAuthEmailCooldownRemaining=()=>0;ensureAuthEmailCooldownFinished=()=>true;startAuthEmailCooldown=()=>{};
    showLoginScreen();showAuthEmailStep_({forceEmailEntry:true});
   });
   const snap=async name=>{if(process.env.QA_SCREENSHOT_DIR&&width===390)await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,name+'-390.png'),fullPage:true});};
   const email=page.locator('#emailInput'),phone=page.locator('#phoneInput');
   // Wait for the screen's scheduled autofocus before accelerated synthetic typing.
   // Otherwise a 0ms focus callback can redirect fill(confirmPasswordInput) to passwordInput.
   const waitForPasswordFocus=()=>page.waitForFunction(()=>document.activeElement===document.getElementById('passwordInput')&&!authActionInProgress);
   await snap('signup-email');
   await email.fill('synthetic@example.test');await page.locator('#emailContinueBtn').click();await page.locator('#authPhoneStep').waitFor({state:'visible'});
   check(/כבר מופיעים בספר/.test(await page.locator('#authPhonePaths').textContent()),'Both paths at '+width);
   check(/טופס הצטרפות קצר/.test(await page.locator('#authPhonePaths').textContent()),'Short new path at '+width);
   await snap('signup-phone');
   await phone.fill('123');await page.locator('#phoneContinueBtn').click();check(/תקין/.test(await page.locator('#loginStatus').textContent()),'Phone validation '+width);
   await phone.fill('0500000000');await page.locator('#phoneContinueBtn').click();await page.locator('#authPasswordStep').waitFor({state:'visible'});
   check(/הפרטים שלכם כבר בספר/.test(await page.locator('#loginTitle').textContent()),'Matched path identified '+width);
   check(!await page.locator('#authRegistrationDetailsStep').isVisible(),'Matched path skips details '+width);
   check(/24 שעות/.test(await page.locator('#authModeNote').textContent()),'Temporary access disclosed '+width);
   check(/אישור מנהל/.test(await page.locator('#authModeNote').textContent()),'Approval remains clear '+width);
   await snap('signup-existing');
   await waitForPasswordFocus();await page.locator('#passwordInput').fill('Synthetic123');await page.locator('#confirmPasswordInput').fill('Synthetic123');await page.locator('#loginButton').click();await page.locator('#verificationPanel.visible').waitFor();
   check(await page.evaluate(()=>qaCalls.some(c=>c[0]==='finalizeProvisionalAccess'&&c[1].idToken==='synthetic-token')),'Existing path finalizes authenticated token '+width);
   check(await page.evaluate(()=>!qaCalls.some(c=>c[0]==='submitRegistrationDetails')),'Existing path never submits personal details '+width);
   await page.locator('#verificationContinueBtn').click();check(!await page.locator('#verificationSuccessPanel').isVisible(),'No false verification '+width);
   await page.evaluate(()=>qaOffline=true);await page.locator('#verificationContinueBtn').click();
   check(await page.locator('#verificationPanel').isVisible(),'Network error retains verification panel '+width);
   check(/בדקו את החיבור/.test(await page.locator('#loginStatus').textContent()),'Honest network failure '+width);
   await page.evaluate(()=>{qaOffline=false;auth.currentUser=null;});await page.locator('#verificationContinueBtn').click();
   await page.locator('#authPasswordStep').waitFor({state:'visible'});
   check((await email.inputValue())==='synthetic@example.test','Session recovery preserves email '+width);
   check((await page.locator('#passwordInput').inputValue())==='','Session recovery discards password '+width);
   check(!await page.locator('#verificationSuccessPanel').isVisible(),'Session recovery does not claim verification '+width);
   check(!await page.locator('#confirmPasswordGroup').isVisible(),'Recovery is login, not signup '+width);
   check(!await page.locator('#authSetupBack').isVisible(),'Signup-only Back action hidden during login '+width);
   await snap('signup-session-recovery');
   await page.evaluate(()=>qaVerified=true);await waitForPasswordFocus();await page.locator('#passwordInput').fill('Synthetic123');await page.locator('#loginButton').click();
   await page.waitForFunction(()=>qaCalls.some(c=>c[0]==='access-check'));
   check(await page.evaluate(()=>qaCalls.some(c=>c[0]==='sign-in')&&!qaCalls.some(c=>c[0]==='access-check'&&c[2]!==true)),'Re-login validates authenticated verification '+width);
   // New person: the same email -> phone entry, then only required short details.
   await page.evaluate(()=>{auth.currentUser=null;qaCalls=[];qaKnown=false;qaVerified=false;showAuthEmailStep_({forceEmailEntry:true});});
   await email.fill('new-synthetic@example.test');await page.locator('#emailContinueBtn').click();await phone.fill('0500000001');await page.locator('#phoneContinueBtn').click();
   await page.locator('#authRegistrationDetailsStep').waitFor({state:'visible'});
   check((await page.locator('#authRegistrationIdentity').textContent()).includes('new-synthetic@example.test'),'New identity shown '+width);
   await page.locator('#registrationDetailsSubmitBtn').click();check(/שם פרטי/.test(await page.locator('#loginStatus').textContent()),'Required details validated '+width);
   await page.locator('#registrationFirstName').fill('אדם');await page.locator('#registrationLastName').fill('בדוי');
   await page.locator('#registrationRole').selectOption('תפקיד בדוי');await page.locator('#registrationDepartment').selectOption('מחלקה בדויה');
   await snap('signup-new-details');
   await page.locator('#registrationDetailsSubmitBtn').click();await page.locator('#authPasswordStep').waitFor({state:'visible'});
   check(await page.evaluate(()=>qaCalls.filter(c=>c[0]==='submitRegistrationDetails').length===1),'Single new-person submission '+width);
   check(/הפרטים נשמרו/.test(await page.locator('#loginStatus').textContent()),'Saved details confirmation '+width);
   await waitForPasswordFocus();await page.locator('#passwordInput').fill('Synthetic123');await page.locator('#confirmPasswordInput').fill('Synthetic123');await page.locator('#loginButton').click();await page.locator('#verificationPanel.visible').waitFor();
   check(await page.evaluate(()=>qaCalls.some(c=>c[0]==='finalizeProvisionalAccess')),'New path finalizes token '+width);
   await page.evaluate(()=>qaVerified=true);await page.locator('#verificationContinueBtn').click();await page.locator('#verificationSuccessPanel.visible').waitFor();
   check(await page.evaluate(()=>!qaCalls.some(c=>c[0]==='access-check')),'Success still precedes authorization check '+width);
   await page.locator('#verificationSuccessPanel button').click();check(await page.evaluate(()=>qaCalls.some(c=>c[0]==='access-check')),'Success continues through access authorization '+width);
   // Back/reopen/reset copy and no extra screens or horizontal overflow.
   await page.evaluate(()=>{auth.currentUser=null;showAuthPhoneStep_('synthetic@example.test','password_reset');});
   check(!await page.locator('#authPhonePaths').isVisible(),'Signup copy absent in reset '+width);
   await page.evaluate(()=>showAuthPhoneStep_('synthetic@example.test'));
   await page.locator('#authPhoneStep .authStageBack').click();check(await page.locator('#authEmailStep').isVisible(),'Back returns to email '+width);
   check((await email.inputValue())==='new-synthetic@example.test','Back preserves entered email '+width);
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow '+width);
   check(errors.length===0,'No script errors '+width+': '+errors.join('; '));
   console.log('Synthetic signup browser paths passed at '+width+'px');await page.close();
  }
  console.log(`Signup browser QA: ${checks} checks passed.`);
 }catch(error){
  if(activePage&&!activePage.isClosed()){
   console.error('Synthetic failure state:',await activePage.evaluate(()=>({stage:authStage,mode:authMode,busy:authActionInProgress,status:document.getElementById('loginStatus').textContent,calls:qaCalls,passwordLength:document.getElementById('passwordInput').value.length,confirmLength:document.getElementById('confirmPasswordInput').value.length})).catch(()=>null));
   if(process.env.QA_SCREENSHOT_DIR)await activePage.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'signup-failure.png'),fullPage:true});
  }
  throw error;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
