
// ================= Appointments Management =================

function loadAppointments(page = 1) {
    window.appointmentCurrentPage = page;
    toggleLoading(true);
    
    const statusFilter = document.getElementById('appointmentStatusFilter')?.value || '';
    const sort = document.getElementById('appointmentSort')?.value || '-1';
    
    fetch(`/api/appointments?page=${page}&limit=10&status=${statusFilter}&sort=${sort}`, { headers: authHeaders() })
    .then(res => res.json())
    .then(data => {
        const tbody = document.getElementById('appointmentsList');
        if (!tbody) return;

        if (data.data && data.data.length > 0) {
            tbody.innerHTML = data.data.map(app => {
                const utm = [app.utm_source, app.utm_medium, app.utm_campaign].filter(Boolean).join(' / ') || '-';
                return `
                <tr>
                    <td>${app.name || '-'}</td>
                    <td>${app.phone || '-'}</td>
                    <td>${app.company || '-'}</td>
                    <td>${app.department || '-'}</td>
                    <td>${app.title || '-'}</td>
                    <td style="max-width: 200px;" class="text-truncate" title="${app.problem || ''}">${app.problem || '-'}</td>
                    <td>${app.source || '-'}</td>
                    <td><span class="badge bg-light text-dark border">${utm}</span></td>
                    <td>
                        <span class="badge bg-${getStatusColor(app.status)}">${getStatusText(app.status)}</span>
                    </td>
                    <td>${new Date(app.createdAt).toLocaleString()}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-success" onclick="updateAppointmentStatus('${app._id}', 'contacted')" title="标记为已联系">
                                <i class="bi bi-telephone"></i>
                            </button>
                            <button class="btn btn-outline-primary" onclick="updateAppointmentStatus('${app._id}', 'completed')" title="标记为已处理">
                                <i class="bi bi-check-lg"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="deleteAppointment('${app._id}')" title="删除">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
                `;
            }).join('');

            // Pagination
            renderAppointmentPagination(data.pagination);
        } else {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4 text-muted">暂无预约记录</td></tr>';
        }
    })
    .catch(err => {
        console.error('Load appointments error:', err);
        showToast('加载预约列表失败', 'error');
    })
    .finally(() => toggleLoading(false));
}

function getStatusColor(status) {
    switch (status) {
        case 'pending': return 'warning';
        case 'contacted': return 'info';
        case 'completed': return 'success';
        default: return 'secondary';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'pending': return '待处理';
        case 'contacted': return '已联系';
        case 'completed': return '已完成';
        default: return '未知';
    }
}

function updateAppointmentStatus(id, status) {
    toggleLoading(true);
    fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('状态更新成功');
            loadAppointments(window.appointmentCurrentPage || 1);
        } else {
            showToast('更新失败: ' + (data.error || '未知错误'), 'error');
        }
    })
    .catch(err => showToast('请求失败', 'error'))
    .finally(() => toggleLoading(false));
}

function deleteAppointment(id) {
    if (!confirm('确定删除该预约记录吗？此操作不可恢复。')) return;
    
    toggleLoading(true);
    fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('删除成功');
            loadAppointments(window.appointmentCurrentPage || 1);
        } else {
            showToast('删除失败: ' + (data.error || '权限不足'), 'error');
        }
    })
    .catch(err => showToast('请求失败', 'error'))
    .finally(() => toggleLoading(false));
}

function renderAppointmentPagination(pagination) {
    if (!pagination) return;
    
    const { total, page, pages } = pagination;
    window.appointmentTotalPages = pages || 1;
    
    const totalEl = document.getElementById('appointmentsTotal');
    if (totalEl) totalEl.textContent = total || 0;
    
    const pageNumEl = document.getElementById('appointmentPageNum');
    if (pageNumEl) pageNumEl.textContent = page || 1;
    
    const totalPagesEl = document.getElementById('appointmentTotalPages');
    if (totalPagesEl) totalPagesEl.textContent = pages || 1;
}

function changeAppointmentPage(delta) {
    const currentPage = window.appointmentCurrentPage || 1;
    const totalPages = window.appointmentTotalPages || 1;
    
    let newPage = currentPage + delta;
    if (newPage < 1) newPage = 1;
    if (newPage > totalPages) newPage = totalPages;
    
    if (newPage !== currentPage) {
        loadAppointments(newPage);
    }
}

// Export function
async function exportAppointments() {
    const statusFilter = document.getElementById('appointmentStatusFilter')?.value || '';
    const sort = document.getElementById('appointmentSort')?.value || '-1';
    const token = sessionStorage.getItem('token');
    const res = await fetch(`/api/appointments/export?status=${encodeURIComponent(statusFilter)}&sort=${encodeURIComponent(sort)}`, {
        headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '导出失败');
        return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'appointments.csv';
    a.click();
    URL.revokeObjectURL(url);
}
