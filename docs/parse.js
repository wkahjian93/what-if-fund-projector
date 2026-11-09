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
    /* Insurance charges are printed either once per row (death benefit = sum assured + fund: same in X and Y)
       or once per scenario (death benefit = higher of sum assured or fund: Basic X, Basic Y, Rider X, Rider Y). */
    const firstData = page.findIndex(l => { const n = numTokens(l); return n && n.length >= 15; });
    const header = page.slice(0, Math.max(0, firstData)).join(' ');
    const scenWords = (header.replace(/[^\n]*examples of investment returns[^\n]*/i, '').match(/Scenario/g) || []).length;
    for (const line of page) {
      const n = numTokens(line);
      if (!n || n.length < 15) continue;
      /* GE layout: year, age, premium, allocated, alloc %, insurance charge column(s)..., other, FMC X, FMC Y,
         sum assured, value X, value Y, death benefit X, death benefit Y, commission, commission % */
      const e = n.length, ins = n.slice(5, e - 10), other = n[e - 10];
      const perScen = ins.length >= 2 && ins.length % 2 === 0 && scenWords >= 9;
      let bX, bY, cX, cY;
      if (perScen) {
        const xs = ins.filter((v, i) => i % 2 === 0), ys = ins.filter((v, i) => i % 2 === 1);
        bX = xs[0]; bY = ys[0]; cX = xs.reduce((a, b) => a + b, 0) + other; cY = ys.reduce((a, b) => a + b, 0) + other;
      } else {
        bX = bY = ins[0]; cX = cY = ins.reduce((a, b) => a + b, 0) + other;
      }
      rows.push({year: n[0], age: n[1], premium: n[2], alloc: n[3], basicX: bX, basicY: bY, chargesX: cX, chargesY: cY,
        fmcX: n[e - 9], fmcY: n[e - 8], sa: n[e - 7], tivX: n[e - 6], tivY: n[e - 5]});
    }
    if (rows.length < 3) return {ok: false, reason: 'no_rows'};
    const pick = re => { const m = front.match(re); return m ? m[1].trim() : null; };
    const pLine = front.split('\n').find(l => /Product Name/.test(l)) || '';
    const product = (pLine.replace(/.*?Product Name/, '').split('|').map(s => s.replace(/[:=]/g, ' ').trim()).find(Boolean) || '')
      .replace(/^\d{3,5}\s+/, '').replace(/\s+/g, ' ').replace(/\s([A-Z][A-Z0-9]*(?:-\d+)?)$/, ' ($1)').trim() || null;
    /* bonus credited into the fund, e.g. "Booster reward of RM25,000.00 will be credited into your total investment value
       on the policy anniversary of age 65 years next birthday, and every 10 years thereafter" */
    const notesText = all.slice(0, Math.min(all.length, tIdx + 3)).join(' ').replace(/[\s|]+/g, ' ');
    const bm = notesText.match(/(Booster reward|Loyalty bonus|[A-Z][a-z]+ bonus|[A-Z][a-z]+ reward)\s+of\s+RM\s?([\d,]+(?:\.\d+)?)\s+will be credited[^.]*?age\s+(\d+)\s+years next birthday(?:,?\s+and every\s+(\d+)\s+years thereafter)?/i);
    const bonus = bm ? {name: bm[1].replace(/\s+/g, ' '), amount: toNum(bm[2]), age: +bm[3], every: bm[4] ? +bm[4] : null} : null;
    if (/booster|loyalty bonus|bonus will be credited|reward will be credited/i.test(notesText) && !bonus) notes.push('The quotation mentions a booster or bonus that the app could not read. Type it in below if it adds to the fund.');
    const sus = {};
    const susRe = /(\d+)\s+years up to your age\s+(\d+)\s+years next birthday under ([^;\n.]+)/g;
    let m; while ((m = susRe.exec(front))) {
      const what = m[3];
      if (/best estimate/i.test(what)) sus.best = +m[2]; else if (/Y%/.test(what)) sus.y = +m[2]; else if (/X%/.test(what)) sus.x = +m[2];
    }
    if (sus.x === undefined && sus.y === undefined) notes.push('The "policy may sustain" lines were not found, so run-out ages after the printed years are estimated without them.');
    /* plan details for GE's rate tables: plan code, life assured, basic sum assured, riders */
    const lines2 = all.slice(0, tIdx).join('\n').split('\n');
    const code = (pLine.match(/(?:Product Name)[^\d]*?(\d{4})\s/) || [])[1] || null;
    const gender = (front.match(/Gender[\s|=:]*(Male|Female)/) || [])[1];
    const smoker = (front.match(/Smoker[\s|=:]*(Yes|No)/) || [])[1];
    const occ = (front.match(/Occupation Class[\s|=:]*(\d)/) || [])[1];
    const ipLine = lines2.find(l => /^Insurance Premium\s*\|/.test(l));
    const ipNums = ipLine ? numTokens(ipLine.replace(/^Insurance Premium\s*\|/, '')) : null;
    const riders = [], seen = {};
    for (const l of lines2) {
      const m = l.match(/^(U\d{2,4})\s+([^|]+?)\s*\|\s*(\d+)\s*\|[\s|=]*([\d,]+|Not applicable|Tidak berkenaan)/);
      if (!m || seen[m[1]]) continue; seen[m[1]] = 1;
      riders.push({code: m[1], name: m[2].replace(/=/g, ' ').trim(), years: +m[3], sa: /\d/.test(m[4]) ? toNum(m[4]) : null});
    }
    const prem = pick(/Total\^?[^\n]*?RM[\s|=]*([\d,]+\.\d\d)/);
    const term = pick(/Premium Payment Term[\s|=:]*(\d+)/);
    const ageNB = pick(/Age Next Birthday[\s|=:]*(\d+)/);
    const mode = pick(/Premium Mode[\s|=:]*(\w+)/);
    const funds = (all.slice(0, tIdx).join('\n').match(/\|\s*([A-Z]\d+\s[^|\n]*Fund)/) || [])[1];
    const data = {
      source: 'pdf', product: product || 'Investment-linked plan', fund: funds ? funds.trim() : null,
      entryAge: ageNB ? +ageNB : rows[0].age - rows[0].year, premium: prem ? toNum(prem) : rows[0].premium, mode: mode || null,
      termYears: Math.max(term ? +term : 0, rows[rows.length - 1].year),
      rates: {x: rx ? +rx[1] / 100 : null, y: ry ? +ry[1] / 100 : null}, sustain: sus, bonus, rows,
      policy: {code, gender: gender ? gender[0] : null, smoker: smoker ? smoker[0] : null, occ: occ || null,
        bsa: ipNums && ipNums.length >= 2 ? ipNums[1] : null, premium: prem ? toNum(prem) : null, premiumYears: term ? +term : null, riders}
    };
    if (!rx || !ry) notes.push('The two illustrated returns were not found. Please type them in.');
    return {ok: true, data, notes, page: tIdx + 1};
  }

  /* ---------- AI photo reading ---------- */
  const aiPrompt = () => `You are reading photos of a Malaysian investment-linked life insurance quotation (benefit illustration), usually Great Eastern.
Find the main yearly table ("Table 1") that shows, for each policy year: premium paid, allocated premium, insurance charges (basic plan and unit-deducting riders; some plans print them separately for Scenario X and Scenario Y), other charges, fund management charge for Scenario X and Y, sum assured, and the non-guaranteed total investment value for Scenario X and Scenario Y.
Also look for: the product name, the life assured's age next birthday, the annualised premium, premium payment term, the two illustrated returns (e.g. 2% Scenario X, 5% Scenario Y), the lines "the policy may sustain for N years up to your age A ... under projected investment returns of X% / Y% / best estimate", and any booster / loyalty bonus credited into the investment value (amount, the age next birthday it is first credited, and "every N years thereafter" if stated).
Also read the plan details on the first pages: the 4-digit product code before the product name, gender, smoker, occupation class, the basic plan's sum assured, and each unit-deducting rider line (code like U807, name, coverage years, sum assured as printed).
Return ONLY JSON:
{"product": string|null, "product_code": string|null, "gender": "Male"|"Female"|null, "smoker": "Yes"|"No"|null, "occupation_class": number|null, "basic_sum_assured": number|null,
 "riders": [{"code": string, "name": string, "years": number|null, "sum_assured": number|null}], "entry_age_next_birthday": number|null, "annual_premium": number|null, "premium_term_years": number|null,
 "rate_x_percent": number|null, "rate_y_percent": number|null,
 "sustain_age_x": number|null, "sustain_age_y": number|null, "sustain_age_best_estimate": number|null,
 "bonus": {"name": string, "amount": number, "first_age_next_birthday": number, "every_years": number|null} | null,
 "rows": [{"year": number, "age": number|null, "premium_paid": number|null, "allocated_premium": number|null,
   "insurance_charges_x": number|null, "insurance_charges_y": number|null, "basic_charge_x": number|null, "basic_charge_y": number|null, "other_charges": number|null, "fmc_x": number|null, "fmc_y": number|null,
   "sum_assured": number|null, "value_x": number|null, "value_y": number|null}],
 "unclear": [string]}
Rules: copy numbers exactly as printed, without commas. insurance_charges_x / _y = basic plan insurance charge + all unit-deducting rider charges for that scenario (not the fund management charge); if the table prints one set of insurance charges for both scenarios, put the same numbers in _x and _y. basic_charge_x / _y = the basic plan part only. Include every printed policy-year row, including rows of zeros. If a number is blurred, cut off or you are not sure, put null and say which in "unclear". Never guess or calculate a missing number. Do not return the client's name or IC number.`;

  function fromAI(j) {
    const n = v => (v === null || v === undefined || v === '' || !isFinite(+v)) ? null : +v;
    const rows = (j.rows || []).map(r => {
      const ix = n(r.insurance_charges_x !== undefined ? r.insurance_charges_x : r.insurance_charges_total),
        iy = n(r.insurance_charges_y !== undefined ? r.insurance_charges_y : r.insurance_charges_total), oth = n(r.other_charges);
      return {year: n(r.year), age: n(r.age), premium: n(r.premium_paid), alloc: n(r.allocated_premium),
        chargesX: ix === null || oth === null ? null : ix + oth, chargesY: iy === null || oth === null ? null : iy + oth,
        basicX: n(r.basic_charge_x), basicY: n(r.basic_charge_y), fmcX: n(r.fmc_x), fmcY: n(r.fmc_y), sa: n(r.sum_assured),
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
      bonus: j.bonus && n(j.bonus.amount) && n(j.bonus.first_age_next_birthday) ? {name: String(j.bonus.name || 'Bonus'), amount: n(j.bonus.amount), age: n(j.bonus.first_age_next_birthday), every: n(j.bonus.every_years)} : null,
      rows, unclear: Array.isArray(j.unclear) ? j.unclear.map(String) : [],
      policy: {code: j.product_code ? String(j.product_code).replace(/D/g, '').slice(0, 4) || null : null, gender: j.gender ? String(j.gender)[0].toUpperCase() : null,
        smoker: j.smoker ? String(j.smoker)[0].toUpperCase() : null, occ: n(j.occupation_class) ? String(n(j.occupation_class)) : null,
        bsa: n(j.basic_sum_assured), premium: n(j.annual_premium), premiumYears: n(j.premium_term_years),
        riders: Array.isArray(j.riders) ? j.riders.filter(r => r && r.code).map(r => ({code: String(r.code).toUpperCase().trim(), name: String(r.name || ''), years: n(r.years), sa: n(r.sum_assured)})) : []}
    };
  }

  const api = {fromPdfText, linesOf, aiPrompt, fromAI};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WIFParse = api;
})(typeof self !== 'undefined' ? self : this);
