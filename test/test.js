// node test/test.js : engine and reader checks against two real MPOS quotations (figures only)
//   fixture-mpos.json  SmartProtect You, death benefit = sum assured + fund (charges same in X and Y)
//   fixture-srm.json   Smart Revive Max, death benefit = higher of sum assured or fund, 5-year premium, RM25k booster at 65 / 75 / 85
const W = require('../docs/engine.js'), P = require('../docs/parse.js');
const spy = require('./fixture-mpos.json'), srm = require('./fixture-srm.json');
let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log('FAIL', msg)); };
const clone = o => JSON.parse(JSON.stringify(o));

// 1. SmartProtect You: re-creates GE's own 2% / 5% figures
const m = W.calibrate(spy);
ok(m.ok && !m.level, 'SPY calibrates as a "sum assured + fund" plan');
ok(m.accuracy.maxErr < 0.005, 'SPY within 0.5% of every printed GE value (' + (m.accuracy.maxErr * 100).toFixed(2) + '%)');
ok(m.accuracy.lapse.x.app === 72 && m.accuracy.lapse.y.app === 80, 'SPY run-out ages 72 / 80 match');
ok(Math.abs(m.costs.fmc - 0.0075) < 0.0006, 'SPY fitted fund charge ~0.75% (fund fact sheet: 0.75%)');

// 2. the pain point: 8%, the range, and the return needed for age 100
const p8 = W.project(m, 0.08), t8 = W.project(m, 0.08, true);
ok(!p8.fullTerm && p8.sustainsToAge > 80 && p8.sustainsToAge < 100, 'SPY 8% lasts beyond 5% but not to 100 (age ' + p8.sustainsToAge + ')');
ok(t8.sustainsToAge >= p8.sustainsToAge, 'printed-pace view is never worse than the careful view (' + t8.sustainsToAge + ')');
ok(W.project(m, 0.05, true).sustainsToAge === 80, 'both views keep GE\'s own 5% run-out age');
const need = W.minReturn(m);
ok(need > 0.08 && need < 0.12, 'SPY return needed to last to 100: ' + (need * 100).toFixed(2) + '%');
ok(W.project(m, need).fullTerm && !W.project(m, need - 0.002).fullTerm, 'minReturn is the boundary');
let prev = -1, mono = true; for (let r = 0; r <= 0.12; r += 0.01) { const a = W.project(m, r).sustainsToAge; if (a < prev) mono = false; prev = a; }
ok(mono, 'higher return never shortens the policy');

// 3. Smart Revive Max: charges depend on the fund, limited pay, booster
const s = W.calibrate(srm);
ok(s.ok && s.level, 'SRM calibrates as a "higher of sum assured or fund" plan');
ok(s.bonus && s.bonus.amount === 25000 && s.bonus.age === 65 && s.bonus.every === 10, 'SRM booster read: RM25,000 at 65, every 10 years');
ok(s.accuracy.maxErr < 0.005, 'SRM within 0.5% of every printed GE value (' + (s.accuracy.maxErr * 100).toFixed(2) + '%)');
ok(s.accuracy.lapse.x.app === 61 && s.accuracy.lapse.y.app === 71, 'SRM run-out ages 61 / 71 match');
ok(Math.abs(s.growth.extra - 1) < 0.01, 'SRM needs no extra charge growth: the printed insurance-rate pace already gives GE\'s run-out age');
ok(s.growth.q > 1.07 && s.growth.q < 1.10, 'SRM insurance rate rises 7-10% a year by age (' + ((s.growth.q - 1) * 100).toFixed(1) + '%)');
ok(Math.abs(s.costs.fmc - 0.015) < 0.001, 'SRM fitted fund charge ~1.5% (fund fact sheet: 1.5%)');
const noBonus = clone(srm); noBonus.bonus = null;
const s0 = W.calibrate(noBonus);
ok(s0.ok && s0.growth.extra < 0.97, 'without the booster the app would have to bend the charges to match GE (shows why the booster matters)');
const sHi = W.project(s, 0.06), sLo = W.project(s, 0.05);
ok(sHi.sustainsToAge > sLo.sustainsToAge, 'SRM 6% lasts longer than 5%');

// 4. messy / missing data is refused, not guessed
const bad = clone(spy); bad.rows[3].tivY = null;
ok(W.check(bad).problems.some(p => /year 4/.test(p) && /Y/.test(p)), 'missing value is flagged with its row');
ok(!W.calibrate(bad).ok, 'calculation refuses missing figures');
const swap = clone(spy); swap.rows[5].tivX = 99999;
ok(W.check(swap).warnings.length > 0, 'X above Y is warned');
const norates = clone(spy); norates.rates = {x: null, y: 0.05};
ok(W.check(norates).problems.length > 0, 'missing scenario rate is a problem');
const noSA = clone(srm); noSA.rows[4].sa = null;
ok(W.check(noSA).problems.some(p => /sum assured/.test(p)), 'per-scenario plan without sum assured is refused');
const old = clone(spy); old.rows = old.rows.map(r => ({year: r.year, age: r.age, premium: r.premium, alloc: r.alloc, charges: r.chargesX, tivX: r.tivX, tivY: r.tivY, sa: r.sa}));
ok(Math.abs(W.calibrate(old).accuracy.maxErr - m.accuracy.maxErr) < 0.002, 'quotations saved before this update still work');

// 5. AI photo reading maps to the same shape (simulated AI replies)
const toAI = (q) => ({product: q.product, entry_age_next_birthday: q.entryAge, annual_premium: q.premium, premium_term_years: q.termYears,
  rate_x_percent: 2, rate_y_percent: 5, sustain_age_x: q.sustain.x, sustain_age_y: q.sustain.y, sustain_age_best_estimate: q.sustain.best,
  bonus: q.bonus ? {name: q.bonus.name, amount: q.bonus.amount, first_age_next_birthday: q.bonus.age, every_years: q.bonus.every} : null,
  rows: q.rows.map(r => ({year: r.year, age: r.age, premium_paid: r.premium, allocated_premium: r.alloc,
    insurance_charges_x: r.chargesX ? r.chargesX - 72 : 0, insurance_charges_y: r.chargesY ? r.chargesY - 72 : 0,
    basic_charge_x: r.basicX, basic_charge_y: r.basicY, other_charges: r.chargesX || r.chargesY ? 72 : 0, sum_assured: r.sa, value_x: r.tivX, value_y: r.tivY})), unclear: []});
for (const [q, ref, name] of [[spy, m, 'SPY'], [srm, s, 'SRM']]) {
  const d = P.fromAI(toAI(q)), mm = W.calibrate(d);
  ok(mm.ok && Math.abs(mm.accuracy.maxErr - ref.accuracy.maxErr) < 0.002 && mm.accuracy.lapse.y.app === ref.accuracy.lapse.y.app, name + ': AI reading gives the same result as the PDF reading');
}
const ai = toAI(spy); ai.rows[10].value_y = null; ai.unclear = ['year 15 value at 5% is blurred'];
const d2 = P.fromAI(ai); ok(!W.calibrate(d2).ok && d2.unclear.length === 1, 'AI null is kept as missing and blocks the calculation');

// 5b. several photos of one quotation, read in two batches, then merged
{
  const full = toAI(spy);
  full.product_code = '8004'; full.gender = 'Male'; full.smoker = 'No'; full.occupation_class = 1; full.basic_sum_assured = 100000;
  full.riders = spy.policy.riders.map(r => ({code: r.code, name: r.name, years: r.years, sum_assured: r.sa}));
  const planPage = Object.assign({}, full, {rows: [], rate_x_percent: null, rate_y_percent: null, sustain_age_x: null, sustain_age_y: null});
  const tableA = {rate_x_percent: 2, rate_y_percent: 5, rows: full.rows.slice(0, 9), riders: [], unclear: []};
  const tableB = {sustain_age_x: 72, sustain_age_y: 80, rows: full.rows.slice(9), riders: [], unclear: []};
  const merged = P.mergeAI([P.fromAI(planPage), P.fromAI(tableA), P.fromAI(tableB)]);
  const one = P.fromAI(full);
  ok(merged.rows.length === one.rows.length && merged.policy.code === '8004' && merged.policy.riders.length === 3 && merged.sustain.y === 80 && merged.rates.x === 0.02,
    'photos read in parts merge into one complete quotation');
  const mm = W.calibrate(merged), m1 = W.calibrate(one);
  ok(mm.ok && Math.abs(mm.accuracy.maxErr - m1.accuracy.maxErr) < 1e-9, 'merged photos give the same result as one complete reading');
  const clash = P.fromAI(Object.assign({}, tableA, {rows: tableA.rows.map((r, i) => i === 2 ? Object.assign({}, r, {value_y: r.value_y + 500}) : r)}));
  const mc = P.mergeAI([P.fromAI(tableA), clash]);
  ok(mc.unclear.some(u => /year 3/.test(u) && /tivY/.test(u)), 'photos that disagree on a number are flagged for the agent');
}

// 6. plan details read from the PDF (needed for GE's rate tables)
ok(spy.policy && spy.policy.code === '8004' && spy.policy.bsa === 100000 && spy.policy.riders.map(r => r.code).join() === 'U807,U809,U875', 'SPY plan details: 8004, RM100k, riders U807 U809 U875');
ok(srm.policy && srm.policy.code === '0562' && srm.policy.bsa === 500000 && srm.policy.premiumYears === 5, 'SRM plan details: 0562, RM500k, 5-year premium');

// 7. GE rate tables (private knowledge pack; only on Kah Jian's PC, never in the public repo)
let kb = null; try { kb = require('../private/ge_ilp_knowledge.json'); } catch (e) {}
if (!kb) console.log('(GE rate-table checks skipped: private/ge_ilp_knowledge.json not on this machine)');
else {
  const KBM = require('../docs/kb.js');
  const t = KBM.build(kb, Object.assign({entryAge: 26}, spy.policy), 74);
  const printed = {1: [121, 45, 50, 936], 10: [121, 77, 71, 937], 20: [277, 272, 209, 1134], 30: [810, 704, 503, 2067], 40: [1935, 1603, 1219, 3437], 50: [4180, 2351, 1993, 7093]};
  let worst = 0;
  for (const [y, [b, ci, pw, sh]] of Object.entries(printed)) {
    const p = t.parts[y - 1];
    for (const [ge, app] of [[b, p.basic], [ci, p.riders.U807], [pw, p.riders.U809], [sh, p.riders.U875]]) worst = Math.max(worst, Math.abs(app - ge) / ge);
  }
  ok(worst < 0.015, 'GE tables give SPY\'s printed basic, CI, waiver and medical charges within 1.5% (worst ' + (worst * 100).toFixed(2) + '%)');
  const mt = W.calibrate(spy, kb), st = W.calibrate(srm, kb);
  ok(mt.table && mt.table.maxDev < 0.01, 'SPY: tables within 1% of every printed total charge');
  ok(st.table && st.table.maxDev < 0.01, 'SRM: tables within 1% of every printed insurance rate');
  ok(mt.accuracy.lapse.x.app === 72 && mt.accuracy.lapse.y.app === 80, 'SPY with tables, no tuning: run-out ages 72 / 80 match GE');
  ok(st.accuracy.lapse.x.app === 61 && st.accuracy.lapse.y.app === 71, 'SRM with tables, no tuning: run-out ages 61 / 71 match GE');
  ok(mt.accuracy.maxErr < 0.01 && st.accuracy.maxErr < 0.01, 'with tables, fund values within 1% of every GE printed value');
  ok(W.project(mt, 0.08).fullTerm, 'SPY with tables: 8% lasts to 100');
  const n = W.minReturn(mt); ok(n > 0.07 && n < 0.08, 'SPY with tables: about 7.5% needed to last to 100 (' + (n * 100).toFixed(2) + '%)');
  const wrong = clone(spy); wrong.policy.code = '9999';
  const mw = W.calibrate(wrong, kb); ok(mw.ok && !mw.table && mw.tableNotes.length, 'unknown plan code falls back to estimates with a note');
}

// 8. team server (the real Code.gs, run in memory with fake codes): tables only for signed-in agents, only the owner uploads
let S = null; try { S = require('./server-sim.js'); } catch (e) {}
if (!S) console.log('(team server checks skipped: REDEFINE Form Filler/server/Code.gs not next to this project)');
else {
  const T = {code: 'test-team-code', name: 'A'}, O = {code: 'test-owner-code', name: 'K'};
  const text = kb ? JSON.stringify(kb) : JSON.stringify({coi_tables: {}, products: {}, medical_riders: {}, other_riders: {}, pad: 'x'.repeat(2000)});
  ok(S.call(Object.assign({op: 'kbget'}, T)).error === 'no_kb', 'server: nothing to share before the owner uploads');
  ok(S.call(Object.assign({op: 'kbput', text}, T)).error === 'not_allowed', 'server: the team code cannot upload tables');
  ok(S.call({op: 'kbget', code: 'wrong'}).error === 'unauthorized', 'server: a wrong code gets nothing');
  ok(S.call(Object.assign({op: 'kbput', text: '{"a":1}' + ' '.repeat(2000)}, O)).error === 'invalid_request', 'server: a file without rate tables is refused');
  const up = S.call(Object.assign({op: 'kbput', text}, O));
  ok(up.ok && up.ver, 'server: the owner code uploads the tables');
  const g = S.call(Object.assign({op: 'kbget'}, T));
  ok(g.text === text && g.ver === up.ver, 'server: an agent downloads exactly what the owner uploaded');
  ok(S.call(Object.assign({op: 'kbget', have: g.ver}, T)).same === true, 'server: a phone that already has this version skips the download');
  ok(S.call(Object.assign({op: 'login'}, T)).ok, 'server: existing sign-in still works');
}

console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
