#!/usr/bin/env node
/**
 * 对比首页和 demo 页面（09-09.html）的内容和样式差异
 */

const fs = require('fs');
const cheerio = require('cheerio');
const path = require('path');

// 读取两个页面
const homepagePath = '/tmp/homepage.html';
const demoPath = path.join(__dirname, '../new/09-09.html');

console.log('📊 首页 vs Demo 页面内容对比分析');
console.log('=====================================\n');

// 读取文件
const homepage = fs.readFileSync(homepagePath, 'utf8');
const demo = fs.readFileSync(demoPath, 'utf8');

const $home = cheerio.load(homepage);
const $demo = cheerio.load(demo);

// 统计基本信息
console.log('1️⃣  基本统计信息');
console.log('-----------------------------------');
console.log(`首页 HTML 行数: ${homepage.split('\n').length}`);
console.log(`Demo 页面行数: ${demo.split('\n').length}`);
console.log(`首页文件大小: ${(homepage.length / 1024).toFixed(2)} KB`);
console.log(`Demo 文件大小: ${(demo.length / 1024).toFixed(2)} KB`);
console.log('');

// 对比主要区块
console.log('2️⃣  主要内容区块对比');
console.log('-----------------------------------');

const sections = [
  { name: 'Hero 区域', selector: '.j3d, .tl-hero', demo: '.j3d' },
  { name: '服务介绍', selector: '.tl-sec', demo: '.tl-sec' },
  { name: 'FAQ 模块', selector: '.tl-faq', demo: '.tl-faq' },
  { name: '案例展示', selector: '.home-cases', demo: '.section' },
  { name: 'CTA 区域', selector: '.tl-cta', demo: '.tl-cta' }
];

sections.forEach(section => {
  const homeCount = $home(section.selector).length;
  const demoCount = $demo(section.demo || section.selector).length;
  const status = homeCount === demoCount ? '✅' : '⚠️';
  console.log(`${status} ${section.name}:`);
  console.log(`   首页: ${homeCount} 个 | Demo: ${demoCount} 个`);
});
console.log('');

// 对比文本内容
console.log('3️⃣  关键文本内容对比');
console.log('-----------------------------------');

const keyTexts = [
  '决策者最常问的',
  'AI 时代组织进化全生命周期服务商',
  '先问问 AI 顾问',
  '以「AI 原生」',
  '三阶服务'
];

keyTexts.forEach(text => {
  const inHome = homepage.includes(text);
  const inDemo = demo.includes(text);
  const status = inHome === inDemo ? (inHome ? '✅' : '➖') : '⚠️';
  console.log(`${status} "${text}"`);
  console.log(`   首页: ${inHome ? '有' : '无'} | Demo: ${inDemo ? '有' : '无'}`);
});
console.log('');

// 对比 CSS 样式引用
console.log('4️⃣  CSS 样式文件对比');
console.log('-----------------------------------');

const homeStyles = [];
const demoStyles = [];

$home('link[rel="stylesheet"]').each((i, elem) => {
  const href = $home(elem).attr('href');
  if (href) homeStyles.push(href);
});

$demo('link[rel="stylesheet"]').each((i, elem) => {
  const href = $demo(elem).attr('href');
  if (href) demoStyles.push(href);
});

console.log('首页样式文件:');
homeStyles.forEach(s => console.log(`  - ${s}`));
console.log('');
console.log('Demo 样式文件:');
demoStyles.forEach(s => console.log(`  - ${s}`));
console.log('');

// 找出独有的样式
const homeOnly = homeStyles.filter(s => !demoStyles.includes(s));
const demoOnly = demoStyles.filter(s => !homeStyles.includes(s));

if (homeOnly.length > 0) {
  console.log('⚠️  仅首页有的样式:');
  homeOnly.forEach(s => console.log(`  - ${s}`));
  console.log('');
}

if (demoOnly.length > 0) {
  console.log('⚠️  仅 Demo 有的样式:');
  demoOnly.forEach(s => console.log(`  - ${s}`));
  console.log('');
}

// 对比 JS 脚本引用
console.log('5️⃣  JavaScript 文件对比');
console.log('-----------------------------------');

const homeScripts = [];
const demoScripts = [];

$home('script[src]').each((i, elem) => {
  const src = $home(elem).attr('src');
  if (src && !src.includes('application/ld+json')) homeScripts.push(src);
});

$demo('script[src]').each((i, elem) => {
  const src = $demo(elem).attr('src');
  if (src && !src.includes('application/ld+json')) demoScripts.push(src);
});

console.log('首页脚本文件:');
homeScripts.forEach(s => console.log(`  - ${s}`));
console.log('');
console.log('Demo 脚本文件:');
demoScripts.forEach(s => console.log(`  - ${s}`));
console.log('');

// 对比 h1, h2 标题
console.log('6️⃣  主要标题对比');
console.log('-----------------------------------');

console.log('首页 H1:');
$home('h1').each((i, elem) => {
  console.log(`  ${i + 1}. ${$home(elem).text().trim().substring(0, 80)}`);
});

console.log('');
console.log('Demo H1:');
$demo('h1').each((i, elem) => {
  console.log(`  ${i + 1}. ${$demo(elem).text().trim().substring(0, 80)}`);
});

console.log('');
console.log('首页 H2 (前 5 个):');
$home('h2').slice(0, 5).each((i, elem) => {
  console.log(`  ${i + 1}. ${$home(elem).text().trim().substring(0, 80)}`);
});

console.log('');
console.log('Demo H2 (前 5 个):');
$demo('h2').slice(0, 5).each((i, elem) => {
  console.log(`  ${i + 1}. ${$demo(elem).text().trim().substring(0, 80)}`);
});

console.log('');

// 对比图片数量
console.log('7️⃣  图片资源对比');
console.log('-----------------------------------');
console.log(`首页图片数量: ${$home('img').length} 个`);
console.log(`Demo 图片数量: ${$demo('img').length} 个`);
console.log('');

// 对比内联样式
console.log('8️⃣  内联样式对比');
console.log('-----------------------------------');
const homeInlineStyles = $home('[style]').length;
const demoInlineStyles = $demo('[style]').length;
console.log(`首页内联样式元素: ${homeInlineStyles} 个`);
console.log(`Demo 内联样式元素: ${demoInlineStyles} 个`);
console.log('');

// 对比类名使用
console.log('9️⃣  常用类名统计');
console.log('-----------------------------------');

const commonClasses = ['reveal', 'tl-sec', 'btn', 'j3d', 'faq-item', 'hero'];

commonClasses.forEach(cls => {
  const homeCount = $home(`.${cls}`).length;
  const demoCount = $demo(`.${cls}`).length;
  const status = homeCount === demoCount ? '✅' : (Math.abs(homeCount - demoCount) <= 2 ? '⚠️' : '❌');
  console.log(`${status} .${cls}: 首页 ${homeCount} | Demo ${demoCount}`);
});

console.log('');
console.log('✅ 对比分析完成！');
console.log('=====================================');
