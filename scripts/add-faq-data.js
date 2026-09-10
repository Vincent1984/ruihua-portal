/**
 * 添加"决策者最常问的六个问题"到数据库
 * 基于 09-09.html 页面内容
 */

const mongoose = require('mongoose');

// 连接数据库
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/ruihua_cms';

console.log('连接数据库:', MONGODB_URL);

mongoose.connect(MONGODB_URL).then(() => {
  console.log('✅ 数据库连接成功');
  addFAQData();
}).catch(err => {
  console.error('❌ 数据库连接失败:', err);
  process.exit(1);
});

// FAQ 数据模型
const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: { type: String, default: 'AI转型' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const FAQ = mongoose.model('FAQ', faqSchema);

// 决策者最常问的六个问题（来自 09-09.html）
const faqData = [
  {
    question: '企业 AI 转型应该从哪个场景切入？',
    answer: '不要从最复杂的核心业务开始。优先选择高频、高人力、流程相对标准化的场景——比如客服工单、招聘筛选、费用报销。这类场景数据积累充分、容错空间大、见效快，能在 2-4 周内验证 AI 价值，建立团队信心后再逐步扩展到核心业务环节。瑞华智策在战略诊断阶段，会结合企业业务目标和数据现状，筛选出投入产出比最高的切入场景，避免"大而全"导致的项目拖延和资源浪费。',
    category: 'AI转型',
    order: 1
  },
  {
    question: '企业部署 AI Agent 需要多长时间见效？',
    answer: '分两个阶段：原型验证通常 2-4 周，用真实业务数据跑通核心链路，看到初步效果；完整部署并产生可量化的业务结果，一般需要 4-8 周，具体取决于场景复杂度、系统对接难度和数据准备情况。关键不是追求快，而是确保每一步都可验证、可衡量。瑞华智策采用三位一体交付模式，团队深入业务现场，边部署边调优，缩短从"能看到效果"到"能稳定运行"的周期。',
    category: 'AI转型',
    order: 2
  },
  {
    question: '企业 AI 转型需要多大的投入？',
    answer: '投入分三块：平台工具费（SaaS 订阅或私有化部署）、实施服务费（场景配置、系统对接、训练调优）、内部人力投入（业务团队参与共创）。具体金额因企业规模和场景复杂度差异较大，但相比从零自建 AI 团队，依托成熟平台加专业咨询的方式通常能节省 60% 以上的试错成本。建议先通过战略诊断明确范围，再给出精准预算，避免盲目投入。',
    category: 'AI转型',
    order: 3
  },
  {
    question: '如何评估企业 AI 转型的投入产出比？',
    answer: '不要只算"省了多少人力"。建议从三个维度衡量：效率提升（工单响应时间、处理量变化）、能力扩展（新增了哪些原来做不到的事）、质量改善（错误率、合规率变化）。在战略诊断阶段就定义好可量化的指标和基线，上线后按周期对比。瑞华智策在每个陪跑项目中都会建立量化看板，让投入产出清晰可见，而不是靠感觉判断"好像有效果"。',
    category: 'AI转型',
    order: 4
  },
  {
    question: '企业 AI 转型最大的风险是什么？',
    answer: '最大风险不是技术不成熟，而是场景选错和组织没跟上。场景选错——投入大量资源做了个没人用的 Agent；组织没跟上——AI 上线了但流程没改、团队不会用、管理层不持续关注。技术问题有工程方案可以解决，但组织和认知问题往往被忽视。瑞华智策的三位一体交付模式正是针对这个风险：不仅交付技术，更深入业务现场推动流程变革和团队赋能，确保 Agent 真正用起来。',
    category: 'AI转型',
    order: 5
  },
  {
    question: '瑞华智策和 Agent 平台厂商是什么关系？用哪个平台由谁决定？',
    answer: '瑞华智策厂商中立、按需选型：我们是腾讯云生态伙伴（授权编号 100049719305），也持续接入其他主流 Agent 平台；大部分场景选成熟 SaaS 快速验证，数据高度敏感场景按需私有化部署——选哪个平台，由你的数据敏感度与业务需求决定，不被单一厂商捆绑。交付流程包含四步：选（场景优先级清单）→育（Agent 部署与系统打通）→用（训练团队驾驭 AI）→优（审计调优与持续运营），确保 Agent 从演示到上岗再到自主运营的全生命周期落地。',
    category: 'AI转型',
    order: 6
  }
];

async function addFAQData() {
  try {
    console.log('\n开始添加 FAQ 数据...\n');

    // 检查是否已存在
    const existingCount = await FAQ.countDocuments();
    console.log(`当前数据库中已有 ${existingCount} 条 FAQ`);

    // 逐条添加或更新
    for (let i = 0; i < faqData.length; i++) {
      const faq = faqData[i];

      // 检查是否已存在相同问题
      const existing = await FAQ.findOne({ question: faq.question });

      if (existing) {
        // 更新现有数据
        await FAQ.updateOne(
          { question: faq.question },
          {
            $set: {
              answer: faq.answer,
              category: faq.category,
              order: faq.order,
              updatedAt: new Date()
            }
          }
        );
        console.log(`✅ [${i + 1}/6] 更新: ${faq.question.substring(0, 30)}...`);
      } else {
        // 插入新数据
        await FAQ.create(faq);
        console.log(`✅ [${i + 1}/6] 新增: ${faq.question.substring(0, 30)}...`);
      }
    }

    console.log('\n📊 添加完成！统计信息：');
    const total = await FAQ.countDocuments();
    const aiTransformCount = await FAQ.countDocuments({ category: 'AI转型' });

    console.log(`  总计: ${total} 条 FAQ`);
    console.log(`  AI转型分类: ${aiTransformCount} 条`);
    console.log(`  激活状态: ${await FAQ.countDocuments({ isActive: true })} 条`);

    console.log('\n✅ 数据添加成功！');
    console.log('\n📋 后续步骤：');
    console.log('  1. 访问管理后台查看 FAQ 列表');
    console.log('  2. 在首页模块中配置显示 FAQ');
    console.log('  3. 测试前端显示效果');

    process.exit(0);
  } catch (error) {
    console.error('❌ 添加 FAQ 数据失败:', error);
    process.exit(1);
  }
}
