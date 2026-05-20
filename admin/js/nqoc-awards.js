let currentPage = 1;
const limit = 20;
let totalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    loadData(1);
});

async function loadData(page) {
    if (page < 1 || (page > totalPages && totalPages > 0)) return;
    currentPage = page;
    
    const keyword = document.getElementById('searchKeyword').value;
    const channel = document.getElementById('searchChannel').value;
    const startDate = document.getElementById('searchStartDate').value;
    const endDate = document.getElementById('searchEndDate').value;

    document.getElementById('loadingOverlay').style.display = 'flex';

    try {
        const query = new URLSearchParams({
            page: currentPage,
            limit: limit,
            keyword: keyword || '',
            channel: channel || '',
            startDate: startDate || '',
            endDate: endDate || ''
        });

        const response = await fetch(`/api/admin/nqoc/awards?${query.toString()}`, {
            headers: authHeaders()
        });
        const result = await response.json();
        
        if (result.success) {
            renderTable(result.data);
            updatePagination(result.total, result.page, result.totalPages);
        } else {
            alert(result.error || '获取数据失败');
        }
    } catch (e) {
        console.error(e);
        alert('获取数据失败');
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

function getAwardName(val) {
    const map = {
        '1': '年度优秀新质组织',
        '2': 'AI组织创新奖',
        '3': '动态人效实践奖',
        '4': '组织变革先锋奖'
    };
    return map[val] || val;
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderTable(data) {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-secondary py-4">暂无申报记录</td></tr>';
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');
        
        let fileHtml = '<span class="text-muted small">无附件</span>';
        if (item.fileUrl) {
            fileHtml = `<a href="${item.fileUrl}" target="_blank" class="btn btn-sm btn-outline-primary"><i class="bi bi-download"></i> 下载</a>`;
        }

        tr.innerHTML = `
            <td><div class="fw-bold">${escapeHtml(item.orgName || '-')}</div></td>
            <td>${escapeHtml(item.contactName || '-')}</td>
            <td>${escapeHtml(item.phone || '-')}</td>
            <td><span class="badge bg-info">${escapeHtml(getAwardName(item.awardCategory))}</span></td>
            <td>${formatDate(item.createdAt)}</td>
            <td>${fileHtml}</td>
            <td>
                <select class="form-select form-select-sm" onchange="updateStatus('${item._id}', this.value)">
                    <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>待处理</option>
                    <option value="processing" ${item.status === 'processing' ? 'selected' : ''}>处理中</option>
                    <option value="approved" ${item.status === 'approved' ? 'selected' : ''}>已通过</option>
                    <option value="rejected" ${item.status === 'rejected' ? 'selected' : ''}>已拒绝</option>
                </select>
            </td>
            <td>
                <div class="form-check form-switch d-flex justify-content-center">
                    <input class="form-check-input" type="checkbox" onchange="toggleFrontendDisplay('${item._id}', this.checked)" ${item.showOnFrontend ? 'checked' : ''}>
                </div>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editFrontendDetails('${item._id}', '${escapeHtml(item.orgName || '')}', '${escapeHtml(item.description || '')}', ${item.voteCount || 0})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteRecord('${item._id}')"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updatePagination(total, page, pages) {
    totalPages = pages || 1;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('currentPage').textContent = page;
    document.getElementById('totalPages').textContent = totalPages;
}

function changePage(delta) {
    loadData(currentPage + delta);
}

async function deleteRecord(id) {
    if (!confirm('确定要删除这条申报记录吗？此操作不可恢复。')) return;

    try {
        const response = await fetch(`/api/admin/nqoc/awards/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const result = await response.json();

        if (result.success) {
            alert('删除成功');
            loadData(currentPage);
        } else {
            alert(result.error || '删除失败');
        }
    } catch (e) {
        console.error(e);
        alert('删除失败');
    }
}

async function updateStatus(id, status) {
    try {
        const response = await fetch(`/api/admin/nqoc/awards/${id}/display`, {
            method: 'PUT',
            headers: {
                ...authHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        const result = await response.json();
        if (!result.success) alert(result.error || '状态更新失败');
    } catch (e) {
        console.error(e);
        alert('状态更新失败');
    }
}

async function toggleFrontendDisplay(id, showOnFrontend) {
    try {
        const response = await fetch(`/api/admin/nqoc/awards/${id}/display`, {
            method: 'PUT',
            headers: {
                ...authHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ showOnFrontend })
        });
        const result = await response.json();
        if (!result.success) {
            alert(result.error || '更新失败');
            loadData(currentPage);
        }
    } catch (e) {
        console.error(e);
        alert('更新失败');
        loadData(currentPage);
    }
}

function editFrontendDetails(id, orgName, description, voteCount) {
    const newDescription = prompt(`请输入前端展示的企业介绍 ( ${orgName} )：`, description || '');
    if (newDescription === null) return;
    
    const newVoteCount = prompt(`请输入初始票数 (当前：${voteCount})：`, voteCount);
    if (newVoteCount === null) return;
    
    updateFrontendDetails(id, newDescription, parseInt(newVoteCount) || 0);
}

async function updateFrontendDetails(id, description, voteCount) {
    try {
        const response = await fetch(`/api/admin/nqoc/awards/${id}/display`, {
            method: 'PUT',
            headers: {
                ...authHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ description, voteCount })
        });
        const result = await response.json();
        if (result.success) {
            alert('前端展示信息更新成功！');
            loadData(currentPage);
        } else {
            alert(result.error || '更新失败');
        }
    } catch (e) {
        console.error(e);
        alert('更新失败');
    }
}

function exportData() {
    const keyword = document.getElementById('searchKeyword').value;
    const channel = document.getElementById('searchChannel').value;
    const startDate = document.getElementById('searchStartDate').value;
    const endDate = document.getElementById('searchEndDate').value;

    const query = new URLSearchParams({
        keyword: keyword || '',
        channel: channel || '',
        startDate: startDate || '',
        endDate: endDate || ''
    });

    // We can use window.location.href to trigger download if we have an export endpoint
    // Let's create an export endpoint in server.js
    const url = `/api/admin/nqoc/awards/export?${query.toString()}&token=${sessionStorage.getItem('token')}`;
    window.open(url, '_blank');
}