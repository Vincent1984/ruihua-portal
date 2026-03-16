
// ================= Appointments Management =================

function loadAppointments(page = 1) {
    window.appointmentCurrentPage = page;
    toggleLoading(true);
    
    fetch(`/api/appointments?page=${page}&limit=10`, { headers: authHeaders() })
    .then(res => res.json())
    .then(data => {
        const tbody = document.getElementById('appointmentList');
        if (!tbody) return;

        if (data.data && data.data.length > 0) {
            tbody.innerHTML = data.data.map(app => `
                <tr>
                    <td>${new Date(app.createdAt).toLocaleString()}</td>
                    <td>${app.name}</td>
                    <td>${app.phone}</td>
                    <td>${app.company || '-'}</td>
                    <td>${app.serviceType || '-'}</td>
                    <td>
                        <span class="badge bg-${getStatusColor(app.status)}">${getStatusText(app.status)}</span>
                    </td>
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
                <tr class="bg-light">
                    <td colspan="7" class="small text-muted py-2 px-4">
                        <i class="bi bi-chat-quote me-2"></i>需求描述: ${app.description || '无'}
                    </td>
                </tr>
            `).join('');

            // Pagination
            renderAppointmentPagination(data.pagination);
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">暂无预约记录</td></tr>';
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
    const container = document.getElementById('appointmentPagination');
    if (!container || !pagination) return;
    
    const { page, pages } = pagination;
    
    let html = '';
    
    // Prev
    html += `<li class="page-item ${page <= 1 ? 'disabled' : ''}">
        <button class="page-link" onclick="loadAppointments(${page - 1})">上一页</button>
    </li>`;
    
    // Pages
    for (let i = 1; i <= pages; i++) {
        if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
            html += `<li class="page-item ${i === page ? 'active' : ''}">
                <button class="page-link" onclick="loadAppointments(${i})">${i}</button>
            </li>`;
        } else if (i === page - 3 || i === page + 3) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }
    
    // Next
    html += `<li class="page-item ${page >= pages ? 'disabled' : ''}">
        <button class="page-link" onclick="loadAppointments(${page + 1})">下一页</button>
    </li>`;
    
    container.innerHTML = html;
}
