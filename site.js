(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    // Theme: light unless the visitor chose dark
    var toggle = document.querySelector('.theme');
    function setTheme(t) {
      if (t === 'dark') root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
      if (toggle) {
        toggle.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
        toggle.setAttribute('aria-label', t === 'dark' ? 'Светлая тема' : 'Тёмная тема');
      }
      // Stills of the live prototypes have a dark version; an opened prototype is told to switch too
      document.querySelectorAll('img[data-dark]').forEach(function (img) {
        if (!img.dataset.light) img.dataset.light = img.getAttribute('src');
        var src = t === 'dark' ? img.dataset.dark : img.dataset.light;
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      });
      document.querySelectorAll('.live__frame iframe').forEach(function (f) {
        try { f.contentWindow.postMessage({ planTheme: t }, '*'); } catch (e) {}
      });
    }
    setTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    if (toggle) toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setTheme(next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });

    // Stage: show the picture that belongs to the part being read
    var shots = {};
    document.querySelectorAll('.stage__shot').forEach(function (f) { shots[f.getAttribute('data-id')] = f; });
    var cap = document.querySelector('.stage__cap');
    var current = null;
    function show(id) {
      if (!shots[id] || id === current) return;
      if (current && shots[current]) shots[current].classList.remove('is-on');
      shots[id].classList.add('is-on');
      var img = shots[id].querySelector('img');
      if (img && img.loading === 'lazy') img.loading = 'eager';
      if (cap) cap.textContent = shots[id].getAttribute('data-cap') || '';
      current = id;
    }
    var first = document.querySelector('.stage__shot.is-on');
    if (first) { current = first.getAttribute('data-id'); if (cap) cap.textContent = first.getAttribute('data-cap') || ''; }
    if ('IntersectionObserver' in window) {
      var marks = document.querySelectorAll('.read [data-shot]');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) show(e.target.getAttribute('data-shot')); });
      }, { rootMargin: '-45% 0px -50% 0px' });
      marks.forEach(function (m) { io.observe(m); });
    }
    // Hover and focus on the project list drive the stage too
    document.querySelectorAll('[data-hover-shot]').forEach(function (el) {
      var id = el.getAttribute('data-hover-shot');
      el.addEventListener('mouseenter', function () { show(id); });
      el.addEventListener('focus', function () { show(id); });
    });

    // Entrance for the parts of each section
    if (!reduce && 'IntersectionObserver' in window) {
      root.classList.add('js');
      var parts = document.querySelectorAll('.rise');
      var seen = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var sib = Array.prototype.indexOf.call(e.target.parentNode.children, e.target);
          e.target.style.transitionDelay = Math.min(sib, 4) * 70 + 'ms';
          e.target.classList.add('is-in');
          seen.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      parts.forEach(function (p) { seen.observe(p); });
    }

    // Copy email
    var copy = document.getElementById('copy');
    if (copy) copy.addEventListener('click', function () {
      var mail = document.getElementById('mail');
      var label = copy.querySelector('.copy__label');
      function say(t) { if (label) label.textContent = t; setTimeout(function () { if (label) label.textContent = 'Скопировать адрес'; }, 2200); }
      function fallback() {
        var r = document.createRange(); r.selectNodeContents(mail);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        say('Выделено, нажмите ⌘C');
      }
      try { navigator.clipboard.writeText(mail.textContent.trim()).then(function () { say('Скопировано'); }, fallback); } catch (e) { fallback(); }
    });

    // How I work: one slider drives the clause and the interface
    var range = document.getElementById('way');
    if (range) {
      var ways = document.querySelectorAll('[data-way]');
      var names = document.querySelectorAll('.ways__names li');
      function setWay(i) {
        ways.forEach(function (w) { w.classList.toggle('is-on', w.getAttribute('data-way') === String(i)); });
        names.forEach(function (n, k) { n.classList.toggle('is-on', k === +i); });
        range.setAttribute('aria-valuetext', names[i] ? names[i].textContent : '');
      }
      range.addEventListener('input', function () { setWay(range.value); });
      names.forEach(function (n, k) { n.querySelector('button').addEventListener('click', function () { range.value = k; setWay(k); }); });
      setWay(range.value);
    }
    // Colour drop on the portrait: the blob trails the cursor a little, like a drop spreading
    var pic = document.querySelector('[data-drop]');
    if (pic && window.matchMedia('(hover: hover)').matches) {
      var pos = [50, 40], aim = [50, 40], loop = 0;
      function step() {
        pos[0] += (aim[0] - pos[0]) * (reduce ? 1 : 0.12); pos[1] += (aim[1] - pos[1]) * (reduce ? 1 : 0.12);
        pic.style.setProperty('--x', pos[0] + '%'); pic.style.setProperty('--y', pos[1] + '%');
        loop = (Math.abs(aim[0] - pos[0]) + Math.abs(aim[1] - pos[1]) > 0.1) ? requestAnimationFrame(step) : 0;
      }
      pic.addEventListener('pointermove', function (e) {
        var b = pic.getBoundingClientRect();
        aim = [(e.clientX - b.left) / b.width * 100, (e.clientY - b.top) / b.height * 100];
        if (!loop) loop = requestAnimationFrame(step);
      });
      pic.addEventListener('pointerenter', function (e) {
        var b = pic.getBoundingClientRect();
        pos = aim = [(e.clientX - b.left) / b.width * 100, (e.clientY - b.top) / b.height * 100];
        step(); pic.classList.add('is-wet');
      });
      pic.addEventListener('pointerleave', function () { pic.classList.remove('is-wet'); });
    }
  }

  // 09.11 alen: no background music on the site
  function markSound() {}

  // Navigation between the site's own pages swaps the page in place instead of reloading. Anything unusual falls back to a normal page load.
  // Opening a case: the clicked card grows to fill the screen, the case is swapped in underneath,
  // then the sheet lifts away and the cover title rises out of a mask.
  function grow(from) {
    if (reduce || !document.body.animate) return Promise.resolve(null);
    var r = from ? from.getBoundingClientRect() : { top: window.innerHeight, left: 0, width: window.innerWidth, height: 0 };
    var sheet = document.createElement('div');
    sheet.className = 'sheet';
    document.body.appendChild(sheet);
    var vw = window.innerWidth, vh = window.innerHeight;
    var anim = sheet.animate([
      { clipPath: 'inset(' + r.top + 'px ' + (vw - r.left - r.width) + 'px ' + (vh - r.top - r.height) + 'px ' + r.left + 'px round 20px)' },
      { clipPath: 'inset(0px 0px 0px 0px round 0px)' }
    ], { duration: 650, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
    return anim.finished.then(function () { return sheet; });
  }
  function lift(sheet) {
    if (!sheet) return;
    sheet.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], { duration: 700, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' })
      .finished.then(function () { sheet.remove(); });
  }
  function enter() {
    if (reduce) return;
    root.classList.add('is-entering');
    setTimeout(function () { root.classList.remove('is-entering'); }, 1600);
  }
  function swap(url, push, from) {
    var page = Promise.all([
      fetch(url, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }),
      push ? grow(from) : Promise.resolve(null)
    ]);
    page.then(function (got) {
      var html = got[0], sheet = got[1];
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var next = doc.querySelector('.page');
      if (!next) throw new Error('no page');
      document.title = doc.title;
      document.querySelectorAll('head style').forEach(function (s) { s.remove(); });
      doc.querySelectorAll('style').forEach(function (s) { document.head.appendChild(s.cloneNode(true)); });
      var old = document.querySelector('.page');
      old.parentNode.replaceChild(document.importNode(next, true), old);
      if (push) history.pushState({}, '', url);
      shown = location.pathname;
      var hash = url.split('#')[1];
      var target = hash && document.getElementById(hash);
      if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
      init();
      if (window.silkInit) window.silkInit();
      if (window.particlesInit) window.particlesInit();
      markSound();
      if (document.querySelector('.cover')) enter();
      lift(sheet);
    }).catch(function () { location.href = url; });
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    var href = a.getAttribute('href');
    if (!/^[\w-]+\.html(#[\w-]*)?$/.test(href)) return;
    var here = location.pathname.split('/').pop() || 'index.html';
    if (href.split('#')[0] === here && href.indexOf('#') > -1) return;
    e.preventDefault();
    swap(a.href, true, a.closest('.card, .next') || null);
  });
  // A jump to an anchor on the same page also fires popstate: only a change of page needs a swap
  var shown = location.pathname;
  window.addEventListener('popstate', function () { if (location.pathname !== shown) swap(location.href, false); });

  // Live prototype: on wide screens it replaces the still in place, on phones it opens in a new tab
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-live]');
    if (!a || window.innerWidth < 900) return;
    e.preventDefault();
    var box = a.closest('.live__frame');
    var f = document.createElement('iframe');
    f.src = a.getAttribute('href') + '&theme=' + (root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    f.title = a.getAttribute('data-live') || 'Интерактивный прототип';
    box.querySelector('img').replaceWith(f);
    box.classList.add('is-live');
    f.focus();
  });

  // Explainer slides: arrows scroll the row, the caption and counter follow the visible slide
  function explainSync(t) {
    var fig = t.closest('.explain'), n = t.children.length, i = Math.round(t.scrollLeft / t.clientWidth);
    var cap = fig.querySelector('.explain__cap'), caps = cap.dataset.caps.split('|');
    cap.textContent = caps[i] || '';
    fig.querySelector('.explain__count').textContent = (i + 1) + ' / ' + n;
    var b = fig.querySelectorAll('.explain__btn'); b[0].disabled = i <= 0; b[1].disabled = i >= n - 1;
  }
  document.addEventListener('click', function (e) {
    var open = e.target.closest && e.target.closest('.explain__slide a');
    if (open) { var shown = [].filter.call(open.querySelectorAll('img'), function (i) { return i.offsetWidth; })[0]; if (shown) open.href = shown.getAttribute('src'); return; }
    var btn = e.target.closest && e.target.closest('.explain__btn');
    if (!btn) return;
    var t = btn.closest('.explain').querySelector('.explain__track');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    t.scrollBy({left: t.clientWidth * +btn.dataset.dir, behavior: reduce ? 'auto' : 'smooth'});
  });
  document.addEventListener('scroll', function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains('explain__track')) explainSync(t);
  }, true);

  if (document.querySelector('.cover')) enter();
  init();
})();
