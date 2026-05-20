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

        const response = await fetch(`/api/admin/nqoc/whitepaper?${query.toString()}`, {
            headers: authHeaders()
        });
        const result = await response.json();
        
        if (result.success) {
            renderTable(result.data.list);
            updatePagination(result.data.total, result.data.page, result.data.totalPages);
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
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-4">暂无白皮书预约记录</td></tr>';
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td><div class="fw-bold">${escapeHtml(item.name || '-')}</div></td>
            <td>${escapeHtml(item.phone || '-')}</td>
            <td>${escapeHtml(item.email || '-')}</td>
            <td>${escapeHtml(item.company || '-')}</td>
            <td>${escapeHtml(item.position || '-')}</td>
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

async function deleteRecord(id) {
    if (!confirm('确定要删除这条申报记录吗？此操作不可恢复。')) return;

    try {
        const response = await fetch(`/api/admin/nqoc/whitepaper/${id}`, {
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
    const url = `/api/admin/nqoc/whitepaper/export?${query.toString()}&token=${sessionStorage.getItem('token')}`;
    window.open(url, '_blank');
}