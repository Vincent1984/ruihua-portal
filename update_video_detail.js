const mongoose = require('mongoose');
const Video = require('./models/Video');
require('dotenv').config();

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/ruihua_cms';

async function update() {
  try {
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB...');

    const result = await Video.findOneAndUpdate(
      { slug: 'whitepaper-launch-2026' },
      {
        speakerName: 'Vincent Zhang',
        speakerTitle: '瑞华智策首席顾问',
        speakerAvatar: '/images/vincent.png',
        duration: '58:45',
        tags: ['组织人效', '白皮书', '2026趋势'],
        content: `
          <p>在本次发布会中，我们将深入探讨 2026 年全球及中国企业在组织人效领域的关键变革。主要内容包括：</p>
          <ul>
            <li>全球人效趋势：从“数字化”转向“智能化”</li>
            <li>行业对标：领先企业的效能管理闭环</li>
            <li>实战模型：瑞华 2.0 效能诊断体系拆解</li>
          </ul>
          <p>通过本次分享，您将获得一套可落地的组织人效提升工具包，助力企业在不确定性中寻找增长点。</p>
        `
      },
      { new: true }
    );

    if (result) {
      console.log('Updated video with detail data:', result.title);
    } else {
      console.log('Video not found to update.');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

update();
