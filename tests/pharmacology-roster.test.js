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
  const json = JSON.parse(prompt.slice(prompt.indexOf('{')));
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
