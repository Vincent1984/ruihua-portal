// 移动端菜单开关
function toggleMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  if (!menu) return;
  menu.classList.toggle("hidden");
}

// 页面加载后的一些交互
document.addEventListener("DOMContentLoaded", () => {
  // 平滑滚动到锚点
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (!targetId || targetId === "#") return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      const headerOffset = 80;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });

      const mobileMenu = document.getElementById("mobileMenu");
      if (mobileMenu && !mobileMenu.classList.contains("hidden")) {
        mobileMenu.classList.add("hidden");
      }
    });
  });
});

// 导航栏滚动阴影
window.addEventListener("scroll", () => {
  const nav = document.querySelector("nav");
  if (!nav) return;
  if (window.scrollY > 50) {
    nav.classList.add("shadow-md");
  } else {
    nav.classList.remove("shadow-md");
  }
});

// ========== FAQ 手风琴 ==========

function toggleFaq(dtElement) {
  const item = dtElement.closest('.faq-item');
  const content = item.querySelector('.faq-content');
  const icon = item.querySelector('.faq-icon');

  const allItems = document.querySelectorAll('#faq .faq-item');

  // 如果当前已经是展开状态：允许点击收起
  const isOpen = content.classList.contains('open');

  if (isOpen) {
    content.classList.remove('open');
    icon.classList.remove('rotate');
    return;
  }

  // 先收起其他 FAQ
  allItems.forEach((el) => {
    const c = el.querySelector('.faq-content');
    const i = el.querySelector('.faq-icon');
    if (c) c.classList.remove('open');
    if (i) i.classList.remove('rotate');
  });

  // 展开当前这一项
  content.classList.add('open');
  icon.classList.add('rotate');
}

// 页面加载完成后，默认展开第一个 FAQ
document.addEventListener('DOMContentLoaded', () => {
  const firstItem = document.querySelector('#faq .faq-item');
  if (!firstItem) return;

  const firstContent = firstItem.querySelector('.faq-content');
  const firstIcon = firstItem.querySelector('.faq-icon');

  if (firstContent) firstContent.classList.add('open');
  if (firstIcon) firstIcon.classList.add('rotate');
});

// 全局模拟验证码（DEMO用，真正接入短信时，改为后端校验）
let __mockVerifyCode = null;
let __verifyCountdown = 0;
let __verifyTimer = null;

/**
 * 发送验证码按钮逻辑
 */
function initVerifyCodeSender() {
  const sendBtn = document.getElementById("sendCodeBtn");
  const phoneInput = document.getElementById("phone");

  if (!sendBtn || !phoneInput) return;

  sendBtn.addEventListener("click", function () {
    const phone = phoneInput.value.trim();
    const phonePattern = /^1[3-9]\d{9}$/;

    if (!phonePattern.test(phone)) {
      alert("请输入有效的11位手机号码");
      phoneInput.focus();
      return;
    }

    // 生成 6 位随机验证码（DEMO）
    __mockVerifyCode = ("" + Math.floor(100000 + Math.random() * 900000));
    console.log("【模拟验证码】", __mockVerifyCode);

    // 这里可以换成你真实的发送短信接口：
    // fetch('/api/sendSms', { method: 'POST', body: JSON.stringify({ phone }) })

    startVerifyCountdown(sendBtn);
    alert("验证码已发送（演示环境），请在 5 分钟内完成输入。");
  });
}

/**
 * 倒计时逻辑
 */
function startVerifyCountdown(btn) {
  __verifyCountdown = 60;
  btn.disabled = true;
  btn.textContent = "60s 后重试";

  if (__verifyTimer) clearInterval(__verifyTimer);

  __verifyTimer = setInterval(() => {
    __verifyCountdown -= 1;
    if (__verifyCountdown <= 0) {
      clearInterval(__verifyTimer);
      __verifyTimer = null;
      btn.disabled = false;
      btn.textContent = "获取验证码";
    } else {
      btn.textContent = __verifyCountdown + "s 后重试";
    }
  }, 1000);
}

/**
 * 通用表单提交处理（首页 + 独立页公用）
 */
function initAppointmentForms() {
  const quickForm = document.getElementById("quick-appointment");
  const pageForm = document.getElementById("appointmentForm");

  [quickForm, pageForm].forEach((form) => {
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      const name = form.querySelector("#name");
      const phone = form.querySelector("#phone");
      const company = form.querySelector("#company");
      const title = form.querySelector("#title");
      const codeInput = form.querySelector("#verifyCode");

      // 基本必填校验
      if (!name.value.trim()) {
        alert("请输入姓名");
        name.focus();
        return;
      }

      const phonePattern = /^1[3-9]\d{9}$/;
      if (!phonePattern.test(phone.value.trim())) {
        alert("请输入有效的11位手机号码");
        phone.focus();
        return;
      }

      if (!company.value.trim()) {
        alert("请输入公司名称");
        company.focus();
        return;
      }

      if (!title.value) {
        alert("请选择您的职位");
        title.focus();
        return;
      }

      if (!codeInput.value.trim()) {
        alert("请输入验证码");
        codeInput.focus();
        return;
      }

      // 模拟验证码校验
      if (!__mockVerifyCode) {
        alert("请先获取验证码");
        return;
      }

      if (codeInput.value.trim() !== __mockVerifyCode) {
        alert("验证码不正确，请检查后重新输入");
        codeInput.focus();
        return;
      }

      // 通过校验，模拟提交
      alert("提交成功！我们会尽快与您联系。");

      // 重置表单 & 验证码（按需保留或删除）
      form.reset();
      __mockVerifyCode = null;
    });
  });
}

// 其他已有功能，比如导航、FAQ 等保留，这里只演示初始化入口：
document.addEventListener("DOMContentLoaded", function () {
  // 原来就有的初始化逻辑（导航、FAQ、hover 等）继续放这里…

  // 初始化验证码相关
  initVerifyCodeSender();
  initAppointmentForms();
});

