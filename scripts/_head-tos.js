// 临时：查 TOS 对象元数据，确认 ContentDisposition 是否生效
require('dotenv').config();
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

function normalizeTosEndpoint(e) {
  const raw = String(e || '').trim();
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProto.replace('://tos-cn-', '://tos-s3-cn-');
}
function resolveTosSecretAccessKey() {
  const raw = String(process.env.TOS_SECRET_KEY || '').trim();
  if (['1', 'true', 'yes'].includes(String(process.env.TOS_SECRET_KEY_BASE64 || '').toLowerCase())) {
    try { return Buffer.from(raw, 'base64').toString('utf8').trim() || raw; } catch (e) { return raw; }
  }
  return raw;
}

const client = new S3Client({
  region: process.env.TOS_REGION || 'cn-beijing',
  endpoint: normalizeTosEndpoint(process.env.TOS_ENDPOINT || ''),
  credentials: { accessKeyId: process.env.TOS_ACCESS_KEY, secretAccessKey: resolveTosSecretAccessKey() }
});

const key = 'uploads/images/2026/09/7467751191255877307206609384140.webp';

(async () => {
  const r = await client.send(new HeadObjectCommand({ Bucket: process.env.TOS_BUCKET_NAME, Key: key }));
  console.log('ContentType       :', r.ContentType);
  console.log('ContentDisposition:', r.ContentDisposition || '(未设置)');
  console.log('ContentLength     :', r.ContentLength);
  console.log('Metadata          :', JSON.stringify(r.Metadata || {}));
})().catch(e => console.log('ERR:', e.name, '|', e.Code, '|', e.message));
