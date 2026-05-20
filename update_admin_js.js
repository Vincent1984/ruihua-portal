const fs = require('fs');
let content = fs.readFileSync('admin/js/nqoc-survey.js', 'utf8');

const matrixFieldsHTML = `
        <h6 class="text-primary border-bottom pb-2 mb-3 mt-4">第三部分：新质组织成熟度评估 (矩阵单选)</h6>
        
        <div class="mb-3"><strong>维度一：核心价值观</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-6">1.1.1 价值观清晰度: \${item.v1_1_1 || '-'}</div>
            <div class="col-md-6">1.1.2 价值观共识度: \${item.v1_1_2 || '-'}</div>
            <div class="col-md-6">1.2.1 环境责任认知: \${item.v1_2_1 || '-'}</div>
            <div class="col-md-6">1.2.2 绿色实践意愿: \${item.v1_2_2 || '-'}</div>
            <div class="col-md-6">1.3.1 容错文化: \${item.v1_3_1 || '-'}</div>
            <div class="col-md-6">1.3.2 突破性创新鼓励: \${item.v1_3_2 || '-'}</div>
            <div class="col-md-6">1.3.3 知识分享意愿: \${item.v1_3_3 || '-'}</div>
            <div class="col-md-6">1.4.1 长期主义导向: \${item.v1_4_1 || '-'}</div>
            <div class="col-md-6">1.4.2 社会责任担当: \${item.v1_4_2 || '-'}</div>
            <div class="col-md-6">1.5.1 技术向善认知: \${item.v1_5_1 || '-'}</div>
            <div class="col-md-6">1.5.2 员工成长关注: \${item.v1_5_2 || '-'}</div>
        </div>

        <div class="mb-3"><strong>维度二：商业模式</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-6">2.1.1 产品/服务智能化: \${item.b2_1_1 || '-'}</div>
            <div class="col-md-6">2.1.2 客户体验个性化: \${item.b2_1_2 || '-'}</div>
            <div class="col-md-6">2.2.1 价值链整合度: \${item.b2_2_1 || '-'}</div>
            <div class="col-md-6">2.2.2 生态共创水平: \${item.b2_2_2 || '-'}</div>
            <div class="col-md-6">2.2.3 资源配置灵活性: \${item.b2_2_3 || '-'}</div>
            <div class="col-md-6">2.3.1 触达渠道数字化: \${item.b2_3_1 || '-'}</div>
            <div class="col-md-6">2.3.2 客户互动频率: \${item.b2_3_2 || '-'}</div>
            <div class="col-md-6">2.4.1 收入来源多元化: \${item.b2_4_1 || '-'}</div>
            <div class="col-md-6">2.4.2 定价模式创新: \${item.b2_4_2 || '-'}</div>
            <div class="col-md-6">2.5.1 数据资产沉淀: \${item.b2_5_1 || '-'}</div>
            <div class="col-md-6">2.5.2 数据价值变现: \${item.b2_5_2 || '-'}</div>
            <div class="col-md-6">2.6.1 核心壁垒强度: \${item.b2_6_1 || '-'}</div>
            <div class="col-md-6">2.6.2 抗风险能力: \${item.b2_6_2 || '-'}</div>
            <div class="col-md-6">2.7.1 商业模式绿色化: \${item.b2_7_1 || '-'}</div>
        </div>

        <div class="mb-3"><strong>维度三：生产方式</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-6">3.1.1 核心环节AI渗透: \${item.p3_1_1 || '-'}</div>
            <div class="col-md-6">3.1.2 辅助环节AI覆盖: \${item.p3_1_2 || '-'}</div>
            <div class="col-md-6">3.2.1 流程自动化率: \${item.p3_2_1 || '-'}</div>
            <div class="col-md-6">3.2.2 设备/系统智能化: \${item.p3_2_2 || '-'}</div>
            <div class="col-md-6">3.3.1 人机协作紧密度: \${item.p3_3_1 || '-'}</div>
            <div class="col-md-6">3.3.2 AI辅助决策比例: \${item.p3_3_2 || '-'}</div>
            <div class="col-md-6">3.4.1 数据质量与贯通: \${item.p3_4_1 || '-'}</div>
            <div class="col-md-6">3.4.2 实时决策能力: \${item.p3_4_2 || '-'}</div>
            <div class="col-md-6">3.5.1 研发周期缩短: \${item.p3_5_1 || '-'}</div>
            <div class="col-md-6">3.5.2 创新产出质量: \${item.p3_5_2 || '-'}</div>
            <div class="col-md-6">3.6.1 需求响应速度: \${item.p3_6_1 || '-'}</div>
            <div class="col-md-6">3.6.2 定制化生产能力: \${item.p3_6_2 || '-'}</div>
            <div class="col-md-6">3.7.1 资源利用效率: \${item.p3_7_1 || '-'}</div>
        </div>

        <div class="mb-3"><strong>维度四：管理范式</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-6">4.1.1 扁平化/网络化: \${item.m4_1_1 || '-'}</div>
            <div class="col-md-6">4.1.2 跨部门协同效率: \${item.m4_1_2 || '-'}</div>
            <div class="col-md-6">4.2.1 流程敏捷性: \${item.m4_2_1 || '-'}</div>
            <div class="col-md-6">4.2.2 流程自迭代能力: \${item.m4_2_2 || '-'}</div>
            <div class="col-md-6">4.3.1 AI工具熟练度: \${item.m4_3_1 || '-'}</div>
            <div class="col-md-6">4.3.2 组织学习敏锐度: \${item.m4_3_2 || '-'}</div>
            <div class="col-md-6">4.4.1 授权赋能程度: \${item.m4_4_1 || '-'}</div>
            <div class="col-md-6">4.4.2 算法决策占比: \${item.m4_4_2 || '-'}</div>
            <div class="col-md-6">4.5.1 数字人才密度: \${item.m4_5_1 || '-'}</div>
            <div class="col-md-6">4.5.2 岗位动态调配: \${item.m4_5_2 || '-'}</div>
            <div class="col-md-6">4.5.3 技能重塑支持: \${item.m4_5_3 || '-'}</div>
            <div class="col-md-6">4.5.4 领导力转型: \${item.m4_5_4 || '-'}</div>
            <div class="col-md-6">4.6.1 目标管理动态性: \${item.m4_6_1 || '-'}</div>
            <div class="col-md-6">4.6.2 评价维度多元性: \${item.m4_6_2 || '-'}</div>
            <div class="col-md-6">4.6.3 激励机制有效性: \${item.m4_6_3 || '-'}</div>
            <div class="col-md-6">4.7.1 ESG管理融合度: \${item.m4_7_1 || '-'}</div>
        </div>

        <div class="mb-3"><strong>维度五：生态协同</strong></div>
        <div class="row mb-3 text-muted" style="font-size: 0.9em;">
            <div class="col-md-6">5.1.1 供应链透明度: \${item.e5_1_1 || '-'}</div>
            <div class="col-md-6">5.1.2 上下游业务协同: \${item.e5_1_2 || '-'}</div>
            <div class="col-md-6">5.2.1 产学研合作深度: \${item.e5_2_1 || '-'}</div>
            <div class="col-md-6">5.2.2 跨界融合创新: \${item.e5_2_2 || '-'}</div>
            <div class="col-md-6">5.3.1 平台资源开放度: \${item.e5_3_1 || '-'}</div>
            <div class="col-md-6">5.3.2 赋能外部伙伴: \${item.e5_3_2 || '-'}</div>
            <div class="col-md-6">5.4.1 创新网络活跃度: \${item.e5_4_1 || '-'}</div>
            <div class="col-md-6">5.4.2 利益共享机制: \${item.e5_4_2 || '-'}</div>
            <div class="col-md-6">5.5.1 社区/行业贡献: \${item.e5_5_1 || '-'}</div>
            <div class="col-md-6">5.5.2 监管合规响应: \${item.e5_5_2 || '-'}</div>
            <div class="col-md-6">5.6.1 绿色供应链建设: \${item.e5_6_1 || '-'}</div>
        </div>
`;

if (!content.includes('第三部分：新质组织成熟度评估')) {
    content = content.replace(
        /<h6 class="text-primary border-bottom pb-2 mb-3 mt-4">各维度多选题反馈/,
        matrixFieldsHTML + '\n        <h6 class="text-primary border-bottom pb-2 mb-3 mt-4">各维度多选题反馈'
    );
    fs.writeFileSync('admin/js/nqoc-survey.js', content);
    console.log('Done modifying admin/js/nqoc-survey.js');
} else {
    console.log('Already modified');
}
