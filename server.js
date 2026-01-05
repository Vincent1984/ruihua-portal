require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const crypto = require('crypto');

// Import Models
const Appointment = require('./models/Appointment');
const Article = require('./models/Article');
const OperationLog = require('./models/OperationLog');
const Role = require('./models/Role');
const Admin = require('./models/admin'); // Corrected model name
const MaturitySubmission = require('./models/MaturitySubmission');
const Faq = require('./models/Faq');
const Category = require('./models/Category');
const Setting = require('./models/Setting');
const Subscription = require('./models/Subscription');
const WhitepaperSubmission = require('./models/WhitepaperSubmission');
const VerificationCode = require('./models/VerificationCode');
const quizData = require('./config/quizData'); // Import Quiz Data
const XLSX = require('xlsx'); // Import xlsx
const { slugify } = require('transliteration');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'ruihua_secret_key_change_this'; // In production, use env var

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// UTM Tracking Middleware
app.use((req, res, next) => {
    const { utm_source, utm_medium, utm_campaign, utm_term, utm_content } = req.query;
    if (utm_source) {
        const isValid = (str) => /^[a-zA-Z0-9_\-]+$/.test(str);
        const cookieOptions = {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        };
        if (isValid(utm_source)) res.cookie('utm_source', utm_source, cookieOptions);
        if (utm_medium && isValid(utm_medium)) res.cookie('utm_medium', utm_medium, cookieOptions);
        if (utm_campaign && isValid(utm_campaign)) res.cookie('utm_campaign', utm_campaign, cookieOptions);
        if (utm_term && isValid(utm_term)) res.cookie('utm_term', utm_term, cookieOptions);
        if (utm_content && isValid(utm_content)) res.cookie('utm_content', utm_content, cookieOptions);
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Serve specific HTML files from root
const rootHtmlFiles = [
    'about.html', 'article.html', 'diagnostic-result.html', 'diagnostic.html', 
    'form.html', 'form2.html', 'index.html', 'privacy.html', 
    'productivity.html', 'resources.html', 'solutions.html'
];

rootHtmlFiles.forEach(file => {
    app.get('/' + file, (req, res) => res.sendFile(path.join(__dirname, file)));
});

// Serve index.html for root path
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// --- Auth Middleware ---
function authRequired(req, res, next) {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        const payload = jwt.verify(token, SECRET_KEY);
        req.user = payload;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// DB Connection
console.log('Environment MONGODB_URL:', process.env.MONGODB_URL);
const mongoUrl = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/ruihua_cms';
console.log('Using MongoDB URL:', mongoUrl);
mongoose.connect(mongoUrl)
    .then(() => console.log('MongoDB Connected to:', mongoUrl))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Multer Config for Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public/uploads/'))
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)) // Append extension
    }
});
const upload = multer({ storage: storage });

// Helper: Operation Logging
async function logOp(action, module, detail, operator) {
    try {
        await OperationLog.create({
            action,
            module,
            detail,
            operator: operator || 'System',
            ip: '127.0.0.1' // Simplify for now
        });
    } catch (e) {
        console.error('Logging failed:', e);
    }
}

// --- Permission Middleware ---
async function checkPerm(req, res, next, requiredPerm) {
    // If authRequired passed, req.user is set
    // But we need full user details to check role permissions properly
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        
        // Fetch fresh user/role data
        const admin = await Admin.findById(req.user.id).populate('roles');
        if (!admin || !admin.isActive) return res.status(403).json({ error: 'Account disabled or not found' });
        
        // Check if roles exist
        if (!admin.roles || admin.roles.length === 0) return res.status(403).json({ error: 'No roles assigned' });
        
        // Aggregate permissions
        const allPerms = new Set();
        admin.roles.forEach(role => {
            if (role.permissions) {
                role.permissions.forEach(p => allPerms.add(p));
            }
        });
        
        if (allPerms.has('all')) {
            return next();
        }
        
        if (allPerms.has(requiredPerm)) {
            return next();
        }
        
        return res.status(403).json({ error: 'Permission denied: ' + requiredPerm });
    } catch (e) {
        console.error('Perm Check Error:', e);
        res.status(500).json({ error: 'Internal Error' });
    }
}

const requirePerm = (perm) => {
    return (req, res, next) => checkPerm(req, res, next, perm);
};

// --- Auth Routes ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username }).populate('roles');
        
        if (!admin) {
            return res.status(401).json({ success: false, message: '用户不存在' });
        }
        
        // Check password (if hashed) or plain text (for legacy/dev)
        // Assume all passwords should be hashed, but for safety in dev, check plain if match
        let isMatch = false;
        if (admin.password.startsWith('$')) {
             isMatch = await bcrypt.compare(password, admin.password);
        } else {
             isMatch = (password === admin.password);
             // Auto-hash plain password for security upgrade? Maybe later.
        }

        if (!isMatch) {
            return res.status(401).json({ success: false, message: '密码错误' });
        }

        if (!admin.isActive) {
            return res.status(403).json({ success: false, message: '账号已禁用' });
        }

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        const token = jwt.sign({ id: admin._id, username: admin.username, roles: admin.roles }, SECRET_KEY, { expiresIn: '24h' });
        
        await logOp('login', 'Auth', `User ${username} logged in`, username);

        res.json({ success: true, token, admin: { id: admin._id, name: admin.name, roles: admin.roles } });

    } catch (e) {
        console.error('Login Error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// Token verify
app.get('/api/auth/verify', authRequired, (req, res) => {
    res.json({ success: true, user: req.user });
});

// --- Dashboard Stats API (Restored) ---
app.get('/api/dashboard/stats', authRequired, async (req, res) => {
    try {
        let { startDate, endDate } = req.query;
        let start, end;

        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            end = new Date();
            start = new Date();
            start.setDate(end.getDate() - 6);
            start.setHours(0, 0, 0, 0);
        }

        const dates = [];
        let current = new Date(start);
        while (current <= end) {
            dates.push(current.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }));
            current.setDate(current.getDate() + 1);
        }

        const [apptStats, artStats, logStats] = await Promise.all([
            Appointment.aggregate([
                { $match: { createdAt: { $gte: start, $lte: end } } },
                { $group: { _id: { $dateToString: { format: "%m/%d", date: "$createdAt", timezone: "+08:00" } }, count: { $sum: 1 } } }
            ]),
            Article.aggregate([
                { $match: { publishDate: { $gte: start, $lte: end } } },
                { $group: { _id: { $dateToString: { format: "%m/%d", date: "$publishDate", timezone: "+08:00" } }, count: { $sum: 1 } } }
            ]),
            OperationLog.aggregate([
                { $match: { createdAt: { $gte: start, $lte: end } } },
                { $group: { _id: { $dateToString: { format: "%m/%d", date: "$createdAt", timezone: "+08:00" } }, count: { $sum: 1 } } }
            ])
        ]);

        const mapStats = (stats) => dates.map(date => {
            const found = stats.find(s => s._id === date);
            return found ? found.count : 0;
        });

        // Mock visits for demo
        const visits = dates.map(() => Math.floor(Math.random() * 500) + 800);

        res.json({
            dates,
            series: {
                visits,
                appointments: mapStats(apptStats),
                articles: mapStats(artStats),
                logs: mapStats(logStats)
            },
            summary: {
                totalVisits: 12045 + Math.floor(Math.random() * 100),
                totalAppts: await Appointment.countDocuments(),
                totalArts: await Article.countDocuments(),
                pendingFaqs: 0 // Placeholder
            }
        });
    } catch (e) {
        console.error('Stats Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- Article Routes ---
app.get('/article/:slug', (req, res) => {
    // This route handles /article/some-slug.html (express ignores the extension in the param if defined like this, 
    // BUT we need to be careful. Actually, standard way is to use a wildcard or handle it explicitly)
    // Better approach for static serving with dynamic routing:
    // Send the article.html file, and let the frontend JS fetch the data based on the URL.
    res.sendFile(path.join(__dirname, 'article.html'));
});

// Also handle the case where .html is part of the url explicitly if the above doesn't catch it
app.get('/article/:slug.html', (req, res) => {
     res.sendFile(path.join(__dirname, 'article.html'));
});

// --- Article API ---
app.get('/api/articles', async (req, res) => {
    // Public endpoint, but maybe we want to filter drafts for public?
    // Current implementation returns all matching query.
    // For admin, we might need a separate endpoint or just use this.
    // Let's keep it public for now.
    try {
        const { keyword, category, featured, page, limit } = req.query;
        let query = {};
        
        if (keyword) {
            const regex = new RegExp(keyword, 'i');
            query.$or = [{ title: regex }, { content: regex }, { summary: regex }];
        }
        
        if (category && category !== 'all') {
            query.category = category;
        }

        if (featured === 'true') {
            query.isRecommended = true;
        }

        let articles;
        if (page && limit) {
            const skip = (page - 1) * limit;
            const total = await Article.countDocuments(query);
            const data = await Article.find(query)
                .sort({ publishDate: -1 })
                .skip(parseInt(skip))
                .limit(parseInt(limit));
            
            res.json({
                data,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            });
        } else {
            // Backward compatibility for non-paginated calls (if any)
            articles = await Article.find(query).sort({ publishDate: -1 });
            res.json(articles);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/articles/detail/query', async (req, res) => {
    try {
        const { slug } = req.query;
        if (!slug) return res.status(400).json({ error: 'Slug is required' });
        
        const article = await Article.findOneAndUpdate(
            { slug },
            { $inc: { views: 1 } },
            { new: true }
        );
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json(article);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/articles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // console.log('Checking article ID:', id);
        if (!mongoose.Types.ObjectId.isValid(id)) {
            // console.log('Invalid ID detected');
            return res.status(404).json({ error: 'Invalid article id' });
        }
        const article = await Article.findById(id);
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json(article);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/articles', authRequired, requirePerm('article:create'), async (req, res) => {
    try {
        const { slug } = req.body;
        // Check uniqueness
        if (slug) {
            const existing = await Article.findOne({ slug });
            if (existing) {
                return res.status(400).json({ error: 'URL (Slug) 已存在，请更换' });
            }
        }
        
        const newArticle = new Article(req.body);
        // Handle slug if not provided
        if (!newArticle.slug) newArticle.slug = 'art-' + Date.now();
        await newArticle.save();
        
        // Update category count
        if (req.body.category) {
            await Category.updateOne({ code: req.body.category }, { $inc: { articleCount: 1 } });
        }
        
        await logOp('create', 'Article', `Created article: ${newArticle.title}`, req.user.username);
        res.json({ success: true, data: newArticle });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: 'URL (Slug) 已存在' });
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/articles/:id', authRequired, requirePerm('article:edit'), async (req, res) => {
    try {
        const { slug } = req.body;
        // Check uniqueness for update
        if (slug) {
            const existing = await Article.findOne({ slug, _id: { $ne: req.params.id } });
            if (existing) {
                return res.status(400).json({ error: 'URL (Slug) 已存在，请更换' });
            }
        }

        const oldArt = await Article.findById(req.params.id);
        const updatedArticle = await Article.findByIdAndUpdate(req.params.id, req.body, { new: true });
        
        // Handle category count update if changed
        if (oldArt && oldArt.category !== req.body.category) {
             if (oldArt.category) await Category.updateOne({ code: oldArt.category }, { $inc: { articleCount: -1 } });
             if (req.body.category) await Category.updateOne({ code: req.body.category }, { $inc: { articleCount: 1 } });
        }

        await logOp('update', 'Article', `Updated article: ${updatedArticle.title}`, req.user.username);
        res.json({ success: true, data: updatedArticle });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: 'URL (Slug) 已存在' });
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/articles/:id/like', async (req, res) => {
    try {
        const article = await Article.findByIdAndUpdate(
            req.params.id, 
            { $inc: { likes: 1 } }, 
            { new: true }
        );
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json({ success: true, likes: article.likes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/articles/:id', authRequired, requirePerm('article:delete'), async (req, res) => {
    try {
        const art = await Article.findByIdAndDelete(req.params.id);
        if (art && art.category) {
            await Category.updateOne({ code: art.category }, { $inc: { articleCount: -1 } });
        }
        await logOp('delete', 'Article', `Deleted article: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Category API ---
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find().sort({ order: 1 });
        res.json(categories);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/categories', authRequired, requirePerm('article:create'), async (req, res) => {
    try {
        const newCat = new Category(req.body);
        await newCat.save();
        await logOp('create', 'Category', `Created category: ${newCat.name}`, req.user.username);
        res.json({ success: true, data: newCat });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/categories/:id', authRequired, requirePerm('article:edit'), async (req, res) => {
    try {
        const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: cat });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/categories/:id', authRequired, requirePerm('article:delete'), async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        // Note: Should we handle articles in this category? For now, just leave them.
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- FAQ API ---
app.get('/api/faqs', async (req, res) => {
    try {
        const faqs = await Faq.find().sort({ order: 1 });
        res.json(faqs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/faqs/:id', async (req, res) => {
    try {
        const faq = await Faq.findById(req.params.id);
        if (!faq) return res.status(404).json({ error: 'FAQ not found' });
        res.json(faq);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/faqs', authRequired, requirePerm('faq:create'), async (req, res) => {
    try {
        // Remove category if passed (User requested removal)
        const { category, ...rest } = req.body;
        const newFaq = new Faq(rest);
        await newFaq.save();
        await logOp('create', 'FAQ', `Created FAQ: ${newFaq.question}`, req.user.username);
        res.json({ success: true, data: newFaq });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/faqs/:id', authRequired, requirePerm('faq:edit'), async (req, res) => {
    try {
        const { category, ...rest } = req.body;
        const faq = await Faq.findByIdAndUpdate(req.params.id, { ...rest, updatedAt: Date.now() }, { new: true });
        await logOp('update', 'FAQ', `Updated FAQ: ${faq.question}`, req.user.username);
        res.json({ success: true, data: faq });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/faqs/:id', authRequired, requirePerm('faq:delete'), async (req, res) => {
    try {
        await Faq.findByIdAndDelete(req.params.id);
        await logOp('delete', 'FAQ', `Deleted FAQ: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Admin/User API ---
// Only super admins (perm 'all') or specific user management perm should access this
// We'll assume 'all' for now as per permission list, or add 'user:manage'
// The current list has 'all' and business perms. Let's use 'all' for user management for now or check if there is a specific one.
// The dict had: 'article:...', 'faq:...', 'banner:...', 'sidebar:...', 'appointment:...'.
// No 'user:...' in the provided list. So we restrict to 'all' (Super Admin).

app.get('/api/admins', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const admins = await Admin.find().populate('roles');
        res.json(admins);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admins', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const { username, password, roles, name } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Password Policy Check
        const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        if (!pwdRegex.test(password)) {
            return res.status(400).json({ error: '密码必须包含字母和数字，且至少8位' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newAdmin = new Admin({
            username,
            password: hashedPassword,
            name,
            roles: roles || [],
            isActive: true
        });
        
        await newAdmin.save();
        await logOp('create', 'Admin', `Created user: ${username}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: '用户名已存在' });
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/admins/:id', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const { username, password, roles, name, isActive } = req.body;
        const updates = { username, name, roles: roles || [], isActive };

        // Check if username exists (if changed)
        if (username) {
            const existing = await Admin.findOne({ username, _id: { $ne: req.params.id } });
            if (existing) return res.status(400).json({ error: '用户名已存在' });
        }

        // Handle password update
        if (password) {
            // Password Policy Check
            const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
            if (!pwdRegex.test(password)) {
                return res.status(400).json({ error: '密码必须包含字母和数字，且至少8位' });
            }
            updates.password = await bcrypt.hash(password, 10);
        }

        await Admin.findByIdAndUpdate(req.params.id, updates);
        await logOp('update', 'Admin', `Updated user: ${username || req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admins/:id', authRequired, requirePerm('all'), async (req, res) => {
    try {
        await Admin.findByIdAndDelete(req.params.id);
        await logOp('delete', 'Admin', `Deleted user: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Role API ---
app.get('/api/roles', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const roles = await Role.find();
        res.json(roles);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const ALLOWED_PERMS = [
    'all',
    'article:list','article:create','article:edit','article:delete',
    'faq:list','faq:create','faq:edit','faq:delete',
    'banner:manage','sidebar:manage',
    'appointment:list', 'appointment:delete', 'appointment:edit' // Added appointment perms
];

app.post('/api/roles', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const { name, code, permissions, description } = req.body;
        
        // Required fields
        if (!name) return res.status(400).json({ error: '角色名称为必填项' });

        // Unique checks
        const existing = await Role.findOne({ name });
        if (existing) return res.status(400).json({ error: '角色名称已存在' });
        
        let roleCode = code;
        if (!roleCode) {
            // Auto-generate code
            roleCode = slugify(name, { separator: '_' });
            // Ensure unique
            let counter = 1;
            let tempCode = roleCode;
            while (await Role.findOne({ code: tempCode })) {
                tempCode = `${roleCode}_${counter}`;
                counter++;
            }
            roleCode = tempCode;
        } else {
             const existingCode = await Role.findOne({ code: roleCode });
             if (existingCode) return res.status(400).json({ error: '角色代码已存在' });
        }

        // Permissions validation
        const perms = Array.isArray(permissions) ? permissions : [];
        const invalid = perms.filter(p => !ALLOWED_PERMS.includes(p));
        if (invalid.length > 0) return res.status(400).json({ error: '无效的权限项: ' + invalid.join(', ') });

        const newRole = new Role({ name, code: roleCode, permissions: perms, description });
        await newRole.save();
        await logOp('create', 'Role', `Created role: ${name}`, req.user.username);
        res.json({ success: true, data: newRole });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/roles/:id', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const { name, code, permissions, description } = req.body;
        if (name) {
             const existing = await Role.findOne({ name, _id: { $ne: req.params.id } });
             if (existing) return res.status(400).json({ error: '角色名称已存在' });
        }
        if (code) {
             const existingCode = await Role.findOne({ code, _id: { $ne: req.params.id } });
             if (existingCode) return res.status(400).json({ error: '角色代码已存在' });
        }
        if (permissions) {
             const perms = Array.isArray(permissions) ? permissions : [];
             const invalid = perms.filter(p => !ALLOWED_PERMS.includes(p));
             if (invalid.length > 0) return res.status(400).json({ error: '无效的权限项: ' + invalid.join(', ') });
        }
        
        const role = await Role.findByIdAndUpdate(req.params.id, { name, code, permissions, description }, { new: true });
        res.json({ success: true, data: role });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/roles/:id', authRequired, requirePerm('all'), async (req, res) => {
    try {
        await Role.findByIdAndDelete(req.params.id);
        await logOp('delete', 'Role', `Deleted role: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Settings/Banner/Sidebar API ---
app.get('/api/banner', async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: 'banner' });
        res.json(setting ? setting.value : {});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/banner', authRequired, requirePerm('banner:manage'), async (req, res) => {
    try {
        await Setting.findOneAndUpdate(
            { key: 'banner' },
            { value: req.body, updatedAt: Date.now() },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/sidebar', async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: 'sidebar' });
        res.json(setting ? setting.value : {});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/sidebar', authRequired, requirePerm('sidebar:manage'), async (req, res) => {
    try {
        await Setting.findOneAndUpdate(
            { key: 'sidebar' },
            { value: req.body, updatedAt: Date.now() },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- Deepseek API ---
// Fix for UNABLE_TO_GET_ISSUER_CERT_LOCALLY in dev environment
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function generateDeepseekSlug(title) {
    const API_KEY = 'sk-ba4fcc924d5d48b5850326e5fe044a4d';
    const API_URL = 'https://api.deepseek.com/chat/completions';
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system', 
                        content: 'You are an SEO expert. Generate a short, English, URL-friendly slug (lowercase, hyphens only, no special chars) for the article title provided. Return ONLY the slug.'
                    },
                    {
                        role: 'user', 
                        content: `Title: ${title}`
                    }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Deepseek API Error: ${response.status} ${errText}`);
        }

        const data = await response.json();
        let slug = data.choices[0].message.content.trim();
        
        // Clean up response if it contains extra text (just in case)
        slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
        return slug;
    } catch (e) {
        console.error('Deepseek API Failed:', e);
        return null; // Fallback to local
    }
}

// --- Tools API ---
app.post('/api/tools/slug', authRequired, async (req, res) => {
    try {
        const { text, forceAi } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });
        
        let finalSlug = '';

        // Try AI first if requested or default
        // The user asked to "Integrate deepseek API... Implement intelligent slug generation based on article title"
        // I'll try AI first, then fallback.
        
        const aiSlug = await generateDeepseekSlug(text);
        
        if (aiSlug) {
            finalSlug = aiSlug;
        } else {
            // Fallback to transliteration
            const stopWords = ['the', 'a', 'an', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or', 'with', 'by'];
            let slug = slugify(text, { 
                lowercase: true, 
                separator: '-'
            });
            slug = slug.split('-').filter(word => !stopWords.includes(word)).join('-');
            finalSlug = slug;
        }
        
        // Ensure max length 60 chars
        if (finalSlug.length > 60) {
             finalSlug = finalSlug.substring(0, 60);
             const lastHyphen = finalSlug.lastIndexOf('-');
             if (lastHyphen > 0) finalSlug = finalSlug.substring(0, lastHyphen);
        }
        
        // Remove trailing hyphens
        finalSlug = finalSlug.replace(/-+$/, '');

        // Uniqueness Check (Loop until unique)
        let uniqueSlug = finalSlug;
        let counter = 1;
        while (await Article.findOne({ slug: uniqueSlug })) {
            uniqueSlug = `${finalSlug}-${counter}`;
            counter++;
        }
        
        await logOp('tool', 'Slug', `Generated slug: ${uniqueSlug} (AI: ${!!aiSlug})`);
        
        res.json({ slug: uniqueSlug });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Upload API ---
// Update storage to handle author paths if needed, or just use a smart filename
// For simplicity and robustness, we'll stick to a flat structure or date-based, 
// but user asked for /uploads/authors/{user_id}/. 
// Let's create a specific upload endpoint for authors.

const authorStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const fs = require('fs');
        const userId = req.params.userId || 'default';
        const dir = path.join(__dirname, `public/uploads/authors/${userId}`);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const uploadAuthor = multer({ 
    storage: authorStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, WebP allowed.'));
        }
    }
});

app.post('/api/upload/author/:userId', authRequired, uploadAuthor.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    // Return relative path
    const userId = req.params.userId || 'default';
    const filePath = `/uploads/authors/${userId}/${req.file.filename}`;
    
    await logOp('upload', 'AuthorAvatar', `Uploaded avatar for user: ${userId}`);
    
    res.json({ 
        success: true, 
        url: filePath 
    });
});

app.post('/api/upload', authRequired, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return relative path
    res.json({ 
        success: true, 
        url: '/uploads/' + req.file.filename 
    });
});

// --- SMS Verification Code API ---
// 生成6位随机验证码
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送短信验证码
app.post('/api/send-verification-code', async (req, res) => {
    try {
        const { phone } = req.body;
        
        // 验证手机号格式
        if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
            return res.status(400).json({ error: '请输入有效的11位手机号码' });
        }
        
        // 检查是否在3分钟内已发送过验证码
        const existingCode = await VerificationCode.findOne({
            phone: phone,
            createdAt: { $gt: new Date(Date.now() - 3 * 60 * 1000) }
        });
        
        if (existingCode) {
            const remainingTime = Math.ceil((existingCode.createdAt.getTime() + 3 * 60 * 1000 - Date.now()) / 1000);
            return res.status(429).json({ 
                error: '验证码发送过于频繁，请稍后再试',
                remainingTime: remainingTime
            });
        }
        
        // 生成验证码
        const code = generateVerificationCode();
        
        // 准备短信内容
        const smsContent = `【瑞华智策】验证码为：${code} 你正在预约组织人效体检，需要进行验证码校验（3分钟内有效），请勿向任何人提供此验证码。`;
        
        // 发送短信
        try {
            const smsResponse = await axios.post(process.env.SMS_API_URL, {
                loginname: process.env.SMS_USERNAME,
                password: process.env.SMS_PASSWORD,
                phone: phone,
                content: smsContent
            }, {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                timeout: 10000
            });
            
            console.log('SMS API Response:', smsResponse.data);
            
            if (smsResponse.data.retcode !== '0') {
                console.error('SMS send failed:', smsResponse.data);
                return res.status(500).json({ error: '短信发送失败：' + (smsResponse.data.pno || '未知错误') });
            }
            
            // 保存验证码到数据库
            const verificationCode = new VerificationCode({
                phone: phone,
                code: code
            });
            
            await verificationCode.save();
            
            res.json({ 
                success: true, 
                message: '验证码已发送',
                expiresIn: 180 // 3分钟
            });
            
        } catch (smsError) {
            console.error('SMS API Error:', smsError.message);
            if (smsError.response) {
                console.error('SMS API Response:', smsError.response.data);
            }
            return res.status(500).json({ error: '短信发送失败，请稍后重试' });
        }
        
    } catch (error) {
        console.error('Send verification code error:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 验证验证码
async function verifyCode(phone, code) {
    try {
        const verificationCode = await VerificationCode.findOne({
            phone: phone,
            code: code,
            used: false,
            createdAt: { $gt: new Date(Date.now() - 3 * 60 * 1000) }
        });
        
        if (!verificationCode) {
            return { valid: false, message: '验证码无效或已过期' };
        }
        
        // 标记验证码为已使用
        verificationCode.used = true;
        await verificationCode.save();
        
        return { valid: true };
    } catch (error) {
        console.error('Verify code error:', error);
        return { valid: false, message: '验证失败' };
    }
}

// 钉钉通知函数
async function sendDingTalkNotification(appointment) {
    try {
        const webhookUrl = process.env.DINGTALK_WEBHOOK_URL;
        const secret = process.env.DINGTALK_SECRET;
        
        if (!webhookUrl) {
            console.log('DingTalk webhook URL not configured');
            return;
        }
        
        // 生成签名（如果有密钥）
        let finalUrl = webhookUrl;
        if (secret) {
            const timestamp = Date.now();
            const stringToSign = `${timestamp}\n${secret}`;
            const sign = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
            finalUrl = `${webhookUrl}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
        }
        
        // 构建消息内容
        const message = {
            msgtype: 'markdown',
            markdown: {
                title: '新预约提醒',
                text: `## 🎯 新预约提醒\n\n` +
                      `**姓名：** ${appointment.name}\n\n` +
                      `**手机：** ${appointment.phone}\n\n` +
                      `**公司：** ${appointment.company || '未填写'}\n\n` +
                      `**职位：** ${appointment.title || '未填写'}\n\n` +
                      `**问题描述：** ${appointment.problem || '无'}\n\n` +
                      `**来源：** ${appointment.source || '未知'}\n\n` +
                      `**提交时间：** ${new Date(appointment.createdAt).toLocaleString('zh-CN')}\n\n` +
                      `> 请及时跟进处理！`
            }
        };
        
        // 发送钉钉消息
        const response = await axios.post(finalUrl, message, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        if (response.data.errcode === 0) {
            console.log('DingTalk notification sent successfully');
        } else {
            console.error('DingTalk notification failed:', response.data);
        }
        
    } catch (error) {
        console.error('DingTalk notification error:', error.message);
        throw error;
    }
}

// --- Appointments API ---
// Test DingTalk notification (temporary)
app.post('/api/test-dingtalk', async (req, res) => {
    try {
        const testAppointment = {
            name: '测试用户',
            phone: '13800138000',
            company: '测试公司',
            title: 'CEO',
            problem: '测试钉钉通知功能',
            source: 'test',
            createdAt: new Date()
        };
        
        await sendDingTalkNotification(testAppointment);
        res.json({ success: true, message: '钉钉通知测试成功' });
    } catch (error) {
        console.error('Test DingTalk error:', error);
        res.status(500).json({ error: '钉钉通知测试失败' });
    }
});

// Public submission (no auth)
app.post('/api/appointments', async (req, res) => {
    try {
        let { name, phone, company, title, problem, source, verificationCode, ...utmParams } = req.body;
        
        // Channel Tracking: Read from cookies if not provided in body
        if (req.cookies) {
             if (!utmParams.utm_source && req.cookies.utm_source) utmParams.utm_source = req.cookies.utm_source;
             if (!utmParams.utm_medium && req.cookies.utm_medium) utmParams.utm_medium = req.cookies.utm_medium;
             if (!utmParams.utm_campaign && req.cookies.utm_campaign) utmParams.utm_campaign = req.cookies.utm_campaign;
             if (!utmParams.utm_term && req.cookies.utm_term) utmParams.utm_term = req.cookies.utm_term;
             if (!utmParams.utm_content && req.cookies.utm_content) utmParams.utm_content = req.cookies.utm_content;
        }

        // Basic validation
        if (!name || !phone) {
            return res.status(400).json({ error: '姓名和电话为必填项' });
        }

        // Phone validation
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            return res.status(400).json({ error: '请输入有效的11位手机号码' });
        }
        
        // 验证码验证
        if (!verificationCode) {
            return res.status(400).json({ error: '请输入验证码' });
        }
        
        const codeVerification = await verifyCode(phone, verificationCode);
        if (!codeVerification.valid) {
            return res.status(400).json({ error: codeVerification.message });
        }

        const newAppt = new Appointment({
            name,
            phone,
            company,
            title,
            problem,
            source,
            ...utmParams, // Store UTM params
            status: 'new',
            createdAt: new Date()
        });

        await newAppt.save();
        
        // 发送钉钉通知
        try {
            await sendDingTalkNotification(newAppt);
        } catch (dingTalkError) {
            console.error('DingTalk notification failed:', dingTalkError);
            // 钉钉通知失败不影响预约提交成功
        }
        
        // Log it (system)
        // await logOp('create', 'Appointment', `New appointment from ${name}`);
        
        res.json({ success: true, message: '提交成功' });
    } catch (e) {
        console.error('Appointment Error:', e);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

app.get('/api/appointments', authRequired, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const query = {};
        
        const skip = (page - 1) * limit;
        const total = await Appointment.countDocuments(query);
        const appointments = await Appointment.find(query)
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));
            
        res.json({
            data: appointments,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/appointments/:id', authRequired, async (req, res) => {
    try {
        const { status, remarks } = req.body;
        const appt = await Appointment.findByIdAndUpdate(
            req.params.id, 
            { status, remarks }, // Assuming we might want remarks later, or just status
            { new: true }
        );
        await logOp('update', 'Appointment', `Updated status to ${status} for: ${appt.name}`, req.user.username);
        res.json({ success: true, data: appt });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/appointments/:id', authRequired, async (req, res) => {
    try {
        await Appointment.findByIdAndDelete(req.params.id);
        await logOp('delete', 'Appointment', `Deleted appointment: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Export appointments (CSV)
app.get('/api/appointments/export', authRequired, async (req, res) => {
    try {
        const query = {};
        
        const appointments = await Appointment.find(query).sort({ createdAt: -1 });
        
        // Convert to CSV
        const fields = ['name', 'phone', 'company', 'title', 'problem', 'source', 'createdAt'];
        const header = ['姓名', '电话', '公司', '职位', '问题', '来源', '提交时间', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Term', 'UTM Content'];
        
        let csv = header.join(',') + '\n';
        appointments.forEach(appt => {
            const row = [
                `"${appt.name || ''}"`,
                `"${appt.phone || ''}"`,
                `"${appt.company || ''}"`,
                `"${appt.title || ''}"`,
                `"${appt.problem || ''}"`,
                `"${appt.source || ''}"`,
                `"${appt.createdAt ? new Date(appt.createdAt).toLocaleString() : ''}"`,
                `"${appt.utm_source || ''}"`,
                `"${appt.utm_medium || ''}"`,
                `"${appt.utm_campaign || ''}"`,
                `"${appt.utm_term || ''}"`,
                `"${appt.utm_content || ''}"`
            ];
            csv += row.join(',') + '\n';
        });
        
        // Add BOM for Excel Chinese support and send
        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment('appointments.csv');
        const bom = Buffer.from('\xEF\xBB\xBF', 'binary');
        res.send(Buffer.concat([bom, Buffer.from(csv, 'utf-8')]));
        
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// --- Maturity Diagnostic API ---
app.post('/api/maturity/submit', async (req, res) => {
    try {
        const { userInfo, quizResult, userSelections } = req.body;
        
        if (!userInfo || !userInfo.name || !userInfo.phone) {
            return res.status(400).json({ error: 'Missing user info' });
        }

        const submission = new MaturitySubmission({
            name: userInfo.name,
            phone: userInfo.phone,
            company: userInfo.company,
            score: quizResult.score,
            level: quizResult.level,
            answers: userSelections,
            resultDetail: {
                summary: quizResult.summary,
                insight: quizResult.insight,
                currentStatus: quizResult.currentStatus,
                potential: quizResult.potential,
                action: quizResult.action
            }
        });

        await submission.save();
        await logOp('create', 'Maturity', `New submission from ${userInfo.name}`);
        res.json({ success: true });
    } catch (e) {
        console.error('Maturity Submit Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/maturity/list', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        const total = await MaturitySubmission.countDocuments();
        const list = await MaturitySubmission.find()
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));
            
        res.json({
            data: list,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Quiz Config
app.get('/api/config/quiz', (req, res) => {
    res.json(quizData);
});

// Export Maturity Data
app.get('/api/maturity/export', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const { format = 'xlsx' } = req.query; // 'xlsx' or 'csv'
        
        // Fetch latest 1000 records
        const submissions = await MaturitySubmission.find()
            .sort({ createdAt: -1 })
            .limit(1000);

        // Prepare data for export
        const exportData = submissions.map(sub => {
            const row = {
                '提交时间': new Date(sub.createdAt).toLocaleString('zh-CN'),
                '姓名': sub.name,
                '手机': sub.phone,
                '公司': sub.company,
                '得分': sub.score,
                '等级': sub.level
            };

            // Add formatted answers
            Object.keys(quizData).forEach(qKey => {
                const q = quizData[qKey];
                const ansKeys = sub.answers[qKey] || [];
                const ansText = Array.isArray(ansKeys) 
                    ? ansKeys.map(k => `${k}. ${q.options[k] || ''}`).join('; ')
                    : `${ansKeys}. ${q.options[ansKeys] || ''}`; // Handle legacy single value if any (though schema is array mostly, wait, schema is Object, frontend sends array for q8, others?)
                    // Frontend sends array for all? Let's check frontend.
                    // diagnostic.html: userSelections[q] = [optKey] (single) or array (multi). Always array.
                
                // Format: "Q1. Question Text" -> "Answer"
                // But keys in Excel usually are just "Q1", "Q2" or full question. 
                // Full question is better for readability but might be long.
                // Let's use "Q{n}: {Title}" as header.
                const header = `${qKey.toUpperCase().replace('Q', 'Q')}. ${q.text}`;
                row[header] = ansText;
            });

            return row;
        });

        // Create Workbook
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "成熟度诊断数据");

        // Generate Buffer
        const type = format === 'csv' ? 'csv' : 'xlsx';
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: type });

        // Set Headers
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = encodeURIComponent(`成熟度诊断报告_批量_${dateStr}.${type}`);
        
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`);
        res.setHeader('Content-Type', type === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        res.send(buffer);

    } catch (e) {
        console.error('Export Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/maturity/:id', authRequired, requirePerm('appointment:delete'), async (req, res) => {
    try {
        await MaturitySubmission.findByIdAndDelete(req.params.id);
        await logOp('delete', 'Maturity', `Deleted submission: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Whitepaper Submission API ---
app.post('/api/whitepaper/submit', async (req, res) => {
    try {
        const { name, phone, company, position, email, whitepaperName, source, ...utmParams } = req.body;

        if (!name || !phone || !company || !email || !whitepaperName) {
            return res.status(400).json({ error: '请填写所有必填项' });
        }

        // Validations
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            return res.status(400).json({ error: '请输入有效的11位手机号码' });
        }
        if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
            return res.status(400).json({ error: '请输入有效的邮箱地址' });
        }

        // Check for duplicate submission (same phone & whitepaper within 24h)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existing = await WhitepaperSubmission.findOne({
            phone,
            whitepaperName,
            submittedAt: { $gte: yesterday }
        });

        if (existing) {
            return res.status(400).json({ error: '您已提交过申请，请勿重复提交' });
        }

        // Process UTM from cookies if not in body
        if (req.cookies) {
             if (!utmParams.utm_source && req.cookies.utm_source) utmParams.utm_source = req.cookies.utm_source;
             if (!utmParams.utm_medium && req.cookies.utm_medium) utmParams.utm_medium = req.cookies.utm_medium;
             if (!utmParams.utm_campaign && req.cookies.utm_campaign) utmParams.utm_campaign = req.cookies.utm_campaign;
             if (!utmParams.utm_term && req.cookies.utm_term) utmParams.utm_term = req.cookies.utm_term;
             if (!utmParams.utm_content && req.cookies.utm_content) utmParams.utm_content = req.cookies.utm_content;
        }

        const newSubmission = new WhitepaperSubmission({
            name, phone, company, position, email, whitepaperName, source,
            ...utmParams
        });

        await newSubmission.save();
        // await logOp('create', 'Whitepaper', `New download request: ${whitepaperName} by ${name}`);

        res.json({ success: true });
    } catch (e) {
        console.error('Whitepaper Submit Error:', e);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

app.get('/api/whitepaper/list', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const { page = 1, limit = 20, name, phone, whitepaperName, utm_source } = req.query;
        let query = {};

        if (name) query.name = new RegExp(name, 'i');
        if (phone) query.phone = new RegExp(phone, 'i');
        if (whitepaperName) query.whitepaperName = new RegExp(whitepaperName, 'i');
        if (utm_source) query.utm_source = new RegExp(utm_source, 'i');

        const skip = (page - 1) * limit;
        const total = await WhitepaperSubmission.countDocuments(query);
        const list = await WhitepaperSubmission.find(query)
            .sort({ submittedAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));

        res.json({
            data: list,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/whitepaper/export', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const { name, phone, whitepaperName, utm_source } = req.query;
        let query = {};

        if (name) query.name = new RegExp(name, 'i');
        if (phone) query.phone = new RegExp(phone, 'i');
        if (whitepaperName) query.whitepaperName = new RegExp(whitepaperName, 'i');
        if (utm_source) query.utm_source = new RegExp(utm_source, 'i');

        const submissions = await WhitepaperSubmission.find(query).sort({ submittedAt: -1 });
        
        // Convert to CSV
        const header = ['姓名', '电话', '公司', '职位', '邮箱', '白皮书名称', '来源', '提交时间', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Term', 'UTM Content'];
        
        let csv = header.join(',') + '\n';
        submissions.forEach(sub => {
            const row = [
                `"${sub.name || ''}"`,
                `"${sub.phone || ''}"`,
                `"${sub.company || ''}"`,
                `"${sub.position || ''}"`,
                `"${sub.email || ''}"`,
                `"${sub.whitepaperName || ''}"`,
                `"${sub.source || ''}"`,
                `"${sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : ''}"`,
                `"${sub.utm_source || ''}"`,
                `"${sub.utm_medium || ''}"`,
                `"${sub.utm_campaign || ''}"`,
                `"${sub.utm_term || ''}"`,
                `"${sub.utm_content || ''}"`
            ];
            csv += row.join(',') + '\n';
        });
        
        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment('whitepaper_downloads.csv');
        const bom = Buffer.from('\xEF\xBB\xBF', 'binary');
        res.send(Buffer.concat([bom, Buffer.from(csv, 'utf-8')]));
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// --- Subscription API ---
app.post('/api/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: '邮箱地址不能为空' });
        
        // Basic email validation
        const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
        if (!emailRegex.test(email)) {
             return res.status(400).json({ error: '请输入有效的邮箱地址' });
        }

        // Check existing
        const existing = await Subscription.findOne({ email });
        if (existing) {
            if (existing.status === 'unsubscribed') {
                existing.status = 'active';
                await existing.save();
                return res.json({ success: true, message: '重新订阅成功' });
            }
            return res.status(400).json({ error: '该邮箱已订阅' });
        }

        const newSub = new Subscription({ email });
        await newSub.save();
        
        await logOp('create', 'Subscription', `New subscription: ${email}`);
        
        res.json({ success: true, message: '订阅成功' });
    } catch (e) {
        console.error('Subscription Error:', e);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
