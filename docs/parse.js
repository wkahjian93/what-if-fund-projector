/* What-If Fund Projector: reads the quotation table straight from a GE MPOS PDF (no AI, nothing leaves the phone),
   and turns an AI photo reading into the same shape. Works in the browser and in Node. */
(function (root) {
  'use strict';

  /* MPOS PDFs embed fonts without a character map, so pdf.js gives glyph numbers.
     For these fonts the glyph number is the character code minus 29. */
  const shift = (s, k) => k ? Array.from(s, ch => { const c = ch.charCodeAt(0); return c >= 3 && c <= 97 ? String.fromCharCode(c + k) : ch; }).join('') : s;

  /* pages: [[{x, y, str}]] -> [[line text]] (top to bottom), choosing the decoding that makes sense */
  function linesOf(pages) {
    const score = k => pages.slice(0, 8).reduce((n, items) => n + (items.map(i => shift(i.str, k)).join(' ').match(/Scenario|Great Eastern|Policy|Premium/g) || []).length, 0);
    const k = score(29) > score(0) ? 29 : 0;
    return pages.map(items => {
      const rows = {};
      items.forEach(it => { if (!it.str) return; const y = Math.round(it.y); (rows[y] = rows[y] || []).push([it.x, shift(it.str, k)]); });
      return Object.keys(rows).map(Number).sort((a, b) => b - a).map(y => rows[y].sort((a, b) => a[0] - b[0]).map(r => r[1]).join(' | '));
    });
  }

  const toNum = s => +String(s).replace(/,/g, '');
  const numTokens = line => {
    const parts = line.split('|').map(s => s.replace(/=/g, ' ').trim()).filter(Boolean);
    if (!parts.length || !parts.every(p => /^-?[\d,]+(\.\d+)?$/.test(p))) return null;
    return parts.map(toNum);
  };

  /* Returns {ok, data, notes[]} where data is the engine's quotation shape. */
  function fromPdfText(pages) {
    const L = linesOf(pages), notes = [];
    const all = L.map(l => l.join('\n'));
    const tIdx = all.findIndex(t => /Scenario X/.test(t) && /Scenario Y/.test(t) && /Investment Value/i.test(t));
    if (tIdx < 0) return {ok: false, reason: 'no_table'};
    const page = L[tIdx], text = all[tIdx], front = all.slice(0, tIdx + 1).join('\n');
    const rx = text.match(/(\d+(?:\.\d+)?)%\W{0,6}Scenario X/), ry = text.match(/(\d+(?:\.\d+)?)%\W{0,6}Scenario Y/);
    const rows = [];
    for (const line of page) {
      const n = numTokens(line);
      if (!n || n.length < 15) continue;
      /* GE layout: year, age, premium, allocated, alloc %, insurance charge column(s)..., other, FMC X, FMC Y,
         sum assured, value X, value Y, death benefit X, death benefit Y, commission, commission % */
      const e = n.length, ins = n.slice(5, e - 10);
      rows.push({year: n[0], age: n[1], premium: n[2], alloc: n[3], charges: ins.reduce((a, b) => a + b, 0) + n[e - 10],
        fmcX: n[e - 9], fmcY: n[e - 8], sa: n[e - 7], tivX: n[e - 6], tivY: n[e - 5]});
    }
    if (rows.length < 3) return {ok: false, reason: 'no_rows'};
    const pick = re => { const m = front.match(re); return m ? m[1].trim() : null; };
    const pLine = front.split('\n').find(l => /Product Name/.test(l)) || '';
    const product = (pLine.replace(/.*?Product Name/, '').split('|').map(s => s.replace(/[:=]/g, ' ').trim()).find(Boolean) || '')
      .replace(/^\d{3,5}\s+/, '').replace(/\s+(\S+-\d+)$/, ' ($1)').trim() || null;
    const sus = {};
    const susRe = /(\d+)\s+years up to your age\s+(\d+)\s+years next birthday under ([^;\n.]+)/g;
    let m; while ((m = susRe.exec(front))) {
      const what = m[3];
      if (/best estimate/i.test(what)) sus.best = +m[2]; else if (/Y%/.test(what)) sus.y = +m[2]; else if (/X%/.test(what)) sus.x = +m[2];
    }
    if (sus.x === undefined && sus.y === undefined) notes.push('The "policy may sustain" lines were not found, so run-out ages after the printed years are estimated without them.');
    const prem = pick(/Total\^?[^\n]*?RM[\s|=]*([\d,]+\.\d\d)/);
    const term = pick(/Premium Payment Term[\s|=:]*(\d+)/);
    const ageNB = pick(/Age Next Birthday[\s|=:]*(\d+)/);
    const mode = pick(/Premium Mode[\s|=:]*(\w+)/);
    const funds = (all.slice(0, tIdx).join('\n').match(/\|\s*([A-Z]\d+\s[^|\n]*Fund)/) || [])[1];
    const data = {
      source: 'pdf', product: product || 'Investment-linked plan', fund: funds ? funds.trim() : null,
      entryAge: ageNB ? +ageNB : rows[0].age - rows[0].year, premium: prem ? toNum(prem) : rows[0].premium, mode: mode || null,
      termYears: Math.max(term ? +term : 0, rows[rows.length - 1].year),
      rates: {x: rx ? +rx[1] / 100 : null, y: ry ? +ry[1] / 100 : null}, sustain: sus, rows
    };
    if (!rx || !ry) notes.push('The two illustrated returns were not found. Please type them in.');
    return {ok: true, data, notes, page: tIdx + 1};
  }

  /* ---------- AI photo reading ---------- */
  const aiPrompt = () => `You are reading photos of a Malaysian investment-linked life insurance quotation (benefit illustration), usually Great Eastern.
Find the main yearly table ("Table 1") that shows, for each policy year: premium paid, allocated premium, insurance charges (basic plan and unit-deducting riders), other charges, fund management charge for Scenario X and Y, sum assured, and the non-guaranteed total investment value for Scenario X and Scenario Y.
Also look for: the product name, the life assured's age next birthday, the annualised premium, premium payment term, the two illustrated returns (e.g. 2% Scenario X, 5% Scenario Y), and the lines "the policy may sustain for N years up to your age A ... under projected investment returns of X% / Y% / best estimate".
Return ONLY JSON:
{"product": string|null, "entry_age_next_birthday": number|null, "annual_premium": number|null, "premium_term_years": number|null,
 "rate_x_percent": number|null, "rate_y_percent": number|null,
 "sustain_age_x": number|null, "sustain_age_y": number|null, "sustain_age_best_estimate": number|null,
 "rows": [{"year": number, "age": number|null, "premium_paid": number|null, "allocated_premium": number|null,
   "insurance_charges_total": number|null, "other_charges": number|null, "fmc_x": number|null, "fmc_y": number|null,
   "sum_assured": number|null, "value_x": number|null, "value_y": number|null}],
 "unclear": [string]}
Rules: copy numbers exactly as printed, without commas. insurance_charges_total = basic plan insurance charge + all unit-deducting rider charges in that row (not the fund management charge). Include every printed policy-year row, including rows of zeros. If a number is blurred, cut off or you are not sure, put null and say which in "unclear". Never guess or calculate a missing number. Do not return the client's name or IC number.`;

  function fromAI(j) {
    const n = v => (v === null || v === undefined || v === '' || !isFinite(+v)) ? null : +v;
    const rows = (j.rows || []).map(r => {
      const ins = n(r.insurance_charges_total), oth = n(r.other_charges);
      return {year: n(r.year), age: n(r.age), premium: n(r.premium_paid), alloc: n(r.allocated_premium),
        charges: ins === null || oth === null ? null : ins + oth, fmcX: n(r.fmc_x), fmcY: n(r.fmc_y), sa: n(r.sum_assured),
        tivX: n(r.value_x), tivY: n(r.value_y)};
    }).filter(r => r.year !== null).sort((a, b) => a.year - b.year);
    const rx = n(j.rate_x_percent), ry = n(j.rate_y_percent);
    const entry = n(j.entry_age_next_birthday);
    return {
      source: 'photo', product: j.product || 'Investment-linked plan',
      entryAge: entry !== null ? entry : (rows.find(r => r.age !== null) ? rows.find(r => r.age !== null).age - rows.find(r => r.age !== null).year : null),
      premium: n(j.annual_premium), termYears: Math.max(n(j.premium_term_years) || 0, rows.length ? rows[rows.length - 1].year : 0),
      rates: {x: rx === null ? null : rx / 100, y: ry === null ? null : ry / 100},
      sustain: {x: n(j.sustain_age_x), y: n(j.sustain_age_y), best: n(j.sustain_age_best_estimate)},
      rows, unclear: Array.isArray(j.unclear) ? j.unclear.map(String) : []
    };
  }

  const api = {fromPdfText, linesOf, aiPrompt, fromAI};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WIFParse = api;
})(typeof self !== 'undefined' ? self : this);
