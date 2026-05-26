const mongoose = require('mongoose');
require('dotenv').config();

const NqocSurveySubmission = require('./models/NqocSurveySubmission');

async function runTest() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ruihua_cms');
    console.log('Connected to DB');

    const testPayload = {
        orgName: "全量回归测试企业",
        industry: "现代服务业",
        industry_other: "",
        orgNature: "外资/合资企业",
        orgNature_other: "",
        employeeCount: "10,000 人以上",
        revenue: "100 亿元以上",
        establishedYears: "5年以内",
        listingStatus: "A股上市",
        aiDeptStatus: "是，已设立专门部门或委员会",
        respondentTitle: "其他",
        respondentTitle_other: "AI转型总监",
        respondentTenure: "3–5 年",
        respondentName: "李四",
        respondentContact: "13900139000",
        respondentEmail: "lisi@test.com",
        smsCode: "123456",
        v1_1_1: 1, v1_1_2: 2, v1_2_1: 3, v1_2_2: 4, v1_3_1: 5, v1_3_2: 1, v1_3_3: 2, v1_4_1: 3, v1_4_2: 4, v1_5_1: 5, v1_5_2: 1,
        b2_1_1: 2, b2_1_2: 3, b2_2_1: 4, b2_2_2: 5, b2_2_3: 1, b2_3_1: 2, b2_3_2: 3, b2_4_1: 4, b2_4_2: 5, b2_5_1: 1, b2_5_2: 2, b2_6_1: 3, b2_6_2: 4, b2_7_1: 5,
        b_o1: ["智能推荐/搜索", "自然语言交互/客服"],
        b_o1_other: "",
        p3_1_1: 1, p3_1_2: 2, p3_2_1: 3, p3_2_2: 4, p3_3_1: 5, p3_3_2: 1, p3_4_1: 2, p3_4_2: 3, p3_5_1: 4, p3_5_2: 5, p3_6_1: 1, p3_6_2: 2, p3_7_1: 3,
        p_o1: ["其他"],
        p_o1_other: "内部自研AI平台",
        m4_1_1: 4, m4_1_2: 5, m4_2_1: 1, m4_2_2: 2, m4_3_1: 3, m4_3_2: 4, m4_4_1: 5, m4_4_2: 1, m4_5_1: 2, m4_5_2: 3, m4_5_3: 4, m4_5_4: 5, m4_6_1: 1, m4_6_2: 2, m4_6_3: 3, m4_7_1: 4,
        m_o1: ["全员AI培训"],
        m_o1_other: "",
        e5_1_1: 5, e5_1_2: 1, e5_2_1: 2, e5_2_2: 3, e5_3_1: 4, e5_3_2: 5, e5_4_1: 1, e5_4_2: 2, e5_5_1: 3, e5_5_2: 4, e5_6_1: 5,
        e_o1: ["学研合作"],
        e_o1_other: "",
        o1_1: ">10%",
        o1_2: "A级",
        o2_1: ">50%",
        o2_2: "显著高于行业平均（高 10 个百分点以上）",
        o2_3: ">80%",
        o3_1: ">80%",
        o3_2: ">50%",
        o3_3: ">30%",
        o4_1: ">50%",
        o4_2: "极高",
        o4_3: ">80%",
        o5_1: "50家以上",
        o5_2: "极高",
        o5_3: ">50%",
        s1: 5,
        s2: ["核心价值观", "生态协同"],
        s3: ["商业模式", "生产方式"],
        s4: ["其他"],
        s4_other: "S4的测试补充内容",
        s5: ["其他"],
        s5_other: "S5的测试补充内容",
        s6: ["其他"],
        s6_other: "S6的测试补充内容",
        s7: "愿意",
        channel: "regression_test"
    };

    try {
        const submission = new NqocSurveySubmission(testPayload);
        const saved = await submission.save();
        console.log('Submission saved with ID:', saved._id);
        
        // Fetch it back
        const retrieved = await NqocSurveySubmission.findById(saved._id).lean();
        
        // Verification
        let passed = true;
        for (const key in testPayload) {
            if (JSON.stringify(retrieved[key]) !== JSON.stringify(testPayload[key])) {
                console.error(`Mismatch for ${key}: expected ${testPayload[key]}, got ${retrieved[key]}`);
                passed = false;
            }
        }
        
        if (passed) {
            console.log('All fields matched successfully! Frontend-Backend mapping is 100% accurate.');
        } else {
            console.error('Some fields failed verification.');
        }
    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        mongoose.disconnect();
    }
}

runTest();
