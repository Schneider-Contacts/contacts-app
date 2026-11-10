'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const api = require('../pharmacology-roster');
const entry = changes => ({date:'2026-11-09',name:'בדיקה בלבד',phone:'',shift:'כוננות',start:'08:00',end:'16:00',...changes});
const roster = (entries = [entry()], changes = {}) => ({month:'2026-11',entries,...changes});
const select = (r, utc) => api.selectDay(api.analyze(r).roster, new Date(utc));
const bad = input => assert.equal(api.analyze(input).valid, false, JSON.stringify(input));
const promptExample = prompt => JSON.parse(prompt.match(/```json\n([\s\S]*?)\n```/)[1]);
const completeRoster = entries => ({schemaVersion:1,month:'2026-11',timeZone:'Asia/Jerusalem',notes:'Hebrew source notes.',entries});
const syntheticRows = count => Array.from({length:count}, (_,i) => ({
  date:'2026-11-'+String(i%30+1).padStart(2,'0'), name:'Synthetic Person '+(i+1), phone:'',
  shift:'כוננות',start:'',end:'',endNextDay:false,uncertain:i===count-1,note:i===count-1?'Unclear source':''
}));
function brokenEnvelope(source, smartMetadata = true) {
  const quote = value => smartMetadata ? '“'+JSON.stringify(value).slice(1,-1)+'”' : JSON.stringify(value);
  return '{'+Object.entries(source).filter(([key])=>key!=='entries').map(([key,value]) =>
    quote(key)+':'+(typeof value==='string'?quote(value):JSON.stringify(value))).join(',')
    +','+quote('entries')+':'+source.entries.map(value=>JSON.stringify(value)).join(',')+'}';
}
function rejectedRecovery(input) {
  const result=api.analyze(input);
  assert.equal(result.valid,false,input);
  assert.deepEqual(result.repairs,[],'Failed validation must not offer a repair');
  assert.equal(result.normalizedInput,null,'Failed validation must not expose corrected JSON');
}
test('UMD browser and CommonJS exports', () => {
  const context = {window:{}, Intl, Date, TextEncoder};
  vm.runInNewContext(fs.readFileSync(require.resolve('../pharmacology-roster'), 'utf8'), context);
  assert.equal(typeof context.window.PharmacologyRoster.analyze, 'function');
  assert.equal(typeof api.buildAiPrompt, 'function');
});
test('canonical normalization, no mutation and JSON roundtrip', () => {
  const raw = roster([entry({name:'  שם בדוי  ', phone:'+972 (50) 123-4567'})]);
  const before = JSON.stringify(raw);
  const result = api.analyze(raw);
  assert.equal(result.valid, true);
  assert.equal(result.roster.entries[0].name, 'שם בדוי');
  assert.equal(result.roster.entries[0].phone, '+972501234567');
  assert.equal(result.roster.timeZone, 'Asia/Jerusalem');
  assert.equal(result.roster.schemaVersion, 1);
  assert.equal(result.roster.entries[0].uncertain, false);
  assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(api.analyze(JSON.stringify(result.roster)).roster, result.roster);
});
test('accepts local/international mobile, geographic and 07 landline formats', () => {
  for (const phone of ['0501234567','+972501234567','00972501234567','972501234567','02-1234567','03 1234567','04-1234567','08-1234567','09-1234567','0721234567']) {
    assert.equal(api.analyze(roster([entry({phone})])).valid, true, phone);
  }
  for (const phone of ['123','+15551234567','+9720501234567','05012345678','050abc1234567','0501234567 ext 2',501234567,'+972501234567+','0001234567','']) {
    if (phone !== '') bad(roster([entry({phone})]));
  }
});
test('missing phone and unknown times are safe, warned and never inferred', () => {
  const result = api.analyze(roster([entry({start:'',end:'',note:'מעבדה פתוחה 08:00–16:00'})]));
  assert.equal(result.valid, true);
  assert.equal(result.roster.entries[0].start, '');
  assert.equal(result.roster.entries[0].phone, '');
  assert.ok(result.warnings.some(w => w.includes('טלפון')));
  assert.ok(result.warnings.some(w => w.includes('שעות')));
  assert.equal(select(result.roster,'2026-11-09T08:00:00Z').current, null);
  assert.equal(select(result.roster,'2026-11-09T08:00:00Z').ambiguous, true);
});
test('strict schema types and malformed roots', () => {
  for (const value of [null, [], 1, true, 'oops', '{}', '{', {month:'2026-11',entries:null}, roster([], {schemaVersion:2}), roster([], {timeZone:'UTC'}), roster([], {extra:true})]) bad(value);
  for (const field of ['date','name','phone','shift','start','end','note']) {
    for (const value of [null, 4, [], {}, false, undefined]) bad(roster([entry({[field]:value})]));
  }
  for (const field of ['endNextDay','uncertain']) for (const value of ['false',0,null]) bad(roster([entry({[field]:value})]));
  bad(roster([entry({extra:1})])); bad(roster([null])); bad(roster([entry({shift:' '})]));
  bad(roster([], {notes:3})); bad(roster([], {month:202611}));
});
test('size limits enforce exact field caps, UTF8 budget, entry count and cycles', () => {
  for (const [field, max] of [['name',120],['shift',120],['note',300]]) {
    assert.equal(api.analyze(roster([entry({[field]:'א'.repeat(max)})])).valid,true);
    bad(roster([entry({[field]:'א'.repeat(max+1)})]));
  }
  bad(roster([], {notes:'a'.repeat(1201)}));
  bad(roster(Array.from({length:101}, () => entry())));
  bad(' '.repeat(102401));
  bad(JSON.stringify(roster([], {notes:'א'.repeat(60000)})));
  const cycle = {}; cycle.self = cycle; assert.equal(api.analyze(cycle).valid,false);
});
test('real Gregorian dates, leap years and month membership', () => {
  for (const month of ['2026-00','2026-13','2026-1','26-11','0000-11','2026-11-01']) bad(roster([], {month}));
  for (const date of ['2026-11-31','2026-02-29','2026-11-00','2026-11-9','2026-12-01']) bad(roster([entry({date})]));
  assert.equal(api.analyze(roster([entry({date:'2028-02-29'})],{month:'2028-02'})).valid,true);
  bad(roster([entry({date:'2100-02-29'})],{month:'2100-02'}));
});
test('time syntax and explicit overnight, reject zero/negative/long ranges', () => {
  for (const changes of [{start:'9:00'},{start:'24:00'},{end:'12:60'},{start:''},{end:''},{end:'08:00'},{end:'07:00'},{end:'20:00',endNextDay:true},{start:'',end:'',endNextDay:true}]) bad(roster([entry(changes)]));
  assert.equal(api.analyze(roster([entry({start:'20:00',end:'08:00',endNextDay:true})])).valid,true);
  assert.equal(api.analyze(roster([entry({end:'08:00',endNextDay:true})])).valid,true);
});
test('duplicates and all-person overlaps including midnight rejected; touching boundaries accepted', () => {
  bad(roster([entry(),entry()]));
  bad(roster([entry(),entry({name:'אדם אחר',start:'10:00',end:'11:00'})]));
  bad(roster([entry({start:'20:00',end:'08:00',endNextDay:true}),entry({date:'2026-11-10',start:'07:00',end:'09:00'})]));
  assert.equal(api.analyze(roster([entry(),entry({start:'16:00',end:'20:00'})])).valid,true);
});
test('missing days are explicit warnings, not errors', () => {
  const result = api.analyze(roster());
  assert.equal(result.valid,true);
  assert.ok(result.warnings.some(w=>w.includes('ימים ללא שיבוץ')));
});
test('Israeli date never follows host timezone; midnight, summer and winter DST', () => {
  assert.equal(api.israelDateKey(new Date('2026-11-08T22:00:00Z')),'2026-11-09');
  assert.equal(api.israelDateKey(new Date('2026-07-08T21:00:00Z')),'2026-07-09');
  assert.equal(api.israelDateKey(new Date('2026-11-08T21:59:59Z')),'2026-11-08');
  assert.throws(()=>api.israelDateKey(new Date('bad')),TypeError);
  assert.throws(()=>api.israelDateKey('2026-11-09'),TypeError);
  const spring = roster([entry({date:'2026-03-27',start:'03:00',end:'04:00'})],{month:'2026-03'});
  assert.equal(select(spring,'2026-03-27T00:30:00Z').current.start,'03:00');
  const fall = roster([entry({date:'2026-10-25',start:'01:00',end:'02:00'})],{month:'2026-10'});
  assert.ok(select(fall,'2026-10-24T22:30:00Z').current);
  assert.ok(select(fall,'2026-10-24T23:30:00Z').current);
});
test('current interval start inclusive end exclusive, all today entries remain', () => {
  const r = roster([entry(),entry({start:'16:00',end:'20:00'})]);
  assert.equal(select(r,'2026-11-09T05:59:59Z').current,null);
  assert.equal(select(r,'2026-11-09T06:00:00Z').current.start,'08:00');
  assert.equal(select(r,'2026-11-09T13:59:59Z').current.start,'08:00');
  assert.equal(select(r,'2026-11-09T14:00:00Z').current.start,'16:00');
  assert.equal(select(r,'2026-11-09T18:00:00Z').current,null);
  assert.equal(select(r,'2026-11-09T05:00:00Z').entries.length,2);
});
test('overnight carry into next month without stale today assignments', () => {
  const r = roster([entry({date:'2026-11-30',start:'20:00',end:'08:00',endNextDay:true})]);
  const early = select(r,'2026-11-30T23:00:00Z');
  assert.equal(early.date,'2026-12-01'); assert.equal(early.entries.length,1); assert.ok(early.current);
  assert.deepEqual(select(r,'2026-12-01T06:00:00Z').entries,[]);
  assert.equal(select(r,'2026-12-02T00:00:00Z').current,null);
  assert.equal(select(roster(),'2026-12-09T08:00:00Z').entries.length,0);
});
test('year rollover overnight', () => {
  const r = roster([entry({date:'2026-12-31',start:'20:00',end:'08:00',endNextDay:true})],{month:'2026-12'});
  assert.equal(select(r,'2026-12-31T23:00:00Z').date,'2027-01-01');
  assert.ok(select(r,'2026-12-31T23:00:00Z').current);
});
test('uncertainty blocks current only when plausibly overlapping; untimed blocks whole day', () => {
  assert.equal(select(roster([entry({uncertain:true})]),'2026-11-09T08:00:00Z').current,null);
  const r = roster([entry(),entry({start:'16:00',end:'18:00',uncertain:true})]);
  assert.ok(select(r,'2026-11-09T08:00:00Z').current);
  assert.equal(select(roster([entry(),entry({start:'',end:''})]),'2026-11-09T08:00:00Z').current,null);
  const invalid = roster([entry(),entry({name:'אחר',start:'09:00',end:'10:00'})]);
  assert.equal(api.selectDay(invalid,new Date('2026-11-09T07:30:00Z')).current,null);
});
test('prompt includes exact parseable fabricated schema and no inference safeguards', () => {
  const prompt = api.buildAiPrompt();
  const json = promptExample(prompt);
  assert.equal(api.analyze(json).valid,true);
  for (const text of ['בדויה','מהמקור','uncertain:true','YYYY-MM-DD','אין להסיק']) assert.ok(prompt.includes(text));
  assert.equal(json.entries[0].phone,'');
});
test('100 nonoverlapping assignments accepted; normalized duplicates rejected', () => {
  const entries = Array.from({length:100}, (_,i) => entry({
    date:'2026-11-' + String(Math.floor(i/4)+1).padStart(2,'0'),
    start:String(i%4*6).padStart(2,'0')+':00',
    end:String(i%4*6+5).padStart(2,'0')+':00'
  }));
  assert.equal(api.analyze(roster(entries)).valid,true);
  bad(roster([entry({phone:'0501234567'}),entry({phone:'+972501234567'})]));
});
test('browser UTF8 fallback validates without TextEncoder', () => {
  const context = {window:{},Intl,Date};
  vm.runInNewContext(fs.readFileSync(require.resolve('../pharmacology-roster'),'utf8'),context);
  const analyze = context.window.PharmacologyRoster.analyze;
  assert.equal(analyze(JSON.stringify(roster())).valid,true);
  assert.equal(analyze(JSON.stringify(roster([], {notes:'א'.repeat(60000)}))).valid,false);
});

test('empty publication and years outside 2000..2099 rejected', () => {
  bad(roster([]));
  for (const year of ['1999','2100','0001','9999']) bad(roster([entry({date:year+'-11-09'})],{month:year+'-11'}));
  for (const year of ['2000','2099']) assert.equal(api.analyze(roster([entry({date:year+'-11-09'})],{month:year+'-11'})).valid,true);
});
test('multi-roster month boundary selects explicit previous overnight, suppresses conflicts and unknowns', () => {
  const previous = roster([entry({date:'2026-11-30',start:'20:00',end:'08:00',endNextDay:true})]);
  const current = roster([entry({date:'2026-12-01',start:'08:00',end:'16:00'})],{month:'2026-12'});
  const at = new Date('2026-12-01T02:00:00Z');
  const result = api.selectDay([previous,current],at);
  assert.equal(result.entries.length,2);
  assert.equal(result.current.date,'2026-11-30');
  assert.equal(result.ambiguous,false);
  assert.equal(api.selectDay([previous,current],new Date('2026-12-01T06:00:00Z')).current.date,'2026-12-01');
  const conflicting = roster([entry({date:'2026-12-01',start:'02:00',end:'06:00'})],{month:'2026-12'});
  assert.equal(api.selectDay([previous,conflicting],at).current,null);
  assert.equal(api.selectDay([previous,conflicting],at).ambiguous,true);
  const unknown = roster([entry({date:'2026-12-01',start:'',end:''})],{month:'2026-12'});
  assert.equal(api.selectDay([previous,unknown],at).current,null);
  assert.equal(api.selectDay([previous,unknown],at).ambiguous,true);
  assert.equal(api.selectDay([previous,{month:'bad',entries:[]}],at).current,null);
  assert.equal(api.selectDay([],at).ambiguous,true);
  assert.equal(api.selectDay([previous,current],new Date('2027-01-01T02:00:00Z')).entries.length,0);
});
test('paste accepts UTF-8 BOM and whole JSON code fences without extracting arbitrary prose', () => {
  const text=JSON.stringify(roster());
  for (const input of ['\uFEFF'+text, '  '+text+'\n', '```json\n'+text+'\n```', '```JSON\r\n'+text+'\r\n```', '```\n'+text+'\n```']) {
    assert.equal(api.analyze(input).valid,true,input);
  }
  for (const input of ['Here is the data: '+text, '```js\n'+text+'\n```', '```json\n'+text, text+' trailing', '{}\n'+text]) bad(input);
});
test('copy prompt requests paste-ready JSON and separates missing hours from actual uncertainty', () => {
  const prompt=api.buildAiPrompt();
  for(const text of ['JSON יחיד בלבד','מוכן להעתקה ישירות','uncertain:false','שעות חסרות או טלפון חסר אינם לבדם','אין לסמן את כל השיבוצים אוטומטית','הסיווג נלקח מהכותרת','אין צורך לחזור בכל note','21-8']) assert.ok(prompt.includes(text),text);
  const example=promptExample(prompt);
  assert.equal(example.entries[0].uncertain,false);
  assert.equal(example.entries[0].start,'');
});
test('recovers the exact smart-metadata/missing-array shape with 36 complete rows over 30 dates', () => {
  const source=completeRoster(syntheticRows(36));
  const pasted=brokenEnvelope(source), unchanged=pasted;
  const result=api.analyze(pasted);
  assert.equal(result.valid,true,result.errors.join('\n'));
  assert.equal(result.repairs.length,2);
  assert.ok(result.repairs.every(message=>/[\u0590-\u05ff]/.test(message)));
  assert.deepEqual(JSON.parse(result.normalizedInput),source);
  assert.equal(result.roster.entries.length,36);
  assert.equal(new Set(result.roster.entries.map(row=>row.date)).size,30);
  assert.equal(result.roster.entries.filter(row=>row.uncertain).length,1);
  assert.equal(result.roster.entries[35].note,'Unclear source');
  assert.ok(result.roster.entries.every(row=>row.phone===''&&row.start===''&&row.end===''&&!row.endNextDay));
  assert.equal(result.warnings.some(message=>message.includes('ימים ללא שיבוץ')),false);
  assert.equal(api.selectDay(result.roster,new Date('2026-11-01T09:00:00Z')).current,null);
  assert.equal(pasted,unchanged);
  const rechecked=api.analyze(result.normalizedInput);
  assert.equal(rechecked.valid,true);
  assert.deepEqual(rechecked.roster,result.roster);
  assert.deepEqual(rechecked.repairs,[]);
  assert.equal(rechecked.normalizedInput,null);
});
test('each supported formatting repair works alone, including a single entries object', () => {
  const source=completeRoster(syntheticRows(1));
  const normal=JSON.stringify(source);
  const smartOnly=normal.replace('"month":"2026-11"','“month”:“2026-11”');
  for(const input of [smartOnly,brokenEnvelope(source,false)]) {
    const result=api.analyze(input);
    assert.equal(result.valid,true,result.errors.join('\n'));
    assert.equal(result.repairs.length,1);
    assert.deepEqual(JSON.parse(result.normalizedInput),source);
  }
  // The repair applies only to pasted text, never already parsed/stored data.
  const stored={...source,entries:source.entries[0]};
  const before=JSON.stringify(stored);
  rejectedRecovery(stored);
  assert.equal(JSON.stringify(stored),before);
});
test('already valid JSON and whole-file wrappers never expose a formatting repair', () => {
  const source=completeRoster(syntheticRows(2));
  source.notes='Literal “smart quotes”, a lone ” and “ are data';
  source.entries[0].name='Synthetic “First” Person';
  source.entries[0].note='ASCII "quotes", backslash \\, } { [ ], and “punctuation”';
  const json=JSON.stringify(source,null,2);
  for(const input of [source,json,'\uFEFF'+json,'```json\n'+json+'\n```']) {
    const result=api.analyze(input);
    assert.equal(result.valid,true);
    assert.deepEqual(result.repairs,[]);
    assert.equal(result.normalizedInput,null);
    assert.equal(result.roster.notes,source.notes);
    assert.equal(result.roster.entries[0].name,source.entries[0].name);
    assert.equal(result.roster.entries[0].note,source.entries[0].note);
  }
});
test('recovery preserves literal smart quotes, escaped quotes, Unicode and punctuation inside ASCII strings', () => {
  const source=completeRoster(syntheticRows(2));
  source.entries[0].name='  Synthetic “Quoted” Name  ';
  source.entries[0].phone='050 123-4567';
  source.entries[0].note=' } , { "entries": [ ] “quoted”, lone ”, slash \\ and line\nnext\ttab ';
  source.entries[1].shift='כוננות “לילה”';
  source.entries[1].note='ספק בשם "בדוי" בלבד, \\; 😀';
  const result=api.analyze(brokenEnvelope(source));
  assert.equal(result.valid,true,result.errors.join('\n'));
  // The copyable JSON must retain source values, including ordinary importer
  // whitespace/phone display normalization, exactly as supplied by the user.
  assert.deepEqual(JSON.parse(result.normalizedInput),source);
  assert.deepEqual(result.roster,api.analyze(source).roster);
  assert.deepEqual(result.roster.entries.map(row=>row.uncertain),[false,true]);
  assert.equal(result.roster.entries[0].phone,'+972501234567');
});
test('smart delimiters preserve JSON escapes without interpreting escaped smart quotes as syntax', () => {
  const source=completeRoster(syntheticRows(1));
  source.notes='ASCII "quoted", backslash \\, newline\nend';
  const input=brokenEnvelope(source).replace('newline\\nend','newline\\nend \\u201c\\u201d');
  const result=api.analyze(input);
  assert.equal(result.valid,true,result.errors.join('\n'));
  assert.equal(JSON.parse(result.normalizedInput).notes,source.notes+' “”');
});
test('safe repairs compose with BOM, whitespace and one complete JSON fence', () => {
  const source=completeRoster(syntheticRows(36)), broken=brokenEnvelope(source);
  for(const input of ['\uFEFF'+broken,' \n'+broken+'\n ',
    '```json\n'+broken+'\n```','\uFEFF  ```JSON\r\n\uFEFF'+broken+'\r\n```  ',
    '```\n'+broken+'\n```']) {
    const result=api.analyze(input);
    assert.equal(result.valid,true,result.errors.join('\n'));
    assert.equal(result.repairs.length,2);
    assert.deepEqual(JSON.parse(result.normalizedInput),source);
  }
});
test('does not guess mixed, reversed, missing or ambiguous quotation delimiters', () => {
  const source=completeRoster(syntheticRows(1));
  const broken=brokenEnvelope(source);
  for(const input of [
    broken.replace('“month”','"month”'), broken.replace('“month”','“month"'),
    broken.replace('“month”','”month“'), broken.replace('“month”','“month“'),
    broken.replace('“month”','”month”'), broken.replace('“month”','‘month’'),
    broken.replace('“month”','month'), broken.replace('“2026-11”','“2026-11'),
    broken.replace('“Hebrew source notes.”','“Inner “quote” note”'),
    broken.replace('“Hebrew source notes.”','“Inner ”quote” note”'),
    broken.replace('“Hebrew source notes.”','“Inner "quote" note”'),
    broken.replace('“Hebrew source notes.”','“Unescaped\nline”'),
    broken.replace('“Hebrew source notes.”','“Bad \\x41 escape”'),
    broken.replace('“Hebrew source notes.”','“Bad \\u12zz escape”'),
    broken.replace('"name":"Synthetic Person 1"','"name":"Synthetic Person 1”')
  ]) rejectedRecovery(input);
});
test('rejects incomplete arrays, objects, missing separators, extra properties and mixed entries content', () => {
  const rows=syntheticRows(2), a=JSON.stringify(rows[0]), b=JSON.stringify(rows[1]);
  const prefix='{"month":"2026-11","entries":';
  for(const suffix of [
    a+','+b, a.slice(0,-1)+','+b+'}', a+b+'}', a+',}', a+',,'+b+'}',
    a+',null}', a+',42}', a+',"stray"}', a+',[ '+b+' ]}', a+',true}',
    a+',"notes":"later"}', a+', {"date":"2026-11-02"',
    '['+a+','+b+'}', a+','+b+']}', a+','+b+'}}', a+',/*comment*/'+b+'}',
    a+','+b.replace('"phone":"",','"phone":""')+'}',
    a+','+b.replace('"name":"Synthetic Person 2"','"name" "Synthetic Person 2"')+'}'
  ]) rejectedRecovery(prefix+suffix);
  rejectedRecovery('{"entries":'+a+',"month":"2026-11"}');
  rejectedRecovery('{"month":"2026-11","entries":[]}'+a);
  rejectedRecovery('{"month":"2026-11","entries":{}}');
});
test('rejects duplicate object keys at every level, including escape-equivalent or smart-delimited keys', () => {
  const normal=JSON.stringify(completeRoster(syntheticRows(1)));
  const broken=brokenEnvelope(completeRoster(syntheticRows(1)));
  for(const input of [
    normal.replace('"month":','"month":"2026-10","month":'),
    normal.replace('"month":','"\\u006donth":"2026-11","month":'),
    normal.replace('"phone":""','"phone":"0501234567","phone":""'),
    normal.replace('"uncertain":true','"uncertain":false,"uncertain":true'),
    normal.replace('"note":"Unclear source"','"note":"Unclear source","\\u006eote":"Unclear source"'),
    broken.replace('“month”:','“month”:“2026-11”,“month”:'),
    broken.replace('"name":','“name”:“Synthetic Other”,"name":'),
    broken.replace('“entries”:','"entries":[],“entries”:'),
    broken.replace('"note":"Unclear source"','"note":{"a":1,"a":2}')
  ]) rejectedRecovery(input);
});
test('formatting recovery never weakens schema, identity, time or uncertainty validation', () => {
  const mutations=[
    r=>{r.schemaVersion=2;}, r=>{r.timeZone='UTC';}, r=>{r.month='2026-12';}, r=>{r.extra=true;},
    r=>{r.entries[0].name='';}, r=>{r.entries[0].phone='not-a-phone';},
    r=>{r.entries[0].uncertain='false';}, r=>{r.entries[0].endNextDay=0;},
    r=>{r.entries[0].date='2026-11-31';}, r=>{r.entries[0].note=null;},
    r=>{r.entries[0].start='08:00';}, r=>{r.entries[0].extra='unknown';},
    r=>{r.entries[0].shift='x'.repeat(121);}, r=>{r.entries.push({...r.entries[0]});},
    r=>{for(const row of r.entries) {row.start='08:00';row.end='16:00';row.date='2026-11-01';}}
  ];
  for(const mutate of mutations) {
    const source=completeRoster(syntheticRows(2)); mutate(source);
    rejectedRecovery(brokenEnvelope(source));
  }
});
test('bounded recovery rejects excessive bytes, rows and nesting without emitting partial repairs', () => {
  const source=completeRoster(syntheticRows(36)), broken=brokenEnvelope(source);
  const padded=broken+' '.repeat(102400-Buffer.byteLength(broken,'utf8'));
  assert.equal(api.analyze(padded).valid,true);
  rejectedRecovery(padded+' ');
  rejectedRecovery(broken+'א'.repeat(51200));
  rejectedRecovery(brokenEnvelope(completeRoster(syntheticRows(101))));
  assert.equal(api.analyze(brokenEnvelope(completeRoster(syntheticRows(100)))).valid,true);
  for(const count of [16,17,1000]) {
    rejectedRecovery('{"month":"2026-11","entries":'+'['.repeat(count)+'{}'+']'.repeat(count)+'}');
    rejectedRecovery(broken.replace('"note":""','"note":'+ '{"a":'.repeat(count)+'null'+'}'.repeat(count)));
  }
});
test('recovery rejects prose, executable input and partial or multiple fences without executing anything', () => {
  const broken=brokenEnvelope(completeRoster(syntheticRows(1)));
  for(const input of ['Here is the JSON: '+broken, broken+' Done.',
    '```js\n'+broken+'\n```', '```json\n'+broken, '```json\n'+broken+'\n```\nextra',
    '```json\n'+broken+'\n```\n```json\n'+broken+'\n```',
    'const roster = '+broken, '('+broken+')', broken+';globalThis.pasteExecuted=true',
    broken.replace('true','(globalThis.pasteExecuted=true)'), broken.replace('true','undefined')]) {
    rejectedRecovery(input);
  }
  assert.equal(globalThis.pasteExecuted,undefined);
});
test('prompt explicitly requests one copyable fenced JSON block, ASCII quotes and an entries array', () => {
  const prompt=api.buildAiPrompt();
  for(const text of ['בלוק קוד אחד מסוג json','כפתור Copy','בלי פתיח או הסברים מחוץ לבלוק','ASCII','entries חייב תמיד להיות מערך','גם כשיש שיבוץ אחד']) {
    assert.ok(prompt.includes(text),text);
  }
  assert.ok(!prompt.includes('בלי פתיח, הסברים, Markdown'));
  assert.equal((prompt.match(/```json\n/g)||[]).length,1);
  const example=prompt.match(/```json\n([\s\S]*?)\n```/)[0];
  assert.equal(api.analyze(example).valid,true);
  assert.deepEqual(api.analyze(example).repairs,[]);
});
