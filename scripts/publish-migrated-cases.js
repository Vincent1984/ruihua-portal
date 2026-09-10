const fs = require('fs');
const path = require('path');
const {
  getArg,
  hasArg,
  normalizeBaseUrl,
  promptHidden,
  requestJson,
  writeReport
} = require('./sync-cases-to-production');

const ROOT = path.join(__dirname, '..');

function stateCounts(rows) {
  return rows.reduce((counts, row) => {
    const key = `${row.status || '(empty)'}|isOnline=${row.isOnline === true}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

async function main() {
  const baseUrl = normalizeBaseUrl(getArg('url'));
  const username = getArg('username');
  const bundleDir = path.resolve(ROOT, getArg('bundle', 'exports/cases-sync-20260910'));
  const apply = hasArg('apply');
  const payloadPath = path.join(bundleDir, 'cases-payload-as-is.json');

  if (!username) throw new Error('缺少 --username');
  if (!bundleDir.startsWith(`${ROOT}${path.sep}`)) throw new Error('资料包必须位于项目目录内');
  if (!fs.existsSync(payloadPath)) throw new Error(`找不到迁移 payload：${payloadPath}`);

  const expected = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  const expectedSlugs = new Set(expected.map(row => row.slug));
  const password = await promptHidden('Password (hidden): ');
  const login = await requestJson(baseUrl, '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!login.success || !login.token) throw new Error('登录成功响应中没有 token');
  const authHeaders = { Authorization: `Bearer ${login.token}` };

  const beforeResponse = await requestJson(baseUrl, '/api/admin/cases', { headers: authHeaders });
  const before = Array.isArray(beforeResponse) ? beforeResponse : (Array.isArray(beforeResponse.data) ? beforeResponse.data : []);
  const targets = before.filter(row => expectedSlugs.has(row.slug));
  const presentSlugs = new Set(targets.map(row => row.slug));
  const missingSlugs = [...expectedSlugs].filter(slug => !presentSlugs.has(slug));
  const pending = targets.filter(row => row.status !== 'published' || row.isOnline !== true);
  const preflight = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    expected: expected.length,
    present: targets.length,
    missingSlugs,
    beforeStates: stateCounts(targets),
    updatesRequired: pending.length
  };
  writeReport(path.join(bundleDir, 'production-publish-preflight.json'), preflight);

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', ...preflight }));
    return;
  }
  if (missingSlugs.length > 0 || targets.length !== expected.length) {
    throw new Error(`目标集合校验失败：缺少 ${missingSlugs.length} 条案例，禁止批量发布`);
  }

  const result = {
    startedAt: new Date().toISOString(),
    attempted: pending.length,
    updated: [],
    unchanged: targets.filter(row => row.status === 'published' && row.isOnline === true)
      .map(row => ({ id: row._id, slug: row.slug, title: row.title })),
    failed: []
  };

  for (const row of pending) {
    try {
      await requestJson(baseUrl, `/api/cases/${encodeURIComponent(row._id)}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published', isOnline: true })
      });
      result.updated.push({ id: row._id, slug: row.slug, title: row.title });
    } catch (error) {
      result.failed.push({ id: row._id, slug: row.slug, title: row.title, error: error.message });
      break;
    }
  }
  result.finishedAt = new Date().toISOString();
  writeReport(path.join(bundleDir, 'production-publish-result.json'), result);

  const afterResponse = await requestJson(baseUrl, '/api/admin/cases', { headers: authHeaders });
  const after = Array.isArray(afterResponse) ? afterResponse : (Array.isArray(afterResponse.data) ? afterResponse.data : []);
  const verified = after.filter(row => expectedSlugs.has(row.slug));
  const publicResponse = await requestJson(baseUrl, '/api/cases');
  const publicCases = Array.isArray(publicResponse) ? publicResponse : (Array.isArray(publicResponse.data) ? publicResponse.data : []);
  const publicSlugs = new Set(publicCases.map(row => row.slug));
  const verification = {
    verifiedAt: new Date().toISOString(),
    expected: expected.length,
    adminPresent: verified.length,
    afterStates: stateCounts(verified),
    publicPresent: [...expectedSlugs].filter(slug => publicSlugs.has(slug)).length,
    missingFromPublic: [...expectedSlugs].filter(slug => !publicSlugs.has(slug))
  };
  writeReport(path.join(bundleDir, 'production-publish-verification.json'), verification);

  console.log(JSON.stringify({
    mode: 'apply',
    attempted: result.attempted,
    updated: result.updated.length,
    unchanged: result.unchanged.length,
    failed: result.failed.length,
    adminPresent: verification.adminPresent,
    publicPresent: verification.publicPresent,
    expected: verification.expected,
    afterStates: verification.afterStates
  }));
  if (result.failed.length || verification.missingFromPublic.length) process.exitCode = 2;
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
