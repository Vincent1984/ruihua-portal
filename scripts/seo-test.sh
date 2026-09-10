#!/bin/bash
# SEO 快速测试脚本

echo "🔍 SEO 测试开始..."
echo ""

BASE_URL="http://localhost:3000"

# 测试首页 SEO
echo "1️⃣  测试首页 SEO 标签"
curl -s $BASE_URL/ | grep -E "<title>|<meta name=\"description\"|<link rel=\"canonical\"" | head -3
echo ""

# 测试 Open Graph
echo "2️⃣  测试 Open Graph 标签"
curl -s $BASE_URL/ | grep "<meta property=\"og:" | head -5
echo ""

# 测试结构化数据
echo "3️⃣  测试结构化数据"
curl -s $BASE_URL/ | grep "application/ld+json" | head -1
echo ""

# 测试 Sitemap
echo "4️⃣  测试 Sitemap"
curl -s $BASE_URL/sitemap.xml | head -10
echo ""

# 测试图片懒加载
echo "5️⃣  测试图片懒加载"
curl -s $BASE_URL/ | grep -o 'loading="lazy"' | wc -l | xargs echo "找到懒加载图片数量:"
echo ""

# 测试关键页面
echo "6️⃣  测试关键页面响应"
for path in "/" "/about" "/training" "/article"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL$path)
    echo "  $path: HTTP $status"
done
echo ""

echo "✅ SEO 测试完成！"
echo ""
echo "📋 下一步："
echo "  1. 访问 Google Rich Results Test: https://search.google.com/test/rich-results"
echo "  2. 测试 URL: $BASE_URL"
echo "  3. 检查性能: Google PageSpeed Insights"
