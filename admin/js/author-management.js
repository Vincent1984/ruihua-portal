let authors = [];
const esc = (v = '') => String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Load Authors
async function loadAuthors() {
    try {
        const res = await fetch('/api/authors', {
            headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
        });
        authors = await res.json();
        renderAuthorTable();
    } catch (e) {
        console.error('Load authors failed', e);
    }
}

// Render Table
function renderAuthorTable() {
    const tbody = document.getElementById('authorList');
    if (!tbody) return;
    
    tbody.innerHTML = authors.map(author => `
        <tr>
            <td><img src="${esc(author.avatar || '/fallback-image/avatar')}" class="rounded-circle" style="width:40px;height:40px;object-fit:cover"></td>
            <td>${esc(author.name)}</td>
            <td>${esc(author.desc || '-')}</td>
            <td>${new Date(author.createdAt).toLocaleDateString()}</td>
            <td data-author-id="${esc(author._id)}">
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editAuthor('${esc(author._id)}')"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteAuthor('${esc(author._id)}')"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// Open Modal
function openAuthorModal(authorId = null) {
    const modal = new bootstrap.Modal(document.getElementById('authorModal'));
    
    if (authorId) {
        const author = authors.find(a => a._id === authorId);
        document.getElementById('authorId').value = author._id;
        document.getElementById('authorName').value = author.name;
        document.getElementById('authorAvatar').value = author.avatar || '';
        document.getElementById('authorDesc').value = author.desc || '';
        document.getElementById('authorDetail').value = author.detail || '';
        
        if (author.avatar) {
            document.getElementById('authorAvatarPreview').querySelector('img').src = author.avatar;
            document.getElementById('authorAvatarPreview').classList.remove('d-none');
        } else {
            document.getElementById('authorAvatarPreview').classList.add('d-none');
        }
    } else {
        document.getElementById('authorId').value = '';
        document.getElementById('authorName').value = '';
        document.getElementById('authorAvatar').value = '';
        document.getElementById('authorDesc').value = '';
        document.getElementById('authorDetail').value = '';
        document.getElementById('authorAvatarPreview').classList.add('d-none');
    }
    
    modal.show();
}

// Edit Wrapper
function editAuthor(id) {
    openAuthorModal(id);
}

// Save Author
async function saveAuthor() {
    const id = document.getElementById('authorId').value;
    const data = {
        name: document.getElementById('authorName').value,
        avatar: document.getElementById('authorAvatar').value,
        desc: document.getElementById('authorDesc').value,
        detail: document.getElementById('authorDetail').value
    };
    
    if (!data.name) return alert('姓名不能为空');
    
    try {
        const url = id ? `/api/authors/${id}` : '/api/authors';
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessionStorage.getItem('token')
            },
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('authorModal')).hide();
            loadAuthors();
            // Refresh author select in article modal if open or available
            if (typeof loadAuthorOptions === 'function') loadAuthorOptions();
        } else {
            alert('保存失败');
        }
    } catch (e) {
        console.error(e);
        alert('网络错误');
    }
}

// Delete Author
async function deleteAuthor(id) {
    if (!confirm('确定删除该专家吗？')) return;
    try {
        const res = await fetch(`/api/authors/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
        });
        if (res.ok) loadAuthors();
        else alert('删除失败');
    } catch (e) {
        alert('网络错误');
    }
}

// Upload Image Logic
async function uploadAuthorImage() {
    const fileInput = document.getElementById('authorAvatarFile');
    const file = fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    
    // Use author ID if editing, else 'new'
    const id = document.getElementById('authorId').value || 'new';

    try {
        const token = sessionStorage.getItem('token');
        if (!token) {
            alert('会话已过期，请重新登录');
            window.location.href = 'login.html';
            return;
        }

        const res = await fetch(`/api/upload/author/${id}`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        
        if (res.status === 401) {
             alert('登录已过期，请重新登录');
             window.location.href = 'login.html';
             return;
        }

        const data = await res.json();
        if (data.success && data.url) {
            document.getElementById('authorAvatar').value = data.url;
            const preview = document.getElementById('authorAvatarPreview');
            preview.querySelector('img').src = data.url;
            preview.classList.remove('d-none');
        } else {
            alert('上传失败: ' + (data.error || data.message || `服务器返回 HTTP ${res.status}`));
        }
    } catch (e) {
        console.error(e);
        alert('上传失败: 无法连接服务器，请确认后台地址为当前服务并刷新页面');
    }
}

// Expose globally
window.loadAuthors = loadAuthors;
window.openAuthorModal = openAuthorModal;
window.editAuthor = editAuthor;
window.saveAuthor = saveAuthor;
window.deleteAuthor = deleteAuthor;
window.uploadAuthorImage = uploadAuthorImage;
