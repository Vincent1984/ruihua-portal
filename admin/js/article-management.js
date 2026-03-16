// ================= Article Management Module =================

let allCategories = [];

function loadCategories() {
    fetch('/api/categories')
        .then(res => res.json())
        .then(data => {
            allCategories = data;
            // Populate select
            const select = document.getElementById('artCategory');
            if(select) {
                select.innerHTML = '<option value="">选择分类...</option>' + 
                    data.map(c => `<option value="${c.code}">${c.name}</option>`).join('');
            }
            // Populate list in category modal
            const list = document.getElementById('categoryList');
            if(list) {
                list.innerHTML = data.map(c => `
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <span class="fw-bold">${c.name}</span> <small class="text-muted">(${c.code})</small>
                            <span class="badge bg-light text-dark ms-2">排序: ${c.order || 0}</span>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-link text-primary" onclick="editCategory('${c._id}', '${c.name}', '${c.code}', ${c.order})"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-link text-danger" onclick="deleteCategory('${c._id}')"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                `).join('');
            }
        })
        .catch(err => showToast('加载分类列表失败', 'error'));
}

function openCategoryModal() {
    loadCategories();
    document.getElementById('catId').value = '';
    document.getElementById('catName').value = '';
    document.getElementById('catCode').value = '';
    document.getElementById('catOrder').value = 0;
    new bootstrap.Modal(document.getElementById('categoryModal')).show();
}

function editCategory(id, name, code, order) {
    document.getElementById('catId').value = id;
    document.getElementById('catName').value = name;
    document.getElementById('catCode').value = code;
    document.getElementById('catOrder').value = order || 0;
}

function saveCategory() {
    const id = document.getElementById('catId').value;
    const data = {
        name: document.getElementById('catName').value.trim(),
        code: document.getElementById('catCode').value.trim(),
        order: parseInt(document.getElementById('catOrder').value) || 0
    };
    
    if(!data.name || !data.code) {
        showToast('名称和代码必填', 'error');
        return;
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/categories/${id}` : '/api/categories';

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        if(res.success) {
            showToast('保存成功');
            document.getElementById('catId').value = '';
            document.getElementById('catName').value = '';
            document.getElementById('catCode').value = '';
            loadCategories();
        } else {
            showToast(res.error, 'error');
        }
    });
}

function deleteCategory(id) {
    if(!confirm('确定删除分类吗？')) return;
    fetch(`/api/categories/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then(res => res.json())
    .then(res => {
        if(res.success) {
            showToast('删除成功');
            loadCategories();
        } else showToast(res.error, 'error');
    });
}

let quillEditor;
window.quillEditor = quillEditor; // Expose to window for debugging and access
let autoSaveTimer = null;

// Initialize Quill
document.addEventListener('DOMContentLoaded', () => {
    // Check for Bootstrap
    if (typeof bootstrap === 'undefined' && typeof window.bootstrap === 'undefined') {
        console.error('Bootstrap library not loaded');
        showToast('UI组件加载失败，部分功能可能无法使用', 'warning');
    }

    // Only init if editor exists
    if(document.getElementById('editor')) {
        // Check if Quill is loaded
        if (typeof Quill === 'undefined') {
            console.error('Quill library not loaded');
            const editorContainer = document.getElementById('editor');
            editorContainer.innerHTML = `
                <div class="d-flex flex-column align-items-center justify-content-center h-100 text-danger bg-light border border-danger rounded p-3">
                    <i class="bi bi-exclamation-triangle-fill fs-1 mb-2"></i>
                    <h4>编辑器组件加载失败</h4>
                    <p class="mb-0">请检查网络连接或刷新页面重试</p>
                </div>
            `;
            showToast('编辑器组件加载失败，请检查网络连接', 'error');
        } else {
            try {
                quillEditor = new Quill('#editor', {
                    theme: 'snow',
                    modules: {
                        toolbar: {
                            container: [
                                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                                ['bold', 'italic', 'underline', 'strike'],
                                [{ 'color': [] }, { 'background': [] }],
                                [{ 'align': [] }],
                                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                ['link', 'image', 'code-block'],
                                ['clean']
                            ],
                            handlers: {
                                'image': imageHandler
                            }
                        },
                        syntax: true, // Requires highlight.js
                        history: {
                            delay: 2000,
                            maxStack: 500,
                            userOnly: true
                        }
                    }
                });
                window.quillEditor = quillEditor; // Update global reference

                // Word Count and Auto Save Listener
                quillEditor.on('text-change', () => {
                    updateWordCount();
                    triggerAutoSave();
                });
                
                // Check for local draft
                checkLocalDraft();
            } catch (e) {
                console.error('Quill init error:', e);
                showToast('编辑器初始化出错: ' + e.message, 'error');
                const editorContainer = document.getElementById('editor');
                if (editorContainer) {
                    editorContainer.innerHTML = `
                        <div class="alert alert-danger">
                            编辑器初始化出错: ${e.message}
                        </div>
                    `;
                }
            }
        }
    }
    
    loadCategories();
    loadArticles();
});

// Image Handler for Quill
function imageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Save current selection range
            const range = quillEditor.getSelection(true);
            
            // Show placeholder
            quillEditor.insertText(range.index, 'Uploading...', 'bold', true);

            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': authHeaders().Authorization },
                body: formData
            });
            const data = await res.json();

            // Remove placeholder
            quillEditor.deleteText(range.index, 12);

            if (data.success) {
                quillEditor.insertEmbed(range.index, 'image', data.url);
            } else {
                showToast('Image upload failed', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Image upload error', 'error');
        }
    };
}

function updateWordCount() {
    const text = quillEditor.getText();
    const count = text.trim().length > 0 ? text.trim().length : 0;
    const el = document.getElementById('wordCount');
    if(el) {
        el.textContent = `${count} 字`;
        if(count > 10000) el.classList.add('text-danger');
        else el.classList.remove('text-danger');
    }
}

function triggerAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    document.getElementById('saveStatus').classList.add('d-none');
    
    autoSaveTimer = setTimeout(() => {
        const content = quillEditor.root.innerHTML;
        const title = document.getElementById('artTitle').value;
        if (content && content !== '<p><br></p>') {
            const draft = {
                title: title,
                content: content,
                timestamp: Date.now()
            };
            localStorage.setItem('art_draft', JSON.stringify(draft));
            
            const statusEl = document.getElementById('saveStatus');
            if(statusEl) {
                statusEl.classList.remove('d-none');
                statusEl.innerHTML = `<i class="bi bi-check"></i> 已保存 (${new Date().toLocaleTimeString()})`;
            }
        }
    }, 2000); // Auto save after 2s of inactivity
}

function checkLocalDraft() {
    const draft = localStorage.getItem('art_draft');
    if (draft) {
        try {
            const data = JSON.parse(draft);
            // Only suggest draft if we are creating a new article (no ID)
            if (!document.getElementById('artId').value && (Date.now() - data.timestamp < 24 * 60 * 60 * 1000)) {
                if(confirm('检测到未保存的草稿，是否恢复？')) {
                    document.getElementById('artTitle').value = data.title || '';
                    quillEditor.root.innerHTML = data.content || '';
                } else {
                    localStorage.removeItem('art_draft');
                }
            }
        } catch(e) {}
    }
}

// History Management
function showHistory() {
    const id = document.getElementById('artId').value;
    if (!id) {
        showToast('请先保存文章才能查看历史记录', 'warning');
        return;
    }
    
    fetch(`/api/articles/${id}/history`, { headers: authHeaders() })
    .then(res => res.json())
    .then(data => {
        const list = document.getElementById('historyList');
        if (data.length === 0) {
            list.innerHTML = '<div class="text-center p-3 text-muted">暂无历史记录</div>';
        } else {
            list.innerHTML = data.map(h => `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">版本 ${h.version}</h6>
                            <small class="text-muted">
                                修改人: ${h.editor} | 时间: ${new Date(h.createdAt).toLocaleString()}
                            </small>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-primary" onclick="previewHistory('${h._id}')">查看</button>
                            <button class="btn btn-sm btn-outline-danger" onclick="restoreHistory('${id}', '${h._id}')">回滚</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        new bootstrap.Modal(document.getElementById('historyModal')).show();
    })
    .catch(err => showToast('获取历史记录失败', 'error'));
}

function previewHistory(historyId) {
    fetch(`/api/articles/history/${historyId}`, { headers: authHeaders() })
    .then(res => res.json())
    .then(data => {
        if(data.error) return showToast(data.error, 'error');
        // Open a simple preview window or replace current editor content temporarily?
        // Let's replace editor content but warn user
        if(confirm('预览将覆盖当前编辑器内容（未保存的内容将丢失），确定预览吗？')) {
            document.getElementById('artTitle').value = data.title;
            quillEditor.root.innerHTML = data.content;
            document.getElementById('artDesc').value = data.summary || '';
            bootstrap.Modal.getInstance(document.getElementById('historyModal')).hide();
        }
    });
}

function restoreHistory(articleId, historyId) {
    if(!confirm('确定回滚到此版本吗？当前版本将自动保存为新历史记录。')) return;
    
    fetch(`/api/articles/${articleId}/restore/${historyId}`, {
        method: 'POST',
        headers: authHeaders()
    })
    .then(res => res.json())
    .then(res => {
        if(res.success) {
            showToast('回滚成功');
            bootstrap.Modal.getInstance(document.getElementById('historyModal')).hide();
            // Reload article
            openArtModal(articleId);
        } else {
            showToast(res.error, 'error');
        }
    });
}

// Global Exports
window.showHistory = showHistory;
window.previewHistory = previewHistory;
window.restoreHistory = restoreHistory;

function searchArticles() {
    const keyword = document.getElementById('artSearchKeyword').value.trim();
    const status = document.getElementById('artSearchStatus').value;
    loadArticles(keyword, status);
}

function loadArticles(keyword = '', status = '') {
    let url = '/api/articles?limit=100'; // Get more for admin list
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    if (status) url += `&status=${status}`;
    
    toggleLoading(true);
    fetch(url)
    .then(res => res.json())
    .then(data => {
        const list = Array.isArray(data) ? data : (data.data || []);
        const tbody = document.getElementById('artList');
        if(!tbody) return;
        
        const statusMap = {
            'published': '<span class="badge bg-success">已发布</span>',
            'draft': '<span class="badge bg-secondary">草稿</span>',
            'archived': '<span class="badge bg-warning text-dark">归档</span>'
        };

        tbody.innerHTML = list.map((art, idx) => {
            const statusBadge = statusMap[art.status] || statusMap['published'];
            const tagsHtml = (art.tags && art.tags.length) ? 
                `<div class="small text-muted mt-1"><i class="bi bi-tags"></i> ${art.tags.join(', ')}</div>` : '';

            return `
            <tr>
                <td><input type="checkbox" class="form-check-input art-check" value="${art._id}"></td>
                <td>${idx + 1}</td>
                <td>
                    <div class="text-truncate" style="max-width: 300px;" title="${art.title}">
                        ${art.isRecommended ? '<i class="bi bi-star-fill text-warning me-1"></i>' : ''}
                        ${art.title}
                    </div>
                    ${tagsHtml}
                </td>
                <td>${getCategoryName(art.category)}</td>
                <td>${art.author?.name || art.author || '-'}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="openArtModal('${art._id}')">编辑</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteArticle('${art._id}')">删除</button>
                </td>
            </tr>
        `}).join('');
        
        document.getElementById('artSelectedCount').textContent = '0';
        document.getElementById('artBatchActions').classList.add('d-none');
    })
    .finally(() => toggleLoading(false));
}

function getCategoryName(code) {
    const cat = allCategories.find(c => c.code === code);
    return cat ? cat.name : code || '-';
}

function deleteArticle(id) {
    if(!confirm('确定删除？')) return;
    fetch(`/api/articles/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then(res => res.json())
    .then(res => {
        if(res.success) {
            showToast('删除成功');
            loadArticles();
        } else showToast(res.error, 'error');
    });
}

function batchDeleteArt() {
    const ids = Array.from(document.querySelectorAll('.art-check:checked')).map(cb => cb.value);
    if(ids.length === 0) return;
    
    if(!confirm(`确定删除选中的 ${ids.length} 篇文章吗？`)) return;
    
    toggleLoading(true);
    Promise.all(ids.map(id => fetch(`/api/articles/${id}`, { method: 'DELETE', headers: authHeaders() })))
    .then(() => {
        showToast('批量删除完成');
        loadArticles();
    })
    .finally(() => toggleLoading(false));
}

function batchStatusArt(status) {
    const ids = Array.from(document.querySelectorAll('.art-check:checked')).map(cb => cb.value);
    if(ids.length === 0) return;
    
    const statusText = { 'published': '发布', 'draft': '设为草稿', 'archived': '归档' }[status];
    if(!confirm(`确定将选中的 ${ids.length} 篇文章${statusText}吗？`)) return;
    
    toggleLoading(true);
    fetch('/api/articles/batch-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ids, status })
    })
    .then(res => res.json())
    .then(res => {
        if(res.success) {
            showToast('批量操作成功');
            loadArticles();
        } else {
            showToast(res.error, 'error');
        }
    })
    .finally(() => toggleLoading(false));
}

function toggleAll(listId, source) {
    const checks = document.querySelectorAll(`#${listId} input[type="checkbox"]`);
    checks.forEach(cb => cb.checked = source.checked);
    updateSelectionCount(listId);
}

function updateSelectionCount(listId) {
    const count = document.querySelectorAll(`#${listId} input[type="checkbox"]:checked`).length;
    if (listId === 'artList') {
        document.getElementById('artSelectedCount').textContent = count;
        const actions = document.getElementById('artBatchActions');
        if(count > 0) actions.classList.remove('d-none');
        else actions.classList.add('d-none');
    } else if (listId === 'faqList') {
        document.getElementById('faqSelectedCount').textContent = count;
        const actions = document.getElementById('faqBatchActions');
        if(count > 0) actions.classList.remove('d-none');
        else actions.classList.add('d-none');
    }
}

// Add event listener for checkboxes to update count
document.addEventListener('change', e => {
    if(e.target.classList.contains('art-check')) updateSelectionCount('artList');
    if(e.target.classList.contains('faq-check')) updateSelectionCount('faqList');
});

// Article Editor
function openArtModal(id = null) {
    try {
        // Ensure Quill is initialized
        const editorEl = document.getElementById('editor');
        if (!editorEl) {
            console.error('Editor element #editor not found!');
            showToast('编辑器初始化失败：找不到容器', 'error');
            return;
        }

        if (typeof window.quillEditor === 'undefined' || !window.quillEditor) {
            console.warn('Quill editor not initialized, initializing now...');
            try {
                window.quillEditor = new Quill('#editor', {
                    theme: 'snow',
                    modules: {
                        toolbar: {
                            container: [
                                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                                ['bold', 'italic', 'underline', 'strike'],
                                [{ 'color': [] }, { 'background': [] }],
                                [{ 'align': [] }],
                                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                ['link', 'image', 'code-block'],
                                ['clean']
                            ],
                            handlers: { 'image': imageHandler }
                        },
                        syntax: true,
                        history: { delay: 2000, maxStack: 500, userOnly: true }
                    }
                });
                window.quillEditor.on('text-change', () => {
                    updateWordCount();
                    triggerAutoSave();
                });
            } catch (e) {
                console.error('Quill Init Error:', e);
                showToast('编辑器加载失败，请刷新页面重试', 'error');
            }
        }

        // Reset form
        document.getElementById('artId').value = '';
        document.getElementById('artTitle').value = '';
        document.getElementById('artSlug').value = '';
        document.getElementById('slugPreview').textContent = '';
        document.getElementById('artCover').value = '';
        document.getElementById('artCategory').value = '';
        document.getElementById('artAuthor').value = '';
        document.getElementById('artStatus').value = 'published';
        document.getElementById('artTags').value = '';
        document.getElementById('artFeatured').checked = false;
        document.getElementById('artDesc').value = '';
        
        // Reset Avatar
        document.getElementById('artAuthorAvatar').value = '';
        const avatarPreview = document.getElementById('artAuthorAvatarPreview');
        if(avatarPreview) {
            avatarPreview.src = '';
            avatarPreview.classList.add('d-none');
        }
        document.getElementById('artAuthorAvatarFile').value = '';
        
        // Clear Editor
        if (window.quillEditor) {
            window.quillEditor.setContents([]);
            window.quillEditor.root.innerHTML = ''; 
        } else if (editorEl.querySelector('.ql-editor')) {
            editorEl.querySelector('.ql-editor').innerHTML = '';
        } else {
            editorEl.innerHTML = '';
        }
        
        if (id) {
            toggleLoading(true);
            fetch(`/api/articles/${id}`)
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) {
                        document.getElementById('artId').value = data._id;
                        document.getElementById('artTitle').value = data.title || '';
                        document.getElementById('artSlug').value = data.slug || '';
                        previewSlug();
                        document.getElementById('artCover').value = data.coverImage || '';
                        document.getElementById('artCategory').value = data.category || '';
                        document.getElementById('artStatus').value = data.status || 'published';
                        document.getElementById('artTags').value = (data.tags || []).join(', ');
                        
                        const author = data.author || {};
                        document.getElementById('artAuthor').value = author.name || (typeof data.author === 'string' ? data.author : '');
                        document.getElementById('artAuthorDesc').value = author.desc || '';
                        document.getElementById('artAuthorDetail').value = author.detail || '';
                        if (author.avatar) {
                            document.getElementById('artAuthorAvatar').value = author.avatar;
                            if(avatarPreview) {
                                avatarPreview.src = author.avatar;
                                avatarPreview.classList.remove('d-none');
                            }
                        }
                        
                        document.getElementById('artFeatured').checked = data.isRecommended || false;
                        document.getElementById('artDesc').value = data.summary || '';
                        
                        const content = data.content || '';
                        if (window.quillEditor) {
                            // Use clipboard dangerouslyPasteHTML to ensure proper formatting
                            // Use a small timeout to ensure editor is ready
                            setTimeout(() => {
                                window.quillEditor.clipboard.dangerouslyPasteHTML(content);
                            }, 10);
                        } else {
                            const qlEditor = editorEl.querySelector('.ql-editor');
                            if(qlEditor) qlEditor.innerHTML = content;
                            else editorEl.innerHTML = content;
                        }
                    } else {
                        showToast('加载文章详情失败: ' + (data.error || '未知错误'), 'error');
                    }
                })
                .catch(err => {
                    console.error(err);
                    showToast('请求文章详情失败', 'error');
                })
                .finally(() => toggleLoading(false));
        }
        
        // Show Modal using global bootstrap or window.bootstrap
        const modalEl = document.getElementById('artModal');
        const bs = window.bootstrap || bootstrap;
        if (bs && modalEl) {
            const modal = bs.Modal.getInstance(modalEl) || new bs.Modal(modalEl);
            modal.show();
        } else {
            console.error('Bootstrap Modal not available');
            showToast('无法打开弹窗，Bootstrap未加载', 'error');
        }
    } catch (e) {
        console.error('openArtModal Error:', e);
        showToast('打开编辑器出错: ' + e.message, 'error');
    }
}

function saveArt() {
    const id = document.getElementById('artId').value;
    
    // Debug Log
    console.log('Saving Article...');
    console.log('Quill Editor Instance:', window.quillEditor);
    
    let content = '';
    if (typeof window.quillEditor !== 'undefined' && window.quillEditor) {
        content = window.quillEditor.root.innerHTML;
        console.log('Content from Quill:', content.substring(0, 50) + '...');
    } else {
        console.error('Quill Editor is undefined!');
        // Fallback: try to find editor content manually if possible, or alert
        const editorEl = document.querySelector('#editor .ql-editor');
        if (editorEl) {
            content = editorEl.innerHTML;
            console.log('Content from DOM fallback:', content.substring(0, 50) + '...');
        }
    }

    const data = {
        title: document.getElementById('artTitle').value.trim(),
        slug: document.getElementById('artSlug').value.trim(),
        coverImage: document.getElementById('artCover').value.trim(),
        category: document.getElementById('artCategory').value,
        status: document.getElementById('artStatus').value,
        tags: document.getElementById('artTags').value.split(/[,，]/).map(t => t.trim()).filter(t => t),
        isRecommended: document.getElementById('artFeatured').checked,
        summary: document.getElementById('artDesc').value.trim(),
        content: content,
        author: {
            name: document.getElementById('artAuthor').value.trim(),
            avatar: document.getElementById('artAuthorAvatar').value,
            desc: document.getElementById('artAuthorDesc').value.trim(),
            detail: document.getElementById('artAuthorDetail').value.trim()
        }
    };
    
    console.log('Data to send:', data);

    if (!data.title) { showToast('标题不能为空', 'error'); return; }
    if (!data.content || data.content === '<p><br></p>') {
        showToast('文章内容不能为空', 'error');
        return;
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/articles/${id}` : '/api/articles';

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        if(res.success) {
            showToast('保存成功');
            bootstrap.Modal.getInstance(document.getElementById('artModal')).hide();
            loadArticles();
        } else showToast(res.error, 'error');
    });
}

function autoGenerateSlug(forceAi = false) {
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

        // Call backend API for slug generation
        fetch('/api/tools/slug', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders()
            },
            body: JSON.stringify({ text: title, forceAi: true })
        })
        .then(res => res.json())
        .then(data => {
            if (data.slug) {
                slugInput.value = data.slug;
                previewSlug();
                showToast('智能Slug生成成功');
            } else {
                showToast('生成失败: ' + (data.error || '未知错误'), 'error');
            }
        })
        .catch(e => {
            console.error('Slug AI Error:', e);
            // Fallback to simple generation on error
            slugInput.value = 'post-' + Date.now(); 
            previewSlug();
            showToast('生成请求失败，已使用随机Slug', 'warning');
        })
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalIcon;
            }
        });
    } else if (!slugInput.value) {
        // Simple client-side pinyin or random if not forced AI
        // Ideally use a pinyin library if available, but for now simple fallback
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
        preview.textContent = `预览: /article/${cleanSlug}.html`;
    } else {
        preview.textContent = '';
    }
}

function uploadCover() {
    const file = document.getElementById('artCoverFile').files[0];
    if(!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': authHeaders().Authorization },
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            document.getElementById('artCover').value = data.url;
            showToast('上传成功');
        } else showToast('上传失败', 'error');
    });
}

function uploadAuthorAvatar() {
    const file = document.getElementById('artAuthorAvatarFile').files[0];
    if(!file) return;
    const formData = new FormData();
    formData.append('file', file);
    
    fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': authHeaders().Authorization },
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            document.getElementById('artAuthorAvatar').value = data.url;
            document.getElementById('artAuthorAvatarPreview').src = data.url;
            document.getElementById('artAuthorAvatarPreview').classList.remove('d-none');
        }
    });
}

function clearAuthorAvatar() {
    document.getElementById('artAuthorAvatar').value = '';
    document.getElementById('artAuthorAvatarPreview').classList.add('d-none');
}

// Selector Logic
function openArticleSelector(slot) {
    window.currentArticleSelectorSlot = slot;
    document.getElementById('selectorKeyword').value = '';
    loadArticleSelectorList(1);
    new bootstrap.Modal(document.getElementById('articleSelectorModal')).show();
}

function loadArticleSelectorList(page=1) {
    const kw = document.getElementById('selectorKeyword').value;
    const list = document.getElementById('articleSelectorList');
    if(list) list.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>';

    fetch(`/api/articles?page=${page}&limit=10&keyword=${kw}`)
    .then(res => res.json())
    .then(res => {
        const data = res.data || [];
        if(data.length === 0) {
            if(list) list.innerHTML = '<div class="text-center text-muted py-3">无文章</div>';
            return;
        }
        if(list) {
            list.innerHTML = data.map(art => `
                <button class="list-group-item list-group-item-action" onclick="selectArticle('${art.title.replace(/'/g, "\\'")}', '/article/${art.slug}.html', '${art.category}')">
                    ${art.title} <small class="text-muted">(${art.author?.name || '-'})</small>
                </button>
            `).join('');
        }
    })
    .catch(err => {
        console.error(err);
        if(list) list.innerHTML = '<div class="text-danger text-center py-3">加载失败，请重试</div>';
    });
}

function selectArticle(title, link, category) {
    if(window.currentArticleSelectorSlot) {
        document.getElementById(`s-${window.currentArticleSelectorSlot}-t`).value = title;
        document.getElementById(`s-${window.currentArticleSelectorSlot}-l`).value = link;
        document.getElementById(`s-${window.currentArticleSelectorSlot}-c`).value = category;
    }
    bootstrap.Modal.getInstance(document.getElementById('articleSelectorModal')).hide();
}

function clearArticleSelection(slot) {
    document.getElementById(`s-${slot}-t`).value = '';
    document.getElementById(`s-${slot}-l`).value = '';
    document.getElementById(`s-${slot}-c`).value = '';
}

// Export globals
window.loadCategories = loadCategories;
window.openCategoryModal = openCategoryModal;
window.editCategory = editCategory;
window.saveCategory = saveCategory;
window.deleteCategory = deleteCategory;
window.searchArticles = searchArticles;
window.loadArticles = loadArticles;
window.deleteArticle = deleteArticle;
window.batchDeleteArt = batchDeleteArt;
window.toggleAll = toggleAll;
window.openArtModal = openArtModal;
window.saveArt = saveArt;
window.autoGenerateSlug = autoGenerateSlug;
window.previewSlug = previewSlug;
window.uploadCover = uploadCover;
window.uploadAuthorAvatar = uploadAuthorAvatar;
window.clearAuthorAvatar = clearAuthorAvatar;
window.openArticleSelector = openArticleSelector;
window.loadArticleSelectorList = loadArticleSelectorList;
window.selectArticle = selectArticle;
window.clearArticleSelection = clearArticleSelection;
