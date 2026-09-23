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

  /* ---- Главный слайдер: автосмена раз в 9 секунд и смена по клику ---- */
  var hero = document.querySelector('.js-hero');
  if (hero) {
    var slides = hero.querySelectorAll('.hero__slide');
    if (slides.length > 1) {
      var current = 0;
      var heroTimer;

      function heroNext() {
        slides[current].classList.remove('is-active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('is-active');
      }

      function heroPlay() {
        window.clearInterval(heroTimer);
        heroTimer = window.setInterval(heroNext, 9000);
      }

      /* кнопки под слайдами лежат вне .hero__slides — клик по ним не листает */
      var heroStage = hero.querySelector('.hero__slides');
      if (heroStage) {
        heroStage.addEventListener('click', function () {
          heroNext();
          heroPlay();            // после ручной смены отсчёт начинаем заново
        });
      }

      heroPlay();
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

  /* ---- Формы ----------------------------------------------------------
     На прототипе форма просто показывает «спасибо». На Тильде заявку
     принимает обычный блок с формой Тильды (форма-приёмник): в неё
     подставляются значения и нажимается её же кнопка отправки — так
     заявка уходит туда, куда настроен приёмник данных в проекте.

     Что нужно на странице Тильды:
       1) блок с формой Тильды (T123 не годится — нужна настоящая форма
          с подключённым приёмником данных);
       2) сам блок с версткой — этот код найдёт форму-приёмник сам.
     Форму-приёмник можно не прятать вручную — код уберёт её с глаз. */

  /* форму-приёмник ищем по всей странице: в сборке для Тильды остальные
     обращения к document подменяются на контейнер блока, а она вне его */
  var PAGE = document;

  var FORM = {
    donor: 'form.js-form-proccess',   // форма Тильды на странице
    hideDonor: true,
    timeout: 8000,
    okText: 'Спасибо! Заявка отправлена — мы свяжемся с вами.',
    errText: 'Не удалось отправить заявку. Позвоните нам: 8 (812) 363-49-61'
  };

  /* человеческие подписи полей — с ними заявка читается в письме */
  var FIELD_LABELS = {
    comment: 'Комментарий',
    file: 'Прикреплённый файл'
  };

  function digits(value) {
    var d = String(value || '').replace(/\D/g, '');
    while (d.length > 10 && (d.charAt(0) === '7' || d.charAt(0) === '8')) d = d.slice(1);
    if (d.charAt(0) === '7' || d.charAt(0) === '8') d = d.slice(1);
    return d.slice(0, 10);
  }

  /* форма-приёмник: любая форма Тильды на странице, кроме наших собственных */
  function donorForm() {
    var forms = PAGE.querySelectorAll(FORM.donor);
    for (var i = 0; i < forms.length; i++) {
      /* наши блоки на Тильде завёрнуты в .pallada — приёмник лежит вне их */
      if (!forms[i].closest('.pallada')) return forms[i];
    }
    return null;
  }

  /* приёмник на странице не нужен глазу — уводим его блок за экран */
  function hideDonor(form) {
    if (!FORM.hideDonor) return;
    var rec = form.closest('[id^="rec"]') || form.closest('.r') || form;
    if (rec.dataset.plHidden === '1') return;
    rec.dataset.plHidden = '1';
    rec.style.position = 'absolute';
    rec.style.left = '-9999px';
    rec.style.top = '0';
    rec.style.width = '1px';
    rec.style.height = '1px';
    rec.style.overflow = 'hidden';
    rec.setAttribute('aria-hidden', 'true');
  }

  function hidden(form, name, value) {
    var input = form.querySelector('input[type="hidden"][name="' + name + '"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    input.value = value == null ? '' : String(value);
  }

  /* подбираем поле приёмника по имени или подсказке */
  function findField(form, keys) {
    var all = form.querySelectorAll('input, textarea, select');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.type === 'hidden' || el.type === 'submit') continue;
      var hay = ((el.name || '') + ' ' + (el.placeholder || '')).toLowerCase();
      for (var k = 0; k < keys.length; k++) {
        if (hay.indexOf(keys[k]) !== -1) return el;
      }
    }
    return null;
  }

  /* телефон в Тильде живёт в поле с маской, а в приёмник уходит из скрытого */
  function fillPhone(form, value) {
    var visible = form.querySelector('.t-input-phonemask, [name^="tildaspec-phone-part"]:not([type="hidden"])');
    if (!visible) return false;

    var result = form.querySelector('.js-phonemask-result, input[type="hidden"][name="Phone"]');
    var only = digits(value);

    if (only.length < 10) {           // номер не наш — отдаём как есть
      visible.value = String(value || '').trim();
      if (result) result.value = visible.value;
      return true;
    }

    var mask = visible.getAttribute('data-phonemask-without-code') || '(000) 000-00-00';
    var code = visible.getAttribute('data-phonemask-code');
    if (!code) {
      var select = form.querySelector('.t-input-phonemask__select-code');
      code = (select && select.textContent.trim()) || '+7';
    }

    var out = '', pos = 0;
    for (var i = 0; i < mask.length && pos < only.length; i++) {
      out += mask.charAt(i) === '0' ? only.charAt(pos++) : mask.charAt(i);
    }

    visible.value = out;
    visible.dispatchEvent(new Event('input', { bubbles: true }));
    visible.value = out;
    if (result) {
      result.value = code + ' ' + out;
      result.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  function fillDonor(form, data) {
    if (data.phone && fillPhone(form, data.phone)) data.phone = '';

    var map = {
      name: ['name', 'имя', 'fio'],
      phone: ['phone', 'tel', 'телефон'],
      email: ['email', 'mail', 'почта']
    };

    ['name', 'phone', 'email'].forEach(function (key) {
      if (!data[key]) return;
      var field = findField(form, map[key]);
      if (field) {
        field.value = data[key];
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        hidden(form, key.charAt(0).toUpperCase() + key.slice(1), data[key]);
      }
    });

    hidden(form, 'Форма', data.formName || 'Заявка с сайта');
    hidden(form, 'Страница', document.title + ' — ' + location.pathname);
    if (data.details) hidden(form, 'Детали', data.details);

    /* незаполненные обязательные поля приёмника не дадут ему отправиться */
    Array.prototype.forEach.call(form.querySelectorAll('[required], .js-tilda-rule'), function (el) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (!el.checked) {
          el.checked = true;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else if (!el.value) {
        el.value = el.type === 'email' ? 'no-reply@pallada-afina.ru' : '—';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function donorError(form) {
    var box = form.querySelector('.js-rule-error-all, .js-errorbox-all');
    return (box ? box.textContent.trim() : '') || 'причина не указана';
  }

  /* отправка через форму Тильды: заполняем и жмём её кнопку */
  function sendToTilda(data) {
    var form = donorForm();

    if (!form) {                      // прототип без Тильды — показываем «спасибо»
      console.warn('[pallada] Формы Тильды на странице нет — заявка никуда не ушла. ' +
                   'Добавьте на страницу блок с формой Тильды и подключите приёмник данных.');
      return Promise.resolve();
    }

    hideDonor(form);

    return new Promise(function (resolve, reject) {
      fillDonor(form, data);

      var submit = form.querySelector('[type="submit"]');
      if (!submit) {
        reject(new Error('В форме Тильды нет кнопки отправки'));
        return;
      }

      var settled = false;
      var timer;

      function stopNative(e) { if (e.target === form) e.preventDefault(); }

      function off() {
        form.removeEventListener('tildaform:aftersuccess', ok);
        form.removeEventListener('tildaform:aftererror', fail);
        document.removeEventListener('submit', stopNative, true);
        window.clearTimeout(timer);
      }

      function ok() { if (!settled) { settled = true; off(); resolve(); } }
      function fail(text) {
        if (settled) return;
        settled = true;
        off();
        console.error('[pallada] ' + text, form);
        reject(new Error(text));
      }

      document.addEventListener('submit', stopNative, true);
      form.addEventListener('tildaform:aftersuccess', ok);
      form.addEventListener('tildaform:aftererror', function () {
        fail('Тильда сообщила об ошибке: ' + donorError(form));
      });

      form.removeAttribute('data-success-popup');   // окно «спасибо» от Тильды не нужно
      submit.tildaSendingStatus = '';
      submit.click();

      /* Тильда помечает кнопку статусом сразу: 1 — отправляет,
         0 — не прошла её проверка, пусто — скрипт форм не подключён */
      window.setTimeout(function () {
        if (settled) return;
        var status = submit.tildaSendingStatus;
        if (status === '1') return;
        if (status === '0') fail('Тильда отказалась отправлять форму: ' + donorError(form));
        else fail('Форма-приёмник найдена, но её не обслуживает Тильда — ' +
                  'проверьте, что страница опубликована и в блоке формы подключён приёмник данных.');
      }, 60);

      timer = window.setTimeout(ok, FORM.timeout);
    });
  }

  /* ---- Телефон в формах: +7 появляется сразу и цифры встают в маску ---- */

  function phoneDigits(value) {
    var d = String(value || '').replace(/\D/g, '');
    while (d.length > 10 && (d.charAt(0) === '7' || d.charAt(0) === '8')) d = d.slice(1);
    if (d.charAt(0) === '7' || d.charAt(0) === '8') d = d.slice(1);
    return d.slice(0, 10);
  }

  function phoneFormat(d) {
    if (!d) return '+7 ';
    var out = '+7 (' + d.slice(0, 3);
    if (d.length > 3) out += ') ' + d.slice(3, 6);
    if (d.length > 6) out += '-' + d.slice(6, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    return out;
  }

  Array.prototype.forEach.call(document.querySelectorAll('.js-cform input[type="tel"]'), function (input) {
    input.addEventListener('focus', function () {
      if (!input.value) input.value = '+7 ';
    });

    input.addEventListener('input', function () {
      input.value = phoneFormat(phoneDigits(input.value));
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
    });

    /* ушли из пустого поля — не оставляем одинокий код страны */
    input.addEventListener('blur', function () {
      if (!phoneDigits(input.value)) input.value = '';
    });
  });

  /* ссылка на политику лежит внутри подписи к чекбоксу: клик по ней
     не должен переключать согласие */
  Array.prototype.forEach.call(document.querySelectorAll('.cform__agree a'), function (link) {
    link.addEventListener('click', function (e) { e.stopPropagation(); });
  });

  /* ---- Формы: имя выбранного файла, отправка, сообщение ---- */
  Array.prototype.forEach.call(document.querySelectorAll('.js-cform'), function (form) {
    var file = form.querySelector('.js-cform-file');
    var fileName = form.querySelector('.js-cform-filename');
    var done = form.querySelector('.js-cform-done');
    var submit = form.querySelector('[type="submit"]');

    if (file && fileName) {
      file.addEventListener('change', function () {
        fileName.textContent = file.files && file.files[0] ? file.files[0].name : 'Файл не выбран';
      });
    }

    function message(text, isError) {
      if (!done) return;
      done.textContent = text;
      done.classList.toggle('cform__done--error', !!isError);
      done.hidden = false;
    }

    /* собираем заявку: имя, телефон и почта — отдельно, остальное в «Детали» */
    function collect() {
      var data = { formName: form.dataset.formName || 'Заявка с сайта' };
      var details = [];

      Array.prototype.forEach.call(form.querySelectorAll('input, textarea, select'), function (el) {
        if (!el.name || el.type === 'submit' || el.type === 'checkbox') return;
        if (el.type === 'file') {
          if (el.files && el.files[0]) details.push(FIELD_LABELS.file + ': ' + el.files[0].name);
          return;
        }
        var value = (el.value || '').trim();
        if (!value) return;
        var key = el.name.toLowerCase();
        if (key === 'name' || key === 'phone' || key === 'email') data[key] = value;
        else details.push((FIELD_LABELS[key] || el.name) + ': ' + value);
      });

      if (details.length) data.details = details.join('\n');
      return data;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.dataset.sending === '1') return;
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var label = submit ? submit.innerHTML : '';
      form.dataset.sending = '1';
      if (submit) { submit.disabled = true; submit.textContent = 'Отправляем…'; }

      sendToTilda(collect()).then(function () {
        form.reset();
        if (fileName) fileName.textContent = 'Файл не выбран';
        message(FORM.okText, false);
      }, function () {
        message(FORM.errText, true);
      }).then(function () {
        form.dataset.sending = '';
        if (submit) { submit.disabled = false; submit.innerHTML = label; }
      });
    });
  });

  /* приёмник прячем сразу, а не в момент отправки: блок формы Тильды
     на странице не нужен глазу. Блоки Тильды появляются не мгновенно,
     поэтому пробуем несколько раз. */
  if (document.querySelectorAll('.js-cform').length) {
    [0, 400, 1600].forEach(function (delay) {
      window.setTimeout(function () {
        var form = donorForm();
        if (form) hideDonor(form);
      }, delay);
    });
  }

  /* ---- Просмотр кадров проекта во весь экран ---- */

  /* Куда класть оверлеи. На прототипе — в body, в сборке для Тильды
     сборщик подменяет это на контейнер блока: вне него стили лайтбокса
     не действуют, и он открывался бы голой разметкой. */
  var OVERLAY_HOST = document.body;
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
      OVERLAY_HOST.appendChild(lbox);

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
