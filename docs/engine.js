/* What-If Fund Projector: calculation engine (works in the browser and in Node).
   Re-creates an investment-linked quotation's fund value from its own table, checks that it matches
   the quotation's 2% / 5% figures, then projects any other return.

   Model, per policy month (premium mode monthly; charges are deducted monthly):
     fund += allocated premium / 12 - (insurance + other charges) / 12
     if fund < 0 -> the policy is no longer sustainable (lapse)
     fund *= (1 + r * (1 - tax)) ^ (1/12)        r = gross fund return, same basis as the quotation's X% / Y%
     fund -= fund * fmc / 12                      fmc = fund management charge
   tax and fmc are fitted to the quotation's own year-by-year figures (Malaysian ILP funds pay 8% tax on income). */
(function (root) {
  'use strict';

  const num = v => (v === null || v === undefined || v === '' || !isFinite(+v)) ? null : +v;

  function yearStep(F, alloc, charges, r, p) {
    const g = Math.pow(1 + r * (1 - p.tax), 1 / 12);
    let fmcPaid = 0;
    for (let m = 0; m < 12; m++) {
      F += alloc / 12 - charges / 12;
      if (F < 0) return {F: 0, lapsed: true, month: m, fmc: fmcPaid};
      F *= g;
      const c = F * p.fmc / 12; fmcPaid += c; F -= c;
    }
    return {F, lapsed: false, fmc: fmcPaid};
  }

  /* Clean and check the table. Returns {rows, problems[], warnings[]} */
  function check(q) {
    const problems = [], warnings = [];
    const rows = (q.rows || []).map(r => ({
      year: num(r.year), age: num(r.age), premium: num(r.premium), alloc: num(r.alloc), charges: num(r.charges),
      tivX: num(r.tivX), tivY: num(r.tivY), sa: num(r.sa)
    }));
    const rx = num(q.rates && q.rates.x), ry = num(q.rates && q.rates.y);
    if (rx === null || ry === null || rx <= -0.5 || ry <= -0.5) problems.push('The two illustrated returns (Scenario X and Y) are missing.');
    else if (q.rates.x >= q.rates.y) problems.push('Scenario X should be the lower return and Y the higher one.');
    if (rows.length < 3) problems.push('Need at least 3 rows of the yearly table.');
    let lastYear = 0;
    rows.forEach((r, i) => {
      const at = 'Row ' + (i + 1) + (r.year ? ' (year ' + r.year + ')' : '');
      for (const k of ['year', 'alloc', 'charges', 'tivX', 'tivY']) if (r[k] === null) problems.push(at + ': ' + LABEL[k] + ' is missing or unclear.');
      if (r.year !== null) {
        if (r.year <= lastYear) problems.push(at + ': policy years must go up.');
        lastYear = r.year;
      }
      if (r.tivX !== null && r.tivY !== null && r.tivX > r.tivY + 1 && q.rates && q.rates.x < q.rates.y) warnings.push(at + ': the X value is above the Y value. Check the reading.');
      if (r.alloc !== null && r.premium !== null && r.alloc > r.premium * 1.2 + 1) warnings.push(at + ': allocated premium is above premium paid. Check the reading.');
    });
    const ages = rows.filter(r => r.year !== null && r.age !== null).map(r => r.age - r.year);
    if (ages.length && ages.some(a => a !== ages[0])) warnings.push('Ages do not move one-for-one with policy years. Check the age column.');
    if (!ages.length && !(num(q.entryAge) > 0)) problems.push('The age column (or the entry age) is missing.');
    return {rows, problems, warnings};
  }
  const LABEL = {year: 'policy year', alloc: 'allocated premium', charges: 'insurance + other charges', tivX: 'value at X%', tivY: 'value at Y%'};

  /* Fit tax and fund charge on consecutive years. */
  function fitCosts(rows, rates) {
    const pairs = [];
    const byYear = {}; rows.forEach(r => byYear[r.year] = r);
    rows.forEach(r => {
      const prev = r.year === 1 ? {tivX: 0, tivY: 0} : byYear[r.year - 1];
      if (!prev) return;
      for (const [k, rate] of [['tivX', rates.x], ['tivY', rates.y]]) {
        if (r[k] > 50 && (prev[k] > 0 || r.year === 1)) pairs.push([prev[k], r.alloc, r.charges, rate, r[k]]);
      }
    });
    if (pairs.length < 4) return {tax: 0.08, fmc: 0.0075, fitted: false, pairs: pairs.length};
    const err = (tax, fmc) => {
      let e = 0;
      for (const [F0, a, c, r, F1] of pairs) {
        const s = yearStep(F0, a, c, r, {tax, fmc});
        const d = (s.F - F1) / Math.max(F1, 500); e += d * d;
      }
      return e;
    };
    let best = [0.08, 0.0075, Infinity];
    for (let t = 0; t <= 0.25001; t += 0.01) for (let f = 0; f <= 0.03001; f += 0.0005) {
      const e = err(t, f); if (e < best[2]) best = [t, f, e];
    }
    for (let step of [0.004, 0.001, 0.0003]) {
      const [t0, f0] = best;
      for (let t = t0 - step * 3; t <= t0 + step * 3; t += step) for (let f = f0 - step; f <= f0 + step; f += step / 4) {
        if (t < 0 || f < 0) continue; const e = err(t, f); if (e < best[2]) best = [t, f, e];
      }
    }
    return {tax: best[0], fmc: best[1], fitted: true, pairs: pairs.length, rms: Math.sqrt(best[2] / pairs.length)};
  }

  /* Build a full year-by-year plan (allocated premium and charges for every policy year). */
  function calibrate(q) {
    const chk = check(q);
    if (chk.problems.length) return {ok: false, problems: chk.problems, warnings: chk.warnings};
    const rates = {x: +q.rates.x, y: +q.rates.y};
    /* drop the all-zero rows the quotation prints after the fund has run out in both scenarios */
    let rows = chk.rows.slice();
    const dataEnd = rows.length - 1 - rows.slice().reverse().findIndex(r => r.tivX > 0 || r.tivY > 0 || r.charges > 0);
    const lastPrinted = rows[rows.length - 1];
    rows = rows.slice(0, dataEnd + 1);
    const entryAge = num(q.entryAge) !== null ? +q.entryAge : (rows[0].age - rows[0].year);
    const termYears = Math.max(num(q.termYears) || 0, lastPrinted.year);
    const costs = fitCosts(rows, rates);
    const p = {tax: costs.tax, fmc: costs.fmc};

    const plan = {}; // year -> {alloc, charges, src: 'quote'|'between'|'after'}
    const sameShape = (a, b) => a > 0 && b > 0;
    if (rows[0].year > 1) for (let y = 1; y < rows[0].year; y++) plan[y] = {alloc: rows[0].alloc, charges: rows[0].charges, src: 'between'};
    rows.forEach(r => plan[r.year] = {alloc: r.alloc, charges: r.charges, src: 'quote'});
    const scales = [];
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i];
      if (b.year - a.year < 2) continue;
      const ys = []; for (let y = a.year + 1; y < b.year; y++) ys.push(y);
      const base = y => sameShape(a.charges, b.charges) ? a.charges * Math.pow(b.charges / a.charges, (y - a.year) / (b.year - a.year)) : a.charges + (b.charges - a.charges) * (y - a.year) / (b.year - a.year);
      const alloc = Math.min(a.alloc, b.alloc);
      const fill = s => ys.forEach(y => plan[y] = {alloc, charges: base(y) * s, src: 'between'});
      const cands = [['tivX', rates.x], ['tivY', rates.y]].filter(([k]) => a[k] > 0 && b[k] > 0);
      if (!cands.length) { fill(1); continue; }
      const err = s => {
        fill(s); let e = 0;
        for (const [k, r] of cands) {
          let F = a[k], dead = false;
          for (let y = a.year + 1; y <= b.year; y++) { const st = yearStep(F, plan[y].alloc, plan[y].charges, r, p); if (st.lapsed) { dead = true; break; } F = st.F; }
          e += dead ? -5 : Math.log(Math.max(F, 1) / b[k]);
        }
        return e;
      };
      let lo = 0.2, hi = 3;
      for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; err(m) > 0 ? lo = m : hi = m; }
      const s = (lo + hi) / 2; fill(s); scales.push({from: a.year, to: b.year, scale: s});
    }

    /* years after the last printed figures: charges keep growing at the last printed pace,
       tuned so the app's run-out ages match the quotation's "may sustain ... up to age N" lines */
    const last = rows[rows.length - 1];
    const prev = rows.slice(0, -1).reverse().find(r => r.charges > 0 && r.year < last.year);
    let g0 = prev && last.charges > 0 ? Math.pow(last.charges / prev.charges, 1 / (last.year - prev.year)) : 1.05;
    const lastPremRow = rows.slice().reverse().find(r => r.alloc > 0) || last;
    const fillAfter = g => { for (let y = last.year + 1; y <= termYears; y++) plan[y] = {alloc: lastPremRow.alloc, charges: last.charges * Math.pow(g, y - last.year), src: 'after'}; };
    fillAfter(g0);
    const targets = [];
    const sus = q.sustain || {};
    for (const [k, r] of [['x', rates.x], ['y', rates.y]]) {
      const age = num(sus[k]);
      if (age === null) continue;
      const years = age - entryAge; // last sustained policy year
      if (years > last.year && years < termYears) targets.push({k, r, years});
    }
    let gUsed = g0, tuned = false;
    if (targets.length) {
      const lapseYear = (g, r) => { fillAfter(g); return runPlan(plan, termYears, r, p).lapseYear || termYears + 1; };
      const gs = targets.map(t => {
        // lapse year falls as g rises: find g where last sustained year == target
        let lo = 0.9, hi = 1.6;
        for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; (lapseYear(m, t.r) - 1 > t.years) ? lo = m : hi = m; }
        const gHi = hi; lo = 0.9; hi = 1.6;
        for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; (lapseYear(m, t.r) - 1 >= t.years) ? lo = m : hi = m; }
        return Math.sqrt(gHi * lo); // middle of the range that gives the stated year
      });
      gUsed = gs.reduce((a, b) => a * b, 1) ** (1 / gs.length); tuned = true;
    }
    fillAfter(gUsed);

    const model = {ok: true, q, rates, entryAge, termYears, plan, costs, p, scales, growthAfter: gUsed, growthTuned: tuned,
      lastDataYear: last.year, rows: chk.rows, warnings: chk.warnings, sustain: sus};
    model.accuracy = accuracy(model);
    return model;
  }

  function runPlan(plan, termYears, r, p) {
    let F = 0, paid = 0, chargesPaid = 0; const years = [];
    for (let y = 1; y <= termYears; y++) {
      const pl = plan[y];
      const st = yearStep(F, pl.alloc, pl.charges, r, p);
      if (st.lapsed) return {years, lapseYear: y};
      F = st.F; chargesPaid += pl.charges;
      years.push({year: y, fund: F, charges: pl.charges, src: pl.src});
    }
    return {years, lapseYear: null};
  }

  function project(model, r) {
    const out = runPlan(model.plan, model.termYears, r, model.p);
    out.years.forEach(y => y.age = model.entryAge + y.year);
    const lastAge = out.lapseYear ? model.entryAge + out.lapseYear - 1 : model.entryAge + model.termYears;
    return {rate: r, years: out.years, lapseYear: out.lapseYear, sustainsToAge: lastAge, sustainsYears: out.lapseYear ? out.lapseYear - 1 : model.termYears,
      fullTerm: !out.lapseYear, endAge: model.entryAge + model.termYears,
      fundAt: age => { const y = out.years.find(v => v.age === age); return y ? y.fund : (out.lapseYear && age > lastAge ? 0 : null); }};
  }

  /* Lowest return that keeps the policy going to targetAge (default: end of coverage). */
  function minReturn(model, targetAge) {
    const target = (targetAge || model.entryAge + model.termYears);
    const ok = r => project(model, r).sustainsToAge >= target;
    let lo = -0.05, hi = 0.4;
    if (!ok(hi)) return null; if (ok(lo)) return lo;
    for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; ok(m) ? hi = m : lo = m; }
    return hi;
  }

  /* How closely the app re-creates the quotation's own X% and Y% columns. */
  function accuracy(model) {
    const res = {rows: [], maxErr: 0, worst: null};
    const px = project(model, model.rates.x), py = project(model, model.rates.y);
    for (const r of model.rows) {
      const line = {year: r.year, age: model.entryAge + r.year};
      for (const [k, pr] of [['X', px], ['Y', py]]) {
        const ge = r['tiv' + k], app = pr.fundAt(line.age);
        line['ge' + k] = ge; line['app' + k] = app === null ? 0 : app;
        if (ge >= 2000) {
          const e = Math.abs(line['app' + k] - ge) / ge;
          line['err' + k] = e;
          if (e > res.maxErr) { res.maxErr = e; res.worst = {year: r.year, scen: k}; }
        } else if (ge === 0 && line['app' + k] > 2000) { line['err' + k] = 1; res.maxErr = Math.max(res.maxErr, 1); res.worst = {year: r.year, scen: k}; }
      }
      res.rows.push(line);
    }
    res.lapse = {
      x: {ge: num(model.sustain.x), app: px.sustainsToAge, full: px.fullTerm},
      y: {ge: num(model.sustain.y), app: py.sustainsToAge, full: py.fullTerm}
    };
    res.lapseMatch = ['x', 'y'].every(k => res.lapse[k].ge === null || Math.abs(res.lapse[k].ge - res.lapse[k].app) <= 1);
    res.grade = res.maxErr <= 0.03 && res.lapseMatch ? 'good' : res.maxErr <= 0.08 ? 'fair' : 'poor';
    return res;
  }

  const api = {yearStep, check, calibrate, project, minReturn, accuracy};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WIF = api;
})(typeof self !== 'undefined' ? self : this);
