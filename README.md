# 瑞华智策官网 (V1.2)

本项目是一个基于 Node.js + Express + MongoDB 的企业官网与管理后台系统。

## 目录结构说明

本项目采用模块化目录结构，清晰分离静态资源、后端逻辑与文档。

```
/
├── public/                 # 静态资源目录
│   ├── css/                # 样式表 (styles.css 等)
│   ├── js/                 # 前端脚本 (main.js, script.js 等)
│   ├── images/             # 图片资源
│   └── uploads/            # 用户上传的文件
├── admin/                  # 后台管理系统前端页面
├── config/                 # 配置文件 (如 quizData.js)
├── docs/                   # 项目文档
├── models/                 # MongoDB 数据模型
├── tests/                  # 测试脚本
├── *.html                  # 官网前端页面 (index.html, about.html 等)
├── server.js               # 后端服务入口
├── package.json            # 项目依赖配置
└── robots.txt              # 搜索引擎爬虫协议
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动数据库

确保本地安装并启动了 MongoDB (默认端口 27017)。

### 3. 启动服务

```bash
node server.js
```

服务默认运行在 `http://localhost:3000`。

## 功能模块

- **官网前台**: 展示公司介绍、解决方案、行业洞察等信息。
- **后台管理 (CMS)**: 
  - 访问地址: `/admin/index.html`
  - 功能: 文章管理、预约管理、数据看板、权限管理等。
- **API 服务**: 提供文章增删改查、预约提交、文件上传等接口。

## 开发规范

- **静态资源**: 所有公共静态资源应放置在 `public` 目录下对应的子目录中。
- **页面引用**: 
  - CSS: `<link rel="stylesheet" href="/css/styles.css">`
  - JS: `<script src="/js/main.js"></script>`
  - Images: `<img src="/images/logo.png">`
- **后端路由**: API 路由定义在 `server.js` 中，通常以 `/api` 开头。

## 文档

更多详细逻辑说明请参考 `docs/` 目录下的文档。
