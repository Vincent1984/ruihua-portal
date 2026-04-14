document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorAlert = document.getElementById('loginError');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('u').value;
            const password = document.getElementById('p').value;
            const btn = loginForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            
            // Reset error
            if(errorAlert) errorAlert.classList.add('d-none');
            
            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>登录中...';

                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    sessionStorage.setItem('isLoggedIn', 'true');
                    if (result.token) sessionStorage.setItem('token', result.token);
                    if (result.admin) {
                        sessionStorage.setItem('user', JSON.stringify(result.admin));
                        localStorage.setItem('adminUser', JSON.stringify(result.admin));
                    } else if (result.user) {
                        sessionStorage.setItem('user', JSON.stringify(result.user));
                        localStorage.setItem('adminUser', JSON.stringify(result.user));
                    }
                    window.location.href = 'dashboard.html';
                } else {
                    showError(result.message || '账号或密码错误');
                }
            } catch (error) {
                console.error('Login error:', error);
                showError('登录请求失败，请检查网络连接');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    }

    function showError(msg) {
        if (errorAlert) {
            errorAlert.textContent = msg;
            errorAlert.classList.remove('d-none');
        } else {
            alert(msg);
        }
    }
});
