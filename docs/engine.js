/* What-If Fund Projector: calculation engine (works in the browser and in Node).
   Re-creates an investment-linked quotation's fund value from its own table, checks that it matches
   the quotation's X% / Y% figures, then projects any other return.

   Model, per policy month (charges are deducted monthly):
     charge = fixed / 12 + q / 12 * max(sumAssured - fund, 0)
        fixed = charges that do not depend on the fund (riders, policy fee; for "sum assured + fund" death benefits, all of them)
        q     = insurance rate per RM of sum at risk, for "higher of sum assured or fund" death benefits (0 otherwise)
     fund += allocated premium / 12 - charge          (fund < 0 -> no longer sustainable)
     fund *= (1 + r * (1 - tax)) ^ (1/12);  fund -= fund * fmc / 12
   tax and fmc are fitted to the quotation's own year-by-year figures.

   Two GE quotations (SmartProtect You, Smart Revive Max) give the same shape for q by age: it rises about 8-9% a year
   from age 50 to 76. That is used as the reference when a quotation stops printing charges. */
(function (root) {
  'use strict';

  const num = v => (v === null || v === undefined || v === '' || !isFinite(+v)) ? null : +v;
  const REF_Q_GROWTH = 1.085; // GE insurance rate per RM at risk, yearly rise by age (ages 50-76, two GE quotations)

  /* One policy year, month by month. The fund is held as two accounts: ipa (premiums) and tupa (top-ups and
     bonuses). Single-account plans simply never put anything in tupa.
       pl.riskIPA  amount at risk = sum assured - IPA only (wealth plans); otherwise - the whole fund
       pl.supp     supplementary charge, a yearly % of the IPA, taken from the IPA
       pl.loy      bonus at the year end as a % of the IPA, credited into the TUPA
       pl.bonus    fixed RM bonus at the year end */
  function yearStep(F, pl, r, p) {
    const g = Math.pow(1 + r * (1 - p.tax), 1 / 12);
    let ipa = typeof F === 'object' ? F.ipa : F, tupa = typeof F === 'object' ? F.tupa : 0;
    for (let m = 0; m < 12; m++) {
      const base = pl.riskIPA ? ipa : ipa + tupa;
      const chg = pl.fixed / 12 + (pl.q ? pl.q / 12 * Math.max(pl.sa - base, 0) : 0);
      ipa += pl.alloc / 12;
      const supp = pl.supp ? Math.max(ipa, 0) * pl.supp / 12 : 0;
      const tot = ipa + tupa;
      if (tot - chg - supp < 0) return {F: 0, S: {ipa: 0, tupa: 0}, lapsed: true, month: m};
      if (tupa > 0 && tot > 0) { const w = ipa / tot; ipa -= chg * w; tupa -= chg * (1 - w); } else ipa -= chg;
      ipa -= supp;
      ipa *= g; ipa -= ipa * p.fmc / 12;
      tupa *= g; tupa -= tupa * p.fmc / 12;
    }
    tupa += (pl.bonus || 0) + (pl.loy ? pl.loy * Math.max(ipa, 0) : 0);
    return {F: ipa + tupa, S: {ipa, tupa}, lapsed: false};
  }
  /* average IPA a year's supplementary charge is taken from (to turn a printed RM charge into a %) */
  function ipaBase(F, pl, r, p) {
    const g = Math.pow(1 + r * (1 - p.tax), 1 / 12);
    let ipa = typeof F === 'object' ? F.ipa : F, tupa = typeof F === 'object' ? F.tupa : 0, sum = 0;
    for (let m = 0; m < 12; m++) {
      const base = pl.riskIPA ? ipa : ipa + tupa;
      const chg = pl.fixed / 12 + (pl.q ? pl.q / 12 * Math.max(pl.sa - base, 0) : 0);
      ipa += pl.alloc / 12; sum += Math.max(ipa, 0);
      const tot = ipa + tupa;
      if (tupa > 0 && tot > 0) { const w = ipa / tot; ipa -= chg * w; tupa -= chg * (1 - w); } else ipa -= chg;
      ipa *= g; ipa -= ipa * p.fmc / 12; tupa *= g; tupa -= tupa * p.fmc / 12;
    }
    return sum / 12;
  }

  /* Normalise rows (older saves have a single "charges" column). */
  function normRows(q) {
    return (q.rows || []).map(r => {
      const o = {year: num(r.year), age: num(r.age), premium: num(r.premium), alloc: num(r.alloc), sa: num(r.sa),
        tivX: num(r.tivX), tivY: num(r.tivY), basicX: num(r.basicX), basicY: num(r.basicY),
        chargesX: num(r.chargesX), chargesY: num(r.chargesY), suppX: num(r.suppX), suppY: num(r.suppY),
        ipaX: num(r.ipaX), ipaY: num(r.ipaY), tupaX: num(r.tupaX), tupaY: num(r.tupaY)};
      if (o.chargesX === null && o.chargesY === null && num(r.charges) !== null) o.chargesX = o.chargesY = num(r.charges);
      if (o.chargesY === null && o.chargesX !== null && r.chargesY === undefined) o.chargesY = o.chargesX;
      return o;
    });
  }

  /* Clean and check the table. Returns {rows, problems[], warnings[]} */
  function check(q) {
    const problems = [], warnings = [];
    const rows = normRows(q);
    const rx = num(q.rates && q.rates.x), ry = num(q.rates && q.rates.y);
    if (rx === null || ry === null || rx <= -0.5 || ry <= -0.5) problems.push('The two illustrated returns (Scenario X and Y) are missing.');
    else if (rx >= ry) problems.push('Scenario X should be the lower return and Y the higher one.');
    if (rows.length < 3) problems.push('Need at least 3 rows of the yearly table.');
    let lastYear = 0;
    rows.forEach((r, i) => {
      const at = 'Row ' + (i + 1) + (r.year ? ' (year ' + r.year + ')' : '');
      for (const k of ['year', 'alloc', 'chargesX', 'chargesY', 'tivX', 'tivY']) if (r[k] === null) problems.push(at + ': ' + LABEL[k] + ' is missing or unclear.');
      if (r.year !== null) { if (r.year <= lastYear) problems.push(at + ': policy years must go up.'); lastYear = r.year; }
      if (r.tivX !== null && r.tivY !== null && r.tivX > r.tivY + 1 && rx < ry) warnings.push(at + ': the X value is above the Y value. Check the reading.');
      if (r.alloc !== null && r.premium !== null && r.alloc > r.premium * 1.2 + 1) warnings.push(at + ': allocated premium is above premium paid. Check the reading.');
    });
    const level = isLevel(rows);
    if (level && rows.some(r => (r.chargesX > 0 || r.chargesY > 0) && !(r.sa > 0))) problems.push('Charges change with the fund value in this plan, so the sum assured column is needed for every row with charges.');
    const ages = rows.filter(r => r.year !== null && r.age !== null).map(r => r.age - r.year);
    if (ages.length && ages.some(a => a !== ages[0])) warnings.push('Ages do not move one-for-one with policy years. Check the age column.');
    if (!ages.length && !(num(q.entryAge) > 0)) problems.push('The age column (or the entry age) is missing.');
    return {rows, problems, warnings, level};
  }
  const LABEL = {year: 'policy year', alloc: 'allocated premium', chargesX: 'charges at X%', chargesY: 'charges at Y%', tivX: 'value at X%', tivY: 'value at Y%'};

  /* "Higher of sum assured or fund" plans: charges differ between X and Y while both funds are alive. */
  function isLevel(rows) {
    return rows.some(r => r.tivX > 0 && r.tivY > 0 && ((r.basicX !== null && r.basicY !== null && Math.abs(r.basicX - r.basicY) >= 2) ||
      (r.chargesX !== null && r.chargesY !== null && Math.abs(r.chargesX - r.chargesY) >= 2)));
  }

  /* Turn each printed row into {fixed, q}. */
  function rowCosts(rows, level, riskIPA) {
    const byYear = {}; rows.forEach(r => byYear[r.year] = r);
    return rows.map(r => {
      if (!level) return {fixed: Math.max(r.chargesX || 0, r.chargesY || 0), q: 0};
      const prev = r.year === 1 ? {tivX: 0, tivY: 0} : byYear[r.year - 1];
      const qs = [], fixeds = [];
      for (const k of ['X', 'Y']) {
        const acct = riskIPA && r['ipa' + k] !== null ? 'ipa' : 'tiv';
        const ch = r['charges' + k], F1 = r[acct + k];
        if (!(ch > 0) || !(r['tiv' + k] > 0)) continue;
        const Fbar = prev && prev[acct + k] !== null && prev[acct + k] !== undefined ? (prev[acct + k] + F1) / 2 : F1;
        const atRisk = r.sa - Fbar;
        const basic = r['basic' + k];
        if (basic === null || basic === undefined) continue;
        fixeds.push(ch - basic);
        /* no insurance charge because the fund is above the sum assured: nothing at risk, which says nothing about the rate */
        if (basic > 0 && atRisk > Math.max(1000, r.sa * 0.02)) qs.push(basic / atRisk);
      }
      if (!qs.length && fixeds.length) // the rate cannot be read from this row: filled in later from neighbours or GE's tables
        return {fixed: Math.max(0, Math.min(...fixeds)), q: null, qUnknown: true};
      if (!qs.length) { // no split given: use the X / Y difference
        const FX = r.tivX, FY = r.tivY;
        if (r.chargesX > 0 && r.chargesY > 0 && FY - FX > 2000) {
          const q = (r.chargesX - r.chargesY) / (FY - FX);
          return {fixed: Math.max(0, r.chargesX - q * (r.sa - FX)), q: Math.max(0, q)};
        }
        const ch = Math.max(r.chargesX || 0, r.chargesY || 0), F = r.chargesY >= r.chargesX ? r.tivY : r.tivX;
        return {fixed: 0, q: ch > 0 ? ch / Math.max(r.sa - (F || 0), 1) : 0, rough: true};
      }
      return {fixed: Math.max(0, fixeds.reduce((a, b) => a + b, 0) / fixeds.length), q: qs.reduce((a, b) => a + b, 0) / qs.length};
    });
  }

  /* Fit tax and fund charge on consecutive years. */
  function fitCosts(rows, costs, rates, bonusAt, extra) {
    const pairs = [], byYear = {};
    rows.forEach((r, i) => byYear[r.year] = i);
    rows.forEach((r, i) => {
      const prev = r.year === 1 ? {tivX: 0, tivY: 0} : rows[byYear[r.year - 1]];
      if (!prev || byYear[r.year - 1] === undefined && r.year !== 1) return;
      const pl = Object.assign({alloc: r.alloc, fixed: costs[i].fixed, q: costs[i].q, sa: r.sa || 0, bonus: bonusAt(r.year)}, extra(r.year));
      for (const [K, rate] of [['X', rates.x], ['Y', rates.y]]) {
        const k = 'tiv' + K;
        if (!(r[k] > 50 && (prev[k] > 0 || r.year === 1))) continue;
        const S0 = prev['ipa' + K] !== null && prev['ipa' + K] !== undefined ? {ipa: prev['ipa' + K], tupa: prev['tupa' + K] || 0} : (prev[k] || 0);
        pairs.push([S0, Object.assign({}, pl, {supp: (pl.suppK || {})[K] || 0}), rate, r[k]]);
      }
    });
    if (pairs.length < 4) return {tax: 0.08, fmc: 0.0075, fitted: false, pairs: pairs.length};
    const err = (tax, fmc) => { let e = 0; for (const [F0, pl, r, F1] of pairs) { const s = yearStep(F0, pl, r, {tax, fmc}); const d = (s.F - F1) / Math.max(F1, 500); e += d * d; } return e; };
    let best = [0.08, 0.0075, Infinity];
    for (let t = 0; t <= 0.25001; t += 0.01) for (let f = 0; f <= 0.03001; f += 0.0005) { const e = err(t, f); if (e < best[2]) best = [t, f, e]; }
    for (const step of [0.004, 0.001, 0.0003]) {
      const [t0, f0] = best;
      for (let t = t0 - step * 3; t <= t0 + step * 3; t += step) for (let f = f0 - step; f <= f0 + step; f += step / 4) {
        if (t < 0 || f < 0) continue; const e = err(t, f); if (e < best[2]) best = [t, f, e];
      }
    }
    return {tax: best[0], fmc: best[1], fitted: true, pairs: pairs.length, rms: Math.sqrt(best[2] / pairs.length)};
  }

  function runPlan(plan, termYears, r, p) {
    let S = {ipa: 0, tupa: 0}; const years = [];
    for (let y = 1; y <= termYears; y++) {
      const pl = plan[y];
      const st = yearStep(S, pl, r, p);
      if (st.lapsed) return {years, lapseYear: y};
      S = st.S;
      years.push({year: y, fund: st.F, ipa: S.ipa, tupa: S.tupa, src: pl.src});
    }
    return {years, lapseYear: null};
  }

  function calibrate(q, kb) {
    const chk = check(q);
    if (chk.problems.length) return {ok: false, problems: chk.problems, warnings: chk.warnings};
    const rates = {x: +q.rates.x, y: +q.rates.y};
    let rows = chk.rows.slice();
    const lastPrinted = rows[rows.length - 1];
    const live = r => r.tivX > 0 || r.tivY > 0 || r.chargesX > 0 || r.chargesY > 0;
    rows = rows.slice(0, rows.length - rows.slice().reverse().findIndex(live));
    const entryAge = num(q.entryAge) !== null ? +q.entryAge : (rows[0].age - rows[0].year);
    const termYears = Math.max(num(q.termYears) || 0, lastPrinted.year);
    /* GE rate tables (private knowledge pack), when loaded and the plan is recognised */
    let tab = null, tabNotes = [];
    const KBM = root.WIFKB || (typeof require === 'function' ? (() => { try { return require('./kb.js'); } catch (e) { return null; } })() : null);
    if (kb && q.policy && q.policy.code && KBM) {
      const t = KBM.build(kb, Object.assign({}, q.policy, {entryAge, premium: num(q.policy.premium) || num(q.premium)}), termYears);
      if (t.ok) tab = t; tabNotes = t.notes || [];
    }
    const level = tab ? tab.netSA : chk.level;
    /* wealth plans: the amount at risk is measured against the IPA only */
    const riskIPA = rows.some(r => r.ipaX !== null || r.ipaY !== null) || !!(tab && tab.riskIPA);
    /* basic sum assured for the amount at risk (the printed column also holds the uncharged ASA); wealth plans print
       the prevailing sum assured, which is the right base already */
    const bsa = tab && !tab.prevailing && tab.years[0].sa ? tab.years[0].sa : null;
    const costRows = bsa && level ? rows.map(r => Object.assign({}, r, {sa: bsa})) : rows;
    const costs = rowCosts(costRows, level, riskIPA);
    /* rows whose insurance rate cannot be read: GE's tables when loaded, otherwise the neighbouring printed rates
       (geometric in between, the GE age pace after the last one) */
    {
      const known = costs.map((c, i) => [rows[i].year, c.q]).filter(([, v]) => v !== null && v > 0);
      costs.forEach((c, i) => {
        if (c.q !== null) return;
        const y = rows[i].year;
        if (tab && tab.years[y - 1]) { c.q = tab.years[y - 1].q; c.qFromTable = true; return; }
        const lo = known.filter(([ky]) => ky < y).pop(), hi = known.find(([ky]) => ky > y);
        c.q = !known.length ? 0 : lo && hi ? lo[1] * Math.pow(hi[1] / lo[1], (y - lo[0]) / (hi[0] - lo[0]))
          : lo ? lo[1] * Math.pow(REF_Q_GROWTH, y - lo[0]) : hi[1] * Math.pow(REF_Q_GROWTH, y - hi[0]);
      });
    }
    /* bonuses as a % of the IPA, credited into the TUPA: loyalty every N years, booster once */
    const ib = q.ipaBonus || {};
    const loyAt = y => {
      let v = 0; const l = ib.loyalty, x = ib.booster;
      if (l && num(l.pct) && y >= l.first && (y - l.first) % (l.every || 1e9) === 0) v += +l.pct;
      if (x && num(x.pct) && y === +x.year) v += +x.pct;
      return v;
    };
    /* supplementary charge: printed in RM per scenario; turned into a yearly % of the IPA */
    const byYr = {}; rows.forEach((r, i) => byYr[r.year] = i);
    let suppK = {};
    const suppPcts = pp => {
      const out = {};
      rows.forEach((r, i) => {
        if (!(r.suppX > 0 || r.suppY > 0)) return;
        const prev = r.year === 1 ? {ipaX: 0, ipaY: 0, tupaX: 0, tupaY: 0, tivX: 0, tivY: 0} : rows[byYr[r.year - 1]];
        if (!prev) return;
        const pl = {alloc: r.alloc, fixed: costs[i].fixed, q: costs[i].q, sa: r.sa || 0, riskIPA};
        const o = {};
        for (const [K, rate] of [['X', rates.x], ['Y', rates.y]]) {
          if (!(r['supp' + K] > 0)) continue;
          const S0 = prev['ipa' + K] !== null && prev['ipa' + K] !== undefined ? {ipa: prev['ipa' + K], tupa: prev['tupa' + K] || 0} : (prev['tiv' + K] || 0);
          const base = ipaBase(S0, pl, rate, pp);
          if (base > 0) o[K] = r['supp' + K] / base;
        }
        out[r.year] = o;
      });
      return out;
    };
    suppK = suppPcts({tax: 0.08, fmc: 0.01});
    const suppAt = y => {
      const o = suppK[y]; if (o) { const v = Object.values(o); return v.length ? v.reduce((a, c) => a + c, 0) / v.length : 0; }
      const ys = Object.keys(suppK).map(Number).sort((a, c) => a - c);
      const lo = ys.filter(v => v < y).pop(), hi = ys.find(v => v > y);
      if (lo === undefined || hi === undefined) return 0;
      return Math.min(suppAt(lo), suppAt(hi));
    };
    const extra = y => ({riskIPA, loy: loyAt(y), suppK: suppK[y] || {}});
    /* bonus / booster credited into the fund at the policy anniversary of the stated age (age next birthday) */
    const b = q.bonus && num(q.bonus.amount) > 0 && num(q.bonus.age) > 0 ? q.bonus : null;
    const bonusAt = y => { if (!b) return 0; const age = entryAge + y, k = age - b.age; return k === 0 || (k > 0 && num(b.every) > 0 && k % b.every === 0) ? +b.amount : 0; };
    let fit = fitCosts(rows, costs, rates, bonusAt, extra);
    if (Object.keys(suppK).length) { suppK = suppPcts({tax: fit.tax, fmc: fit.fmc}); fit = fitCosts(rows, costs, rates, bonusAt, extra); }
    const p = {tax: fit.tax, fmc: fit.fmc};

    const plan = {};
    const put = (y, alloc, fixed, qq, sa, src) => plan[y] = {alloc, fixed, q: qq, sa: sa || 0, src, bonus: bonusAt(y), loy: loyAt(y), supp: suppAt(y), riskIPA};
    if (rows[0].year > 1) for (let y = 1; y < rows[0].year; y++) put(y, rows[0].alloc, costs[0].fixed, costs[0].q, rows[0].sa, 'between');
    rows.forEach((r, i) => put(r.year, r.alloc, costs[i].fixed, costs[i].q, bsa || r.sa, 'quote'));
    const geo = (a, b, t) => a > 0 && b > 0 ? a * Math.pow(b / a, t) : a + (b - a) * t;

    /* years the quotation skips: fill between printed years, then scale so GE's own X / Y values come out right */
    const scales = [];
    if (!tab) for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i], ca = costs[i - 1], cb = costs[i];
      if (b.year - a.year < 2) continue;
      const ys = []; for (let y = a.year + 1; y < b.year; y++) ys.push(y);
      const alloc = Math.min(a.alloc, b.alloc);
      /* if one end has no charges (fund already gone in both scenarios there), carry the other end */
      const fa = ca.fixed, fb = cb.fixed || ca.fixed, qa = ca.q, qb = cb.q || ca.q;
      const fill = s => ys.forEach(y => { const t = (y - a.year) / (b.year - a.year); put(y, alloc, geo(fa, fb, t) * s, geo(qa, qb, t) * s, a.sa + ((b.sa || a.sa) - a.sa) * t, 'between'); });
      const cands = [['tivX', rates.x], ['tivY', rates.y]].filter(([k]) => a[k] > 0 && b[k] > 0);
      if (!cands.length) { fill(1); continue; }
      const err = s => {
        fill(s); let e = 0;
        for (const [k, r] of cands) {
          const K = k.slice(3);
          let S = a['ipa' + K] !== null && a['ipa' + K] !== undefined ? {ipa: a['ipa' + K], tupa: a['tupa' + K] || 0} : a[k], tot = a[k], dead = false;
          for (let y = a.year + 1; y <= b.year; y++) { const st = yearStep(S, plan[y], r, p); if (st.lapsed) { dead = true; break; } S = st.S; tot = st.F; }
          e += dead ? -5 : Math.log(Math.max(tot, 1) / b[k]);
        }
        return e;
      };
      let lo = 0.2, hi = 3;
      for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; err(m) > 0 ? lo = m : hi = m; }
      const s = (lo + hi) / 2; fill(s); scales.push({from: a.year, to: b.year, scale: s});
    }

    /* a scenario that runs out between two printed years, at an age the quotation states: tune the insurance rate in
       that gap (only the rate, so a scenario with nothing at risk is unaffected) so the run-out lands on that age */
    if (!tab) {
      const sus0 = q.sustain || {};
      for (const [K, r] of [['X', rates.x], ['Y', rates.y]]) {
        const age = num(sus0[K.toLowerCase()]); if (age === null) continue;
        const t = age - entryAge; // last sustained policy year
        for (let i = 1; i < rows.length; i++) {
          const a = rows[i - 1], b = rows[i];
          if (!(a['tiv' + K] > 0 && b['tiv' + K] === 0 && t >= a.year && t < b.year && b.year - a.year >= 2)) continue;
          const ys = []; for (let y = a.year + 1; y < b.year; y++) ys.push(y);
          if (!ys.some(y => plan[y].q > 0)) continue; // charges do not depend on the fund: nothing to tune
          /* only when the other scenario has nothing at risk in this gap (above the sum assured, or already gone);
             otherwise its printed values already pin the rate down */
          const O = K === 'X' ? 'Y' : 'X', acct = riskIPA ? 'ipa' : 'tiv';
          const oFree = [a, b].every(rw => !(rw['tiv' + O] > 0) || (rw[acct + O] !== null && rw[acct + O] >= (rw.sa || 0)));
          if (!oFree) continue;
          const base = ys.map(y => plan[y].q);
          const lapseIn = sc => { ys.forEach((y, j) => plan[y].q = base[j] * sc); return runPlan(plan, b.year, r, p).lapseYear || b.year + 1; };
          /* the range of factors that give exactly the stated age; take its middle */
          let lo = 0.1, hi = 10;
          for (let k = 0; k < 50; k++) { const m = Math.sqrt(lo * hi); (lapseIn(m) - 1 > t) ? lo = m : hi = m; }
          const fLo = hi; lo = 0.1; hi = 10;
          for (let k = 0; k < 50; k++) { const m = Math.sqrt(lo * hi); (lapseIn(m) - 1 >= t) ? lo = m : hi = m; }
          const sc = Math.sqrt(fLo * lo); lapseIn(sc); scales.push({from: a.year, to: b.year, scale: sc, byRunOut: K});
        }
      }
    }

    /* after the last printed charges: each part keeps its own printed pace (the insurance rate uses the GE reference
       when the plan's own figures stop before age 50), times one extra factor tuned so the run-out ages match the
       quotation's "policy may sustain ... up to age N" lines */
    const li = rows.length - 1, last = rows[li], cl = costs[li];
    const pi = rows.slice(0, li).map((r, i) => i).reverse().find(i => costs[i].fixed > 0 || costs[i].q > 0);
    const gap = pi === undefined ? 1 : last.year - rows[pi].year;
    const cp = pi === undefined ? cl : costs[pi];
    const clampG = g => Math.min(1.25, Math.max(1, g));
    const gF = cp.fixed > 0 && cl.fixed > 0 ? clampG(Math.pow(cl.fixed / cp.fixed, 1 / gap)) : 1;
    const ownQ = cp.q > 0 && cl.q > 0 ? Math.pow(cl.q / cp.q, 1 / gap) : null;
    const gQ = ownQ && pi !== undefined && entryAge + rows[pi].year >= 45 ? clampG(ownQ) : REF_Q_GROWTH;
    const lastSA = last.sa || (rows.slice().reverse().find(r => r.sa > 0) || {}).sa || 0;
    const allocAfter = (rows.slice().reverse().find(r => r.alloc > 0) || {alloc: 0});
    const premiumEnds = rows.some(r => r.premium === 0 && r.alloc === 0 && live(r)); // limited-pay plans
    const fillAfter = (plan, e, fromYear, e2) => {
      for (let y = last.year + 1; y <= termYears; y++) {
        const t = y - last.year, t1 = Math.min(t, Math.max(0, fromYear - last.year)), t2 = t - t1;
        const ef = Math.pow(e, t1) * Math.pow(e2, t2);
        plan[y] = {alloc: premiumEnds ? 0 : allocAfter.alloc, fixed: cl.fixed * Math.pow(gF, t) * ef, q: cl.q * Math.pow(gQ, t) * ef, sa: lastSA, src: 'after', bonus: bonusAt(y), loy: loyAt(y), supp: suppAt(y), riskIPA};
      }
    };
    fillAfter(plan, 1, termYears, 1);
    const targets = [], sus = q.sustain || {};
    for (const [k, r] of [['x', rates.x], ['y', rates.y]]) {
      const age = num(sus[k]); if (age === null) continue;
      const years = age - entryAge;
      if (years > last.year && years < termYears) targets.push({k, r, years});
    }
    let e = 1, anchorYear = last.year;
    if (targets.length && !tab) {
      const lapseYear = (ee, r) => { fillAfter(plan, ee, termYears, ee); return runPlan(plan, termYears, r, p).lapseYear || termYears + 1; };
      const es = targets.map(t => {
        let lo = 0.85, hi = 1.4;
        for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; (lapseYear(m, t.r) - 1 > t.years) ? lo = m : hi = m; }
        const eHi = hi; lo = 0.85; hi = 1.4;
        for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; (lapseYear(m, t.r) - 1 >= t.years) ? lo = m : hi = m; }
        return Math.sqrt(eHi * lo);
      });
      e = es.reduce((a, b) => a * b, 1) ** (1 / es.length);
      anchorYear = Math.max(...targets.map(t => t.years + 1));
    }
    /* main plan: the tuned pace continues (careful view). Other view: after the last age GE's figures pin down,
       charges go back to the printed pace. */
    fillAfter(plan, e, termYears, e);
    let planTrend = Object.assign({}, plan);
    fillAfter(planTrend, e, anchorYear, Math.min(1, e));

    /* With the GE tables: every year the quotation does not print comes from the tables, scaled by how the tables
       compare with the quotation's own charges at the nearest printed years (so the quotation always wins). */
    let table = null;
    if (tab) {
      const rf = [], rq = [];
      rows.forEach((r, i) => {
        const t = tab.years[r.year - 1]; if (!t) return;
        if (t.fixed > 0 && costs[i].fixed > 0) rf.push([r.year, costs[i].fixed / t.fixed]);
        if (t.q > 0 && costs[i].q > 0 && !costs[i].rough && !costs[i].qUnknown) rq.push([r.year, costs[i].q / t.q]);
      });
      const interp = (list, y) => {
        if (!list.length) return 1;
        if (y <= list[0][0]) return list[0][1];
        if (y >= list[list.length - 1][0]) return list[list.length - 1][1];
        for (let i = 1; i < list.length; i++) if (y <= list[i][0]) { const [y0, a] = list[i - 1], [y1, c] = list[i]; return a + (c - a) * (y - y0) / (y1 - y0); }
        return 1;
      };
      const allocAt = y => {
        if (y > last.year) return premiumEnds ? 0 : allocAfter.alloc;
        let a = null, c = null; for (const r of rows) { if (r.year < y) a = r; else if (r.year > y && !c) c = r; }
        return a && c ? Math.min(a.alloc, c.alloc) : (a || c).alloc;
      };
      for (let y = 1; y <= termYears; y++) {
        const t = tab.years[y - 1];
        if (plan[y] && plan[y].src === 'quote') { const ci = rows.findIndex(r => r.year === y); if (ci >= 0 && costs[ci].qUnknown) plan[y].q = t.q * interp(rq, y); continue; }
        plan[y] = {alloc: allocAt(y), fixed: t.fixed * interp(rf, y), q: t.q * interp(rq, y), sa: t.sa, src: y > last.year ? 'after' : 'between', bonus: bonusAt(y), loy: loyAt(y), supp: suppAt(y), riskIPA};
      }
      planTrend = plan;
      const dev = rf.concat(tab.prevailing ? rq.filter(([y]) => y > (+(q.policy || {}).premiumYears || 0) + 1) : rq).map(([, r]) => Math.abs(r - 1));
      table = {name: tab.name, maxDev: dev.length ? Math.max(...dev) : null, checked: dev.length, notes: tabNotes.slice(), unknown: tab.unknown,
        lastRatio: rf.length ? rf[rf.length - 1][1] : 1};
      if (table.maxDev !== null && table.maxDev > 0.1) table.notes.push('The quotation charges differ from the GE tables by up to ' + Math.round(table.maxDev * 100) + '% (a loading, a different occupation class or revised rates?). The tables are scaled to the quotation figures.');
    }

    const model = {ok: true, q, rates, entryAge, termYears, plan, planTrend, level, costs: fit, p, scales,
      growth: {fixed: gF, q: gQ, qFromRef: gQ === REF_Q_GROWTH && cl.q > 0, extra: e, total: null}, growthTuned: !!targets.length && !tab,
      anchorAge: entryAge + anchorYear, bonus: b, ipaBonus: (ib.loyalty || ib.booster) ? ib : null, twoAccounts: riskIPA, suppPcts: suppK, table, tableNotes: tab ? [] : tabNotes, lastDataYear: last.year, rows: chk.rows, warnings: chk.warnings, sustain: sus, premiumEnds};
    const mid = plan[Math.min(termYears, last.year + 5)];
    model.growth.total = last.year < termYears && mid ? Math.pow((mid.fixed + mid.q * lastSA * 0.9) / Math.max(1, cl.fixed + cl.q * lastSA * 0.9), 1 / Math.min(5, termYears - last.year)) : 1;
    model.accuracy = accuracy(model);
    return model;
  }

  function project(model, r, trend) {
    const out = runPlan(trend ? model.planTrend : model.plan, model.termYears, r, model.p);
    out.years.forEach(y => y.age = model.entryAge + y.year);
    const lastAge = out.lapseYear ? model.entryAge + out.lapseYear - 1 : model.entryAge + model.termYears;
    return {rate: r, years: out.years, lapseYear: out.lapseYear, sustainsToAge: lastAge, sustainsYears: out.lapseYear ? out.lapseYear - 1 : model.termYears,
      fullTerm: !out.lapseYear, endAge: model.entryAge + model.termYears,
      fundAt: age => { const y = out.years.find(v => v.age === age); return y ? y.fund : (out.lapseYear && age > lastAge ? 0 : null); }};
  }

  /* Lowest return that keeps the policy going to targetAge (default: end of coverage). */
  function minReturn(model, targetAge, trend) {
    const target = targetAge || model.entryAge + model.termYears;
    const ok = r => project(model, r, trend).sustainsToAge >= target;
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
          const e = Math.abs(line['app' + k] - ge) / ge; line['err' + k] = e;
          if (e > res.maxErr) { res.maxErr = e; res.worst = {year: r.year, scen: k}; }
        } else if (ge === 0 && line['app' + k] > 2000) { line['err' + k] = 1; res.maxErr = Math.max(res.maxErr, 1); res.worst = {year: r.year, scen: k}; }
      }
      res.rows.push(line);
    }
    res.lapse = {x: {ge: num(model.sustain.x), app: px.sustainsToAge, full: px.fullTerm}, y: {ge: num(model.sustain.y), app: py.sustainsToAge, full: py.fullTerm}};
    res.lapseMatch = ['x', 'y'].every(k => res.lapse[k].ge === null || Math.abs(res.lapse[k].ge - res.lapse[k].app) <= 1);
    res.grade = res.maxErr <= 0.03 && res.lapseMatch ? 'good' : res.maxErr <= 0.08 ? 'fair' : 'poor';
    return res;
  }

  const api = {yearStep, check, calibrate, project, minReturn, accuracy, REF_Q_GROWTH};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WIF = api;
})(typeof self !== 'undefined' ? self : this);
