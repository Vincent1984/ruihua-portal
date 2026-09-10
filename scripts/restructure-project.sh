#!/bin/bash

# 项目结构重构脚本
# 作用：将混乱的项目结构重构为清晰、标准化的结构

set -e  # 遇到错误立即退出

echo "================================================"
echo "🚀 开始项目结构重构"
echo "================================================"
echo ""

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录执行此脚本"
    exit 1
fi

echo "✓ 已确认在项目根目录"
echo ""

# 第1步：创建备份
echo "📦 第1步：创建备份..."
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "   备份目录: $BACKUP_DIR"
echo ""

# 第2步：创建新目录结构
echo "📁 第2步：创建新目录结构..."
mkdir -p src/{config,routes,models,middleware,utils,services}
mkdir -p public/pages
mkdir -p admin/pages
mkdir -p docker
mkdir -p backup
echo "   ✓ 目录创建完成"
echo ""

# 第3步：移动后端代码到 src/
echo "🔧 第3步：移动后端代码..."
if [ -f "server.js" ]; then
    mv server.js src/
    echo "   ✓ server.js → src/"
fi

if [ -d "config" ] && [ ! -L "config" ]; then
    rsync -a config/ src/config/
    rm -rf config
    echo "   ✓ config/ → src/config/"
fi

if [ -d "routes" ] && [ ! -L "routes" ]; then
    rsync -a routes/ src/routes/
    rm -rf routes
    echo "   ✓ routes/ → src/routes/"
fi

if [ -d "models" ] && [ ! -L "models" ]; then
    rsync -a models/ src/models/
    rm -rf models
    echo "   ✓ models/ → src/models/"
fi

if [ -d "middleware" ] && [ ! -L "middleware" ]; then
    rsync -a middleware/ src/middleware/
    rm -rf middleware
    echo "   ✓ middleware/ → src/middleware/"
fi

if [ -d "utils" ] && [ ! -L "utils" ]; then
    rsync -a utils/ src/utils/
    rm -rf utils
    echo "   ✓ utils/ → src/utils/"
fi

if [ -d "services" ] && [ ! -L "services" ]; then
    rsync -a services/ src/services/
    rm -rf services
    echo "   ✓ services/ → src/services/"
fi
echo ""

# 第4步：移动前端页面到 public/pages/
echo "🌐 第4步：移动前端HTML页面..."
HTML_FILES=(
    "index.html"
    "about.html"
    "solutions.html"
    "diagnostic.html"
    "diagnostic-result.html"
    "efficiency-diagnostic.html"
    "event-registration.html"
    "privacy.html"
    "productivity.html"
    "resources.html"
    "survey.html"
    "training.html"
    "video-detail.html"
    "videos.html"
    "article.html"
    "404.html"
)

for file in "${HTML_FILES[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" public/pages/
        echo "   ✓ $file → public/pages/"
    fi
done
echo ""

# 第5步：移动备份文件
echo "🗄️  第5步：移动备份文件..."
mv server.js.bak* backup/ 2>/dev/null || true
mv server.js.before-refactor backup/ 2>/dev/null || true
mv server.js.with-duplicates backup/ 2>/dev/null || true
echo "   ✓ 备份文件已移动到 backup/"
echo ""

# 第6步：移动Docker配置
echo "🐳 第6步：移动Docker配置..."
if [ -f "Dockerfile" ]; then
    mv Dockerfile docker/
    echo "   ✓ Dockerfile → docker/"
fi
if [ -f "Dockerfile.multi-stage" ]; then
    mv Dockerfile.multi-stage docker/
    echo "   ✓ Dockerfile.multi-stage → docker/"
fi
if [ -f "docker-compose.yml" ]; then
    mv docker-compose.yml docker/
    echo "   ✓ docker-compose.yml → docker/"
fi
if [ -d "k8s" ]; then
    mv k8s docker/
    echo "   ✓ k8s/ → docker/k8s/"
fi
if [ -f "docker-build.sh" ]; then
    mv docker-build.sh scripts/
    echo "   ✓ docker-build.sh → scripts/"
fi
if [ -f "docker-build.bat" ]; then
    mv docker-build.bat scripts/
    echo "   ✓ docker-build.bat → scripts/"
fi
echo ""

# 第7步：删除冗余文件
echo "🗑️  第7步：清理冗余文件..."
if [ -f "views/2026/page-blocks/404.html" ]; then
    rm views/2026/page-blocks/404.html
    echo "   ✓ 删除冗余的 views/2026/page-blocks/404.html"
fi
echo ""

# 第8步：更新 package.json 启动脚本
echo "⚙️  第8步：更新 package.json..."
if command -v node &> /dev/null; then
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.start = 'node src/server.js';
    pkg.scripts.dev = pkg.scripts.dev || 'nodemon src/server.js';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    "
    echo "   ✓ package.json 启动脚本已更新"
fi
echo ""

# 第9步：创建路径映射文件（供后续更新路径使用）
echo "📝 第9步：创建路径映射记录..."
cat > RESTRUCTURE-PATHS.txt << 'EOF'
# 重构后的路径映射

## 后端代码
server.js → src/server.js
config/ → src/config/
routes/ → src/routes/
models/ → src/models/
middleware/ → src/middleware/
utils/ → src/utils/
services/ → src/services/

## 前端页面
*.html (根目录) → public/pages/*.html
404.html → public/pages/404.html

## Docker配置
Dockerfile → docker/Dockerfile
docker-compose.yml → docker/docker-compose.yml
k8s/ → docker/k8s/

## 备份文件
server.js.bak* → backup/

## 需要更新的路径引用
1. src/server.js 中的静态文件路径
2. package.json 中的启动脚本
3. Docker 配置中的路径
4. README.md 中的文档路径
EOF
echo "   ✓ 路径映射记录已创建: RESTRUCTURE-PATHS.txt"
echo ""

echo "================================================"
echo "✅ 项目结构重构完成！"
echo "================================================"
echo ""
echo "📋 后续步骤："
echo "   1. 更新 src/server.js 中的静态文件路径"
echo "   2. 测试所有功能是否正常"
echo "   3. 更新 README.md 文档"
echo "   4. 提交代码到 Git"
echo ""
echo "📂 新的项目结构："
echo "   src/          - 后端源代码"
echo "   public/pages/ - 前端HTML页面"
echo "   admin/        - 后台管理系统"
echo "   docker/       - Docker配置"
echo "   backup/       - 备份文件"
echo ""
