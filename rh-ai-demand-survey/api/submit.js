/**
 * 问卷提交转发函数（火山引擎 IGA Pages Functions 版，Node.js）
 * 路由：api/submit.js → /api/submit
 * 浏览器 → 本函数 → 钉钉 AI 表格 / 飞书多维表格 / WorkBuddy
 *
 * 在 IGA Pages「项目设置 → 环境变量」中配置（改完需重新部署）：
 *   DINGTALK_WEBHOOK_URL     钉钉 AI 表格自动化「接收到数据时」的 Webhook 地址
 *   DINGTALK_WEBHOOK_TOKEN   （可选）钉钉开启凭证校验后的 Token，不带 Bearer 前缀
 *   FEISHU_WEBHOOK_URL       （可选）飞书多维表格 Webhook 地址
 *   FEISHU_WEBHOOK_TOKEN     （可选）
 *   WORKBUDDY_WEBHOOK_URL    （可选）
 *   WORKBUDDY_WEBHOOK_TOKEN  （可选）
 *   EXTRA_WEBHOOK_URL        （可选）
 *   EXTRA_WEBHOOK_TOKEN      （可选）
 *   PAYLOAD_FORMAT           （可选）默认 netlify：与 Netlify 表单通知同格式 {form_name, data:{dept, q1…}}，
 *                            钉钉按 Netlify 方案配好的触发器无需改动；填 flat 则推送顶层中文键名（= 表格列名）
 */

const TARGETS = ["FEISHU", "DINGTALK", "WORKBUDDY", "EXTRA"];

// 表单字段 → 表格列名（与「表格字段模板.csv」一致）
const FIELDS = [
  ["submission_id", "提交编号", 64],
  ["submitted_at_cn", "提交时间", 32],
  ["dept", "所属部门", 60],
  ["title", "需求名称", 60],
  ["contact", "需求联系人", 60],
  ["q1", "Q1希望AI完成的工作", 2000],
  ["q2", "Q2目前做法", 2000],
  ["q3", "Q3主要痛点", 600],
  ["q4", "Q4发生频率", 20],
  ["q5_count", "Q5每月件数", 12],
  ["q5_minutes", "Q5每件耗时分钟", 12],
  ["q5_people", "Q5参与人数", 12],
  ["q5_hours", "每月耗时小时", 16],
  ["q6", "Q6所需资料系统", 600],
  ["q7", "Q7处理方式", 40],
  ["q8", "Q8出错影响", 40],
  ["q9", "Q9期望效果", 400],
  ["q10", "Q10真实案例", 2000],
  ["attachment_name", "附件", 200],
  ["source", "来源", 20],
];

// 固定值：钉钉 Webhook 触发器的「关键词」填它
const SOURCE_TAG = "AI需求问卷";

const env = (k) => String((globalThis.process && process.env && process.env[k]) || "").trim();

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cnTime(iso) {
  const t = iso && !isNaN(Date.parse(iso)) ? Date.parse(iso) : Date.now();
  return new Date(t + 8 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " "); // 北京时间
}

function uuid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

function buildRecord(input, english) {
  const src = { ...input, submitted_at_cn: cnTime(input.submitted_at), source: SOURCE_TAG };
  if (!src.submission_id) src.submission_id = uuid();
  const out = {};
  for (const [key, label, max] of FIELDS) {
    let v = src[key];
    v = v == null ? "" : String(v).trim().slice(0, max);
    out[english ? key : label] = v;
  }
  return out;
}

async function pushOnce(name, url, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { method: "POST", headers, body, signal: ctrl.signal });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}
    // 钉钉 / 飞书成功时返回 code: 0；其他平台以 HTTP 2xx 为准
    const ok = res.ok && (!data || typeof data.code !== "number" || data.code === 0);
    if (!ok) console.error(`[${name}] HTTP ${res.status} ${text.slice(0, 300)}`);
    return ok;
  } catch (err) {
    console.error(`[${name}] ${err && err.message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function push(name, url, token, record, idemKey) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idemKey) headers["Client-Token"] = idemKey; // 钉钉幂等键：重试也只写入一行
  const body = JSON.stringify(record);
  let ok = await pushOnce(name, url, headers, body);
  if (!ok) { await sleep(800); ok = await pushOnce(name, url, headers, body); } // 失败自动重试一次
  return { name, ok };
}

export async function POST(request) {
  let input;
  try {
    input = await request.json();
  } catch (e) {
    return json(400, { ok: false, error: "bad_json" });
  }
  if (!input || typeof input !== "object") return json(400, { ok: false, error: "bad_body" });
  if (input["bot-field"]) return json(200, { ok: true });
  if (!String(input.dept || "").trim() || !String(input.title || "").trim() || !String(input.q1 || "").trim()) {
    return json(422, { ok: false, error: "missing_required" });
  }

  const flat = env("PAYLOAD_FORMAT").toLowerCase() === "flat";
  const fields = buildRecord(input, !flat);   // netlify 格式用英文键名
  const id = fields["提交编号"] || fields.submission_id;
  const record = flat ? fields : { form_name: "ai-demand", created_at: new Date().toISOString(), data: fields };

  const jobs = TARGETS
    .map((t) => ({ name: t.toLowerCase(), url: env(`${t}_WEBHOOK_URL`), token: env(`${t}_WEBHOOK_TOKEN`) }))
    .filter((t) => /^https?:\/\//i.test(t.url))
    .map((t) => push(t.name, t.url, t.token, record, t.name === "dingtalk" ? id : ""));

  if (!jobs.length) {
    console.error("未配置任何 *_WEBHOOK_URL 环境变量");
    return json(500, { ok: false, error: "no_webhook_configured" });
  }

  const results = await Promise.all(jobs);
  const delivered = results.filter((r) => r.ok).map((r) => r.name);
  const failed = results.filter((r) => !r.ok).map((r) => r.name);
  return json(delivered.length ? 200 : 502, { ok: delivered.length > 0, delivered, failed, id });
}

// 浏览器直接打开 /api/submit 可用来自检：能看到这条 JSON 说明函数已上线，并显示环境变量是否已配置
export async function GET() {
  const configured = TARGETS.filter((t) => /^https?:\/\//i.test(env(`${t}_WEBHOOK_URL`))).map((t) => t.toLowerCase());
  return json(200, { ok: true, service: "ai-demand-survey", webhooks_configured: configured });
}
