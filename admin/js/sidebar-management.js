// ================= Sidebar Management Module =================

let sidebarModules = [];
let sidebarModal = null;

function initSidebarModal() {
    if (!sidebarModal) {
        sidebarModal = new bootstrap.Modal(document.getElementById('sidebarModuleModal'));
        
        // Listen to rule change to toggle custom HTML field
        document.getElementById('sm-rule').addEventListener('change', function() {
            const isCustom = this.value === 'custom_html';
            document.getElementById('sm-custom-html-group').style.display = isCustom ? 'block' : 'none';
            const isEfficiency = this.value === 'efficiency_agent';
            document.getElementById('sm-efficiency-group').style.display = isEfficiency ? 'block' : 'none';
        });
    }
}

function loadSidebarData() {
    toggleLoading(true);
    fetch('/api/sidebar/modules', { headers: authHeaders() })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                sidebarModules = data.data || [];
                renderSidebarModules();
            } else {
                showToast('加载侧边栏配置失败: ' + data.error, 'error');
            }
        })
        .catch(err => {
            console.error(err);
            showToast('加载侧边栏配置失败', 'error');
        })
        .finally(() => toggleLoading(false));
}

function renderSidebarModules() {
    const tbody = document.getElementById('sidebarModulesList');
    if (!tbody) return;

    if (sidebarModules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">暂无配置的侧边栏模块</td></tr>';
        return;
    }

    // Sort by order
    sidebarModules.sort((a, b) => (a.order || 0) - (b.order || 0));

    const ruleNames = {
        'latest': '最新发布',
        'category': '同分类文章',
        'tags': '同标签推荐',
        'manual': '手动指定',
        'custom_html': '自定义HTML',
        'efficiency_agent': '组织人效推荐'
    };

    tbody.innerHTML = sidebarModules.map(mod => `
        <tr>
            <td><span class="badge bg-secondary">${mod.order || 0}</span></td>
            <td class="fw-bold">${mod.title}</td>
            <td>${ruleNames[mod.rule] || mod.rule}</td>
            <td>${mod.count || '-'}</td>
            <td>
                <span class="badge bg-${mod.active ? 'success' : 'secondary'}">${mod.active ? '启用' : '禁用'}</span>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editSidebarModule('${mod._id}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteSidebarModule('${mod._id}')"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openSidebarModuleModal() {
    if (sidebarModules.length >= 5) {
        showToast('最多只能配置5个侧边栏模块', 'warning');
        return;
    }
    
    initSidebarModal();
    document.getElementById('sidebarModuleForm').reset();
    document.getElementById('sm-id').value = '';
    document.getElementById('sm-order').value = sidebarModules.length * 10;
    document.getElementById('sm-custom-html-group').style.display = 'none';
    document.getElementById('sm-efficiency-group').style.display = 'none';
    
    document.getElementById('sidebarModuleModalTitle').textContent = '新增侧边栏模块';
    sidebarModal.show();
}

function editSidebarModule(id) {
    const mod = sidebarModules.find(m => m._id === id);
    if (!mod) return;
    
    initSidebarModal();
    document.getElementById('sm-id').value = mod._id;
    document.getElementById('sm-title').value = mod.title;
    document.getElementById('sm-rule').value = mod.rule;
    document.getElementById('sm-custom-html').value = mod.customHtml || '';
    document.getElementById('sm-count').value = mod.count || 5;
    document.getElementById('sm-order').value = mod.order || 0;
    document.getElementById('sm-active').checked = mod.active !== false;
    
    if (mod.effConfig) {
        document.getElementById('sm-eff-title').value = mod.effConfig.title || '';
        document.getElementById('sm-eff-desc').value = mod.effConfig.desc || '';
        document.getElementById('sm-eff-btn').value = mod.effConfig.btnText || '';
        document.getElementById('sm-eff-link').value = mod.effConfig.link || '';
        
        // Load RACE config
        document.getElementById('sm-eff-r-title').value = mod.effConfig.rTitle || '';
        document.getElementById('sm-eff-r-desc').value = mod.effConfig.rDesc || '';
        document.getElementById('sm-eff-a-title').value = mod.effConfig.aTitle || '';
        document.getElementById('sm-eff-a-desc').value = mod.effConfig.aDesc || '';
        document.getElementById('sm-eff-c-title').value = mod.effConfig.cTitle || '';
        document.getElementById('sm-eff-c-desc').value = mod.effConfig.cDesc || '';
        document.getElementById('sm-eff-e-title').value = mod.effConfig.eTitle || '';
        document.getElementById('sm-eff-e-desc').value = mod.effConfig.eDesc || '';
    }
    
    document.getElementById('sm-custom-html-group').style.display = mod.rule === 'custom_html' ? 'block' : 'none';
    document.getElementById('sm-efficiency-group').style.display = mod.rule === 'efficiency_agent' ? 'block' : 'none';
    
    document.getElementById('sidebarModuleModalTitle').textContent = '编辑侧边栏模块';
    sidebarModal.show();
}

function saveSidebarModule() {
    const title = document.getElementById('sm-title').value.trim();
    if (!title) {
        showToast('请输入模块标题', 'error');
        return;
    }
    
    const id = document.getElementById('sm-id').value;
    const rule = document.getElementById('sm-rule').value;
    
    const payload = {
        title,
        rule,
        customHtml: document.getElementById('sm-custom-html').value,
        effConfig: {
            title: document.getElementById('sm-eff-title').value,
            desc: document.getElementById('sm-eff-desc').value,
            btnText: document.getElementById('sm-eff-btn').value,
            link: document.getElementById('sm-eff-link').value,
            rTitle: document.getElementById('sm-eff-r-title').value,
            rDesc: document.getElementById('sm-eff-r-desc').value,
            aTitle: document.getElementById('sm-eff-a-title').value,
            aDesc: document.getElementById('sm-eff-a-desc').value,
            cTitle: document.getElementById('sm-eff-c-title').value,
            cDesc: document.getElementById('sm-eff-c-desc').value,
            eTitle: document.getElementById('sm-eff-e-title').value,
            eDesc: document.getElementById('sm-eff-e-desc').value
        },
        count: parseInt(document.getElementById('sm-count').value) || 5,
        order: parseInt(document.getElementById('sm-order').value) || 0,
        active: document.getElementById('sm-active').checked
    };
    
    const url = id ? '/api/sidebar/modules/' + id : '/api/sidebar/modules';
    const method = id ? 'PUT' : 'POST';
    
    toggleLoading(true);
    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('保存成功');
            sidebarModal.hide();
            loadSidebarData();
        } else {
            showToast(data.error || '保存失败', 'error');
        }
    })
    .catch(err => showToast('网络错误', 'error'))
    .finally(() => toggleLoading(false));
}

function deleteSidebarModule(id) {
    if (!confirm('确定要删除此模块吗？')) return;
    
    toggleLoading(true);
    fetch('/api/sidebar/modules/' + id, {
        method: 'DELETE',
        headers: authHeaders()
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('删除成功');
            loadSidebarData();
        } else {
            showToast(data.error || '删除失败', 'error');
        }
    })
    .catch(err => showToast('网络错误', 'error'))
    .finally(() => toggleLoading(false));
}
