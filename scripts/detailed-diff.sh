#!/bin/bash
# 详细对比首页和 Demo 页面的具体内容差异

echo "📋 详细内容差异分析"
echo "===================================="
echo ""

# 1. 对比标题文本
echo "1️⃣  标题文本对比"
echo "------------------------------------"
echo ""

echo "【Hero 区域标题】"
echo "首页:"
curl -s http://localhost:3000/ | grep -A 5 '<h1' | head -10
echo ""
echo "Demo:"
grep -A 5 '<h1' /Users/nic/Documents/GitHub/ruihua-portal/new/09-09.html | head -10
echo ""

# 2. 对比 FAQ 数量
echo "2️⃣  FAQ 内容对比"
echo "------------------------------------"
FAQ_HOME=$(curl -s http://localhost:3000/ | grep -c 'faq-item')
FAQ_DEMO=$(grep -c 'faq-item' /Users/nic/Documents/GitHub/ruihua-portal/new/09-09.html)
echo "首页 FAQ 数量: $FAQ_HOME"
echo "Demo FAQ 数量: $FAQ_DEMO"
echo ""

# 3. 对比按钮文本
echo "3️⃣  按钮（CTA）对比"
echo "------------------------------------"
echo "首页按钮:"
curl -s http://localhost:3000/ | grep -o 'class="btn[^"]*"[^>]*>[^<]*' | head -10
echo ""
echo "Demo 按钮 (前10个):"
grep -o 'class="btn[^"]*"[^>]*>[^<]*' /Users/nic/Documents/GitHub/ruihua-portal/new/09-09.html | head -10
echo ""

# 4. 对比服务介绍区域
echo "4️⃣  服务介绍区域对比"
echo "------------------------------------"
echo "首页 tl-sec 数量:"
curl -s http://localhost:3000/ | grep -c 'class="tl-sec'
echo ""
echo "Demo tl-sec 数量:"
grep -c 'class="tl-sec' /Users/nic/Documents/GitHub/ruihua-portal/new/09-09.html
echo ""

# 5. 检查是否有 SPA 路由
echo "5️⃣  页面结构差异"
echo "------------------------------------"
echo "Demo 是否包含多个子页面:"
grep -c 'data-page=' /Users/nic/Documents/GitHub/ruihua-portal/new/09-09.html
echo ""
echo "首页是否包含多个子页面:"
curl -s http://localhost:3000/ | grep -c 'data-page='
echo ""

# 6. 对比结构化数据
echo "6️⃣  结构化数据对比"
echo "------------------------------------"
echo "首页 Schema 数量:"
curl -s http://localhost:3000/ | grep -c '@type'
echo ""
echo "Demo Schema 数量:"
grep -c '@type' /Users/nic/Documents/GitHub/ruihua-portal/new/09-09.html
echo ""

echo "✅ 详细对比完成"
