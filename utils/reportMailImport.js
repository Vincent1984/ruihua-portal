const zlib = require('node:zlib');
const XLSX = require('xlsx');
const { isEmail } = require('./reportMailTemplate');

const MAX_FILE = 512 * 1024;
function bad(message) { return Object.assign(new Error(message), { status: 400 }); }

// Bound actual inflated bytes before handing the archive to the workbook parser.
function checkWorkbook(buffer) {
    let end = buffer.length - 22;
    const minimum = Math.max(0, end - 65535);
    while (end >= minimum && (buffer.readUInt32LE(end) !== 0x06054b50 || end + 22 + buffer.readUInt16LE(end + 20) !== buffer.length)) end--;
    if (end < minimum) throw bad('只支持有效的单个 .xlsx 文件');
    const entries = buffer.readUInt16LE(end + 10);
    const directoryStart = buffer.readUInt32LE(end + 16);
    if (buffer.readUInt32LE(end + 4) || buffer.readUInt16LE(end + 8) !== entries || directoryStart + buffer.readUInt32LE(end + 12) !== end || entries > 128) throw bad('Excel 文件结构超出支持范围');
    let cursor = directoryStart, total = 0;
    for (let i = 0; i < entries; i++) {
        if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50) throw bad('Excel 文件目录无效');
        const flags = buffer.readUInt16LE(cursor + 8), method = buffer.readUInt16LE(cursor + 10);
        const compressed = buffer.readUInt32LE(cursor + 20), size = buffer.readUInt32LE(cursor + 24);
        const local = buffer.readUInt32LE(cursor + 42);
        if ((flags & 1) || local + 30 > directoryStart || buffer.readUInt32LE(local) !== 0x04034b50 ||
            buffer.readUInt16LE(local + 8) !== method || (method !== 0 && method !== 8) || (total += size) > 4 * 1024 * 1024) throw bad('Excel 文件内容超出支持范围');
        const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
        if (start + compressed > directoryStart) throw bad('Excel 文件内容无效');
        const bytes = buffer.subarray(start, start + compressed);
        try {
            const actual = method === 8 ? zlib.inflateRawSync(bytes, { maxOutputLength: Math.max(1, size) }).length : bytes.length;
            if (actual !== size) throw bad('Excel 文件长度不匹配');
        } catch (_) { throw bad('Excel 文件解压失败或超出大小限制'); }
        cursor += 46 + buffer.readUInt16LE(cursor + 28) + buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32);
    }
    if (cursor !== end) throw bad('Excel 文件目录无效');
}
function readFirstSheet(buffer, { blankrows = false, raw = false, formulas = false } = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 22 || buffer.length > MAX_FILE) throw bad('请选择 512 KB 以内的 .xlsx 文件');
    checkWorkbook(buffer);
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer', sheetRows: 502, cellFormula: formulas, sheetStubs: formulas });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows, raw, ...(blankrows ? { range: 0 } : {}) });
        return { sheet, rows };
    } catch (_) { throw bad('无法读取 Excel 文件'); }
}
function readContacts(buffer) {
    const { rows } = readFirstSheet(buffer);
    if (!rows.length || rows.length > 501) throw bad('Excel 首个工作表须包含表头及最多 500 条数据');
    const header = rows.shift().map(value => String(value || '').trim().toLowerCase());
    const emailIndex = header.findIndex(value => ['邮箱', 'email'].includes(value));
    const nameIndex = header.findIndex(value => ['姓名', 'name'].includes(value));
    if (emailIndex < 0 || !rows.length) throw bad('Excel 须包含“邮箱”列和至少一条数据');
    const seen = new Set();
    return rows.map((row, index) => {
        const email = String(row[emailIndex] || '').trim().toLowerCase();
        const name = String(row[nameIndex] || '').trim().slice(0, 80);
        let error = '';
        if (!isEmail(email)) error = '邮箱格式不正确';
        else if (seen.has(email)) error = '文件中邮箱重复';
        else seen.add(email);
        return { row: index + 2, name, email, error };
    });
}
module.exports = { MAX_FILE, readContacts, readFirstSheet };
