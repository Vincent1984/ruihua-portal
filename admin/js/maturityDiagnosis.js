// ================= Maturity Diagnosis Management =================

// Permission Check for Sidebar (Self-contained or dependent on utils)
(async function checkSidebarPerms() {
    try {
        const token = sessionStorage.getItem('token');
        if (!token) return;
        
        // Assuming utils.js is loaded, use authHeaders or fallback
        const headers = window.authHeaders ? window.authHeaders() : { 'Authorization': 'Bearer ' + token };

        const res = await fetch('/api/auth/verify', { headers });
        const data = await res.json();
        
        if (data.success && data.user && data.user.roles) {
            const perms = new Set();
            data.user.roles.forEach(r => {
                if (r.permissions && Array.isArray(r.permissions)) {
                    r.permissions.forEach(p => perms.add(p));
                }
            });
            
            const hasPerm = perms.has('all') || perms.has('appointment:list');
            const nav = document.getElementById('nav-whitepaper');
            if (nav && !hasPerm) {
                nav.style.display = 'none';
            }
        }
    } catch (e) {
        console.error('Perm check failed', e);
    }
})();

const { createApp, ref, onMounted } = Vue;

const app = createApp({
    setup() {
        const list = ref([]);
        const page = ref(1);
        const total = ref(0);
        const totalPages = ref(1);
        const currentItem = ref(null);
        const quizConfig = ref({}); // Store quiz config
        let modalInstance = null;

        const getHeaders = () => {
            return window.authHeaders ? window.authHeaders() : { 
                'Authorization': 'Bearer ' + sessionStorage.getItem('token'),
                'Content-Type': 'application/json'
            };
        };

        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/config/quiz');
                quizConfig.value = await res.json();
            } catch (e) {
                console.error("Failed to load quiz config", e);
            }
        };

        const getQuestionText = (qKey) => {
            if (!quizConfig.value[qKey]) return qKey;
            // Format: "Q1. Question Text"
            const num = qKey.replace('q', 'Q');
            return `${num}. ${quizConfig.value[qKey].text}`;
        };

        const getOptionText = (qKey, optKey) => {
            if (!quizConfig.value[qKey] || !quizConfig.value[qKey].options) return '';
            return quizConfig.value[qKey].options[optKey] || '';
        };

        const exportData = async (format) => {
            try {
                const token = sessionStorage.getItem('token');
                if (!token) {
                        alert('请先登录');
                        return;
                }
                
                const btn = document.activeElement;
                const originalText = btn.innerText;
                btn.innerText = '导出中...';
                btn.disabled = true;

                const response = await fetch(`/api/maturity/export?format=${format}`, {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    // Filename from header or default
                    let fileName = `成熟度诊断报告_批量_${new Date().toISOString().split('T')[0]}.${format}`;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                } else {
                    const err = await response.json();
                    alert('导出失败: ' + (err.error || '未知错误'));
                }
                
                btn.innerText = originalText;
                btn.disabled = false;

            } catch (e) {
                console.error(e);
                alert('导出请求失败');
            }
        };

        const fetchData = async () => {
            try {
                const res = await fetch(`/api/maturity/list?page=${page.value}&limit=10`, {
                    headers: getHeaders()
                });
                if (res.status === 401) {
                    window.location.href = '/admin/index.html';
                    return;
                }
                const data = await res.json();
                if (data.data) {
                    list.value = data.data;
                    total.value = data.pagination.total;
                    totalPages.value = data.pagination.pages;
                }
            } catch (e) {
                console.error(e);
                alert('加载数据失败');
            }
        };

        const changePage = (p) => {
            if (p < 1 || p > totalPages.value) return;
            page.value = p;
            fetchData();
        };

        const formatDate = (str) => {
            return new Date(str).toLocaleString();
        };

        const getLevelClass = (level) => {
            if (level.includes('体系化')) return 'badge bg-success';
            if (level.includes('起步')) return 'badge bg-warning text-dark';
            return 'badge bg-secondary';
        };

        const showDetail = (item) => {
            currentItem.value = item;
            // Wait for DOM update
            setTimeout(() => {
                const el = document.getElementById('detailModal');
                if (el) {
                    if (!modalInstance) modalInstance = new bootstrap.Modal(el);
                    modalInstance.show();
                }
            }, 10);
        };

        const deleteItem = async (id) => {
            if (!confirm('确定删除此记录吗？')) return;
            try {
                const res = await fetch(`/api/maturity/${id}`, {
                    method: 'DELETE',
                    headers: getHeaders()
                });
                const data = await res.json();
                if (data.success) {
                    fetchData();
                } else {
                    alert(data.error || '删除失败');
                }
            } catch (e) {
                alert('操作失败');
            }
        };

        onMounted(() => {
            // Check Auth
            if (!sessionStorage.getItem('token')) {
                window.location.href = '/admin/index.html';
                return;
            }
            fetchConfig(); // Load Config
            fetchData();
        });

        return {
            list, page, total, totalPages, currentItem,
            fetchData, changePage, formatDate, getLevelClass, showDetail, deleteItem,
            getQuestionText, getOptionText, exportData
        };
    }
});

// Expose vm for testing
window.maturityVm = app.mount('#app');
