const mongoose = require('mongoose');
const Video = require('../models/Video');
const VideoCategory = require('../models/VideoCategory');
const Author = require('../models/Author');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

module.exports = function(app, authRequired, requirePerm, logOp, generateDeepseekText) {

    // ==========================================
    // 1. Video Category Management API
    // ==========================================
    app.get('/api/video-categories/tree', async (req, res) => {
        try {
            const categories = await VideoCategory.find().sort({ order: 1 });
            const buildTree = (parentId = null) => {
                return categories
                    .filter(c => String(c.parentId) === String(parentId))
                    .map(c => ({
                        ...c.toObject(),
                        children: buildTree(c._id)
                    }));
            };
            res.json({ success: true, data: buildTree() });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/video-categories/list', async (req, res) => {
        try {
            const categories = await VideoCategory.find().sort({ order: 1 });
            res.json({ success: true, data: categories });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/video-categories', authRequired, requirePerm('video:create'), async (req, res) => {
        try {
            const cat = new VideoCategory(req.body);
            await cat.save();
            await logOp('create', 'VideoCategory', `Created category: ${cat.name}`, req.user.username);
            res.json({ success: true, data: cat });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.put('/api/video-categories/:id', authRequired, requirePerm('video:edit'), async (req, res) => {
        try {
            const cat = await VideoCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
            await logOp('update', 'VideoCategory', `Updated category: ${cat.name}`, req.user.username);
            res.json({ success: true, data: cat });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.delete('/api/video-categories/:id', authRequired, requirePerm('video:delete'), async (req, res) => {
        try {
            const hasChildren = await VideoCategory.exists({ parentId: req.params.id });
            if (hasChildren) return res.status(400).json({ error: '请先删除子分类' });
            
            const hasVideos = await Video.exists({ videoCategories: req.params.id });
            if (hasVideos) return res.status(400).json({ error: '该分类下存在视频，无法删除' });

            await VideoCategory.findByIdAndDelete(req.params.id);
            await logOp('delete', 'VideoCategory', `Deleted category: ${req.params.id}`, req.user.username);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ==========================================
    // 2. AI Tools API
    // ==========================================
    app.post('/api/tools/video/slug', authRequired, async (req, res) => {
        try {
            const { title } = req.body;
            if (!title) return res.status(400).json({ error: '需要提供标题' });
            
            const systemPrompt = `You are an SEO URL slug generator. Based on the video title provided, extract the core semantic keywords, translate them into English, and format them as a URL slug.
Rules:
1. Extract exactly 3 to 5 core English keywords.
2. Join the keywords with hyphens (-).
3. All letters MUST be lowercase.
4. If the title lacks enough information, use synonyms or related terms to reach at least 3 keywords.
5. Remove any special characters, punctuation, and stop words (like 'a', 'the', 'in').
6. NEVER return a single word.
7. ONLY return the final slug string, no explanation, no quotes.

Examples:
Input: "2026年人工智能基础教程与实践指南"
Output: ai-basics-tutorial-practice-guide

Input: "HR战略论坛"
Output: hr-strategy-forum-video`;
            
            const userPrompt = `Title: ${title}`;
            let slug = await generateDeepseekText(systemPrompt, userPrompt);
            
            // Clean up: lowercase, keep only a-z and hyphens, replace multiple hyphens with single
            slug = slug.toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            
            // Validate keyword count (fallback if AI fails)
            let parts = slug.split('-');
            if (parts.length < 3 || parts.length > 5) {
                // Generate a random fallback if parsing failed completely or too short/long
                if (parts.length === 0 || !parts[0]) {
                    slug = `video-post-${Math.random().toString(36).substring(2, 6)}`;
                } else {
                    // Try to adjust the length
                    if (parts.length > 5) {
                        slug = parts.slice(0, 5).join('-');
                    } else if (parts.length < 3) {
                        // Ensure we have at least 3 parts by padding with relevant words
                        const padding = ['video', 'post', 'online'];
                        while (parts.length < 3) {
                            parts.push(padding.shift());
                        }
                        slug = parts.join('-');
                    }
                }
            }

            // Ensure uniqueness
            let uniqueSlug = slug;
            let counter = 1;
            while (await Video.exists({ slug: uniqueSlug })) {
                uniqueSlug = `${slug}-${counter}`;
                counter++;
            }

            res.json({ success: true, data: uniqueSlug });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/tools/video/tags', authRequired, async (req, res) => {
        try {
            const { title, description } = req.body;
            const systemPrompt = `You are an AI tag generator for videos. Generate exactly 3 highly relevant tags based on the provided title and description. Each tag MUST be exactly 4 Chinese characters long. Return a JSON array of objects with 'name' and 'score' (1-100). Do not use markdown blocks, just the JSON. Format: [{"name":"人工智能", "score":95}]`;
            const userPrompt = `Title: ${title || ''}\nDesc: ${description || ''}`;
            
            let jsonText = await generateDeepseekText(systemPrompt, userPrompt);
            const match = jsonText.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (match) jsonText = match[0];
            else jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const tags = JSON.parse(jsonText);
            res.json({ success: true, data: tags });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/tools/video/seo', authRequired, async (req, res) => {
        try {
            const { title, description, content } = req.body;
            const systemPrompt = `You are an expert in SEO and Generative Engine Optimization (GEO). Based on the video information, generate optimized metadata in JSON format.
Required JSON structure:
{
  "metaTitle": "Optimized title (under 60 chars)",
  "metaDescription": "Optimized description (under 160 chars)",
  "seoKeywords": ["四字词语一", "四字词语二", "四字词语三"], // MUST be exactly 3 keywords, and each MUST be exactly 4 Chinese characters
  "geoSummary": "A highly informative, AI-friendly summary paragraph that directly answers the core topic of the video (under 300 chars)."
}
Do not include any markdown, just return the raw JSON object.`;
            const userPrompt = `Title: ${title || ''}\nDesc: ${description || ''}\nContent: ${(content || '').substring(0, 1000)}`;
            
            let jsonText = await generateDeepseekText(systemPrompt, userPrompt);
            const match = jsonText.match(/\{[\s\S]*\}/);
            if (match) jsonText = match[0];
            
            const data = JSON.parse(jsonText);
            res.json({ success: true, data });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/tools/video/score', authRequired, async (req, res) => {
        try {
            const { title, description, content, tags, metaTitle, metaDescription, geoSummary } = req.body;
            const systemPrompt = `你是一个专业的中国生成式搜索引擎优化(GEO)和传统SEO专家。
请根据以下提供的内容，从中文内容生态（百度文心、阿里通义、讯飞星火、智谱GLM等）的角度进行深度评分。
评分维度必须包含：
1. 关键词密度：标题与正文的词汇关联度。
2. 语义连贯性：上下文逻辑与大模型抓取的友好度。
3. 多模态关联：图文、音视频结构化数据的丰富度。
4. 用户意图匹配度：是否直接回答了潜在搜索者的核心痛点。

必须返回严格的JSON格式数据，不能包含任何Markdown标记：
{
  "total": 综合得分(0-100),
  "seo": 传统SEO得分(0-100),
  "geo": 生成式引擎友好度GEO得分(0-100),
  "level": "A|B|C|D",
  "summary": "一句话整体评价(中文)",
  "suggestions": [
    {"title":"优化建议标题(如: 提升关键词密度)", "suggestion":"具体的执行建议..."},
    {"title":"优化建议标题(如: 强化用户意图匹配)", "suggestion":"具体的执行建议..."},
    {"title":"优化建议标题(如: 优化语义连贯性)", "suggestion":"具体的执行建议..."}
  ]
}`;
            const userPrompt = `标题: ${title || ''}\n简介: ${description || ''}\n正文: ${(content || '').substring(0, 1200)}\n标签: ${Array.isArray(tags) ? tags.join(',') : ''}\nMeta标题: ${metaTitle || ''}\nMeta描述: ${metaDescription || ''}\nGEO摘要: ${geoSummary || ''}`;
            let jsonText = await generateDeepseekText(systemPrompt, userPrompt);
            const match = jsonText.match(/\{[\s\S]*\}/);
            if (match) jsonText = match[0];
            const parsed = JSON.parse(jsonText);
            const data = {
                total: Number(parsed.total) || 0,
                seo: Number(parsed.seo) || 0,
                geo: Number(parsed.geo) || 0,
                level: parsed.level || 'C',
                summary: parsed.summary || '建议完善标题、摘要与关键词的一致性，以适配主流中文大模型抓取。',
                suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 6) : []
            };
            res.json({ success: true, data });
        } catch (e) {
            console.error('Video SEO/GEO Score Error:', e);
            const fallback = {
                total: 60,
                seo: 58,
                geo: 62,
                level: 'C',
                summary: 'AI评分服务暂不可用，已返回基线建议。',
                suggestions: [
                    { title: '用户意图匹配', suggestion: '将视频标题压缩为“人群+问题+结果”结构，直接命中用户搜索痛点。' },
                    { title: '语义连贯与GEO摘要', suggestion: '在 GEO 摘要前 120 字直接给出关键结论，提升大模型（如文心、通义）的直接引用率。' },
                    { title: '多模态关键词一致性', suggestion: '确保视频标签、Meta 标题、描述以及正文第一段使用一致的核心长尾词组。' }
                ]
            };
            res.json({ success: true, data: fallback });
        }
    });

    app.post('/api/tools/video/faq', authRequired, async (req, res) => {
        try {
            const { title, description, content } = req.body;
            if (!title) return res.status(400).json({ error: '需要提供标题' });

            const systemPrompt = `You are a helpful assistant. Based on the provided video title, description, and content, generate 3-5 Frequently Asked Questions (FAQ) with their answers.
Return the result strictly as a JSON array of objects, like this:
[
  { "question": "Question 1", "answer": "Answer 1" },
  { "question": "Question 2", "answer": "Answer 2" }
]
Do not output any other text or markdown formatting.`;
            const userPrompt = `Title: ${title || ''}\nDescription: ${description || ''}\nContent: ${(content || '').substring(0, 1500)}`;
            
            let jsonText = await generateDeepseekText(systemPrompt, userPrompt);
            const match = jsonText.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (match) jsonText = match[0];
            else jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const faqList = JSON.parse(jsonText);
            res.json({ success: true, data: faqList });
        } catch (e) {
            res.status(500).json({ error: e.message || '生成FAQ失败' });
        }
    });

    // ==========================================
    // 3. Video Metadata API (Duration)
    // ==========================================
    app.post('/api/tools/video/parse-metadata', authRequired, async (req, res) => {
        try {
            const { videoUrl } = req.body;
            if (!videoUrl) return res.status(400).json({ error: 'Missing videoUrl' });
            
            let targetPath = videoUrl;
            if (targetPath.startsWith('/uploads/')) {
                targetPath = path.join(__dirname, '..', targetPath);
            } else if (targetPath.startsWith('http')) {
                // For external URLs, we might need a stream or rely on frontend. Let's just pass it to ffprobe.
            }

            ffmpeg.ffprobe(targetPath, (err, metadata) => {
                if (err) {
                    console.error('ffprobe error:', err);
                    // Mock fallback if ffmpeg is not installed or fails
                    return res.json({ success: true, data: { durationSeconds: 120, duration: '02:00', format: 'unknown' }});
                }
                const durationSeconds = Math.round(metadata.format.duration);
                const mins = Math.floor(durationSeconds / 60).toString().padStart(2, '0');
                const secs = (durationSeconds % 60).toString().padStart(2, '0');
                const format = metadata.format.format_name;
                res.json({ success: true, data: { durationSeconds, duration: `${mins}:${secs}`, format }});
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ==========================================
    // 4. Authors / Experts Integration API
    // ==========================================
    app.get('/api/authors/search', authRequired, async (req, res) => {
        try {
            const { q } = req.query;
            const query = q ? { name: new RegExp(q, 'i') } : {};
            const authors = await Author.find(query).limit(20).select('name desc avatar');
            res.json({ success: true, data: authors });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

};
