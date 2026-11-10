// nqoc-survey.js
let surveyMappings = {};

document.addEventListener('DOMContentLoaded', async () => {
    await loadMappings();
    loadData(1);
    loadChannels();
    loadStats();
});

async function loadMappings() {
    try {
        const response = await fetch('/admin/js/survey_mappings.json');
        surveyMappings = await response.json();
    } catch (e) {
        console.error('加载映射文件失败:', e);
    }
}

function showLoading() { const el = document.getElementById('loadingOverlay'); if (el) el.style.display = 'flex'; }
function hideLoading() { const el = document.getElementById('loadingOverlay'); if (el) el.style.display = 'none'; }

function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('on'), 2200);
}

function openModal(id) { const el = document.getElementById(id); if (el) el.classList.add('show'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('show'); }

function setStat(key, value) {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = value;
}

function shortDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const pad = number => String(number).padStart(2, '0');
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function updateStats(data, total, page) {
    setStat('total', total ?? 0);
    setStat('pageCount', Array.isArray(data) ? data.length : 0);
    setStat('page', page ?? 1);
    setStat('totalPages', Math.max(totalPages, 1));
    const latest = Array.isArray(data) && data.length ? data[0] : null;
    setStat('latest', latest ? shortDateTime(latest.createdAt) : '—');
    setStat('latestWho', latest ? [latest.orgName, latest.respondentName].filter(Boolean).join(' · ') || '—' : '—');
}

// --- Analysis / Funnel ---
async function loadStats() {
    showLoading();
    try {
        const token = sessionStorage.getItem('token');
        const channel = document.getElementById('statSearchChannel')?.value || '';
        const startDate = document.getElementById('statStartDate')?.value || '';
        const endDate = document.getElementById('statEndDate')?.value || '';

        const query = new URLSearchParams();
        if (channel) query.append('channel', channel);
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);

        const response = await fetch(`/api/admin/nqoc/survey/tracking-stats?${query.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            const data = result.data;
            const funnel = data.funnel || [];
            const events = data.events || [];

            const labels = [
                '访问进入页面',
                '第一部分(企业信息)',
                '第二部分(填答人信息)',
                '第三部分(成熟度评估)',
                '第四部分(经营数据)',
                '第五部分(总体评价)',
                '提交成功'
            ];

            const getEventCount = (type) => {
                const e = events.find(x => x.eventType === type);
                return e ? e.userCount : 0;
            };
            const getStepCount = (idx) => {
                const s = funnel.find(x => x.stepIndex === idx);
                return s ? s.userCount : 0;
            };

            let maxViews = getEventCount('page_view');
            funnel.forEach(s => {
                if (s.userCount > maxViews) maxViews = s.userCount;
            });

            const userCounts = [
                maxViews,
                getStepCount(0),
                getStepCount(1),
                getStepCount(2),
                getStepCount(3),
                getStepCount(4),
                getEventCount('submit_success')
            ];

            // 保证漏斗单调递减（展示用）
            for (let i = 1; i < userCounts.length; i++) {
                if (userCounts[i] > userCounts[i - 1] && userCounts[i - 1] !== 0) {
                    userCounts[i] = userCounts[i - 1];
                }
            }

            try {
                const statRes = await fetch(`/api/admin/nqoc/survey/stats?${query.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } });
                const statData = await statRes.json();
                if (statData.success) {
                    document.getElementById('statTotalCount').textContent = statData.data.total;
                }
            } catch (e) {}

            const funnelContainer = document.getElementById('customFunnelContainer');
            if (funnelContainer) {
                const maxCount = Math.max(...userCounts, 1);
                let html = '';
                userCounts.forEach((count, index) => {
                    const label = labels[index];
                    const percentage = Math.max((count / maxCount) * 100, 20);
                    let conversionHtml = '';
                    if (index > 0) {
                        const prevCount = userCounts[index - 1];
                        const rate = prevCount > 0 ? ((count / prevCount) * 100).toFixed(1) : 0;
                        conversionHtml = `<div class="funnel-rate">↓ 转化率 <b>${rate}%</b></div>`;
                    }
                    const opacity = Math.max(1 - (index * 0.1), 0.5);
                    html += `
                        <div class="funnel-step">
                            ${conversionHtml}
                            <div class="funnel-bar" style="width:${percentage}%;opacity:${opacity};" title="${label}">
                                <span>${label}</span>
                                <span class="funnel-count">${count} 人</span>
                            </div>
                        </div>
                    `;
                });
                funnelContainer.innerHTML = html;
            }

            renderFieldDropoffTable(data.fieldStats || [], userCounts[0]);
        }
    } catch (e) {
        console.error('加载分析数据失败:', e);
    } finally {
        hideLoading();
    }
}

function renderFieldDropoffTable(fieldStats, totalPageViews) {
    const tbody = document.getElementById('fieldDropoffTableBody');
    if (!tbody) return;

    if (!fieldStats || fieldStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">暂无字段级埋点数据</td></tr>';
        return;
    }

    const stepModuleMap = {
        1: '企业信息',
        2: '填答人信息',
        3: '成熟度评估',
        4: '经营数据',
        5: '总体评价'
    };

    tbody.innerHTML = fieldStats.map(stat => {
        const moduleName = stepModuleMap[stat.stepIndex] || `步骤 ${stat.stepIndex}`;
        const dropoffRate = totalPageViews > 0
            ? ((totalPageViews - stat.userCount) / totalPageViews * 100).toFixed(1) + '%'
            : '0%';
        return `
            <tr>
                <td><span class="chip n">${moduleName}</span></td>
                <td><span class="mono">${stat.fieldName}</span></td>
                <td>${stat.userCount}</td>
                <td>${totalPageViews - stat.userCount} 人</td>
                <td><b style="color:#b3261e">${dropoffRate}</b></td>
            </tr>
        `;
    }).join('');
}

// --- Submissions Data ---
let currentPage = 1;
let totalPages = 1;
let currentData = [];

async function loadData(page) {
    currentPage = page;
    const token = sessionStorage.getItem('token');
    const orgName = document.getElementById('searchOrgName').value;
    const name = document.getElementById('searchName').value;
    const phone = document.getElementById('searchPhone').value;
    const channel = document.getElementById('searchChannel').value;
    const startDate = document.getElementById('searchStartDate').value;
    const endDate = document.getElementById('searchEndDate').value;

    showLoading();
    try {
        const query = new URLSearchParams({ page, limit: 20 });
        if (orgName) query.append('orgName', orgName);
        if (name) query.append('name', name);
        if (phone) query.append('phone', phone);
        if (channel) query.append('channel', channel);
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);

        const response = await fetch(`/api/admin/nqoc/survey/submissions?${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const res = await response.json();

        if (res.success) {
            currentData = res.data || [];
            totalPages = Math.max(res.totalPages || 1, 1);
            renderTable(currentData);
            updatePager(res.page || page, totalPages, res.total || 0);
            updateStats(currentData, res.total, res.page || page);
        } else {
            toast(res.error || '加载数据失败');
        }
    } catch (e) {
        toast('网络错误');
    } finally {
        hideLoading();
    }
}

function changePage(delta) {
    const next = currentPage + delta;
    if (next < 1 || next > totalPages) return;
    loadData(next);
}

function updatePager(page, pages, total) {
    const totalEl = document.getElementById('totalCount');
    const pageEl = document.getElementById('currentPage');
    const pagesEl = document.getElementById('totalPages');
    const prev = document.getElementById('prevPage');
    const next = document.getElementById('nextPage');
    if (totalEl) totalEl.textContent = total;
    if (pageEl) pageEl.textContent = page;
    if (pagesEl) pagesEl.textContent = pages;
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= pages;
}

// --- QR Code Management ---
function showQRCode(id) {
    const item = channelData.find(row => row._id === id);
    if (!item) return;
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/nqoc/survey?channel=${item.code}`;

    document.getElementById('qrChannelName').textContent = `渠道: ${item.name} (${item.code})`;
    const container = document.getElementById('qrCodeContainer');
    container.innerHTML = '';

    openModal('qrCodeModal');

    new QRCode(container, {
        text: link,
        width: 300,
        height: 300,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

function downloadQRCode() {
    const container = document.getElementById('qrCodeContainer');
    const canvas = container.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `NQOC_Survey_QR.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function renderTable(data) {
    const tbody = document.getElementById('dataTableBody');
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">暂无问卷数据</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(item => `
        <tr>
            <td>
                <div class="person">${item.orgName || '—'}</div>
                <span class="sub">${item.industry || '行业未填'}</span>
            </td>
            <td><span class="chip n">${item.channel === 'organic' ? '自然流量' : (item.channel || 'organic')}</span></td>
            <td>
                <div>${item.employeeCount || '—'}</div>
                <span class="sub">营收 ${item.revenue || '—'}</span>
            </td>
            <td>
                <div>${item.orgNature || '—'}</div>
                <span class="sub">${item.listingStatus || '—'}</span>
            </td>
            <td>${item.establishedYears || '—'}</td>
            <td>
                <div>${item.respondentName || '—'}</div>
                <span class="sub">${item.respondentTitle || '—'}</span>
            </td>
            <td><span class="mono">${item.respondentContact || '—'}</span></td>
            <td><span class="mono">${shortDateTime(item.createdAt)}</span></td>
            <td>
                <div class="row-actions">
                    <button type="button" onclick="showDetails('${item._id}')">详情</button>
                    <button type="button" class="danger" onclick="deleteRecord('${item._id}')">删除</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function detailSection(title, items) {
    const list = items.map(([question, answer, full]) => `
        <div class="detail-item${full ? ' full' : ''}">
            <span>${question}</span>
            <b>${answer === undefined || answer === null || answer === '' ? '-' : answer}</b>
        </div>
    `).join('');
    return `<section class="detail-section"><h3>${title}</h3><div class="detail-grid">${list}</div></section>`;
}

function showDetails(id) {
    const item = currentData.find(d => d._id === id);
    if (!item) return;

    const m = surveyMappings;
    const getVal = (val, otherVal) => {
        if (!val) return '-';
        if (Array.isArray(val)) {
            let res = val.join('、');
            if (val.some(v => v && v.includes('其他')) && otherVal) res += ` (${otherVal})`;
            return res;
        }
        if (typeof val === 'string' && val.includes('其他') && otherVal) return `${val} (${otherVal})`;
        return val;
    };

    const matrix = (prefix, fields, otherKey) => fields.map(([code, key]) => [m[code] || code, getVal(item[key])])
        .concat(otherKey ? [[m[prefix] || prefix, getVal(item[otherKey.key], item[otherKey.other]), true]] : []);

    const html = [
        detailSection('第一部分 企业基本信息', [
            [m['E1'] || 'E1. 企业名称', getVal(item.orgName)],
            [m['E2'] || 'E2. 所属行业', getVal(item.industry, item.industry_other)],
            [m['E3'] || 'E3. 企业性质', getVal(item.orgNature, item.orgNature_other)],
            [m['E4'] || 'E4. 员工总人数', getVal(item.employeeCount)],
            [m['E5'] || 'E5. 营收规模', getVal(item.revenue)],
            [m['E6'] || 'E6. 成立年限', getVal(item.establishedYears)],
            [m['E7'] || 'E7. 上市状态', getVal(item.listingStatus)],
            [m['E8'] || 'E8. AI部门状态', getVal(item.aiDeptStatus)]
        ]),
        detailSection('第二部分 填答人信息', [
            [m['R1'] || 'R1. 职务', getVal(item.respondentTitle, item.respondentTitle_other)],
            [m['R2'] || 'R2. 任职年限', getVal(item.respondentTenure)],
            [m['R3'] || 'R3. 姓名', getVal(item.respondentName)],
            [m['R4'] || 'R4. 联系方式(手机号)', getVal(item.respondentContact)],
            [m['R5'] || 'R5. 邮箱', getVal(item.respondentEmail)]
        ]),
        detailSection('第三部分 维度一：核心价值观', matrix('V-O1', [
            ['V1.1.1', 'v1_1_1'], ['V1.1.2', 'v1_1_2'], ['V1.2.1', 'v1_2_1'], ['V1.2.2', 'v1_2_2'],
            ['V1.3.1', 'v1_3_1'], ['V1.3.2', 'v1_3_2'], ['V1.3.3', 'v1_3_3'], ['V1.4.1', 'v1_4_1'],
            ['V1.4.2', 'v1_4_2'], ['V1.5.1', 'v1_5_1'], ['V1.5.2', 'v1_5_2']
        ])),
        detailSection('第三部分 维度二：商业模式', matrix('B-O1', [
            ['B2.1.1', 'b2_1_1'], ['B2.1.2', 'b2_1_2'], ['B2.2.1', 'b2_2_1'], ['B2.2.2', 'b2_2_2'],
            ['B2.2.3', 'b2_2_3'], ['B2.3.1', 'b2_3_1'], ['B2.3.2', 'b2_3_2'], ['B2.4.1', 'b2_4_1'],
            ['B2.4.2', 'b2_4_2'], ['B2.5.1', 'b2_5_1'], ['B2.5.2', 'b2_5_2'], ['B2.6.1', 'b2_6_1'],
            ['B2.6.2', 'b2_6_2'], ['B2.7.1', 'b2_7_1']
        ], { key: 'b_o1', other: 'b_o1_other' })),
        detailSection('第三部分 维度三：生产方式', matrix('P-O1', [
            ['P3.1.1', 'p3_1_1'], ['P3.1.2', 'p3_1_2'], ['P3.2.1', 'p3_2_1'], ['P3.2.2', 'p3_2_2'],
            ['P3.3.1', 'p3_3_1'], ['P3.3.2', 'p3_3_2'], ['P3.4.1', 'p3_4_1'], ['P3.4.2', 'p3_4_2'],
            ['P3.5.1', 'p3_5_1'], ['P3.5.2', 'p3_5_2'], ['P3.6.1', 'p3_6_1'], ['P3.6.2', 'p3_6_2'],
            ['P3.7.1', 'p3_7_1']
        ], { key: 'p_o1', other: 'p_o1_other' })),
        detailSection('第三部分 维度四：管理范式', matrix('M-O1', [
            ['M4.1.1', 'm4_1_1'], ['M4.1.2', 'm4_1_2'], ['M4.2.1', 'm4_2_1'], ['M4.2.2', 'm4_2_2'],
            ['M4.3.1', 'm4_3_1'], ['M4.3.2', 'm4_3_2'], ['M4.4.1', 'm4_4_1'], ['M4.4.2', 'm4_4_2'],
            ['M4.5.1', 'm4_5_1'], ['M4.5.2', 'm4_5_2'], ['M4.5.3', 'm4_5_3'], ['M4.5.4', 'm4_5_4'],
            ['M4.6.1', 'm4_6_1'], ['M4.6.2', 'm4_6_2'], ['M4.6.3', 'm4_6_3'], ['M4.7.1', 'm4_7_1']
        ], { key: 'm_o1', other: 'm_o1_other' })),
        detailSection('第三部分 维度五：生态协同', matrix('E-O1', [
            ['E5.1.1', 'e5_1_1'], ['E5.1.2', 'e5_1_2'], ['E5.2.1', 'e5_2_1'], ['E5.2.2', 'e5_2_2'],
            ['E5.3.1', 'e5_3_1'], ['E5.3.2', 'e5_3_2'], ['E5.4.1', 'e5_4_1'], ['E5.4.2', 'e5_4_2'],
            ['E5.5.1', 'e5_5_1'], ['E5.5.2', 'e5_5_2'], ['E5.6.1', 'e5_6_1']
        ], { key: 'e_o1', other: 'e_o1_other' })),
        detailSection('第四部分 客观数据参照', [
            [m['O1.1'] || 'O1.1. 研发投入比例', getVal(item.o1_1)],
            [m['O1.2'] || 'O1.2. ESG披露', getVal(item.o1_2)],
            [m['O2.1'] || 'O2.1. 新产品/新业务收入比例', getVal(item.o2_1)],
            [m['O2.2'] || 'O2.2. 核心业务毛利率相对水平', getVal(item.o2_2)],
            [m['O2.3'] || 'O2.3. 数智化产品收入比例', getVal(item.o2_3)],
            [m['O3.1'] || 'O3.1. AI年度投入比例', getVal(item.o3_1)],
            [m['O3.2'] || 'O3.2. 常态化AI员工比例', getVal(item.o3_2)],
            [m['O3.3'] || 'O3.3. 人均营收复合增长率', getVal(item.o3_3)],
            [m['O4.1'] || 'O4.1. 管理层级数', getVal(item.o4_1)],
            [m['O4.2'] || 'O4.2. 跨职能团队成员比例', getVal(item.o4_2)],
            [m['O4.3'] || 'O4.3. AI/数据岗位员工比例', getVal(item.o4_3)],
            [m['O5.1'] || 'O5.1. 生态共同收入比例', getVal(item.o5_1)],
            [m['O5.2'] || 'O5.2. 联合创新项目数量', getVal(item.o5_2)]
        ]),
        detailSection('第五部分 总体评价与综合反馈', [
            [m['S1'] || 'S1. 总体成熟度评价', getVal(item.s1), true],
            [m['S2'] || 'S2. 最强的两个维度', getVal(item.s2), true],
            [m['S3'] || 'S3. 最薄弱的两个维度', getVal(item.s3), true],
            [m['S4'] || 'S4. 显著进展', getVal(item.s4, item.s4_other), true],
            [m['S5'] || 'S5. 最大挑战', getVal(item.s5, item.s5_other), true],
            [m['S6'] || 'S6. 需补强能力', getVal(item.s6, item.s6_other), true],
            [m['S7'] || 'S7. 深度访谈意愿', getVal(item.s7), true]
        ])
    ].join('');

    document.getElementById('surveyDetailsBody').innerHTML = html;
    openModal('surveyDetailsModal');
}

async function deleteRecord(id) {
    if (!confirm('确定要删除这条调研记录吗？删除后不可恢复。')) return;

    const token = sessionStorage.getItem('token');
    showLoading();
    try {
        const response = await fetch(`/api/admin/nqoc/survey/submissions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const res = await response.json();
        if (res.success) {
            toast('记录已删除');
            loadData(currentPage);
        } else {
            toast(res.error || '删除失败');
        }
    } catch (e) {
        toast('网络错误');
    } finally {
        hideLoading();
    }
}

async function exportData() {
    const orgName = document.getElementById('searchOrgName').value;
    const name = document.getElementById('searchName').value;
    const phone = document.getElementById('searchPhone').value;
    const channel = document.getElementById('searchChannel').value;
    const startDate = document.getElementById('searchStartDate').value;
    const endDate = document.getElementById('searchEndDate').value;

    const query = new URLSearchParams();
    if (orgName) query.append('orgName', orgName);
    if (name) query.append('name', name);
    if (phone) query.append('phone', phone);
    if (channel) query.append('channel', channel);
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);

    const url = `/api/admin/nqoc/survey/submissions/export?${query.toString()}`;
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
        a.download = `调研问卷_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
        toast('导出已开始');
    } catch (e) {
        toast('导出失败: ' + e.message);
    }
}

// --- Channels Management ---
let channelData = [];

async function loadChannels() {
    const token = sessionStorage.getItem('token');
    try {
        const response = await fetch('/api/admin/nqoc/survey/channels', {
            headers: { 'Authorization': `Bearer ${token}` }
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
    const statSelect = document.getElementById('statSearchChannel');
    const dataSelect = document.getElementById('searchChannel');

    const optionsHtml = '<option value="">所有渠道 (不限)</option><option value="organic">自然流量 (organic)</option>' +
        data.map(item => `<option value="${item.code}">${item.name} (${item.code})</option>`).join('');

    [statSelect, dataSelect].forEach(select => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = optionsHtml;
        select.value = currentVal;
    });
}

function renderChannelTable(data) {
    const tbody = document.getElementById('channelTableBody');
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">暂无渠道数据</td></tr>';
        return;
    }

    const baseUrl = window.location.origin;
    tbody.innerHTML = data.map(item => `
        <tr>
            <td><div class="person">${item.name}</div></td>
            <td><span class="chip n">${item.code}</span></td>
            <td>${item.description || '-'}</td>
            <td>
                <div class="link-cell">
                    <input type="text" value="${baseUrl}/nqoc/survey?channel=${item.code}" readonly id="link-${item.code}">
                    <button type="button" onclick="copyLink('link-${item.code}')">复制</button>
                </div>
            </td>
            <td><button type="button" class="row-qr" onclick="showQRCode('${item._id}')">二维码</button></td>
            <td><span class="mono">${shortDateTime(item.createdAt)}</span></td>
            <td>
                <div class="row-actions">
                    <button type="button" onclick="editChannel('${item._id}')">编辑</button>
                    <button type="button" class="danger" onclick="deleteChannel('${item._id}')">删除</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function copyLink(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(() => toast('链接已复制'), () => toast('复制失败，请手动复制'));
    } else {
        document.execCommand('copy');
        toast('链接已复制');
    }
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

    if (!name || !code) { toast('请填写渠道名称和代码'); return; }

    const token = sessionStorage.getItem('token');
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/nqoc/survey/channels/${id}` : '/api/admin/nqoc/survey/channels';

    showLoading();
    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, code, description })
        });
        const res = await response.json();
        if (res.success) {
            closeModal('channelModal');
            toast('渠道已保存');
            loadChannels();
        } else {
            toast(res.error || '保存失败');
        }
    } catch (e) {
        toast('网络错误');
    } finally {
        hideLoading();
    }
}

async function deleteChannel(id) {
    if (!confirm('确定要删除此渠道吗？（删除渠道不会影响已提交的问卷数据）')) return;

    const token = sessionStorage.getItem('token');
    showLoading();
    try {
        const response = await fetch(`/api/admin/nqoc/survey/channels/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const res = await response.json();
        if (res.success) {
            toast('渠道已删除');
            loadChannels();
        } else {
            toast(res.error || '删除失败');
        }
    } catch (e) {
        toast('网络错误');
    } finally {
        hideLoading();
    }
}
