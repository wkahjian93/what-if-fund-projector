/* What-If Fund Projector: screens. */
(function () {
  'use strict';
  const CFG = window.WIF_CONFIG || {};
  const $ = (s, el) => (el || document).querySelector(s), $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const rm = v => 'RM' + Math.round(v).toLocaleString('en-MY');
  const pct = v => (Math.round(v * 10000) / 100).toFixed(v * 100 % 1 ? 2 : 0).replace(/\.?0+$/, '') + '%';
  const pct1 = v => (v * 100).toFixed(1) + '%';
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200); }
  function sheet(html, onMount) {
    const s = $('#sheet'); s.innerHTML = `<div class="sheet-in" role="dialog" aria-modal="true">${html}</div>`; s.hidden = false;
    s.onclick = e => { if (e.target === s && !s.dataset.lock) closeSheet(); };
    onMount && onMount(s); return s;
  }
  function closeSheet() { const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; delete s.dataset.lock; }
  const confirmBox = (title, body, ok) => new Promise(done => sheet(`<h3>${esc(title)}</h3><p>${esc(body)}</p><div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>${esc(ok)}</button></div>`,
    s => { $('[data-x]', s).onclick = () => { closeSheet(); done(false); }; $('[data-ok]', s).onclick = () => { closeSheet(); done(true); }; }));

  /* ---------- saved quotations (figures only, on this phone) ---------- */
  let quotes = load('wif.quotes', []);
  const saveQuotes = () => save('wif.quotes', quotes);
  const all = () => quotes.concat(window.WIF_SAMPLES || []);
  const byId = id => all().find(q => q.id === id);
  let rate = load('wif.rate', 0.08);
  /* GE rate tables: internal agency material, loaded by the agent onto this phone only (never part of the app) */
  let KB = null; try { KB = JSON.parse(localStorage.getItem('wif.kb') || 'null'); } catch (e) { KB = null; }
  const kbMeta = () => load('wif.kbMeta', null);
  const kbOk = k => k && k.coi_tables && k.products && k.medical_riders && k.other_riders;
  if (!kbOk(KB)) KB = null;

  const app = $('#app');
  const bar = (title, sub, back) => `<header class="bar">${back ? '<button class="ib" id="back" aria-label="Back"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button>' : ''}
    <div class="brand"><b>${esc(title)}</b><span>${esc(sub)}</span></div></header>`;
  const ICON = {
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v5h16v-5"/></svg>',
    del: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>'
  };

  /* ---------- home ---------- */
  function home() {
    location.hash = ''; app.oninput = null;
    app.innerHTML = bar('REDEFINE Calculator', 'ILP WHAT-IF · TVM · LOANS') + `<main class="wrap">
      <section class="card hero"><h2>Beyond 2% and 5%</h2>
        <div class="big">What if the fund earns 8%?</div>
        <p>Snap the quotation pages (plan, riders, yearly table) or upload the MPOS PDF. See the fund value and how long the policy lasts at any return.</p>
        <div class="big2"><button class="btn primary" id="cam">${ICON.cam}Take photo</button><button class="btn" id="up">${ICON.up}Upload PDF or photos</button></div>
      </section>
      <section class="card"><h2>Calculators</h2>
        <div class="row"><button class="btn" id="goTvm">TVM calculator</button><button class="btn" id="goLoan">Loan calculator</button></div>
        <p class="muted" style="margin-top:8px">Time value of money (cost of delay, savings goals, returns), home loans and Malaysian car hire purchase.</p>
      </section>
      <section><h2 class="muted" style="margin:6px 4px 8px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:12px">Quotations on this phone</h2>
        ${all().map(q => `<div class="item"><button class="t" data-open="${esc(q.id)}" style="text-align:left"><b>${esc(q.label)}</b>
          <span>${esc(q.data.product)} · ${q.data.premium ? rm(q.data.premium) + ' a year · ' : ''}${esc(q.saved)}</span></button>
          ${q.sample ? '<span class="pill ok">Sample</span>' : `<button class="del" data-del="${esc(q.id)}" aria-label="Delete">${ICON.del}</button>`}</div>`).join('')}
      </section>
      <section class="card" style="margin-top:6px"><h2>GE rate tables</h2>
        ${KB ? `<p style="font-size:14px"><span class="pill ok">Ready</span> GE's own rates for ${Object.keys(KB.products).length} plans${kbMeta() && kbMeta().added ? ', updated ' + esc(kbMeta().added) : ''}. Years the quotation does not print use them.</p>`
          : session() ? `<p style="font-size:14px" id="kbMsg">${esc(kbStatusText())}</p>`
          : `<p style="font-size:14px">Sign in with the team code to get GE's own rates. Without them, results after the last printed age are estimated.</p>
             <button class="btn sm" id="kbSign" style="margin-top:10px">Sign in</button>`}
        <button class="btn sm ghost" id="kbUp" style="margin-top:6px;padding-left:0">Owner: upload new tables to the team server</button>
      </section>
      <p class="disc">The PDF is read on this phone. Photos are read by AI through the REDEFINE team server (sign in with the team code). Client names and IC numbers are not needed or kept.</p>
    </main>`;
    $('#cam').onclick = () => $('#fCam').click();
    $('#goTvm').onclick = tvmScreen; $('#goLoan').onclick = () => loanScreen();
    $('#kbUp').onclick = () => $('#fKb').click();
    if ($('#kbSign')) $('#kbSign').onclick = async () => { if (await signIn()) { kbState = null; home(); } };
    if (!KB && session() && kbState === null) syncKB().then(() => { if (!location.hash) home(); });
    $('#up').onclick = () => $('#fUp').click();
    $$('[data-open]').forEach(b => b.onclick = () => openQuote(b.dataset.open));
    $$('[data-del]').forEach(b => b.onclick = async () => {
      const q = byId(b.dataset.del);
      if (!(await confirmBox('Delete this quotation?', q.label + ' will be removed from this phone. This cannot be undone.', 'Delete'))) return;
      quotes = quotes.filter(x => x.id !== q.id); saveQuotes(); home(); toast('Deleted');
    });
  }
  $('#fKb').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    const text = await f.text();
    let k; try { k = JSON.parse(text); } catch (err) { return fail('That file is not a GE rate-table file (.json).'); }
    if (!kbOk(k)) return fail('That file does not contain the GE rate tables (insurance rates, plans and riders).');
    const owner = await new Promise(done => {
      const el = sheet(`<h3>Upload to the team server?</h3><p>Every signed-in REDEFINE agent will get these GE rate tables in the app. They are kept in the team's private Google Drive folder, readable only with the team code. Enter the owner code to confirm; it is used for this upload only and not saved.</p>
        <div class="f"><label for="oc">Owner code</label><input id="oc" type="password" autocomplete="off"></div>
        <p class="muted" id="ocMsg" role="alert" style="color:var(--err);min-height:18px"></p>
        <div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Upload</button></div>`);
      $('[data-x]', el).onclick = () => { closeSheet(); done(null); };
      $('[data-ok]', el).onclick = async () => {
        const code = $('#oc', el).value.trim(); if (!code) return ($('#ocMsg', el).textContent = 'Enter the owner code.');
        $('[data-ok]', el).disabled = true; $('[data-ok]', el).textContent = 'Uploading…';
        try { const r = await post({op: 'kbput', text}, {name: (session() || {}).name || 'owner', code}); closeSheet(); done(r); }
        catch (err) {
          $('#ocMsg', el).textContent = err.code === 'unauthorized' || err.code === 'not_allowed' ? 'That is not the owner code.' : err.code === 'locked' ? 'Too many wrong tries. Wait 15 minutes.'
            : err.code === 'invalid_request' ? 'The team server needs its update first (it does not know this request yet).' : 'Could not reach the team server. Check your connection.';
          $('[data-ok]', el).disabled = false; $('[data-ok]', el).textContent = 'Upload';
        }
      };
    });
    if (!owner) return;
    storeKB(k, owner.ver); home(); toast('Uploaded. Agents get the new tables next time they open the app.');
  });
  ['#fCam', '#fUp'].forEach(id => $(id).addEventListener('change', e => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) intake(f); }));

  /* ---------- reading ---------- */
  const loadScript = src => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error(src)); document.head.appendChild(s); });
  const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
  async function pdfLib() { if (!window.pdfjsLib) { await loadScript('vendor/pdf.min.js'); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; } return window.pdfjsLib; }
  async function openPdf(file) {
    const lib = await pdfLib();
    const task = lib.getDocument({data: new Uint8Array(await file.arrayBuffer())});
    task.onPassword = (update, reason) => {
      sheet(`<h3>${reason === 2 ? 'Wrong password' : 'This PDF has a password'}</h3><p>The password is used once on this phone and not saved.</p>
        <div class="f"><label for="pw">PDF password</label><input id="pw" type="password" autocomplete="off"></div>
        <div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Open</button></div>`, s => {
        $('[data-x]', s).onclick = () => { closeSheet(); task.destroy(); };
        $('[data-ok]', s).onclick = () => { const v = $('#pw', s).value; sheet('<h3>Opening PDF…</h3><div class="spin"></div>'); update(v); };
      });
    };
    return task.promise;
  }

  async function intake(files) {
    const pdf = files.find(isPdf);
    if (pdf) {
      sheet('<h3>Reading the PDF…</h3><div class="spin"></div><p style="text-align:center">On this phone. Nothing is sent.</p>'); $('#sheet').dataset.lock = '1';
      let doc;
      try { doc = await openPdf(pdf); } catch (e) { closeSheet(); return fail('That PDF could not be opened. Try a photo of the table page instead.'); }
      try {
        const pages = [];
        for (let i = 1; i <= Math.min(doc.numPages, 14); i++) {
          const c = await (await doc.getPage(i)).getTextContent();
          pages.push(c.items.map(it => ({x: it.transform[4], y: it.transform[5], str: it.str})));
        }
        const r = WIFParse.fromPdfText(pages);
        if (r.ok) { closeSheet(); doc.destroy(); return review(r.data, r.notes, true); }
      } catch (e) { /* fall through to AI */ }
      closeSheet();
      const go = await confirmBox('Read this PDF with AI?', 'The table could not be read directly from this PDF (it may be a scan). Pick the pages with the yearly table and the "policy may sustain" lines, and the AI will read them.', 'Choose pages');
      if (!go) { doc.destroy(); return; }
      const imgs = [];
      sheet('<h3>Preparing pages…</h3><div class="spin"></div>');
      for (let i = 1; i <= Math.min(doc.numPages, 12); i++) {
        const page = await doc.getPage(i), v1 = page.getViewport({scale: 1}), v = page.getViewport({scale: Math.min(3, 2000 / Math.max(v1.width, v1.height))});
        const cv = document.createElement('canvas'); cv.width = Math.round(v.width); cv.height = Math.round(v.height);
        const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
        await page.render({canvasContext: g, viewport: v}).promise;
        imgs.push({blob: await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9)), label: 'p' + i});
      }
      doc.destroy(); closeSheet();
      return pickAndRead(imgs);
    }
    addToTray(files);
  }
  function fail(msg) { sheet(`<h3>Could not read it</h3><p>${esc(msg)}</p><button class="btn block" data-x>OK</button>`, s => { $('[data-x]', s).onclick = closeSheet; }); }

  /* AI through the team server (same sign-in as Form Filler) */
  function session() { const own = localStorage.getItem('wif.session'); return own !== null ? load('wif.session', null) : load('rff.session', null); }
  async function post(body, who) {
    const s = who || session(); let r;
    try { r = await fetch(CFG.api, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(Object.assign({code: s.code, name: s.name}, body))}); }
    catch (e) { throw {code: 'offline'}; }
    let j; try { j = await r.json(); } catch (e) { throw {code: 'upstream_error'}; }
    if (j.error) throw {code: j.error};
    return j;
  }
  /* GE rate tables from the team server: downloaded once, then only when the owner uploads a new version */
  function storeKB(k, ver) {
    try { localStorage.setItem('wif.kb', JSON.stringify(k)); } catch (e) { toast('This phone has no room for the GE rate tables.'); return false; }
    save('wif.kbMeta', {ver: ver || null, added: new Date().toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}), extracted: (k._meta || {}).extracted || null});
    KB = k; return true;
  }
  /* asked at most once per app opening; the answer is remembered so the home screen never loops */
  let kbSyncing = null, kbState = null; // null = not asked yet, 'ok', or an error code
  const KB_MSG = {
    no_kb: 'The team server does not have GE\'s rate tables yet. Results after the last printed age are estimated.',
    invalid_request: 'The team server needs its update before it can share GE\'s rate tables. Results after the last printed age are estimated.',
    unauthorized: 'Please sign in again to get GE\'s rate tables.',
    offline: 'Could not reach the team server. Results after the last printed age are estimated for now.'
  };
  const kbStatusText = () => KB_MSG[kbState] || (kbState && kbState !== 'ok' ? KB_MSG.offline : 'Getting GE\'s rate tables from the team server…');
  function syncKB() {
    if (!session() || kbSyncing) return kbSyncing || Promise.resolve();
    kbSyncing = (async () => {
      try {
        const had = !!KB;
        const r = await post({op: 'kbget', have: KB && kbMeta() ? kbMeta().ver || '' : ''});
        kbState = 'ok';
        if (r.same) return;
        let k = null; try { k = JSON.parse(r.text); } catch (e) {}
        if (kbOk(k) && storeKB(k, r.ver)) toast(had ? 'GE rate tables updated' : 'GE rate tables ready');
      } catch (e) {
        kbState = e.code || 'offline';
        if (e.code === 'unauthorized') save('wif.session', null);
      } finally { kbSyncing = null; }
    })();
    return kbSyncing;
  }
  function signIn() {
    return new Promise(done => {
      const el = sheet(`<h3>Sign in to the team server</h3><p>The REDEFINE team server reads photos and shares GE\'s rate tables. Enter your name and the team code (the same one as Form Filler).</p>
        <div class="f"><label for="gName">Your name</label><input id="gName" autocomplete="name"></div>
        <div class="f"><label for="gCode">Team code</label><input id="gCode" type="password" autocomplete="current-password"></div>
        <p class="muted" id="gMsg" role="alert" style="color:var(--err);min-height:18px"></p>
        <div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Sign in</button></div>`);
      $('[data-x]', el).onclick = () => { closeSheet(); done(false); };
      $('[data-ok]', el).onclick = async () => {
        const who = {name: $('#gName', el).value.trim(), code: $('#gCode', el).value.trim()};
        if (!who.name || !who.code) { $('#gMsg', el).textContent = 'Enter both.'; return; }
        $('[data-ok]', el).disabled = true; $('[data-ok]', el).textContent = 'Checking…';
        try { await post({op: 'login'}, who); save('wif.session', who); closeSheet(); done(true); }
        catch (e) {
          $('#gMsg', el).textContent = e.code === 'unauthorized' ? 'That team code is not right.' : e.code === 'locked' ? 'Too many wrong tries. Wait 15 minutes.' : 'Could not reach the team server. Check your connection.';
          $('[data-ok]', el).disabled = false; $('[data-ok]', el).textContent = 'Sign in';
        }
      };
    });
  }
  async function toJpegB64(blob) {
    const bmp = await createImageBitmap(blob), k = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.88).split(',')[1];
  }
  function parseJSON(text) {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/), a = text.indexOf('{'), b = text.lastIndexOf('}');
    for (const t of [text, fence && fence[1], a >= 0 && b > a && text.slice(a, b + 1)]) { if (!t) continue; try { return JSON.parse(t); } catch (e) {} }
    throw {code: 'invalid_json'};
  }
  const AI_ERR = {
    offline: 'No internet connection. Try again, or upload the MPOS PDF (read on the phone, no internet needed).',
    daily_limit: 'The team has used today\'s AI limit. Upload the MPOS PDF instead, or try tomorrow.',
    no_credit: 'The OpenAI account is out of credit. Tell Kah Jian.', bad_api_key: 'The team server key is not working. Tell Kah Jian.',
    refused: 'The AI would not read this image. Try a clearer photo.', invalid_json: 'The AI answer was unreadable. Try again with fewer photos.',
    rate_limited: 'The AI is busy. Wait a minute and try again.', image_rejected: 'One photo could not be opened. Try a screenshot or a different photo.'
  };
  /* ---------- photos: a tray of several photos of one quotation, read together ---------- */
  const MAX_PHOTOS = 10, PER_CALL = 5; // the team server reads up to 5 images per AI call
  let tray = [];
  const TRAY_TIPS = [
    ['Plan page', 'plan name and code, age, gender, smoker, sum assured, riders, payment term, premium'],
    ['"Policy may sustain"', 'the lines "may sustain for … years up to your age …"'],
    ['Yearly table (Table 1)', 'Scenario X / Y values and charges; two photos if it does not fit'],
    ['Booster / rider charges', 'only if the quotation has a booster note or a rider-charge table']
  ];
  function showTray() {
    tray.forEach(t => { if (!t.url) t.url = URL.createObjectURL(t.blob); });
    const n = tray.length;
    const el = sheet(`<h3>${n} photo${n === 1 ? '' : 's'} of this quotation</h3>
      <p style="margin-bottom:8px">More pages help the AI. Snap these, one photo each:</p>
      <ol class="note" style="margin:0 0 10px;padding-left:18px">${TRAY_TIPS.map(([t, d]) => `<li><b>${esc(t)}</b>: ${esc(d)}</li>`).join('')}</ol>
      <div class="thumbs pick">${tray.map((t, i) => `<div class="th" aria-pressed="true" style="opacity:1"><img src="${t.url}" alt="Photo ${i + 1}"><span>${i + 1}</span>
        <button type="button" data-rm="${i}" aria-label="Remove photo ${i + 1}" style="position:absolute;top:4px;right:4px;width:26px;height:26px;border-radius:50%;background:rgba(20,33,61,.85);color:#fff;font-weight:700">✕</button></div>`).join('')}</div>
      <div class="row" style="margin-bottom:8px"><button class="btn" data-cam ${n >= MAX_PHOTOS ? 'disabled' : ''}>📷 Take another</button><button class="btn" data-gal ${n >= MAX_PHOTOS ? 'disabled' : ''}>Add from gallery</button></div>
      <p class="muted" style="margin-bottom:10px">${n >= MAX_PHOTOS ? 'That is the most for one quotation (' + MAX_PHOTOS + ').' : 'Up to ' + MAX_PHOTOS + ' photos.'} Photos go to the REDEFINE team server and OpenAI only to be read; nothing is stored. Cover the client's name and IC if you can.</p>
      <div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok ${n ? '' : 'disabled'}>Read ${n} with AI</button></div>`);
    $$('[data-rm]', el).forEach(btn => btn.onclick = () => { const t = tray.splice(+btn.dataset.rm, 1)[0]; if (t && t.url) URL.revokeObjectURL(t.url); showTray(); });
    $('[data-cam]', el).onclick = () => $('#fCam').click();
    $('[data-gal]', el).onclick = () => $('#fUp').click();
    $('[data-x]', el).onclick = () => { clearTray(); closeSheet(); };
    $('[data-ok]', el).onclick = () => { const blobs = tray.map(t => t.blob); clearTray(); readImages(blobs); };
  }
  function clearTray() { tray.forEach(t => t.url && URL.revokeObjectURL(t.url)); tray = []; }
  function addToTray(files) {
    const room = MAX_PHOTOS - tray.length;
    files.slice(0, Math.max(0, room)).forEach(f => tray.push({blob: f}));
    if (files.length > room) toast('Up to ' + MAX_PHOTOS + ' photos per quotation.');
    showTray();
  }

  /* PDF pages that could not be read directly: pick pages, then read them like photos */
  async function pickAndRead(items) {
    const urls = items.map(it => (it.url = URL.createObjectURL(it.blob)));
    const el = sheet(`<h3 id="pickH"></h3><p>Tap the pages to read: the plan page (plan, age, sum assured, riders, payment term), the page with "the policy may sustain for…", and the yearly table (Table 1).</p>
      <div class="thumbs pick">${items.map((it, i) => `<button type="button" class="th" data-i="${i}" aria-pressed="${!!it.on}"><img src="${it.url}" alt=""><span>${esc(it.label)}</span></button>`).join('')}</div>
      <p id="pickP" class="muted"></p>
      <div class="row"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Read with AI</button></div>`);
    const refresh = () => {
      const n = items.filter(it => it.on).length;
      $('#pickH', el).textContent = `Send ${n} page${n === 1 ? '' : 's'} to the AI?`;
      $('#pickP', el).textContent = (n > MAX_PHOTOS ? `Choose up to ${MAX_PHOTOS}. ` : '') + 'Pages go to the REDEFINE team server and OpenAI only to be read; nothing is stored.';
      $('[data-ok]', el).disabled = !n || n > MAX_PHOTOS;
    };
    $$('.th', el).forEach(btn => btn.onclick = () => { const it = items[+btn.dataset.i]; it.on = !it.on; btn.setAttribute('aria-pressed', it.on); refresh(); });
    refresh();
    const go = await new Promise(done => { $('[data-x]', el).onclick = () => done(false); $('[data-ok]', el).onclick = () => done(true); });
    const chosen = items.filter(it => it.on).map(it => it.blob);
    urls.forEach(URL.revokeObjectURL); closeSheet();
    if (go) readImages(chosen);
  }

  /* send to the AI, 5 images per call, then merge the answers */
  async function readImages(blobs) {
    if (!blobs.length) return;
    if (!session() && !(await signIn())) return;
    const box = sheet('<h3>Reading the quotation…</h3><div class="spin"></div><p id="rdMsg" style="text-align:center">Usually 20–60 seconds. Keep this screen open.</p>'); $('#sheet').dataset.lock = '1';
    try {
      const parts = [];
      for (let i = 0; i < blobs.length; i += PER_CALL) {
        const part = blobs.slice(i, i + PER_CALL);
        if (blobs.length > PER_CALL) $('#rdMsg', box).textContent = `Reading photos ${i + 1}–${i + part.length} of ${blobs.length}…`;
        const images = [];
        for (const bl of part) { try { images.push(await toJpegB64(bl)); } catch (e) { throw {code: 'image_rejected'}; } }
        const r = await post({op: 'ai', prompt: WIFParse.aiPrompt(), images});
        if (r.truncated) throw {code: 'invalid_json'};
        parts.push(WIFParse.fromAI(parseJSON(r.text)));
      }
      const data = WIFParse.mergeAI(parts);
      closeSheet();
      if (!data.rows.length) return fail('No yearly table was found in those photos. Add a photo of the page titled "Table 1" with Scenario X and Scenario Y columns.');
      const notes = data.unclear.map(u => 'AI not sure: ' + u);
      if (!data.policy || !data.policy.code) notes.push('The plan page was not found, so GE\'s rate tables cannot be matched. Fill in the plan code and riders below, or add a photo of the plan page.');
      review(data, notes, false);
    } catch (e) {
      closeSheet();
      if (e.code === 'unauthorized') { save('wif.session', null); toast('Please sign in again.'); return; }
      fail(AI_ERR[e.code] || 'Something went wrong (' + (e.code || 'error') + '). Try again.');
    }
  }

  /* ---------- review: the agent confirms the figures before anything is calculated ---------- */
  function review(data, notes, fromPdf, existingId) {
    const d = JSON.parse(JSON.stringify(data));
    d.rows = (d.rows || []).map(r => { const o = Object.assign({}, r); if (o.chargesX === undefined && o.charges !== undefined) { o.chargesX = o.chargesY = o.charges; } delete o.charges; return o; });
    d.sustain = d.sustain || {}; d.rates = d.rates || {}; const bn = d.bonus || {};
    d.policy = d.policy || {riders: []}; d.policy.riders = d.policy.riders || []; const pol = d.policy;
    const COLS = [['year', 'Yr'], ['age', 'Age'], ['alloc', 'Allocated'], ['chargesX', 'Charges X'], ['chargesY', 'Charges Y'], ['sa', 'Sum assured'], ['tivX', 'Value X'], ['tivY', 'Value Y']];
    const pv = v => v === null || v === undefined || isNaN(v) ? '' : v;
    app.innerHTML = bar('Check the figures', fromPdf ? 'READ FROM PDF ON THIS PHONE' : 'READ BY AI · PLEASE CHECK', true) + `<main class="wrap">
      <div id="msgs"></div>
      <section class="card"><h2>Quotation</h2>
        <div class="f"><label for="pName">Plan</label><input id="pName" value="${esc(d.product || '')}"></div>
        <div class="grid2">
          <div class="f"><label for="pAge">Entry age (next birthday)</label><input id="pAge" inputmode="numeric" value="${pv(d.entryAge)}"></div>
          <div class="f"><label for="pPrem">Premium a year (RM)</label><input id="pPrem" inputmode="decimal" value="${pv(d.premium)}"></div>
          <div class="f"><label for="pX">Scenario X return (%)</label><input id="pX" inputmode="decimal" value="${d.rates.x == null ? '' : +(d.rates.x * 100).toFixed(2)}"></div>
          <div class="f"><label for="pY">Scenario Y return (%)</label><input id="pY" inputmode="decimal" value="${d.rates.y == null ? '' : +(d.rates.y * 100).toFixed(2)}"></div>
          <div class="f"><label for="sX">Lasts to age at X%</label><input id="sX" inputmode="numeric" value="${pv(d.sustain.x)}" placeholder="from quotation"></div>
          <div class="f"><label for="sY">Lasts to age at Y%</label><input id="sY" inputmode="numeric" value="${pv(d.sustain.y)}" placeholder="from quotation"></div>
        </div>
        <p class="muted">"Lasts to age" comes from the quotation's line "the policy may sustain for N years up to your age …". Leave blank if not shown.</p>
        <h2 style="margin-top:14px">Booster / bonus into the fund</h2>
        <div class="grid2" style="grid-template-columns:1fr 1fr 1fr">
          <div class="f"><label for="bAmt">Amount (RM)</label><input id="bAmt" inputmode="decimal" value="${pv(bn.amount)}" placeholder="none"></div>
          <div class="f"><label for="bAge">At age</label><input id="bAge" inputmode="numeric" value="${pv(bn.age)}"></div>
          <div class="f"><label for="bEv">Every (yrs)</label><input id="bEv" inputmode="numeric" value="${pv(bn.every)}" placeholder="once"></div>
        </div>
        <p class="muted">Only if the quotation credits a booster or loyalty bonus into the investment value (age next birthday). Leave blank if none.</p>
      </section>
      <section class="card"><h2>Plan details (for GE rate tables)</h2>
        <div class="grid2" style="grid-template-columns:1fr 1fr 1fr">
          <div class="f"><label for="pCode">Plan code</label><input id="pCode" inputmode="numeric" value="${esc(pol.code || '')}" placeholder="e.g. 8004"></div>
          <div class="f"><label for="pG">Gender</label><select id="pG" style="min-height:44px;border:1px solid var(--line);border-radius:10px;padding:0 8px;background:#fff"><option value="M"${pol.gender !== 'F' ? ' selected' : ''}>Male</option><option value="F"${pol.gender === 'F' ? ' selected' : ''}>Female</option></select></div>
          <div class="f"><label for="pS">Smoker</label><select id="pS" style="min-height:44px;border:1px solid var(--line);border-radius:10px;padding:0 8px;background:#fff"><option value="N"${pol.smoker !== 'Y' ? ' selected' : ''}>No</option><option value="Y"${pol.smoker === 'Y' ? ' selected' : ''}>Yes</option></select></div>
          <div class="f"><label for="pOcc">Occ. class</label><input id="pOcc" inputmode="numeric" value="${esc(pol.occ || '1')}"></div>
          <div class="f" style="grid-column:span 2"><label for="pBsa">Basic sum assured (RM)</label><input id="pBsa" inputmode="decimal" value="${pv(pol.bsa)}"></div>
        </div>
        <div class="scroll"><table class="t edit"><thead><tr><th>Rider code</th><th>Sum assured</th><th>Years</th><th></th></tr></thead>
          <tbody id="rid">${(pol.riders || []).map((r, i) => `<tr data-i="${i}"><td><input data-k="code" value="${esc(r.code || '')}" style="text-align:left" aria-label="Rider code"></td><td><input data-k="sa" inputmode="decimal" value="${pv(r.sa)}" aria-label="Rider sum assured"></td><td><input data-k="years" inputmode="numeric" value="${pv(r.years)}" aria-label="Rider years"></td><td><button data-rmr="${i}" aria-label="Remove rider">✕</button></td></tr>`).join('')}</tbody></table></div>
        <button class="btn sm ghost" id="addRid">+ Add a rider</button>
        <p class="muted" id="kbStat"></p>
      </section>
      <section class="card"><h2>Yearly table (Table 1)</h2>
        <p class="muted" style="margin-bottom:8px">Charges X / Y = insurance charges (basic + riders) + other charges for each scenario, not the fund management charge. Most plans print one set, so X and Y are the same. Plans that pay the higher of sum assured or fund print them per scenario. Value X / Y = total investment value.</p>
        <div class="scroll"><table class="t edit"><thead><tr>${COLS.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead>
        <tbody id="rows">${d.rows.map((r, i) => `<tr data-i="${i}">${COLS.map(c => `<td><input data-k="${c[0]}" inputmode="decimal" value="${pv(r[c[0]])}" aria-label="${c[1]} row ${i + 1}"></td>`).join('')}<td><button data-rm="${i}" aria-label="Remove row">✕</button></td></tr>`).join('')}</tbody></table></div>
        <button class="btn sm ghost" id="addRow">+ Add a row</button>
      </section>
      <div class="dock"><button class="btn" id="cancel">Cancel</button><button class="btn primary" id="go">Calculate</button></div>
    </main>`;
    const collect = () => {
      const n = v => { const t = String(v).replace(/[,\sRM%]/gi, ''); return t === '' || isNaN(+t) ? null : +t; };
      d.product = $('#pName').value.trim() || 'Investment-linked plan';
      d.entryAge = n($('#pAge').value); d.premium = n($('#pPrem').value);
      d.rates = {x: n($('#pX').value) === null ? null : n($('#pX').value) / 100, y: n($('#pY').value) === null ? null : n($('#pY').value) / 100};
      d.sustain = Object.assign({}, d.sustain, {x: n($('#sX').value), y: n($('#sY').value)});
      const ba = n($('#bAmt').value), bg = n($('#bAge').value);
      d.bonus = ba && bg ? {name: (d.bonus && d.bonus.name) || 'Booster', amount: ba, age: bg, every: n($('#bEv').value)} : null;
      d.policy = Object.assign({}, d.policy, {code: $('#pCode').value.replace(/\D/g, '') || null, gender: $('#pG').value, smoker: $('#pS').value,
        occ: $('#pOcc').value.replace(/\D/g, '') || '1', bsa: n($('#pBsa').value), premium: d.premium,
        riders: $$('#rid tr').map(tr => { const o = {}; $$('input', tr).forEach(inp => o[inp.dataset.k] = inp.dataset.k === 'code' ? inp.value.trim().toUpperCase() : n(inp.value)); return o; }).filter(r => r.code)});
      d.rows = $$('#rows tr').map(tr => { const o = Object.assign({}, d.rows[+tr.dataset.i] || {}); $$('input', tr).forEach(inp => o[inp.dataset.k] = n(inp.value)); return o; });
      return d;
    };
    const show = () => {
      const c = WIF.check(collect());
      $$('#rows input').forEach(inp => inp.classList.toggle('bad', inp.value.trim() === '' && inp.dataset.k !== 'age'));
      $('#msgs').innerHTML = (c.problems.length ? `<div class="checks err"><b>Fix before calculating</b><ul>${c.problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : '')
        + ((c.warnings.length || notes.length) ? `<div class="checks"><b>Please check</b><ul>${c.warnings.concat(notes).map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : '')
        + (!c.problems.length && !c.warnings.length && !notes.length ? `<div class="checks" style="background:var(--okbg);border-color:#BFE3D7"><b style="color:var(--ok)">${d.rows.length} rows read.</b> Compare a few numbers with the quotation, then confirm.</div>` : '');
      $('#go').disabled = !!c.problems.length;
      const st = $('#kbStat');
      if (st) {
        if (!KB) st.textContent = 'GE rate tables are not loaded on this phone, so years after the last printed age are estimated.';
        else if (!d.policy.code || !KB.products[d.policy.code]) st.innerHTML = '<span style="color:var(--warn)">Plan code ' + esc(d.policy.code || '(blank)') + ' is not in the GE rate tables. Years after the last printed age will be estimated.</span>';
        else {
          const known = c => KB.other_riders.riders[c] || Object.values(KB.medical_riders.riders).some(r => (r.codes || []).includes(c));
          const rs = d.policy.riders.map(r => esc(r.code) + (known(r.code) ? ' ✓' : ' (not in tables)')).join(', ');
          st.innerHTML = '<span style="color:var(--ok)">GE rate tables: ' + esc(KB.products[d.policy.code].name) + ' ✓</span>' + (rs ? ' · Riders: ' + rs : '');
        }
      }
      return c;
    };
    app.oninput = () => show();
    $$('[data-rm]').forEach(b => b.onclick = () => { collect(); d.rows.splice(+b.dataset.rm, 1); review(d, notes, fromPdf, existingId); });
    $$('[data-rmr]').forEach(b => b.onclick = () => { collect(); d.policy.riders.splice(+b.dataset.rmr, 1); review(d, notes, fromPdf, existingId); });
    $('#addRid').onclick = () => { collect(); d.policy.riders.push({code: '', sa: null, years: null}); review(d, notes, fromPdf, existingId); };
    $('#addRow').onclick = () => { collect(); const last = d.rows[d.rows.length - 1] || {}; d.rows.push({year: last.year ? last.year + 1 : 1, age: last.age ? last.age + 1 : null}); review(d, notes, fromPdf, existingId); };
    $('#back').onclick = $('#cancel').onclick = home;
    $('#go').onclick = () => {
      const c = show(); if (c.problems.length) return;
      const m = WIF.calibrate(d, KB);
      if (!m.ok) return toast(m.problems[0]);
      const id = existingId && !byId(existingId).sample ? existingId : 'q' + Date.now();
      const label = `${d.product.replace(/\s*\(.*\)$/, '')}, age ${d.entryAge}`;
      const rec = {id, label, saved: new Date().toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}), data: d};
      quotes = quotes.filter(q => q.id !== id); quotes.unshift(rec); quotes = quotes.slice(0, 30); saveQuotes();
      openQuote(id);
    };
    show();
    window.scrollTo(0, 0);
  }

  /* ---------- result ---------- */
  function openQuote(id) {
    const rec = byId(id); if (!rec) return home();
    const model = WIF.calibrate(rec.data, KB);
    if (!model.ok) return review(rec.data, [], rec.data.source === 'pdf', id);
    app.oninput = null;
    const d = rec.data, endAge = model.entryAge + model.termYears;
    const px = WIF.project(model, model.rates.x), py = WIF.project(model, model.rates.y);
    const need = WIF.minReturn(model), needT = WIF.minReturn(model, null, true);
    const acc = model.accuracy;
    const ages = [];
    for (let a = Math.ceil((model.entryAge + 1) / 5) * 5; a <= endAge; a += 5) if (a >= model.entryAge + 4) ages.push(a);
    if (ages[ages.length - 1] !== endAge) ages.push(endAge);
    app.innerHTML = bar(d.product, `AGE ${model.entryAge} · ${d.premium ? rm(d.premium) + ' A YEAR · ' : ''}COVER TO AGE ${endAge}`, true) + `<main class="wrap">
      <section class="card"><h2>Your assumed fund return</h2>
        <div class="rate"><button class="step" id="minus" aria-label="Lower">−</button>
          <div class="val"><input id="rate" inputmode="decimal" aria-label="Return per year in percent"><small>a year, same basis as GE's ${pct(model.rates.x)} / ${pct(model.rates.y)}</small></div>
          <button class="step" id="plus" aria-label="Higher">+</button></div>
        <input type="range" id="slide" min="0" max="15" step="0.25" aria-label="Return slider">
        <div class="chips">${[2, 4, 5, 6, 8, 10].map(v => `<button data-r="${v}">${v}%</button>`).join('')}</div>
      </section>
      <div id="out"></div>
      <section class="card"><h2>Fund value (cash value) by age</h2>
        <div class="scroll"><table class="t"><thead><tr><th>Age</th><th>${pct(model.rates.x)} (GE X)</th><th>${pct(model.rates.y)} (GE Y)</th><th class="u" id="thU"></th></tr></thead><tbody id="tbl"></tbody></table></div>
        <p class="note" style="margin-top:8px"><span class="est">≈</span> = after the last age printed in the quotation (age ${model.entryAge + model.lastDataYear}); ${model.table ? 'charges there come from GE\'s rate tables' : 'charges there are estimated'}.</p>
      </section>
      <section class="card"><h2>Fund value over time</h2><div id="chart"></div>
        <div class="legend"><span><i style="background:var(--cx)"></i>${pct(model.rates.x)}</span><span><i style="background:var(--cy)"></i>${pct(model.rates.y)}</span><span><i style="background:var(--cu)"></i><b id="lgU"></b></span><span>● GE printed figures</span></div>
      </section>
      <section class="card"><h2>Can you trust it?</h2>
        <div class="acc"><span class="dot" style="background:${acc.grade === 'good' ? 'var(--ok)' : acc.grade === 'fair' ? 'var(--gold)' : 'var(--err)'}"></span><div>
          <b>${acc.grade === 'good' ? 'Matches GE\'s own figures' : acc.grade === 'fair' ? 'Close to GE\'s figures' : 'Does not match GE\'s figures well, so check the readings'}</b>
          <p class="muted">Re-creating GE's ${pct(model.rates.x)} and ${pct(model.rates.y)} columns from the quotation's own charges, the app is within ${(acc.maxErr * 100).toFixed(acc.maxErr < 0.01 ? 2 : 1)}% at every printed year.
          ${['x', 'y'].map(k => acc.lapse[k].ge ? `At ${pct(model.rates[k])} GE says the policy lasts to age ${acc.lapse[k].ge}; the app gets ${acc.lapse[k].app}.` : '').join(' ')}</p></div></div>
        ${model.table ? `<div class="acc" style="margin-top:10px"><span class="dot" style="background:${model.table.maxDev !== null && model.table.maxDev <= 0.05 ? 'var(--ok)' : 'var(--gold)'}"></span><div>
          <b>GE rate tables used for ${esc(model.table.name)}</b>
          <p class="muted">Years the quotation does not print use GE's own insurance and rider rates${model.table.maxDev !== null ? `. At the ${model.table.checked} printed years, the tables are within ${(model.table.maxDev * 100).toFixed(model.table.maxDev < 0.01 ? 2 : 1)}% of the quotation's charges` : ''}. Rates can be revised by GE; medical rider rates often are.</p>
          ${model.table.notes.length ? `<p class="muted" style="color:var(--warn)">${model.table.notes.map(esc).join(' ')}</p>` : ''}</div></div>`
        : (model.tableNotes && model.tableNotes.length ? `<p class="muted" style="color:var(--warn);margin-top:8px">${model.tableNotes.map(esc).join(' ')} Years after the last printed age are estimated.</p>`
        : (!KB ? '<p class="muted" style="margin-top:8px">GE rate tables are not loaded on this phone, so years after the last printed age are estimated. Sign in with the team code on the home screen to get GE\'s own rates.</p>' : '<p class="muted" style="color:var(--warn);margin-top:8px">This quotation has no plan code, so GE\'s rate tables were not used. Tap "Check the figures" and fill in the plan details (or upload the PDF again).</p>'))}
        <details><summary>How it works</summary><ul class="note">
          <li>The app uses the quotation's allocated premium and charges for each year, deducted monthly, and fits the fund's tax (${pct1(model.costs.tax)}) and fund management charge (${(model.costs.fmc * 100).toFixed(2)}% a year) to GE's figures.</li>
          ${model.table ? `<li>For years the quotation skips or stops printing, charges come from GE's rate tables for this plan, age, gender, smoker status and riders, scaled to the quotation's own printed charges. Waiver riders are charged on the value of the premiums still to be waived.</li>` : `<li>For years the quotation skips (for example 11–14), charges are filled in between the printed years and fine-tuned so GE's ${pct(model.rates.x)} and ${pct(model.rates.y)} values come out the same.</li>`}
          ${model.table ? '' : `<li>After age ${model.entryAge + model.lastDataYear} the quotation prints no charges. ${model.level ? `The insurance rate per RM at risk keeps rising ${pct1(model.growth.q - 1)} a year by age (${model.growth.qFromRef ? 'GE reference from two quotations' : 'this plan\'s printed pace, in line with the GE reference of about 8–9%'})${model.growth.fixed > 1.001 ? `; riders and fees rise ${pct1(model.growth.fixed - 1)} a year` : ''}.` : `Charges keep rising at their printed pace (${pct1(model.growth.fixed - 1)} a year).`}${model.growthTuned ? (Math.abs(model.growth.extra - 1) < 0.01 ? ' That pace alone gives the same run-out ages as the quotation\'s "policy may sustain" lines, so no adjustment is needed.' : ` To match the quotation's "policy may sustain" ages they need an extra ${pct1(model.growth.extra - 1)} a year.`) : ''}</li>`}
          ${model.growthTuned && model.growth.extra > 1.01 ? `<li>GE's figures pin charges down only to age ${model.anchorAge - 1}. After that the app keeps the faster pace (the careful answer). If charges go back to the printed pace, results are better; the range shows both.</li>` : ''}
          ${model.twoAccounts ? `<li>This plan keeps two accounts: the Insurance Premium Account (IPA) and the Top-up Premium Account (TUPA). Insurance is charged on the prevailing sum assured minus the IPA only.${Object.keys(model.suppPcts || {}).length ? ` The supplementary charge is taken from the IPA (${Object.keys(model.suppPcts).map(Number).sort((a, b) => a - b).map(y => { const v = Object.values(model.suppPcts[y]); return (v.reduce((a, c) => a + c, 0) / v.length * 100).toFixed(1) + '%'; }).join(', ')} a year in years ${Object.keys(model.suppPcts).join(', ')}).` : ''}</li>` : ''}
          ${model.ipaBonus ? `<li>${model.ipaBonus.loyalty ? `Loyalty bonus: ${pct(model.ipaBonus.loyalty.pct)} of the IPA moves into the TUPA at the end of year ${model.ipaBonus.loyalty.first} and every ${model.ipaBonus.loyalty.every} years after. ` : ''}${model.ipaBonus.booster ? `Booster bonus: ${pct(model.ipaBonus.booster.pct)} of the IPA at the end of year ${model.ipaBonus.booster.year}. ` : ''}Both only while the policy is in force.</li>` : ''}
          ${model.bonus ? `<li>${esc(model.bonus.name)} of ${rm(model.bonus.amount)} is added to the fund at age ${model.bonus.age}${model.bonus.every ? ` and every ${model.bonus.every} years after` : ''}, while the policy is in force.</li>` : ''}
          <li>Your return is the fund's return before tax and fund charge, the same basis as GE's ${pct(model.rates.x)} / ${pct(model.rates.y)}. It is steady every year; real returns go up and down, which usually makes things worse.</li>
          <li>${model.premiumEnds ? `Premiums are paid as in the quotation (they stop after year ${model.rows.filter(r => r.premium > 0).slice(-1)[0].year}).` : 'Premiums are assumed paid in full every year.'} Top-ups and withdrawals are not included.</li>
        </ul></details>
        <details><summary>Compare with every printed year</summary><div class="scroll"><table class="t"><thead><tr><th>Yr</th><th>Age</th><th>GE ${pct(model.rates.x)}</th><th>App</th><th>GE ${pct(model.rates.y)}</th><th>App</th></tr></thead><tbody>
          ${acc.rows.map(r => `<tr><td>${r.year}</td><td>${r.age}</td><td>${rm(r.geX)}</td><td>${rm(r.appX)}</td><td>${rm(r.geY)}</td><td>${rm(r.appY)}</td></tr>`).join('')}</tbody></table></div></details>
        <div class="row" style="margin-top:10px"><button class="btn sm" id="edit">Check the figures</button></div>
      </section>
      <p class="disc">Internal estimate by REDEFINE from the quotation's own figures. It is not a Great Eastern benefit illustration. Returns are not guaranteed, and insurance charges can be revised. Use the official quotation for any recommendation.</p>
    </main>`;
    $('#back').onclick = home;
    $('#edit').onclick = () => review(d, [], d.source === 'pdf', id);

    const setRate = v => {
      v = Math.max(-0.05, Math.min(0.3, Math.round(v * 10000) / 10000)); rate = v; save('wif.rate', v);
      if (document.activeElement !== $('#rate')) $('#rate').value = +(v * 100).toFixed(2) + '%';
      $('#slide').value = v * 100;
      $$('.chips button').forEach(b => b.setAttribute('aria-pressed', Math.abs(+b.dataset.r - v * 100) < 1e-6));
      draw(v);
    };
    function draw(r) {
      const pu = WIF.project(model, r), pt = WIF.project(model, r, true);
      const range = pt.sustainsToAge !== pu.sustainsToAge;
      const lapsedEarly = !pu.fullTerm;
      const atAge = [65, 60, 70].find(a => a > model.entryAge && a <= endAge) || endAge;
      const peak = pu.years.reduce((m, y) => y.fund > m.fund ? y : m, {fund: 0, age: model.entryAge});
      $('#out').innerHTML = `<section class="verdict ${lapsedEarly ? 'bad' : 'ok'}">
        <div class="k">At ${pct(r)} a year</div>
        <div class="v">${lapsedEarly ? `Fund runs out after age ${pu.sustainsToAge}` : `Lasts to age ${endAge}, the full term`}</div>
        ${range ? `<p style="font-weight:600;margin-bottom:6px">Range: age ${pu.sustainsToAge} to ${pt.fullTerm ? endAge + ' (full term)' : pt.sustainsToAge}. The later age applies if charges after age ${model.anchorAge - 1} rise at the printed pace, not the faster pace GE's figures need up to then.</p>` : ''}
        <p>${lapsedEarly ? `That is ${endAge - pu.sustainsToAge} years before cover ends at ${endAge}. To keep it going, the client would need to top up, raise the premium or lower the cover.` : `The fund still has ${rm(pu.years[pu.years.length - 1].fund)} at age ${endAge}.`}
          ${need !== null ? ` It needs about <b>${pct1(need)}</b> a year to last to age ${endAge}${needT !== null && Math.abs(needT - need) > 0.001 ? ` (${pct1(needT)} at the printed pace)` : ''}.` : ''}</p>
        <div class="stats">
          <div><span>Fund value at age ${atAge}</span><b>${pu.fundAt(atAge) ? rm(pu.fundAt(atAge)) : 'Ran out'}</b></div>
          <div><span>Highest fund value</span><b>${rm(peak.fund)}</b><span>at age ${peak.age}</span></div>
          <div><span>GE ${pct(model.rates.x)}: lasts to</span><b>age ${px.sustainsToAge}${px.fullTerm ? ' ✓' : ''}</b></div>
          <div><span>GE ${pct(model.rates.y)}: lasts to</span><b>age ${py.sustainsToAge}${py.fullTerm ? ' ✓' : ''}</b></div>
        </div></section>`;
      $('#thU').textContent = pct(r) + ' (yours)'; $('#lgU').textContent = pct(r) + ' (yours)';
      const cell = (p, a) => { const v = p.fundAt(a); return v === null ? '–' : v === 0 && (!p.fullTerm && a > p.sustainsToAge) ? '<span style="color:var(--err)">Ran out</span>' : rm(v); };
      $('#tbl').innerHTML = ages.map(a => `<tr><td>${a}${a > model.entryAge + model.lastDataYear ? ' <span class="est">≈</span>' : ''}</td><td>${cell(px, a)}</td><td>${cell(py, a)}</td><td class="u">${cell(pu, a)}</td></tr>`).join('');
      chart(pu);
    }
    function chart(pu) {
      const W = 340, H = 200, L = 46, R = 8, T = 10, B = 24;
      const series = [[px, 'var(--cx)'], [py, 'var(--cy)'], [pu, 'var(--cu)']];
      const maxV = Math.max(1, ...series.flatMap(([p]) => p.years.map(y => y.fund)));
      const nice = (() => { const e = Math.pow(10, Math.floor(Math.log10(maxV))); for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10]) if (m * e >= maxV) return m * e; return 10 * e; })();
      const x = a => L + (a - model.entryAge) / (endAge - model.entryAge) * (W - L - R), y = v => T + (1 - v / nice) * (H - T - B);
      const path = p => { const pts = [[model.entryAge, 0]].concat(p.years.map(v => [v.age, v.fund])); if (!p.fullTerm) pts.push([p.sustainsToAge + 1, 0]); return 'M' + pts.map(q => x(q[0]).toFixed(1) + ',' + y(q[1]).toFixed(1)).join('L'); };
      const fmt = v => v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'm' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : v;
      let g = '';
      for (let i = 0; i <= 4; i++) { const v = nice * i / 4; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#ECE9E1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#6B7180">${fmt(v)}</text>`; }
      for (let a = Math.ceil(model.entryAge / 10) * 10; a <= endAge; a += 10) g += `<text x="${x(a)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#6B7180">${a}</text>`;
      const lastAge = model.entryAge + model.lastDataYear;
      g += `<rect x="${x(lastAge)}" y="${T}" width="${W - R - x(lastAge)}" height="${H - T - B}" fill="#F6F4EE" opacity=".7"/><text x="${x(lastAge) + 4}" y="${T + 11}" font-size="9.5" fill="#6B7180">estimated charges</text>`;
      g += series.map(([p, c], i) => `<path d="${path(p)}" fill="none" stroke="${c}" stroke-width="${i === 2 ? 3 : 2}" stroke-linejoin="round"/>`).join('');
      g += model.rows.map(r => ['tivX', 'tivY'].map((k, i) => r[k] > 0 && r[k] <= nice ? `<circle cx="${x(model.entryAge + r.year)}" cy="${y(r[k])}" r="2.6" fill="#fff" stroke="${i ? 'var(--cy)' : 'var(--cx)'}" stroke-width="1.5"/>` : '').join('')).join('');
      $('#chart').innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fund value by age at three returns">${g}</svg>`;
    }
    $('#minus').onclick = () => setRate(rate - 0.005);
    $('#plus').onclick = () => setRate(rate + 0.005);
    $('#slide').oninput = e => setRate(+e.target.value / 100);
    $$('.chips button').forEach(b => b.onclick = () => setRate(+b.dataset.r / 100));
    const typed = () => { const v = parseFloat($('#rate').value); if (!isNaN(v)) setRate(v / 100); };
    $('#rate').addEventListener('input', typed);
    $('#rate').addEventListener('focus', e => { e.target.value = +(rate * 100).toFixed(2); e.target.select(); });
    $('#rate').addEventListener('blur', () => setRate(rate));
    setRate(rate);
    location.hash = 'q=' + id;
    window.scrollTo(0, 0);
  }

  /* ---------- calculators ---------- */
  const numIn = v => { const t = String(v).replace(/[,\sRM%]/gi, ''); return t === '' || t === '-' || isNaN(+t) ? null : +t; };
  const fmt = (v, d = 2) => v === null || v === undefined || !isFinite(v) ? '' : (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('en-MY', {minimumFractionDigits: d, maximumFractionDigits: d});
  const money = v => (v < 0 ? '−RM' + fmt(-v) : 'RM' + fmt(v));
  const flow = v => money(v) + (v < 0 ? ' (you pay)' : v > 0 ? ' (you get)' : '');
  const calcSave = (k, o) => save('wif.calc.' + k, o), calcLoad = (k, d) => load('wif.calc.' + k, d);
  const selStyle = 'style="min-height:44px;border:1px solid var(--line);border-radius:10px;padding:0 8px;background:#fff"';

  function tvmScreen() {
    location.hash = 'tvm'; app.oninput = null;
    const st = calcLoad('tvm', {pv: '-100', pmt: '', fv: '', rate: '8', n: '20', ppy: 1, begin: false});
    const F = [['pv', 'Present value (PV)', 'money now; paying in = minus'], ['pmt', 'Payment each period (PMT)', 'regular saving = minus'],
      ['fv', 'Future value (FV)', 'money at the end'], ['rate', 'Return / interest (% a year)', ''], ['n', 'Number of periods', '']];
    const fieldHtml = ([k, l, h]) => '<div class="f"><label for="t_' + k + '">' + esc(l) + (h ? ' <span style="font-weight:400">· ' + esc(h) + '</span>' : '') + '</label>'
      + '<div class="row" style="align-items:center"><input id="t_' + k + '" inputmode="decimal" value="' + esc(st[k]) + '" style="flex:3"><button class="btn sm" data-solve="' + k + '" style="flex:1">Solve</button></div></div>';
    const ppyOpts = [[1, 'Yearly'], [2, 'Half-yearly'], [4, 'Quarterly'], [12, 'Monthly']].map(([v, l]) => '<option value="' + v + '"' + (+st.ppy === v ? ' selected' : '') + '>' + l + '</option>').join('');
    app.innerHTML = bar('TVM calculator', 'TIME VALUE OF MONEY', true) + '<main class="wrap">'
      + '<section class="card"><h2>Fill in four, tap Solve on the fifth</h2>' + F.map(fieldHtml).join('')
      + '<div class="grid2"><div class="f"><label for="t_ppy">Periods a year</label><select id="t_ppy" ' + selStyle + '>' + ppyOpts + '</select></div>'
      + '<div class="f"><label>Payments at</label><div class="seg" style="margin:0"><button data-mode="end" aria-pressed="' + !st.begin + '">End</button><button data-mode="begin" aria-pressed="' + !!st.begin + '">Start</button></div></div></div>'
      + '<div id="tvmOut" class="checks" style="background:var(--okbg);border-color:#BFE3D7;margin:6px 0 0" hidden></div>'
      + '<div class="row" style="margin-top:10px"><button class="btn sm" id="tReset">Clear</button></div></section>'
      + '<section class="card"><h2>Quick examples</h2><div class="row" style="flex-wrap:wrap">'
      + '<button class="btn sm" data-ex="delay">Cost of delay</button><button class="btn sm" data-ex="goal">Savings goal</button><button class="btn sm" data-ex="grow">Lump sum growth</button></div>'
      + '<p class="muted" style="margin-top:8px">Money paid out is minus, money received is plus, like a financial calculator. Illustration only: returns are not guaranteed.</p></section>'
      + '</main>';
    $('#back').onclick = home;
    const read = () => { const o = {}; F.forEach(([k]) => o[k] = $('#t_' + k).value); o.ppy = +$('#t_ppy').value; o.begin = $('[data-mode="begin"]').getAttribute('aria-pressed') === 'true'; return o; };
    const show = html => { const o = $('#tvmOut'); o.innerHTML = html; o.hidden = !html; };
    app.oninput = () => calcSave('tvm', read());
    $$('[data-mode]').forEach(b => b.onclick = () => { $$('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b)); calcSave('tvm', read()); });
    $('#t_ppy').onchange = () => calcSave('tvm', read());
    const label = k => F.find(x => x[0] === k)[1];
    $$('[data-solve]').forEach(b => b.onclick = () => {
      const k = b.dataset.solve, o = read(), v = {};
      for (const [f] of F) v[f] = numIn(o[f]);
      for (const f of ['rate', 'n']) if (f !== k && v[f] === null) return show('<b style="color:var(--warn)">Fill in ' + esc(label(f)) + ' first.</b>');
      const r = WIFCalc.solve(k, {pv: v.pv || 0, pmt: v.pmt || 0, fv: v.fv || 0, rate: v.rate, n: v.n, ppy: o.ppy, begin: o.begin});
      if (!isFinite(r)) return show('<b style="color:var(--warn)">No answer fits these numbers.</b> Check the signs: money you pay in should be minus and money you get back plus.');
      $('#t_' + k).value = fmt(r, k === 'rate' ? 4 : 2).replace(/,/g, '');
      calcSave('tvm', read());
      const per = {1: 'years', 2: 'half-years', 4: 'quarters', 12: 'months'}[o.ppy];
      show(k === 'n' ? '<b>' + fmt(r, 2) + ' ' + per + '</b>' + (o.ppy !== 1 ? ' (' + fmt(r / o.ppy, 1) + ' years)' : '')
        : k === 'rate' ? '<b>' + fmt(r, 2) + '% a year</b>' + (o.ppy !== 1 ? ' (' + fmt(r / o.ppy, 3) + '% a ' + per.replace(/s$/, '') + ')' : '')
        : '<b>' + esc(label(k).replace(/ \(.*\)/, '')) + ': ' + flow(r) + '</b>');
    });
    $('#tReset').onclick = () => { F.forEach(([k]) => $('#t_' + k).value = ''); show(''); calcSave('tvm', read()); };
    const EX = {
      delay: {pv: '0', pmt: '-500', fv: '', rate: '6', n: '360', ppy: 12, begin: false, note: 'RM500 a month for 30 years at 6%: tap Solve on FV. Then change the periods to 300 (starting 5 years later) and solve again to see the cost of waiting.'},
      goal: {pv: '0', pmt: '', fv: '500000', rate: '5', n: '240', ppy: 12, begin: false, note: 'RM500,000 in 20 years at 5%: tap Solve on PMT for the monthly saving needed.'},
      grow: {pv: '-100000', pmt: '0', fv: '', rate: '5', n: '20', ppy: 1, begin: false, note: 'RM100,000 left for 20 years at 5%: tap Solve on FV.'}
    };
    $$('[data-ex]').forEach(b => b.onclick = () => {
      const e = EX[b.dataset.ex];
      F.forEach(([k]) => $('#t_' + k).value = e[k]); $('#t_ppy').value = e.ppy;
      $$('[data-mode]').forEach(x => x.setAttribute('aria-pressed', (x.dataset.mode === 'begin') === e.begin));
      calcSave('tvm', read()); show(esc(e.note)); scrollTo(0, 0);
    });
    scrollTo(0, 0);
  }

  function loanScreen(kind) {
    kind = kind || calcLoad('loanKind', 'home'); calcSave('loanKind', kind);
    location.hash = kind === 'car' ? 'loan-car' : 'loan'; app.oninput = null;
    const H = calcLoad('home', {amt: '550000', rate: '3.6', years: '30', months: '', extra: ''});
    const Cr = calcLoad('car', {price: '200000', down: '20000', rate: '2.7', years: '7', basis: 'flat'});
    const inp = (id, label, val, mode, ph) => '<div class="f"><label for="' + id + '">' + label + '</label><input id="' + id + '" inputmode="' + (mode || 'decimal') + '" value="' + esc(val) + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></div>';
    const form = kind === 'home'
      ? '<section class="card"><h2>Home loan</h2>' + inp('h_amt', 'Loan amount (RM)', H.amt)
        + '<div class="grid2">' + inp('h_rate', 'Interest (% a year)', H.rate) + inp('h_years', 'Years', H.years, 'numeric') + inp('h_months', '+ months', H.months, 'numeric', '0') + inp('h_extra', 'Extra each month (RM)', H.extra, 'decimal', '0') + '</div>'
        + '<p class="muted">Malaysian home loans charge interest on the balance left (reducing balance), worked out monthly.</p></section>'
      : '<section class="card"><h2>Car loan</h2><div class="grid2">' + inp('c_price', 'Car price (RM)', Cr.price) + inp('c_down', 'Down payment (RM)', Cr.down) + inp('c_rate', 'Interest (% a year)', Cr.rate) + inp('c_years', 'Years (1–9)', Cr.years, 'numeric') + '</div>'
        + '<div class="f"><label for="c_basis">Interest type</label><select id="c_basis" ' + selStyle + '>'
        + '<option value="flat"' + (Cr.basis !== 'reducing' ? ' selected' : '') + '>Flat rate (hire purchase)</option>'
        + '<option value="reducing"' + (Cr.basis === 'reducing' ? ' selected' : '') + '>Reducing balance</option></select></div>'
        + '<p class="muted">Malaysian car loans are usually hire purchase: interest is charged on the full amount for the whole term, so the true yearly cost is almost double the flat rate.</p></section>';
    app.innerHTML = bar('Loan calculator', kind === 'car' ? 'CAR · HIRE PURCHASE' : 'HOME · REDUCING BALANCE', true) + '<main class="wrap">'
      + '<div class="seg"><button data-k="home" aria-pressed="' + (kind === 'home') + '">Home loan</button><button data-k="car" aria-pressed="' + (kind === 'car') + '">Car loan</button></div>'
      + form + '<div id="loanOut"></div><p class="disc">Estimates for discussion. The bank\'s own offer letter is the final figure.</p></main>';
    $('#back').onclick = home;
    $$('[data-k]').forEach(b => b.onclick = () => loanScreen(b.dataset.k));
    const stat = (l, v) => '<div><span>' + l + '</span><b>' + v + '</b></div>';
    const yrs = m => Math.floor(m / 12) + ' years' + (m % 12 ? ' ' + (m % 12) + ' months' : '');
    const draw = () => {
      const out = $('#loanOut');
      if (kind === 'home') {
        const o = {amt: $('#h_amt').value, rate: $('#h_rate').value, years: $('#h_years').value, months: $('#h_months').value, extra: $('#h_extra').value}; calcSave('home', o);
        const P = numIn(o.amt), r = numIn(o.rate), n = (numIn(o.years) || 0) * 12 + (numIn(o.months) || 0), x = numIn(o.extra) || 0;
        if (!(P > 0) || r === null || r < 0 || !(n > 0)) { out.innerHTML = '<p class="muted" style="padding:0 4px 12px">Fill in the loan amount, interest and years.</p>'; return; }
        const a = WIFCalc.amortised(P, r, n, 0), b = x > 0 ? WIFCalc.amortised(P, r, n, x) : null;
        out.innerHTML = '<section class="verdict ok"><div class="k">Monthly instalment</div><div class="v">' + money(a.monthly) + '</div>'
          + '<div class="stats">' + stat('Total interest', money(a.totalInterest)) + stat('Total paid', money(a.totalPaid)) + stat('A year', money(a.annual)) + stat('Mortgage constant', fmt(a.constant * 100) + '%') + '</div>'
          + (b ? '<p style="margin-top:10px">Paying <b>' + money(x) + '</b> extra a month (' + money(a.monthly + x) + ' in total) clears it in <b>' + yrs(b.months) + '</b> instead of ' + yrs(n) + ', and saves <b>' + money(a.totalInterest - b.totalInterest) + '</b> interest.</p>' : '')
          + '</section><section class="card"><details><summary>Year-by-year balance</summary><div class="scroll"><table class="t"><thead><tr><th>Year</th><th>Interest</th><th>Principal</th><th>Balance</th></tr></thead><tbody>'
          + (b || a).years.map(y => '<tr><td>' + y.year + '</td><td>' + money(y.interest) + '</td><td>' + money(y.principal) + '</td><td>' + money(y.balance) + '</td></tr>').join('')
          + '</tbody></table></div>' + (b ? '<p class="note" style="margin-top:6px">With the extra payment.</p>' : '') + '</details></section>';
      } else {
        const o = {price: $('#c_price').value, down: $('#c_down').value, rate: $('#c_rate').value, years: $('#c_years').value, basis: $('#c_basis').value}; calcSave('car', o);
        const price = numIn(o.price), down = numIn(o.down) || 0, r = numIn(o.rate), yr = numIn(o.years);
        const P = (price || 0) - down, n = Math.round((yr || 0) * 12);
        if (!(P > 0) || r === null || r < 0 || !(n > 0)) { out.innerHTML = '<p class="muted" style="padding:0 4px 12px">Fill in the car price, down payment, interest and years.</p>'; return; }
        const hp = WIFCalc.hirePurchase(P, r, n), rb = WIFCalc.amortised(P, r, n, 0), flat = o.basis !== 'reducing';
        const m = flat ? hp.monthly : rb.monthly, ti = flat ? hp.totalInterest : rb.totalInterest;
        out.innerHTML = '<section class="verdict ok"><div class="k">Monthly instalment · ' + (flat ? 'flat rate' : 'reducing balance') + '</div><div class="v">' + money(m) + '</div>'
          + '<div class="stats">' + stat('Loan amount', money(P)) + stat('Total interest', money(ti)) + stat('Total paid on loan', money(P + ti)) + stat('Down + loan', money(down + P + ti)) + '</div>'
          + (flat ? '<p style="margin-top:10px">' + fmt(r) + '% flat is about <b>' + fmt(hp.effectiveRate) + '% a year</b> in true (effective) terms. At ' + fmt(r) + '% on a reducing balance the instalment would be ' + money(rb.monthly) + '.</p>'
            : '<p style="margin-top:10px">Most Malaysian car loans are flat rate: at ' + fmt(r) + '% flat this loan would be ' + money(hp.monthly) + ' a month (' + money(hp.totalInterest) + ' interest).</p>')
          + '</section>';
      }
    };
    app.oninput = draw; if ($('#c_basis')) $('#c_basis').onchange = draw;
    draw(); scrollTo(0, 0);
  }

  window.addEventListener('popstate', () => { if (!location.hash) home(); });
  const h = location.hash.match(/q=([\w-]+)/);
  if (location.hash === '#tvm') tvmScreen(); else if (location.hash.indexOf('#loan') === 0) loanScreen(location.hash === '#loan-car' ? 'car' : 'home');
  else if (h && byId(h[1])) openQuote(h[1]); else home();
  if (KB && session()) syncKB();
})();
