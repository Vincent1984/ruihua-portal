#!/bin/bash
# 完整 SEO 和性能测试脚本

echo "🚀 完整 SEO & 性能测试"
echo "======================================"
echo ""

BASE_URL="http://localhost:3000"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数
TOTAL=0
PASSED=0
FAILED=0

# 测试函数
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

echo "📋 1. SEO Meta 标签测试"
echo "--------------------------------------"

# 测试首页 Title
TITLE=$(curl -s $BASE_URL/ | grep -o '<title>[^<]*</title>' | head -1)
if [[ $TITLE == *"瑞华智策"* ]]; then
    test_check 0 "首页 Title 存在"
else
    test_check 1 "首页 Title 缺失"
fi

# 测试 Meta Description
DESC=$(curl -s $BASE_URL/ | grep 'name="description"' | head -1)
if [[ -n $DESC ]]; then
    test_check 0 "Meta Description 存在"
else
    test_check 1 "Meta Description 缺失"
fi

# 测试 Canonical URL
CANONICAL=$(curl -s $BASE_URL/ | grep 'rel="canonical"' | head -1)
if [[ -n $CANONICAL ]]; then
    test_check 0 "Canonical URL 存在"
else
    test_check 1 "Canonical URL 缺失"
fi

echo ""
echo "🌍 2. Open Graph 测试"
echo "--------------------------------------"

# 测试 OG 标签数量
OG_COUNT=$(curl -s $BASE_URL/ | grep -c 'property="og:')
if [ $OG_COUNT -ge 5 ]; then
    test_check 0 "Open Graph 标签充足 ($OG_COUNT 个)"
else
    test_check 1 "Open Graph 标签不足 ($OG_COUNT 个)"
fi

echo ""
echo "📊 3. 结构化数据测试"
echo "--------------------------------------"

# 测试 Schema.org
SCHEMA=$(curl -s $BASE_URL/ | grep 'application/ld+json')
if [[ -n $SCHEMA ]]; then
    test_check 0 "结构化数据存在"
else
    test_check 1 "结构化数据缺失"
fi

# 测试 Organization Schema
ORG_SCHEMA=$(curl -s $BASE_URL/ | grep '"@type":"Organization"')
if [[ -n $ORG_SCHEMA ]]; then
    test_check 0 "Organization Schema 存在"
else
    test_check 1 "Organization Schema 缺失"
fi

echo ""
echo "🖼️ 4. 图片优化测试"
echo "--------------------------------------"

# 测试懒加载
LAZY_COUNT=$(curl -s $BASE_URL/ | grep -c 'loading="lazy"')
echo "   懒加载图片数量: $LAZY_COUNT"
if [ $LAZY_COUNT -gt 0 ]; then
    test_check 0 "图片懒加载已启用"
else
    test_check 1 "图片懒加载未启用"
fi

echo ""
echo "🗺️ 5. Sitemap 测试"
echo "--------------------------------------"

# 测试 Sitemap 可访问性
SITEMAP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/sitemap.xml)
if [ $SITEMAP_STATUS -eq 200 ]; then
    test_check 0 "Sitemap 可访问 (HTTP $SITEMAP_STATUS)"
else
    test_check 1 "Sitemap 不可访问 (HTTP $SITEMAP_STATUS)"
fi

# 测试 Sitemap URL 数量
URL_COUNT=$(curl -s $BASE_URL/sitemap.xml | grep -c '<loc>')
echo "   Sitemap URL 数量: $URL_COUNT"
if [ $URL_COUNT -ge 5 ]; then
    test_check 0 "Sitemap URL 充足"
else
    test_check 1 "Sitemap URL 不足"
fi

echo ""
echo "🔗 6. 外部链接测试"
echo "--------------------------------------"

# 测试外部链接 rel 属性
EXTERNAL_LINKS=$(curl -s $BASE_URL/ | grep -c 'rel="noopener')
if [ $EXTERNAL_LINKS -gt 0 ]; then
    test_check 0 "外部链接安全属性已设置"
else
    echo -e "${YELLOW}!${NC} 未检测到外部链接（或已正确处理）"
fi

echo ""
echo "⚡ 7. 性能优化测试"
echo "--------------------------------------"

# 测试资源预加载
PRELOAD=$(curl -s $BASE_URL/ | grep -c 'rel="preload"')
if [ $PRELOAD -gt 0 ]; then
    test_check 0 "资源预加载已启用 ($PRELOAD 个)"
else
    test_check 1 "资源预加载未启用"
fi

# 测试 DNS 预解析
DNS_PREFETCH=$(curl -s $BASE_URL/ | grep -c 'rel="dns-prefetch"')
if [ $DNS_PREFETCH -gt 0 ]; then
    test_check 0 "DNS 预解析已启用 ($DNS_PREFETCH 个)"
else
    test_check 1 "DNS 预解析未启用"
fi

# 测试预连接
PRECONNECT=$(curl -s $BASE_URL/ | grep -c 'rel="preconnect"')
if [ $PRECONNECT -gt 0 ]; then
    test_check 0 "预连接已启用 ($PRECONNECT 个)"
else
    test_check 1 "预连接未启用"
fi

echo ""
echo "📄 8. 关键页面响应测试"
echo "--------------------------------------"

for path in "/" "/about" "/training" "/solutions"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL$path)
    if [ $STATUS -eq 200 ]; then
        test_check 0 "$path (HTTP $STATUS)"
    else
        test_check 1 "$path (HTTP $STATUS)"
    fi
done

echo ""
echo "🎯 9. 缓存头部测试"
echo "--------------------------------------"

# 测试静态资源缓存
CSS_CACHE=$(curl -s -I $BASE_URL/css/main.css 2>/dev/null | grep -i 'cache-control')
if [[ $CSS_CACHE == *"max-age"* ]]; then
    test_check 0 "CSS 缓存头部已设置"
else
    test_check 1 "CSS 缓存头部未设置"
fi

echo ""
echo "======================================"
echo "📊 测试结果汇总"
echo "======================================"
echo -e "总计: $TOTAL"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"

PASS_RATE=$((PASSED * 100 / TOTAL))
echo "通过率: $PASS_RATE%"
echo ""

if [ $PASS_RATE -ge 90 ]; then
    echo -e "${GREEN}🎉 优秀！SEO 优化已达标${NC}"
elif [ $PASS_RATE -ge 70 ]; then
    echo -e "${YELLOW}👍 良好，还有提升空间${NC}"
else
    echo -e "${RED}⚠️ 需要优化${NC}"
fi

echo ""
echo "📋 后续建议："
echo ""
echo "1. 在线测试工具："
echo "   - Google Rich Results: https://search.google.com/test/rich-results"
echo "   - PageSpeed Insights: https://pagespeed.web.dev/"
echo "   - 百度抓取诊断: https://ziyuan.baidu.com/"
echo ""
echo "2. 提交 Sitemap："
echo "   - Google Search Console"
echo "   - 百度站长平台"
echo ""
echo "3. 性能监控："
echo "   - 设置 Google Analytics"
echo "   - 监控 Core Web Vitals"
echo ""
