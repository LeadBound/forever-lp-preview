/* Forever Builders landing pages: shared runtime. NOTHING here is connected to a server.
 *
 * Link:    ?c=<campaign number>  swaps the copy (window.FB_COPY.campaigns[c]) into [data-k], [data-k-src], [data-k-bg]
 *          ?lb=<opaque token>   the per-lead id. Never a name or an email.
 * <html data-page="adu" data-endpoint="" data-lead-endpoint="">
 *   data-endpoint       n8n webhook for events. Empty = console only.
 *   data-lead-endpoint  where a filled form goes. Empty = console only (the lead is NOT sent anywhere).
 * Events: visit (only after a human signal, mail scanners open links too), scroll_30/50/90,
 *         form_start, form_step, form_submit, thanks_view.
 * n8n, later: visit with no form_submit within 5 min -> follow-up email; form_submit -> English alert to the group.
 */
(function () {
  var H = document.documentElement;
  var q = new URLSearchParams(location.search);
  var clean = function (v, n) { return (v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, n); };
  var FB = window.FB = window.FB || {};
  FB.token = clean(q.get('lb'), 24) || null;
  FB.page = H.getAttribute('data-page') || 'unknown';
  var C = window.FB_COPY || { campaigns: {} };
  FB.c = (C.campaigns[clean(q.get('c'), 6)] ? clean(q.get('c'), 6) : C.default) || null;

  /* ---- dynamic copy ---- */
  function applyCopy() {
    var k = C.campaigns[FB.c]; if (!k) return;
    document.querySelectorAll('[data-k]').forEach(function (el) { var v = k[el.getAttribute('data-k')]; if (v != null) el.innerHTML = v; });
    document.querySelectorAll('[data-k-src]').forEach(function (el) { var v = k[el.getAttribute('data-k-src')]; if (v) el.src = v; });
    document.querySelectorAll('[data-k-bg]').forEach(function (el) { var v = k[el.getAttribute('data-k-bg')]; if (v) el.style.backgroundImage = 'url(' + v + ')'; });
    if (k.title) document.title = k.title;
    H.setAttribute('data-c', FB.c);
  }

  /* ---- tracking ---- */
  var ENDPOINT = H.getAttribute('data-endpoint') || null;
  var sent = {}, human = false, queue = [];
  function send(name, extra, repeat) {
    if (sent[name] && !repeat) return; sent[name] = true;
    var body = { event: name, lb: FB.token, c: FB.c, page: FB.page, at: new Date().toISOString(), extra: extra || null };
    if (!human && name !== 'visit') { queue.push(body); return; }
    if (!ENDPOINT) { console.info('[fb-track]', JSON.stringify(body)); return; }
    try { navigator.sendBeacon(ENDPOINT, new URLSearchParams({ d: JSON.stringify(body) })); } catch (e) {}
  }
  FB.track = send;
  function becameHuman() {
    if (human) return; human = true; send('visit');
    queue.splice(0).forEach(function (b) { sent[b.event] = false; send(b.event, b.extra); });
  }
  ['scroll', 'pointerdown', 'touchstart', 'keydown'].forEach(function (ev) { addEventListener(ev, becameHuman, { once: true, passive: true }); });
  setTimeout(function () { if (document.visibilityState === 'visible') becameHuman(); }, 8000);
  addEventListener('scroll', function () {
    var p = (H.scrollTop + innerHeight) / H.scrollHeight;
    if (p > 0.3) send('scroll_30'); if (p > 0.5) send('scroll_50'); if (p > 0.9) send('scroll_90');
  }, { passive: true });

  /* ---- the questionnaire ----
   * <form data-fbform [data-wizard]> with .fb-step[data-step] blocks.
   * Buttons [data-opt] inside a step set that step's answer; in a wizard they also advance.
   * [data-next] / [data-back] move a wizard. [data-progress] gets --p (0..1) and data-at.
   */
  function initForm(form) {
    var wizard = form.hasAttribute('data-wizard');
    var steps = [].slice.call(form.querySelectorAll('.fb-step'));
    var answers = {}, at = 0, started = false;
    var bars = [].slice.call(document.querySelectorAll('[data-progress="' + (form.id || '') + '"]'));
    function start() { if (!started) { started = true; send('form_start'); } }
    function show(i) {
      at = Math.max(0, Math.min(steps.length - 1, i));
      if (wizard) steps.forEach(function (s, j) { s.hidden = j !== at; s.classList.toggle('is-on', j === at); });
      bars.forEach(function (b) { b.style.setProperty('--p', (at / (steps.length - 1)).toFixed(3)); b.setAttribute('data-at', at); });
      form.setAttribute('data-at', at);
      var h = steps[at].querySelector('[data-focus]'); if (wizard && h && started) { try { h.focus({ preventScroll: true }); } catch (e) {} }
    }
    form.querySelectorAll('[data-opt]').forEach(function (b) {
      b.setAttribute('type', 'button'); b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        start();
        var step = b.closest('.fb-step'), key = step.getAttribute('data-step');
        step.querySelectorAll('[data-opt]').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        answers[key] = b.getAttribute('data-opt'); step.classList.remove('is-missing');
        send('form_step', { step: key, answer: answers[key] }, true);
        if (wizard) setTimeout(function () { show(steps.indexOf(step) + 1); }, 220);
      });
    });
    form.querySelectorAll('[data-next]').forEach(function (b) { b.addEventListener('click', function () { start(); show(at + 1); }); });
    form.querySelectorAll('[data-back]').forEach(function (b) { b.addEventListener('click', function () { show(at - 1); }); });
    form.addEventListener('focusin', start);
    form.querySelectorAll('.fb-file input').forEach(function (f) { f.addEventListener('change', function () { var l = f.closest('.fb-file'); l.classList.toggle('has-file', !!f.files.length); var t = l.querySelector('[data-fname]'); if (t && f.files[0]) t.textContent = f.files[0].name; }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      steps.forEach(function (s) {
        if (s.querySelector('[data-opt]') && !answers[s.getAttribute('data-step')] && !s.hasAttribute('data-optional')) { s.classList.add('is-missing'); bad = bad || s; }
      });
      form.querySelectorAll('input[required]').forEach(function (i) {
        var ok = i.value.trim() !== '';
        if (i.type === 'tel') ok = i.value.replace(/\D/g, '').length >= 10;
        if (i.type === 'email') ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.value.trim());
        if (i.name === 'zip') ok = /^\d{5}$/.test(i.value.trim());
        i.closest('.fb-field').classList.toggle('is-bad', !ok); if (!ok) bad = bad || i;
      });
      if (bad) {
        if (wizard) { var s = bad.closest ? bad.closest('.fb-step') : bad; show(steps.indexOf(s)); }
        (bad.focus ? bad : bad.querySelector('button')).focus(); return;
      }
      var fd = new FormData(form), contact = {};
      fd.forEach(function (v, k) { if (typeof v === 'string') contact[k] = v.trim(); });
      var lead = { page: FB.page, c: FB.c, lb: FB.token, answers: answers, contact: contact, at: new Date().toISOString() };
      var LEAD = H.getAttribute('data-lead-endpoint');
      if (LEAD) { try { navigator.sendBeacon(LEAD, new Blob([JSON.stringify(lead)], { type: 'application/json' })); } catch (er) {} }
      else console.info('[fb-lead] NOT SENT (no endpoint):', JSON.stringify(lead));
      send('form_submit', { answers: answers });
      try { sessionStorage.setItem('fb_first', (contact.name || '').split(' ')[0]); } catch (er) {}
      var to = form.getAttribute('data-thanks') || '../thanks/';
      var qs = new URLSearchParams(); if (FB.c) qs.set('c', FB.c); if (FB.token) qs.set('lb', FB.token);
      setTimeout(function () { location.href = to + (qs.toString() ? '?' + qs : ''); }, 150);
    });
    show(0);
  }

  /* [data-goto="#id"] scrolls to the form and opens it */
  function initGoto() {
    document.querySelectorAll('[data-goto]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var t = document.querySelector(a.getAttribute('data-goto')); if (!t) return;
        e.preventDefault(); t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        send('cta_click', { from: a.getAttribute('data-from') || null }, true);
      });
    });
  }

  function ready() { applyCopy(); document.querySelectorAll('form[data-fbform]').forEach(initForm); initGoto(); H.classList.add('fb-ready'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
