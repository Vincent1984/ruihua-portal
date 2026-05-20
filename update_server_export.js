const fs = require('fs');
let serverCode = fs.readFileSync('server.js', 'utf8');

const newExportBlock = `app.get('/api/admin/nqoc/survey/submissions/export', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const { keyword, channel, startDate, endDate } = req.query;
        let query = {};
        if (keyword) {
            query.$or = [
                { orgName: { $regex: keyword, $options: 'i' } },
                { respondentName: { $regex: keyword, $options: 'i' } },
                { respondentContact: { $regex: keyword, $options: 'i' } }
            ];
        }
        if (channel) query.channel = channel;
        if (startDate && endDate) query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };

        const NqocSurveySubmission = require('./models/NqocSurveySubmission');
        const submissions = await NqocSurveySubmission.find(query).sort({ createdAt: -1 });
        const BOM = '\\uFEFF';
        
        const headers = [
            '提交时间', '来源渠道', 
            '企业名称', '所属行业', '企业性质', '员工总人数', '上一财年营业收入', '企业成立年限', '上市状态', 'AI部门/岗位状态',
            '填答人职务', '任职年限', '填答人姓名', '联系方式(手机号)',
            'V1.1.1', 'V1.1.2', 'V1.2.1', 'V1.2.2', 'V1.3.1', 'V1.3.2', 'V1.3.3', 'V1.4.1', 'V1.4.2', 'V1.5.1', 'V1.5.2',
            'B2.1.1', 'B2.1.2', 'B2.2.1', 'B2.2.2', 'B2.2.3', 'B2.3.1', 'B2.3.2', 'B2.4.1', 'B2.4.2', 'B2.5.1', 'B2.5.2', 'B2.6.1', 'B2.6.2', 'B2.7.1', 'B-O1',
            'P3.1.1', 'P3.1.2', 'P3.2.1', 'P3.2.2', 'P3.3.1', 'P3.3.2', 'P3.4.1', 'P3.4.2', 'P3.5.1', 'P3.5.2', 'P3.6.1', 'P3.6.2', 'P3.7.1', 'P-O1',
            'M4.1.1', 'M4.1.2', 'M4.2.1', 'M4.2.2', 'M4.3.1', 'M4.3.2', 'M4.4.1', 'M4.4.2', 'M4.5.1', 'M4.5.2', 'M4.5.3', 'M4.5.4', 'M4.6.1', 'M4.6.2', 'M4.6.3', 'M4.7.1', 'M-O1',
            'E5.1.1', 'E5.1.2', 'E5.2.1', 'E5.2.2', 'E5.3.1', 'E5.3.2', 'E5.4.1', 'E5.4.2', 'E5.5.1', 'E5.5.2', 'E5.6.1', 'E-O1',
            'S1总体评价', 'S2最强维度', 'S3最弱维度', 'S4最显著进展', 'S5最大挑战', 'S6需补强能力', 'S7深度访谈'
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
                sub.orgName, sub.industry, sub.orgNature, sub.employeeCount, sub.revenue, 
                sub.establishedYears, sub.listingStatus, sub.aiDeptStatus,
                sub.respondentTitle, sub.respondentTenure, sub.respondentName, sub.respondentContact,
                
                sub.v1_1_1, sub.v1_1_2, sub.v1_2_1, sub.v1_2_2, sub.v1_3_1, sub.v1_3_2, sub.v1_3_3, sub.v1_4_1, sub.v1_4_2, sub.v1_5_1, sub.v1_5_2,
                sub.b2_1_1, sub.b2_1_2, sub.b2_2_1, sub.b2_2_2, sub.b2_2_3, sub.b2_3_1, sub.b2_3_2, sub.b2_4_1, sub.b2_4_2, sub.b2_5_1, sub.b2_5_2, sub.b2_6_1, sub.b2_6_2, sub.b2_7_1, sub.b_o1,
                sub.p3_1_1, sub.p3_1_2, sub.p3_2_1, sub.p3_2_2, sub.p3_3_1, sub.p3_3_2, sub.p3_4_1, sub.p3_4_2, sub.p3_5_1, sub.p3_5_2, sub.p3_6_1, sub.p3_6_2, sub.p3_7_1, sub.p_o1,
                sub.m4_1_1, sub.m4_1_2, sub.m4_2_1, sub.m4_2_2, sub.m4_3_1, sub.m4_3_2, sub.m4_4_1, sub.m4_4_2, sub.m4_5_1, sub.m4_5_2, sub.m4_5_3, sub.m4_5_4, sub.m4_6_1, sub.m4_6_2, sub.m4_6_3, sub.m4_7_1, sub.m_o1,
                sub.e5_1_1, sub.e5_1_2, sub.e5_2_1, sub.e5_2_2, sub.e5_3_1, sub.e5_3_2, sub.e5_4_1, sub.e5_4_2, sub.e5_5_1, sub.e5_5_2, sub.e5_6_1, sub.e_o1,
                sub.s1, sub.s2, sub.s3, sub.s4, sub.s5, sub.s6, sub.s7
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

const startIdx = serverCode.indexOf("app.get('/api/admin/nqoc/survey/submissions/export'");
if (startIdx === -1) throw new Error("Could not find export endpoint");

const endString = "res.status(500).send('服务器内部错误');\n    }\n});";
const endIdx = serverCode.indexOf(endString, startIdx);
if (endIdx === -1) throw new Error("Could not find end of export endpoint");

const actualEndIdx = endIdx + endString.length;

serverCode = serverCode.substring(0, startIdx) + newExportBlock + serverCode.substring(actualEndIdx);

fs.writeFileSync('server.js', serverCode);
console.log("Updated server.js export logic successfully.");
