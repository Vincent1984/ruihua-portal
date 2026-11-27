const ENDPOINT = 'https://api.bocha.cn/v1/web-search';
const CACHE_MS = 10 * 60 * 1000;
const MAX_CACHE = 120;
const cache = new Map();
const pending = new Map();
const companySuffix = /(?:股份有限公司|有限责任公司|有限公司|股份公司|集团公司|合伙企业(?:[（(][^（）()]{2,8}[）)])?|公司)(?:[\p{L}\p{N}（）()]{1,16}分公司)?$/u;
const englishSuffix = /\b(?:Co\.?\s*,?\s*Ltd\.?|Limited|Inc\.?|Corporation|LLC|GmbH)$/i;
const normal = value => value.normalize('NFKC').toLowerCase().replace(/[\s·.\-]/g, '');
const error = (message, status) => Object.assign(new Error(message), { status });

function plain(value, limit = 1800) {
    return typeof value === 'string' ? value.slice(0, limit).replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim() : '';
}
function safeLink(value) {
    if (typeof value !== 'string' || value.length > 1500) return '';
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : '';
    } catch (_) { return ''; }
}
function candidateName(raw) {
    const name = raw.replace(/^[“"'「『《\s]+|[”"'」』》\s]+$/g, '').trim();
    if (name.length < 5 || name.length > 100 || /公司简介|公司官网|工商信息|统一社会信用代码|招聘信息/.test(name)) return '';
    const chinese = companySuffix.test(name) && /^[\p{L}\p{N}·&（）()\-. ]+$/u.test(name);
    const english = englishSuffix.test(name) && /^[A-Za-z0-9 &'.,()\-]+$/.test(name);
    return chinese || english ? name : '';
}

function extractCandidates(query, records) {
    const keyword = normal(query);
    const terms = query.split(/\s+/).map(normal).filter(Boolean);
    const matchesTerms = value => terms.every(term => value.includes(term));
    const branchRequested = keyword.includes('分公司');
    const candidates = new Map(), references = [];
    for (const record of records.slice(0, 10)) {
        const title = plain(record?.name, 240);
        const url = safeLink(record?.url);
        if (!title || !url) continue;
        const snippet = plain(record.snippet || record.summary, 500);
        const summary = plain(record.summary || record.snippet);
        const source = { title, url, snippet };
        if (!references.some(item => item.url === url)) references.push(source);
        const titles = title.split(/\s+[-–]\s+|[|｜_—，。；]/);
        const labeled = [...(snippet + '。' + summary).matchAll(
            /(?:工商登记名称|注册名称|企业名称|公司名称|(?:公司|企业|中文)?全称)(?:为|是|[:：])\s*([\p{L}\p{N}“”「」《》·&（）()\-., ]{5,96}?(?:股份有限公司|有限责任公司|有限公司|股份公司|集团公司|公司|合伙企业(?:[（(][^（）()]{2,8}[）)])?)(?:[\p{L}\p{N}（）()]{1,16}分公司)?)(?=$|[\s“”」》、，。；;：:])/gu
        )].map(match => match[1]);
        for (const [parts, weight] of [[labeled, 2], [titles, 1]]) {
            for (const part of parts) {
                const fullName = candidateName(part.replace(/^(?:企业名称|公司名称|公司全称)[:：]\s*/, ''));
                if (!fullName) continue;
                const key = normal(fullName), contains = matchesTerms(key);
                if (!contains && !(weight === 2 && matchesTerms(normal(title + ' ' + snippet + ' ' + summary)))) continue;
                const previous = candidates.get(key);
                const score = (key === keyword ? 8 : contains ? 4 : 0) + weight -
                    (!branchRequested && /分公司$/.test(fullName) ? 2 : 0);
                if (previous) {
                    previous.score = Math.max(previous.score, score);
                    if (!previous.sources.some(item => item.url === url) && previous.sources.length < 2) previous.sources.push(source);
                } else {
                    candidates.set(key, { name: fullName, sources: [source], score });
                }
            }
        }
    }
    return {
        candidates: [...candidates.values()].sort((a, b) => b.score - a.score || b.sources.length - a.sources.length)
            .slice(0, 6).map(({ name, sources }) => ({ name, sources })),
        references: references.slice(0, 5)
    };
}

async function fetchCandidates(query, key) {
    let response, result;
    try {
        response = await fetch(ENDPOINT, {
            method: 'POST', redirect: 'error',
            headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query + ' 工商登记 企业全称', summary: true, count: 10 }),
            signal: AbortSignal.timeout(6500)
        });
        if (!response.ok) {
            await response.body?.cancel();
            throw error(response.status === 429 ? '查询服务暂时限频，请稍后再试' : '公司查询暂不可用，可继续手动填写', 502);
        }
        result = await response.json();
    } catch (err) {
        if (err.status === 502) throw err;
        throw error('公司查询暂不可用，可继续手动填写', 502);
    }
    if (result?.code !== undefined && Number(result.code) !== 200) {
        throw error('公司查询暂不可用，可继续手动填写', 502);
    }
    const pages = result?.data?.webPages?.value;
    return extractCandidates(query, Array.isArray(pages) ? pages : []);
}

async function lookupCompany(value) {
    const query = typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ') : '';
    if (query.length < 2 || query.length > 80 || !/^[\p{L}\p{N}·&() .,'’\-]+$/u.test(query) || !/\p{L}/u.test(query)) {
        throw error('请输入 2 至 80 字的公司简称或名称', 400);
    }
    const key = process.env.BOCHA_API_KEY;
    if (!key) throw error('公司查询服务尚未配置，可继续手动填写', 503);
    const cacheKey = query.toLowerCase();
    const item = cache.get(cacheKey);
    if (item && item.until > Date.now()) return item.result;
    if (pending.has(cacheKey)) return pending.get(cacheKey);
    const request = fetchCandidates(query, key).then(result => {
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
        cache.set(cacheKey, { result, until: Date.now() + CACHE_MS });
        return result;
    }).finally(() => pending.delete(cacheKey));
    pending.set(cacheKey, request);
    return request;
}

module.exports = { lookupCompany, extractCandidates };
