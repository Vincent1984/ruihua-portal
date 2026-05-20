// 培训课程页面交互与表单验证

document.addEventListener('DOMContentLoaded', () => {
    // 手机端菜单逻辑
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeMobileMenuBtn = document.getElementById('closeMobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');

    if (mobileMenuBtn && closeMobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.remove('hidden');
            mobileMenu.classList.add('flex');
            document.body.style.overflow = 'hidden';
        });

        closeMobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            mobileMenu.classList.remove('flex');
            document.body.style.overflow = '';
        });
    }

    // 表单验证与提交逻辑
    const trainingForm = document.getElementById('trainingForm');
    const getCodeBtn = document.getElementById('getVerifyCodeBtn');
    const phoneInput = document.getElementById('phone');

    if (getCodeBtn && phoneInput) {
        getCodeBtn.addEventListener('click', async () => {
            const phone = phoneInput.value.trim();
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                Swal.fire({ icon: 'warning', title: '提示', text: '请输入正确的手机号码' });
                return;
            }

            getCodeBtn.disabled = true;
            let countdown = 60;

            try {
                const res = await fetch('/api/send-verification-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: phone, scene: 'training' })
                });
                const data = await res.json();

                if (data.success || !data.error) {
                    Swal.fire({ icon: 'success', title: '已发送', text: '验证码已发送至您的手机，请注意查收', timer: 2000, showConfirmButton: false });
                    
                    const timer = setInterval(() => {
                        getCodeBtn.textContent = `${countdown}s 后重试`;
                        countdown--;
                        if (countdown < 0) {
                            clearInterval(timer);
                            getCodeBtn.textContent = '获取验证码';
                            getCodeBtn.disabled = false;
                        }
                    }, 1000);
                } else {
                    getCodeBtn.disabled = false;
                    Swal.fire({ icon: 'error', title: '发送失败', text: data.message || '请稍后重试' });
                }
            } catch (err) {
                getCodeBtn.disabled = false;
                Swal.fire({ icon: 'error', title: '错误', text: '网络请求失败，请检查您的连接' });
            }
        });
    }

    if (trainingForm) {
        trainingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(trainingForm);
            const data = Object.fromEntries(formData.entries());

            // 获取来源渠道 (URL参数 source / utm_source)
            const urlParams = new URLSearchParams(window.location.search);
            const sourceParam = urlParams.get('source') || urlParams.get('utm_source') || '自然流量';
            data.source = sourceParam;

            // 基础验证
            if (!data.name || !data.phone || !data.company || !data.courseOption || !data.verifyCode) {
                Swal.fire({ icon: 'warning', title: '提示', text: '请填写所有必填字段' });
                return;
            }

            if (!/^1[3-9]\d{9}$/.test(data.phone)) {
                Swal.fire({ icon: 'warning', title: '提示', text: '请输入正确的手机号码' });
                return;
            }

            const submitBtn = trainingForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> 提交中...';
            submitBtn.disabled = true;

            try {
                const res = await fetch('/api/training/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                
                if (result.success) {
                    Swal.fire({
                        icon: 'success',
                        title: '提交成功！',
                        text: '感谢您的申请，我们的专家顾问将尽快与您联系。',
                        confirmButtonColor: '#7c4dff'
                    }).then(() => {
                        trainingForm.reset();
                    });
                } else {
                    Swal.fire({ icon: 'error', title: '提交失败', text: result.message || '请稍后重试' });
                }
            } catch (err) {
                Swal.fire({ icon: 'error', title: '网络错误', text: '无法连接到服务器，请检查网络设置' });
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});
