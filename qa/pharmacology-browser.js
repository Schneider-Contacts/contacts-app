// Isolated UI smoke tests: intercept every request and substitute in-memory Firestore.
// Run with PLAYWRIGHT_MODULE and CHROME_EXECUTABLE if not installed on the Node path.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE ? {executablePath:process.env.CHROME_EXECUTABLE} : {})});
  try {
    for (const width of [320,375,390,430,960]) {
      const page = await browser.newPage({viewport:{width,height:844},locale:'he-IL'});
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.hostname!=='roster.test')return route.abort();
        const file=url.pathname==='/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
        if(file.includes('..') || !fs.existsSync(path.join(root,file)))return route.abort();
        let body=fs.readFileSync(path.join(root,file));
        if(file==='app.js')body=Buffer.from(body.toString().replace(/\ninit\(\);\s*$/,'\n// Initialization suppressed for isolated QA.'));
        const contentType=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html';
        await route.fulfill({status:200,contentType,body});
      });
      await page.goto('http://roster.test/');
      await page.evaluate(()=>{
        currentUserHasAppAccess=true; currentUserIsAdmin=true;
        auth={currentUser:{uid:'synthetic',email:'admin@example.test'}}; db={};
        window.qaRecords={}; window.qaWrites=0;
        firebaseApi={doc:(_db,col,id)=>({col,id}), getDocFromServer:async ref=>({exists:()=>Boolean(qaRecords[ref.id]),data:()=>structuredClone(qaRecords[ref.id])}),serverTimestamp:()=> 'synthetic-time',runTransaction:async (_db,callback)=>callback({get:async ref=>({exists:()=>Boolean(qaRecords[ref.id]),data:()=>structuredClone(qaRecords[ref.id])}),set:(ref,data)=>{qaWrites++;qaRecords[ref.id]=structuredClone(data)}})};
        document.getElementById('login').style.display='none'; document.getElementById('app').style.display='block';
        const today=PharmacologyRoster.israelDateKey();
        qaRecords[today.slice(0,7)]={schemaVersion:1,month:today.slice(0,7),timeZone:'Asia/Jerusalem',notes:'נתונים בדויים לבדיקת תצוגה בלבד',entries:[{date:today,name:'איש קשר לבדיקה',phone:'+972500000000',shift:'כוננות',start:'',end:'',endNextDay:false,uncertain:false,note:''}],version:'qa1',reviewed:true};
      });
      const box=await page.locator('#pharmacologyQuickEntry').boundingBox();
      const interns=await page.locator('#monthlyInternsQuickEntry').boundingBox();
      assert.equal(Math.round(box.y),Math.round(interns.y)); assert.ok(box.height>=44 && interns.height>=44);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`horizontal overflow ${width}`);
      await page.locator('#pharmacologyQuickEntry').click(); await page.locator('.pharmacologyCall').waitFor();
      assert.equal(await page.locator('.pharmacologyCall').getAttribute('href'),'tel:+972500000000');
      assert.equal(await page.locator('.pharmacologyBadge').count(),0);
      assert.match(await page.locator('#pharmacologyStatus').textContent(),/חסרות שעות/);
      await page.locator('#pharmacologyBack').click(); assert.equal(await page.locator('#pharmacologyView').isVisible(),false);
      if(width===390){
        await page.evaluate(()=>{document.getElementById('app').style.display='none';document.getElementById('adminPanel').style.display='block';openPharmacologyAdmin_()});
        const data={month:'2026-12',entries:[{date:'2026-12-09',name:'אדם בדוי',phone:'0500000000',shift:'לילה',start:'21:00',end:'08:00',endNextDay:true}]};
        await page.locator('#pharmacologyJsonInput').fill(JSON.stringify(data)); await page.locator('#pharmacologyPreviewBtn').click();
        await page.waitForFunction(()=>pharmacologyAdmin.draft!==null);
        assert.equal(await page.locator('#pharmacologyPublishBtn').isDisabled(),true);
        await page.locator('#pharmacologyReview').check(); await page.locator('#pharmacologyPublishBtn').click();
        await page.locator('#adminConfirmModal.visible').waitFor();
        const top=await page.locator('#adminConfirmActionBtn').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))});
        assert.equal(top,true,'confirmation must be above importer');
        await page.locator('#adminConfirmModal button').first().click();
        assert.equal(await page.evaluate(()=>qaWrites),0);
        await page.locator('#pharmacologyPublishBtn').click(); await page.locator('#adminConfirmActionBtn').click();
        await page.waitForFunction(()=>qaWrites===1); assert.match(await page.locator('#pharmacologyAdminStatus').textContent(),/פורסם בהצלחה/);
        await page.locator('#pharmacologyAdminClose').click();
        await page.evaluate(()=>openPharmacologyAdmin_()); assert.equal(await page.locator('#pharmacologyJsonInput').inputValue(),'');
        await page.keyboard.press('Escape'); assert.equal(await page.locator('#pharmacologyAdminModal').isVisible(),false);
      }
      if(process.env.QA_SCREENSHOT_DIR){await page.evaluate(()=>{document.getElementById('adminPanel').style.display='none';document.getElementById('app').style.display='block'});await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,`home-${width}.png`),fullPage:true});}
      assert.deepEqual(errors,[],`browser errors at width ${width}`);
      await page.close();
    }
    console.log('Browser smoke passed at widths 320/375/390/430/960; home, date view, explicit review, publish/cancel stacking, close/reopen and Escape. All data synthetic; network intercepted.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
