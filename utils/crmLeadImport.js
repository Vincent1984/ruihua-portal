const { createHash, createHmac, timingSafeEqual, randomUUID } = require('node:crypto');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { readFirstSheet, MAX_FILE } = require('./reportMailImport');
const { Contact, Event, Sync } = require('../models/crm');
const { text, phoneKey, emailKey, ingest } = require('./crmIntake');

const MAX_ROWS = 500;
const COLUMNS = [
    ['name', '姓名', 100], ['phone', '手机号', 32], ['email', '邮箱', 254], ['company', '公司', 160],
    ['position', '职位', 100], ['department', '部门', 100], ['summary', '需求摘要', 2000],
    ['tags', '标签', 500], ['nextStep', '下一步', 500], ['nextAt', '下次跟进时间', 16]
];
const SOURCES = { manual: '日常录入', event: '线下活动', referral: '转介绍', inbound: '来电 / 来访' };
const error = (message, status = 400) => Object.assign(new Error(message), { status });
const digest = value => createHash('sha256').update(value).digest('hex');
const tokenLifetime = 30 * 60 * 1000;

function followUp(value) {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) throw error('下次跟进时间格式为 YYYY-MM-DD HH:mm');
    const date = new Date(value.replace(' ', 'T') + ':00+08:00');
    if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ') !== value) {
        throw error('下次跟进时间无效');
    }
    return date;
}

function readLeads(buffer) {
    const { sheet, rows } = readFirstSheet(buffer, { blankrows: true, formulas: true });
    if (!rows.length || rows.length > MAX_ROWS + 1) throw error('首个工作表须包含表头及最多 500 行数据，表头必须在第 1 行');
    const headers = rows.shift().map(value => String(value ?? '').trim());
    const indexes = COLUMNS.map(([, title]) => headers.indexOf(title));
    if (indexes[0] < 0 || (indexes[1] < 0 && indexes[2] < 0)) throw error('首行需有「姓名」列，并包含「手机号」或「邮箱」列');
    if (COLUMNS.some(([, title]) => headers.indexOf(title) !== headers.lastIndexOf(title))) throw error('导入表头中有重复列');
    const parsed = rows.flatMap((row, index) => {
        const line = index + 2;
        const values = indexes.map(idx => String(row[idx] ?? '').trim());
        const formula = indexes.some(idx => idx >= 0 && sheet[XLSX.utils.encode_cell({ r: line - 1, c: idx })]?.f);
        if (!values.some(Boolean) && !formula) return [];
        const data = Object.fromEntries(COLUMNS.map(([key, , limit], column) => [key, values[column].slice(0, limit)]));
        let issue = '';
        const tooLong = COLUMNS.findIndex(([, , limit], column) => values[column].length > limit);
        const phone = phoneKey(data.phone), email = emailKey(data.email);
        if (formula) issue = '请将公式转换为值后导入';
        else if (tooLong >= 0) issue = COLUMNS[tooLong][1] + '超出长度限制';
        else if (!data.name) issue = '缺少姓名';
        else if ((data.phone && !phone) || (data.email && !email)) issue = '手机号或邮箱格式不正确';
        else if (!phone && !email) issue = '手机号和邮箱至少填写一项';
        else {
            try { data.nextAt = followUp(data.nextAt); }
            catch (err) { issue = err.message; }
        }
        data.phone = phone;
        data.email = email;
        data.tags = [...new Set(data.tags.split(/[,，]/).map(tag => text(tag, 32)).filter(Boolean))].slice(0, 15);
        return [{ line, data, issue }];
    });
    if (!parsed.length) throw error('Excel 中没有可预览的数据');
    return parsed;
}

function readBatch(buffer, body) {
    const source = body.source;
    const label = text(body.label, 81);
    if (!Object.hasOwn(SOURCES, source) || !label || label.length > 80) throw error('请填写批次名称并选择线索来源');
    const rows = readLeads(buffer);
    const fingerprint = digest(JSON.stringify([source, label]));
    for (const row of rows) {
        if (!row.issue) row.key = 'excel:' + fingerprint + ':' + digest(JSON.stringify([row.data.phone, row.data.email]));
    }
    return { source, label, rows, fingerprint };
}

async function classify(batch, canLink) {
    const candidates = batch.rows.filter(row => !row.issue);
    const contacts = await Contact.find({ $or: [
        { phoneKey: { $in: candidates.map(row => row.data.phone).filter(Boolean) } },
        { emailKey: { $in: candidates.map(row => row.data.email).filter(Boolean) } }
    ] }).select('phoneKey emailKey mergedInto archivedAt ownerId').lean();
    const aliases = contacts.map(contact => contact.mergedInto).filter(Boolean);
    const canonical = aliases.length ? await Contact.find({ _id: { $in: aliases } }).select('archivedAt ownerId').lean() : [];
    const canonicalMap = new Map(canonical.map(contact => [String(contact._id), contact]));
    const phones = new Map(), emails = new Map(), seen = new Set();
    for (const row of contacts) {
        const contact = row.mergedInto ? canonicalMap.get(String(row.mergedInto)) || row : row;
        if (row.phoneKey) phones.set(row.phoneKey, contact);
        if (row.emailKey) emails.set(row.emailKey, contact);
    }
    const imported = new Set((await Event.find({ _id: { $in: candidates.map(row => batch.source + ':' + row.key) } }).select('_id').lean()).map(row => row._id));
    return batch.rows.map(row => {
        const { phone, email } = row.data;
        const result = { line: row.line, name: row.data.name, phone, email, company: row.data.company };
        if (row.issue) return { ...result, status: 'skipped', message: row.issue };
        const byPhone = phones.get(phone), byEmail = emails.get(email);
        if (byPhone && byEmail && String(byPhone._id) !== String(byEmail._id)) return { ...result, status: 'skipped', message: '手机号和邮箱对应不同联系人，请人工核对' };
        const contact = byPhone || byEmail;
        const keys = [phone && 'p:' + phone, email && 'e:' + email, contact && 'c:' + contact._id].filter(Boolean);
        if (imported.has(batch.source + ':' + row.key)) {
            keys.forEach(key => seen.add(key));
            return { ...result, status: 'already', message: '此批次的该行已导入' };
        }
        if (contact && (contact.archivedAt || !canLink(contact))) return { ...result, status: 'skipped', message: '匹配到暂不可关联的档案，请由管理员核对' };
        if (keys.some(key => seen.has(key))) return { ...result, status: 'skipped', message: '同一文件中联系方式重复' };
        keys.forEach(key => seen.add(key));
        return { ...result, status: contact ? 'linked' : 'new', message: contact ? '关联已有联系人并录入线索' : '新建联系人并录入线索' };
    });
}

function sign(payload, secret) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', secret).update(encoded).digest('hex');
    return encoded + '.' + signature;
}
function approvedRows(token, expected, secret) {
    if (typeof token !== 'string' || token.length > 8192) throw error('请先预览 Excel');
    const parts = token.split('.');
    const [encoded, signature] = parts;
    if (parts.length !== 2 || !/^[a-f0-9]{64}$/.test(signature)) throw error('预览记录无效，请重新预览');
    const correct = createHmac('sha256', secret).update(encoded).digest();
    if (!timingSafeEqual(Buffer.from(signature, 'hex'), correct)) throw error('预览记录无效，请重新预览');
    let payload;
    try { payload = JSON.parse(Buffer.from(encoded, 'base64url')); }
    catch (_) { throw error('预览记录无效，请重新预览'); }
    if (payload.expires < Date.now() || Object.keys(expected).some(key => payload[key] !== expected[key]) || !Array.isArray(payload.allowed)) {
        throw error('预览已过期或文件、来源、批次名称已变更，请重新预览');
    }
    return new Set(payload.allowed);
}
function snapshot(buffer, batch, actorId) {
    return { hash: digest(buffer), source: batch.source, label: batch.label, actorId: String(actorId) };
}
async function preview(buffer, body, { actorId, canLink, secret }) {
    const batch = readBatch(buffer, body);
    const rows = await classify(batch, canLink);
    const allowed = rows.filter(row => ['new', 'linked'].includes(row.status)).map(row => row.line);
    return {
        rows, ready: allowed.length,
        token: sign({ ...snapshot(buffer, batch, actorId), allowed, expires: Date.now() + tokenLifetime }, secret)
    };
}

async function confirm(buffer, body, { actorId, canLink, secret }) {
    const batch = readBatch(buffer, body);
    const allowed = approvedRows(body.previewToken, snapshot(buffer, batch, actorId), secret);
    if (!allowed.size) throw error('此批没有可导入的记录');
    const lockId = 'import:' + batch.fingerprint, leaseToken = randomUUID();
    await Sync.updateOne({ _id: lockId }, { $setOnInsert: { leaseUntil: new Date(0) } }, { upsert: true });
    if (!await Sync.findOneAndUpdate({ _id: lockId, leaseUntil: { $lte: new Date() } }, {
        leaseUntil: new Date(Date.now() + 120000), leaseToken
    })) throw error('该批次正在导入，请稍后重试', 409);
    try {
        const latest = await classify(batch, canLink);
        const source = { key: batch.source, title: 'Excel 导入 · ' + batch.label, map: row => row };
        const importRow = async (row, index) => {
            const result = latest[index];
            if (result.status === 'already' || result.status === 'skipped') return result;
            if (!allowed.has(row.line)) return { ...result, status: 'skipped', message: '该行未通过本次预览，请重新预览' };
            try {
                await ingest(source, { ...row.data, _id: row.key }, {
                    manual: true, ownerId: actorId, canLink, requireContact: true
                });
                return { ...result, status: 'imported', message: result.status === 'linked' ? '已录入，关联已有联系人' : '已录入' };
            } catch (err) {
                if (!err.status) console.error('[CRM Excel import]', err.code || err.name);
                return { ...result, status: err.status ? 'skipped' : 'failed', message: err.status ? err.message : '写入失败，可用原文件和批次重试' };
            }
        };
        const rows = [];
        for (let offset = 0; offset < batch.rows.length; offset += 4) {
            rows.push(...await Promise.all(batch.rows.slice(offset, offset + 4).map((row, index) => importRow(row, offset + index))));
        }
        return { label: batch.label, rows, imported: rows.filter(row => row.status === 'imported').length,
            already: rows.filter(row => row.status === 'already').length, failed: rows.filter(row => row.status === 'failed').length,
            skipped: rows.filter(row => row.status === 'skipped').length };
    } finally {
        await Sync.deleteOne({ _id: lockId, leaseToken });
    }
}

async function template() {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('线索');
    sheet.columns = COLUMNS.map(([key, header]) => ({ key, header, width: key === 'summary' ? 36 : 20, style: { numFmt: '@' } }));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const notes = book.addWorksheet('填写说明');
    notes.getColumn(1).width = 85;
    notes.addRows([
        ['请在「线索」工作表填写，每份最多 500 行，文件不超过 512 KB。'],
        ['姓名必填，手机号和邮箱至少填一项，其他列可留空。'],
        ['下次跟进时间按北京时间填写，例如 2026-12-01 14:30。'],
        ['多个标签用逗号分隔。上传前请将公式转换为值。']
    ]);
    return book.xlsx.writeBuffer();
}

module.exports = { MAX_FILE, MAX_ROWS, SOURCES, readLeads, preview, confirm, template };
