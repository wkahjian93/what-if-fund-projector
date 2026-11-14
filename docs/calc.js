/* What-If Fund Projector: TVM and loan maths (works in the browser and in Node).
   Sign convention, as on a financial calculator: money you pay out is negative, money you receive is positive.
   Every TVM problem satisfies  PV*(1+i)^n + PMT*(1+i*t)*((1+i)^n - 1)/i + FV = 0
   i = rate per period, n = number of periods, t = 1 when payments are at the beginning of each period. */
(function (root) {
  'use strict';

  const growth = (i, n) => Math.pow(1 + i, n);
  const annF = (i, n) => i === 0 ? n : (growth(i, n) - 1) / i;
  const tvmF = (pv, pmt, fv, i, n, t) => i === 0 ? pv + pmt * n + fv : pv * growth(i, n) + pmt * (1 + i * t) * annF(i, n) + fv;

  /* solve the one missing value. args: {pv, pmt, fv, rate (% a year), n (periods), ppy (periods a year), begin} */
  function solve(which, a) {
    const t = a.begin ? 1 : 0, ppy = a.ppy || 1;
    const i = a.rate / 100 / ppy, n = a.n, pv = a.pv || 0, pmt = a.pmt || 0, fv = a.fv || 0;
    if (which === 'fv') return -(i === 0 ? pv + pmt * n : pv * growth(i, n) + pmt * (1 + i * t) * annF(i, n));
    if (which === 'pv') return i === 0 ? -(fv + pmt * n) : -(fv + pmt * (1 + i * t) * annF(i, n)) / growth(i, n);
    if (which === 'pmt') { if (!n) return NaN; return i === 0 ? -(pv + fv) / n : -(fv + pv * growth(i, n)) / ((1 + i * t) * annF(i, n)); }
    if (which === 'n') {
      if (i === 0) return pmt ? -(pv + fv) / pmt : NaN;
      const k = pmt * (1 + i * t) / i, num = k - fv, den = k + pv;
      if (num / den <= 0) return NaN;
      return Math.log(num / den) / Math.log(1 + i);
    }
    if (which === 'rate') {
      /* rate per period, by bisection then Newton polishing; NaN when no rate fits the cash flows */
      const f = x => tvmF(pv, pmt, fv, x, n, t);
      const grid = [];
      for (let x = -0.99; x <= 3; x += 0.0025) grid.push(x);
      let lo = null, hi = null;
      for (let k = 1; k < grid.length; k++) { if (Math.sign(f(grid[k - 1])) !== Math.sign(f(grid[k]))) { lo = grid[k - 1]; hi = grid[k]; if (grid[k] > -0.5) break; } }
      if (lo === null) return NaN;
      for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; (Math.sign(f(m)) === Math.sign(f(lo))) ? lo = m : hi = m; }
      return (lo + hi) / 2 * ppy * 100;
    }
    return NaN;
  }

  /* reducing-balance loan (home loans): monthly instalment, totals, and a year-by-year schedule; extra = extra paid each month */
  function amortised(principal, ratePct, months, extra) {
    const i = ratePct / 100 / 12;
    const pay = i === 0 ? principal / months : principal * i / (1 - Math.pow(1 + i, -months));
    let bal = principal, totInt = 0, totPaid = 0, m = 0;
    const years = [];
    let yInt = 0, yPrin = 0;
    while (bal > 0.005 && m < months + 1200) {
      m++;
      const int = bal * i;
      let p = Math.min(pay + (extra || 0), bal + int);
      const prin = p - int;
      bal -= prin; totInt += int; totPaid += p; yInt += int; yPrin += prin;
      if (m % 12 === 0 || bal <= 0.005) { years.push({year: Math.ceil(m / 12), interest: yInt, principal: yPrin, balance: Math.max(bal, 0)}); yInt = 0; yPrin = 0; }
    }
    return {monthly: pay, months: m, totalPaid: totPaid, totalInterest: totInt, annual: pay * 12, constant: pay * 12 / principal, years};
  }

  /* Malaysian hire purchase (car loans): flat rate on the original amount for the whole term */
  function hirePurchase(principal, flatPct, months) {
    const interest = principal * flatPct / 100 * months / 12;
    const monthly = (principal + interest) / months;
    const eff = months ? solve('rate', {pv: principal, pmt: -monthly, fv: 0, n: months, ppy: 12}) : NaN; // true yearly rate
    return {monthly, totalInterest: interest, totalPaid: principal + interest, effectiveRate: eff};
  }

  const api = {solve, amortised, hirePurchase};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WIFCalc = api;
})(typeof self !== 'undefined' ? self : this);
