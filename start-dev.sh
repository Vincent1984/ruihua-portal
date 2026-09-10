#!/bin/bash
# 瑞华智策开发环境启动脚本

set -e

echo "=========================================="
echo "🚀 瑞华智策开发环境启动"
echo "=========================================="
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 MongoDB 是否已经在运行
echo "1️⃣  检查 MongoDB 状态..."
if pgrep -x "mongod" > /dev/null; then
    echo -e "${GREEN}✅ MongoDB 已在运行${NC}"
else
    echo -e "${YELLOW}⚠️  MongoDB 未运行，正在启动...${NC}"

    # 启动本地 MongoDB
    ./.mongodb/mongodb-macos-aarch64-7.0.14/bin/mongod \
        --dbpath ./.mongodb/data \
        --logpath ./.mongodb/log/mongod.log \
        --fork \
        --bind_ip 127.0.0.1 \
        --port 27017

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ MongoDB 启动成功${NC}"
        # 等待 MongoDB 完全启动
        sleep 2
    else
        echo -e "${RED}❌ MongoDB 启动失败${NC}"
        exit 1
    fi
fi
echo ""

# 运行登录诊断
echo "2️⃣  运行登录诊断..."
node scripts/diagnose-login.js
echo ""

# 询问是否重置管理员密码
read -p "是否需要重置管理员密码？(y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "请输入用户名 (默认: ruihua): " username
    username=${username:-ruihua}

    read -sp "请输入新密码 (默认: Ruihua@2026): " password
    echo ""
    password=${password:-Ruihua@2026}

    echo "正在重置密码..."
    node scripts/reset-admin.js "$username" "$password"
    echo ""
fi

# 启动服务器
echo "3️⃣  启动 Node.js 服务器..."
echo -e "${GREEN}服务地址: http://localhost:3000${NC}"
echo -e "${GREEN}后台登录: http://localhost:3000/admin/index.html${NC}"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

npm start
