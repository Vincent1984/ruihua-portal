// 历史文章/案例 slug 回填脚本
// 用途：将存量拼音 slug 重新生成为 SEO 友好的英文关键词 slug（AI 优先，回退拼音）
// 用法：
//   node scripts/backfill-slugs.js --dry-run   # 仅预览，不写入
//   node scripts/backfill-slugs.js             # 实际写入
require('dotenv').config();
const mongoose = require('mongoose');
const { slugify } = require('transliteration');
const Article = require('../models/Article');
const Case = require('../models/Case');

const API_URL = 'https://api.deepseek.com/chat/completions';

async function aiSlug(title) {
    const API_KEY = process.env.DEEPSEEK_API_KEY;
    if (!API_KEY) return null;
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an SEO URL slug generator. Extract 3 to 5 core English keywords from the given Chinese title, translate them to English, and join with hyphens. Rules: all lowercase, hyphens only, no stop words, no special characters or punctuation. Return ONLY the slug string, no explanation, no quotes.'
                    },
                    { role: 'user', content: `Title: ${title}` }
                ],
                stream: false
            })
        });
        if (!response.ok) return null;
        const data = await response.json();
        const raw = data?.choices?.[0]?.message?.content?.trim() || '';
        return raw.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    } catch (e) {
        console.error('AI slug failed:', e.message);
        return null;
    }
}

async function genSlug(title, Model, excludeId) {
    let slug = '';
    const ai = await aiSlug(title);
    if (ai) {
        slug = ai;
        const parts = slug.split('-').filter(Boolean);
        if (parts.length > 5) slug = parts.slice(0, 5).join('-');
        if (parts.length < 2) slug = '';
    }
    if (!slug) {
        const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or', 'with', 'by']);
        slug = slugify(title, { lowercase: true, separator: '-' })
            .split('-').filter(w => w && !stopWords.has(w)).join('-');
    }
    if (slug.length > 60) slug = slug.slice(0, 60).replace(/-+$/, '');
    if (!slug) slug = 'post-' + Date.now().toString(36);

    let unique = slug;
    let i = 1;
    while (await Model.findOne({ slug: unique, _id: { $ne: excludeId } })) {
        unique = `${slug}-${i++}`;
    }
    return unique;
}

(async () => {
    const dryRun = process.argv.includes('--dry-run');
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/ruihua_cms');
    console.log(`Deepseek API Key: ${process.env.DEEPSEEK_API_KEY ? '已配置' : '未配置（将回退拼音）'}`);
    console.log(dryRun ? '模式：DRY-RUN（仅预览）' : '模式：实际写入');

    for (const Model of [Article, Case]) {
        const docs = await Model.find({ slug: { $exists: true, $ne: '' } }).select('title slug').lean();
        console.log(`\n=== ${Model.modelName}（${docs.length} 条）===`);
        for (const d of docs) {
            if (!d.title || !String(d.title).trim()) {
                console.log(`跳过（无标题，无法生成） _id=${d._id} slug=${d.slug}`);
                continue;
            }
            const newSlug = await genSlug(d.title, Model, d._id);
            if (newSlug === d.slug) {
                console.log(`跳过（无变化） ${d.slug}`);
                continue;
            }
            console.log(`${d.slug}\n  => ${newSlug}`);
            if (!dryRun) {
                await Model.updateOne({ _id: d._id }, { $set: { slug: newSlug, updatedAt: new Date() } });
            }
        }
    }

    await mongoose.disconnect();
    console.log('\n完成。');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
