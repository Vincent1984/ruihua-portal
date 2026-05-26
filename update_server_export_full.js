const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const newExportLogic = `// Admin: Export Survey Submissions
app.get('/api/admin/nqoc/survey/submissions/export', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const { orgName, name, phone, channel, startDate, endDate } = req.query;
        let query = {};
        if (orgName) query.orgName = { $regex: orgName, $options: 'i' };
        if (name) query.respondentName = { $regex: name, $options: 'i' };
        if (phone) query.respondentContact = { $regex: phone, $options: 'i' };
        if (channel) query.channel = channel;
        if (startDate && endDate) query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };

        const NqocSurveySubmission = require('./models/NqocSurveySubmission');
        const submissions = await NqocSurveySubmission.find(query).sort({ createdAt: -1 });
        const BOM = '\\uFEFF';
        
        const mappings = require('./admin/js/survey_mappings.json');
        const getLabel = (key, defaultLabel = key) => mappings[key] || defaultLabel;
        const getOptionLabel = (key, val) => {
            if (!val) return '';
            if (Array.isArray(val)) return val.map(v => getOptionLabel(key, v)).join(' | ');
            if (mappings[key + '_' + val]) return mappings[key + '_' + val];
            return val;
        };
        
        const headers = [
            '提交时间', '来源渠道', 
            getLabel('orgName', '企业名称'), getLabel('industry', '所属行业'), '所属行业(其他)', getLabel('orgNature', '企业性质'), '企业性质(其他)', getLabel('employeeCount', '员工总人数'), getLabel('revenue', '上一财年营业收入'), getLabel('establishedYears', '企业成立年限'), getLabel('listingStatus', '上市状态'), getLabel('aiDeptStatus', 'AI部门/岗位状态'),
            getLabel('respondentTitle', '填答人职务'), '填答人职务(其他)', getLabel('respondentTenure', '任职年限'), getLabel('respondentName', '填答人姓名'), getLabel('respondentContact', '联系方式(手机号)'), getLabel('respondentEmail', '填答人邮箱'),
            getLabel('V1.1.1'), getLabel('V1.1.2'), getLabel('V1.2.1'), getLabel('V1.2.2'), getLabel('V1.3.1'), getLabel('V1.3.2'), getLabel('V1.3.3'), getLabel('V1.4.1'), getLabel('V1.4.2'), getLabel('V1.5.1'), getLabel('V1.5.2'),
            getLabel('B2.1.1'), getLabel('B2.1.2'), getLabel('B2.2.1'), getLabel('B2.2.2'), getLabel('B2.2.3'), getLabel('B2.3.1'), getLabel('B2.3.2'), getLabel('B2.4.1'), getLabel('B2.4.2'), getLabel('B2.5.1'), getLabel('B2.5.2'), getLabel('B2.6.1'), getLabel('B2.6.2'), getLabel('B2.7.1'), getLabel('B-O1'), getLabel('B-O1') + '(其他)',
            getLabel('P3.1.1'), getLabel('P3.1.2'), getLabel('P3.2.1'), getLabel('P3.2.2'), getLabel('P3.3.1'), getLabel('P3.3.2'), getLabel('P3.4.1'), getLabel('P3.4.2'), getLabel('P3.5.1'), getLabel('P3.5.2'), getLabel('P3.6.1'), getLabel('P3.6.2'), getLabel('P3.7.1'), getLabel('P-O1'), getLabel('P-O1') + '(其他)',
            getLabel('M4.1.1'), getLabel('M4.1.2'), getLabel('M4.2.1'), getLabel('M4.2.2'), getLabel('M4.3.1'), getLabel('M4.3.2'), getLabel('M4.4.1'), getLabel('M4.4.2'), getLabel('M4.5.1'), getLabel('M4.5.2'), getLabel('M4.5.3'), getLabel('M4.5.4'), getLabel('M4.6.1'), getLabel('M4.6.2'), getLabel('M4.6.3'), getLabel('M4.7.1'), getLabel('M-O1'), getLabel('M-O1') + '(其他)',
            getLabel('E5.1.1'), getLabel('E5.1.2'), getLabel('E5.2.1'), getLabel('E5.2.2'), getLabel('E5.3.1'), getLabel('E5.3.2'), getLabel('E5.4.1'), getLabel('E5.4.2'), getLabel('E5.5.1'), getLabel('E5.5.2'), getLabel('E5.6.1'), getLabel('E-O1'), getLabel('E-O1') + '(其他)',
            getLabel('O1.1'), getLabel('O1.2'), getLabel('O2.1'), getLabel('O2.2'), getLabel('O2.3'), getLabel('O3.1'), getLabel('O3.2'), getLabel('O3.3'), getLabel('O4.1'), getLabel('O4.2'), getLabel('O4.3'), getLabel('O5.1'), getLabel('O5.2'), getLabel('O5.3'),
            getLabel('S1'), getLabel('S2'), getLabel('S3'), getLabel('S4'), getLabel('S5'), getLabel('S6'), getLabel('S7')
        ];

        let csv = BOM + headers.join(',') + '\\n';
        
        const escapeCsv = (val) => {
            if (val === null || val === undefined) return '""';
            if (Array.isArray(val)) val = val.join(' | ');
            return \`"\${String(val).replace(/"/g, '""')}"\`;
        };

        submissions.forEach(sub => {
            const row = [
                sub.createdAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
                sub.channel || 'organic',
                sub.orgName, getOptionLabel('industry', sub.industry), sub.industry_other, getOptionLabel('orgNature', sub.orgNature), sub.orgNature_other, getOptionLabel('employeeCount', sub.employeeCount), getOptionLabel('revenue', sub.revenue), 
                getOptionLabel('establishedYears', sub.establishedYears), getOptionLabel('listingStatus', sub.listingStatus), getOptionLabel('aiDeptStatus', sub.aiDeptStatus),
                getOptionLabel('respondentTitle', sub.respondentTitle), sub.respondentTitle_other, getOptionLabel('respondentTenure', sub.respondentTenure), sub.respondentName, sub.respondentContact, sub.respondentEmail,
                
                getOptionLabel('v1_1_1', sub.v1_1_1), getOptionLabel('v1_1_2', sub.v1_1_2), getOptionLabel('v1_2_1', sub.v1_2_1), getOptionLabel('v1_2_2', sub.v1_2_2), getOptionLabel('v1_3_1', sub.v1_3_1), getOptionLabel('v1_3_2', sub.v1_3_2), getOptionLabel('v1_3_3', sub.v1_3_3), getOptionLabel('v1_4_1', sub.v1_4_1), getOptionLabel('v1_4_2', sub.v1_4_2), getOptionLabel('v1_5_1', sub.v1_5_1), getOptionLabel('v1_5_2', sub.v1_5_2),
                getOptionLabel('b2_1_1', sub.b2_1_1), getOptionLabel('b2_1_2', sub.b2_1_2), getOptionLabel('b2_2_1', sub.b2_2_1), getOptionLabel('b2_2_2', sub.b2_2_2), getOptionLabel('b2_2_3', sub.b2_2_3), getOptionLabel('b2_3_1', sub.b2_3_1), getOptionLabel('b2_3_2', sub.b2_3_2), getOptionLabel('b2_4_1', sub.b2_4_1), getOptionLabel('b2_4_2', sub.b2_4_2), getOptionLabel('b2_5_1', sub.b2_5_1), getOptionLabel('b2_5_2', sub.b2_5_2), getOptionLabel('b2_6_1', sub.b2_6_1), getOptionLabel('b2_6_2', sub.b2_6_2), getOptionLabel('b2_7_1', sub.b2_7_1), getOptionLabel('b_o1', sub.b_o1), sub.b_o1_other,
                getOptionLabel('p3_1_1', sub.p3_1_1), getOptionLabel('p3_1_2', sub.p3_1_2), getOptionLabel('p3_2_1', sub.p3_2_1), getOptionLabel('p3_2_2', sub.p3_2_2), getOptionLabel('p3_3_1', sub.p3_3_1), getOptionLabel('p3_3_2', sub.p3_3_2), getOptionLabel('p3_4_1', sub.p3_4_1), getOptionLabel('p3_4_2', sub.p3_4_2), getOptionLabel('p3_5_1', sub.p3_5_1), getOptionLabel('p3_5_2', sub.p3_5_2), getOptionLabel('p3_6_1', sub.p3_6_1), getOptionLabel('p3_6_2', sub.p3_6_2), getOptionLabel('p3_7_1', sub.p3_7_1), getOptionLabel('p_o1', sub.p_o1), sub.p_o1_other,
                getOptionLabel('m4_1_1', sub.m4_1_1), getOptionLabel('m4_1_2', sub.m4_1_2), getOptionLabel('m4_2_1', sub.m4_2_1), getOptionLabel('m4_2_2', sub.m4_2_2), getOptionLabel('m4_3_1', sub.m4_3_1), getOptionLabel('m4_3_2', sub.m4_3_2), getOptionLabel('m4_4_1', sub.m4_4_1), getOptionLabel('m4_4_2', sub.m4_4_2), getOptionLabel('m4_5_1', sub.m4_5_1), getOptionLabel('m4_5_2', sub.m4_5_2), getOptionLabel('m4_5_3', sub.m4_5_3), getOptionLabel('m4_5_4', sub.m4_5_4), getOptionLabel('m4_6_1', sub.m4_6_1), getOptionLabel('m4_6_2', sub.m4_6_2), getOptionLabel('m4_6_3', sub.m4_6_3), getOptionLabel('m4_7_1', sub.m4_7_1), getOptionLabel('m_o1', sub.m_o1), sub.m_o1_other,
                getOptionLabel('e5_1_1', sub.e5_1_1), getOptionLabel('e5_1_2', sub.e5_1_2), getOptionLabel('e5_2_1', sub.e5_2_1), getOptionLabel('e5_2_2', sub.e5_2_2), getOptionLabel('e5_3_1', sub.e5_3_1), getOptionLabel('e5_3_2', sub.e5_3_2), getOptionLabel('e5_4_1', sub.e5_4_1), getOptionLabel('e5_4_2', sub.e5_4_2), getOptionLabel('e5_5_1', sub.e5_5_1), getOptionLabel('e5_5_2', sub.e5_5_2), getOptionLabel('e5_6_1', sub.e5_6_1), getOptionLabel('e_o1', sub.e_o1), sub.e_o1_other,
                getOptionLabel('o1_1', sub.o1_1), getOptionLabel('o1_2', sub.o1_2), getOptionLabel('o2_1', sub.o2_1), getOptionLabel('o2_2', sub.o2_2), getOptionLabel('o2_3', sub.o2_3), getOptionLabel('o3_1', sub.o3_1), getOptionLabel('o3_2', sub.o3_2), getOptionLabel('o3_3', sub.o3_3), getOptionLabel('o4_1', sub.o4_1), getOptionLabel('o4_2', sub.o4_2), getOptionLabel('o4_3', sub.o4_3), getOptionLabel('o5_1', sub.o5_1), getOptionLabel('o5_2', sub.o5_2), getOptionLabel('o5_3', sub.o5_3),
                getOptionLabel('s1', sub.s1), getOptionLabel('s2', sub.s2), getOptionLabel('s3', sub.s3), getOptionLabel('s4', sub.s4), getOptionLabel('s5', sub.s5), getOptionLabel('s6', sub.s6), getOptionLabel('s7', sub.s7)
            ].map(escapeCsv);
            
            csv += row.join(',') + '\\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', \`attachment; filename=nqoc-survey-detailed-\${Date.now()}.csv\`);
        res.send(csv);
    } catch (e) {
        console.error('Export NQOC Survey Error:', e);
        res.status(500).send('服务器内部错误');
    }
});`;

const regex = /\/\/ Admin: Export Survey Submissions[\s\S]*?(?=\/\/ --- NQOC Debate Voting API ---)/;
content = content.replace(regex, newExportLogic + '\n\n');
fs.writeFileSync('server.js', content, 'utf8');
console.log('Updated server.js export logic');
