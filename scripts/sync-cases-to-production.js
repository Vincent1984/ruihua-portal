const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const arg = process.argv.find(item => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('仅支持 HTTP(S) 地址');
  return url.origin;
}

function promptHidden(label) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      reject(new Error('需要在交互式终端中输入密码'));
      return;
    }

    let value = '';
    const stdin = process.stdin;
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    const onData = chunk => {
      const text = String(chunk);
      for (const char of text) {
        if (char === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('操作已取消'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    process.stdout.write(label);
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    signal: AbortSignal.timeout(30000),
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${pathname} 返回非 JSON 响应（HTTP ${response.status}）`);
  }
  if (!response.ok) {
    throw new Error(`${pathname} 请求失败（HTTP ${response.status}）：${data.error || data.message || '未知错误'}`);
  }
  return data;
}

function comparable(row) {
  return {
    title: row.title || '',
    slug: row.slug || '',
    industry: row.industry || '',
    client: row.client || '',
    cover: row.cover || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    background: row.background || '',
    problems: Array.isArray(row.problems) ? row.problems : [],
    goals: Array.isArray(row.goals) ? row.goals : [],
    solutions: Array.isArray(row.solutions) ? row.solutions : [],
    resultTags: Array.isArray(row.resultTags) ? row.resultTags : [],
    stats: Array.isArray(row.stats)
      ? row.stats.map(item => ({ label: item.label || '', value: item.value || '' }))
      : [],
    featured: Boolean(row.featured),
    featuredOrder: Number(row.featuredOrder) || 0,
    order: Number(row.order) || 0,
    isOnline: row.isOnline !== false,
    status: row.status || 'draft',
    seo: row.seo && typeof row.seo === 'object'
      ? {
          title: row.seo.title || '',
          description: row.seo.description || '',
          keywords: row.seo.keywords || ''
        }
      : { title: '', description: '', keywords: '' }
  };
}

function sameCase(left, right) {
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}

function writeReport(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const baseUrl = normalizeBaseUrl(getArg('url'));
  const username = getArg('username');
  const bundleDir = path.resolve(ROOT, getArg('bundle', 'exports/cases-sync-20260910'));
  const apply = hasArg('apply');
  const payloadName = getArg('payload', 'cases-payload-draft.json');
  const payloadPath = path.join(bundleDir, payloadName);

  if (!username) throw new Error('缺少 --username');
  if (!bundleDir.startsWith(`${ROOT}${path.sep}`)) throw new Error('资料包必须位于项目目录内');
  if (!fs.existsSync(payloadPath)) throw new Error(`找不到迁移 payload：${payloadPath}`);

  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  if (!Array.isArray(payload) || payload.length === 0) throw new Error('迁移 payload 为空');
  const password = await promptHidden('Password (hidden): ');

  const login = await requestJson(baseUrl, '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!login.success || !login.token) throw new Error('登录成功响应中没有 token');
  const authHeaders = { Authorization: `Bearer ${login.token}` };

  const productionResponse = await requestJson(baseUrl, '/api/admin/cases', { headers: authHeaders });
  const production = Array.isArray(productionResponse)
    ? productionResponse
    : (Array.isArray(productionResponse.data) ? productionResponse.data : []);
  const bySlug = new Map(production.filter(row => row.slug).map(row => [row.slug, row]));
  const plan = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    payload: payloadName,
    sourceCount: payload.length,
    productionCount: production.length,
    create: [],
    unchanged: [],
    conflicts: []
  };

  for (const row of payload) {
    const existing = bySlug.get(row.slug);
    if (!existing) plan.create.push({ slug: row.slug, title: row.title });
    else if (sameCase(existing, row)) plan.unchanged.push({ slug: row.slug, title: row.title, id: existing._id });
    else plan.conflicts.push({ slug: row.slug, title: row.title, id: existing._id });
  }
  writeReport(path.join(bundleDir, 'production-preflight.json'), plan);

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', productionCount: production.length, create: plan.create.length, unchanged: plan.unchanged.length, conflicts: plan.conflicts.length }));
    return;
  }
  if (plan.conflicts.length > 0) {
    throw new Error(`发现 ${plan.conflicts.length} 个冲突，安全策略禁止自动覆盖`);
  }

  const result = {
    startedAt: new Date().toISOString(),
    baseUrl,
    payload: payloadName,
    attempted: plan.create.length,
    created: [],
    skipped: plan.unchanged,
    failed: []
  };

  for (const item of plan.create) {
    const row = payload.find(candidate => candidate.slug === item.slug);
    try {
      const response = await requestJson(baseUrl, '/api/cases', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(row)
      });
      result.created.push({ slug: row.slug, title: row.title, id: response.data?._id || null });
    } catch (error) {
      result.failed.push({ slug: row.slug, title: row.title, error: error.message });
      break;
    }
  }

  result.finishedAt = new Date().toISOString();
  writeReport(path.join(bundleDir, 'production-migration-result.json'), result);

  const afterResponse = await requestJson(baseUrl, '/api/admin/cases', { headers: authHeaders });
  const after = Array.isArray(afterResponse) ? afterResponse : (Array.isArray(afterResponse.data) ? afterResponse.data : []);
  const expectedSlugs = new Set(payload.map(row => row.slug));
  const present = after.filter(row => expectedSlugs.has(row.slug));
  const verification = {
    verifiedAt: new Date().toISOString(),
    productionCount: after.length,
    migratedPresent: present.length,
    expected: payload.length,
    statusCounts: present.reduce((counts, row) => {
      const status = row.status || '(empty)';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {}),
    missingSlugs: payload.map(row => row.slug).filter(slug => !present.some(item => item.slug === slug))
  };
  writeReport(path.join(bundleDir, 'production-verification.json'), verification);

  console.log(JSON.stringify({
    mode: 'apply',
    attempted: result.attempted,
    created: result.created.length,
    skipped: result.skipped.length,
    failed: result.failed.length,
    verified: verification.migratedPresent,
    expected: verification.expected
  }));
  if (result.failed.length || verification.missingSlugs.length) process.exitCode = 2;
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
