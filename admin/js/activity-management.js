const token = sessionStorage.getItem('token');
const authHeaders = () => ({ Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' });

let channels = [];
let activities = [];
let templates = [];
let activityModal;
let channelLinksModal;
let channelManageModal;
let regEditModal;

function esc(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

async function apiGet(url) {
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

async function initBaseData() {
  const [chRes, tplRes] = await Promise.all([
    apiGet('/api/activity/channels'),
    apiGet('/api/activity-template/options')
  ]);
  channels = chRes.data || [];
  templates = tplRes.data || [];
  document.getElementById('aTemplate').innerHTML = templates.map(t => `<option value="${t._id}" data-type="${esc(t.activityType || '')}">${esc(t.name)}</option>`).join('');
  document.getElementById('rChannel').innerHTML = `<option value="">全部渠道</option>` + channels.map(c => `<option value="${c._id}">${esc(c.name)}</option>`).join('');
  document.getElementById('channelQuickTabs').innerHTML = `<button class="btn btn-sm btn-outline-primary me-1 mb-1" onclick="quickChannel('')">全部</button>` +
    channels.map(c => `<button class="btn btn-sm btn-outline-secondary me-1 mb-1" onclick="quickChannel('${c._id}')">${esc(c.name)}</button>`).join('');
}

async function loadChannelManageList() {
  const res = await apiGet('/api/activity/channels/all');
  const list = res.data || [];
  document.getElementById('channelManageBody').innerHTML = list.map(c => `<tr>
    <td>${esc(c.name)}</td>
    <td>${esc(c.code)}</td>
    <td>${c.sort ?? 0}</td>
    <td>${c.isActive ? '<span class="badge text-bg-success">启用</span>' : '<span class="badge text-bg-secondary">停用</span>'}</td>
    <td>
      <button class="btn btn-sm btn-outline-primary me-1" data-id="${c._id}" data-name="${encodeURIComponent(c.name || '')}" data-code="${encodeURIComponent(c.code || '')}" data-sort="${c.sort ?? 0}" onclick="editChannelFromBtn(this)">编辑</button>
      <button class="btn btn-sm btn-outline-danger" onclick="deleteChannel('${c._id}')">删除</button>
    </td>
  </tr>`).join('');
}

function resetChannelForm() {
  document.getElementById('channelId').value = '';
  document.getElementById('channelName').value = '';
  document.getElementById('channelCode').value = '';
  document.getElementById('channelSort').value = '';
  document.getElementById('btnSaveChannel').textContent = '新增渠道';
}

function editChannel(id, name, code, sort, isActive) {
  document.getElementById('channelId').value = id;
  document.getElementById('channelName').value = name || '';
  document.getElementById('channelCode').value = code || '';
  document.getElementById('channelSort').value = sort || 0;
  document.getElementById('btnSaveChannel').textContent = '保存修改';
}

function editChannelFromBtn(btn) {
  const id = btn.getAttribute('data-id') || '';
  const name = decodeURIComponent(btn.getAttribute('data-name') || '');
  const code = decodeURIComponent(btn.getAttribute('data-code') || '');
  const sort = btn.getAttribute('data-sort') || '0';
  editChannel(id, name, code, sort, '1');
}

async function saveChannel() {
  const id = document.getElementById('channelId').value;
  const name = document.getElementById('channelName').value.trim();
  const code = document.getElementById('channelCode').value.trim();
  const sort = document.getElementById('channelSort').value.trim();
  if (!name) return alert('请输入渠道名称');
  const payload = {
    name,
    code: code || undefined,
    sort: sort === '' ? 0 : Number(sort)
  };
  const url = id ? '/api/activity/channels/' + id : '/api/activity/channels';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) return alert(data.error || '保存渠道失败');
  resetChannelForm();
  await loadChannelManageList();
  await initBaseData();
  renderChannelCheckboxes(channels.map(c => c._id));
}

async function deleteChannel(id) {
  if (!confirm('确定删除该渠道吗？')) return;
  const res = await fetch('/api/activity/channels/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) return alert(data.error || '删除失败');
  await loadChannelManageList();
  await initBaseData();
  renderChannelCheckboxes(channels.map(c => c._id));
}

function quickChannel(id) {
  document.getElementById('rChannel').value = id;
  loadRegistrations();
}

async function loadActivities() {
  const params = new URLSearchParams({
    month: document.getElementById('fMonth').value.trim(),
    theme: document.getElementById('fTheme').value.trim(),
    city: document.getElementById('fCity').value.trim(),
    location: document.getElementById('fLocation').value.trim(),
    organizer: document.getElementById('fOrganizer').value.trim(),
    limit: '100'
  });
  const res = await apiGet('/api/activity/list?' + params.toString());
  activities = res.data || [];
  document.getElementById('rActivity').innerHTML = `<option value="">全部活动</option>` + activities.map(a => `<option value="${a._id}">${esc(a.theme)}【${esc(a.city)}】</option>`).join('');
  document.getElementById('activityTableBody').innerHTML = activities.map(a => {
    const channelsHtml = (a.channels || []).map(c => `<span class="badge text-bg-light border badge-channel">${esc(c.name)}</span>`).join('');
    return `<tr>
      <td><div class="fw-semibold">${esc(a.theme)}</div><div class="text-secondary small text-truncate" style="max-width:420px">${esc((a.content || '').replace(/<[^>]+>/g, ''))}</div></td>
      <td><div>${esc(a.city)} · ${esc(a.month)}</div><div class="text-secondary small">${esc(a.eventTime)} | ${esc(a.location)}</div><div class="text-secondary small">筹办人：${esc(a.organizer)}</div></td>
      <td>${channelsHtml || '-'}</td>
      <td>${esc(a.templateName)}</td>
      <td><span class="badge text-bg-primary">${a.registrationCount || 0}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="openEdit('${a._id}')">编辑</button>
        <button class="btn btn-sm btn-outline-info" onclick="openLinks('${a._id}')">渠道管理</button>
      </td>
    </tr>`;
  }).join('');
}

function renderChannelCheckboxes(selected = []) {
  const selectedSet = new Set((selected || []).map(i => String(i)));
  document.getElementById('aChannels').innerHTML = channels.map(c => {
    const checked = selectedSet.has(String(c._id)) ? 'checked' : '';
    return `<div class="form-check">
      <input class="form-check-input" type="checkbox" value="${c._id}" id="ch_${c._id}" ${checked}>
      <label class="form-check-label" for="ch_${c._id}">${esc(c.name)}</label>
    </div>`;
  }).join('');
}

function resetForm() {
  ['aId', 'aTheme', 'aCity', 'aMonth', 'aEventTime', 'aLocation', 'aDeadline', 'aOrganizer', 'aOrganizerContact', 'aContent', 'aHeroImage'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('aBgStart').value = '#8b5cff';
  document.getElementById('aBgEnd').value = '#6f42ff';
  document.getElementById('aTitleColor').value = '#ffffff';
  document.getElementById('aPanelOpacity').value = '0.06';
  document.getElementById('aButtonStart').value = '#8a54ff';
  document.getElementById('aButtonEnd').value = '#5a26ff';
  if (templates.length) document.getElementById('aTemplate').value = templates[0]._id;
  document.getElementById('aActivityType').value = 'hr_forum';
  renderChannelCheckboxes(channels.map(c => c._id));
}

function openCreate() {
  resetForm();
  document.getElementById('activityModalTitle').textContent = '新增活动';
  activityModal.show();
}

async function openEdit(id) {
  const res = await apiGet('/api/activity/' + id);
  const a = res.data;
  document.getElementById('activityModalTitle').textContent = '编辑活动';
  document.getElementById('aId').value = a._id;
  document.getElementById('aTheme').value = a.theme || '';
  document.getElementById('aCity').value = a.city || '';
  document.getElementById('aMonth').value = a.month || '';
  document.getElementById('aEventTime').value = a.eventTime || '';
  document.getElementById('aLocation').value = a.location || '';
  const d = a.registrationDeadline ? new Date(a.registrationDeadline) : null;
  if (d) {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('aDeadline').value = local;
  }
  document.getElementById('aOrganizer').value = a.organizer || '';
  document.getElementById('aOrganizerContact').value = a.organizerContact || '';
  document.getElementById('aContent').value = a.content || '';
  document.getElementById('aHeroImage').value = a.styleConfig?.heroImage || '';
  document.getElementById('aBgStart').value = a.styleConfig?.bgStart || '#8b5cff';
  document.getElementById('aBgEnd').value = a.styleConfig?.bgEnd || '#6f42ff';
  document.getElementById('aTitleColor').value = a.styleConfig?.titleColor || '#ffffff';
  document.getElementById('aPanelOpacity').value = String(a.styleConfig?.panelOpacity ?? 0.06);
  document.getElementById('aButtonStart').value = a.styleConfig?.buttonStart || '#8a54ff';
  document.getElementById('aButtonEnd').value = a.styleConfig?.buttonEnd || '#5a26ff';
  document.getElementById('aTemplate').value = a.templateId || (templates[0]?._id || '');
  document.getElementById('aActivityType').value = a.activityType || 'hr_forum';
  renderChannelCheckboxes(a.channels?.map(i => i._id || i) || []);
  activityModal.show();
}

async function saveActivity() {
  const id = document.getElementById('aId').value;
  let selectedChannels = Array.from(document.querySelectorAll('#aChannels input:checked')).map(i => i.value);
  if (!selectedChannels.length && channels.length) {
    const first = document.querySelector('#aChannels input');
    if (first) {
      first.checked = true;
      selectedChannels = [first.value];
    }
  }
  const deadlineRaw = document.getElementById('aDeadline').value;
  const deadlineIso = deadlineRaw ? new Date(deadlineRaw).toISOString() : '';
  const payload = {
    theme: document.getElementById('aTheme').value.trim(),
    city: document.getElementById('aCity').value.trim(),
    month: document.getElementById('aMonth').value.trim(),
    eventTime: document.getElementById('aEventTime').value.trim(),
    location: document.getElementById('aLocation').value.trim(),
    content: document.getElementById('aContent').value,
    registrationDeadline: deadlineIso,
    organizer: document.getElementById('aOrganizer').value.trim(),
    organizerContact: document.getElementById('aOrganizerContact').value.trim(),
    templateId: document.getElementById('aTemplate').value,
    templateName: document.getElementById('aTemplate').selectedOptions[0]?.textContent || '',
    activityType: document.getElementById('aActivityType').value,
    styleConfig: {
      heroImage: document.getElementById('aHeroImage').value.trim(),
      bgStart: document.getElementById('aBgStart').value,
      bgEnd: document.getElementById('aBgEnd').value,
      titleColor: document.getElementById('aTitleColor').value,
      panelOpacity: Number(document.getElementById('aPanelOpacity').value),
      buttonStart: document.getElementById('aButtonStart').value,
      buttonEnd: document.getElementById('aButtonEnd').value
    },
    channels: selectedChannels
  };
  if (!payload.theme) return alert('请填写活动主题');
  if (!payload.city) return alert('请填写活动城市');
  if (!payload.month) return alert('请填写活动月份');
  if (!payload.eventTime) return alert('请填写活动时间');
  if (!payload.location) return alert('请填写活动地点');
  if (!payload.registrationDeadline || Number.isNaN(new Date(payload.registrationDeadline).getTime())) return alert('请填写有效的报名截止日期');
  if (!payload.organizer) return alert('请填写筹办人');
  if (!selectedChannels.length) {
    if (!channels.length) return alert('渠道列表未加载，请刷新页面后重试');
    return alert('请至少选择一个渠道');
  }
  if (new Date(payload.registrationDeadline).getTime() < Date.now() - 60 * 1000) {
    return alert('报名截止日期不能早于当前时间');
  }
  if (payload.organizerContact && !/^[0-9+\-\s()]{6,30}$/.test(payload.organizerContact)) {
    return alert('筹办人联系方式格式不正确');
  }
  if (payload.content && payload.content.length > 10000) {
    return alert('活动内容过长，请控制在10000字符内');
  }
  if (!id && !payload.templateId) {
    return alert('请选择报名模板');
  }
  if (payload.templateName && payload.templateName.length > 100) {
    return alert('模板名称过长');
  }
  if (!payload.templateName && templates.length) {
    payload.templateName = templates[0].name;
    payload.templateId = templates[0]._id;
  }
  if (!payload.templateName || !payload.templateId) {
    alert('请完整填写活动信息并至少选择一个渠道');
    return;
  }
  const url = id ? '/api/activity/' + id : '/api/activity';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    alert(data.error || '保存失败');
    return;
  }
  activityModal.hide();
  await loadActivities();
}

async function openLinks(id) {
  const res = await apiGet('/api/activity/' + id + '/channel-links');
  document.getElementById('channelLinksBody').innerHTML = (res.data || []).map(item => `<tr>
    <td>${esc(item.channelName)}</td>
    <td><img src="${item.qrDataUrl}" class="qr-preview"></td>
    <td>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <a href="${item.url}" target="_blank">${item.url}</a>
        <button class="btn btn-sm btn-outline-primary" onclick="copyText('${item.url}')">复制链接</button>
      </div>
    </td>
  </tr>`).join('');
  channelLinksModal.show();
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => alert('已复制'));
}

async function loadRegistrations() {
  const params = new URLSearchParams({
    keyword: document.getElementById('rKeyword').value.trim(),
    activityId: document.getElementById('rActivity').value,
    channelId: document.getElementById('rChannel').value,
    city: document.getElementById('rCity').value.trim(),
    limit: '200'
  });
  const res = await apiGet('/api/activity/registrations/list?' + params.toString());
  document.getElementById('regTableBody').innerHTML = (res.data || []).map(r => `<tr>
    <td>${esc(r.activityId?.theme || '')}</td>
    <td>${esc(r.activityId?.city || r.city || '')}</td>
    <td>${esc(r.channelId?.name || '')}</td>
    <td>${esc(r.name)}</td>
    <td>${esc(r.phone)}</td>
    <td>${esc(r.company)}</td>
    <td>${esc(r.position || '')}</td>
    <td>${esc(r.email || '')}</td>
    <td>${r.registerTime ? new Date(r.registerTime).toLocaleString('zh-CN') : ''}</td>
    <td>
      <button class="btn btn-sm btn-outline-primary me-1" onclick="openRegEdit('${r._id}', '${esc(r.name)}', '${esc(r.phone)}', '${esc(r.company)}', '${esc(r.position || '')}', '${esc(r.email || '')}')">编辑</button>
      <button class="btn btn-sm btn-outline-danger" onclick="deleteRegistration('${r._id}')">删除</button>
    </td>
  </tr>`).join('');
}

function openRegEdit(id, name, phone, company, position, email) {
  document.getElementById('regEditId').value = id;
  document.getElementById('regEditName').value = name;
  document.getElementById('regEditPhone').value = phone;
  document.getElementById('regEditCompany').value = company;
  document.getElementById('regEditPosition').value = position;
  document.getElementById('regEditEmail').value = email;
  regEditModal.show();
}

async function saveRegEdit() {
  const id = document.getElementById('regEditId').value;
  const name = document.getElementById('regEditName').value.trim();
  const phone = document.getElementById('regEditPhone').value.trim();
  const company = document.getElementById('regEditCompany').value.trim();
  const position = document.getElementById('regEditPosition').value.trim();
  const email = document.getElementById('regEditEmail').value.trim();

  if (!name || !phone || !company) return alert('姓名、电话、公司名称不能为空');

  const res = await fetch('/api/activity/registrations/' + id, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ name, phone, company, position, email })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) return alert(data.error || '保存失败');
  regEditModal.hide();
  await loadRegistrations();
}

async function deleteRegistration(id) {
  if (!confirm('确定要删除这条报名记录吗？此操作不可恢复。')) return;
  const res = await fetch('/api/activity/registrations/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) return alert(data.error || '删除失败');
  await loadRegistrations();
}

async function exportRegistrations() {
  const params = new URLSearchParams({
    keyword: document.getElementById('rKeyword').value.trim(),
    activityId: document.getElementById('rActivity').value,
    channelId: document.getElementById('rChannel').value,
    city: document.getElementById('rCity').value.trim()
  });
  const res = await fetch('/api/activity/registrations/export?' + params.toString(), {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.error || '导出失败');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'activity_registrations.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!token) { location.href = '/admin/index.html'; return; }
  activityModal = new bootstrap.Modal(document.getElementById('activityModal'));
  channelLinksModal = new bootstrap.Modal(document.getElementById('channelLinksModal'));
  channelManageModal = new bootstrap.Modal(document.getElementById('channelManageModal'));
  regEditModal = new bootstrap.Modal(document.getElementById('regEditModal'));

  // Handle aHeroImageFile upload
  const aHeroFile = document.getElementById('aHeroImageFile');
  if (aHeroFile) {
    aHeroFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData });
        const data = await res.json();
        if (data.success) {
          document.getElementById('aHeroImage').value = data.url;
        } else {
          alert(data.error || '上传失败');
        }
      } catch (err) {
        alert('上传异常');
      }
      e.target.value = '';
    });
  }

  try {
    await initBaseData();
    if (!channels.length) {
      alert('未获取到可用渠道，请先在系统中配置渠道');
    }
    await loadActivities();
    await loadRegistrations();
  } catch (e) {
    alert(e.message || '初始化失败');
  }
  document.getElementById('btnSearchActivity').addEventListener('click', loadActivities);
  document.getElementById('btnNewActivity').addEventListener('click', openCreate);
  document.getElementById('btnSaveActivity').addEventListener('click', saveActivity);
  document.getElementById('btnSearchReg').addEventListener('click', loadRegistrations);
  document.getElementById('btnExportReg').addEventListener('click', exportRegistrations);
  document.getElementById('btnManageChannels').addEventListener('click', async () => {
    resetChannelForm();
    await loadChannelManageList();
    channelManageModal.show();
  });
  document.getElementById('btnSaveChannel').addEventListener('click', saveChannel);
  document.getElementById('btnResetChannelForm').addEventListener('click', resetChannelForm);
  document.getElementById('btnSaveRegEdit').addEventListener('click', saveRegEdit);
});

window.quickChannel = quickChannel;
window.openEdit = openEdit;
window.openLinks = openLinks;
window.copyText = copyText;
window.editChannel = editChannel;
window.editChannelFromBtn = editChannelFromBtn;
window.deleteChannel = deleteChannel;
window.openRegEdit = openRegEdit;
window.deleteRegistration = deleteRegistration;
