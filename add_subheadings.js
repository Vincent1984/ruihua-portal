const fs = require('fs');
let html = fs.readFileSync('public/nqoc/survey.html', 'utf8');

const subheadings = {
    'V1.1.1': '1.1 价值观清晰度与共识度',
    'V1.2.1': '1.2 绿色发展导向',
    'V1.3.1': '1.3 创新导向',
    'V1.4.1': '1.4 可持续性承诺',
    'V1.5.1': '1.5 人机共生理念',
    'B2.1.1': '2.1 价值主张的数智化重构',
    'B2.2.1': '2.2 价值创造方式',
    'B2.3.1': '2.3 价值传递与客户连接',
    'B2.4.1': '2.4 价值捕获与盈利模式',
    'B2.5.1': '2.5 数据资产化',
    'B2.6.1': '2.6 价值的真实性与穿越周期能力',
    'B2.7.1': '2.7 可持续价值主张',
    'P3.1.1': '3.1 AI 技术应用深度与广度',
    'P3.2.1': '3.2 自动化与智能化水平',
    'P3.3.1': '3.3 人机协同程度',
    'P3.4.1': '3.4 数据驱动决策',
    'P3.5.1': '3.5 研发与创新效率',
    'P3.6.1': '3.6 生产敏捷性与柔性',
    'P3.7.1': '3.7 绿色与可持续生产',
    'M4.1.1': '4.1 组织架构（平台 + 敏捷小队）',
    'M4.2.1': '4.2 流程机制（智能自适应）',
    'M4.3.1': '4.3 组织能力（人机融合智能）',
    'M4.4.1': '4.4 决策机制',
    'M4.5.1': '4.5 人才与能力配置',
    'M4.6.1': '4.6 绩效与激励',
    'M4.7.1': '4.7 绿色与可持续管理',
    'E5.1.1': '5.1 产业链协同',
    'E5.2.1': '5.2 跨界与跨行业合作',
    'E5.3.1': '5.3 平台化能力与开放性',
    'E5.4.1': '5.4 共创生态',
    'E5.5.1': '5.5 社会与利益相关者关系',
    'E5.6.1': '5.6 绿色生态协同'
};

for (const [key, title] of Object.entries(subheadings)) {
    const searchStr = `<div class="mb-4 bg-white/5 p-4 rounded-lg">\n            <p class="text-sm text-white mb-4">${key}`;
    const replaceStr = `<div class="mt-8 mb-4 border-l-4 border-[var(--nqoc-brand)] pl-3">\n                                <h5 class="text-base font-bold text-white">${title}</h5>\n                            </div>\n                            <div class="mb-4 bg-white/5 p-4 rounded-lg">\n            <p class="text-sm text-white mb-4">${key}`;
    
    if (html.includes(searchStr)) {
        html = html.replace(searchStr, replaceStr);
    } else {
        console.log("Could not find:", searchStr);
    }
}

fs.writeFileSync('public/nqoc/survey.html', html);
console.log('Subheadings added successfully.');
