/**
 * 百度普通收录（主动推送）：内容发布后自动提交 URL
 *
 * 设计要点：
 * - 只在「发布」动作后调用，草稿 / 下架不推送
 * - 异步、不阻塞接口响应；任何失败只记日志，不影响发布结果
 * - 同一 URL 只推一次（记录在 .baidu-pushed.json，与 scripts/baidu-push.js 共用）
 * - 2 秒内多次发布合并成一批，单批最多 10 条（百度接口上限）
 * - 接口必须用 http：data.zz.baidu.com 的证书 SAN 只有 baidu.com
 * - site 参数不能 URL 编码，否则百度返回 400 site init fail
 */

const fs = require('fs');
const path = require('path');

const SITE = (process.env.SITE_URL || 'https://www.ruihuaconsulting.com').replace(/\/$/, '');
const TOKEN = process.env.BAIDU_TOKEN || '6cP86EBsBfuJtxUO';
const API = 'http://data.zz.baidu.com/urls';
const STATE_FILE = process.env.BAIDU_STATE || path.join(__dirname, '..', '.baidu-pushed.json');
const BATCH_SIZE = 10;
const DEBOUNCE_MS = Number(process.env.BAIDU_PUSH_DEBOUNCE_MS || 2000);

const pending = new Set();
let timer = null;

function loadPushed() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return state && typeof state.pushed === 'object' && state.pushed ? state.pushed : {};
  } catch {
    return {};
  }
}

function savePushed(pushed) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ pushed }, null, 2) + '\n');
  } catch (err) {
    // 容器内文件系统只读时忽略，最多导致同一 URL 重复提交一次
    console.warn('[baiduPush] 写入推送记录失败：', err.message);
  }
}

async function postBatch(urls) {
  const endpoint = `${API}?site=${SITE}&token=${TOKEN}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: urls.join('\n')
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: { raw: text } };
  }
}

async function flush() {
  if (!pending.size) return;

  const pushed = loadPushed();
  const urls = [...pending].filter(u => !pushed[u]);
  pending.clear();
  if (!urls.length) return;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    try {
      const { status, data } = await postBatch(batch);
      if (data.error) {
        console.warn(`[baiduPush] 推送失败（HTTP ${status}）：${data.error} ${data.message || ''}`);
        continue;
      }
      const now = new Date().toISOString();
      batch.forEach(u => (pushed[u] = now));
      savePushed(pushed);
      console.log(`[baiduPush] 推送成功 ${data.success ?? batch.length} 条（剩余配额 ${data.remain ?? '未知'}）`);
      if (typeof data.remain === 'number' && data.remain <= 0) {
        console.warn('[baiduPush] 今日配额已用完，新 URL 将于次日通过 npm run baidu:push 补推');
        break;
      }
    } catch (err) {
      console.warn('[baiduPush] 调用百度接口异常：', err.message);
    }
  }
}

/**
 * 提交单个页面路径（如 'insights/my-slug'），自动补全站点前缀并去重
 * @param {string} pathname 站内路径，可带或不带前导斜杠
 */
function pushPage(pathname) {
  if (!pathname) return;
  try {
    const url = SITE + (pathname.startsWith('/') ? pathname : '/' + pathname);
    if (new URL(url).host !== new URL(SITE).host) return;
    pending.add(url);
  } catch {
    return;
  }

  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flush().catch(err => console.warn('[baiduPush] 批量推送异常：', err.message));
  }, DEBOUNCE_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = { pushPage, SITE };
