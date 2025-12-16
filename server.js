const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// 加载环境变量
require('dotenv').config();

// 加载数据库配置
const dbConfig = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ==========================================
// 1. 【核心】伪静态路由拦截 (必须在 static 之前)
// ==========================================
// 当访问 /article/xxxx.html 时，直接返回 article.html 文件
// 前端页面加载后，会自己解析 URL 并请求 API 获取内容
app.get('/article/:slug.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/article.html'));
});

// 静态资源托管
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 配置上传
// ==========================================
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + Math.round(Math.random() * 1E9) + ext);
    }
});
const upload = multer({ storage: storage });

// 连接数据库
const currentEnv = process.env.NODE_ENV || 'development';
const mongoUrl = dbConfig[currentEnv].url;

mongoose.connect(mongoUrl)
.then(() => {
    console.log(`MongoDB 连接成功 (${currentEnv}): ${mongoUrl}`);
    initData().then(fixExistingData); // 启动时尝试修复旧数据
}).catch(err => console.error('MongoDB 连接失败:', err));

// ==========================================
// 2. Schema 定义
// ==========================================
const BannerSchema = new mongoose.Schema({
    title: String, subTitle: String, description: String,
    cta1Text: String, cta1Link: String, cta2Text: String, cta2Link: String, imageUrl: String
});
const Banner = mongoose.model('Banner', BannerSchema);

const SidebarSchema = new mongoose.Schema({
    whitepaper: { title: String, imageUrl: String, link: String },
    recommendations: [{ title: String, link: String }]
});
const Sidebar = mongoose.model('Sidebar', SidebarSchema);

// 文章表：增加 slug 字段
const ArticleSchema = new mongoose.Schema({
    title: String,
    category: String,
    slug: { type: String, unique: true }, // 伪静态标识
    summary: String,
    coverImage: String,
    content: String,
    author: { name: String, avatar: String, desc: String, detail: String },
    isRecommended: { type: Boolean, default: false },
    publishDate: { type: Date, default: Date.now }
});
const Article = mongoose.model('Article', ArticleSchema);

const FaqSchema = new mongoose.Schema({
    question: String, answer: String, order: { type: Number, default: 0 }
});
const Faq = mongoose.model('Faq', FaqSchema);

// ==========================================
// 3. 数据初始化 & 自动修复
// ==========================================
async function initData() {
    // 省略其他表的初始化检查，重点关注文章
    const articleCount = await Article.countDocuments();
    if (articleCount === 0) {
        // 插入默认数据
        await Article.create([
            {
                title: "AI 时代的人才管理新趋势", category: "行业洞察",
                slug: "renlizibenjiazhijingying",
                summary: "探讨人工智能...", content: "<p>内容...</p>", isRecommended: true
            }
        ]);
        console.log("✅ 默认数据已初始化");
    }
}

// 【关键修复脚本】自动给旧文章添加 slug
async function fixExistingData() {
    try {
        const articles = await Article.find({ slug: { $exists: false } });
        if (articles.length > 0) {
            console.log(`⚠️ 正在修复 ${articles.length} 篇旧文章的伪静态链接...`);
            for (let art of articles) {
                // 生成 slug: post-时间戳-随机数
                art.slug = `post-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                await art.save();
                console.log(`   > 已修复: ${art.title} -> /article/${art.slug}.html`);
            }
        }
    } catch (e) { console.error("数据修复失败:", e); }
}

// ==========================================
// 4. API 接口
// ==========================================

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: '未选择文件' });
    res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const adminUsername = process.env.ADMIN_USERNAME || 'zhice';
    const adminPassword = process.env.ADMIN_PASSWORD || 'zhiceruihua123';
    
    if (username === adminUsername && password === adminPassword) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: '账号或密码错误' });
    }
});

// 通用配置接口
app.get('/api/banner', async (req, res) => { try { res.json(await Banner.findOne()); } catch(e){ res.status(500).json({error:e.message}); } });
app.post('/api/banner', async (req, res) => { try { await Banner.findOneAndUpdate({}, req.body, { upsert: true }); res.json({ success: true }); } catch(e){ res.status(500).json({error:e.message}); } });
app.get('/api/sidebar', async (req, res) => { try { res.json(await Sidebar.findOne()); } catch(e){ res.status(500).json({error:e.message}); } });
app.post('/api/sidebar', async (req, res) => { try { await Sidebar.findOneAndUpdate({}, req.body, { upsert: true }); res.json({ success: true }); } catch(e){ res.status(500).json({error:e.message}); } });
app.get('/api/faqs', async (req, res) => { try { res.json(await Faq.find().sort({ order: 1 })); } catch(e){ res.status(500).json({error:e.message}); } });
app.post('/api/faqs', async (req, res) => { try { await new Faq(req.body).save(); res.json({ success: true }); } catch(e){ res.status(500).json({error:e.message}); } });
app.put('/api/faqs/:id', async (req, res) => { try { await Faq.findByIdAndUpdate(req.params.id, req.body); res.json({ success: true }); } catch(e){ res.status(500).json({error:e.message}); } });
app.delete('/api/faqs/:id', async (req, res) => { try { await Faq.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch(e){ res.status(500).json({error:e.message}); } });

// --- 文章接口 ---

// 1. 【核心修复】获取文章列表 (支持 category 筛选)
app.get('/api/articles', async (req, res) => { 
    try { 
        const { category } = req.query;
        let filter = {};

        // 如果有分类参数且不是 'all'，则添加过滤条件
        if (category && category !== 'all') {
            // 定义中英文映射表，确保无论数据库存的是中文还是英文都能查到
            const categoryMap = {
                'whitepaper': ['whitepaper', '白皮书'],
                'tech': ['tech', '技术趋势', '技术'],
                'ceo': ['ceo', 'CEO 必读', 'CEO必读', 'ceo必读'],
                'industry': ['industry', '行业报告', '行业洞察', '行业']
            };

            if (categoryMap[category]) {
                // 使用 $in 查询，匹配数组中的任意一个值
                filter.category = { $in: categoryMap[category] };
            } else {
                // 如果不在映射表中，直接精确匹配
                filter.category = category;
            }
        }

        const articles = await Article.find(filter).sort({ publishDate: -1 }); 
        res.json(articles); 
    } catch(e){ 
        res.status(500).json({error:e.message}); 
    } 
});

// 2. 根据 ID 获取详情 (兼容旧链接)
app.get('/api/articles/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ error: "无效ID" });
        
        const article = await Article.findById(id);
        if (!article) return res.status(404).json({ error: "文章不存在" });

        // 获取上下文 (同时查 slug)
        const prevArticle = await Article.findOne({ _id: { $ne: id }, publishDate: { $lt: article.publishDate } }).sort({ publishDate: -1 }).select('title _id slug');
        const nextArticle = await Article.findOne({ _id: { $ne: id }, publishDate: { $gt: article.publishDate } }).sort({ publishDate: 1 }).select('title _id slug');

        res.json({ ...article.toObject(), prev: prevArticle, next: nextArticle });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. 【新增】根据 Slug 获取详情 (伪静态专用)
app.get('/api/articles/slug/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        const article = await Article.findOne({ slug: slug });
        if (!article) return res.status(404).json({ error: "文章不存在" });

        const prevArticle = await Article.findOne({ _id: { $ne: article._id }, publishDate: { $lt: article.publishDate } }).sort({ publishDate: -1 }).select('title _id slug');
        const nextArticle = await Article.findOne({ _id: { $ne: article._id }, publishDate: { $gt: article.publishDate } }).sort({ publishDate: 1 }).select('title _id slug');

        res.json({ ...article.toObject(), prev: prevArticle, next: nextArticle });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 文章增删改
app.post('/api/articles', async (req, res) => { 
    try { 
        if(!req.body.slug) req.body.slug = "post-" + Date.now(); // 自动生成 slug
        const newArticle = new Article(req.body); 
        await newArticle.save(); 
        res.json({ success: true }); 
    } catch(e){ res.status(500).json({error:e.message}); } 
});
app.put('/api/articles/:id', async (req, res) => { try { await Article.findByIdAndUpdate(req.params.id, req.body); res.json({ success: true }); } catch(e){ res.status(500).json({error:e.message}); } });
app.delete('/api/articles/:id', async (req, res) => { try { await Article.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch(e){ res.status(500).json({error:e.message}); } });

app.listen(PORT, () => { console.log(`后台服务已启动: http://localhost:${PORT}/admin/index.html`); });