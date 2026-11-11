/* What-If Fund Projector: yearly charges from GE's own rate tables (the private "GE ILP knowledge pack").
   This file holds only the logic. The tables themselves are internal GE agency material: they are loaded on the
   phone by the agent and never published with the app.

   Output per policy year y (ANB during the year = entry ANB + y - 1):
     fixed  = charges that do not depend on the fund (RM a year)
     q      = annual rate per RM of sum at risk, for "higher of sum assured or fund" plans
     sa     = the sum the amount at risk is measured from (basic sum assured; ASA is never charged) */
(function (root) {
  'use strict';
  const COL = (g, s) => ({MY: 0, MN: 1, FY: 2, FN: 3})[(g === 'F' ? 'F' : 'M') + (s === 'Y' ? 'Y' : 'N')];
  /* Waiver / payer riders: GE charges the rate on the value of the premiums still to be waived, not on one year's
     premium. An annuity at 6.3% over the remaining premium years reproduces SmartProtect You's printed IL PWE
     charges within 1% at every printed age (26-75). */
  const WAIVER_RATE = 0.063;
  const annuity = (n, i) => n <= 0 ? 0 : (1 - Math.pow(1 + i, -n)) / i;

  function rowAt(tbl, anb) {
    if (!tbl) return null;
    if (tbl[String(anb)]) return tbl[String(anb)];
    for (const k of Object.keys(tbl)) if (k.includes('-')) { const [a, b] = k.split('-').map(Number); if (anb >= a && anb <= b) return tbl[k]; }
    const ages = Object.keys(tbl).filter(k => !k.includes('-')).map(Number);
    if (!ages.length) return null;
    const mx = Math.max(...ages), mn = Math.min(...ages);
    return anb > mx ? tbl[String(mx)] : anb < mn ? tbl[String(mn)] : null;
  }
  const rateOf = (row, g, s) => !row ? null : row.length === 1 ? row[0] : row.length === 2 ? row[g === 'F' ? 1 : 0] : row[COL(g, s)];

  function findMedical(kb, code) {
    const mr = kb.medical_riders; if (!mr) return null;
    for (const [key, r] of Object.entries(mr.riders || {})) if ((r.codes || []).includes(code)) return Object.assign({key}, r);
    return null;
  }

  /* pol: {code, entryAge (ANB), gender 'M'|'F', smoker 'Y'|'N', occ '1'..'4', bsa, premium (annual), premiumYears,
           riders: [{code, sa, years}]}
     returns {ok, product, years: [{fixed, q, sa}], parts, unknown: [codes], notes: []} */
  function build(kb, pol, termYears) {
    const notes = [], unknown = [];
    const prod = kb && kb.products && kb.products[pol.code];
    if (!prod) return {ok: false, reason: 'product', notes: ['Plan code ' + (pol.code || '?') + ' is not in the GE rate tables.']};
    const coi = prod.coi || {}, table = kb.coi_tables[coi.table];
    if (!table) return {ok: false, reason: 'table', notes: ['No insurance-rate table for ' + prod.name + '.']};
    const g = pol.gender === 'F' ? 'F' : 'M', s = pol.smoker === 'Y' ? 'Y' : 'N', occ = String(pol.occ || '1');
    /* wealth plans: prevailing sum assured = X% of premiums paid so far; amount at risk measured against the IPA */
    const ps = prod.prevailing_sum_assured;
    const prevailing = !!ps, riskIPA = (prod.accounts || []).includes('IPA');
    const psaPct = ps ? (pol.entryAge <= 55 ? ps.x_pct_entry_le55 : ps.x_pct_entry_ge56) / 100 : 0;
    const premYearsPaid = y => Math.min(y, +pol.premiumYears || termYears);
    const bsa = +pol.bsa || 0;
    const saAt = y => prevailing ? psaPct * (+pol.premium || 0) * premYearsPaid(y) : bsa;
    let disc = 0;
    for (const b of prod.lsad || []) if (bsa >= b.sa_from && (b.sa_to === null || bsa <= b.sa_to)) disc = b.discount_pct / 100;
    const netSA = coi.basis === 'NET_SA';
    if (coi.basis && !['BSA', 'NET_SA'].includes(coi.basis)) notes.push('Insurance basis ' + coi.basis + ' is not modelled; using the quotation where printed.');
    const fee = (prod.policy_fee_monthly !== undefined ? prod.policy_fee_monthly : 6) * 12;
    const premYears = +pol.premiumYears || termYears;

    /* riders */
    const riders = (pol.riders || []).map(r => {
      const code = String(r.code || '').toUpperCase().trim();
      const med = findMedical(kb, code);
      if (med) return {code, kind: 'medical', med, years: +r.years || termYears};
      const d = kb.other_riders && kb.other_riders.riders[code];
      if (d) return {code, kind: 'other', d, sa: +r.sa || 0, years: +r.years || termYears};
      unknown.push(code); return null;
    }).filter(Boolean);

    const years = [], parts = [];
    for (let y = 1; y <= termYears; y++) {
      const anb = pol.entryAge + y - 1;
      const rBasic = rateOf(rowAt(table, anb), g, s) || 0;
      const waived = y <= (coi.waived_policy_years || 0);
      let fixed = fee, q = 0;
      const basic = waived ? 0 : rBasic / 1000 * (1 - disc);
      if (netSA) q += basic; else fixed += basic * saAt(y);
      const part = {basic: netSA ? basic : basic * saAt(y), riders: {}};
      for (const r of riders) {
        if (y > r.years) continue;
        let c = 0;
        if (r.kind === 'medical') {
          const mr = kb.medical_riders, i = mr._rules.bands.findIndex(([a, b]) => anb >= a && anb <= b);
          let tname = r.med.table;
          if (r.med.table_from_60 && anb >= 60) tname = r.med.table_from_60;
          let mult = 1;
          if (occ === '3' || occ === '4') { if (r.med.occ_tables) tname = r.med.occ_tables[occ]; else mult = mr._rules.occupation_multiplier[occ] || 1; }
          const t = mr.tables[tname + '_' + g];
          c = i >= 0 && t ? t[i] * mult : 0;
          fixed += c;
        } else {
          const d = r.d, o = kb.other_riders, basis = d.basis;
          const stop = d.charge_to_anb; if (stop && anb >= stop) continue;
          if (basis === 'NONE') continue;
          if (['RIDER_SA', 'RIDER_NET_SA', 'PREMIUM'].includes(basis)) {
            const rate = rateOf(rowAt(o.tables[d.table], anb), g, s);
            if (rate === null) continue;
            const sa = basis === 'PREMIUM' ? (r.sa || pol.premium || 0) : r.sa;
            if (basis === 'RIDER_NET_SA') { q += bsa ? rate / 1000 * sa / bsa : 0; c = rate / 1000 * sa; }
            else if (basis === 'PREMIUM') { c = rate / 1000 * sa * annuity(Math.min(r.years, premYears) - y + 1, WAIVER_RATE); fixed += c; }
            else { c = rate / 1000 * sa; fixed += c; }
          } else if (basis === 'FLAT_OCC') {
            let dsc = 0;
            for (const [k, v] of Object.entries(d.discount_by_basic_py || {})) { const [a, b] = k.split('-').map(Number); if (y >= a && y <= b) dsc = v / 100; }
            c = d.rates[(+occ || 1) - 1] * r.sa / 1000 * (1 - dsc); fixed += c;
          } else if (basis === 'DAILY_CASH') {
            const row = rowAt(o.tables.U803, anb);
            if (row) { c = row[({1: 0, 2: 0, 3: 2, 4: 4})[occ] + (g === 'M' ? 0 : 1)] * r.sa; fixed += c; }
          } else { if (!notes.some(n => n.includes(r.code))) notes.push(r.code + ' (' + basis + ') is not modelled; using the quotation where printed.'); }
        }
        part.riders[r.code] = c;
      }
      years.push({fixed, q, sa: saAt(y)}); parts.push(part);
    }
    if (unknown.length) notes.push('Not in the GE rate tables: ' + unknown.join(', ') + '. Their charges come from the quotation only.');
    return {ok: true, product: prod, name: prod.name, years, parts, unknown, notes, netSA, prevailing, riskIPA, fundFmc: null};
  }

  const api = {build, rowAt, rateOf, WAIVER_RATE};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WIFKB = api;
})(typeof self !== 'undefined' ? self : this);
