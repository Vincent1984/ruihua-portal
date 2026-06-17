function toggleModuleCollapse(id) {
  var el = document.getElementById(id);
  el.classList.toggle('open');
}

function switchChannelTab(tabId, btn) {
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById(tabId).classList.add('active');
}

function switchInnerTab(panelId, btn, navSelector) {
  var nav = btn.closest(navSelector || '.inner-tab-nav');
  nav.querySelectorAll('.inner-tab-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  var section = nav.closest('.tab-panel') || nav.closest('.ch-body') || nav.closest('.card');
  section.querySelectorAll('.inner-tab-panel').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById(panelId).classList.add('active');
}

function copyText2(btn, txt) {
  navigator.clipboard.writeText(txt).then(function() {
    var t = document.getElementById('toast');
    t.classList.add('on');
    setTimeout(function() { t.classList.remove('on'); }, 1800);
    btn.classList.add('done');
    setTimeout(function() { btn.classList.remove('done'); }, 1500);
  });
}

// nav highlight
(function() {
  var navLinks = document.querySelectorAll('.nav-inner a');
  var floors = [];
  navLinks.forEach(function(a) {
    var id = a.getAttribute('href').substring(1);
    var el = document.getElementById(id);
    if (el) floors.push({ id: id, el: el, link: a });
  });
  window.addEventListener('scroll', function() {
    var scrollY = window.scrollY + 120;
    var current = null;
    floors.forEach(function(f) {
      if (f.el.offsetTop <= scrollY) current = f;
    });
    navLinks.forEach(function(a) { a.classList.remove('on'); });
    if (current) current.link.classList.add('on');
  });
})();

// ===== 一键复制按钮 =====
(function() {
  function textAfterBold(el) {
    var b = el.querySelector('b');
    if (!b) return el.innerText.trim();
    var text = el.innerText;
    var label = b.innerText;
    if (text.startsWith(label)) text = text.substring(label.length);
    return text.trim();
  }

  function addCopyBtn(el, getText) {
    if (el.querySelector('.copy-btn')) return;
    el.classList.add('copy-parent');
    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.innerHTML = '<i class="fas fa-copy"></i>';
    btn.title = '一键复制';
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      var txt = getText(el);
      navigator.clipboard.writeText(txt).then(function() {
        btn.classList.add('copied');
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(function() {
          btn.classList.remove('copied');
          btn.innerHTML = '<i class="fas fa-copy"></i>';
        }, 1500);
      }).catch(function() {
        btn.classList.add('copied');
        btn.innerHTML = '<i class="fas fa-times"></i>';
        setTimeout(function() {
          btn.classList.remove('copied');
          btn.innerHTML = '<i class="fas fa-copy"></i>';
        }, 1500);
      });
    });
    el.appendChild(btn);
  }

  // highlight-box: 复制全部文本
  document.querySelectorAll('.highlight-box').forEach(function(el) {
    // 邮件 tab 内的所有高亮框跳过（只保留手动加的「复制为 HTML」按钮）
    if (el.id === 'email-html-content') return;
    if (el.closest('#tab-email')) return;
    addCopyBtn(el, function(e) { return e.innerText.trim(); });
  });

  // ch-sc-item: 复制 <b> 标签之后的文本（标题、预览文本 等）
  document.querySelectorAll('.ch-sc-item').forEach(function(el) {
    // 跳过已包含手动「复制为 HTML」按钮的行（如邮件正文行）
    if (el.querySelector('.btn')) return;
    var b = el.querySelector('b');
    if (!b) return;
    var text = textAfterBold(el);
    if (!text) return;
    addCopyBtn(el, textAfterBold);
  });
})();

// 阻止内联点击事件向上冒泡，避免触发 highlight-box 的整块复制
document.addEventListener('click', function(e) {
  if (e.target && e.target.classList.contains('copy-text-btn')) {
    e.stopPropagation();
  }
}, true);
function copyTextToClipboard(text) {
  var textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, 99999);
  try {
    var successful = document.execCommand('copy');
    if (successful) {
      var t = document.getElementById('toast');
      if (t) {
        t.innerText = '已复制微信号: ' + text;
        t.classList.add('on');
        setTimeout(function() { 
          t.classList.remove('on'); 
          setTimeout(function(){ t.innerText = '已复制到剪贴板'; }, 300); // 恢复默认提示
        }, 1800);
      } else {
        alert('已复制微信号: ' + text);
      }
    }
  } catch (err) {}
  document.body.removeChild(textarea);
}

// 一键复制 HTML 源码 (纯文本 HTML 代码)
function copyHtmlToClipboard(elementId) {
  var el = document.getElementById(elementId);
  if (!el) return;

  var htmlString = el.innerHTML;
  
  // 现代与兼容性更好的文本复制方式
  var textarea = document.createElement("textarea");
  textarea.value = htmlString;
  
  // 确保 textarea 不可见且不影响页面布局
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, 99999); // 兼容移动端

  try {
    var successful = document.execCommand('copy');
    if (successful) {
      var t = document.getElementById('toast');
      if (t) {
        t.classList.add('on');
        setTimeout(function() { t.classList.remove('on'); }, 1800);
      } else {
        alert('HTML 源码已复制到剪贴板！');
      }
    } else {
      alert('复制失败，请重试。');
    }
  } catch (err) {
    console.error('复制报错: ', err);
    alert('复制失败，请重试');
  }
  
  document.body.removeChild(textarea);
}
