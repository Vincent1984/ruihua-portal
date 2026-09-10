#!/bin/bash
# SSR 内容测试脚本 - 验证 JS 动态内容是否已静态化

echo "🔍 SSR 内容测试"
echo "======================================"
echo ""

BASE_URL="http://localhost:3000"

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 计数
TOTAL=0
PASSED=0
FAILED=0

test_check() {
    TOTAL=$((TOTAL + 1))
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} $2"
        FAILED=$((FAILED + 1))
    fi
}

echo "1️⃣  测试客户 Logo 区域（#lwHome）"
echo "--------------------------------------"

# 检查容器是否不为空
LOGOS=$(curl -s $BASE_URL/ | grep -A 20 'id="lwHome"' | grep -c '<img')
if [ $LOGOS -gt 0 ]; then
    test_check 0 "客户 Logo 已注入 ($LOGOS 个)"
else
    test_check 1 "客户 Logo 未注入"
fi

# 检查是否包含关键客户名称
HUAWEI=$(curl -s $BASE_URL/ | grep -c '华为')
if [ $HUAWEI -gt 0 ]; then
    test_check 0 "包含客户名称（华为）"
else
    test_check 1 "缺少客户名称"
fi

# 检查 alt 属性（SEO 关键）
ALT_COUNT=$(curl -s $BASE_URL/ | grep 'id="lwHome"' -A 50 | grep -c 'alt="')
if [ $ALT_COUNT -gt 5 ]; then
    test_check 0 "图片 alt 属性完整 ($ALT_COUNT 个)"
else
    test_check 1 "图片 alt 属性不足"
fi

echo ""
echo "2️⃣  测试场景标签（#tlChips）"
echo "--------------------------------------"

# 检查场景标签
CHIPS=$(curl -s $BASE_URL/ | grep -A 20 'id="tlChips"' | grep -c 'class="chip"')
if [ $CHIPS -gt 0 ]; then
    test_check 0 "场景标签已注入 ($CHIPS 个)"
else
    test_check 1 "场景标签未注入"
fi

# 检查关键词
KEYWORDS=$(curl -s $BASE_URL/ | grep -c '客服智能化')
if [ $KEYWORDS -gt 0 ]; then
    test_check 0 "包含场景关键词（客服智能化）"
else
    test_check 1 "缺少场景关键词"
fi

echo ""
echo "3️⃣  测试 AI 对话演示（#dmType）"
echo "--------------------------------------"

# 检查是否有静态文本
DM_TEXT=$(curl -s $BASE_URL/ | grep 'id="dmType"' -A 1 | grep -c 'AI 转型')
if [ $DM_TEXT -gt 0 ]; then
    test_check 0 "AI 演示文本已注入"
else
    test_check 1 "AI 演示文本未注入"
fi

echo ""
echo "4️⃣  测试结构化数据（Schema.org）"
echo "--------------------------------------"

# 检查客户案例 Schema
ITEMLIST=$(curl -s $BASE_URL/ | grep -c '"@type": "ItemList"')
if [ $ITEMLIST -gt 0 ]; then
    test_check 0 "客户案例 Schema 已添加"
else
    test_check 1 "客户案例 Schema 缺失"
fi

# 检查场景服务 Schema
OFFER_CATALOG=$(curl -s $BASE_URL/ | grep -c '"@type": "OfferCatalog"')
if [ $OFFER_CATALOG -gt 0 ]; then
    test_check 0 "场景服务 Schema 已添加"
else
    test_check 1 "场景服务 Schema 缺失"
fi

echo ""
echo "5️⃣  测试 SEO 友好性"
echo "--------------------------------------"

# 检查隐藏的 SEO 文本
SR_ONLY=$(curl -s $BASE_URL/ | grep -c 'class="sr-only"')
if [ $SR_ONLY -gt 0 ]; then
    test_check 0 "SEO 友好文本已添加"
else
    test_check 1 "SEO 友好文本未添加"
fi

# 检查 noscript 后备
NOSCRIPT=$(curl -s $BASE_URL/ | grep -c '<noscript')
if [ $NOSCRIPT -gt 0 ]; then
    test_check 0 "noscript 后备已添加"
else
    test_check 1 "noscript 后备未添加"
fi

echo ""
echo "======================================"
echo "📊 测试结果"
echo "======================================"
echo -e "总计: $TOTAL"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"

PASS_RATE=$((PASSED * 100 / TOTAL))
echo "通过率: $PASS_RATE%"
echo ""

if [ $PASS_RATE -eq 100 ]; then
    echo -e "${GREEN}🎉 完美！所有 SSR 内容已正确注入${NC}"
elif [ $PASS_RATE -ge 80 ]; then
    echo -e "${YELLOW}👍 良好，大部分内容已静态化${NC}"
else
    echo -e "${RED}⚠️  需要检查 SSR 配置${NC}"
fi

echo ""
echo "📋 验证要点："
echo ""
echo "✅ 客户 Logo 对百度可见"
echo "✅ 场景关键词可被收录"
echo "✅ 结构化数据符合 Schema.org 规范"
echo "✅ JS 禁用时仍可访问核心内容"
echo ""
echo "🌐 下一步测试："
echo "  1. 禁用浏览器 JavaScript 查看页面"
echo "  2. 使用 Google Rich Results Test 验证结构化数据"
echo "  3. 检查百度快照是否包含客户名称"
echo ""
