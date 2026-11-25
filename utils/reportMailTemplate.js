const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i;
const KEYS = new Set(['姓名', '活动名称', '报告名称', '下载链接', '有效期']);
const token = /\{\{([^{}]+)\}\}/g;
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
function isEmail(value) {
    return typeof value === 'string' && value.length <= 254 && EMAIL.test(value);
}
function templateFields(input = {}) {
    const limits = { name: 80, subject: 160, preheader: 160, body: 3000, button: 48, signature: 200, replyTo: 254 };
    const fields = {};
    for (const [key, limit] of Object.entries(limits)) {
        const value = input[key] ?? '';
        if (typeof value !== 'string' || value.length > limit || (['subject', 'replyTo'].includes(key) && /[\r\n]/.test(value))) {
            throw Object.assign(new Error('模板字段格式或长度不正确'), { status: 400 });
        }
        fields[key] = value.trim();
    }
    const variables = [fields.subject, fields.preheader, fields.body].flatMap(value => [...value.matchAll(token)].map(match => match[1]));
    if (!fields.name || !fields.subject || !fields.body.includes('{{下载链接}}') || !fields.button ||
        fields.subject.includes('{{下载链接}}') || fields.preheader.includes('{{下载链接}}') ||
        (fields.body.match(/\{\{下载链接\}\}/g) || []).length !== 1 ||
        variables.some(key => !KEYS.has(key)) || (fields.replyTo && !isEmail(fields.replyTo))) {
        throw Object.assign(new Error('请填写名称、主题、正文和按钮，正文须包含一个 {{下载链接}}，变量须使用系统提供的名称'), { status: 400 });
    }
    return fields;
}
function renderTemplate(template, lead, reportTitle, link) {
    const variables = { 姓名: lead.name || '您好', 活动名称: lead.sourceLabel || '瑞华智策', 报告名称: reportTitle, 下载链接: link, 有效期: '7 天' };
    const render = text => String(text || '').replace(token, (_, key) => variables[key] || '');
    const body = render(template.body.split('{{下载链接}}')[0]);
    const tail = render(template.body.split('{{下载链接}}')[1]);
    const htmlText = value => escape(value).replace(/\n/g, '<br>');
    const button = link.startsWith('https://')
        ? `<a href="${escape(link)}" style="padding:12px;background:#18274a;color:#fff">${escape(template.button)}</a>`
        : escape(link);
    return {
        subject: render(template.subject).replace(/[\r\n]/g, ' '),
        text: [render(template.preheader), body, link, tail, template.signature].filter(Boolean).join('\n\n'),
        html: `<div style="font-family:Arial,sans-serif;line-height:1.8"><p>${htmlText(render(template.preheader))}</p><p>${htmlText(body)}</p><p>${button}</p><p>${htmlText(tail)}</p><p>${htmlText(template.signature || '')}</p></div>`,
        ...(template.replyTo ? { replyTo: template.replyTo } : {})
    };
}
module.exports = { isEmail, templateFields, renderTemplate };
