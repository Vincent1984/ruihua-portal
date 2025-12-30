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

// 验证码倒计时相关变量
let __verifyCountdown = 0;
let __verifyTimer = null;

/**
 * 发送验证码按钮逻辑
 */
function initVerifyCodeSender() {
  const sendBtn = document.getElementById("sendCodeBtn");
  const phoneInput = document.getElementById("phone");

  if (!sendBtn || !phoneInput) return;

  sendBtn.addEventListener("click", async function () {
    const phone = phoneInput.value.trim();
    const phonePattern = /^1[3-9]\d{9}$/;

    if (!phonePattern.test(phone)) {
      alert("请输入有效的11位手机号码");
      phoneInput.focus();
      return;
    }

    // 发送真实短信验证码
    try {
      sendBtn.disabled = true;
      sendBtn.textContent = "发送中...";

      const response = await fetch('/api/send-verification-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        startVerifyCountdown(sendBtn);
        alert("验证码已发送，请注意查收短信。");
      } else {
        sendBtn.disabled = false;
        sendBtn.textContent = "获取验证码";
        alert(result.error || "验证码发送失败，请稍后重试");
      }
    } catch (error) {
      console.error('发送验证码失败:', error);
      sendBtn.disabled = false;
      sendBtn.textContent = "获取验证码";
      alert("网络错误，请稍后重试");
    }
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

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const name = form.querySelector("#name");
      const phone = form.querySelector("#phone");
      const company = form.querySelector("#company");
      const title = form.querySelector("#title");
      const codeInput = form.querySelector("#verifyCode");
      const problem = form.querySelector("#problem");

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

      // 提交预约数据到后端
      try {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "提交中...";
        }

        const formData = {
          name: name.value.trim(),
          phone: phone.value.trim(),
          company: company.value.trim(),
          title: title.value,
          problem: problem ? problem.value.trim() : '',
          verificationCode: codeInput.value.trim(),
          source: 'website'
        };

        const response = await fetch('/api/appointments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
          alert("提交成功！我们会尽快与您联系。");
          form.reset();
          
          // 重置发送验证码按钮状态
          const sendBtn = document.getElementById("sendCodeBtn");
          if (sendBtn && __verifyTimer) {
            clearInterval(__verifyTimer);
            __verifyTimer = null;
            sendBtn.disabled = false;
            sendBtn.textContent = "获取验证码";
          }
        } else {
          alert(result.error || "提交失败，请稍后重试");
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "立即预约";
        }
      } catch (error) {
        console.error('提交预约失败:', error);
        alert("网络错误，请稍后重试");
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "立即预约";
        }
      }
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

