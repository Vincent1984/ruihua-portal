let currentPage = 1;
const limit = 20;
let totalPages = 1;
let currentData = [];
let channelData = [];
let feEditId = '';

document.addEventListener('DOMContentLoaded', () => {
    loadData(1);
    loadChannels();
});

function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('on'), 2200);
}

function setStat(key, value) {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = value;
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('show');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
}

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
            updateStats(result.data, result.total, result.page);
        } else {
            toast(result.error || '获取数据失败');
        }
    } catch (e) {
        console.error(e);
        toast('获取数据失败');
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
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function shortDateTime(dateString) {
    if (!dateString) return '—';
    const value = new Date(dateString);
    if (Number.isNaN(value.getTime())) return '—';
    const pad = n => String(n).padStart(2, '0');
    return `${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function renderTable(data) {
    const tbody = document.getElementById('dataTableBody');
    currentData = Array.isArray(data) ? data : [];
    tbody.innerHTML = '';

    if (!currentData.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">暂无申报记录</td></tr>';
        return;
    }

    tbody.innerHTML = currentData.map(item => {
        const id = escapeHtml(item._id);
        const fileHtml = item.fileUrl
            ? `<a class="row-link" href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener">下载附件</a>`
            : '<span class="sub">无附件</span>';

        return `
            <tr>
                <td><div class="person">${escapeHtml(item.orgName || '—')}</div></td>
                <td><span class="chip n">${item.channel === 'organic' || !item.channel ? '自然流量' : escapeHtml(item.channel)}</span></td>
                <td><div>${escapeHtml(item.contactName || '—')}</div><span class="sub">${escapeHtml(item.phone || '—')}</span></td>
                <td><span class="chip w">${escapeHtml(getAwardName(item.awardCategory))}</span></td>
                <td><div class="mono">${formatDate(item.createdAt)}</div></td>
                <td>${fileHtml}</td>
                <td>
                    <select onchange="updateStatus('${id}', this.value)">
                        <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>待处理</option>
                        <option value="processing" ${item.status === 'processing' ? 'selected' : ''}>处理中</option>
                        <option value="approved" ${item.status === 'approved' ? 'selected' : ''}>已通过</option>
                        <option value="rejected" ${item.status === 'rejected' ? 'selected' : ''}>已拒绝</option>
                    </select>
                </td>
                <td><button class="expert-switch ${item.showOnFrontend ? 'on' : ''}" type="button" onclick="toggleFrontendDisplay('${id}', ${item.showOnFrontend ? 'false' : 'true'})" aria-label="前端展示开关"></button></td>
                <td>
                    <div class="row-actions">
                        <button type="button" onclick="editFrontendDetails('${id}')">编辑</button>
                        <button type="button" class="danger" onclick="deleteRecord('${id}')">删除</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updatePagination(total, page, pages) {
    totalPages = pages || 1;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('currentPage').textContent = page;
    document.getElementById('totalPages').textContent = totalPages;
}

function updateStats(data, total, page) {
    setStat('total', total || 0);
    setStat('page', page || currentPage);
    setStat('totalPages', totalPages);
    setStat('limit', limit);
    setStat('pageCount', data ? data.length : 0);

    const latest = data && data.length ? data[0] : null;
    setStat('latest', latest ? shortDateTime(latest.createdAt) : '—');
    setStat('latestWho', latest ? [latest.orgName || '匿名', latest.contactName].filter(Boolean).join(' · ') : '本页暂无记录');
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
            toast('记录已删除');
            loadData(currentPage);
        } else {
            toast(result.error || '删除失败');
        }
    } catch (e) {
        console.error(e);
        toast('删除失败');
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
        if (result.success) {
            toast('状态已更新');
        } else {
            toast(result.error || '状态更新失败');
        }
    } catch (e) {
        console.error(e);
        toast('状态更新失败');
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
        if (result.success) {
            toast(showOnFrontend ? '已在前端展示' : '已取消前端展示');
            loadData(currentPage);
        } else {
            toast(result.error || '更新失败');
            loadData(currentPage);
        }
    } catch (e) {
        console.error(e);
        toast('更新失败');
        loadData(currentPage);
    }
}

function editFrontendDetails(id) {
    const item = currentData.find(row => row._id === id) || {};
    feEditId = id;
    document.getElementById('feOrgName').textContent = item.orgName || '—';
    document.getElementById('feDescription').value = item.description || '';
    document.getElementById('feVoteCount').value = item.voteCount || 0;
    openModal('feModal');
}

function submitFeDetails() {
    if (!feEditId) return;
    const description = document.getElementById('feDescription').value;
    const voteCount = parseInt(document.getElementById('feVoteCount').value, 10) || 0;
    updateFrontendDetails(feEditId, description, voteCount);
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
            closeModal('feModal');
            toast('前端展示信息已更新');
            loadData(currentPage);
        } else {
            toast(result.error || '更新失败');
        }
    } catch (e) {
        console.error(e);
        toast('更新失败');
    }
}

async function exportData() {
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

    const url = `/api/admin/nqoc/awards/export?${query.toString()}`;
    try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) {
            toast('导出失败，请稍后重试');
            return;
        }
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `申报管理_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
        toast('导出已开始');
    } catch (e) {
        toast('导出失败: ' + e.message);
    }
}

// --- Channel Management ---

async function loadChannels() {
    try {
        const response = await fetch('/api/admin/nqoc/awards/channels', {
            headers: authHeaders()
        });
        const res = await response.json();
        if (res.success) {
            channelData = res.data || [];
            renderChannelTable(channelData);
            populateChannelSelects(channelData);
        }
    } catch (e) {
        console.error('Failed to load channels', e);
    }
}

function populateChannelSelects(data) {
    const dataSelect = document.getElementById('searchChannel');
    if (!dataSelect) return;

    const currentVal = dataSelect.value;
    const optionsHtml = '<option value="">所有渠道 (不限)</option><option value="organic">自然流量 (organic)</option>' +
        data.map(item => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.name)} (${escapeHtml(item.code)})</option>`).join('');

    dataSelect.innerHTML = optionsHtml;
    dataSelect.value = currentVal;
}

function renderChannelTable(data) {
    const tbody = document.getElementById('channelTableBody');
    if (!tbody) return;
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无渠道数据</td></tr>';
        return;
    }

    const baseUrl = window.location.origin;

    tbody.innerHTML = data.map(item => {
        const id = escapeHtml(item._id);
        return `
        <tr>
            <td><div class="person">${escapeHtml(item.name)}</div></td>
            <td><span class="chip n">${escapeHtml(item.code)}</span></td>
            <td>${escapeHtml(item.description || '—')}</td>
            <td>
                <div class="link-cell">
                    <input type="text" value="${baseUrl}/nqoc/awards?channel=${escapeHtml(item.code)}" readonly id="link-${escapeHtml(item.code)}">
                    <button type="button" onclick="copyLink('link-${escapeHtml(item.code)}')">复制</button>
                </div>
            </td>
            <td><button type="button" onclick="showQRCode('${id}')">二维码</button></td>
            <td><span class="chip">${item.submissionCount || 0}</span></td>
            <td><div class="mono">${formatDate(item.createdAt)}</div></td>
            <td>
                <div class="row-actions">
                    <button type="button" onclick="editChannel('${id}')">编辑</button>
                    <button type="button" class="danger" onclick="deleteChannel('${id}')">删除</button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function copyLink(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.select();
    document.execCommand('copy');
    toast('链接已复制到剪贴板');
}

function showChannelModal() {
    document.getElementById('channelForm').reset();
    document.getElementById('channelId').value = '';
    document.getElementById('channelModalTitle').textContent = '新增渠道';
    openModal('channelModal');
}

function editChannel(id) {
    const item = channelData.find(row => row._id === id);
    if (!item) return;
    document.getElementById('channelId').value = item._id;
    document.getElementById('channelName').value = item.name || '';
    document.getElementById('channelCode').value = item.code || '';
    document.getElementById('channelDescription').value = item.description || '';
    document.getElementById('channelModalTitle').textContent = '编辑渠道';
    openModal('channelModal');
}

async function saveChannel() {
    const id = document.getElementById('channelId').value;
    const name = document.getElementById('channelName').value;
    const code = document.getElementById('channelCode').value;
    const description = document.getElementById('channelDescription').value;

    if (!name || !code) return toast('请填写渠道名称和代码');

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/nqoc/awards/channels/${id}` : '/api/admin/nqoc/awards/channels';

    try {
        const response = await fetch(url, {
            method,
            headers: {
                ...authHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, code, description })
        });
        const res = await response.json();

        if (res.success) {
            closeModal('channelModal');
            toast(id ? '渠道已更新' : '渠道已创建');
            loadChannels();
        } else {
            toast(res.error || '保存失败');
        }
    } catch (e) {
        toast('网络错误');
    }
}

async function deleteChannel(id) {
    if (!confirm('确定要删除此渠道吗？')) return;

    try {
        const response = await fetch(`/api/admin/nqoc/awards/channels/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const res = await response.json();
        if (res.success) {
            toast('渠道已删除');
            loadChannels();
        } else {
            toast('删除失败');
        }
    } catch (e) {
        toast('网络错误');
    }
}

// --- QR Code Management ---

function showQRCode(id) {
    const item = channelData.find(row => row._id === id);
    if (!item) return;
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/nqoc/awards?channel=${item.code}`;

    document.getElementById('qrChannelName').textContent = `渠道: ${item.name} (${item.code})`;
    const container = document.getElementById('qrCodeContainer');
    container.innerHTML = '';

    openModal('qrCodeModal');

    new QRCode(container, {
        text: link,
        width: 300,
        height: 300,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
}

function downloadQRCode() {
    const container = document.getElementById('qrCodeContainer');
    const canvas = container.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `NQOC_Awards_QR.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}
