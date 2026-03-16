// ================= Efficiency Diagnosis Management =================

// Permission Check for Sidebar
(async function checkSidebarPerms() {
    try {
        const token = sessionStorage.getItem('token');
        if (!token) return;
        
        const headers = window.authHeaders ? window.authHeaders() : { 'Authorization': 'Bearer ' + token };

        const res = await fetch('/api/auth/verify', { headers });
        const data = await res.json();
        
        // Simple check to ensure session is valid
        if (!data.success) {
             // Handle invalid session if needed
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
        const quizConfig = ref({});
        const loading = ref(false);
        let modalInstance = null;

        const getHeaders = () => {
            return window.authHeaders ? window.authHeaders() : { 
                'Authorization': 'Bearer ' + sessionStorage.getItem('token'),
                'Content-Type': 'application/json'
            };
        };

        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/config/efficiency-quiz');
                quizConfig.value = await res.json();
            } catch (e) {
                console.error("Failed to load quiz config", e);
            }
        };

        const getAnswerDetail = (key, val, detailedAnswers) => {
            // 1. Try detailedAnswers
            if (detailedAnswers && Array.isArray(detailedAnswers)) {
                const detail = detailedAnswers.find(d => d.questionId === key);
                if (detail) {
                    const scoreText = (detail.score !== undefined) ? ` <span class="badge bg-secondary ms-1">${detail.score}分</span>` : '';
                    return `<span class="fw-bold text-dark">${detail.selectedOption}.</span> ${detail.optionText}${scoreText}`;
                }
            }
            // 2. Try config
            if (quizConfig.value[key] && quizConfig.value[key].options) {
                const scoreMap = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
                const score = scoreMap[val] || 0;
                const scoreText = score ? ` <span class="badge bg-secondary ms-1">${score}分</span>` : '';
                return `<span class="fw-bold text-dark">${val}.</span> ${quizConfig.value[key].options[val] || ''}${scoreText}`;
            }
            // 3. Fallback
            return val;
        };
        
        const getQuestionText = (key) => {
             if (quizConfig.value[key]) {
                 return `${key}. ${quizConfig.value[key].text}`;
             }
             return key;
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

                const response = await fetch(`/api/efficiency-diagnosis/export?format=${format}`, {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    let fileName = `组织人效诊断报告_${new Date().toISOString().split('T')[0]}.${format}`;
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
            loading.value = true;
            try {
                const res = await fetch(`/api/efficiency-diagnosis?page=${page.value}&limit=10`, {
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
            } finally {
                loading.value = false;
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

        const showDetail = (item) => {
            currentItem.value = item;
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
                const res = await fetch(`/api/efficiency-diagnosis/${id}`, {
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

        const filterKeys = (obj, prefix) => {
            if (!obj) return {};
            return Object.keys(obj)
                .filter(key => key.startsWith(prefix))
                .reduce((res, key) => {
                    res[key] = obj[key];
                    return res;
                }, {});
        };

        onMounted(() => {
            if (!sessionStorage.getItem('token')) {
                window.location.href = '/admin/index.html';
                return;
            }
            fetchConfig();
            fetchData();
        });

        return {
            list, page, total, totalPages, currentItem, loading,
            fetchData, changePage, formatDate, showDetail, deleteItem,
            exportData, filterKeys, getAnswerDetail, getQuestionText
        };
    }
});

app.mount('#app');