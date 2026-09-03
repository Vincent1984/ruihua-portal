require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { slugify } = require('transliteration');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'new', '瑞华智策官网管理后台.html');
const Appointment = require('../models/Appointment');
const Article = require('../models/Article');
const Case = require('../models/Case');
const Faq = require('../models/Faq');
const Author = require('../models/Author');
const GlobalConfig = require('../models/GlobalConfig');
const PageContent = require('../models/PageContent');

function extractDeclaration(html, name) {
  const marker = `const ${name}=`;
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`未找到 ${name}`);
  const exprStart = Math.min(...['[', '{'].map(ch => {
    const index = html.indexOf(ch, start);
    return index < 0 ? html.length : index;
  }));
  const pairs = { '[': ']', '{': '}' };
  const stack = [];
  let quote = null, end = -1;
  for (let i = exprStart; i < html.length; i++) {
    const ch = html[i];
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (ch === stack[stack.length - 1]) { stack.pop(); if (!stack.length) { end = i; break; } }
  }
  if (end < 0) throw new Error(`${name} 括号未闭合`);
  return html.slice(exprStart, end + 1);
}

function evaluate(html, name) {
  const expression = extractDeclaration(html, name);
  return Function('H', 'D', 'NOW', `return ${expression}`)(3600e3, 24 * 3600e3, Date.now());
}

function extractBackendData(html = fs.readFileSync(SRC, 'utf8')) {
  const leads = evaluate(html, 'LEADS');
  const articles = evaluate(html, 'ARTS');
  const cases = evaluate(html, 'CASES');
  const faqs = evaluate(html, 'FAQS');
  const experts = evaluate(html, 'EXPERTS');
  const config = evaluate(html, 'CFG');
  const channels = evaluate(html, 'CHANS');
  const recipients = evaluate(html, 'RCPS');
  return { leads, articles, cases, faqs, experts, config, channels, recipients };
}

function normalizeBackendData(data) {
  return {
    ...data,
    config: {
      key: 'website', tel: data.config.tel, mail: data.config.mail, cities: data.config.cities,
      icp: data.config.icp, qr: data.config.qr, oldDomain: data.config.oldDomain,
      newDomain: data.config.newDomain, logo: data.config.logo,
      notificationChannels: data.config.chans || [],
      escalationHours: Number(data.config.esc) || 0,
      dailyDigest: data.config.daily || ''
    }
  };
}

async function upsertMany(Model, rows, key, map) {
  let created = 0, updated = 0;
  for (const row of rows) {
    const filter = map.key(row);
    const result = await Model.updateOne(filter, { $set: map.value(row) }, { upsert: true, runValidators: true });
    if (result.upsertedCount) created++; else updated++;
  }
  return { created, updated };
}

async function importBackendData(data) {
  const normalized = normalizeBackendData(data);
  const leads = await upsertMany(Appointment, normalized.leads, 'externalId', {
    key: row => ({ externalId: row.id }),
    value: row => ({ externalId: row.id, name: row.name, phone: row.tel, email: row.email, company: row.company, title: row.title,
      channel: row.channel, status: row.state, intents: row.intents, leadPage: row.leadPage, trigger: row.trigger,
      device: row.device, trail: row.trail, kb: row.kb, talk: row.talk, notes: row.notes, remarks: row.msg || row.ref })
  });
  const articles = await upsertMany(Article, normalized.articles, 'title', { key: row => ({ title: row.title }), value: row => ({
    title: row.title, zone: row.zone, category: row.cat, contentStatus: row.state, isOnline: !!row.on, top: !!row.top,
    summary: row.abstract, tags: row.tags, author: { name: row.author }, publishDate: new Date(row.pub), status: row.on ? 'published' : 'draft',
    slug: slugify(row.title, { separator: '-' }).slice(0, 80)
  }) });
  const cases = await upsertMany(Case, normalized.cases, 'title', { key: row => ({ title: row.title }), value: row => ({
    title: row.title, industry: row.ind, stats: [{ label: '关键数据', value: String(row.stats || '') }], isOnline: !!row.on, featured: !!row.feat, order: row.id, status: 'published',
    slug: slugify(row.title, { separator: '-' }).slice(0, 80)
  }) });
  const faqs = await upsertMany(Faq, normalized.faqs, 'question', { key: row => ({ question: row.q }), value: row => ({
    question: row.q, answer: row.a, order: row.id, isOnline: true, status: 'published'
  }) });
  const experts = await upsertMany(Author, normalized.experts, 'name', { key: row => ({ name: row.name }), value: row => ({
    name: row.name, desc: row.role, detail: row.bio, avatar: row.photo, updatedAt: new Date()
  }) });
  const recipients = (normalized.recipients || []).map(row => ({ name: row.name, role: row.role, account: row.acct, scope: row.scope, channel: row.chan, enabled: !!row.on }));
  const { key, ...configFields } = normalized.config;
  const config = await GlobalConfig.findOneAndUpdate({ key: key || 'website' }, { $set: { ...configFields, recipients, updatedAt: new Date() } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  return { leads, articles, cases, faqs, experts, config };
}

async function importPages() {
  const pages = [
    ['solutions', '产品与服务'], ['p-training', 'AI 赋能培训'], ['p-consulting', 'AI 转型咨询'], ['p-fde', 'AI 落地陪跑'],
    ['hcvm', '人力资本价值经营'], ['about', '关于我们'], ['about-team', '团队基因'], ['contact', '联系我们']
  ];
  for (const [key, title] of pages) await PageContent.updateOne({ key }, { $setOnInsert: { key, title, sections: [] } }, { upsert: true });
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/ruihua_cms';
  await mongoose.connect(mongoUrl);
  const result = await importBackendData(extractBackendData());
  await importPages();
  console.log(JSON.stringify(result));
  await mongoose.disconnect();
}

if (require.main === module) main().catch(err => { console.error('导入失败:', err); process.exit(1); });
module.exports = { extractBackendData, normalizeBackendData, importBackendData };
