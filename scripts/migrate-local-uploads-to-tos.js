// 存量本地图片迁移脚本：把数据库里指向网站目录（/uploads/...）的图片搬迁到火山引擎 TOS
//
// 背景
//   历史版本的上传逻辑在 TOS 上传失败时会回退到本地磁盘 /uploads/...，并把该相对路径写进数据库。
//   生产环境 Deployment 有 2 个副本，且容器内 /app/public/uploads 未挂载共享存储，文件只落在
//   「处理该次上传的那个 Pod」的临时磁盘上。于是同一个地址：
//     - 命中持有文件的 Pod → 200
//     - 命中另一个 Pod     → 404（App 的 404 页面）
//     - 任一 Pod 重启/滚动更新 → 文件永久丢失
//
// 本脚本做三件事
//   1. 扫描数据库中所有形如 /uploads/... 的本地路径（含富文本 HTML 内嵌的 <img src="/uploads/...">）
//   2. 从站点域名把文件抓回来（自动重试，规避双副本轮询），以同名 key 上传到 TOS
//   3. 把数据库里的本地路径改写为 TOS 公网地址
//
// 用法
//   node scripts/migrate-local-uploads-to-tos.js           # 空跑（默认）：只扫描与探测，不改库、不传 TOS
//   node scripts/migrate-local-uploads-to-tos.js --write   # 实际执行：上传 TOS 并改写数据库
//
// 可选参数
//   --site=https://www.ruihuaconsulting.com   素材抓取站点（默认 https://www.ruihuaconsulting.com）
//   --retries=12                              单个文件抓取重试次数（默认 12，双副本下命中概率 1-2^-12）
//   --only=articles,cases                     只处理指定集合
//   --skip=operationlogs                      额外跳过指定集合
//
// 依赖环境变量
//   MONGODB_URL、TOS_ACCESS_KEY、TOS_SECRET_KEY、TOS_BUCKET_NAME、TOS_PUBLIC_URL
//   （与 server.js 共用同一套配置；生产环境由 ConfigMap / Secret 注入，无需 .env）
require('dotenv').config();
const mongoose = require('mongoose');
const { S3Client, HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

// 纯审计类集合不参与迁移：filenamemaps.directory 存的是文件系统路径而非 URL，改写会破坏其语义
const SKIP_COLLECTIONS = new Set(['operationlogs', 'filenamemaps', 'surveytrackinglogs']);

// 站点自身域名，只有这些域名的绝对地址才被视为"本地路径"
const SITE_HOST_SUFFIX = /(^|\.)ruihuaconsulting\.com$/i;

const LOCAL_PATH_REGEX = /(?:https?:\/\/[^\s"'<>()\\]+?)?(\/uploads\/[^\s"'<>()\\]+)/gi;

function parseArgs(argv) {
    const opts = { write: false, site: 'https://www.ruihuaconsulting.com', retries: 12, only: null, skip: new Set() };
    for (const arg of argv.slice(2)) {
        if (arg === '--write') opts.write = true;
        else if (arg.startsWith('--site=')) opts.site = arg.slice(7).replace(/\/+$/, '');
        else if (arg.startsWith('--retries=')) opts.retries = Math.max(1, parseInt(arg.slice(10), 10) || 12);
        else if (arg.startsWith('--only=')) opts.only = new Set(arg.slice(7).split(',').map(s => s.trim()).filter(Boolean));
        else if (arg.startsWith('--skip=')) arg.slice(7).split(',').map(s => s.trim()).filter(Boolean).forEach(s => opts.skip.add(s));
    }
    return opts;
}

function normalizeTosEndpoint(inputEndpoint) {
    const raw = String(inputEndpoint || '').trim();
    if (!raw) return '';
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return withProto.replace('://tos-cn-', '://tos-s3-cn-');
}

function resolveTosSecretAccessKey() {
    const raw = String(process.env.TOS_SECRET_KEY || '').trim();
    const flag = String(process.env.TOS_SECRET_KEY_BASE64 || '').toLowerCase();
    if (!(flag === '1' || flag === 'true' || flag === 'yes')) return raw;
    try {
        return Buffer.from(raw, 'base64').toString('utf8').trim() || raw;
    } catch (e) {
        return raw;
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 递归收集文档中的字符串字段，记录其点号路径（如 coverImage、content、items.0.url）
function collectStringFields(value, prefix, out) {
    if (typeof value === 'string') {
        out.push({ path: prefix, value });
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((v, i) => collectStringFields(v, prefix ? `${prefix}.${i}` : String(i), out));
        return;
    }
    if (!value || typeof value !== 'object') return;
    // 只深入普通对象；ObjectId / Date / Buffer / Decimal128 等直接跳过
    if (value.constructor && value.constructor.name !== 'Object') return;
    for (const key of Object.keys(value)) {
        if (key.startsWith('$') || key.includes('.')) continue;
        collectStringFields(value[key], prefix ? `${prefix}.${key}` : key, out);
    }
}

// 把字符串中的本地 /uploads/... 路径替换为 TOS 地址；只替换托管域名下的绝对地址与相对路径
function rewriteString(str, tosBase, tosHost, migratedPaths) {
    if (!str || str.indexOf('/uploads/') === -1) return { changed: false, value: str };
    let changed = false;
    const value = str.replace(LOCAL_PATH_REGEX, (full, pathWithMaybeQuery) => {
        const cleanPath = pathWithMaybeQuery.split(/[?#]/)[0];
        const origin = full.slice(0, full.length - pathWithMaybeQuery.length);
        if (origin) {
            let host = '';
            try { host = new URL(origin).hostname.toLowerCase(); } catch { return full; }
            if (host === tosHost) return full;              // 已经是 TOS 地址
            if (!SITE_HOST_SUFFIX.test(host)) return full;  // 外站地址，不动
        }
        if (!migratedPaths.has(cleanPath)) return full;     // 未成功迁移，保持原样，留待人工处理
        changed = true;
        return tosBase + cleanPath;
    });
    return { changed, value };
}

async function tosObjectExists(client, bucket, key) {
    try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
    } catch (e) {
        return false;
    }
}

// 从站点域名抓取文件。双副本会导致约一半请求落到没有文件的 Pod，因此必须重试。
async function fetchFromSite(siteBase, localPath, retries) {
    const url = siteBase + localPath;
    let lastStatus = 'no-attempt';
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
            lastStatus = `HTTP ${res.status}`;
            if (res.status === 200) {
                const rawType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
                // 404 页面 / 错误页会以 text/html 返回，必须排除
                if (!rawType || rawType.startsWith('text/')) {
                    lastStatus = `content-type=${rawType || '(none)'}`;
                } else {
                    const buffer = Buffer.from(await res.arrayBuffer());
                    if (buffer.length === 0) {
                        lastStatus = 'empty body';
                    } else {
                        return { buffer, contentType: rawType };
                    }
                }
            }
        } catch (e) {
            lastStatus = e.name === 'TimeoutError' || e.name === 'AbortError' ? 'timeout' : e.message;
        }
        if (attempt < retries) await sleep(250);
    }
    return { error: lastStatus };
}

async function main() {
    const opts = parseArgs(process.argv);

    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/ruihua_cms';
    const bucket = process.env.TOS_BUCKET_NAME;
    const tosPublicUrl = String(process.env.TOS_PUBLIC_URL || '').replace(/\/+$/, '');
    if (!bucket || !tosPublicUrl || !process.env.TOS_ACCESS_KEY || !process.env.TOS_SECRET_KEY) {
        console.error('缺少 TOS 配置：需要 TOS_ACCESS_KEY / TOS_SECRET_KEY / TOS_BUCKET_NAME / TOS_PUBLIC_URL');
        process.exit(1);
    }
    const tosHost = new URL(tosPublicUrl).hostname.toLowerCase();
    const tosClient = new S3Client({
        region: process.env.TOS_REGION || 'cn-beijing',
        endpoint: normalizeTosEndpoint(process.env.TOS_ENDPOINT || 'https://tos-cn-beijing.volces.com'),
        credentials: {
            accessKeyId: process.env.TOS_ACCESS_KEY,
            secretAccessKey: resolveTosSecretAccessKey()
        }
    });

    console.log(`模式         : ${opts.write ? '实际执行（会写库 + 传 TOS）' : '空跑 dry-run（不改库、不传 TOS）'}`);
    console.log(`MongoDB      : ${mongoUrl}`);
    console.log(`素材站点     : ${opts.site}`);
    console.log(`TOS 目标     : ${tosPublicUrl}`);
    console.log(`抓取重试次数 : ${opts.retries}`);
    console.log('');

    await mongoose.connect(mongoUrl);
    const db = mongoose.connection.db;
    const allCollections = (await db.listCollections().toArray()).map(c => c.name).sort();

    const collections = allCollections.filter(name => {
        if (name.startsWith('system.')) return false;
        if (SKIP_COLLECTIONS.has(name) || opts.skip.has(name)) return false;
        if (opts.only && !opts.only.has(name)) return false;
        return true;
    });
    console.log(`待扫描集合   : ${collections.length} 个${opts.only ? `（--only 限定）` : ''}`);
    console.log('');

    // ---------- 阶段 1：扫描 ----------
    const pathOwners = new Map();   // 本地路径 -> [{ collection, _id }]
    const hitDocs = [];             // 含本地路径的文档 [{ collection, _id, fields:[{path,value}] }]

    for (const name of collections) {
        const cursor = db.collection(name).find({});
        for await (const doc of cursor) {
            const fields = [];
            collectStringFields(doc, '', fields);
            const localFields = fields.filter(f => f.value.indexOf('/uploads/') !== -1);
            if (localFields.length === 0) continue;

            const pathsInDoc = new Set();
            for (const f of localFields) {
                const re = new RegExp(LOCAL_PATH_REGEX.source, 'gi');
                let m;
                while ((m = re.exec(f.value)) !== null) {
                    const cleanPath = m[1].split(/[?#]/)[0];
                    const origin = m[0].slice(0, m[0].length - m[1].length);
                    if (origin) {
                        let host = '';
                        try { host = new URL(origin).hostname.toLowerCase(); } catch { host = ''; }
                        if (host === tosHost) continue;
                        if (!SITE_HOST_SUFFIX.test(host)) continue;
                    }
                    pathsInDoc.add(cleanPath);
                }
            }
            if (pathsInDoc.size === 0) continue;

            hitDocs.push({ collection: name, _id: doc._id, fields: localFields });
            for (const p of pathsInDoc) {
                if (!pathOwners.has(p)) pathOwners.set(p, []);
                pathOwners.get(p).push({ collection: name, _id: doc._id });
            }
        }
    }

    console.log(`扫描结果     : ${hitDocs.length} 个文档涉及 ${pathOwners.size} 个本地文件`);
    if (pathOwners.size === 0) {
        console.log('无需迁移。');
        await mongoose.disconnect();
        return;
    }
    console.log('');

    // ---------- 阶段 2：逐个文件搬到 TOS ----------
    const migratedPaths = new Set();
    const failures = [];
    let alreadyOnTos = 0;
    let uploadedCount = 0;
    let index = 0;

    for (const [localPath, owners] of pathOwners) {
        index++;
        const key = localPath.replace(/^\/+/, '');
        const prefix = `[${String(index).padStart(4)}/${pathOwners.size}]`;

        if (await tosObjectExists(tosClient, bucket, key)) {
            migratedPaths.add(localPath);
            alreadyOnTos++;
            console.log(`${prefix} 已存在  ${localPath}`);
            continue;
        }

        const fetched = await fetchFromSite(opts.site, localPath, opts.retries);
        if (fetched.error) {
            failures.push({ localPath, reason: fetched.error, refs: owners.length });
            console.log(`${prefix} 抓取失败  ${localPath}  (${fetched.error})`);
            continue;
        }

        if (!opts.write) {
            migratedPaths.add(localPath);
            console.log(`${prefix} 可迁移  ${localPath}  ${fetched.contentType} ${(fetched.buffer.length / 1024).toFixed(1)}KB  (dry-run 未上传)`);
            continue;
        }

        try {
            await tosClient.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: fetched.buffer,
                ContentLength: fetched.buffer.length,
                ContentType: fetched.contentType,
                ContentDisposition: 'inline'
            }));
            migratedPaths.add(localPath);
            uploadedCount++;
            console.log(`${prefix} 已上传  ${localPath}  ${fetched.contentType} ${(fetched.buffer.length / 1024).toFixed(1)}KB`);
        } catch (e) {
            failures.push({ localPath, reason: `TOS 上传失败: ${e.message}`, refs: owners.length });
            console.log(`${prefix} 上传失败  ${localPath}  (${e.message})`);
        }
    }

    // ---------- 阶段 3：改写数据库 ----------
    console.log('');
    let updatedDocs = 0;
    let updatedFields = 0;

    for (const doc of hitDocs) {
        const changes = {};
        for (const f of doc.fields) {
            const result = rewriteString(f.value, tosPublicUrl + '/', tosHost, migratedPaths);
            // 数组下标路径（如 items.0.url）在 $set 中同样有效；空路径跳过
            if (result.changed && f.path) {
                changes[f.path] = result.value;
            }
        }
        if (Object.keys(changes).length === 0) continue;
        if (!opts.write) {
            updatedDocs++;
            updatedFields += Object.keys(changes).length;
            continue;
        }
        try {
            await db.collection(doc.collection).updateOne({ _id: doc._id }, { $set: changes });
            updatedDocs++;
            updatedFields += Object.keys(changes).length;
        } catch (e) {
            console.error(`改写失败 ${doc.collection}#${doc._id}: ${e.message}`);
        }
    }

    // ---------- 汇总 ----------
    console.log('================ 汇总 ================');
    console.log(`唯一本地文件   : ${pathOwners.size}`);
    console.log(`TOS 已存在     : ${alreadyOnTos}`);
    console.log(`本次上传       : ${uploadedCount}`);
    console.log(`迁移失败       : ${failures.length}`);
    console.log(`待改写文档     : ${updatedDocs}（字段 ${updatedFields}）`);
    console.log(`模式           : ${opts.write ? '已实际写入' : 'dry-run，未做任何改动'}`);

    if (failures.length > 0) {
        console.log('');
        console.log('以下文件无法从站点抓取（可能已随 Pod 重启永久丢失，需人工替换）：');
        failures.forEach(f => console.log(`  ${f.localPath}   被引用 ${f.refs} 处   ${f.reason}`));
        console.log('提示：这些文件对应的数据库字段保持原样，未被改写。');
    }

    if (!opts.write) {
        console.log('');
        console.log('确认无误后，加 --write 重新执行即可真正迁移。');
    }

    await mongoose.disconnect();
}

main().catch(async (e) => {
    console.error('脚本异常:', e);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
});
