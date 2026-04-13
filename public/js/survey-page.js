document.addEventListener('DOMContentLoaded', () => {
    // 1. Behavior Tracking - Start Time
    const startTime = new Date().toISOString();

    // 2. Extract UTM Params and Channel
    const urlParams = new URLSearchParams(window.location.search);
    const utm_source = urlParams.get('utm_source');
    const utm_medium = urlParams.get('utm_medium');
    const utm_campaign = urlParams.get('utm_campaign');
    const utm_term = urlParams.get('utm_term');
    const utm_content = urlParams.get('utm_content');
    const channel = urlParams.get('channel') || utm_source || 'organic';

    const form = document.getElementById('surveyForm');
    const submitBtn = document.getElementById('submitBtn');

    // Clear error states on input
    const inputs = form.querySelectorAll('input');
    inputs.forEach((input) => {
        input.addEventListener('change', () => {
            if (input.type === 'radio') {
                document.getElementById('error-' + (input.name === 'topicInterest' ? 'q1' : 'q2')).classList.add('error-hidden');
            } else {
                input.classList.remove('input-error');
            }
        });
        if (input.type === 'text') {
            input.addEventListener('input', () => {
                input.classList.remove('input-error');
                document.getElementById('error-q3').classList.add('error-hidden');
            });
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 3. Validation
        const formData = new FormData(form);
        const topicInterest = formData.get('topicInterest');
        const participationForm = formData.get('participationForm');
        const wechatId = formData.get('wechatId')?.trim();

        let hasError = false;

        if (!topicInterest) {
            document.getElementById('error-q1').classList.remove('error-hidden');
            hasError = true;
        }
        if (!participationForm) {
            document.getElementById('error-q2').classList.remove('error-hidden');
            hasError = true;
        }
        if (!wechatId) {
            const wxInput = document.getElementById('wechatId');
            wxInput.classList.add('input-error');
            document.getElementById('error-q3').classList.remove('error-hidden');
            hasError = true;
        }

        if (hasError) {
            // Scroll to first error
            if (!topicInterest) {
                document.getElementById('group-q1').scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (!participationForm) {
                document.getElementById('group-q2').scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                document.getElementById('group-q3').scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // 4. Submit Logic
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> 提交中...';

        try {
            const response = await fetch('/api/survey/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    topicInterest,
                    participationForm,
                    wechatId,
                    channel,
                    sourceUrl: window.location.href,
                    utm_source,
                    utm_medium,
                    utm_campaign,
                    utm_term,
                    utm_content,
                    behavior: {
                        startTime
                    }
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                Swal.fire({
                    icon: 'success',
                    title: '提交成功！',
                    text: '感谢您的参与，我们的专家将尽快与您联系。',
                    confirmButtonColor: '#7c4dff',
                    confirmButtonText: '完成'
                }).then(() => {
                    form.reset();
                });
            } else {
                throw new Error(result.error || '提交失败，请稍后重试');
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: '提交失败',
                text: error.message,
                confirmButtonColor: '#7c4dff'
            });
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>提交问卷</span>';
        }
    });
});
