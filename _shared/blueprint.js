/* A generic ADU floor plan that draws itself. Not any client's real plan; it illustrates "your plans".
 * <div data-blueprint data-stroke="#FFD07B" data-grid="#2a3a55" data-bg="#101826" [data-auto]></div>
 * FBBlueprint.mount(el) -> { set(p 0..1) }. With data-auto it draws once when it scrolls into view. */
(function () {
  var PLAN = '<g class="bp-grid"></g><g class="bp-lines">' +
    '<path d="M60 80H340V420H60Z"/>' +
    '<path d="M60 250H200M200 80V330M200 330H340M270 330V420"/>' +
    '<path class="t" d="M200 290a40 40 0 0 1 40-40M60 330h40M100 330a40 40 0 0 0-40-40M300 420a30 30 0 0 0-30-30"/>' +
    '<path class="w" d="M110 80h50M260 80h50M340 150v50M60 140v50"/>' +
    '<path class="t" d="M60 50H340M60 44v12M340 44v12M372 80V420M366 80h12M366 420h12"/>' +
    '</g><g class="bp-labels"><text x="96" y="170">LIVING</text><text x="236" y="210">KITCHEN</text><text x="104" y="300">BED</text><text x="214" y="380">BATH</text><text x="292" y="380">ENTRY</text></g>';
  function mount(el) {
    var st = el.getAttribute('data-stroke') || '#FFD07B', gr = el.getAttribute('data-grid') || '#2a3a55';
    el.style.background = el.getAttribute('data-bg') || '#101826';
    el.innerHTML = '<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true">' + PLAN + '</svg>';
    var g = el.querySelector('.bp-grid'), h = '';
    for (var x = 0; x <= 400; x += 20) h += '<path d="M' + x + ' 0V500"/>';
    for (var y = 0; y <= 500; y += 20) h += '<path d="M0 ' + y + 'H400"/>';
    g.innerHTML = h; g.setAttribute('stroke', gr); g.setAttribute('stroke-width', '1');
    var paths = [].slice.call(el.querySelectorAll('.bp-lines path')), L = [];
    paths.forEach(function (p) {
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', st);
      p.setAttribute('stroke-width', p.classList.contains('w') ? 5 : p.classList.contains('t') ? 1 : 2.2);
      if (p.classList.contains('t')) p.setAttribute('opacity', '.7');
      var l = p.getTotalLength(); L.push(l); p.style.strokeDasharray = l; p.style.strokeDashoffset = l;
    });
    var labels = el.querySelector('.bp-labels');
    labels.setAttribute('fill', st); labels.setAttribute('style', 'font:700 11px Manrope,sans-serif;letter-spacing:.14em;opacity:0;transition:opacity .4s');
    function set(p) { paths.forEach(function (e, i) { e.style.strokeDashoffset = L[i] * (1 - p); }); labels.style.opacity = p > 0.85 ? 1 : 0; }
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) set(1);
    else if (el.hasAttribute('data-auto') && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return; io.disconnect();
        var t0 = performance.now();
        (function f(t) { var p = Math.min(1, (t - t0) / 1800); set(1 - Math.pow(1 - p, 3)); if (p < 1) requestAnimationFrame(f); })(t0);
      }, { threshold: 0.4 });
      io.observe(el);
    }
    return { set: set };
  }
  window.FBBlueprint = { mount: mount };
  function auto() { document.querySelectorAll('[data-blueprint]').forEach(function (el) { el.__bp = mount(el); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
