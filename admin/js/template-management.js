const tk = sessionStorage.getItem('token');
const h = () => ({ Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' });
let tplModal;
let listData = [];
let autosaveTimer = null;
let fieldDragIdx = -1;
let noticeEditor = null;
let imageUploadModalInstance;
let currentImageToInsert = null;
let currentFileToUpload = null;

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
  document.getElementById('uiSeoDesc').value = '';
  document.getElementById('uiSeoKeywords').value = '';
  updateSeoPreview();
  document.getElementById('uiIntro').value = '';
  if (noticeEditor) { noticeEditor.root.innerHTML = ''; }
  document.getElementById('uiBgImg').value = '';
  document.getElementById('uiHeroImage').value = '';
  document.getElementById('uiLogo').value = '';
  document.getElementById('uiBgStart').value = '#8b5cff';
  document.getElementById('uiBgEnd').value = '#6f42ff';
  document.getElementById('uiBtnStart').value = '#8a54ff';
  document.getElementById('uiBtnEnd').value = '#5a26ff';
  document.getElementById('uiSuccessMsg').value = '报名成功！后续将通过短信/邮件发放参会邀请函。';
  document.getElementById('uiSuccessRedirect').value = '';
  document.getElementById('uiWechatId').value = '';
  document.getElementById('uiWechatGuide').value = '添加工作人员微信，获取更多活动详情';
  document.getElementById('uiWechatQrCode').value = '';
  document.getElementById('wechatQrPreview').style.display = 'none';
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
      seo: {
        description: document.getElementById('uiSeoDesc').value.trim(),
        keywords: document.getElementById('uiSeoKeywords').value.trim()
      },
      activityIntro: document.getElementById('uiIntro').value.trim(),
      noticeText: noticeEditor ? noticeEditor.root.innerHTML : '',
      backgroundImage: document.getElementById('uiBgImg').value.trim(),
      heroImage: document.getElementById('uiHeroImage').value.trim(),
      logoImage: document.getElementById('uiLogo').value.trim(),
      colors: {
        bgStart: document.getElementById('uiBgStart').value,
        bgEnd: document.getElementById('uiBgEnd').value,
        buttonStart: document.getElementById('uiBtnStart').value,
        buttonEnd: document.getElementById('uiBtnEnd').value
      },
      successMessage: document.getElementById('uiSuccessMsg').value.trim(),
      successRedirect: document.getElementById('uiSuccessRedirect').value.trim(),
      wechatId: document.getElementById('uiWechatId').value.trim(),
      wechatGuide: document.getElementById('uiWechatGuide').value.trim(),
      wechatQrCode: document.getElementById('uiWechatQrCode').value.trim()
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
  document.getElementById('uiBgStart').addEventListener('input', checkColorContrast);
  document.getElementById('uiBgEnd').addEventListener('input', checkColorContrast);
  
  document.getElementById('uiPageTitle').addEventListener('input', updateSeoPreview);
  document.getElementById('uiSeoDesc').addEventListener('input', updateSeoPreview);
  document.getElementById('uiSeoKeywords').addEventListener('input', updateSeoPreview);

  resetEditor();
  document.getElementById('tplId').value = t._id;
  document.getElementById('tplName').value = t.name || '';
  document.getElementById('tplType').value = t.activityType || 'hr_forum';
  document.getElementById('tplStatus').value = t.status || 'enabled';
  document.getElementById('tplScene').value = t.sceneDescription || '';
  document.getElementById('uiPageTitle').value = t.uiConfig?.pageTitle || '';
  document.getElementById('uiSeoDesc').value = t.uiConfig?.seo?.description || '';
  document.getElementById('uiSeoKeywords').value = t.uiConfig?.seo?.keywords || '';
  updateSeoPreview();
  document.getElementById('uiIntro').value = t.uiConfig?.activityIntro || '';
  if (noticeEditor) { noticeEditor.root.innerHTML = t.uiConfig?.noticeText || ''; }
  document.getElementById('uiBgImg').value = t.uiConfig?.backgroundImage || '';
  document.getElementById('uiHeroImage').value = t.uiConfig?.heroImage || '';
  document.getElementById('uiLogo').value = t.uiConfig?.logoImage || '';
  document.getElementById('uiBgStart').value = t.uiConfig?.colors?.bgStart || '#8b5cff';
  document.getElementById('uiBgEnd').value = t.uiConfig?.colors?.bgEnd || '#6f42ff';
  document.getElementById('uiBtnStart').value = t.uiConfig?.colors?.buttonStart || '#8a54ff';
  document.getElementById('uiBtnEnd').value = t.uiConfig?.colors?.buttonEnd || '#5a26ff';
  document.getElementById('uiSuccessMsg').value = t.uiConfig?.successMessage || '';
  document.getElementById('uiSuccessRedirect').value = t.uiConfig?.successRedirect || '';
  document.getElementById('uiWechatId').value = t.uiConfig?.wechatId || '';
  document.getElementById('uiWechatGuide').value = t.uiConfig?.wechatGuide || '添加工作人员微信，获取更多活动详情';
  document.getElementById('uiWechatQrCode').value = t.uiConfig?.wechatQrCode || '';
  
  if (t.uiConfig?.wechatQrCode) {
    document.getElementById('wechatQrPreview').style.display = 'block';
    document.getElementById('wechatQrPreview').querySelector('img').src = t.uiConfig.wechatQrCode;
  } else {
    document.getElementById('wechatQrPreview').style.display = 'none';
  }
  
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

function checkColorContrast() {
  const hexToLuma = (hex) => {
    const c = hex.substring(1);
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >>  8) & 0xff;
    const b = (rgb >>  0) & 0xff;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const startLuma = hexToLuma(document.getElementById('uiBgStart').value);
  const endLuma = hexToLuma(document.getElementById('uiBgEnd').value);
  const warning = document.getElementById('colorContrastWarning');
  if (startLuma > 180 || endLuma > 180) {
    warning.style.display = 'block';
  } else {
    warning.style.display = 'none';
  }
}

function updateSeoPreview() {
  const titleInput = document.getElementById('uiPageTitle');
  const descInput = document.getElementById('uiSeoDesc');
  const kwInput = document.getElementById('uiSeoKeywords');
  
  document.getElementById('titleCount').innerText = `${titleInput.value.length}/60`;
  document.getElementById('descCount').innerText = `${descInput.value.length}/160`;
  document.getElementById('kwCount').innerText = `${kwInput.value.length}/100`;

  document.getElementById('seoPreviewTitle').innerText = titleInput.value.trim() || '默认活动名称';
  document.getElementById('seoPreviewDesc').innerText = descInput.value.trim() || '页面描述将显示在这里，为用户提供活动内容的简要介绍。';
}

function imageHandler() {
  if (!imageUploadModalInstance) {
    imageUploadModalInstance = new bootstrap.Modal(document.getElementById('imageUploadModal'));
  }
  // Reset modal state
  document.getElementById('localImageFile').value = '';
  document.getElementById('imageUrlInput').value = '';
  document.getElementById('imageAltInput').value = '';
  document.getElementById('localImagePreview').style.display = 'none';
  document.getElementById('urlImagePreview').style.display = 'none';
  document.getElementById('uploadProgressContainer').style.display = 'none';
  document.getElementById('uploadError').style.display = 'none';
  document.getElementById('btnConfirmImageInsert').disabled = true;
  currentImageToInsert = null;
  currentFileToUpload = null;
  
  imageUploadModalInstance.show();
}

async function compressImage(file, maxWidth = 1920, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: file.type || 'image/jpeg' }));
        }, file.type || 'image/jpeg', quality);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

function uploadFileWithProgress(file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('Authorization', 'Bearer ' + tk);
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        document.getElementById('uploadProgressBar').style.width = percent + '%';
      }
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success) resolve(res.url);
          else reject(new Error(res.error || '上传失败'));
        } catch (e) {
          reject(new Error('响应解析失败'));
        }
      } else {
        reject(new Error('上传失败，状态码：' + xhr.status));
      }
    };
    
    xhr.onerror = () => reject(new Error('网络错误'));
    
    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!tk) return location.href = '/admin/index.html';
  tplModal = new bootstrap.Modal(document.getElementById('tplModal'));
  
  // Setup Image Upload Modal Events
  document.getElementById('localImageFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过5MB');
      e.target.value = '';
      return;
    }
    document.getElementById('btnConfirmImageInsert').disabled = false;
    currentFileToUpload = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('localImagePreview').style.display = 'block';
      document.getElementById('localImagePreview').querySelector('img').src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('imageUrlInput').addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      document.getElementById('urlImagePreview').style.display = 'block';
      document.getElementById('urlImagePreview').querySelector('img').src = url;
      document.getElementById('btnConfirmImageInsert').disabled = false;
    } else {
      document.getElementById('urlImagePreview').style.display = 'none';
      document.getElementById('btnConfirmImageInsert').disabled = true;
    }
  });

  const doUploadImage = async () => {
    document.getElementById('uploadError').style.display = 'none';
    const activeTab = document.querySelector('#imageUploadModal .nav-link.active').getAttribute('href');
    try {
      let finalUrl = '';
      if (activeTab === '#uploadLocalTab') {
        if (!currentFileToUpload) return;
        document.getElementById('btnConfirmImageInsert').disabled = true;
        document.getElementById('uploadProgressContainer').style.display = 'flex';
        document.getElementById('uploadProgressBar').style.width = '0%';
        
        let fileToUpload = currentFileToUpload;
        // Compress if larger than 1MB
        if (fileToUpload.size > 1024 * 1024) {
          fileToUpload = await compressImage(fileToUpload);
        }
        
        finalUrl = await uploadFileWithProgress(fileToUpload);
      } else {
        const urlInput = document.getElementById('imageUrlInput').value.trim();
        if (!urlInput) return;
        document.getElementById('btnConfirmImageInsert').disabled = true;
        document.getElementById('uploadProgressContainer').style.display = 'flex';
        document.getElementById('uploadProgressBar').style.width = '50%';
        
        const res = await fetch('/api/upload/fetch-url', {
          method: 'POST',
          headers: h(),
          body: JSON.stringify({ url: urlInput })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || '下载图片失败');
        finalUrl = data.url;
      }
      
      const alt = document.getElementById('imageAltInput').value.trim();
      const range = noticeEditor.getSelection(true);
      noticeEditor.insertEmbed(range.index, 'image', finalUrl, Quill.sources.USER);
      if (alt) {
        // Quill doesn't natively support alt through insertEmbed easily without custom blot. 
        // But we can find the image node and add alt.
        setTimeout(() => {
          const imgs = noticeEditor.root.querySelectorAll(`img[src="${finalUrl}"]`);
          imgs.forEach(img => img.setAttribute('alt', alt));
        }, 100);
      }
      noticeEditor.setSelection(range.index + 1, Quill.sources.SILENT);
      imageUploadModalInstance.hide();
    } catch (err) {
      document.getElementById('uploadError').style.display = 'block';
      document.getElementById('btnConfirmImageInsert').disabled = false;
    } finally {
      document.getElementById('uploadProgressContainer').style.display = 'none';
    }
  };

  document.getElementById('btnConfirmImageInsert').addEventListener('click', doUploadImage);
  document.getElementById('btnRetryUpload').addEventListener('click', doUploadImage);

  if (typeof Quill !== 'undefined') {
    noticeEditor = new Quill('#uiNoticeEditor', {
      theme: 'snow',
      placeholder: '请输入注意事项...',
      modules: { 
        toolbar: {
          container: [['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link', 'image', 'clean']],
          handlers: {
            image: imageHandler
          }
        }
      }
    });
  }

  // Hero Image Upload
  document.getElementById('uiHeroImageFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': 'Bearer ' + tk }, body: formData });
      const data = await res.json();
      if (data.success) {
        document.getElementById('uiHeroImage').value = data.url;
      } else {
        alert(data.error || '上传失败');
      }
    } catch (err) {
      alert('上传异常');
    }
    e.target.value = '';
  });

  // WeChat QR Code Upload
  document.getElementById('uiWechatQrCodeFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': 'Bearer ' + tk }, body: formData });
      const data = await res.json();
      if (data.success) {
        document.getElementById('uiWechatQrCode').value = data.url;
        document.getElementById('wechatQrPreview').style.display = 'block';
        document.getElementById('wechatQrPreview').querySelector('img').src = data.url;
      } else {
        alert(data.error || '上传失败');
      }
    } catch (err) {
      alert('上传异常');
    }
    e.target.value = '';
  });

  document.getElementById('uiWechatQrCode').addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      document.getElementById('wechatQrPreview').style.display = 'block';
      document.getElementById('wechatQrPreview').querySelector('img').src = url;
    } else {
      document.getElementById('wechatQrPreview').style.display = 'none';
    }
  });

  document.getElementById('uiBgStart').addEventListener('input', checkColorContrast);
  document.getElementById('uiBgEnd').addEventListener('input', checkColorContrast);

  resetEditor();
  await loadList();
  document.getElementById('btnSearchTpl').addEventListener('click', loadList);
  document.getElementById('btnNewTemplate').addEventListener('click', () => { resetEditor(); tplModal.show(); });
  document.getElementById('btnAddField').addEventListener('click', () => addFieldRow({ key: '', label: '', type: 'text', required: false }));
  document.getElementById('btnSaveTpl').addEventListener('click', saveTpl);
  document.getElementById('btnAutosave').addEventListener('click', autosaveTpl);
  
  // Preview Success Modal logic
  document.getElementById('btnPreviewSuccess').addEventListener('click', () => {
    const bgStart = document.getElementById('uiBgStart').value || '#8b5cff';
    const bgEnd = document.getElementById('uiBgEnd').value || '#6f42ff';
    const btnStart = document.getElementById('uiBtnStart').value || '#8a54ff';
    const btnEnd = document.getElementById('uiBtnEnd').value || '#5a26ff';
    
    document.documentElement.style.setProperty('--bg-start', bgStart);
    document.documentElement.style.setProperty('--bg-end', bgEnd);
    document.documentElement.style.setProperty('--btn-start', btnStart);
    document.documentElement.style.setProperty('--btn-end', btnEnd);
    
    const msg = document.getElementById('uiSuccessMsg').value.trim() || '报名成功！后续将通过短信/邮件发放参会邀请函。';
    const wechatId = document.getElementById('uiWechatId').value.trim();
    const wechatGuide = document.getElementById('uiWechatGuide').value.trim();
    const wechatQrCode = document.getElementById('uiWechatQrCode').value.trim();
    
    document.getElementById('previewSuccessMsg').textContent = msg;
    
    const wechatBox = document.getElementById('previewWechatBox');
    if (wechatId || wechatQrCode) {
      wechatBox.style.display = 'block';
      document.getElementById('previewWechatGuide').textContent = wechatGuide || '添加工作人员微信，获取更多活动详情';
      
      if (wechatQrCode) {
        document.getElementById('previewWechatQr').src = wechatQrCode;
        document.getElementById('previewWechatQr').style.display = 'inline-block';
      } else {
        document.getElementById('previewWechatQr').style.display = 'none';
      }
      
      if (wechatId) {
        document.getElementById('previewWechatId').textContent = wechatId;
        document.getElementById('previewWechatIdWrap').style.display = 'flex';
      } else {
        document.getElementById('previewWechatIdWrap').style.display = 'none';
      }
    } else {
      wechatBox.style.display = 'none';
    }
    
    new bootstrap.Modal(document.getElementById('previewSuccessModal')).show();
  });

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
