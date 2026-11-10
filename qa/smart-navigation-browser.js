// Isolated synthetic browser regression. No production initialization or external requests.
// PLAYWRIGHT_MODULE=<existing playwright path> CHROME_EXECUTABLE=<chrome> node qa/smart-navigation-browser.js
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const screenshots = process.env.QA_SCREENSHOT_DIR || '/tmp/contacts-smart-navigation-qa';
fs.mkdirSync(screenshots, {recursive: true});
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*href="https?:[^>]*>/gi, '');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8').replace(/\ninit\(\);\s*$/, '\n// Initialization deliberately disabled.');
(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.CHROME_EXECUTABLE ? {executablePath:process.env.CHROME_EXECUTABLE} : {})});
  let passed = 0;
  try {
    for (const [width,height] of [[320,740],[375,812],[390,844],[430,932],[960,900],[390,420]]) {
      const page = await browser.newPage({viewport:{width,height}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://regression.test') return route.abort();
        if (url.pathname === '/') return route.fulfill({contentType:'text/html',body:html});
        const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return route.abort();
        return route.fulfill({body:fs.readFileSync(target),contentType:target.endsWith('.css')?'text/css':target.endsWith('.js')?'text/javascript':target.endsWith('.png')?'image/png':'image/svg+xml'});
      });
      const check = (value,message) => {assert(value,`${width}x${height}: ${message}`);passed++;};
      const settle = () => page.waitForTimeout(250);
      const run = code => page.evaluate(code);
      try {
        await page.goto('http://regression.test/');
        await page.addScriptTag({content:app});
        await page.addScriptTag({content:`
          loadUserRequestStatuses_ = async () => {};
          recordContactUse_ = () => {};
          flushUsageMetrics_ = async () => {};
          contacts = Array.from({length:240},(_,i)=>({id:i,docId:'synthetic-'+i,first:'איש בדוי '+String(i).padStart(3,'0'),firstEn:'Person',last:'בדיקה',phone:(i%3===0?'03-925-':i%3===1?'+972-3-937-':'03-555-')+String(1000+i),dept:i<150?'מעבדה לדוגמה':'מחלקה '+String(i),role:'תפקיד בדוי'}));
          document.getElementById('login').style.display='none';document.getElementById('app').style.display='block';
          initMainDirectoryUx_();renderCurrentSearchResults();
        `});
        await page.addScriptTag({path:path.join(root,'dialog-accessibility.js')});
        check(await run(`!document.getElementById('homeDashboard').hidden`),'Home visible');
        await page.locator('#labsFilterBtn').click(); await settle();
        check(await run(`currentDisplayedContacts.length===150`),'Labs excludes non-labs');
        check(await run(`[['03-925-1234','schneider'],['+972-3-925-1234','schneider'],['03-937-1234','beilinson'],['+972-3-937-1234','beilinson'],['050-123-4567','other'],['','other'],['09-123-4567','other']].every(([phone,group])=>getLaboratoryHospitalGroup_({phone}).key===group)`),'Hospital classifier local/international/mobile/empty/unknown fixtures');
        check(await run(`document.getElementById('directoryHomeShortcuts').hidden && !document.getElementById('directoryHomeShortcuts').closest('.controlsCard')`),'Shortcuts outside sticky card');
        check(await run(`document.documentElement.scrollWidth<=innerWidth`),'No horizontal overflow');
        check(await run(`document.querySelector('#app .controlsCard').getBoundingClientRect().height<150`),'Compact sticky card below 150px');
        check(await run(`['directoryScopeSelect','laboratoryHospitalSelect'].every(id=>parseFloat(getComputedStyle(document.getElementById(id)).fontSize)>=16)`),'Native scope and hospital selects use at least 16px text');
        check(await run(`['directoryScopeSelect','directoryGlobalSearchBtn','laboratoryHospitalSelect'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.height>=44 && r.width>=44})`),'Scope/global/hospital targets at least 44px');
        check(await run(`(()=>{const rects=['directoryScopeSelect','directoryGlobalSearchBtn','laboratoryHospitalSelect'].map(id=>document.getElementById(id).getBoundingClientRect());return rects.every((r,i)=>r.left>=0&&r.right<=innerWidth&&rects.every((s,j)=>i===j||r.right<=s.left||s.right<=r.left||r.bottom<=s.top||s.bottom<=r.top))})()`),'Context controls fit without overlap');
        await page.screenshot({path:path.join(screenshots,`results-${width}-${height}.png`)});
        for (const group of ['schneider','beilinson','other']) {
          await page.locator('#laboratoryHospitalSelect').selectOption(group);await settle();
          check(await run(`currentDisplayedContacts.length===50 && currentDisplayedContacts.every(c=>getLaboratoryHospitalGroup_(c).key==='${group}')`),`Hospital ${group} intersection`);
        }
        await page.locator('#laboratoryHospitalSelect').selectOption('all'); await settle();
        await page.locator('#searchInput').fill('Person');await settle();
        await run(`window.scrollTo(0,1500)`);await settle();
        for (const method of ['close','escape','back']) {
          const before = await run(`scrollY`);
          await run(`const row=document.querySelectorAll('.contactRowMain')[12];row.focus({preventScroll:true});row.click()`);await settle();
          check(await run(`document.getElementById('contactDetailSheet').classList.contains('visible')`),'Details opened');
          if(method==='close') await run(`closeContactDetail_()`);
          if(method==='escape') await page.keyboard.press('Escape');
          if(method==='back') await run(`history.back()`);
          await settle();
          check(await run(`scrollY`)===before,`Exact scroll restoration via ${method}`);
          check(await run(`activeQuickFilter==='labs' && activeLaboratoryHospital==='all' && document.getElementById('searchInput').value==='Person'`),'Detail preserves scope and query');
          if(method==='back') {
            await run(`history.forward()`);await settle();
            check(await run(`!document.getElementById('contactDetailSheet').classList.contains('visible') && !document.getElementById('app').inert`),'Forward never reopens details');
          }
        }
        for (const transition of ['report','update']) {
          await run(`window.scrollTo(0,1300)`);await settle();const before=await run(`scrollY`);
          await run(`document.querySelectorAll('.contactRowMain')[10].focus({preventScroll:true});openContactDetail_(10)`);await settle();
          await run(transition==='report'?`reportActiveContact_()`:`updateActiveContact_()`);await settle();
          await page.keyboard.press('Escape');await settle();
          check(await run(`scrollY`)===before && await run(`!document.getElementById('app').inert`),`${transition} transition restores scroll and background`);
        }
        await run(`window.scrollTo(0,1800)`);await settle();
        const pickerBefore=await run(`scrollY`);
        await page.locator('#directoryScopeSelect').focus();await page.locator('#directoryScopeSelect').selectOption('__departments__');await settle();
        await page.keyboard.press('Escape');await settle();
        check(await run(`scrollY`)===pickerBefore && await run(`document.activeElement.id==='directoryScopeSelect'`),'Picker cancel restores scroll and scope selector focus');
        await page.locator('#directoryScopeSelect').focus();await page.locator('#directoryScopeSelect').selectOption('__departments__');await settle();
        const headerTop=await page.locator('#departmentSearchInput').evaluate(el=>el.getBoundingClientRect().top);
        await run(`document.getElementById('departmentList').scrollTop=1200`);await settle();
        check(await page.locator('#departmentSearchInput').evaluate(el=>el.getBoundingClientRect().top)===headerTop,'Department header fixed while list scrolls');
        check(await run(`document.getElementById('departmentList').scrollTop>0`),'Long department list scrolls');
        check(await page.locator('#departmentSheet .directorySheetClose').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&r.height>=44}),'Department close reachable, including short height');
        await page.screenshot({path:path.join(screenshots,`departments-${width}-${height}.png`)});
        await page.locator('#departmentSearchInput').fill('no such department');
        check(await page.locator('.departmentOption').count()===0,'Department no-match state');
        await page.locator('#clearDepartmentSearchBtn').click();
        check(await page.locator('.departmentOption').count()===91,'Clear restores all department options');
        await page.locator('#departmentSearchInput').fill('מעבדה');
        await page.locator('.departmentOption').click();await settle();
        check(await run(`activeQuickFilter==='department:מעבדה לדוגמה' && document.getElementById('searchInput').value==='Person'`),'New department preserves current query');
        check(await run(`Math.abs(document.getElementById('directoryResultsStart').getBoundingClientRect().top-document.querySelector('#app .controlsCard').getBoundingClientRect().bottom-9)<3`),'New department results start below sticky controls');
        await page.locator('#directoryScopeSelect').selectOption('labs');await settle();
        await page.locator('#laboratoryHospitalSelect').selectOption('schneider');await settle();
        await page.locator('#searchInput').fill('Person 1000');await settle();
        check(await run(`currentDisplayedContacts.length===1 && currentDisplayedContacts[0].id===0`),'Hospital and mixed text/phone intersection');
        await run(`enterSelectionMode();toggleContactSelection(0)`);
        await page.locator('#searchInput').fill('absent');await settle();
        check(await run(`selectedContactIds.has('doc:synthetic-0') && currentDisplayedContacts.length===0`),'Selection survives empty intersection');
        await page.locator('#directorySearchAllBtn').click();await settle();
        check(await run(`activeQuickFilter==='all' && activeLaboratoryHospital==='all' && document.getElementById('searchInput').value==='absent'`),'Explicit global search preserves query and resets scopes');
        await page.locator('#searchInput').fill('Person');await settle();
        await run(`window.scrollTo(0,1500)`);await settle();
        await page.locator('#directoryScopeSelect').selectOption('__home__');await settle();
        check(await run(`scrollY===0 && activeQuickFilter==='all' && activeLaboratoryHospital==='all' && document.getElementById('searchInput').value==='' && !document.getElementById('homeDashboard').hidden`),'Sticky scope Home resets navigation and scroll');
        check(await run(`selectedContactIds.has('doc:synthetic-0') && !selectionMode`),'Home retains resumable selection');
        check(errors.length===0,'No runtime errors: '+errors.join('; '));
        console.log(`PASS ${width}x${height}`);
      } catch(error) {
        await page.screenshot({path:path.join(screenshots,`failure-${width}-${height}.png`)});
        throw error;
      } finally {await page.close();}
    }
    console.log(`ALL ${passed} CHECKS PASSED. Screenshots: ${screenshots}`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
