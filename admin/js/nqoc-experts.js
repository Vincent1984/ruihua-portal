let currentPage = 1;
const limit = 20;
let totalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    loadData(1);
});

async function loadData(page) {
    if (page < 1 || (page > totalPages && totalPages > 0)) return;
    currentPage = page;
    
    const search = document.getElementById('searchKeyword').value;
    const status = document.getElementById('statusFilter').value;
    const startDate = document.getElementById('searchStartDate').value;
    const endDate = document.getElementById('searchEndDate').value;

    document.getElementById('loadingOverlay').style.display = 'flex';

    try {
        const query = new URLSearchParams({
            page: currentPage,
            limit: limit,
            search: search || '',
            status: status || '',
            startDate: startDate || '',
            endDate: endDate || ''
        });

        const response = await fetch(`/api/admin/nqoc/experts?${query.toString()}`, {
            headers: authHeaders()
        });
        const result = await response.json();
        
        if (result.success) {
            renderTable(result.data);
            updatePagination(result.pagination.total, result.pagination.page, result.pagination.totalPages);
        } else {
            alert(result.message || '获取数据失败');
        }
    } catch (e) {
        console.error(e);
        alert('获取数据失败');
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
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

const statusMap = {
    'pending': { text: '待处理', class: 'bg-warning text-dark' },
    'contacted': { text: '已联系', class: 'bg-info text-white' },
    'rejected': { text: '已拒绝', class: 'bg-danger text-white' },
    'approved': { text: '已通过', class: 'bg-success text-white' }
};

function renderTable(data) {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">暂无专家申请记录</td></tr>';
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td><div class="fw-bold">${escapeHtml(item.name || '-')}</div></td>
            <td>${escapeHtml(item.phone || '-')}</td>
            <td style="max-width: 300px;" class="text-truncate" title="${escapeHtml(item.description || '-')}">${escapeHtml(item.description || '-')}</td>
            <td>
                <select class="form-select form-select-sm" style="width: 100px; display: inline-block;" onchange="updateStatus('${item._id}', this.value)">
                    <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>待处理</option>
                    <option value="contacted" ${item.status === 'contacted' ? 'selected' : ''}>已联系</option>
                    <option value="approved" ${item.status === 'approved' ? 'selected' : ''}>已通过</option>
                    <option value="rejected" ${item.status === 'rejected' ? 'selected' : ''}>已拒绝</option>
                </select>
            </td>
            <td>${formatDate(item.createdAt)}</td>
            <td>
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

async function updateStatus(id, newStatus) {
    try {
        const response = await fetch(`/api/admin/nqoc/experts/${id}/status`, {
            method: 'PUT',
            headers: {
                ...authHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const result = await response.json();
        if (result.success) {
            // Optional: show a small toast, but loadData might reset scroll
            // loadData(currentPage); 
        } else {
            alert(result.message || '更新状态失败');
            loadData(currentPage); // Revert select change
        }
    } catch (e) {
        console.error(e);
        alert('更新状态失败');
        loadData(currentPage); // Revert select change
    }
}

async function deleteRecord(id) {
    if (!confirm('确定要删除这条申请记录吗？此操作不可恢复。')) return;

    try {
        const response = await fetch(`/api/admin/nqoc/experts/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const result = await response.json();

        if (result.success) {
            alert('删除成功');
            loadData(currentPage);
        } else {
            alert(result.message || '删除失败');
        }
    } catch (e) {
        console.error(e);
        alert('删除失败');
    }
}
