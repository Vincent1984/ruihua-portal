#!/usr/bin/env node
/**
 * 百度普通收录（主动推送）对接脚本
 *
 * 用法：
 *   node scripts/baidu-push.js                     # 推送 sitemap.xml 中尚未推送过的 URL
 *   node scripts/baidu-push.js --dry-run           # 只打印将要推送的 URL，不实际调用
 *   node scripts/baidu-push.js --limit=5           # 本次最多推 5 条
 *   node scripts/baidu-push.js --force             # 忽略已推送记录，重新推送
 *   node scripts/baidu-push.js --url=https://www.ruihuaconsulting.com/about --url=...
 *
 * 环境变量：
 *   BAIDU_TOKEN  覆盖内置 token
 *   SITE_URL     覆盖站点地址（默认 https://www.ruihuaconsulting.com）
 *
 * 说明：百度该接口的 HTTPS 证书不匹配 data.zz.baidu.com（证书 SAN 只有 baidu.com），
 * 只能用 http 调用，这也是百度官方文档给出的写法。
 * 普通收录每日配额较小（新站通常 10 条/天），脚本会读回 remain 并在配额耗尽时自动停止，
 * 已成功推送的 URL 记录在 .baidu-pushed.json，避免第二天重复占用配额。
 */

const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE_URL || 'https://www.ruihuaconsulting.com';
const TOKEN = process.env.BAIDU_TOKEN || '6cP86EBsBfuJtxUO';
const API = 'http://data.zz.baidu.com/urls';
const STATE_FILE = process.env.BAIDU_STATE || path.join(__dirname, '..', '.baidu-pushed.json');

// 百度普通收录单次最多 10 条
const BATCH_SIZE = 10;
const BATCH_INTERVAL_MS = 500;

function parseArgs(argv) {
  const opts = { urls: [], dryRun: false, force: false, limit: Infinity };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--force') opts.force = true;
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.slice('--limit='.length)) || Infinity;
    else if (arg.startsWith('--url=')) opts.urls.push(arg.slice('--url='.length).trim());
  }
  return opts;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { pushed: {} };
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  } catch (err) {
    console.warn(`写入推送记录失败（不影响推送结果）：${err.message}`);
  }
}

async function fetchSitemapUrls() {
  const sitemapUrl = `${SITE.replace(/\/$/, '')}/sitemap.xml`;
  const res = await fetch(sitemapUrl, { headers: { 'User-Agent': 'ruihua-baidu-push/1.0' } });
  if (!res.ok) throw new Error(`拉取 sitemap 失败：HTTP ${res.status} ${sitemapUrl}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
}

async function pushBatch(urls) {
  // site 参数不能做 URL 编码，否则百度返回 400 site init fail
  const endpoint = `${API}?site=${SITE}&token=${TOKEN}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: urls.join('\n')
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function main() {
  const { urls: cliUrls, dryRun, force, limit } = parseArgs(process.argv.slice(2));
  const state = loadState();

  let urls = cliUrls.length ? cliUrls : await fetchSitemapUrls();

  // 去重 + 只保留本站 URL
  const host = new URL(SITE).host;
  urls = [...new Set(urls)].filter(u => {
    try {
      return new URL(u).host === host;
    } catch {
      return false;
    }
  });

  if (!force) urls = urls.filter(u => !state.pushed[u]);
  urls = urls.slice(0, limit);

  if (!urls.length) {
    console.log('没有需要推送的 URL（已推送过的可用 --force 重推）。');
    return;
  }

  console.log(`站点：${SITE}`);
  console.log(`待推送：${urls.length} 条`);
  if (dryRun) {
    urls.forEach(u => console.log('  ' + u));
    console.log('\n[dry-run] 未实际调用百度接口。');
    return;
  }

  let success = 0;
  let failed = 0;
  let remain = null;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const { status, data } = await pushBatch(batch);

    if (data.error) {
      console.error(`第 ${i / BATCH_SIZE + 1} 批失败（HTTP ${status}）：${data.error} ${data.message || ''}`);
      failed += batch.length;
      if (status === 401 || /token/i.test(String(data.message || ''))) {
        console.error('token 无效或已失效，终止后续推送。');
        break;
      }
    } else {
      const ok = Number(data.success || 0);
      success += ok;
      failed += batch.length - ok;
      if (typeof data.remain === 'number') remain = data.remain;
      batch.forEach(u => (state.pushed[u] = new Date().toISOString()));
      saveState(state);
      console.log(
        `第 ${i / BATCH_SIZE + 1} 批：成功 ${ok} 条` +
          (batch.length - ok > 0 ? `，未成功 ${batch.length - ok} 条` : '') +
          `（今日剩余配额 ${data.remain ?? '未知'}）`
      );
    }

    // 配额耗尽则停止，剩余的明天继续推
    if (remain !== null && remain <= 0) {
      console.log('今日配额已用完，剩余 URL 请明天再执行本脚本。');
      break;
    }
    if (i + BATCH_SIZE < urls.length) {
      await new Promise(r => setTimeout(r, BATCH_INTERVAL_MS));
    }
  }

  console.log(`\n完成：成功 ${success} 条，未成功 ${failed} 条` + (remain !== null ? `，今日剩余配额 ${remain}` : ''));
}

main().catch(err => {
  console.error('推送失败：', err.message);
  process.exit(1);
});
