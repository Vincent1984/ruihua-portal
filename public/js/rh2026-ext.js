/* 本文件由 scripts/extract-rh2026-assets.js 自动生成：外联化原内联事件（事件委托）。请勿手改。 */
(function () {
  "use strict";
  var H = {
    e1: function (event) { openDrawer(); event.preventDefault(); },
    e2: function (event) { toggleMnav() },
    e3: function (event) { toggleMnav(false);openDrawer(); event.preventDefault(); },
    e4: function (event) { closeCase() },
    e5: function (event) { openDrawer() },
    e6: function (event) { closeDrawer() },
    e7: function (event) { if(event.key==='Enter')send() },
    e8: function (event) { send() },
    e17: function (event) { window.open('/nqoc') },
    e18: function (event) { this.style.display='none';this.nextElementSibling.style.display='flex' },
    e19: function (event) { if(event.key==='Enter')subscribe() },
    e20: function (event) { subscribe() },
    e21: function (event) { return submitForm(event) },
  };
  document.addEventListener('click', function (event) {
    var el = event.target && event.target.closest ? event.target.closest('[data-evt-click]') : null;
    if (!el) return;
    var fn = H[el.getAttribute('data-evt-click')];
    if (fn) fn.call(el, event);
  }, false);
  document.addEventListener('keydown', function (event) {
    var el = event.target && event.target.closest ? event.target.closest('[data-evt-keydown]') : null;
    if (!el) return;
    var fn = H[el.getAttribute('data-evt-keydown')];
    if (fn) fn.call(el, event);
  }, false);
  document.addEventListener('error', function (event) {
    var el = event.target && event.target.closest ? event.target.closest('[data-evt-error]') : null;
    if (!el) return;
    var fn = H[el.getAttribute('data-evt-error')];
    if (fn) fn.call(el, event);
  }, false);
  document.addEventListener('submit', function (event) {
    var el = event.target && event.target.closest ? event.target.closest('[data-evt-submit]') : null;
    if (!el) return;
    var fn = H[el.getAttribute('data-evt-submit')];
    if (fn) fn.call(el, event);
  }, false);
})();
