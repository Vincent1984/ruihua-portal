// nqoc-survey.js
document.addEventListener('DOMContentLoaded', () => {
    loadData(1);
    loadChannels();
    loadStats();
});

function showLoading() { document.getElementById('loadingOverlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; }

let radarChartInstance = null;
let stageChartInstance = null;
let painPointChartInstance = null;

async function loadStats() {
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch('/api/admin/nqoc/survey/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            document.getElementById('statTotalCount').textContent = data.total;
            
            // Render Radar Chart
            const radarCtx = document.getElementById('radarChart').getContext('2d');
            if (radarChartInstance) radarChartInstance.destroy();
            radarChartInstance = new Chart(radarCtx, {
                type: 'radar',
                data: {
                    labels: ['核心价值观', '商业模式', '生产方式', '管理范式', '生态协同'],
                    datasets: [{
                        label: '平均得分',
                        data: [
                            data.scores.v1.toFixed(2),
                            data.scores.b2.toFixed(2),
                            data.scores.p3.toFixed(2),
                            data.scores.m4.toFixed(2),
                            data.scores.e5.toFixed(2)
                        ],
                        backgroundColor: 'rgba(124, 77, 255, 0.2)',
                        borderColor: '#7c4dff',
                        pointBackgroundColor: '#7c4dff',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: '#7c4dff'
                    }]
                },
                options: {
                    scales: {
                        r: {
                            angleLines: { color: 'rgba(0, 0, 0, 0.1)' },
                            grid: { color: 'rgba(0, 0, 0, 0.1)' },
                            pointLabels: { font: { size: 12 } },
                            ticks: { min: 0, max: 5, stepSize: 1 }
                        }
                    }
                }
            });

            // Render Stage Chart
            const stageCtx = document.getElementById('stageChart').getContext('2d');
            if (stageChartInstance) stageChartInstance.destroy();
            stageChartInstance = new Chart(stageCtx, {
                type: 'bar',
                data: {
                    labels: ['阶段1(探索)', '阶段2(起步)', '阶段3(成长)', '阶段4(成熟)', '阶段5(引领)'],
                    datasets: [{
                        label: '企业数量',
                        data: [
                            data.stageCount['1'] || 0,
                            data.stageCount['2'] || 0,
                            data.stageCount['3'] || 0,
                            data.stageCount['4'] || 0,
                            data.stageCount['5'] || 0
                        ],
                        backgroundColor: '#7c4dff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtLabel: true, ticks: { stepSize: 1 } }
                    }
                }
            });

            // Render Pain Points Chart
            const painPoints = Object.keys(data.painPointsCount).sort((a, b) => data.painPointsCount[b] - data.painPointsCount[a]);
            const painCounts = painPoints.map(k => data.painPointsCount[k]);
            
            const painCtx = document.getElementById('painPointChart').getContext('2d');
            if (painPointChartInstance) painPointChartInstance.destroy();
            painPointChartInstance = new Chart(painCtx, {
                type: 'doughnut',
                data: {
                    labels: painPoints,
                    datasets: [{
                        data: painCounts,
                        backgroundColor: [
                            '#7c4dff', '#00e5ff', '#ff4081', '#ffd740', '#69f0ae',
                            '#ff6e40', '#b388ff', '#18ffff'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right' }
                    }
                }
            });
        }
    } catch (e) {
        console.error('加载分析数据失败:', e);
    }
}

// --- Submissions Data ---
let currentPage = 1;
let currentData = [];

async function loadData(page) {
    currentPage = page;
    const token = sessionStorage.getItem('token');
    const keyword = document.getElementById('searchKeyword').value;
    const channel = document.getElementById('searchChannel').value;
    const startDate = document.getElementById('searchStartDate').value;
    const endDate = document.getElementById('searchEndDate').value;

    showLoading();
    try {
        const query = new URLSearchParams({
            page, limit: 20,
            keyword, channel, startDate, endDate
        });
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
    
    const html = `
        <h6 class="text-primary border-bottom pb-2 mb-3">企业详细画像 (第一/二部分)</h6>
        <div class="row mb-4">
            <div class="col-md-4 mb-2"><strong>企业名称：</strong> ${item.orgName || '-'}</div>
            <div class="col-md-4 mb-2"><strong>所属行业：</strong> ${item.industry || '-'}${item.industry === '其他' && item.industry_other ? ' (' + item.industry_other + ')' : ''}</div>
            <div class="col-md-4 mb-2"><strong>企业性质：</strong> ${item.orgNature || '-'}${item.orgNature === '其他' && item.orgNature_other ? ' (' + item.orgNature_other + ')' : ''}</div>
            <div class="col-md-4 mb-2"><strong>员工人数：</strong> ${item.employeeCount || '-'}</div>
            <div class="col-md-4 mb-2"><strong>营收规模：</strong> ${item.revenue || '-'}</div>
            <div class="col-md-4 mb-2"><strong>成立年限：</strong> ${item.establishedYears || '-'}</div>
            <div class="col-md-4 mb-2"><strong>上市状态：</strong> ${item.listingStatus || '-'}</div>
            <div class="col-md-4 mb-2"><strong>AI部门状态：</strong> ${item.aiDeptStatus || '-'}</div>
            <div class="col-md-4 mb-2"><strong>填答人职务：</strong> ${item.respondentTitle || '-'}${item.respondentTitle === '其他高级管理人员' && item.respondentTitle_other ? ' (' + item.respondentTitle_other + ')' : ''}</div>
            <div class="col-md-4 mb-2"><strong>任职年限：</strong> ${item.respondentTenure || '-'}</div>
        </div>
        
        <h6 class="text-primary border-bottom pb-2 mb-3">主观题反馈 (第四部分 S1-S7)</h6>
        <div class="mb-3"><strong>S1. 总体成熟度评价：</strong> ${item.s1 || '-'}</div>
        <div class="mb-3"><strong>S2. 最强的两个维度：</strong> ${Array.isArray(item.s2) ? item.s2.join('、') : (item.s2 || '-')}</div>
        <div class="mb-3"><strong>S3. 最薄弱的两个维度：</strong> ${Array.isArray(item.s3) ? item.s3.join('、') : (item.s3 || '-')}</div>
        <div class="mb-3"><strong>S4. 过去12个月最显著进展：</strong> ${Array.isArray(item.s4) ? item.s4.join('、') : (item.s4 || '-')}</div>
        <div class="mb-3"><strong>S5. 当前面临的最大挑战：</strong> ${Array.isArray(item.s5) ? item.s5.join('、') : (item.s5 || '-')}</div>
        <div class="mb-3"><strong>S6. 未来3年需补强能力：</strong> ${Array.isArray(item.s6) ? item.s6.join('、') : (item.s6 || '-')}</div>
        <div class="mb-3"><strong>S7. 接受深度访谈意愿：</strong> ${item.s7 || '-'}</div>
        
        
        <h6 class="text-primary border-bottom pb-2 mb-3 mt-4">第三部分：新质组织成熟度评估 (矩阵单选)</h6>
        
        <div class="mb-3"><strong>维度一：核心价值观</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-6">1.1.1 价值观清晰度: ${item.v1_1_1 || '-'}</div>
            <div class="col-md-6">1.1.2 价值观共识度: ${item.v1_1_2 || '-'}</div>
            <div class="col-md-6">1.2.1 环境责任认知: ${item.v1_2_1 || '-'}</div>
            <div class="col-md-6">1.2.2 绿色实践意愿: ${item.v1_2_2 || '-'}</div>
            <div class="col-md-6">1.3.1 容错文化: ${item.v1_3_1 || '-'}</div>
            <div class="col-md-6">1.3.2 突破性创新鼓励: ${item.v1_3_2 || '-'}</div>
            <div class="col-md-6">1.3.3 知识分享意愿: ${item.v1_3_3 || '-'}</div>
            <div class="col-md-6">1.4.1 长期主义导向: ${item.v1_4_1 || '-'}</div>
            <div class="col-md-6">1.4.2 社会责任担当: ${item.v1_4_2 || '-'}</div>
            <div class="col-md-6">1.5.1 技术向善认知: ${item.v1_5_1 || '-'}</div>
            <div class="col-md-6">1.5.2 员工成长关注: ${item.v1_5_2 || '-'}</div>
        </div>

        <div class="mb-3"><strong>维度二：商业模式</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-6">2.1.1 产品/服务智能化: ${item.b2_1_1 || '-'}</div>
            <div class="col-md-6">2.1.2 客户体验个性化: ${item.b2_1_2 || '-'}</div>
            <div class="col-md-6">2.2.1 价值链整合度: ${item.b2_2_1 || '-'}</div>
            <div class="col-md-6">2.2.2 生态共创水平: ${item.b2_2_2 || '-'}</div>
            <div class="col-md-6">2.2.3 资源配置灵活性: ${item.b2_2_3 || '-'}</div>
            <div class="col-md-6">2.3.1 触达渠道数字化: ${item.b2_3_1 || '-'}</div>
            <div class="col-md-6">2.3.2 客户互动频率: ${item.b2_3_2 || '-'}</div>
            <div class="col-md-6">2.4.1 收入来源多元化: ${item.b2_4_1 || '-'}</div>
            <div class="col-md-6">2.4.2 定价模式创新: ${item.b2_4_2 || '-'}</div>
            <div class="col-md-6">2.5.1 数据资产沉淀: ${item.b2_5_1 || '-'}</div>
            <div class="col-md-6">2.5.2 数据价值变现: ${item.b2_5_2 || '-'}</div>
            <div class="col-md-6">2.6.1 核心壁垒强度: ${item.b2_6_1 || '-'}</div>
            <div class="col-md-6">2.6.2 抗风险能力: ${item.b2_6_2 || '-'}</div>
            <div class="col-md-6">2.7.1 商业模式绿色化: ${item.b2_7_1 || '-'}</div>
        </div>

        <div class="mb-3"><strong>维度三：生产方式</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-6">3.1.1 核心环节AI渗透: ${item.p3_1_1 || '-'}</div>
            <div class="col-md-6">3.1.2 辅助环节AI覆盖: ${item.p3_1_2 || '-'}</div>
            <div class="col-md-6">3.2.1 流程自动化率: ${item.p3_2_1 || '-'}</div>
            <div class="col-md-6">3.2.2 设备/系统智能化: ${item.p3_2_2 || '-'}</div>
            <div class="col-md-6">3.3.1 人机协作紧密度: ${item.p3_3_1 || '-'}</div>
            <div class="col-md-6">3.3.2 AI辅助决策比例: ${item.p3_3_2 || '-'}</div>
            <div class="col-md-6">3.4.1 数据质量与贯通: ${item.p3_4_1 || '-'}</div>
            <div class="col-md-6">3.4.2 实时决策能力: ${item.p3_4_2 || '-'}</div>
            <div class="col-md-6">3.5.1 研发周期缩短: ${item.p3_5_1 || '-'}</div>
            <div class="col-md-6">3.5.2 创新产出质量: ${item.p3_5_2 || '-'}</div>
            <div class="col-md-6">3.6.1 需求响应速度: ${item.p3_6_1 || '-'}</div>
            <div class="col-md-6">3.6.2 定制化生产能力: ${item.p3_6_2 || '-'}</div>
            <div class="col-md-6">3.7.1 资源利用效率: ${item.p3_7_1 || '-'}</div>
        </div>

        <div class="mb-3"><strong>维度四：管理范式</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-6">4.1.1 扁平化/网络化: ${item.m4_1_1 || '-'}</div>
            <div class="col-md-6">4.1.2 跨部门协同效率: ${item.m4_1_2 || '-'}</div>
            <div class="col-md-6">4.2.1 流程敏捷性: ${item.m4_2_1 || '-'}</div>
            <div class="col-md-6">4.2.2 流程自迭代能力: ${item.m4_2_2 || '-'}</div>
            <div class="col-md-6">4.3.1 AI工具熟练度: ${item.m4_3_1 || '-'}</div>
            <div class="col-md-6">4.3.2 组织学习敏锐度: ${item.m4_3_2 || '-'}</div>
            <div class="col-md-6">4.4.1 授权赋能程度: ${item.m4_4_1 || '-'}</div>
            <div class="col-md-6">4.4.2 算法决策占比: ${item.m4_4_2 || '-'}</div>
            <div class="col-md-6">4.5.1 数字人才密度: ${item.m4_5_1 || '-'}</div>
            <div class="col-md-6">4.5.2 岗位动态调配: ${item.m4_5_2 || '-'}</div>
            <div class="col-md-6">4.5.3 技能重塑支持: ${item.m4_5_3 || '-'}</div>
            <div class="col-md-6">4.5.4 领导力转型: ${item.m4_5_4 || '-'}</div>
            <div class="col-md-6">4.6.1 目标管理动态性: ${item.m4_6_1 || '-'}</div>
            <div class="col-md-6">4.6.2 评价维度多元性: ${item.m4_6_2 || '-'}</div>
            <div class="col-md-6">4.6.3 激励机制有效性: ${item.m4_6_3 || '-'}</div>
            <div class="col-md-6">4.7.1 ESG管理融合度: ${item.m4_7_1 || '-'}</div>
        </div>

        <div class="mb-3"><strong>维度五：生态协同</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-6">5.1.1 供应链透明度: ${item.e5_1_1 || '-'}</div>
            <div class="col-md-6">5.1.2 上下游业务协同: ${item.e5_1_2 || '-'}</div>
            <div class="col-md-6">5.2.1 产学研合作深度: ${item.e5_2_1 || '-'}</div>
            <div class="col-md-6">5.2.2 跨界融合创新: ${item.e5_2_2 || '-'}</div>
            <div class="col-md-6">5.3.1 平台资源开放度: ${item.e5_3_1 || '-'}</div>
            <div class="col-md-6">5.3.2 赋能外部伙伴: ${item.e5_3_2 || '-'}</div>
            <div class="col-md-6">5.4.1 创新网络活跃度: ${item.e5_4_1 || '-'}</div>
            <div class="col-md-6">5.4.2 利益共享机制: ${item.e5_4_2 || '-'}</div>
            <div class="col-md-6">5.5.1 社区/行业贡献: ${item.e5_5_1 || '-'}</div>
            <div class="col-md-6">5.5.2 监管合规响应: ${item.e5_5_2 || '-'}</div>
            <div class="col-md-6">5.6.1 绿色供应链建设: ${item.e5_6_1 || '-'}</div>
        </div>

        <h6 class="text-primary border-bottom pb-2 mb-3 mt-4">各维度多选题反馈 (客观题 O1)</h6>
        <div class="mb-3"><strong>B-O1 (产品/服务形态):</strong> ${Array.isArray(item.b_o1) ? item.b_o1.join('、') : '-'}${item.b_o1_other ? ' (' + item.b_o1_other + ')' : ''}</div>
        <div class="mb-3"><strong>P-O1 (常态化应用工具):</strong> ${Array.isArray(item.p_o1) ? item.p_o1.join('、') : '-'}${item.p_o1_other ? ' (' + item.p_o1_other + ')' : ''}</div>
        <div class="mb-3"><strong>M-O1 (人才与组织举措):</strong> ${Array.isArray(item.m_o1) ? item.m_o1.join('、') : '-'}${item.m_o1_other ? ' (' + item.m_o1_other + ')' : ''}</div>
        <div class="mb-3"><strong>E-O1 (外部生态合作):</strong> ${Array.isArray(item.e_o1) ? item.e_o1.join('、') : '-'}${item.e_o1_other ? ' (' + item.e_o1_other + ')' : ''}</div>
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
    const keyword = document.getElementById('searchKeyword').value;
    const channel = document.getElementById('searchChannel').value;
    const startDate = document.getElementById('searchStartDate').value;
    const endDate = document.getElementById('searchEndDate').value;
    
    const query = new URLSearchParams({ token, keyword, channel, startDate, endDate });
    window.open(`/api/admin/nqoc/survey/submissions/export?${query}`, '_blank');
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
        }
    } catch (e) {
        console.error('Failed to load channels', e);
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
