const tk = sessionStorage.getItem('token');
const h = () => ({ Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' });
let tplModal;
let listData = [];
let autosaveTimer = null;
let fieldDragIdx = -1;

function mapType(type) {
  return { hr_forum: 'HR领袖活动论坛', city_salon: '城市沙龙', closed_door: '闭门研讨会' }[type] || type;
}

function esc(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

async function g(url) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tk } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || '请求失败');
  return d;
}

function fieldRows() {
  const rows = Array.from(document.querySelectorAll('#fieldBody tr')).map((tr, idx) => ({
    key: tr.querySelector('.f-key').value.trim(),
    label: tr.querySelector('.f-label').value.trim(),
    type: tr.querySelector('.f-type').value,
    required: tr.querySelector('.f-required').checked,
    placeholder: tr.querySelector('.f-placeholder').value.trim(),
    validation: {
      pattern: tr.querySelector('.f-pattern').value.trim(),
      minLength: Number(tr.querySelector('.f-min').value || 0),
      maxLength: Number(tr.querySelector('.f-max').value || 200)
    },
    sort: idx + 1
  }));
  return rows.filter(r => r.key && r.label);
}

function addFieldRow(data = {}) {
  const tr = document.createElement('tr');
  tr.draggable = true;
  tr.innerHTML = `
    <td><input class="form-control form-control-sm f-key" value="${esc(data.key || '')}"></td>
    <td><input class="form-control form-control-sm f-label" value="${esc(data.label || '')}"></td>
    <td><select class="form-select form-select-sm f-type"><option value="text">text</option><option value="phone">phone</option><option value="email">email</option><option value="textarea">textarea</option><option value="smsCode">smsCode</option><option value="select">select</option></select></td>
    <td class="text-center"><input type="checkbox" class="form-check-input f-required" ${data.required ? 'checked' : ''}></td>
    <td><div class="d-flex gap-1"><input class="form-control form-control-sm f-pattern" placeholder="正则" value="${esc(data.validation?.pattern || '')}"><input class="form-control form-control-sm f-min" type="number" placeholder="min" value="${data.validation?.minLength ?? 0}"><input class="form-control form-control-sm f-max" type="number" placeholder="max" value="${data.validation?.maxLength ?? 200}"></div><input class="form-control form-control-sm f-placeholder mt-1" placeholder="placeholder" value="${esc(data.placeholder || '')}"></td>
    <td><button class="btn btn-sm btn-outline-danger btn-del-field">删除</button></td>`;
  tr.querySelector('.f-type').value = data.type || 'text';
  tr.addEventListener('dragstart', () => { fieldDragIdx = Array.from(tr.parentElement.children).indexOf(tr); });
  tr.addEventListener('dragover', e => e.preventDefault());
  tr.addEventListener('drop', e => {
    e.preventDefault();
    const toIdx = Array.from(tr.parentElement.children).indexOf(tr);
    const tbody = tr.parentElement;
    const items = Array.from(tbody.children);
    if (fieldDragIdx < 0 || toIdx < 0 || fieldDragIdx === toIdx) return;
    const moving = items[fieldDragIdx];
    if (fieldDragIdx < toIdx) tbody.insertBefore(moving, tr.nextSibling);
    else tbody.insertBefore(moving, tr);
  });
  tr.querySelector('.btn-del-field').addEventListener('click', () => tr.remove());
  document.getElementById('fieldBody').appendChild(tr);
}

function resetEditor() {
  document.getElementById('tplId').value = '';
  document.getElementById('tplName').value = '';
  document.getElementById('tplType').value = 'hr_forum';
  document.getElementById('tplStatus').value = 'enabled';
  document.getElementById('tplScene').value = '';
  document.getElementById('uiPageTitle').value = '';
  document.getElementById('uiIntro').value = '';
  document.getElementById('uiNotice').value = '';
  document.getElementById('uiBgImg').value = '';
  document.getElementById('uiLogo').value = '';
  document.getElementById('uiBgStart').value = '#8b5cff';
  document.getElementById('uiBgEnd').value = '#6f42ff';
  document.getElementById('uiBtnStart').value = '#8a54ff';
  document.getElementById('uiBtnEnd').value = '#5a26ff';
  document.getElementById('uiSuccessMsg').value = '报名成功！后续将通过短信/邮件发放参会邀请函。';
  document.getElementById('uiSuccessRedirect').value = '';
  document.getElementById('fieldBody').innerHTML = '';
  addFieldRow({ key: 'name', label: '姓名', type: 'text', required: true });
  addFieldRow({ key: 'phone', label: '电话', type: 'phone', required: true, validation: { pattern: '^1[3-9]\\d{9}$', minLength: 11, maxLength: 11 } });
  addFieldRow({ key: 'smsCode', label: '短信验证码', type: 'smsCode', required: true });
  addFieldRow({ key: 'company', label: '公司名称', type: 'text', required: true });
}

function payload() {
  return {
    name: document.getElementById('tplName').value.trim(),
    activityType: document.getElementById('tplType').value,
    status: document.getElementById('tplStatus').value,
    sceneDescription: document.getElementById('tplScene').value.trim(),
    formSchema: fieldRows(),
    uiConfig: {
      pageTitle: document.getElementById('uiPageTitle').value.trim(),
      activityIntro: document.getElementById('uiIntro').value.trim(),
      noticeText: document.getElementById('uiNotice').value.trim(),
      backgroundImage: document.getElementById('uiBgImg').value.trim(),
      logoImage: document.getElementById('uiLogo').value.trim(),
      colors: {
        bgStart: document.getElementById('uiBgStart').value,
        bgEnd: document.getElementById('uiBgEnd').value,
        buttonStart: document.getElementById('uiBtnStart').value,
        buttonEnd: document.getElementById('uiBtnEnd').value
      },
      successMessage: document.getElementById('uiSuccessMsg').value.trim(),
      successRedirect: document.getElementById('uiSuccessRedirect').value.trim()
    }
  };
}

async function loadList() {
  const params = new URLSearchParams({
    keyword: document.getElementById('qKeyword').value.trim(),
    activityType: document.getElementById('qType').value,
    status: document.getElementById('qStatus').value,
    limit: '100'
  });
  const res = await g('/api/activity-template/list?' + params.toString());
  listData = res.data || [];
  document.getElementById('tplBody').innerHTML = listData.map(t => `<tr>
    <td>${esc(t.name)}</td><td>${mapType(t.activityType)}</td><td>${t.status === 'enabled' ? '<span class="badge text-bg-success">启用</span>' : '<span class="badge text-bg-secondary">禁用</span>'}</td><td>v${t.version || 1}</td><td>${esc(t.sceneDescription || '')}</td>
    <td>
      <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditTpl('${t._id}')">编辑</button>
      <button class="btn btn-sm btn-outline-secondary me-1" onclick="cloneTpl('${t._id}')">克隆</button>
      <button class="btn btn-sm btn-outline-info me-1" onclick="versionsTpl('${t._id}')">版本</button>
      <button class="btn btn-sm btn-outline-success me-1" onclick="exportTpl('${t._id}','xlsx')">导出</button>
      <button class="btn btn-sm btn-outline-danger" onclick="deleteTpl('${t._id}')">删除</button>
    </td>
  </tr>`).join('');
}

async function openEditTpl(id) {
  const res = await g('/api/activity-template/' + id);
  const t = res.data;
  resetEditor();
  document.getElementById('tplId').value = t._id;
  document.getElementById('tplName').value = t.name || '';
  document.getElementById('tplType').value = t.activityType || 'hr_forum';
  document.getElementById('tplStatus').value = t.status || 'enabled';
  document.getElementById('tplScene').value = t.sceneDescription || '';
  document.getElementById('uiPageTitle').value = t.uiConfig?.pageTitle || '';
  document.getElementById('uiIntro').value = t.uiConfig?.activityIntro || '';
  document.getElementById('uiNotice').value = t.uiConfig?.noticeText || '';
  document.getElementById('uiBgImg').value = t.uiConfig?.backgroundImage || '';
  document.getElementById('uiLogo').value = t.uiConfig?.logoImage || '';
  document.getElementById('uiBgStart').value = t.uiConfig?.colors?.bgStart || '#8b5cff';
  document.getElementById('uiBgEnd').value = t.uiConfig?.colors?.bgEnd || '#6f42ff';
  document.getElementById('uiBtnStart').value = t.uiConfig?.colors?.buttonStart || '#8a54ff';
  document.getElementById('uiBtnEnd').value = t.uiConfig?.colors?.buttonEnd || '#5a26ff';
  document.getElementById('uiSuccessMsg').value = t.uiConfig?.successMessage || '';
  document.getElementById('uiSuccessRedirect').value = t.uiConfig?.successRedirect || '';
  document.getElementById('fieldBody').innerHTML = '';
  (t.formSchema || []).sort((a, b) => (a.sort || 0) - (b.sort || 0)).forEach(addFieldRow);
  tplModal.show();
}

async function saveTpl() {
  const id = document.getElementById('tplId').value;
  const body = payload();
  if (!body.name || !body.formSchema.length) return alert('请填写模板名称并至少配置一个字段');
  const url = id ? '/api/activity-template/' + id : '/api/activity-template';
  const method = id ? 'PUT' : 'POST';
  const r = await fetch(url, { method, headers: h(), body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) return alert(d.error || '保存失败');
  tplModal.hide();
  await loadList();
}

async function autosaveTpl() {
  const id = document.getElementById('tplId').value;
  if (!id) return;
  await fetch('/api/activity-template/' + id + '/autosave', { method: 'PUT', headers: h(), body: JSON.stringify(payload()) });
}

async function cloneTpl(id) {
  const r = await fetch('/api/activity-template/' + id + '/clone', { method: 'POST', headers: h() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) return alert(d.error || '克隆失败');
  await loadList();
}

async function versionsTpl(id) {
  const r = await g('/api/activity-template/' + id + '/versions');
  const list = r.data || [];
  const v = prompt('输入要回滚的版本号：\n' + list.map(i => `v${i.version} ${new Date(i.createdAt).toLocaleString('zh-CN')} ${i.operator || ''}`).join('\n'));
  if (!v) return;
  const rr = await fetch('/api/activity-template/' + id + '/rollback/' + encodeURIComponent(v), { method: 'POST', headers: h() });
  const d = await rr.json().catch(() => ({}));
  if (!rr.ok || !d.success) return alert(d.error || '回滚失败');
  await loadList();
}

async function deleteTpl(id) {
  if (!confirm('确认删除模板？')) return;
  const r = await fetch('/api/activity-template/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tk } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) return alert(d.error || '删除失败');
  await loadList();
}

async function exportTpl(id, format) {
  const r = await fetch('/api/activity-template/' + id + '/export?format=' + format, { headers: { Authorization: 'Bearer ' + tk } });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    return alert(d.error || '导出失败');
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = format === 'csv' ? 'template_stats.csv' : 'template_stats.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!tk) return location.href = '/admin/index.html';
  tplModal = new bootstrap.Modal(document.getElementById('tplModal'));
  resetEditor();
  await loadList();
  document.getElementById('btnSearchTpl').addEventListener('click', loadList);
  document.getElementById('btnNewTemplate').addEventListener('click', () => { resetEditor(); tplModal.show(); });
  document.getElementById('btnAddField').addEventListener('click', () => addFieldRow({ key: '', label: '', type: 'text', required: false }));
  document.getElementById('btnSaveTpl').addEventListener('click', saveTpl);
  document.getElementById('btnAutosave').addEventListener('click', autosaveTpl);
  document.getElementById('tplModal').addEventListener('input', () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => autosaveTpl().catch(() => {}), 1200);
  });
});

window.openEditTpl = openEditTpl;
window.cloneTpl = cloneTpl;
window.versionsTpl = versionsTpl;
window.deleteTpl = deleteTpl;
window.exportTpl = exportTpl;
