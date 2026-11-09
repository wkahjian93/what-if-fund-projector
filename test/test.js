// node test/test.js : engine and reader checks against the real MPOS quotation figures (fixture-mpos.json)
const W = require('../docs/engine.js'), P = require('../docs/parse.js'), q = require('./fixture-mpos.json');
let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log('FAIL', msg)); };

// 1. re-creates GE's own 2% / 5% figures
const m = W.calibrate(q);
ok(m.ok, 'calibrates');
ok(m.accuracy.maxErr < 0.005, 'within 0.5% of every printed GE value (got ' + (m.accuracy.maxErr * 100).toFixed(2) + '%)');
ok(m.accuracy.lapse.x.app === 72 && m.accuracy.lapse.y.app === 80, 'run-out ages 72 / 80 match the quotation');
ok(m.accuracy.grade === 'good', 'grade good');
ok(Math.abs(m.costs.fmc - 0.0075) < 0.0006, 'fitted fund charge ~0.75% (fund fact sheet says 0.75%)');

// 2. the pain point: 8% and the return needed for age 100
const p8 = W.project(m, 0.08);
ok(!p8.fullTerm && p8.sustainsToAge > 80 && p8.sustainsToAge < 100, '8% lasts longer than 5% but not to 100 (age ' + p8.sustainsToAge + ')');
ok(p8.fundAt(65) > W.project(m, 0.05).fundAt(65), '8% fund at 65 above 5%');
const need = W.minReturn(m);
ok(need > 0.08 && need < 0.12, 'return needed to last to 100 is between 8% and 12% (' + (need * 100).toFixed(2) + '%)');
ok(W.project(m, need).fullTerm && !W.project(m, need - 0.002).fullTerm, 'minReturn is the boundary');
let prev = -1, mono = true; for (let r = 0; r <= 0.12; r += 0.01) { const a = W.project(m, r).sustainsToAge; if (a < prev) mono = false; prev = a; }
ok(mono, 'higher return never shortens the policy');

// 3. messy / missing data is refused, not guessed
const bad = JSON.parse(JSON.stringify(q)); bad.rows[3].tivY = null;
const c1 = W.check(bad); ok(c1.problems.some(p => /year 4/.test(p) && /Y/.test(p)), 'missing value is flagged with its row');
ok(!W.calibrate(bad).ok, 'calculation refuses missing figures');
const swap = JSON.parse(JSON.stringify(q)); swap.rows[5].tivX = 99999;
ok(W.check(swap).warnings.length > 0, 'X above Y is warned');
const norates = JSON.parse(JSON.stringify(q)); norates.rates = {x: null, y: 0.05};
ok(W.check(norates).problems.length > 0, 'missing scenario rate is a problem');

// 4. AI photo reading maps to the same shape (simulated AI reply with one unclear number)
const ai = {product: 'SmartProtect You (SPY-100)', entry_age_next_birthday: 26, annual_premium: 4000.2, premium_term_years: 74, rate_x_percent: 2, rate_y_percent: 5,
  sustain_age_x: 72, sustain_age_y: 80, sustain_age_best_estimate: 100,
  rows: q.rows.map(r => ({year: r.year, age: r.age, premium_paid: r.premium, allocated_premium: r.alloc, insurance_charges_total: r.charges - (r.charges ? 72 : 0), other_charges: r.charges ? 72 : 0, value_x: r.tivX, value_y: r.tivY})),
  unclear: []};
const d = P.fromAI(ai); const m2 = W.calibrate(d);
ok(m2.ok && Math.abs(m2.accuracy.maxErr - m.accuracy.maxErr) < 1e-9, 'AI reading gives the same result as the PDF reading');
ai.rows[10].value_y = null; ai.unclear = ['year 15 value at 5% is blurred'];
const d2 = P.fromAI(ai); ok(!W.calibrate(d2).ok && d2.unclear.length === 1, 'AI null is kept as missing and blocks the calculation');

console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
