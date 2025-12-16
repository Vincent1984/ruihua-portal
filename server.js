const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');

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

// 预约表
const AppointmentSchema = new mongoose.Schema({
    name: String,
    phone: String,
    company: String,
    title: String,
    problem: String,
    source: String, // 来源页面
    createdAt: { type: Date, default: Date.now }
});
const Appointment = mongoose.model('Appointment', AppointmentSchema);

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

// ==========================================
// 钉钉通知功能
// ==========================================
async function sendDingTalkNotification(appointment) {
    const webhookUrl = process.env.DINGTALK_WEBHOOK_URL;
    const secret = process.env.DINGTALK_SECRET;
    
    if (!webhookUrl || webhookUrl.includes('YOUR_ACCESS_TOKEN')) {
        console.log('钉钉 Webhook 未配置，跳过通知发送');
        return;
    }

    try {
        // 生成签名（如果有密钥）
        let finalUrl = webhookUrl;
        if (secret && !secret.includes('YOUR_SECRET')) {
            const crypto = require('crypto');
            const timestamp = Date.now();
            const stringToSign = timestamp + '\n' + secret;
            const sign = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
            finalUrl += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
        }

        const message = {
            msgtype: 'markdown',
            markdown: {
                title: '新的预约提交',
                text: `## 🎯 新的预约提交
                
**姓名：** ${appointment.name}
**公司：** ${appointment.company}
**职位：** ${appointment.title}
**手机：** ${appointment.phone}
**问题描述：** ${appointment.problem || '无'}
**来源页面：** ${appointment.source}
**提交时间：** ${new Date(appointment.createdAt).toLocaleString('zh-CN')}

> 请及时跟进客户需求！`
            }
        };

        await axios.post(finalUrl, message, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('钉钉通知发送成功');
    } catch (error) {
        console.error('钉钉通知发送失败:', error.message);
    }
}

// ==========================================
// 预约 API 接口
// ==========================================
app.post('/api/appointments', async (req, res) => {
    try {
        const { name, company, title, phone, problem, source } = req.body;
        
        // 基本验证
        if (!name || !company || !title || !phone) {
            return res.status(400).json({ 
                success: false, 
                error: '姓名、公司、职位和手机号为必填项' 
            });
        }

        // 手机号格式验证
        const phoneReg = /^1[3-9]\d{9}$/;
        if (!phoneReg.test(phone)) {
            return res.status(400).json({ 
                success: false, 
                error: '请输入有效的手机号码' 
            });
        }

        // 创建预约记录
        const appointment = new Appointment({
            name: name.trim(),
            company: company.trim(),
            title: title.trim(),
            phone: phone.trim(),
            problem: problem ? problem.trim() : '',
            source: source || 'unknown'
        });

        await appointment.save();
        
        // 发送钉钉通知
        await sendDingTalkNotification(appointment);
        
        res.json({ 
            success: true, 
            message: '预约提交成功，我们会尽快与您联系！',
            id: appointment._id 
        });
        
    } catch (error) {
        console.error('预约提交失败:', error);
        res.status(500).json({ 
            success: false, 
            error: '服务器错误，请稍后重试' 
        });
    }
});

// 获取预约列表（管理后台用）
app.get('/api/appointments', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const appointments = await Appointment.find()
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await Appointment.countDocuments();
        
        res.json({
            success: true,
            data: appointments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('获取预约列表失败:', error);
        res.status(500).json({ 
            success: false, 
            error: '服务器错误' 
        });
    }
});

app.listen(PORT, () => { console.log(`后台服务已启动: http://localhost:${PORT}/admin/index.html`); });