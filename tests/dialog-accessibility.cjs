// Run with jsdom available (e.g. NODE_PATH=<test-dependencies>/node_modules node tests/dialog-accessibility.cjs).
// jsdom has no layout engine: visibility and inert behavior are simulated, not a real-browser pass.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const run = require('./dialog-test-cases.js');
const root = path.join(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''), {
  url: 'http://localhost/contacts-test/', runScripts: 'outside-only', pretendToBeVisual: true
});
const win=dom.window;
const css=fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const style=win.document.createElement('style');style.textContent=css;win.document.head.append(style);
Object.defineProperty(win.HTMLElement.prototype, 'inert', {
  get(){return this.hasAttribute('inert');}, set(value){this.toggleAttribute('inert', value);}
});
win.HTMLElement.prototype.getClientRects=function(){
  const parent=this.closest('[role="dialog"], [role="alertdialog"]');
  if(parent && !parent.classList.contains('visible')) return [];
  for(let node=this;node;node=node.parentElement) if(node.hidden || node.inert || win.getComputedStyle(node).display==='none')return [];
  return [{width:10,height:10}];
};
run(win,win.document,async()=>win.eval(fs.readFileSync(path.join(root,'dialog-accessibility.js'),'utf8')))
  .then(lines=>{console.log(lines.join('\n'));console.log(`${lines.length} simulated DOM dialog checks passed`);dom.window.close();})
  .catch(error=>{console.error(error);process.exitCode=1;dom.window.close();});
