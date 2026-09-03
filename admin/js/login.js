document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorAlert = document.getElementById('loginError');
    const passwordInput = document.getElementById('p');
    const togglePassword = document.getElementById('togglePassword');

    if (new URLSearchParams(window.location.search).get('logout') === '1') {
        sessionStorage.clear();
        document.cookie = 'admin_token=; Max-Age=0; path=/; SameSite=Lax';
    }

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const isVisible = passwordInput.type === 'text';
            passwordInput.type = isVisible ? 'password' : 'text';
            togglePassword.textContent = isVisible ? '显示' : '隐藏';
            togglePassword.setAttribute('aria-label', isVisible ? '显示密码' : '隐藏密码');
            togglePassword.setAttribute('aria-pressed', String(!isVisible));
            passwordInput.focus();
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const username = document.getElementById('u').value.trim();
            const password = passwordInput.value;
            const button = loginForm.querySelector('button[type="submit"]');
            const buttonLabel = button.querySelector('.button-label');
            const originalText = buttonLabel.textContent;

            hideError();

            try {
                button.disabled = true;
                buttonLabel.textContent = '正在验证...';

                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const result = await response.json();

                if (result.success) {
                    sessionStorage.setItem('isLoggedIn', 'true');
                    if (result.token) sessionStorage.setItem('token', result.token);
                    if (result.admin || result.user) {
                        sessionStorage.setItem('user', JSON.stringify(result.admin || result.user));
                    }
                    const redirect = new URLSearchParams(window.location.search).get('redirect');
                    window.location.href = redirect && redirect.startsWith('/admin/') ? redirect : '/admin/console.html';
                    return;
                }

                showError(result.message || '账号或密码错误');
            } catch (error) {
                console.error('Login error:', error);
                showError('登录请求失败，请检查网络连接');
            } finally {
                button.disabled = false;
                buttonLabel.textContent = originalText;
            }
        });
    }

    function hideError() {
        if (!errorAlert) return;
        errorAlert.textContent = '';
        errorAlert.classList.remove('is-visible');
    }

    function showError(message) {
        if (!errorAlert) return;
        errorAlert.textContent = message;
        errorAlert.classList.add('is-visible');
    }
});
