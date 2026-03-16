
// ================= Logs Management =================

let logPage = 1;

function loadLogs(page = 1) {
    logPage = page;
    toggleLoading(true);
    fetch(`/api/logs?page=${page}&limit=20`, { headers: authHeaders() })
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('logList');
            if (!tbody) return;
            
            if (data.logs && data.logs.length > 0) {
                tbody.innerHTML = data.logs.map(log => `
                    <tr>
                        <td>${new Date(log.createdAt).toLocaleString()}</td>
                        <td>${log.operator}</td>
                        <td>${log.action}</td>
                        <td>${log.ip || '-'}</td>
                        <td>${log.details ? JSON.stringify(log.details).substring(0, 50) + (JSON.stringify(log.details).length > 50 ? '...' : '') : '-'}</td>
                    </tr>
                `).join('');
                
                document.getElementById('logPageNum').textContent = page;
                const totalPages = Math.ceil(data.total / 20);
                document.getElementById('logTotalPages').textContent = totalPages || 1;
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">暂无日志</td></tr>';
                document.getElementById('logPageNum').textContent = 1;
                document.getElementById('logTotalPages').textContent = 1;
            }
        })
        .catch(err => {
            console.error('Load logs error:', err);
            showToast('加载日志失败', 'error');
        })
        .finally(() => toggleLoading(false));
}

function changeLogPage(delta) {
    const newPage = logPage + delta;
    if (newPage < 1) return;
    loadLogs(newPage);
}
