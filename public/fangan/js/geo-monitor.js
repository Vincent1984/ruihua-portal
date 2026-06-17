(function() {
  window.switchDemoTab = function(panelId, btn) {
    var panel = document.getElementById(panelId);
    if (!panel) return;

    document.querySelectorAll('.platform-tab').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');

    var prev = document.querySelector('.platform-panel.active');
    if (prev === panel) return;

    requestAnimationFrame(function() {
      document.querySelectorAll('.platform-panel').forEach(function(p) { p.classList.remove('active'); });
      panel.classList.add('active');
    });
  };
})();
