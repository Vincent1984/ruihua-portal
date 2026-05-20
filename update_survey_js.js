const fs = require('fs');

const newJs = `    <script>
        // Form Logic
        document.addEventListener('DOMContentLoaded', () => {
            const form = document.getElementById('survey-form');
            const formContainer = document.getElementById('survey-form-container');
            const successState = document.getElementById('success-state');
            const progressLine = document.getElementById('progress-line');
            
            const steps = [
                document.getElementById('step-1'),
                document.getElementById('step-2'),
                document.getElementById('step-3'),
                document.getElementById('step-4')
            ];
            
            const indicators = [
                document.getElementById('step1-indicator'),
                document.getElementById('step2-indicator'),
                document.getElementById('step3-indicator'),
                document.getElementById('step4-indicator')
            ];
            
            let currentStep = 0;

            // --- CACHE LOGIC ---
            const CACHE_KEY = 'nqoc_survey_cache_v3';
            const CACHE_EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 hours

            function saveDraft() {
                const formData = new FormData(form);
                const data = {};
                const arrayFields = ['b_o1', 'p_o1', 'm_o1', 'e_o1', 's2', 's3', 's4', 's5', 's6'];
                for (let key of formData.keys()) {
                    if (arrayFields.includes(key)) {
                        data[key] = formData.getAll(key);
                    } else {
                        data[key] = formData.get(key);
                    }
                }
                const cacheObj = {
                    timestamp: Date.now(),
                    step: currentStep,
                    data: data
                };
                try {
                    const encoded = btoa(encodeURIComponent(JSON.stringify(cacheObj)));
                    localStorage.setItem(CACHE_KEY, encoded);
                } catch (e) { console.error('Cache save error', e); }
            }

            function restoreDraft(draft) {
                const data = draft.data;
                for (const key in data) {
                    const value = data[key];
                    if (Array.isArray(value)) {
                        value.forEach(val => {
                            const el = form.querySelector(\`input[name="\${key}"][value="\${val}"]\`);
                            if (el) el.checked = true;
                        });
                    } else {
                        const el = form.querySelector(\`[name="\${key}"]\`);
                        if (el) {
                            if (el.type === 'radio') {
                                const radio = form.querySelector(\`input[name="\${key}"][value="\${value}"]\`);
                                if (radio) radio.checked = true;
                            } else {
                                el.value = value;
                            }
                        }
                    }
                }
                
                // Jump to the saved step
                if (draft.step > 0 && draft.step < steps.length) {
                    goToStep(draft.step);
                }
            }

            function checkCache() {
                const rawCache = localStorage.getItem(CACHE_KEY);
                if (rawCache) {
                    try {
                        const draft = JSON.parse(decodeURIComponent(atob(rawCache)));
                        if (Date.now() - draft.timestamp < CACHE_EXPIRE_MS) {
                            const confirmModal = document.createElement('div');
                            confirmModal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity';
                            confirmModal.innerHTML = \`
                                <div class="bg-[#111424] border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-[0_0_40px_rgba(124,77,255,0.2)]">
                                    <div class="w-16 h-16 rounded-full bg-[var(--nqoc-brand)]/20 text-[var(--nqoc-brand-light)] flex items-center justify-center text-2xl mx-auto mb-4">
                                        <i class="fas fa-history"></i>
                                    </div>
                                    <h3 class="text-xl font-bold text-white text-center mb-2">发现未完成的调研</h3>
                                    <p class="text-slate-400 text-center text-sm mb-6">系统为您保存了上次填写的草稿内容（24小时内有效）。是否继续填写？</p>
                                    <div class="flex gap-3">
                                        <button id="btn-discard-draft" type="button" class="flex-1 py-2.5 rounded-xl border border-white/20 text-slate-300 hover:bg-white/5 transition-colors">放弃重填</button>
                                        <button id="btn-restore-draft" type="button" class="flex-1 py-2.5 rounded-xl bg-[var(--nqoc-brand)] hover:bg-[var(--nqoc-brand-light)] text-white font-bold transition-colors">恢复草稿</button>
                                    </div>
                                </div>
                            \`;
                            document.body.appendChild(confirmModal);
                            
                            document.getElementById('btn-restore-draft').addEventListener('click', () => {
                                restoreDraft(draft);
                                document.body.removeChild(confirmModal);
                            });
                            document.getElementById('btn-discard-draft').addEventListener('click', () => {
                                localStorage.removeItem(CACHE_KEY);
                                document.body.removeChild(confirmModal);
                            });
                        } else {
                            localStorage.removeItem(CACHE_KEY);
                        }
                    } catch (e) {
                        localStorage.removeItem(CACHE_KEY);
                    }
                }
            }

            form.addEventListener('input', saveDraft);
            form.addEventListener('change', saveDraft);
            checkCache();
            // --- CACHE LOGIC END ---

            // --- Multi-step Logic ---
            function updateProgressUI(targetStep) {
                // Update Line
                const percentage = (targetStep / (steps.length - 1)) * 100;
                progressLine.style.width = \`\${percentage}%\`;

                // Update Indicators
                indicators.forEach((indicator, index) => {
                    const div = indicator.querySelector('div');
                    const span = indicator.querySelector('span');
                    
                    if (index <= targetStep) {
                        div.className = 'w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--nqoc-brand-light)] to-[var(--nqoc-brand)] text-white font-bold flex items-center justify-center shadow-[0_0_20px_rgba(124,77,255,0.5)] transform rotate-45 transition-all duration-300 border-4 border-[#07090f]';
                        span.className = 'text-xs md:text-sm font-bold text-[var(--nqoc-brand-light)] tracking-widest transition-all duration-300';
                    } else {
                        div.className = 'w-12 h-12 rounded-2xl bg-[#111424] border-2 border-white/10 text-slate-500 font-bold flex items-center justify-center transition-all duration-300 transform rotate-45 border-4 border-[#07090f]';
                        span.className = 'text-xs md:text-sm font-medium text-slate-500 transition-all duration-300 tracking-widest';
                    }
                });
            }

            function goToStep(targetStep) {
                // Validation for current step
                if (targetStep > currentStep) {
                    const currentStepEl = steps[currentStep];
                    const inputs = currentStepEl.querySelectorAll('input[required], select[required]');
                    let isValid = true;
                    inputs.forEach(input => {
                        if (!input.value || (input.type === 'radio' && !currentStepEl.querySelector(\`input[name="\${input.name}"]:checked\`))) {
                            isValid = false;
                            if (input.type !== 'radio') input.classList.add('border-red-500');
                        } else {
                            if (input.type !== 'radio') input.classList.remove('border-red-500');
                        }
                    });

                    // Custom validations
                    if (currentStep === 1) { // 填答人信息
                        const phoneInput = document.getElementById('surveyPhone');
                        const phoneVal = phoneInput ? phoneInput.value.trim() : '';
                        if (phoneVal && !/^1[3-9]\\d{9}$/.test(phoneVal)) {
                            alert('请输入有效的11位手机号');
                            isValid = false;
                        }
                        const codeInput = document.getElementById('surveySmsCode');
                        if (phoneVal && (!codeInput || !/^\\d{6}$/.test(codeInput.value.trim()))) {
                            alert('请输入有效的6位验证码');
                            isValid = false;
                        }
                    }

                    if (!isValid) {
                        alert('请填写完整的必填项信息');
                        return;
                    }
                }

                // Hide current, show target
                steps[currentStep].classList.add('hidden');
                steps[targetStep].classList.remove('hidden');
                
                // Toggle immersive mode if not on step 0
                if (targetStep > 0 && currentStep === 0) {
                    document.querySelector('nav').style.display = 'none';
                    const footer = document.querySelector('footer');
                    if (footer) footer.style.display = 'none';
                    document.querySelectorAll('.hide-in-immersive').forEach(el => el.style.display = 'none');
                    document.querySelector('main').classList.remove('pt-24');
                    document.querySelector('main').classList.add('pt-8');
                } else if (targetStep === 0 && currentStep > 0) {
                    document.querySelector('nav').style.display = '';
                    const footer = document.querySelector('footer');
                    if (footer) footer.style.display = '';
                    document.querySelectorAll('.hide-in-immersive').forEach(el => el.style.display = '');
                    document.querySelector('main').classList.add('pt-24');
                    document.querySelector('main').classList.remove('pt-8');
                }
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
                updateProgressUI(targetStep);
                currentStep = targetStep;
                saveDraft();
            }

            // Attach event listeners to next/prev buttons
            document.querySelectorAll('.btn-next').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (currentStep < steps.length - 1) goToStep(currentStep + 1);
                });
            });
            document.querySelectorAll('.btn-prev').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (currentStep > 0) goToStep(currentStep - 1);
                });
            });

            // --- SMS LOGIC ---
            const sendCodeBtn = document.getElementById('surveySendCodeBtn');
            const phoneInput = document.getElementById('surveyPhone');
            const smsCodeContainer = document.getElementById('smsCodeContainer');
            let countdownTimer = null;

            if (phoneInput && smsCodeContainer) {
                phoneInput.addEventListener('input', () => {
                    if (phoneInput.value.trim().length > 0) {
                        smsCodeContainer.style.display = 'block';
                        document.getElementById('surveySmsCode').required = true;
                    } else {
                        smsCodeContainer.style.display = 'none';
                        document.getElementById('surveySmsCode').required = false;
                    }
                });
            }

            if (sendCodeBtn && phoneInput) {
                sendCodeBtn.addEventListener('click', async () => {
                    const phone = phoneInput.value.trim();
                    if (!/^1[3-9]\\d{9}$/.test(phone)) {
                        alert('请输入有效的11位手机号');
                        phoneInput.focus();
                        return;
                    }
                    try {
                        sendCodeBtn.disabled = true;
                        sendCodeBtn.textContent = '发送中...';
                        const res = await fetch('/api/send-verification-code', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone, scene: 'survey' })
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                            alert('验证码已发送，请注意查收');
                            let countdown = 60;
                            sendCodeBtn.textContent = countdown + '秒后重发';
                            if (countdownTimer) clearInterval(countdownTimer);
                            countdownTimer = setInterval(() => {
                                countdown--;
                                if (countdown <= 0) {
                                    clearInterval(countdownTimer);
                                    sendCodeBtn.disabled = false;
                                    sendCodeBtn.textContent = '获取验证码';
                                } else {
                                    sendCodeBtn.textContent = countdown + '秒后重发';
                                }
                            }, 1000);
                        } else {
                            sendCodeBtn.disabled = false;
                            sendCodeBtn.textContent = '获取验证码';
                            alert(data.error || '验证码发送失败');
                        }
                    } catch (e) {
                        console.error('发送验证码失败:', e);
                        sendCodeBtn.disabled = false;
                        sendCodeBtn.textContent = '获取验证码';
                        alert('网络错误，请稍后重试');
                    }
                });
            }
            // --- SMS LOGIC END ---

            // Parse URL parameters for channel
            const urlParams = new URLSearchParams(window.location.search);
            const channel = urlParams.get('channel') || 'organic';

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btnSubmit = document.getElementById('btn-submit');
                const originalBtnHtml = btnSubmit.innerHTML;
                btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> 提交中...';
                btnSubmit.disabled = true;
                
                // Add limits to s2, s3, s4, s5, s6
                const limits = { s2: 2, s3: 2, s4: 3, s5: 3, s6: 3 };
                const formData = new FormData(form);
                const payload = { channel };
                
                const arrayFields = ['b_o1', 'p_o1', 'm_o1', 'e_o1', 's2', 's3', 's4', 's5', 's6'];
                let limitExceeded = false;
                let limitMsg = '';

                for (let key of formData.keys()) {
                    if (arrayFields.includes(key)) {
                        const vals = formData.getAll(key);
                        if (limits[key] && vals.length > limits[key]) {
                            limitExceeded = true;
                            limitMsg = \`\${key.toUpperCase()} 选项不能超过 \${limits[key]} 个\`;
                        }
                        payload[key] = vals;
                    } else {
                        payload[key] = formData.get(key);
                    }
                }

                if (limitExceeded) {
                    alert(limitMsg);
                    btnSubmit.innerHTML = originalBtnHtml;
                    btnSubmit.disabled = false;
                    return;
                }

                try {
                    const response = await fetch('/api/nqoc/survey/submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const result = await response.json();
                    
                    if (result.success) {
                        localStorage.removeItem(CACHE_KEY);
                        formContainer.classList.add('hidden');
                        successState.classList.remove('hidden');
                        window.scrollTo(0, 0);
                    } else {
                        alert(result.error || '提交失败');
                        btnSubmit.innerHTML = originalBtnHtml;
                        btnSubmit.disabled = false;
                    }
                } catch (err) {
                    alert('网络异常，请重试');
                    btnSubmit.innerHTML = originalBtnHtml;
                    btnSubmit.disabled = false;
                }
            });
        });
    </script>
</body>
</html>`;

const html = fs.readFileSync('public/nqoc/survey.html', 'utf8');

const startTag = '<script>';
// Need to find the last script tag. Wait, there are multiple script tags.
const scriptIndex = html.lastIndexOf('<script>');
if (scriptIndex === -1) throw new Error("Script tag not found");

const endTag = '</html>';
const endIndex = html.lastIndexOf(endTag);

const replacedHtml = html.substring(0, scriptIndex) + newJs;
fs.writeFileSync('public/nqoc/survey.html', replacedHtml);
console.log('Script replaced.');