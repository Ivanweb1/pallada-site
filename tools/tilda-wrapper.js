/* Вёрстка «Паллады» внутри блока Тильды.
   Скрипт работает и внутри блока, и подключённый в HTML-код в HEAD сайта:
   в блоке он заводит свой контейнер %(scope)s, в HEAD — все блоки страницы. */
(function () {
  function init(SCOPE) {
    if (!SCOPE || SCOPE.dataset.palladaReady === '1') return;
    SCOPE.dataset.palladaReady = '1';

    function PL_byId(id) { return SCOPE.querySelector('#' + id); }

%(body)s
  }

  function initAll() {
    var blocks = document.querySelectorAll('%(scope)s');
    for (var i = 0; i < blocks.length; i++) init(blocks[i]);
  }

  /* скрипт лежит внутри блока — заводим только его */
  var own = document.currentScript && document.currentScript.closest('%(scope)s');
  if (own) { init(own); return; }

  /* подключён в HEAD: блоки появятся позже — ждём страницу */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
  window.addEventListener('load', initAll);
  window.setTimeout(initAll, 1200);
})();
