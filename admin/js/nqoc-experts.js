let currentPage = 1;
const limit = 20;
let totalPages = 1;
let currentData = [];

const ACTIVITY_LABELS = {
    speaker: '研讨会/私董会/论坛分享嘉宾',
    video_interview: '《值得看见》栏目录制',
    case_review: '优秀案例评审',
    standard_making: '新质组织模型标准制定',
    host_visits: '接待企业参观学习研讨',
    writing: '接受约稿撰写',
    general_events: '参加其他相关专业活动'
};

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
            page: currentPage, limit,
            search: search || '', status: status || '',
            startDate: startDate || '', endDate: endDate || ''
        });

        const response = await fetch(`/api/admin/nqoc/experts?${query.toString()}`, { headers: authHeaders() });
        const result = await response.json();

        if (result.success) {
            currentData = result.data || [];
            renderTable(currentData);
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

function resetFilter() {
    document.getElementById('searchKeyword').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('searchStartDate').value = '';
    document.getElementById('searchEndDate').value = '';
    loadData(1);
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
         .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

const statusMap = {
    'pending':   { text: '待处理', cls: 'bg-warning text-dark' },
    'contacted': { text: '已联系', cls: 'bg-info text-white' },
    'rejected':  { text: '已拒绝', cls: 'bg-danger text-white' },
    'approved':  { text: '已通过', cls: 'bg-success text-white' }
};

function renderActivities(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return '<span class="text-muted small">-</span>';
    return arr.slice(0, 2).map(k => {
        const label = ACTIVITY_LABELS[k] || k;
        return `<span class="activity-tag">${escapeHtml(label)}</span>`;
    }).join('') + (arr.length > 2 ? `<span class="text-muted small"> +${arr.length-2}</span>` : '');
}

function renderTable(data) {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-secondary py-4">暂无专家申请记录</td></tr>';
        return;
    }
    data.forEach(item => {
        const s = statusMap[item.status] || statusMap.pending;
        const validPhoto = item.photoUrl && item.photoUrl.length > 5 && !item.photoUrl.includes('undefined');
        const photo = validPhoto
            ? `<img src="${escapeHtml(item.photoUrl)}" class="table-photo" onerror="this.onerror=null;this.className='photo-placeholder';this.outerHTML='<span class=\\'photo-placeholder\\'><i class=\\'bi bi-person\\'></i></span>'" alt="">`
            : '<span class="photo-placeholder"><i class="bi bi-person"></i></span>';
        const privacy = item.privacyConsent
            ? '<span class="badge bg-success privacy-badge">是</span>'
            : '<span class="badge bg-secondary privacy-badge">否</span>';
        const posComp = [item.position, item.company].filter(Boolean).join(' / ') || '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="form-check-input row-checkbox" value="${item._id}" onchange="updateBatchBar()"></td>
            <td>${photo}</td>
            <td><div class="fw-bold">${escapeHtml(item.name || '-')}</div></td>
            <td><div style="max-width:180px">${renderActivities(item.activities)}</div></td>
            <td>${escapeHtml(item.location || '-')}</td>
            <td><div style="max-width:160px" class="text-truncate" title="${escapeHtml(posComp)}">${escapeHtml(posComp)}</div></td>
            <td>${escapeHtml(item.company || '-')}</td>
            <td>${privacy}</td>
            <td>
                <select class="form-select form-select-sm" style="width:100px;display:inline-block" onchange="updateStatus('${item._id}', this.value)">
                    <option value="pending" ${item.status==='pending'?'selected':''}>待处理</option>
                    <option value="contacted" ${item.status==='contacted'?'selected':''}>已联系</option>
                    <option value="approved" ${item.status==='approved'?'selected':''}>已通过</option>
                    <option value="rejected" ${item.status==='rejected'?'selected':''}>已拒绝</option>
                </select>
            </td>
            <td class="small text-muted">${formatDate(item.createdAt)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="viewDetail('${item._id}')"><i class="bi bi-eye"></i></button>
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

function changePage(delta) { loadData(currentPage + delta); }

async function updateStatus(id, newStatus) {
    try {
        const response = await fetch(`/api/admin/nqoc/experts/${id}/status`, {
            method: 'PUT',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const result = await response.json();
        if (!result.success) { alert(result.message || '更新状态失败'); loadData(currentPage); }
    } catch (e) {
        console.error(e); alert('更新状态失败'); loadData(currentPage);
    }
}

async function deleteRecord(id) {
    if (!confirm('确定要删除这条申请记录吗？此操作不可恢复。')) return;
    try {
        const response = await fetch(`/api/admin/nqoc/experts/${id}`, {
            method: 'DELETE', headers: authHeaders()
        });
        const result = await response.json();
        if (result.success) { alert('删除成功'); loadData(currentPage); }
        else alert(result.message || '删除失败');
    } catch (e) { console.error(e); alert('删除失败'); }
}

function viewDetail(id) {
    const item = currentData.find(x => x._id === id);
    if (!item) return;
    const activities = Array.isArray(item.activities) && item.activities.length
        ? item.activities.map(k => `<span class="activity-tag">${escapeHtml(ACTIVITY_LABELS[k] || k)}</span>`).join(' ')
        : '<span class="text-muted">-</span>';
    const validPhoto = item.photoUrl && item.photoUrl.length > 5 && !item.photoUrl.includes('undefined');
    const photo = validPhoto
        ? `<a href="${escapeHtml(item.photoUrl)}" target="_blank"><img src="${escapeHtml(item.photoUrl)}" class="detail-photo" style="max-width:120px; height:auto; border-radius:8px;" onerror="this.style.display='none'" alt="照片"></a>`
        : '<span class="text-muted">未上传照片</span>';

    const renderRow = (label, content) => {
        return `<tr><th style="width:140px;background:#f9fafb;vertical-align:middle;">${label}</th><td style="vertical-align:middle;">${content}</td></tr>`;
    };

    let html = '<table class="table table-bordered table-sm mb-0"><tbody>';
    html += renderRow('01 姓名', escapeHtml(item.name || '-'));
    html += renderRow('02 活动选择', activities);
    html += renderRow('03 常驻地', escapeHtml(item.location || '-'));
    html += renderRow('04 职位名称', escapeHtml(item.position || '-'));
    html += renderRow('05 工作单位', escapeHtml(item.company || '-'));
    html += renderRow('06 电子邮箱', escapeHtml(item.email || '-'));
    html += renderRow('07 个人官方简介', item.bio ? `<div class="rich-content" style="margin:0">${item.bio}</div>` : '-');
    html += renderRow('08 研究领域', escapeHtml(item.researchFields || '-'));
    html += renderRow('09 个人专业著作', escapeHtml(item.publications || '-'));
    html += renderRow('10 课题需求', item.topicNeeds ? `<div class="rich-content" style="margin:0">${item.topicNeeds}</div>` : '-');
    html += renderRow('11 来源/联系人', escapeHtml(item.referrer || '-'));
    html += renderRow('12 个人官方照片', photo);
    html += renderRow('13 隐私说明', item.privacyConsent ? '是 (同意公开)' : '否 (不同意公开)');
    html += renderRow('14 其他声明', escapeHtml(item.otherDeclaration || '-'));
    html += renderRow('提交时间', `<span class="text-muted">${formatDate(item.createdAt)}</span>`);
    html += '</tbody></table>';

    document.getElementById('detailBody').innerHTML = html;
    new bootstrap.Modal(document.getElementById('detailModal')).show();
}

// ===== Batch Operations =====
function getSelectedIds() {
    return Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.value);
}

function updateBatchBar() {
    const ids = getSelectedIds();
    const bar = document.getElementById('batchBar');
    const countEl = document.getElementById('selectedCount');
    const selectAll = document.getElementById('selectAll');
    countEl.textContent = ids.length;
    bar.style.display = ids.length > 0 ? '' : 'none';
    // Sync selectAll state
    if (selectAll) {
        const allCbs = document.querySelectorAll('.row-checkbox');
        const checkedCbs = document.querySelectorAll('.row-checkbox:checked');
        selectAll.checked = allCbs.length > 0 && checkedCbs.length === allCbs.length;
        selectAll.indeterminate = checkedCbs.length > 0 && checkedCbs.length < allCbs.length;
    }
}

function toggleSelectAll(el) {
    document.querySelectorAll('.row-checkbox').forEach(cb => { cb.checked = el.checked; });
    updateBatchBar();
}

function clearSelection() {
    document.querySelectorAll('.row-checkbox').forEach(cb => { cb.checked = false; });
    document.getElementById('selectAll').checked = false;
    document.getElementById('selectAll').indeterminate = false;
    updateBatchBar();
}

async function batchDelete() {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    if (!confirm(`确定要删除选中的 ${ids.length} 条记录吗？此操作不可恢复。`)) return;
    try {
        const response = await fetch('/api/admin/nqoc/experts/batch-delete', {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        const result = await response.json();
        if (result.success) {
            alert(`成功删除 ${result.deletedCount || ids.length} 条记录`);
            clearSelection();
            loadData(currentPage);
        } else {
            alert(result.message || '批量删除失败');
        }
    } catch (e) {
        console.error(e);
        alert('批量删除失败');
    }
}

// CSV Export
function exportCSV() {
    const params = new URLSearchParams({
        search: document.getElementById('searchKeyword').value || '',
        status: document.getElementById('statusFilter').value || '',
        startDate: document.getElementById('searchStartDate').value || '',
        endDate: document.getElementById('searchEndDate').value || '',
        token: sessionStorage.getItem('token') || ''
    });
    window.open(`/api/admin/nqoc/experts/export?${params.toString()}`, '_blank');
}
