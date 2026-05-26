const fs = require('fs');
let content = fs.readFileSync('admin/js/nqoc-survey.js', 'utf8');

const newShowDetails = `function showDetails(id) {
    const item = currentData.find(d => d._id === id);
    if (!item) return;
    
    // Safely get mapped label or fallback to default
    const getLabel = (key, defaultLabel) => {
        if (typeof SURVEY_MAPPINGS !== 'undefined' && SURVEY_MAPPINGS[key]) {
            return SURVEY_MAPPINGS[key];
        }
        return defaultLabel;
    };

    const getOptionLabel = (key, val) => {
        if (!val) return '-';
        if (Array.isArray(val)) {
            return val.map(v => getOptionLabel(key, v)).join('、');
        }
        if (typeof SURVEY_MAPPINGS !== 'undefined' && SURVEY_MAPPINGS[key + '_' + val]) {
            return SURVEY_MAPPINGS[key + '_' + val];
        }
        return val;
    };
    
    const html = \`
        <div class="mb-4">
            <h6 class="text-primary border-bottom pb-2 mb-3"><i class="bi bi-building"></i> 第一部分：企业基本信息</h6>
            <div class="row mb-2">
                <div class="col-md-4 mb-2"><strong>\${getLabel("orgName", "企业名称")}：</strong> \${item.orgName || '-'}</div>
                <div class="col-md-4 mb-2"><strong>\${getLabel("industry", "所属行业")}：</strong> \${getOptionLabel("industry", item.industry)}\${item.industry === '其他' && item.industry_other ? ' (' + item.industry_other + ')' : ''}</div>
                <div class="col-md-4 mb-2"><strong>\${getLabel("orgNature", "企业性质")}：</strong> \${getOptionLabel("orgNature", item.orgNature)}\${item.orgNature === '其他' && item.orgNature_other ? ' (' + item.orgNature_other + ')' : ''}</div>
                <div class="col-md-4 mb-2"><strong>\${getLabel("employeeCount", "员工人数")}：</strong> \${getOptionLabel("employeeCount", item.employeeCount)}</div>
                <div class="col-md-4 mb-2"><strong>\${getLabel("revenue", "营收规模")}：</strong> \${getOptionLabel("revenue", item.revenue)}</div>
                <div class="col-md-4 mb-2"><strong>\${getLabel("headquarters", "总部所在地")}：</strong> \${item.headquarters || '-'}</div>
                <div class="col-md-12 mb-2"><strong>\${getLabel("coreBusiness", "主营业务")}：</strong> \${item.coreBusiness || '-'}</div>
            </div>
        </div>

        <div class="mb-4">
            <h6 class="text-primary border-bottom pb-2 mb-3"><i class="bi bi-person-badge"></i> 第二部分：填答人信息</h6>
            <div class="row mb-2">
                <div class="col-md-4 mb-2"><strong>\${getLabel("respondentName", "姓名")}：</strong> \${item.respondentName || '-'}</div>
                <div class="col-md-4 mb-2"><strong>\${getLabel("respondentTitle", "职务")}：</strong> \${getOptionLabel("respondentTitle", item.respondentTitle)}\${item.respondentTitle === '其他' && item.respondentTitle_other ? ' (' + item.respondentTitle_other + ')' : ''}</div>
                <div class="col-md-4 mb-2"><strong>\${getLabel("respondentPhone", "手机号")}：</strong> \${item.respondentPhone || '-'}</div>
                <div class="col-md-4 mb-2"><strong>\${getLabel("respondentEmail", "邮箱")}：</strong> \${item.respondentEmail || '-'}</div>
                <div class="col-md-12 mb-2"><strong>\${getLabel("aiDeptStatus", "AI/数智化专门部门设立情况")}：</strong> \${getOptionLabel("aiDeptStatus", item.aiDeptStatus)}</div>
            </div>
        </div>

        <div class="mb-4">
            <h6 class="text-primary border-bottom pb-2 mb-3"><i class="bi bi-ui-checks-grid"></i> 第三部分：新质组织成熟度评估</h6>
            
            <div class="mb-2 bg-light p-2 rounded"><strong>维度一：核心价值观</strong></div>
            <div class="row mb-1 text-muted" style="font-size: 0.9em;">
                \${["v1_1_1","v1_1_2","v1_2_1","v1_2_2","v1_3_1","v1_3_2","v1_3_3","v1_4_1","v1_4_2","v1_5_1","v1_5_2"].map(k => 
                    \`<div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel(k.toUpperCase().replace(/_/g, '.'), k.toUpperCase())}</strong>: <br><span class="text-primary">\${getOptionLabel(k, item[k])}</span></div>\`
                ).join('')}
            </div>

            <div class="mb-2 bg-light p-2 rounded"><strong>维度二：商业模式</strong></div>
            <div class="row mb-1 text-muted" style="font-size: 0.9em;">
                \${["b2_1_1","b2_1_2","b2_2_1","b2_2_2","b2_2_3","b2_3_1","b2_3_2","b2_4_1","b2_4_2","b2_5_1","b2_5_2","b2_6_1","b2_6_2","b2_7_1"].map(k => 
                    \`<div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel(k.toUpperCase().replace(/_/g, '.'), k.toUpperCase())}</strong>: <br><span class="text-primary">\${getOptionLabel(k, item[k])}</span></div>\`
                ).join('')}
            </div>
            <div class="col-12 mb-3 mt-2 text-dark small bg-light p-2 rounded" style="font-size:14px;"><strong>\${getLabel("B-O1", "B-O1 (产品/服务形态客观多选)")}</strong>: <br><span class="text-primary">\${getOptionLabel("b_o1", item.b_o1)}\${item.b_o1_other ? ' (' + item.b_o1_other + ')' : ''}</span></div>

            <div class="mb-2 bg-light p-2 rounded"><strong>维度三：生产方式</strong></div>
            <div class="row mb-1 text-muted" style="font-size: 0.9em;">
                \${["p3_1_1","p3_1_2","p3_2_1","p3_2_2","p3_3_1","p3_3_2","p3_4_1","p3_4_2","p3_5_1","p3_5_2","p3_6_1","p3_6_2","p3_7_1"].map(k => 
                    \`<div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel(k.toUpperCase().replace(/_/g, '.'), k.toUpperCase())}</strong>: <br><span class="text-primary">\${getOptionLabel(k, item[k])}</span></div>\`
                ).join('')}
            </div>
            <div class="col-12 mb-3 mt-2 text-dark small bg-light p-2 rounded" style="font-size:14px;"><strong>\${getLabel("P-O1", "P-O1 (常态化应用工具客观多选)")}</strong>: <br><span class="text-primary">\${getOptionLabel("p_o1", item.p_o1)}\${item.p_o1_other ? ' (' + item.p_o1_other + ')' : ''}</span></div>

            <div class="mb-2 bg-light p-2 rounded"><strong>维度四：组织与人才</strong></div>
            <div class="row mb-1 text-muted" style="font-size: 0.9em;">
                \${["m4_1_1","m4_1_2","m4_2_1","m4_2_2","m4_3_1","m4_3_2","m4_4_1","m4_4_2","m4_5_1","m4_5_2","m4_6_1","m4_6_2","m4_7_1","m4_7_2"].map(k => 
                    \`<div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel(k.toUpperCase().replace(/_/g, '.'), k.toUpperCase())}</strong>: <br><span class="text-primary">\${getOptionLabel(k, item[k])}</span></div>\`
                ).join('')}
            </div>
            <div class="col-12 mb-3 mt-2 text-dark small bg-light p-2 rounded" style="font-size:14px;"><strong>\${getLabel("M-O1", "M-O1 (AI能力建设举措客观多选)")}</strong>: <br><span class="text-primary">\${getOptionLabel("m_o1", item.m_o1)}\${item.m_o1_other ? ' (' + item.m_o1_other + ')' : ''}</span></div>

            <div class="mb-2 bg-light p-2 rounded"><strong>维度五：生态与环境</strong></div>
            <div class="row mb-1 text-muted" style="font-size: 0.9em;">
                \${["e5_1_1","e5_1_2","e5_2_1","e5_2_2","e5_3_1","e5_3_2","e5_4_1","e5_4_2","e5_5_1","e5_5_2","e5_6_1"].map(k => 
                    \`<div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel(k.toUpperCase().replace(/_/g, '.'), k.toUpperCase())}</strong>: <br><span class="text-primary">\${getOptionLabel(k, item[k])}</span></div>\`
                ).join('')}
            </div>
        </div>

        <div class="mb-4">
            <h6 class="text-primary border-bottom pb-2 mb-3"><i class="bi bi-graph-up"></i> 第四部分：客观经营数据提取</h6>
            <div class="row mb-2">
                \${["o2_1","o2_2","o2_3","o3_1","o3_2","o3_3","o4_1","o4_2","o4_3","o5_1","o5_2","o5_3"].map(k => 
                    \`<div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel(k.toUpperCase().replace(/_/g, '.'), k.toUpperCase())}</strong>: <br><span class="text-primary">\${getOptionLabel(k, item[k])}</span></div>\`
                ).join('')}
            </div>
        </div>

        <div class="mb-4">
            <h6 class="text-primary border-bottom pb-2 mb-3"><i class="bi bi-chat-left-text"></i> 第五部分：总体评价与综合反馈</h6>
            <div class="row mb-2">
                <div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel("S1", "S1")}</strong>: <br><span class="text-primary">\${getOptionLabel("s1", item.s1)}</span></div>
                <div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel("S2", "S2")}</strong>: <br><span class="text-primary">\${getOptionLabel("s2", item.s2)}</span></div>
                <div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel("S3", "S3")}</strong>: <br><span class="text-primary">\${getOptionLabel("s3", item.s3)}</span></div>
                <div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel("S4", "S4")}</strong>: <br><span class="text-primary">\${getOptionLabel("s4", item.s4)}\${item.s4_other ? ' (' + item.s4_other + ')' : ''}</span></div>
                <div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel("S5", "S5")}</strong>: <br><span class="text-primary">\${getOptionLabel("s5", item.s5)}\${item.s5_other ? ' (' + item.s5_other + ')' : ''}</span></div>
                <div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel("S6", "S6")}</strong>: <br><span class="text-primary">\${getOptionLabel("s6", item.s6)}\${item.s6_other ? ' (' + item.s6_other + ')' : ''}</span></div>
                <div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel("S7", "S7")}</strong>: <br><span class="text-primary">\${getOptionLabel("s7", item.s7)}</span></div>
                \${item.s8 ? \`<div class="col-12 mb-2 pb-1 border-bottom border-light" style="font-size:14px;"><strong class="text-dark">\${getLabel("S8", "S8")}</strong>: <br><span class="text-primary">\${item.s8}</span></div>\` : ''}
            </div>
        </div>
    \`;
    
    document.getElementById('modalContent').innerHTML = html;
    new bootstrap.Modal(document.getElementById('detailModal')).show();
}`;

// Replace the old showDetails function
const regex = /function showDetails\(id\) \{[\s\S]*?\}\s*(?=function|\n$)/;
content = content.replace(regex, newShowDetails + '\n\n');
fs.writeFileSync('admin/js/nqoc-survey.js', content, 'utf8');
console.log('Updated admin/js/nqoc-survey.js');
