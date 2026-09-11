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
/* September B generated additions */
(function(){const handlers={b1:function(event){openDrawer();return false},
b2:function(event){toggleMnav()},
b3:function(event){toggleMnav(false);openDrawer();return false},
b4:function(event){openDrawer()},
b5:function(event){closeDrawer()},
b6:function(event){if(event.key==='Enter')send()},
b7:function(event){send()},
b8:function(event){location.href='/solutions/training'},
b9:function(event){location.href='/solutions/fde'},
b10:function(event){location.href='/solutions/consulting'},
b11:function(event){location.href='/solutions/eco'},
b12:function(event){location.href='/solutions/overseas'},
b18:function(event){location.href='/solutions/hcvm'},
b13:function(event){this.style.display='none';this.nextElementSibling.style.display='flex'},
b14:function(event){return submitForm(event)}};
document.addEventListener('click',function(event){const el=event.target.closest?.('[data-evt-click]');if(!el)return;const fn=handlers[el.getAttribute('data-evt-click')];if(fn&&fn.call(el,event)===false)event.preventDefault();},false);
document.addEventListener('keydown',function(event){const el=event.target.closest?.('[data-evt-keydown]');if(!el)return;const fn=handlers[el.getAttribute('data-evt-keydown')];if(fn&&fn.call(el,event)===false)event.preventDefault();},false);
document.addEventListener('error',function(event){const el=event.target.closest?.('[data-evt-error]');if(!el)return;const fn=handlers[el.getAttribute('data-evt-error')];if(fn&&fn.call(el,event)===false)event.preventDefault();},true);
document.addEventListener('submit',function(event){const el=event.target.closest?.('[data-evt-submit]');if(!el)return;const fn=handlers[el.getAttribute('data-evt-submit')];if(fn&&fn.call(el,event)===false)event.preventDefault();},false);
})();
