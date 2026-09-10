# 📚 讲师/专家团队管理使用指南

**功能说明**: 后台管理系统已经完整实现了讲师/专家团队的数据管理功能  
**位置**: 后台管理 → 内容配置 → 讲师/专家团队

---

## ✅ 已实现的功能

### 1. **专家列表管理** 📋

**访问路径**:
- 登录后台: `https://www.ruihuaconsulting.com/admin/`
- 点击侧边栏: "内容配置" → "讲师 / 专家团队"

**功能特点**:
- ✅ 卡片式展示，包含头像、姓名、简介
- ✅ 显示专家总数和缺照片数量
- ✅ 支持拖拽排序（拖动左侧手柄图标）
- ✅ 状态开关（显示/隐藏）
- ✅ 编辑和删除按钮

**界面预览**:
```
┌─────────────────────────────────────────────┐
│ 讲师 / 专家团队          共 3 位 · 1 位缺照片 │
│                    [＋ 新增专家]              │
├─────────────────────────────────────────────┤
│ ≡  [头像]  杨星宇                [●]  编辑  删除│
│            TOGAF 认证企业架构师...            │
├─────────────────────────────────────────────┤
│ ≡  [头像]  李明华                [○]  编辑  删除│
│            资深人力资源专家...               │
└─────────────────────────────────────────────┘
```

---

### 2. **新增专家** ➕

**操作步骤**:
1. 点击右上角 "＋ 新增专家" 按钮
2. 填写专家信息：
   - **姓名** (必填)
   - **头像URL** (可选，建议使用稳定的URL)
   - **简介** (简短描述，显示在列表)
   - **详细介绍** (完整介绍，可用于详情页)
   - **状态** (显示/隐藏)
3. 点击 "保存" 按钮

**字段说明**:
| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| name | 文本 | 专家姓名 | 杨星宇 |
| avatar | URL | 头像地址 | `/images/experts/yang.jpg` |
| desc | 文本 | 简短介绍 | TOGAF 认证企业架构师 |
| detail | 长文本 | 详细介绍 | 多行详细背景介绍... |
| order | 数字 | 排序序号 | 自动生成 |
| status | 状态 | 显示状态 | visible/hidden |

**头像建议**:
- ✅ 使用站内路径: `/images/experts/name.jpg`
- ✅ 或使用CDN: `https://cdn.example.com/experts/name.jpg`
- ⚠️  避免使用临时链接或第三方图床
- 📐 建议尺寸: 200x200 像素
- 📦 建议格式: JPG/PNG，大小 < 100KB

---

### 3. **编辑专家** ✏️

**操作步骤**:
1. 找到要编辑的专家
2. 点击 "编辑" 按钮
3. 修改专家信息
4. 点击 "保存" 按钮

**可编辑内容**:
- 姓名
- 头像URL
- 简介
- 详细介绍
- 显示状态

---

### 4. **删除专家** 🗑️

**操作步骤**:
1. 找到要删除的专家
2. 点击 "删除" 按钮
3. 确认删除操作

**注意事项**:
- ⚠️  删除后无法恢复
- ⚠️  如果该专家有关联文章，会提示无法删除
- 💡 建议先隐藏而非删除

---

### 5. **调整顺序** 🔄

**操作方式**:
- 拖动专家卡片左侧的 "≡" 手柄图标
- 拖到目标位置后松开
- 顺序会自动保存

**排序规则**:
- 序号从 1 开始
- 序号越小，显示越靠前
- 前端页面按此顺序展示

---

### 6. **状态切换** 🔘

**操作方式**:
- 点击专家卡片右侧的开关按钮
- `●` 表示显示状态（visible）
- `○` 表示隐藏状态（hidden）

**状态说明**:
- **显示状态**: 前端页面可见
- **隐藏状态**: 前端页面不显示，但数据保留

---

## 🔌 API接口说明

### 后端API

#### 1. 获取专家列表（公开）
```http
GET /api/authors
```

**响应示例**:
```json
[
  {
    "_id": "6aa1e232f3c6018dabe4e785",
    "name": "杨星宇",
    "avatar": "/images/experts/yang.jpg",
    "desc": "TOGAF 认证企业架构师",
    "detail": "完整介绍...",
    "order": 1,
    "status": "visible"
  }
]
```

#### 2. 获取专家列表（管理端）
```http
GET /api/admin/authors
Authorization: Required
Permission: expert:list
```

#### 3. 创建专家
```http
POST /api/authors
Content-Type: application/json
Authorization: Required
Permission: expert:create

{
  "name": "李明华",
  "avatar": "/images/experts/li.jpg",
  "desc": "资深人力资源专家",
  "detail": "详细介绍..."
}
```

#### 4. 更新专家
```http
PUT /api/authors/:id
Content-Type: application/json
Authorization: Required
Permission: expert:edit

{
  "name": "李明华",
  "avatar": "/images/experts/li-new.jpg",
  "desc": "更新后的简介"
}
```

#### 5. 删除专家
```http
DELETE /api/authors/:id
Authorization: Required
Permission: expert:delete
```

#### 6. 重新排序
```http
PUT /api/authors/reorder
Content-Type: application/json
Authorization: Required
Permission: expert:edit

{
  "items": [
    { "id": "6aa1e232f3c6018dabe4e785", "order": 1 },
    { "id": "6aa1e232f3c6018dabe4e786", "order": 2 }
  ]
}
```

---

## 📊 数据库结构

### authors 集合

```javascript
{
  _id: ObjectId,           // MongoDB自动生成
  name: String,            // 专家姓名（必填）
  avatar: String,          // 头像URL（可选）
  desc: String,            // 简短介绍（可选）
  detail: String,          // 详细介绍（可选）
  order: Number,           // 排序序号（默认0）
  status: String,          // 状态：visible/hidden（默认visible）
  createdAt: Date,         // 创建时间
  updatedAt: Date,         // 更新时间
  __v: Number             // 版本号
}
```

---

## 🎯 使用场景

### 场景1：添加新讲师

**步骤**:
1. 准备讲师照片，上传到 `/public/images/experts/` 目录
2. 登录后台管理系统
3. 进入 "讲师 / 专家团队"
4. 点击 "＋ 新增专家"
5. 填写信息：
   - 姓名: 张伟
   - 头像: `/images/experts/zhang.jpg`
   - 简介: 知名AI培训讲师，10年经验
   - 详细介绍: 张伟老师拥有...
6. 保存

### 场景2：批量导入专家

**方式1：通过API批量导入**
```bash
curl -X POST http://localhost:3000/api/authors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "李明",
    "avatar": "/images/experts/li.jpg",
    "desc": "资深HR专家"
  }'
```

**方式2：直接操作数据库**
```javascript
// MongoDB Shell
db.authors.insertMany([
  {
    name: "李明",
    avatar: "/images/experts/li.jpg",
    desc: "资深HR专家",
    order: 1,
    status: "visible",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "王芳",
    avatar: "/images/experts/wang.jpg",
    desc: "数字化转型顾问",
    order: 2,
    status: "visible",
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);
```

### 场景3：调整展示顺序

**步骤**:
1. 进入 "讲师 / 专家团队"
2. 找到要移动的专家卡片
3. 按住左侧的 "≡" 图标
4. 拖动到目标位置
5. 松开鼠标，自动保存

---

## 🔐 权限要求

### 角色权限

| 操作 | 需要权限 | 说明 |
|------|---------|------|
| 查看专家列表（前端） | 无 | 公开访问 |
| 查看专家列表（后台） | `expert:list` | 管理员 |
| 新增专家 | `expert:create` | 管理员 |
| 编辑专家 | `expert:edit` | 管理员 |
| 删除专家 | `expert:delete` | 管理员 |
| 调整顺序 | `expert:edit` | 管理员 |

### 如何配置权限

在 `config/permissions.js` 中已经定义了专家管理相关权限：

```javascript
{
  expert: {
    list: '查看专家列表',
    create: '创建专家',
    edit: '编辑专家',
    delete: '删除专家'
  }
}
```

---

## 🐛 常见问题

### Q1: 上传的头像不显示？
**A**: 检查以下几点：
1. 图片路径是否正确
2. 图片文件是否存在于 `public/images/experts/` 目录
3. 图片URL是否可访问
4. 浏览器控制台是否有404错误

### Q2: 无法删除专家？
**A**: 可能的原因：
1. 该专家被文章引用（关联数据）
2. 没有删除权限
3. 建议先隐藏而非删除

### Q3: 排序不生效？
**A**: 
1. 检查 `order` 字段是否正确
2. 刷新页面查看最新顺序
3. 检查浏览器控制台是否有错误

### Q4: 缺少照片如何处理？
**A**: 
1. 系统会显示专家姓名的首字作为占位符
2. 后台会提示缺照片数量
3. 建议尽快上传照片

---

## 📈 最佳实践

### 1. 头像管理
- ✅ 统一尺寸：200x200 像素
- ✅ 统一格式：JPG（压缩后 < 100KB）
- ✅ 统一命名：`姓名拼音.jpg`
- ✅ 统一路径：`/images/experts/`

### 2. 简介撰写
- ✅ 控制在 50-100 字
- ✅ 突出核心资质和经验
- ✅ 使用专业术语
- ✅ 避免过度营销

### 3. 排序规则
- ✅ 核心讲师排在前面
- ✅ 按资历、影响力排序
- ✅ 定期review和调整

### 4. 状态管理
- ✅ 离职讲师设为隐藏
- ✅ 保留数据以便历史查询
- ✅ 定期清理无效数据

---

## 🔄 前后端集成

### 前端页面展示

专家数据可以在以下页面使用：

1. **关于我们页面** (`/about.html`)
   ```javascript
   fetch('/api/authors')
     .then(res => res.json())
     .then(authors => {
       // 渲染专家列表
     });
   ```

2. **培训课程页面** (`/training.html`)
   - 显示讲师团队
   - 关联课程讲师

3. **文章详情页** (`/article.html`)
   - 显示文章作者信息
   - 关联作者的其他文章

---

## 📞 技术支持

如有问题，请联系技术团队或查看：
- API文档: `SEO-AUDIT-REPORT.md`
- 项目结构: `QUICK-RESTRUCTURE.md`
- 代码仓库: GitHub

---

**文档更新时间**: 2026年9月10日  
**功能版本**: v2.0  
**状态**: ✅ 已完整实现
