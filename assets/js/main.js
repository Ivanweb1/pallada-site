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
  window.addEventListener('load', setZoom);
  window.addEventListener('orientationchange', setZoom);
  // ширина окна может измениться и без события resize (эмуляция, зум, скроллбар)
  if (window.ResizeObserver) {
    new ResizeObserver(setZoom).observe(document.documentElement);
  }

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

  /* ---- Лента кадров: прокрутка стрелками по одному снимку ---- */
  var sliderUpdates = [];

  Array.prototype.forEach.call(document.querySelectorAll('.js-slider'), function (slider) {
    var track = slider.querySelector('.js-slider-track');
    var prev = slider.querySelector('.js-slider-prev');
    var next = slider.querySelector('.js-slider-next');
    if (!track || !prev || !next) return;

    function update() {
      var max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 1;
      next.disabled = max <= 1 || track.scrollLeft >= max - 1;
    }

    /* ближайший кадр, который сейчас не стоит у левого края.
       Макет масштабируется через body { zoom }, поэтому экранные координаты
       переводим обратно в CSS-пиксели — в них считается scrollLeft. */
    function step(dir) {
      var box = track.getBoundingClientRect();
      var scale = track.clientWidth ? box.width / track.clientWidth : 1;
      var figures = Array.prototype.slice.call(track.children);
      if (dir < 0) figures.reverse();

      var target = track.scrollLeft;
      for (var i = 0; i < figures.length; i++) {
        var left = (figures[i].getBoundingClientRect().left - box.left) / scale + track.scrollLeft;
        if (dir > 0 ? left > track.scrollLeft + 1 : left < track.scrollLeft - 1) {
          target = left;
          break;
        }
      }
      track.scrollTo({ left: target, behavior: 'smooth' });
    }

    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    track.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    sliderUpdates.push(update);
    update();
  });

  /* ---- Этапы работ на странице проекта ---- */
  var stageTabs = document.querySelector('.js-stages-tabs');
  var stagePanels = document.querySelector('.js-stages-panels');
  if (stageTabs && stagePanels) {
    stageTabs.addEventListener('click', function (e) {
      var btn = e.target.closest('.prj-stages__tab');
      if (!btn) return;
      var stage = btn.dataset.stage;
      Array.prototype.forEach.call(stageTabs.children, function (b) {
        b.classList.toggle('is-active', b === btn);
      });
      Array.prototype.forEach.call(stagePanels.children, function (p) {
        p.classList.toggle('is-active', p.dataset.stage === stage);
      });
      /* скрытая панель не имеет ширины — стрелки пересчитываем после показа */
      sliderUpdates.forEach(function (update) { update(); });
    });
  }

  /* ---- Формы: имя выбранного файла и сообщение об отправке ---- */
  Array.prototype.forEach.call(document.querySelectorAll('.js-cform'), function (form) {
    var file = form.querySelector('.js-cform-file');
    var fileName = form.querySelector('.js-cform-filename');
    var done = form.querySelector('.js-cform-done');

    if (file && fileName) {
      file.addEventListener('change', function () {
        fileName.textContent = file.files && file.files[0] ? file.files[0].name : 'Файл не выбран';
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      form.reset();
      if (fileName) fileName.textContent = 'Файл не выбран';
      if (done) done.hidden = false;
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
