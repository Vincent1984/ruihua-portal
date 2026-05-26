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

function showLoading() { document.getElementById('loadingOverlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; }

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

            // Aggregate total views correctly from page_view and any step interactions if page_view was missed
            let maxViews = getEventCount('page_view');
            funnel.forEach(s => {
                if (s.userCount > maxViews) maxViews = s.userCount;
            });

            const userCounts = [
                maxViews, // 访问进入页面
                getStepCount(0), // 第一部分(企业信息)
                getStepCount(1), // 第二部分(填答人信息)
                getStepCount(2), // 第三部分(成熟度评估)
                getStepCount(3), // 第四部分(经营数据)
                getStepCount(4), // 第五部分(总体评价)
                getEventCount('submit_success') // 提交成功
            ];
            
            // Ensure funnel monotonicity (display purpose)
            for (let i = 1; i < userCounts.length; i++) {
                if (userCounts[i] > userCounts[i-1] && userCounts[i-1] !== 0) {
                    // Soften anomalies
                    userCounts[i] = userCounts[i-1];
                }
            }

            // Also load overall stats for total counts
            try {
                const statRes = await fetch(`/api/admin/nqoc/survey/stats?${query.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } });
                const statData = await statRes.json();
                if (statData.success) {
                    document.getElementById('statTotalCount').textContent = statData.data.total;
                }
            } catch(e) {}

            // Render Custom HTML Funnel Chart
            const funnelContainer = document.getElementById('customFunnelContainer');
            if (funnelContainer) {
                let html = '<div class="funnel-container w-100">';
                const maxCount = Math.max(...userCounts, 1);
                
                userCounts.forEach((count, index) => {
                    const label = labels[index];
                    // Calculate relative width based on max count, ensure a minimum width for readability
                    const percentage = Math.max((count / maxCount) * 100, 20); 
                    
                    let conversionHtml = '';
                    if (index > 0) {
                        const prevCount = userCounts[index - 1];
                        const rate = prevCount > 0 ? ((count / prevCount) * 100).toFixed(1) : 0;
                        conversionHtml = `
                            <div class="funnel-rate">
                                <i class="bi bi-arrow-down-short"></i> 转化率 <strong>${rate}%</strong>
                            </div>
                        `;
                    }
                    
                    // Decrease opacity progressively for lower steps, keeping it legible
                    const opacity = Math.max(1 - (index * 0.1), 0.5);
                    
                    html += `
                        <div class="funnel-step-wrapper">
                            ${conversionHtml}
                            <div class="funnel-bar" style="width: ${percentage}%; opacity: ${opacity};">
                                <span class="fw-bold text-truncate me-2" title="${label}">${label}</span>
                                <span class="badge bg-white text-primary rounded-pill px-3 py-2 shadow-sm">${count} 人</span>
                            </div>
                        </div>
                    `;
                });
                
                html += '</div>';
                funnelContainer.innerHTML = html;
            }

            // Populate Field Dropoff Table
            const fieldStats = data.fieldStats || [];
            renderFieldDropoffTable(fieldStats, userCounts[0]);
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
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">暂无字段级埋点数据</td></tr>';
        return;
    }

    // Since we need to know module names, let's roughly map step to module
    const stepModuleMap = {
        1: '企业信息',
        2: '填答人信息',
        3: '成熟度评估',
        4: '经营数据',
        5: '总体评价'
    };

    let html = '';
    fieldStats.forEach(stat => {
        // Find the step count to calculate step dropoff correctly
        // stat.userCount is how many users interacted with this field
        const moduleName = stepModuleMap[stat.stepIndex] || `步骤 ${stat.stepIndex}`;
        
        // Single field dropoff rate vs total page views (or vs step total)
        // We'll calculate "单题流失率" as (Total - thisFieldUserCount) / Total
        const dropoffRate = totalPageViews > 0 
            ? ((totalPageViews - stat.userCount) / totalPageViews * 100).toFixed(1) + '%' 
            : '0%';

        html += `
            <tr>
                <td class="ps-4"><span class="badge bg-light text-dark border">${moduleName}</span></td>
                <td><code class="text-primary">${stat.fieldName}</code></td>
                <td>${stat.userCount}</td>
                <td>${totalPageViews - stat.userCount} 人</td>
                <td class="pe-4 text-danger">${dropoffRate}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// --- Submissions Data ---
let currentPage = 1;
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
        const query = new URLSearchParams({
            page, limit: 20
        });
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
            currentData = res.data;
            renderTable(res.data);
            renderPagination(res.page, res.totalPages);
        } else {
            alert(res.error || '加载数据失败');
        }
    } catch (e) {
        alert('网络错误');
    } finally {
        hideLoading();
    }
}

// --- QR Code Management ---
let qrModal;
function showQRCode(name, code) {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/nqoc/survey?channel=${code}`;
    
    document.getElementById('qrChannelName').textContent = `渠道: ${name} (${code})`;
    const container = document.getElementById('qrCodeContainer');
    container.innerHTML = ''; // clear old

    if (!qrModal) qrModal = new bootstrap.Modal(document.getElementById('qrCodeModal'));
    qrModal.show();

    // Generate clean QR code using QRCode.js directly in container
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
    link.download = `NQOC_Survey_QR.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function renderTable(data) {
    const tbody = document.getElementById('dataTableBody');
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">暂无数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(item => `
        <tr>
            <td>
                <div class="fw-bold">${item.orgName}</div>
            </td>
            <td><span class="badge bg-info text-dark">${item.channel === 'organic' ? '自然流量' : (item.channel || 'organic')}</span></td>
            <td><span class="badge bg-light text-dark border">${item.industry}</span></td>
            <td>${item.employeeCount}</td>
            <td>${item.orgNature || '-'}</td>
            <td>${item.revenue || '-'}</td>
            <td>${item.establishedYears || '-'}</td>
            <td>${item.listingStatus || '-'}</td>
            <td>${item.respondentName || '-'}</td>
            <td>${item.respondentTitle}</td>
            <td>${item.respondentContact || '-'}</td>
            <td class="text-muted small">${new Date(item.createdAt).toLocaleString('zh-CN')}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="showDetails('${item._id}')" title="查看详情"><i class="bi bi-eye"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteRecord('${item._id}')" title="删除"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderPagination(page, totalPages) {
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    html += `<li class="page-item ${page === 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); loadData(${page - 1})">上一页</a></li>`;
    for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${page === i ? 'active' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); loadData(${i})">${i}</a></li>`;
    }
    html += `<li class="page-item ${page === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); loadData(${page + 1})">下一页</a></li>`;
    
    pagination.innerHTML = html;
}

function showDetails(id) {
    const item = currentData.find(d => d._id === id);
    if (!item) return;

    const m = surveyMappings;
    const getVal = (val, otherVal) => {
        if (!val) return '-';
        if (Array.isArray(val)) {
            let res = val.join('、');
            if (val.some(v => v && v.includes('其他')) && otherVal) {
                res += ` (${otherVal})`;
            }
            return res;
        }
        if (typeof val === 'string' && val.includes('其他') && otherVal) {
            return `${val} (${otherVal})`;
        }
        return val;
    };

    const html = `
        <h6 class="text-primary border-bottom pb-2 mb-3">第一部分 企业基本信息</h6>
        <div class="row mb-4">
            <div class="col-md-6 mb-2"><strong>${m['E1'] || 'E1. 企业名称'}：</strong> <br> ${getVal(item.orgName)}</div>
            <div class="col-md-6 mb-2"><strong>${m['E2'] || 'E2. 所属行业'}：</strong> <br> ${getVal(item.industry, item.industry_other)}</div>
            <div class="col-md-6 mb-2"><strong>${m['E3'] || 'E3. 企业性质'}：</strong> <br> ${getVal(item.orgNature, item.orgNature_other)}</div>
            <div class="col-md-6 mb-2"><strong>${m['E4'] || 'E4. 员工总人数'}：</strong> <br> ${getVal(item.employeeCount)}</div>
            <div class="col-md-6 mb-2"><strong>${m['E5'] || 'E5. 营收规模'}：</strong> <br> ${getVal(item.revenue)}</div>
            <div class="col-md-6 mb-2"><strong>${m['E6'] || 'E6. 成立年限'}：</strong> <br> ${getVal(item.establishedYears)}</div>
            <div class="col-md-6 mb-2"><strong>${m['E7'] || 'E7. 上市状态'}：</strong> <br> ${getVal(item.listingStatus)}</div>
            <div class="col-md-6 mb-2"><strong>${m['E8'] || 'E8. AI部门状态'}：</strong> <br> ${getVal(item.aiDeptStatus)}</div>
        </div>
        
        <h6 class="text-primary border-bottom pb-2 mb-3">第二部分 填答人信息</h6>
        <div class="row mb-4">
            <div class="col-md-6 mb-2"><strong>${m['R1'] || 'R1. 职务'}：</strong> <br> ${getVal(item.respondentTitle, item.respondentTitle_other)}</div>
            <div class="col-md-6 mb-2"><strong>${m['R2'] || 'R2. 任职年限'}：</strong> <br> ${getVal(item.respondentTenure)}</div>
            <div class="col-md-6 mb-2"><strong>${m['R3'] || 'R3. 姓名'}：</strong> <br> ${getVal(item.respondentName)}</div>
            <div class="col-md-6 mb-2"><strong>${m['R4'] || 'R4. 联系方式(手机号)'}：</strong> <br> ${getVal(item.respondentContact)}</div>
            <div class="col-md-6 mb-2"><strong>${m['R5'] || 'R5. 邮箱'}：</strong> <br> ${getVal(item.respondentEmail)}</div>
        </div>

        <h6 class="text-primary border-bottom pb-2 mb-3">第三部分 新质组织成熟度评估 (矩阵单选)</h6>
        
        <div class="mb-3"><strong>维度一：核心价值观</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-12 mb-1">${m['V1.1.1']}: <strong>${item.v1_1_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['V1.1.2']}: <strong>${item.v1_1_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['V1.2.1']}: <strong>${item.v1_2_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['V1.2.2']}: <strong>${item.v1_2_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['V1.3.1']}: <strong>${item.v1_3_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['V1.3.2']}: <strong>${item.v1_3_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['V1.3.3']}: <strong>${item.v1_3_3 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['V1.4.1']}: <strong>${item.v1_4_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['V1.4.2']}: <strong>${item.v1_4_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['V1.5.1']}: <strong>${item.v1_5_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['V1.5.2']}: <strong>${item.v1_5_2 || '-'}</strong></div>
        </div>

        <div class="mb-3"><strong>维度二：商业模式</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-12 mb-1">${m['B2.1.1']}: <strong>${item.b2_1_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.1.2']}: <strong>${item.b2_1_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.2.1']}: <strong>${item.b2_2_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.2.2']}: <strong>${item.b2_2_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.2.3']}: <strong>${item.b2_2_3 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.3.1']}: <strong>${item.b2_3_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.3.2']}: <strong>${item.b2_3_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.4.1']}: <strong>${item.b2_4_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.4.2']}: <strong>${item.b2_4_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.5.1']}: <strong>${item.b2_5_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.5.2']}: <strong>${item.b2_5_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.6.1']}: <strong>${item.b2_6_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.6.2']}: <strong>${item.b2_6_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['B2.7.1']}: <strong>${item.b2_7_1 || '-'}</strong></div>
            <div class="col-md-12 mt-2"><strong class="text-dark">${m['B-O1']}:</strong> <br> ${getVal(item.b_o1, item.b_o1_other)}</div>
        </div>

        <div class="mb-3"><strong>维度三：生产方式</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-12 mb-1">${m['P3.1.1']}: <strong>${item.p3_1_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['P3.1.2']}: <strong>${item.p3_1_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['P3.2.1']}: <strong>${item.p3_2_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['P3.2.2']}: <strong>${item.p3_2_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['P3.3.1']}: <strong>${item.p3_3_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['P3.3.2']}: <strong>${item.p3_3_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['P3.4.1']}: <strong>${item.p3_4_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['P3.4.2']}: <strong>${item.p3_4_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['P3.5.1']}: <strong>${item.p3_5_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['P3.5.2']}: <strong>${item.p3_5_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['P3.6.1']}: <strong>${item.p3_6_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['P3.6.2']}: <strong>${item.p3_6_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['P3.7.1']}: <strong>${item.p3_7_1 || '-'}</strong></div>
            <div class="col-md-12 mt-2"><strong class="text-dark">${m['P-O1']}:</strong> <br> ${getVal(item.p_o1, item.p_o1_other)}</div>
        </div>

        <div class="mb-3"><strong>维度四：管理范式</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-12 mb-1">${m['M4.1.1']}: <strong>${item.m4_1_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.1.2']}: <strong>${item.m4_1_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.2.1']}: <strong>${item.m4_2_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.2.2']}: <strong>${item.m4_2_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.3.1']}: <strong>${item.m4_3_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.3.2']}: <strong>${item.m4_3_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.4.1']}: <strong>${item.m4_4_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.4.2']}: <strong>${item.m4_4_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.5.1']}: <strong>${item.m4_5_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.5.2']}: <strong>${item.m4_5_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.5.3']}: <strong>${item.m4_5_3 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.5.4']}: <strong>${item.m4_5_4 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.6.1']}: <strong>${item.m4_6_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.6.2']}: <strong>${item.m4_6_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.6.3']}: <strong>${item.m4_6_3 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['M4.7.1']}: <strong>${item.m4_7_1 || '-'}</strong></div>
            <div class="col-md-12 mt-2"><strong class="text-dark">${m['M-O1']}:</strong> <br> ${getVal(item.m_o1, item.m_o1_other)}</div>
        </div>

        <div class="mb-3"><strong>维度五：生态协同</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-12 mb-1">${m['E5.1.1']}: <strong>${item.e5_1_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['E5.1.2']}: <strong>${item.e5_1_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['E5.2.1']}: <strong>${item.e5_2_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['E5.2.2']}: <strong>${item.e5_2_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['E5.3.1']}: <strong>${item.e5_3_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['E5.3.2']}: <strong>${item.e5_3_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['E5.4.1']}: <strong>${item.e5_4_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['E5.4.2']}: <strong>${item.e5_4_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['E5.5.1']}: <strong>${item.e5_5_1 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['E5.5.2']}: <strong>${item.e5_5_2 || '-'}</strong></div>
            <div class="col-md-12 mb-1">${m['E5.6.1']}: <strong>${item.e5_6_1 || '-'}</strong></div>
            <div class="col-md-12 mt-2"><strong class="text-dark">${m['E-O1']}:</strong> <br> ${getVal(item.e_o1, item.e_o1_other)}</div>
        </div>

        <h6 class="text-primary border-bottom pb-2 mb-3 mt-4">第四部分 客观数据参照</h6>
        <div class="row mb-4">
            <div class="col-md-6 mb-2"><strong>${m['O1.1'] || 'O1.1. 研发投入比例'}：</strong> <br> ${getVal(item.o1_1)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O1.2'] || 'O1.2. ESG披露'}：</strong> <br> ${getVal(item.o1_2)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O2.1'] || 'O2.1. 新产品/新业务收入比例'}：</strong> <br> ${getVal(item.o2_1)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O2.2'] || 'O2.2. 核心业务毛利率相对水平'}：</strong> <br> ${getVal(item.o2_2)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O2.3'] || 'O2.3. 数智化产品收入比例'}：</strong> <br> ${getVal(item.o2_3)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O3.1'] || 'O3.1. AI年度投入比例'}：</strong> <br> ${getVal(item.o3_1)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O3.2'] || 'O3.2. 常态化AI员工比例'}：</strong> <br> ${getVal(item.o3_2)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O3.3'] || 'O3.3. 人均营收复合增长率'}：</strong> <br> ${getVal(item.o3_3)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O4.1'] || 'O4.1. 管理层级数'}：</strong> <br> ${getVal(item.o4_1)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O4.2'] || 'O4.2. 跨职能团队成员比例'}：</strong> <br> ${getVal(item.o4_2)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O4.3'] || 'O4.3. AI/数据岗位员工比例'}：</strong> <br> ${getVal(item.o4_3)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O5.1'] || 'O5.1. 生态共同收入比例'}：</strong> <br> ${getVal(item.o5_1)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O5.2'] || 'O5.2. 开放核心能力数量'}：</strong> <br> ${getVal(item.o5_2)}</div>
            <div class="col-md-6 mb-2"><strong>${m['O5.3'] || 'O5.3. 联合创新项目数量'}：</strong> <br> ${getVal(item.o5_3)}</div>
        </div>

        <h6 class="text-primary border-bottom pb-2 mb-3 mt-4">第五部分 总体评价与综合反馈</h6>
        <div class="mb-3"><strong>${m['S1'] || 'S1. 总体成熟度评价'}：</strong> <br> ${item.s1 || '-'}</div>
        <div class="mb-3"><strong>${m['S2'] || 'S2. 最强的两个维度'}：</strong> <br> ${getVal(item.s2)}</div>
        <div class="mb-3"><strong>${m['S3'] || 'S3. 最薄弱的两个维度'}：</strong> <br> ${getVal(item.s3)}</div>
        <div class="mb-3"><strong>${m['S4'] || 'S4. 显著进展'}：</strong> <br> ${getVal(item.s4, item.s4_other)}</div>
        <div class="mb-3"><strong>${m['S5'] || 'S5. 最大挑战'}：</strong> <br> ${getVal(item.s5, item.s5_other)}</div>
        <div class="mb-3"><strong>${m['S6'] || 'S6. 需补强能力'}：</strong> <br> ${getVal(item.s6, item.s6_other)}</div>
        <div class="mb-3"><strong>${m['S7'] || 'S7. 深度访谈意愿'}：</strong> <br> ${item.s7 || '-'}</div>
    `;
    
    document.getElementById('surveyDetailsBody').innerHTML = html;
    new bootstrap.Modal(document.getElementById('surveyDetailsModal')).show();
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
            loadData(currentPage);
        } else {
            alert(res.error || '删除失败');
        }
    } catch (e) {
        alert('网络错误');
    } finally {
        hideLoading();
    }
}

function exportData() {
    const token = sessionStorage.getItem('token');
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
    
    // We append the token to the URL so the browser can download it directly
    // Note: the backend middleware expects it in the header, but for a direct download link,
    // we must support token in query params.
    query.append('token', token);

    window.open(`/api/admin/nqoc/survey/submissions/export?${query.toString()}`, '_blank');
}

// --- Channels Management ---
let channelModal;

async function loadChannels() {
    const token = sessionStorage.getItem('token');
    try {
        const response = await fetch('/api/admin/nqoc/survey/channels', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const res = await response.json();
        if (res.success) {
            renderChannelTable(res.data);
            populateChannelSelects(res.data);
        }
    } catch (e) {
        console.error('Failed to load channels', e);
    }
}

function populateChannelSelects(data) {
    const statSelect = document.getElementById('statSearchChannel');
    const dataSelect = document.getElementById('searchChannel'); // added for consistency
    
    const optionsHtml = '<option value="">所有渠道 (不限)</option><option value="organic">自然流量 (organic)</option>' + 
        data.map(item => `<option value="${item.code}">${item.name} (${item.code})</option>`).join('');

    if (statSelect) {
        const currentVal = statSelect.value;
        statSelect.innerHTML = optionsHtml;
        statSelect.value = currentVal;
    }
    
    if (dataSelect) {
        const currentVal = dataSelect.value;
        dataSelect.innerHTML = optionsHtml;
        dataSelect.value = currentVal;
    }
}

function renderChannelTable(data) {
    const tbody = document.getElementById('channelTableBody');
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">暂无渠道数据</td></tr>';
        return;
    }
    
    const baseUrl = window.location.origin;
    
    tbody.innerHTML = data.map(item => `
        <tr>
            <td class="fw-bold">${item.name}</td>
            <td><code>${item.code}</code></td>
            <td>${item.description || '-'}</td>
            <td>
                <div class="input-group input-group-sm" style="max-width: 300px;">
                    <input type="text" class="form-control" value="${baseUrl}/nqoc/survey?channel=${item.code}" readonly id="link-${item.code}">
                    <button class="btn btn-outline-secondary" onclick="copyLink('link-${item.code}')"><i class="bi bi-clipboard"></i></button>
                </div>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-info" onclick="showQRCode('${item.name}', '${item.code}')"><i class="bi bi-qr-code"></i></button>
            </td>
            <td class="text-muted small">${new Date(item.createdAt).toLocaleString('zh-CN')}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editChannel('${item._id}', '${item.name}', '${item.code}', '${item.description || ''}')"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteChannel('${item._id}')"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function copyLink(id) {
    const input = document.getElementById(id);
    input.select();
    document.execCommand('copy');
    alert('链接已复制到剪贴板');
}

function showChannelModal() {
    document.getElementById('channelForm').reset();
    document.getElementById('channelId').value = '';
    document.getElementById('channelModalTitle').textContent = '新增渠道';
    if (!channelModal) channelModal = new bootstrap.Modal(document.getElementById('channelModal'));
    channelModal.show();
}

function editChannel(id, name, code, description) {
    document.getElementById('channelId').value = id;
    document.getElementById('channelName').value = name;
    document.getElementById('channelCode').value = code;
    document.getElementById('channelDescription').value = description;
    document.getElementById('channelModalTitle').textContent = '编辑渠道';
    if (!channelModal) channelModal = new bootstrap.Modal(document.getElementById('channelModal'));
    channelModal.show();
}

async function saveChannel() {
    const id = document.getElementById('channelId').value;
    const name = document.getElementById('channelName').value;
    const code = document.getElementById('channelCode').value;
    const description = document.getElementById('channelDescription').value;
    
    if (!name || !code) return alert('请填写渠道名称和代码');
    
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
            channelModal.hide();
            loadChannels();
        } else {
            alert(res.error || '保存失败');
        }
    } catch (e) {
        alert('网络错误');
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
            loadChannels();
        } else {
            alert(res.error || '删除失败');
        }
    } catch (e) {
        alert('网络错误');
    } finally {
        hideLoading();
    }
}
