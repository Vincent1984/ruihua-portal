
// Loading Helper
function toggleLoading(show) {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
        document.body.appendChild(overlay);
    }
    overlay.style.display = show ? 'flex' : 'none';
}

// ================= 权限管理 =================

// 权限定义
const PERMISSION_DICT = [
    { code: 'all', name: '全部权限 (超级管理员)' },
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
    { code: 'appointment:list', name: '查看预约' },
    { code: 'appointment:edit', name: '处理预约 (修改状态)' },
    { code: 'appointment:delete', name: '删除预约' }
];

function switchPermTab(tab) {
    // UI update
    document.querySelectorAll('#permTabs .nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.perm-tab-content').forEach(c => c.classList.add('d-none'));
    
    // Find link by onclick attribute is tricky, simpler to assume order or use ID
    // But here we can find by text or just add ID to links in dashboard.html.
    // For now, let's just use the fact that I passed 'tab'
    
    // Actually, I should have added IDs to the nav-links in dashboard.html for easier selection
    // But I can select by the onclick content
    const link = Array.from(document.querySelectorAll('#permTabs .nav-link')).find(l => l.getAttribute('onclick').includes(`'${tab}'`));
    if (link) link.classList.add('active');
    
    document.getElementById(`perm-${tab}`).classList.remove('d-none');
    
    if (tab === 'users') loadUsers();
    else if (tab === 'roles') loadRoles();
    else if (tab === 'logs') loadLogs();
    else if (tab === 'appointments') loadAppointments();
}

// --- Appointments --- 

function loadAppointments() {
    if (typeof getAppointments === 'function') {
        const page = window.appointmentCurrentPage || 1;
        getAppointments(page, window.currentFilters || {});
    } else {
        console.error('getAppointments function not found');
    }
}

function updateAppointmentStatus(id, status) {
    toggleLoading(true);
    fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('状态更新成功');
            loadAppointments();
        } else {
            showToast('更新失败: ' + (data.error || '未知错误'), 'error');
        }
    })
    .catch(err => showToast('请求失败', 'error'))
    .finally(() => toggleLoading(false));
}

function deleteAppointment(id) {
    if (!confirm('确定删除该预约记录吗？此操作不可恢复。')) return;
    
    toggleLoading(true);
    fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('删除成功');
            loadAppointments();
        } else {
            showToast('删除失败: ' + (data.error || '权限不足'), 'error');
        }
    })
    .catch(err => showToast('请求失败', 'error'))
    .finally(() => toggleLoading(false));
}

// --- Slug Management ---
async function autoGenerateSlug(forceAi = false) {
    const id = document.getElementById('artId').value;
    if (id && !forceAi) return; // Don't auto-change slug for existing articles
    
    const title = document.getElementById('artTitle').value;
    const slugInput = document.getElementById('artSlug');
    
    if (!title) {
        if (forceAi) showToast('请先输入文章标题', 'warning');
        return;
    }

    if (forceAi) {
        const btn = document.querySelector('button[onclick="autoGenerateSlug(true)"]');
        const originalIcon = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> 生成中...';
        }

        try {
            const res = await fetch('/api/tools/slug', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify({ text: title, forceAi: true })
            });
            
            const data = await res.json();
            
            if (data.slug) {
                slugInput.value = data.slug;
                previewSlug();
                showToast('智能Slug生成成功');
            } else {
                showToast('生成失败: ' + (data.error || '未知错误'), 'error');
            }
        } catch (e) {
            console.error('Slug AI Error:', e);
            showToast('生成请求失败', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalIcon;
            }
        }
    } else if (!slugInput.value) {
        if (/^[a-zA-Z0-9\s]+$/.test(title)) {
            slugInput.value = title.toLowerCase().replace(/\s+/g, '-').substring(0, 50);
        }
        previewSlug();
    }
}

function previewSlug() {
    const slug = document.getElementById('artSlug').value.trim();
    const preview = document.getElementById('slugPreview');
    if (slug) {
        const cleanSlug = slug.replace(/[^a-zA-Z0-9\-]/g, '-').replace(/-+/g, '-').toLowerCase();
        if (cleanSlug !== slug) {
            document.getElementById('artSlug').value = cleanSlug;
        }
        preview.textContent = `预览: https://ruihua.com/article/${cleanSlug}.html`;
    } else {
        preview.textContent = '';
    }
}

// 打开文章编辑模态框
function openArtModal(id = null) {
    try {
        // 重置表单
        document.getElementById('artId').value = '';
        document.getElementById('artTitle').value = '';
        document.getElementById('artSlug').value = '';
        document.getElementById('slugPreview').textContent = '';
        document.getElementById('artCover').value = '';
        document.getElementById('artCategory').value = '';
        document.getElementById('artAuthor').value = '';
        document.getElementById('artFeatured').checked = false;
        document.getElementById('artDesc').value = '';
        
        // Reset Avatar
        document.getElementById('artAuthorAvatar').value = '';
        document.getElementById('artAuthorAvatarPreview').src = '';
        document.getElementById('artAuthorAvatarPreview').classList.add('d-none');
        document.getElementById('artAuthorAvatarFile').value = '';
        if (document.getElementById('artAuthorDesc')) document.getElementById('artAuthorDesc').value = '';
        if (document.getElementById('artAuthorDetail')) document.getElementById('artAuthorDetail').value = '';
        
        // 重置编辑器
        if (typeof quillEditor !== 'undefined' && quillEditor) {
            quillEditor.root.innerHTML = '';
        }
        
        // 如果是编辑模式，加载数据
        if (id) {
            fetch(`/api/articles/${id}`)
                .then(response => response.json())
                .then(data => {
                    if (data && !data.error) {
                        document.getElementById('artId').value = data._id;
                        document.getElementById('artTitle').value = data.title || '';
                        document.getElementById('artSlug').value = data.slug || '';
                        previewSlug();
                        document.getElementById('artCover').value = data.coverImage || '';
                        document.getElementById('artCategory').value = data.category || '';
                        
                        // Author handling
                        const author = data.author || {};
                        document.getElementById('artAuthor').value = author.name || (typeof data.author === 'string' ? data.author : '');
                        if (author.avatar) {
                            document.getElementById('artAuthorAvatar').value = author.avatar;
                            document.getElementById('artAuthorAvatarPreview').src = author.avatar;
                            document.getElementById('artAuthorAvatarPreview').classList.remove('d-none');
                        }
                        if (document.getElementById('artAuthorDesc')) {
                            document.getElementById('artAuthorDesc').value = author.desc || '';
                        }
                        if (document.getElementById('artAuthorDetail')) {
                            document.getElementById('artAuthorDetail').value = author.detail || '';
                        }
                        
                        document.getElementById('artFeatured').checked = data.isRecommended || false;
                        document.getElementById('artDesc').value = data.summary || '';
                        
                        // 设置编辑器内容
                        if (typeof quillEditor !== 'undefined' && quillEditor) {
                            quillEditor.root.innerHTML = data.content || '';
                        }
                    }
                })
                .catch(error => {
                    console.error('加载文章数据失败:', error);
                    showToast('加载数据失败', 'error');
                });
        }
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('artModal'));
        modal.show();
    } catch (error) {
        console.error('打开文章模态框失败:', error);
        showToast('操作失败', 'error');
    }
}

// Author Avatar Functions
function uploadAuthorAvatar() {
    const fileInput = document.getElementById('artAuthorAvatarFile');
    const file = fileInput.files[0];
    if (!file) return;

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast('图片大小不能超过2MB', 'error');
        fileInput.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    
    // Use a default user ID for now
    const userId = 'common'; 
    
    // Add loading state
    const preview = document.getElementById('artAuthorAvatarPreview');
    const originalSrc = preview.src;
    preview.classList.remove('d-none');
    preview.style.opacity = '0.5';
    
    fetch(`/api/upload/author/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': authHeaders().Authorization },
        body: formData
    })
    .then(async res => {
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Upload failed (${res.status}): ${text}`);
        }
        return res.json();
    })
    .then(data => {
        if (data.success) {
            // Update UI with new URL and cache busting
            const newUrl = `${data.url}?t=${Date.now()}`;
            document.getElementById('artAuthorAvatar').value = data.url; // Save raw path
            preview.src = newUrl;
            
            preview.onerror = function() {
                console.error('Preview image failed to load:', newUrl);
                showToast('预览图片加载失败，请检查网络或文件权限', 'error');
            };

            preview.classList.remove('d-none');
            preview.style.opacity = '1';
            showToast('头像上传成功');
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    })
    .catch(err => {
        console.error('Avatar upload error:', err);
        showToast('上传出错: ' + err.message, 'error');
        // Revert on error
        preview.src = originalSrc;
        if (!originalSrc) preview.classList.add('d-none');
        preview.style.opacity = '1';
        fileInput.value = '';
    });
}

function clearAuthorAvatar() {
    document.getElementById('artAuthorAvatar').value = '';
    document.getElementById('artAuthorAvatarPreview').src = '';
    document.getElementById('artAuthorAvatarPreview').classList.add('d-none');
    document.getElementById('artAuthorAvatarFile').value = '';
}

// 保存文章
function saveArt() {
    try {
        const id = document.getElementById('artId').value;
        const title = document.getElementById('artTitle').value.trim();
        let slug = document.getElementById('artSlug').value.trim();
        const coverImage = document.getElementById('artCover').value.trim();
        const category = document.getElementById('artCategory').value;
        const authorName = document.getElementById('artAuthor').value.trim();
        const authorDesc = document.getElementById('artAuthorDesc') ? document.getElementById('artAuthorDesc').value.trim() : '';
        const featured = document.getElementById('artFeatured').checked;
        const summary = document.getElementById('artDesc').value.trim();
        const content = (typeof quillEditor !== 'undefined' && quillEditor) ? quillEditor.root.innerHTML : '';
        
        // 验证必填项
        if (!title || !category || !content) {
            showToast('请填写标题、分类和内容', 'error');
            return;
        }
        
        // Auto-generate slug if empty
        if (!slug) {
            slug = 'art-' + Date.now();
        }
        
        const authorAvatar = document.getElementById('artAuthorAvatar').value;
        const authorDetail = document.getElementById('artAuthorDetail') ? document.getElementById('artAuthorDetail').value.trim() : '';

        // 根据更新后的模型结构构建作者对象
        const data = {
            title,
            slug,
            coverImage,
            category,
            author: authorName ? {
                name: authorName,
                avatar: authorAvatar || '', 
                desc: authorDesc,
                detail: authorDetail
            } : null,
            isRecommended: featured, 
            summary,
            content,
            publishDate: new Date()
        };
        
        // 如果没有选择作者，使用默认作者
        if (!data.author) {
            data.author = {
                name: '系统管理员',
                avatar: '',
                desc: '',
                detail: ''
            };
        }
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/articles/${id}` : '/api/articles';
        
        fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(data)
        })
            .then(response => response.json())
            .then(data => {
                if (data && data.success === true) {
                    showToast('保存成功');
                    // 关闭模态框
                    const modal = bootstrap.Modal.getInstance(document.getElementById('artModal'));
                    modal.hide();
                    // 重新加载列表
                    if (typeof loadArticles === 'function') loadArticles();
                } else {
                    showToast(data.error || '保存失败', 'error');
                }
            })
            .catch(error => {
                console.error('保存文章失败:', error);
                showToast('保存失败，请检查网络连接或服务器状态', 'error');
            });
    } catch (error) {
        console.error('保存文章异常:', error);
        showToast('操作失败，请刷新页面后重试', 'error');
    }
}

// --- Users ---

function authHeaders() {
    const t = sessionStorage.getItem('token');
    return t ? { 'Authorization': 'Bearer ' + t } : {};
}

function loadUsers() {
    toggleLoading(true);
    fetch('/api/admins', { headers: authHeaders() })
        .then(res => res.json())
        .then(users => {
            const tbody = document.getElementById('userList');
            tbody.innerHTML = users.map(u => `
                <tr>
                    <td>${u.username}</td>
                    <td>${u.name || '-'}</td>
                    <td>${u.roles && u.roles.length ? u.roles.map(r => `<span class="badge bg-info me-1">${r.name}</span>`).join('') : '<span class="badge bg-secondary">无角色</span>'}</td>
                    <td>${u.isActive ? '<span class="text-success">正常</span>' : '<span class="text-danger">禁用</span>'}</td>
                    <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="openUserModal('${u._id}')">编辑</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u._id}')">删除</button>
                    </td>
                </tr>
            `).join('');
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
                showToast('无法加载角色列表: ' + (roles.error || '请检查权限'), 'error');
                return;
            }
            const select = document.getElementById('userRole');
            select.innerHTML = roles.map(r => `<option value="${r._id}">${r.name}</option>`).join('');
            
            if (id) {
                // Load user details
                // Ideally we should have getById API, but we can reuse the list if we had it in memory
                // Or just filter from the list if we don't want to make another call.
                // But let's assume we can fetch list and find. Or better, fetch list again? 
                // Since we don't have getById for admin, let's use the list data.
                // Wait, I didn't store the list globally.
                // Let's implement fetch detail or just iterate current list in DOM? No.
                // I'll fetch list again and find.
                fetch('/api/admins', { headers: authHeaders() })
                    .then(res => res.json())
                    .then(users => {
                        const user = users.find(u => u._id === id);
                        if (user) {
                            document.getElementById('userId').value = user._id;
                            document.getElementById('userName').value = user.username;
                            document.getElementById('userDisplayName').value = user.name || '';
                            if (user.role) select.value = user.role._id || user.role;
                            document.getElementById('userActive').checked = user.isActive;
                            new bootstrap.Modal(document.getElementById('userModal')).show();
                        }
                    });
            } else {
                new bootstrap.Modal(document.getElementById('userModal')).show();
            }
        });
}

function saveUser() {
    const id = document.getElementById('userId').value;
    const username = document.getElementById('userName').value;
    const name = document.getElementById('userDisplayName').value;
    const roleIds = Array.from(document.getElementById('userRole').selectedOptions).map(opt => opt.value);
    const pass = document.getElementById('userPass').value;

    // 密码安全策略：长度至少8位，包含字母和数字
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
        .then(async res => {
            const isJson = res.headers.get('content-type')?.includes('application/json');
            if (!isJson) {
                const text = await res.text().catch(() => '');
                throw new Error(`Server Error (${res.status}): ${text.substring(0, 50)}`);
            }
            return res.json();
        })
        .then(res => {
            if (res.success) {
            showToast('保存成功');
            bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
            loadUsers();
        } else {
            showToast(res.error || res.message, 'error');
        }
    })
    .finally(() => toggleLoading(false));
}

function deleteUser(id) {
    if (!confirm('确定删除该用户吗？')) return;
    fetch(`/api/admins/${id}`, { method: 'DELETE', headers: authHeaders() })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                showToast('删除成功');
                loadUsers();
            } else {
                showToast(res.error, 'error');
            }
        });
}

// --- Roles ---

function loadRoles() {
    toggleLoading(true);
    fetch('/api/roles', { headers: authHeaders() })
        .then(res => res.json())
        .then(roles => {
            const tbody = document.getElementById('roleList');
            tbody.innerHTML = roles.map(r => `
                <tr>
                    <td>${r.name}</td>
                    <td><code>${r.code}</code></td>
                    <td>${r.description || '-'}</td>
                    <td class="text-truncate" style="max-width: 200px;">${r.permissions.join(', ')}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="openRoleModal('${r._id}')">编辑</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteRole('${r._id}')">删除</button>
                    </td>
                </tr>
            `).join('');
        })
        .finally(() => toggleLoading(false));
}

function openRoleModal(id = null) {
    document.getElementById('roleId').value = '';
    document.getElementById('roleName').value = '';
    document.getElementById('roleCode').value = '';
    document.getElementById('roleDesc').value = '';
    
    // Render permission checkboxes
    const container = document.getElementById('permCheckboxes');
    container.innerHTML = PERMISSION_DICT.map(p => `
        <div class="form-check">
            <input class="form-check-input perm-check" type="checkbox" value="${p.code}" id="perm_${p.code}">
            <label class="form-check-label" for="perm_${p.code}">${p.name}</label>
        </div>
    `).join('');
    
    if (id) {
        fetch('/api/roles', { headers: authHeaders() }) // Reuse list api
            .then(res => res.json())
            .then(roles => {
                const role = roles.find(r => r._id === id);
                if (role) {
                    document.getElementById('roleId').value = role._id;
                    document.getElementById('roleName').value = role.name;
                    document.getElementById('roleCode').value = role.code;
                    document.getElementById('roleDesc').value = role.description || '';
                    role.permissions.forEach(p => {
                        const cb = document.getElementById(`perm_${p}`);
                        if (cb) cb.checked = true;
                    });
                    new bootstrap.Modal(document.getElementById('roleModal')).show();
                }
            });
    } else {
        new bootstrap.Modal(document.getElementById('roleModal')).show();
    }
}

function saveRole() {
    try {
        const id = document.getElementById('roleId').value;
        const perms = Array.from(document.querySelectorAll('.perm-check:checked')).map(cb => cb.value);
        
        const nameInput = document.getElementById('roleName');
        const codeInput = document.getElementById('roleCode');
        
        if (!nameInput) {
            console.error('DOM Error: roleName input not found');
            showToast('系统错误：无法获取表单元素', 'error');
            return;
        }

        const name = nameInput.value.trim();
        const code = codeInput ? codeInput.value.trim() : '';
        
        if (!name) {
            showToast('角色名称为必填项', 'error');
            return;
        }
        
        const data = {
            name,
            code,
            description: document.getElementById('roleDesc') ? document.getElementById('roleDesc').value.trim() : '',
            permissions: perms
        };
        if (id) data.id = id;
        
        if (typeof toggleLoading === 'function') toggleLoading(true);
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/roles/${id}` : '/api/roles';
        
        fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(data)
        })
            .then(async res => {
                const isJson = res.headers.get('content-type')?.includes('application/json');
                if (!isJson) {
                    const text = await res.text().catch(() => '');
                    throw new Error(`Server Error (${res.status}): ${text.substring(0, 50)}`);
                }
                return res.json();
            })
            .then(res => {
                if (res.success) {
                    showToast('保存成功');
                    const modalEl = document.getElementById('roleModal');
                    if (modalEl) {
                        const modal = bootstrap.Modal.getInstance(modalEl);
                        if (modal) modal.hide();
                    }
                    loadRoles();
                } else {
                    console.error('Save role failed:', res);
                    showToast(res.error || '保存失败', 'error');
                }
            })
            .catch(err => {
                console.error('Save role error:', err);
                showToast('请求出错: ' + err.message, 'error');
            })
            .finally(() => {
                if (typeof toggleLoading === 'function') toggleLoading(false);
            });
    } catch (e) {
        console.error('saveRole exception:', e);
        showToast('操作异常: ' + e.message, 'error');
        if (typeof toggleLoading === 'function') toggleLoading(false);
    }
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

// --- Logs ---
let logPage = 1;

function loadLogs(page = 1) {
    logPage = page;
    toggleLoading(true);
    fetch(`/api/logs?page=${page}&limit=20`)
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('logList');
            tbody.innerHTML = data.logs.map(log => `
                <tr>
                    <td>${new Date(log.createdAt).toLocaleString()}</td>
                    <td>${log.operator}</td>
                    <td>${log.action}</td>
                    <td>${log.ip || '-'}</td>
                    <td>${log.details ? JSON.stringify(log.details).substring(0, 50) : '-'}</td>
                </tr>
            `).join('');
            
            document.getElementById('logPageNum').textContent = page;
            const totalPages = Math.ceil(data.total / 20);
            document.getElementById('logTotalPages').textContent = totalPages || 1;
        })
        .finally(() => toggleLoading(false));
}

function changeLogPage(delta) {
    const newPage = logPage + delta;
    if (newPage < 1) return;
    loadLogs(newPage);
}

let trafficChart = null;

function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function fetchDashboardStats(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate && endDate) {
        params.set('startDate', startDate);
        params.set('endDate', endDate);
    }
    const res = await fetch(`/api/dashboard/stats?${params.toString()}`, { headers: authHeaders() });
    return res.json();
}

function renderTrafficChart(dates, series) {
    const el = document.getElementById('trafficChart');
    if (!el) return;
    const ctx = el.getContext('2d');
    const datasets = [
        { label: '访问量', data: series.visits, borderColor: '#7c4dff', backgroundColor: 'rgba(124,77,255,0.15)', tension: 0.3, fill: true },
        { label: '表单', data: series.appointments, borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.15)', tension: 0.3, fill: true },
        { label: '文章', data: series.articles, borderColor: '#2196f3', backgroundColor: 'rgba(33,150,243,0.15)', tension: 0.3, fill: true },
        { label: '操作日志', data: series.logs, borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.15)', tension: 0.3, fill: true }
    ];
    if (trafficChart) {
        trafficChart.data.labels = dates;
        trafficChart.data.datasets = datasets;
        trafficChart.update();
        return;
    }
    trafficChart = new Chart(ctx, {
        type: 'line',
        data: { labels: dates, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom' } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
        }
    });
}

function updateSummaryCards(summary) {
    const v = document.getElementById('sumVisits');
    const a = document.getElementById('sumAppts');
    const art = document.getElementById('sumArts');
    const f = document.getElementById('sumFaqs');
    if (v) v.textContent = summary.totalVisits?.toLocaleString('zh-CN') || '--';
    if (a) a.textContent = summary.totalAppts?.toLocaleString('zh-CN') || '--';
    if (art) art.textContent = summary.totalArts?.toLocaleString('zh-CN') || '--';
    if (f) f.textContent = summary.pendingFaqs?.toLocaleString('zh-CN') || '--';
}

async function loadDashboard(startDate, endDate) {
    const data = await fetchDashboardStats(startDate, endDate);
    if (data && !data.error) {
        renderTrafficChart(data.dates, data.series);
        updateSummaryCards(data.summary);
    }
}

function setChartRange(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const startStr = toDateStr(start);
    const endStr = toDateStr(end);
    const sEl = document.getElementById('chart-start');
    const eEl = document.getElementById('chart-end');
    if (sEl) sEl.value = startStr;
    if (eEl) eEl.value = endStr;
    const b7 = document.getElementById('btn-7d');
    const b30 = document.getElementById('btn-30d');
    if (b7 && b30) {
        b7.classList.toggle('active', days === 7);
        b30.classList.toggle('active', days === 30);
    }
    loadDashboard(startStr, endStr);
}

function applyChartDateRange() {
    const sEl = document.getElementById('chart-start');
    const eEl = document.getElementById('chart-end');
    const s = sEl ? sEl.value : '';
    const e = eEl ? eEl.value : '';
    if (!s || !e) return;
    setTimeout(() => {
        loadDashboard(s, e);
    }, 0);
}

window.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('dashboard')) {
        setChartRange(7);
    }
});

// ================= 文章侧边栏选择器 =================

let currentArticleSelectorSlot = null;

function openArticleSelector(slot) {
    currentArticleSelectorSlot = slot;
    document.getElementById('selectorKeyword').value = '';
    loadArticleSelectorList(1);
    
    const modalEl = document.getElementById('articleSelectorModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function loadArticleSelectorList(page = 1) {
    const keyword = document.getElementById('selectorKeyword').value.trim();
    const listEl = document.getElementById('articleSelectorList');
    if (!listEl) return;
    
    // Add loading state
    listEl.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div></div>';

    let url = `/api/articles?page=${page}&limit=10`;
    if (keyword) {
        url += `&keyword=${encodeURIComponent(keyword)}`;
    }

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.pagination) {
                // Paginated response
                renderSelectorList(data.data, data.pagination);
            } else {
                // Backward compatibility
                renderSelectorList(data, null);
            }
        })
        .catch(err => {
            console.error('Failed to load articles for selector:', err);
            listEl.innerHTML = '<div class="text-center text-danger p-3">加载失败</div>';
        });
}

function renderSelectorList(articles, pagination) {
    const listEl = document.getElementById('articleSelectorList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!articles || articles.length === 0) {
        listEl.innerHTML = '<div class="text-center text-muted p-3">未找到相关文章</div>';
        return;
    }

    articles.forEach(article => {
        const item = document.createElement('div');
        item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        
        const articleLink = `/article/${article.slug}.html`;
        // Escape quotes in title for the onclick handler
        const safeTitle = article.title.replace(/'/g, "\\'");
        
        // Get category name
        let categoryName = article.category || '';
        if (typeof allCategories !== 'undefined') {
            const cat = allCategories.find(c => c.code === article.category);
            if (cat) categoryName = cat.name;
        }

        item.innerHTML = `
            <div>
                <div class="fw-bold text-truncate" style="max-width: 500px;">${article.title}</div>
                <small class="text-muted">
                    <span class="badge bg-light text-dark border me-1">${categoryName}</span>
                    ${article.author?.name || article.author || 'Unknown'} | 
                    ${new Date(article.publishDate).toLocaleDateString()}
                </small>
            </div>
            <button class="btn btn-sm btn-outline-primary" onclick="selectArticle('${safeTitle}', '${articleLink}', '${categoryName}')">
                选择
            </button>
        `;
        listEl.appendChild(item);
    });

    // Add pagination controls
    if (pagination && pagination.pages > 1) {
        const pDiv = document.createElement('div');
        pDiv.className = 'd-flex justify-content-between align-items-center p-3 border-top mt-2';
        pDiv.innerHTML = `
            <button class="btn btn-sm btn-outline-secondary" ${pagination.page <= 1 ? 'disabled' : ''} onclick="loadArticleSelectorList(${pagination.page - 1})">上一页</button>
            <span class="small text-secondary">第 ${pagination.page} / ${pagination.pages} 页</span>
            <button class="btn btn-sm btn-outline-secondary" ${pagination.page >= pagination.pages ? 'disabled' : ''} onclick="loadArticleSelectorList(${pagination.page + 1})">下一页</button>
        `;
        listEl.appendChild(pDiv);
    }
}

function saveSidebar() {
    try {
        const data = {
            whitepaper: {
                title: document.getElementById('s-wp-title').value.trim(),
                img: document.getElementById('s-wp-img').value.trim(),
                link: document.getElementById('s-wp-link').value.trim(),
                desc: document.getElementById('s-wp-desc').value.trim(),
                count: document.getElementById('s-wp-count').value.trim()
            },
            recommendedArticles: [
                {
                    title: document.getElementById('s-r1-t').value.trim(),
                    link: document.getElementById('s-r1-l').value.trim(),
                    category: document.getElementById('s-r1-c').value.trim()
                },
                {
                    title: document.getElementById('s-r2-t').value.trim(),
                    link: document.getElementById('s-r2-l').value.trim(),
                    category: document.getElementById('s-r2-c').value.trim()
                }
            ]
        };
        
        fetch('/api/sidebar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('保存成功');
                loadSidebarData();
            } else {
                showToast('保存失败: ' + (data.error || '未知错误'), 'error');
            }
        })
        .catch(err => {
            console.error(err);
            showToast('请求失败', 'error');
        });
    } catch (e) {
        console.error(e);
        showToast('操作异常', 'error');
    }
}

function loadSidebarData() {
    fetch('/api/sidebar')
        .then(res => res.json())
        .then(data => {
            const wp = data.whitepaper || {};
            document.getElementById('s-wp-title').value = wp.title || '';
            document.getElementById('s-wp-img').value = wp.img || '';
            document.getElementById('s-wp-link').value = wp.link || '';
            document.getElementById('s-wp-desc').value = wp.desc || '';
            document.getElementById('s-wp-count').value = wp.count || '';
            
            const recArticles = data.recommendedArticles || [];
            if (recArticles[0]) {
                document.getElementById('s-r1-t').value = recArticles[0].title || '';
                document.getElementById('s-r1-l').value = recArticles[0].link || '';
                document.getElementById('s-r1-c').value = recArticles[0].category || '';
            }
            if (recArticles[1]) {
                document.getElementById('s-r2-t').value = recArticles[1].title || '';
                document.getElementById('s-r2-l').value = recArticles[1].link || '';
                document.getElementById('s-r2-c').value = recArticles[1].category || '';
            }
        });
}

function uploadWhitepaperImage() {
    const fileInput = document.getElementById('s-wp-img-file');
    const file = fileInput.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        showToast('图片大小不能超过2MB', 'error');
        fileInput.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    // Find the button that triggered the file input (it's the next sibling)
    const btn = fileInput.nextElementSibling;
    let originalText = '上传';
    if (btn) {
        originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '上传中...';
    }

    fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': authHeaders().Authorization },
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('s-wp-img').value = data.url;
            showToast('图片上传成功');
        } else {
            showToast('上传失败: ' + (data.error || '未知错误'), 'error');
        }
    })
    .catch(err => {
        console.error(err);
        showToast('上传出错', 'error');
    })
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
        fileInput.value = '';
    });
}

function selectArticle(title, link, category) {
    if (!currentArticleSelectorSlot) return;
    
    document.getElementById(`s-${currentArticleSelectorSlot}-t`).value = title;
    document.getElementById(`s-${currentArticleSelectorSlot}-l`).value = link;
    document.getElementById(`s-${currentArticleSelectorSlot}-c`).value = category;
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('articleSelectorModal'));
    if (modal) modal.hide();
    
    currentArticleSelectorSlot = null;
}

function clearArticleSelection(slot) {
    document.getElementById(`s-${slot}-t`).value = '';
    document.getElementById(`s-${slot}-l`).value = '';
    document.getElementById(`s-${slot}-c`).value = '';
}
