
// ================= Permissions Management (Users & Roles) =================

// Permission Dictionary
let PERMISSION_DICT = [
    { code: 'all', name: '全部权限 (超级管理员)' },
    { code: 'dashboard:view', name: '查看数据看板' },
    { code: 'system:manage', name: '系统/SEO/GEO 管理' },
    { code: 'article:list', name: '查看文章' },
    { code: 'article:create', name: '发布文章' },
    { code: 'article:edit', name: '编辑文章' },
    { code: 'article:delete', name: '删除文章' },
    { code: 'faq:list', name: '查看FAQ' },
    { code: 'faq:create', name: '新增FAQ' },
    { code: 'faq:edit', name: '编辑FAQ' },
    { code: 'faq:delete', name: '删除FAQ' },
    { code: 'banner:manage', name: 'Banner管理' },
    { code: 'sidebar:manage', name: '侧边栏配置' },
    { code: 'upload:write', name: '上传文件/图片' },
    { code: 'ai:use', name: '使用AI/SEO/GEO工具' },
    { code: 'lead:list', name: '查看官网线索' },
    { code: 'lead:edit', name: '处理官网线索' },
    { code: 'lead:delete', name: '删除官网线索' },
    { code: 'lead:export', name: '导出官网线索' },
    { code: 'appointment:list', name: '查看预约（兼容旧权限）' },
    { code: 'appointment:edit', name: '处理预约' },
    { code: 'appointment:delete', name: '删除预约' },
    { code: 'appointment:export', name: '导出预约/线索数据' },
    { code: 'nqoc:manage', name: '新质组织管理（兼容旧权限）' },
    { code: 'nqoc:list', name: '查看新质组织数据' },
    { code: 'nqoc:edit', name: '编辑新质组织数据' },
    { code: 'nqoc:delete', name: '删除新质组织数据' },
    { code: 'nqoc:export', name: '导出新质组织数据' },
    { code: 'video:list', name: '查看视频' },
    { code: 'video:create', name: '新增视频' },
    { code: 'video:edit', name: '编辑视频' },
    { code: 'video:delete', name: '删除视频' }
];

let permissionDictLoaded = false;

async function loadPermissionDict() {
    if (permissionDictLoaded) return PERMISSION_DICT;
    try {
        const res = await fetch('/api/permissions/dictionary', { headers: authHeaders() });
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.groups)) {
            PERMISSION_DICT = data.groups.flatMap(group =>
                (group.permissions || []).map(permission => ({
                    code: permission.code,
                    name: permission.name || permission.code
                }))
            ).filter(permission => permission.code);
        }
    } catch (err) {
        console.warn('Load permission dictionary failed, using local fallback:', err);
    } finally {
        permissionDictLoaded = true;
    }
    return PERMISSION_DICT;
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function permInputId(code) {
    return `perm_${String(code).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function switchPermTab(tab) {
    // UI update
    document.querySelectorAll('#permTabs .nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.perm-tab-content').forEach(c => c.classList.add('d-none'));
    
    // Activate tab button
    const link = Array.from(document.querySelectorAll('#permTabs .nav-link')).find(l => l.getAttribute('onclick') && l.getAttribute('onclick').includes(`'${tab}'`));
    if (link) link.classList.add('active');
    
    // Show content
    const content = document.getElementById(`perm-${tab}`);
    if (content) content.classList.remove('d-none');
    
    // Load data
    if (tab === 'users') loadUsers();
    else if (tab === 'roles') loadRoles();
    else if (tab === 'logs') {
        if (typeof loadLogs === 'function') loadLogs();
        else console.warn('loadLogs function not found');
    }
}

// --- Users Management ---

function loadUsers() {
    toggleLoading(true);
    fetch('/api/admins', { headers: authHeaders() })
        .then(res => res.json())
        .then(users => {
            const tbody = document.getElementById('userList');
            if (!tbody) return;
            
            if (!Array.isArray(users)) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">加载失败</td></tr>';
                return;
            }

            tbody.innerHTML = users.map(u => `
                <tr>
                    <td>${escapeHTML(u.username)}</td>
                    <td>${escapeHTML(u.name || '-')}</td>
                    <td>${u.roles && u.roles.length ? u.roles.map(r => `<span class="badge bg-info me-1">${escapeHTML(r.name)}</span>`).join('') : '<span class="badge bg-secondary">无角色</span>'}</td>
                    <td>${u.isActive ? '<span class="text-success">正常</span>' : '<span class="text-danger">禁用</span>'}</td>
                    <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="openUserModal('${u._id}')">编辑</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u._id}')">删除</button>
                    </td>
                </tr>
            `).join('');
        })
        .catch(err => {
            console.error('Load users error:', err);
            showToast('加载用户列表失败', 'error');
        })
        .finally(() => toggleLoading(false));
}

function openUserModal(id = null) {
    document.getElementById('userId').value = '';
    document.getElementById('userName').value = '';
    document.getElementById('userPass').value = '';
    document.getElementById('userDisplayName').value = '';
    document.getElementById('userActive').checked = true;
    
    // Load roles for select
    fetch('/api/roles', { headers: authHeaders() })
        .then(res => res.json())
        .then(roles => {
            if (!Array.isArray(roles)) {
                showToast('无法加载角色列表', 'error');
                return;
            }
            const select = document.getElementById('userRole');
            select.innerHTML = roles.map(r => `<option value="${escapeHTML(r._id)}">${escapeHTML(r.name)}</option>`).join('');
            
            if (id) {
                // Fetch user details or find in list (here we fetch list again for simplicity)
                fetch('/api/admins', { headers: authHeaders() })
                    .then(res => res.json())
                    .then(users => {
                        const user = users.find(u => u._id === id);
                        if (user) {
                            document.getElementById('userId').value = user._id;
                            document.getElementById('userName').value = user.username;
                            document.getElementById('userDisplayName').value = user.name || '';
                            
                            // Handle multiple roles selection
                            if (user.roles && Array.isArray(user.roles)) {
                                const roleIds = user.roles.map(r => typeof r === 'object' ? r._id : r);
                                Array.from(select.options).forEach(opt => {
                                    opt.selected = roleIds.includes(opt.value);
                                });
                            } else if (user.role) {
                                // Backward compatibility
                                select.value = user.role._id || user.role;
                            }
                            
                            document.getElementById('userActive').checked = user.isActive;
                            new bootstrap.Modal(document.getElementById('userModal')).show();
                        }
                    });
            } else {
                new bootstrap.Modal(document.getElementById('userModal')).show();
            }
        })
        .catch(err => showToast('加载数据失败', 'error'));
}

function saveUser() {
    const id = document.getElementById('userId').value;
    const username = document.getElementById('userName').value;
    const name = document.getElementById('userDisplayName').value;
    const roleIds = Array.from(document.getElementById('userRole').selectedOptions).map(opt => opt.value);
    const pass = document.getElementById('userPass').value;

    // Password Policy
    const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (pass && !pwdRegex.test(pass)) {
        showToast('密码至少8位，且包含字母和数字', 'error');
        return;
    }

    const data = {
        username,
        name,
        roles: roleIds,
        isActive: document.getElementById('userActive').checked
    };
    if (pass) data.password = pass;
    if (id) data.id = id;
    
    toggleLoading(true);
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admins/${id}` : '/api/admins';

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            showToast('保存成功');
            bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
            loadUsers();
        } else {
            showToast(res.error || res.message, 'error');
        }
    })
    .catch(err => showToast('保存失败', 'error'))
    .finally(() => toggleLoading(false));
}

function deleteUser(id) {
    if (!confirm('确定删除该用户吗？')) return;
    toggleLoading(true);
    fetch(`/api/admins/${id}`, { method: 'DELETE', headers: authHeaders() })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                showToast('删除成功');
                loadUsers();
            } else {
                showToast(res.error, 'error');
            }
        })
        .catch(err => showToast('删除失败', 'error'))
        .finally(() => toggleLoading(false));
}

// --- Roles Management ---

function loadRoles() {
    toggleLoading(true);
    fetch('/api/roles', { headers: authHeaders() })
        .then(res => res.json())
        .then(roles => {
            const tbody = document.getElementById('roleList');
            if (!tbody) return;
            
            if (!Array.isArray(roles)) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">加载失败</td></tr>';
                return;
            }

            tbody.innerHTML = roles.map(r => `
                <tr>
                    <td>${escapeHTML(r.name)}</td>
                    <td><code>${escapeHTML(r.code)}</code></td>
                    <td>${escapeHTML(r.description || '-')}</td>
                    <td class="text-truncate" style="max-width: 200px;">${r.permissions ? r.permissions.map(escapeHTML).join(', ') : ''}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="openRoleModal('${r._id}')">编辑</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteRole('${r._id}')">删除</button>
                    </td>
                </tr>
            `).join('');
        })
        .catch(err => {
            console.error('Load roles error:', err);
            showToast('加载角色列表失败', 'error');
        })
        .finally(() => toggleLoading(false));
}

async function openRoleModal(id = null) {
    document.getElementById('roleId').value = '';
    document.getElementById('roleName').value = '';
    document.getElementById('roleCode').value = '';
    document.getElementById('roleDesc').value = '';
    await loadPermissionDict();
    
    // Render permission checkboxes
    const container = document.getElementById('permCheckboxes');
    if (container) {
        container.innerHTML = PERMISSION_DICT.map(p => `
            <div class="form-check">
                <input class="form-check-input perm-check" type="checkbox" value="${escapeHTML(p.code)}" id="${permInputId(p.code)}">
                <label class="form-check-label" for="${permInputId(p.code)}">${escapeHTML(p.name)}</label>
            </div>
        `).join('');
    }
    
    if (id) {
        fetch('/api/roles', { headers: authHeaders() })
            .then(res => res.json())
            .then(roles => {
                const role = roles.find(r => r._id === id);
                if (role) {
                    document.getElementById('roleId').value = role._id;
                    document.getElementById('roleName').value = role.name;
                    document.getElementById('roleCode').value = role.code;
                    document.getElementById('roleDesc').value = role.description || '';
                    if (role.permissions) {
                        role.permissions.forEach(p => {
                            const cb = document.getElementById(permInputId(p));
                            if (cb) cb.checked = true;
                        });
                    }
                    new bootstrap.Modal(document.getElementById('roleModal')).show();
                }
            })
            .catch(err => showToast('加载数据失败', 'error'));
    } else {
        new bootstrap.Modal(document.getElementById('roleModal')).show();
    }
}

function saveRole() {
    const id = document.getElementById('roleId').value;
    const perms = Array.from(document.querySelectorAll('.perm-check:checked')).map(cb => cb.value);
    const name = document.getElementById('roleName').value.trim();
    const code = document.getElementById('roleCode').value.trim();
    
    if (!name) {
        showToast('角色名称为必填项', 'error');
        return;
    }
    
    const data = {
        name,
        code,
        description: document.getElementById('roleDesc').value.trim(),
        permissions: perms
    };
    if (id) data.id = id;
    
    toggleLoading(true);
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/roles/${id}` : '/api/roles';
    
    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            showToast('保存成功');
            bootstrap.Modal.getInstance(document.getElementById('roleModal')).hide();
            loadRoles();
        } else {
            showToast(res.error || '保存失败', 'error');
        }
    })
    .catch(err => showToast('保存出错', 'error'))
    .finally(() => toggleLoading(false));
}

function deleteRole(id) {
    if (!confirm('确定删除该角色吗？')) return;
    fetch(`/api/roles/${id}`, { method: 'DELETE', headers: authHeaders() })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                showToast('删除成功');
                loadRoles();
            } else {
                showToast(res.error, 'error');
            }
        });
}
