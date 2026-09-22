/* Простые карусели и слайдер — повторяют поведение оригинала на Tilda */
(function () {
  'use strict';

  /* ---- Масштабирование макета под ширину окна (как Zero Block в Tilda) ---- */
  function setZoom() {
    var w = document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--zoom', w > 1200 ? (w / 1200) : 1);
  }
  setZoom();
  window.addEventListener('resize', setZoom);

  /* ---- Главный слайдер: автосмена раз в 5 секунд ---- */
  var hero = document.querySelector('.js-hero');
  if (hero) {
    var slides = hero.querySelectorAll('.hero__slide');
    if (slides.length > 1) {
      var current = 0;
      setInterval(function () {
        slides[current].classList.remove('is-active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('is-active');
      }, 5000);
    }
  }

  /* ---- Горизонтальные карусели со стрелками ---- */
  function initCarousel(trackSel, prevSel, nextSel) {
    var track = document.querySelector(trackSel);
    var prev = document.querySelector(prevSel);
    var next = document.querySelector(nextSel);
    if (!track || !prev || !next) return;

    var viewport = track.parentElement;
    var offset = 0;

    function step() {
      var first = track.children[0];
      if (!first) return 0;
      var gap = parseInt(getComputedStyle(track).columnGap || getComputedStyle(track).gap, 10) || 0;
      return first.getBoundingClientRect().width + gap;
    }

    function maxOffset() {
      var cs = getComputedStyle(viewport);
      var avail = viewport.clientWidth
        - (parseFloat(cs.paddingLeft) || 0)
        - (parseFloat(cs.paddingRight) || 0);
      return Math.max(0, track.scrollWidth - avail);
    }

    function apply() {
      offset = Math.min(Math.max(offset, 0), maxOffset());
      track.style.transform = 'translate3d(' + -offset + 'px, 0, 0)';
    }

    prev.addEventListener('click', function () { offset -= step(); apply(); });
    next.addEventListener('click', function () { offset += step(); apply(); });
    window.addEventListener('resize', apply);
    apply();
  }

  initCarousel('.js-dir-track', '.js-dir-prev', '.js-dir-next');
  initCarousel('.js-pf-track', '.js-pf-prev', '.js-pf-next');
  initCarousel('.js-team-track', '.js-team-prev', '.js-team-next');
  initCarousel('.js-media-track', '.js-media-prev', '.js-media-next');
  initCarousel('.js-steps-track', '.js-steps-prev', '.js-steps-next');
  initCarousel('.js-gal-track', '.js-gal-prev', '.js-gal-next');

  /* ---- Аккордеон принципов (страница «О компании») ---- */
  var accItems = document.querySelectorAll('.js-acc-item');
  Array.prototype.forEach.call(accItems, function (item) {
    var head = item.querySelector('.acc__head');
    if (!head) return;
    head.addEventListener('click', function () {
      item.classList.toggle('is-open');
    });
  });

  /* ---- Фильтры портфолио ---- */
  var filters = document.querySelectorAll('.js-pf-filter');
  Array.prototype.forEach.call(filters, function (btn) {
    btn.addEventListener('click', function () {
      Array.prototype.forEach.call(filters, function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
    });
  });
})();
