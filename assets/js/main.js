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

  /* ---- Мобильное меню ---- */
  var burger = document.querySelector('.js-burger');
  var headerEl = document.querySelector('.header');

  if (burger && headerEl) {
    var menu = document.getElementById(burger.getAttribute('aria-controls'));

    function menuSet(open) {
      headerEl.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('is-menu-open', open);
    }

    burger.addEventListener('click', function () {
      menuSet(!headerEl.classList.contains('is-open'));
    });

    /* переход по ссылке (в том числе к якорю на этой же странице) закрывает меню */
    if (menu) {
      menu.addEventListener('click', function (e) {
        if (e.target.closest('a')) menuSet(false);
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && headerEl.classList.contains('is-open')) menuSet(false);
    });

    /* вернулись на десктоп — панель меню там не нужна */
    window.addEventListener('resize', function () {
      if (document.documentElement.clientWidth >= 1200 && headerEl.classList.contains('is-open')) {
        menuSet(false);
      }
    });
  }

  /* ---- Главный слайдер: автосмена раз в 9 секунд ---- */
  var hero = document.querySelector('.js-hero');
  if (hero) {
    var slides = hero.querySelectorAll('.hero__slide');
    if (slides.length > 1) {
      var current = 0;
      setInterval(function () {
        slides[current].classList.remove('is-active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('is-active');
      }, 9000);
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
      /* offsetWidth — в CSS-пикселях, как и transform ниже: getBoundingClientRect
         вернул бы ширину с учётом body { zoom }, и шаг уезжал бы за карточку */
      return first.offsetWidth + gap;
    }

    function maxOffset() {
      var cs = getComputedStyle(viewport);
      var avail = viewport.clientWidth
        - (parseFloat(cs.paddingLeft) || 0)
        - (parseFloat(cs.paddingRight) || 0);
      return Math.max(0, track.scrollWidth - avail);
    }

    function apply() {
      /* в адаптиве (ниже 1200) лента листается пальцем — нативной прокруткой
         вьюпорта, а стрелки скрыты. Сдвиг снимаем, иначе он сложился бы
         с прокруткой и лента уехала бы за край. */
      if (document.documentElement.clientWidth < 1200) {
        offset = 0;
        track.style.transform = '';
        return;
      }
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

  /* ---- Точки под лентой, которая листается пальцем ---- */
  function initDots(dotsSel, viewportSel, trackSel) {
    var dots = document.querySelector(dotsSel);
    var viewport = document.querySelector(viewportSel);
    var track = document.querySelector(trackSel);
    if (!dots || !viewport || !track) return;

    var cards = track.children;
    if (cards.length < 2) return;

    for (var i = 0; i < cards.length; i++) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', 'Публикация ' + (i + 1));
      dot.dataset.index = i;
      dots.appendChild(dot);
    }

    function step() {
      var gap = parseInt(getComputedStyle(track).columnGap || getComputedStyle(track).gap, 10) || 0;
      return cards[0].offsetWidth + gap;
    }

    function sync() {
      /* на широком экране лента едет трансформом и не прокручивается —
         тогда активной считаем позицию трека, а не scrollLeft */
      var current = Math.round(viewport.scrollLeft / step());
      for (var i = 0; i < dots.children.length; i++) {
        dots.children[i].classList.toggle('is-active', i === current);
      }
    }

    dots.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      viewport.scrollTo({ left: btn.dataset.index * step(), behavior: 'smooth' });
    });

    viewport.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  initDots('.js-media-dots', '.media-pubs__viewport', '.js-media-track');

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
  var stageArrowUpdates = [];

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

    /* Своя прокрутка вместо scrollTo({ behavior: 'smooth' }): у ленты
       scroll-snap-type: x mandatory, и браузер доснапывает кадр уже поверх
       нативной анимации — шаг выходит рывками и иногда не доезжает.
       На время анимации снап выключаем, после — возвращаем. */
    var anim = 0;

    function scrollTo(target) {
      if (anim) { cancelAnimationFrame(anim); anim = 0; }
      var from = track.scrollLeft;
      var dist = target - from;
      if (Math.abs(dist) < 1) return;

      /* во вкладке без отрисовки requestAnimationFrame не вызывается —
         там просто становимся на место */
      if (document.hidden) { track.scrollLeft = target; update(); return; }

      var snap = track.style.scrollSnapType;
      track.style.scrollSnapType = 'none';
      var start = performance.now();
      var dur = 380;

      anim = requestAnimationFrame(function frame(now) {
        var k = Math.min(1, (now - start) / dur);
        var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        track.scrollLeft = from + dist * e;
        if (k < 1) {
          anim = requestAnimationFrame(frame);
        } else {
          anim = 0;
          track.style.scrollSnapType = snap;
          update();
        }
      });
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
      scrollTo(target);
    }

    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    track.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    sliderUpdates.push(update);
    update();
  });

  /* ---- Стрелки для лент, свёрстанных без них ----
     Панель-слайдер несёт свои стрелки в разметке, а обычная панель их
     не имела: на десктопе кадры просто стояли в ряд. В адаптиве такая
     панель сама стала лентой, поэтому пару стрелок добавляем на контейнер
     панелей — они листают ту, что открыта. */
  Array.prototype.forEach.call(document.querySelectorAll('.prj-stages__panels'), function (panels) {
    var plain = panels.querySelectorAll('.prj-stages__panel:not(.prj-stages__panel--slider)');
    if (!plain.length) return;

    function arrow(dir, label, path) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'prj-stages__arrow prj-stages__arrow--' + dir + ' prj-stages__arrow--plain';
      b.setAttribute('aria-label', label);
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
        '<path d="' + path + '"/></svg>';
      return b;
    }

    /* тот же шеврон, что у остальных стрелок сайта: поворот задаёт CSS */
    var prev = arrow('prev', 'Предыдущий кадр', 'M6 9l6 6 6-6');
    var next = arrow('next', 'Следующий кадр', 'M6 9l6 6 6-6');
    panels.appendChild(prev);
    panels.appendChild(next);

    function active() {
      var el = panels.querySelector('.prj-stages__panel.is-active');
      /* у слайдерной панели стрелки свои — наши на ней не нужны */
      return el && el.classList.contains('prj-stages__panel--slider') ? null : el;
    }

    function update() {
      var el = active();
      var scrolls = el && el.scrollWidth - el.clientWidth > 1;
      prev.hidden = next.hidden = !scrolls;
      if (!scrolls) return;
      prev.disabled = el.scrollLeft <= 1;
      next.disabled = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
    }

    function step(dir) {
      var el = active();
      if (!el) return;
      el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
    }

    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });

    Array.prototype.forEach.call(plain, function (el) {
      el.addEventListener('scroll', update);
    });

    window.addEventListener('resize', update);
    panels.addEventListener('click', function (e) { if (!e.target.closest('.prj-stages__arrow')) update(); });
    stageArrowUpdates.push(update);
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
      stageArrowUpdates.forEach(function (update) { update(); });
    });
  }

  /* ---- Биография в модальном окне ---- */
  var bioOpeners = document.querySelectorAll('.js-bio-open');
  if (bioOpeners.length) {
    var openedFrom = null;

    function bioClose(modal) {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (openedFrom) { openedFrom.focus(); openedFrom = null; }
    }

    Array.prototype.forEach.call(bioOpeners, function (btn) {
      var modal = document.getElementById(btn.getAttribute('aria-controls'));
      if (!modal) return;

      btn.addEventListener('click', function () {
        openedFrom = btn;
        modal.hidden = false;
        /* страница под окном не должна прокручиваться вместе с ним */
        document.body.style.overflow = 'hidden';
        modal.querySelector('.modal__scroll').scrollTop = 0;
        var close = modal.querySelector('.modal__close');
        if (close) close.focus();
      });

      modal.addEventListener('click', function (e) {
        if (e.target.closest('.js-bio-close')) bioClose(modal);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = document.querySelector('.modal:not([hidden])');
      if (open) bioClose(open);
    });
  }

  /* ---- Уведомление о cookie ---- */
  var cookieBar = document.querySelector('.js-cookie');

  if (cookieBar) {
    var KEY = 'pallada-cookie-ok';
    var agreed = false;

    /* в приватном окне доступ к localStorage бросает исключение —
       тогда просто показываем плашку каждый раз */
    try { agreed = localStorage.getItem(KEY) === '1'; } catch (e) {}

    if (!agreed) {
      cookieBar.hidden = false;

      cookieBar.querySelector('.js-cookie-ok').addEventListener('click', function () {
        cookieBar.hidden = true;
        try { localStorage.setItem(KEY, '1'); } catch (e) {}
      });
    }
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

  /* ---- Просмотр кадров проекта во весь экран ---- */
  var shots = Array.prototype.slice.call(
    document.querySelectorAll(
      '.prj-head__cover figure img, .prj-stages__panel figure img, .cmp-licenses__doc img'
    )
  );

  if (shots.length) {
    var lbox = null;
    var lcurrent = 0;
    var lOpenedFrom = null;

    function lboxBuild() {
      lbox = document.createElement('div');
      lbox.className = 'lightbox';
      lbox.hidden = true;
      lbox.innerHTML =
        '<button class="lightbox__close" type="button" aria-label="Закрыть">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
            '<path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
        '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Предыдущий кадр">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
            '<path d="M6 9l6 6 6-6"/></svg>' +
        '</button>' +
        '<figure class="lightbox__figure">' +
          '<img class="lightbox__img" alt="">' +
          '<figcaption class="lightbox__caption"></figcaption>' +
        '</figure>' +
        '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Следующий кадр">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
            '<path d="M6 9l6 6 6-6"/></svg>' +
        '</button>';
      document.body.appendChild(lbox);

      lbox.addEventListener('click', function (e) {
        if (e.target.closest('.lightbox__close') || e.target === lbox) lboxClose();
        else if (e.target.closest('.lightbox__nav--prev')) lboxShow(lcurrent - 1);
        else if (e.target.closest('.lightbox__nav--next')) lboxShow(lcurrent + 1);
      });
    }

    function lboxShow(i) {
      lcurrent = (i + shots.length) % shots.length;
      var src = shots[lcurrent];
      var img = lbox.querySelector('.lightbox__img');
      /* у сканов документов в карточке лежит миниатюра, а в data-full —
         версия, на которой читается текст */
      img.src = src.dataset.full || src.currentSrc || src.src;
      img.alt = src.alt || '';

      /* подпись берём у кадра на странице, если она есть */
      var fig = src.closest('figure');
      var cap = fig && fig.querySelector('figcaption');
      var capEl = lbox.querySelector('.lightbox__caption');
      capEl.textContent = cap ? cap.textContent.trim() : '';
      capEl.hidden = !capEl.textContent;

      var many = shots.length > 1;
      lbox.querySelector('.lightbox__nav--prev').hidden = !many;
      lbox.querySelector('.lightbox__nav--next').hidden = !many;
    }

    function lboxOpen(i, from) {
      if (!lbox) lboxBuild();
      lOpenedFrom = from || null;
      lboxShow(i);
      lbox.hidden = false;
      document.body.classList.add('is-lightbox-open');
      lbox.querySelector('.lightbox__close').focus();
    }

    function lboxClose() {
      lbox.hidden = true;
      document.body.classList.remove('is-lightbox-open');
      if (lOpenedFrom) { lOpenedFrom.focus(); lOpenedFrom = null; }
    }

    shots.forEach(function (img, i) {
      var fig = img.closest('figure');
      var holder = fig || img;
      holder.classList.add('is-zoomable');
      holder.setAttribute('tabindex', '0');
      holder.setAttribute('role', 'button');
      holder.setAttribute('aria-label', 'Открыть кадр во весь экран');

      holder.addEventListener('click', function () { lboxOpen(i, holder); });
      holder.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lboxOpen(i, holder); }
      });
    });

    document.addEventListener('keydown', function (e) {
      if (!lbox || lbox.hidden) return;
      if (e.key === 'Escape') lboxClose();
      else if (e.key === 'ArrowLeft') lboxShow(lcurrent - 1);
      else if (e.key === 'ArrowRight') lboxShow(lcurrent + 1);
    });
  }

  /* ---- Фильтры портфолио ---- */
  var filters = document.querySelectorAll('.js-pf-filter');
  var pfGrid = document.querySelector('.js-pf-grid');
  var pfEmpty = document.querySelector('.js-pf-empty');

  if (filters.length && pfGrid) {
    var pfItems = pfGrid.querySelectorAll('.pf-item');

    Array.prototype.forEach.call(filters, function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(filters, function (b) {
          b.classList.toggle('is-active', b === btn);
        });

        var want = btn.dataset.filter;
        var shown = 0;

        Array.prototype.forEach.call(pfItems, function (item) {
          var cats = (item.dataset.cat || '').split(/\s+/);
          var show = want === 'all' || cats.indexOf(want) !== -1;
          item.classList.toggle('is-hidden', !show);
          if (show) shown++;
        });

        if (pfEmpty) pfEmpty.hidden = shown > 0;
      });
    });

    /* со страницы направления приходят с готовым фильтром: portfolio.html?filter=tile.
       Нажимаем нужную кнопку, когда обработчики уже навешены. */
    var wanted = new URLSearchParams(location.search).get('filter');
    if (wanted) {
      Array.prototype.forEach.call(filters, function (b) {
        if (b.dataset.filter === wanted) b.click();
      });
    }
  }
})();
