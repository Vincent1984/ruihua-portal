// ================= Article Management Module =================

let allCategories = [];
let wangEditorInstance;
let wangEditorToolbar;

function loadCategories() {
    fetch('/api/categories')
        .then(res => res.json())
        .then(data => {
            allCategories = data;
            // Populate select
            const select = document.getElementById('artCategory');
            if(select) {
                select.innerHTML = '<option value="">选择分类...</option>' + 
                    data.map(c => `<option value="${c.code}">${c.name}</option>`).join('') +
                    '<option value="__new__">＋ 新增分类</option>';
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


// --- Author Selection Logic ---
let authorOptions = [];

function loadAuthorOptions() {
    fetch('/api/authors', { headers: authHeaders() })
        .then(res => res.json())
        .then(data => {
            authorOptions = data;
            const select = document.getElementById('artAuthorSelect');
            if (select) {
                // Keep the default and manual options
                select.innerHTML = `
                    <option value="">选择作者...</option>
                    <option value="manual">手动输入</option>
                    ${data.map(a => `<option value="${a._id}">${a.name}</option>`).join('')}
                `;
            }
        })
        .catch(err => console.error('Load authors failed', err));
}

function onAuthorSelectChange() {
    const select = document.getElementById('artAuthorSelect');
    const manualDiv = document.getElementById('manualAuthorFields');
    const val = select.value;
    manualDiv.hidden = val !== 'manual';
    if (val === 'manual') document.getElementById('artAuthor').focus();
}

function onCategorySelectChange() {
    const select = document.getElementById('artCategory');
    const fields = document.getElementById('newCategoryFields');
    fields.hidden = select.value !== '__new__';
    if (!fields.hidden) document.getElementById('newCategoryName').focus();
}

async function saveInlineCategory() {
    const name = document.getElementById('newCategoryName').value.trim();
    const code = normalizeSeoSlug(document.getElementById('newCategoryCode').value || name);
    if (!name || !code) return showToast('请填写分类名称和英文代码', 'warning');
    const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name, code, order: allCategories.length })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) return showToast(result.error || '新增分类失败', 'error');
    allCategories.push(result.data);
    const select = document.getElementById('artCategory');
    select.insertBefore(new Option(result.data.name, result.data.code), select.lastElementChild);
    select.value = result.data.code;
    document.getElementById('newCategoryFields').hidden = true;
    showToast('分类已新增并选中');
}
window.loadAuthorOptions = loadAuthorOptions;
window.onAuthorSelectChange = onAuthorSelectChange;
window.onCategorySelectChange = onCategorySelectChange;
window.saveInlineCategory = saveInlineCategory;

let editor;
let autoSaveTimer;

document.addEventListener('DOMContentLoaded', () => {
    // Check for Bootstrap
    if (typeof bootstrap === 'undefined' && typeof window.bootstrap === 'undefined') {
        console.error('Bootstrap library not loaded');
        showToast('UI组件加载失败，部分功能可能无法使用', 'warning');
    }

    // Init WangEditor v5
    const editorContainer = document.getElementById('editor-container');
    const toolbarContainer = document.getElementById('editor-toolbar');
    
    if (editorContainer && toolbarContainer) {
        if (!window.wangEditorInstance) {
            try {
                if (typeof window.wangEditor === 'undefined') throw new Error('WangEditor not loaded');
                
                const { createEditor, createToolbar } = window.wangEditor;

                const editorConfig = {
                    placeholder: '请输入文章内容...',
                    MENU_CONF: {
                        uploadImage: {
                            server: '/api/upload',
                            fieldName: 'file',
                            headers: {
                                Authorization: authHeaders().Authorization
                            },
                            maxFileSize: 10 * 1024 * 1024, // Align with backend limit (10MB)
                            maxNumberOfFiles: 10,
                            allowedFileTypes: ['image/*'],
                            customInsert(res, insertFn) {
                                if (res.success && res.url) {
                                    insertFn(res.url, '图片', res.url);
                                } else {
                                    showToast(res.error || '图片上传失败', 'error');
                                }
                            },
                            onFailed(file, res) {
                                const msg = res?.error || '上传失败，请检查文件格式/大小';
                                showToast(`${file.name}：${msg}`, 'error');
                            },
                            onError(file, err, res) {
                                console.error('Upload Error:', err, res);
                                const msg = res?.error || err?.message || '上传出错，请稍后重试';
                                showToast(`${file.name}：${msg}`, 'error');
                            }
                        }
                    },
                    onChange(editor) {
                        updateWordCount();
                        triggerAutoSave();
                    }
                };

                const editor = createEditor({
                    selector: '#editor-container',
                    html: '',
                    config: editorConfig,
                    mode: 'default' // or 'simple'
                });

                const toolbarConfig = {};

                const toolbar = createToolbar({
                    editor,
                    selector: '#editor-toolbar',
                    config: toolbarConfig,
                    mode: 'default'
                });

                window.wangEditorInstance = editor;
                window.wangEditorToolbar = toolbar;

            } catch(e) {
                console.error('WangEditor init error:', e);
            }
        }
    }
    
    checkLocalDraft();
    loadCategories();
    loadArticles();
});

// Smart Format (One-click Layout)
function smartFormat() {
    if (window.wangEditorInstance) {
        // WangEditor v5 provides getHtml(). We can parse it, clean it, and setHtml()
        // Or simply remove specific styles.
        // For simplicity, we can just show a toast or implement a basic regex cleaner.
        let html = window.wangEditorInstance.getHtml();
        // Remove background-color
        html = html.replace(/background-color:[^;]+;/gi, '');
        // Remove font-family
        html = html.replace(/font-family:[^;]+;/gi, '');
        window.wangEditorInstance.setHtml(html);
        showToast('已清除杂乱格式，还原为标准排版');
    }
}

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
            const range = quillEditor.getSelection(true);
            quillEditor.insertText(range.index, 'Uploading...', 'bold', true);

            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') },
                body: formData
            });
            const data = await res.json();

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

// Override Word Count
function updateWordCount() {
    let count = 0;
    if (window.wangEditorInstance) {
        const text = window.wangEditorInstance.getText();
        count = text.trim().length;
    }
    
    ['wordCount', 'studioWordCount'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.textContent = `${count} 字`;
            if(count > 10000) el.classList.add('text-danger');
            else el.classList.remove('text-danger');
        }
    });
}

// Override Auto Save
function triggerAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    document.getElementById('saveStatus').classList.add('d-none');
    
    autoSaveTimer = setTimeout(() => {
        let content = '';
        if (window.wangEditorInstance) {
             content = window.wangEditorInstance.getHtml();
        }
        
        const title = document.getElementById('artTitle').value;
        if (content && content.trim() !== '' && content !== '<p><br></p>') {
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
    }, 2000); 
}

function checkLocalDraft() {
    const draft = localStorage.getItem('art_draft');
    if (draft) {
        try {
            const data = JSON.parse(draft);
            if (!document.getElementById('artId').value && (Date.now() - data.timestamp < 24 * 60 * 60 * 1000)) {
                if(confirm('检测到未保存的草稿，是否恢复？')) {
                    document.getElementById('artTitle').value = data.title || '';
                    if (window.wangEditorInstance) {
                        window.wangEditorInstance.setHtml(data.content || '');
                    }
                } else {
                    localStorage.removeItem('art_draft');
                }
            }
        } catch(e) {}
    }
}

function updateGeoDescCount() {
    const desc = studioVal('artDesc');
    const count = desc.length;
    const el = document.getElementById('geoDescCount');
    if(el) {
        el.textContent = `${count}/150`;
        if(count > 150) {
            el.classList.add('text-danger');
            el.classList.remove('text-secondary');
        } else {
            el.classList.remove('text-danger');
            el.classList.add('text-secondary');
        }
    }
    updateGeoScore();
}

function updateSeoDescCount() {
    const descEl = document.getElementById('artSeoDesc');
    if(!descEl) return;
    const count = descEl.value.length;
    const el = document.getElementById('seoDescCount');
    if(el) {
        el.textContent = `${count}/160`;
        if(count > 160) {
            el.classList.add('text-danger');
            el.classList.remove('text-secondary');
        } else {
            el.classList.remove('text-danger');
            el.classList.add('text-secondary');
        }
    }
    updateGeoScore();
}

function updateSeoScore() {
    // Legacy mapping to updateGeoScore
    updateGeoScore();
}

// Studio 工作台(studioTitleInput)与旧编辑器(artTitle)字段 id 不一致，统一读取；缺失字段返回空串避免空引用
function studioVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}
function studioTitle() {
    const el = document.getElementById('studioTitleInput') || document.getElementById('artTitle');
    return el ? el.value : '';
}

function updateGeoScore() {
    let scores = {
        semantic: 0,
        ai: 0,
        structure: 0,
        other: 0,
        total: 0
    };
    
    const title = studioTitle().trim();
    const desc = studioVal('artDesc').trim();
    const tags = studioVal('artTags').trim();
    const slug = studioVal('artSlug').trim();
    const cover = studioVal('artCover').trim();
    const seoDesc = studioVal('artSeoDesc').trim();
    
    let content = '';
    if (window.wangEditorInstance) {
        content = window.wangEditorInstance.getText().trim();
        // Simple HTML structure check
        const html = window.wangEditorInstance.getHtml();
        if (html.includes('<h2') || html.includes('<h3')) scores.structure += 5;
    }

    // 1. Semantic Integrity (30%)
    // - Length > 800 words (10)
    // - Length > 300 words (5)
    // - Title meaningful (5)
    // - GEO Description meaningful (10)
    // - SEO Description meaningful (5)
    if (content.length > 800) scores.semantic += 10;
    else if (content.length > 300) scores.semantic += 5;
    
    if (title.length >= 5 && title.length <= 50) scores.semantic += 5;
    if (desc.length >= 50) scores.semantic += 10;
    if (seoDesc.length >= 50) scores.semantic += 5;

    // 2. AI Understandability (25%)
    // - Clear paragraph structure (heuristic: avg para length not too long) (10)
    // - Keywords present in title/desc (10)
    // - No complex formatting issues (5)
    if (content.length > 0) scores.ai += 10; // Baseline for having content
    if (tags && content.includes(tags.split(',')[0])) scores.ai += 10; // Keywords in content
    scores.ai += 5; // Default formatting score since we clean it

    // 3. Structured Data (20%)
    // - Meta tags (Slug, Tags) (10)
    // - Cover Image (Alt) (5)
    // - Headings (checked above) (5)
    if (slug) scores.structure += 5;
    if (tags) scores.structure += 5;
    if (cover) scores.structure += 5;

    // 4. Other / Context (25%)
    // - Author set (5)
    // - Publish date set (5)
    // - Category set (5)
    // - Recency/Freshness (Simulated) (10)
    if (studioVal('artAuthorSelect') || studioVal('artAuthor')) scores.other += 5;
    if (studioVal('artCategory')) scores.other += 5;
    scores.other += 15; // Base score

    // Calculate Total
    // Weights: Semantic 30%, AI 25%, Structure 20%, Other 25%
    // Max raw scores above:
    // Semantic: 30
    // AI: 25
    // Structure: 20
    // Other: 25
    // Perfect match!
    
    scores.total = scores.semantic + scores.ai + scores.structure + scores.other;
    if (scores.total > 100) scores.total = 100;

    // Update UI
    const scoreEl = document.getElementById('geoScore');
    const barEl = document.getElementById('geoProgress');
    
    if (scoreEl && barEl) {
        scoreEl.textContent = `${scores.total}分`;
        barEl.style.width = `${scores.total}%`;
        
        // Color coding
        let colorClass = 'bg-warning';
        let textClass = 'text-warning';
        if (scores.total >= 90) { colorClass = 'bg-success'; textClass = 'text-success'; }
        else if (scores.total >= 70) { colorClass = 'bg-brand'; textClass = 'text-brand'; } // Brand is primary/blue-ish
        
        barEl.className = `progress-bar ${colorClass}`;
        // scoreEl classes reset
        scoreEl.className = `badge bg-light ${textClass} border rounded-pill px-2 py-1`;
    }

    // Update Dimensions
    updateDim('geoDimSemantic', 'geoProgSemantic', scores.semantic, 30);
    updateDim('geoDimAi', 'geoProgAi', scores.ai, 25);
    updateDim('geoDimStruct', 'geoProgStruct', scores.structure, 20);

    // Update Badges & Suggestions
    const badgesEl = document.getElementById('geoBadges');
    const suggestionsEl = document.getElementById('geoSuggestions');
    
    let badges = [];
    let suggestions = [];
    
    if (scores.total >= 90) badges.push(createBadge('GEO 优秀', 'success'));
    
    // Semantic Suggestions
    if (content.length < 300) {
        badges.push(createBadge('内容过短', 'danger'));
        suggestions.push('<li class="mb-1"><i class="bi bi-x-circle text-danger me-1"></i>文章字数不足，建议增加至 800 字以上。</li>');
    } else if (content.length < 800) {
        suggestions.push('<li class="mb-1"><i class="bi bi-exclamation-circle text-warning me-1"></i>文章字数可进一步丰富，提升语义深度。</li>');
    }
    
    if (title.length < 5) suggestions.push('<li class="mb-1"><i class="bi bi-x-circle text-danger me-1"></i>标题过短，请完善文章标题。</li>');
    if (desc.length < 50) suggestions.push('<li class="mb-1"><i class="bi bi-exclamation-circle text-warning me-1"></i>GEO 摘要较短，建议由 AI 生成 3 个核心结论。</li>');
    if (seoDesc.length < 50) suggestions.push('<li class="mb-1"><i class="bi bi-exclamation-circle text-warning me-1"></i>SEO 摘要较短，建议由 AI 生成。</li>');

    // AI Suggestions
    if (!tags) {
        badges.push(createBadge('缺标签', 'warning'));
        suggestions.push('<li class="mb-1"><i class="bi bi-exclamation-circle text-warning me-1"></i>未设置标签，影响 AI 关键词提取。</li>');
    } else if (!content.includes(tags.split(',')[0])) {
        suggestions.push('<li class="mb-1"><i class="bi bi-info-circle text-info me-1"></i>正文似乎未包含主要标签关键词，建议自然融入。</li>');
    }

    // Structure Suggestions
    if (!cover) {
        badges.push(createBadge('缺封面', 'danger'));
        suggestions.push('<li class="mb-1"><i class="bi bi-x-circle text-danger me-1"></i>缺少封面图片，无法提供多模态结构化数据。</li>');
    } else {
        // Alt status is basically title if cover exists
        const altBadge = document.getElementById('coverAltStatus');
        if(altBadge) {
            if(title.length > 0) {
                altBadge.textContent = `Alt: ${title.substring(0, 5)}...`;
                altBadge.className = 'badge bg-success-light text-success rounded-pill';
            } else {
                altBadge.textContent = 'Alt: 等待标题';
                altBadge.className = 'badge bg-warning-light text-warning rounded-pill';
            }
        }
    }
    
    if (window.wangEditorInstance && !window.wangEditorInstance.getHtml().includes('<h2')) {
        suggestions.push('<li class="mb-1"><i class="bi bi-info-circle text-info me-1"></i>正文缺少 H2/H3 标题，建议增加以优化结构。</li>');
    }

    if (badgesEl) {
        badgesEl.innerHTML = badges.join('');
    }
    
    // Auto trigger GEO AI analysis if needed? No, let user click.
    
    // Store scores for saving
    window.currentGeoScores = scores;
}

// Global cache for AI Analysis to prevent redundant calls
let geoAnalysisCache = { hash: '', data: null };

async function fetchGeoAnalysis() {
    const btn = document.getElementById('btnGeoAnalyze');
    const emptyState = document.getElementById('geoAnalysisEmpty');
    const loadingState = document.getElementById('geoAnalysisLoading');
    const listState = document.getElementById('geoAnalysisList');
    
    let content = '';
    if (window.wangEditorInstance) {
        content = window.wangEditorInstance.getText().trim();
    }
    const title = studioTitle().trim();
    const tags = studioVal('artTags').trim();
    const summary = studioVal('artDesc').trim();

    if (!content || content.length < 50) {
        showToast('文章内容太少，无法进行深度分析', 'warning');
        return;
    }

    // Simple hash to check if content changed
    const currentHash = [title, tags, summary, content].join('|').length.toString();
    
    if (geoAnalysisCache.hash === currentHash && geoAnalysisCache.data) {
        renderGeoAnalysis(geoAnalysisCache.data);
        return;
    }

    // UI state: Loading
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>分析中';
    }
    if(emptyState) emptyState.classList.add('d-none');
    if(listState) listState.classList.add('d-none');
    if(loadingState) loadingState.classList.remove('d-none');

    // Set up AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const res = await fetch('/api/tools/geo-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders()
            },
            body: JSON.stringify({ title, content, tags, summary }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await res.json();
        
        if (data.success && Array.isArray(data.data)) {
            geoAnalysisCache = { hash: currentHash, data: data.data };
            renderGeoAnalysis(data.data);
        } else {
            throw new Error(data.error || '返回数据格式异常');
        }
    } catch (e) {
        clearTimeout(timeoutId);
        console.error('GEO Analysis Error:', e);
        if (e.name === 'AbortError') {
            showToast('深度分析超时(30秒)，请重试', 'error');
        } else {
            showToast('深度分析失败，请重试', 'error');
        }
        // UI state: Error / Empty
        if(loadingState) loadingState.classList.add('d-none');
        if(emptyState) {
            emptyState.classList.remove('d-none');
            emptyState.innerHTML = `<i class="bi bi-exclamation-triangle text-danger opacity-75 mb-2" style="font-size: 24px; display: block;"></i>分析失败<br><a href="javascript:void(0)" onclick="fetchGeoAnalysis()" class="text-brand">点击重试</a>`;
        }
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-search me-1"></i>分析';
        }
    }
}

function renderGeoAnalysis(items) {
    const loadingState = document.getElementById('geoAnalysisLoading');
    const listState = document.getElementById('geoAnalysisList');
    
    if(loadingState) loadingState.classList.add('d-none');
    if(listState) {
        listState.classList.remove('d-none');
        
        if (items.length === 0) {
            listState.innerHTML = '<div class="text-center py-3 small text-success"><i class="bi bi-check-circle me-1"></i>文章非常棒，暂无深度优化建议。</div>';
            return;
        }

        const html = items.map((item, idx) => {
            // Render stars for priority
            const stars = Array(5).fill(0).map((_, i) => 
                `<i class="bi bi-star-fill ${i < item.priority ? 'text-warning' : 'text-light'}"></i>`
            ).join('');
            
            return `
                <div class="p-3 bg-white border rounded mb-2 shadow-sm" style="font-size: 13px;">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="badge bg-danger-light text-danger border border-danger-subtle rounded-pill fw-normal px-2">
                            <i class="bi bi-geo-alt me-1"></i>${item.location || '全局'}
                        </span>
                        <div class="text-nowrap" style="font-size: 10px;">
                            ${stars}
                        </div>
                    </div>
                    <div class="text-dark fw-medium mb-1">
                        ${item.suggestion}
                    </div>
                    <div class="text-success mt-2 pt-2 border-top border-light d-flex align-items-center" style="font-size: 11px;">
                        <i class="bi bi-graph-up-arrow me-1"></i>预期提升：${item.expectedImpact || '优化 AI 抓取效率'}
                    </div>
                </div>
            `;
        }).join('');
        
        listState.innerHTML = html;
    }
}

function updateDim(textId, progId, val, max) {
    const text = document.getElementById(textId);
    const prog = document.getElementById(progId);
    if (text) text.textContent = `${val}/${max}`;
    if (prog) prog.style.width = `${(val/max)*100}%`;
}

function createBadge(text, type) {
    let color = type === 'success' ? 'success' : type === 'danger' ? 'danger' : 'warning';
    return `<span class="badge bg-${color}-light text-${color} border border-${color}-subtle rounded-pill fw-normal px-2" style="font-size: 10px;">${text}</span>`;
}

// Upload Cover Wrapper to update Alt status
const originalUploadCover = window.uploadCover; // Assuming it exists or we define it.
// Actually uploadCover is inline in HTML or defined? 
// Let's redefine it properly here if not exported, or hook into it.
// The original code used `uploadCover()` from global scope?
// Let's implement it robustly.

function uploadCover() {
    const fileInput = document.getElementById('artCoverFile');
    const file = fileInput.files[0];
    if(!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Show loading state
    const box = document.getElementById('artCoverPreviewBox');
    const placeholder = document.getElementById('artCoverPlaceholder');
    const img = document.getElementById('artCoverImg');
    
    if (placeholder) placeholder.innerHTML = '<div class="spinner-border spinner-border-sm text-brand" role="status"></div><br><small>上传中...</small>';
    
    fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': authHeaders().Authorization },
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            document.getElementById('artCover').value = data.url;
            if (img) {
                img.src = data.url;
                img.classList.remove('d-none');
            }
            if (placeholder) {
                placeholder.classList.add('d-none');
                // Reset placeholder for next time
                placeholder.innerHTML = '<i class="bi bi-image fs-4"></i><br><small>点击上传</small>';
            }
            
            // Update Alt Status Badge
            const altBadge = document.getElementById('coverAltStatus');
            if(altBadge) {
                altBadge.textContent = 'Alt已配';
                altBadge.className = 'badge bg-success-light text-success rounded-pill';
            }
            
            showToast('上传成功');
            updateSeoScore();
        } else {
            showToast('上传失败: ' + (data.error || '未知错误'), 'error');
            if (placeholder) placeholder.innerHTML = '<i class="bi bi-image fs-4"></i><br><small>点击上传</small>';
        }
    })
    .catch(err => {
        console.error('Upload Error:', err);
        showToast('上传请求出错', 'error');
        if (placeholder) placeholder.innerHTML = '<i class="bi bi-image fs-4"></i><br><small>点击上传</small>';
    });
}

function toggleLeftSidebar() {
    const sidebar = document.getElementById('leftSidebar');
    const mainArea = document.getElementById('mainEditorArea');
    
    if (sidebar.classList.contains('col-md-2')) {
        // Collapse
        sidebar.classList.remove('col-md-2');
        sidebar.style.width = '60px';
        sidebar.querySelector('.p-3').classList.add('d-none'); // Hide header
        sidebar.querySelector('.flex-grow-1').classList.add('d-none'); // Hide content
        
        // Show icon only mode (can be refined later)
        if (!document.getElementById('sidebarCollapsedIcon')) {
            const icon = document.createElement('div');
            icon.id = 'sidebarCollapsedIcon';
            icon.className = 'text-center py-3';
            icon.innerHTML = '<button class="btn btn-sm btn-link text-secondary" onclick="toggleLeftSidebar()"><i class="bi bi-layout-sidebar-inset-reverse fs-5"></i></button>';
            sidebar.appendChild(icon);
        } else {
            document.getElementById('sidebarCollapsedIcon').classList.remove('d-none');
        }

        mainArea.classList.remove('col-md-7');
        mainArea.classList.add('col-md-8'); // Expand main area (approx)
        mainArea.style.flex = '1';
    } else {
        // Expand
        sidebar.classList.add('col-md-2');
        sidebar.style.width = '';
        sidebar.querySelector('.p-3').classList.remove('d-none');
        sidebar.querySelector('.flex-grow-1').classList.remove('d-none');
        
        if (document.getElementById('sidebarCollapsedIcon')) {
            document.getElementById('sidebarCollapsedIcon').classList.add('d-none');
        }

        mainArea.classList.remove('col-md-8');
        mainArea.classList.add('col-md-7');
        mainArea.style.flex = '';
    }
}

// Q&A Management
let qaList = [];
let isQAEditing = false;

function checkQAEditState() {
    isQAEditing = qaList.some(qa => qa.isManualEdited);
    const generateBtn = document.getElementById('qaGenerateBtn');
    if (generateBtn) {
        if (isQAEditing) {
            generateBtn.disabled = true;
            generateBtn.title = "已有人工编辑内容，无法重新一键生成";
            generateBtn.classList.add('text-muted');
            generateBtn.classList.remove('text-brand');
        } else {
            generateBtn.disabled = false;
            generateBtn.title = "AI 生成 Q&A";
            generateBtn.classList.remove('text-muted');
            generateBtn.classList.add('text-brand');
        }
    }
}

function renderQAList() {
    const container = document.getElementById('qaList');
    if (!container) return;
    
    if (qaList.length === 0) {
        container.innerHTML = '<div class="text-center py-3 text-muted small bg-light rounded border border-light border-dashed">暂无问答数据，请点击生成或手动添加</div>';
        checkQAEditState();
        return;
    }
    
    container.innerHTML = qaList.map((qa, index) => `
        <div class="qa-item border rounded mb-2 overflow-hidden bg-white">
            <div class="d-flex align-items-center justify-content-between p-2 bg-light border-bottom cursor-pointer" onclick="toggleQAItem(${index})">
                <span class="small fw-bold text-truncate pe-2" style="max-width: 200px;">
                    ${qa.isManualEdited ? '<i class="bi bi-person-check text-success me-1" title="人工编辑过"></i>' : '<i class="bi bi-robot text-brand me-1" title="AI生成"></i>'}
                    Q${index+1}: ${qa.question || '新问题'}
                </span>
                <div class="d-flex align-items-center">
                    <button class="btn btn-sm btn-link text-danger p-0 me-2" onclick="event.stopPropagation(); removeQAItem(${index})" title="删除">
                        <i class="bi bi-trash"></i>
                    </button>
                    <button class="btn btn-sm btn-link text-secondary p-0 qa-collapse-btn" id="qaBtn-${index}" aria-expanded="false">
                        <i class="bi bi-chevron-down"></i>
                    </button>
                </div>
            </div>
            <div class="p-2 d-none" id="qaBody-${index}">
                <input type="text" class="form-control form-control-sm mb-2" placeholder="问题" value="${qa.question}" oninput="updateQAItem(${index}, 'question', this.value)">
                <textarea class="form-control form-control-sm" rows="3" placeholder="答案" oninput="updateQAItem(${index}, 'answer', this.value)">${qa.answer}</textarea>
            </div>
        </div>
    `).join('');
    
    checkQAEditState();
}

function addQAItem() {
    qaList.push({ question: '', answer: '', isManualEdited: true });
    renderQAList();
    // Auto expand the new item
    setTimeout(() => toggleQAItem(qaList.length - 1), 50);
}

function removeQAItem(index) {
    if(confirm('确定删除此问答吗？')) {
        qaList.splice(index, 1);
        renderQAList();
    }
}

function updateQAItem(index, field, value) {
    qaList[index][field] = value;
    qaList[index].isManualEdited = true;
    checkQAEditState();
}

function toggleQAItem(index) {
    const body = document.getElementById(`qaBody-${index}`);
    const btn = document.getElementById(`qaBtn-${index}`);
    if (body && btn) {
        if (body.classList.contains('d-none')) {
            body.classList.remove('d-none');
            btn.setAttribute('aria-expanded', 'true');
        } else {
            body.classList.add('d-none');
            btn.setAttribute('aria-expanded', 'false');
        }
    }
}

function autoGenerateQA() {
    let content = '';
    if (window.wangEditorInstance) {
        content = window.wangEditorInstance.getText();
    }
    const title = studioTitle();
    
    if (!content || content.trim().length < 100) {
        showToast('请先输入足够的文章内容(至少100字)', 'warning');
        return;
    }

    const btn = document.querySelector('button[onclick="autoGenerateQA()"]');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 生成中...';
    }

    // Set up AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    fetch('/api/tools/qa', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders()
        },
        body: JSON.stringify({ content, title }),
        signal: controller.signal
    })
    .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        if (data.qa && Array.isArray(data.qa)) {
            qaList = [...qaList, ...data.qa];
            renderQAList();
            showToast(`成功生成 ${data.qa.length} 组问答`);
        } else {
            showToast('生成失败: ' + (data.error || '未知错误'), 'error');
        }
    })
    .catch(e => {
        clearTimeout(timeoutId);
        console.error('QA AI Error:', e);
        if (e.name === 'AbortError') {
            showToast('生成超时(30秒)，请重试', 'error');
        } else {
            showToast('请求生成 Q&A 失败', 'error');
        }
    })
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    });
}

// 新增 console.html 专用的 Studio 工作台集成逻辑
function caseOverviewText(value) {
    const el = document.createElement('div');
    el.innerHTML = String(value || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n');
    return (el.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

window.openStudio = function(type, id) {
    window.studioType = type;
    window.studioId = id;
    const studioModal = document.getElementById('studioModal');
    studioModal.classList.toggle('case-mode', type === 'case');
    document.getElementById('caseOverviewInput').value = '';
    
    // 文章模式使用富文本编辑器，案例概览使用普通文本框
    if (type === 'article' && !window.wangEditorInstance && window.wangEditor) {
        const { createEditor, createToolbar } = window.wangEditor;
        window.wangEditorInstance = createEditor({
            selector: '#studioContainer',
            html: '',
            config: {
                placeholder: '请输入正文内容...',
                MENU_CONF: {
                    uploadImage: {
                        server: '/api/upload',
                        fieldName: 'file',
                        headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') },
                        customInsert(res, insertFn) { if (res.success) insertFn(res.url, '图片', res.url); }
                    }
                },
                onChange(editor) { updateWordCount(); }
            }
        });
        window.wangEditorToolbar = createToolbar({
            editor: window.wangEditorInstance,
            selector: '#studioToolbar',
            config: {}
        });
    }

    // 渲染配置区表单
    const configEl = document.getElementById('studioConfig');
    if (type === 'article') {
        configEl.innerHTML = `
            <div class="cfg-block">
                <h4 class="cfg-title">基础配置</h4>
                <div class="f"><label>自定义链接 (Slug)</label>
                    <div style="display:flex;gap:6px"><input id="artSlug" placeholder="article-slug" style="flex:1" oninput="previewSlug()"><button type="button" class="mini-btn" style="width:auto;padding:4px 10px" onclick="autoGenerateSlug(true)" title="AI 智能生成">✨</button></div>
                    <small style="color:var(--muted);font-size:10.5px;display:block;margin-top:4px" id="slugPreview"></small>
                </div>
                <div class="f"><label>所属分类</label>
                    <select id="artCategory" onchange="onCategorySelectChange()"><option value="">选择分类...</option><option value="__new__">＋ 新增分类</option></select>
                    <div class="inline-create-fields" id="newCategoryFields" hidden><input id="newCategoryName" placeholder="分类名称"><input id="newCategoryCode" placeholder="英文代码，如 ai-strategy"><button type="button" class="mini-btn" onclick="saveInlineCategory()">新增并选中</button></div>
                </div>
                <div class="f"><label>作者</label>
                    <select id="artAuthorSelect" onchange="onAuthorSelectChange()"><option value="">选择作者...</option><option value="manual">手动输入</option></select>
                    <div class="manual-author-fields" id="manualAuthorFields" hidden><input id="artAuthor" placeholder="作者姓名"><textarea id="artAuthorDesc" rows="2" placeholder="作者简介（选填）"></textarea></div>
                </div>
            </div>
            <div class="cfg-block">
                <h4 class="cfg-title">SEO & GEO 摘要</h4>
                <div class="f"><label>文章标签 <span class="hint">(逗号分隔)</span>
                    <button type="button" class="mini-btn" style="width:auto;float:right;padding:2px 8px;font-size:10.5px" onclick="autoGenerateTags()">✨ 智能生成</button></label>
                    <input id="artTags" oninput="updateGeoScore()">
                </div>
                <div class="f"><label>SEO 摘要 <span class="hint" id="seoDescCount">0/160</span>
                    <button type="button" class="mini-btn" style="width:auto;float:right;padding:2px 8px;font-size:10.5px" onclick="autoGenerateSummary('seo')">✨</button></label>
                    <textarea id="artSeoDesc" rows="3" placeholder="用于搜索引擎结果展示..." oninput="updateSeoDescCount()"></textarea>
                </div>
                <div class="f"><label>核心摘要 <span class="hint" id="geoDescCount">0/150</span>
                    <button type="button" class="mini-btn summary-generate" onclick="autoGenerateSummary('geo')">基于正文提炼</button></label>
                    <textarea id="artDesc" rows="4" maxlength="150" placeholder="用 1—3 句话提炼核心观点、关键结论和读者价值，不超过 150 字。" oninput="updateGeoDescCount()"></textarea>
                </div>
            </div>
            <div class="cfg-block">
                <h4 class="cfg-title">栏目与内容状态</h4>
                <div class="f"><label>所属栏目</label>
                    <select id="artZone"><option value="">请选择栏目</option><option value="industry">行业洞察</option><option value="thinktank">经营智库</option></select>
                </div>
                <div class="f"><label>内容状态</label>
                    <select id="artContentStatus"><option value="full">完整内容</option><option value="toc">仅目录 / 摘要</option><option value="soon">即将上线</option></select>
                </div>
                <div class="switch-row"><label>置顶显示</label><button type="button" id="artTopBtn" class="switch" onclick="this.classList.toggle('on')"></button></div>
            </div>
            <div class="cfg-block">
                <h4 class="cfg-title">发布设置</h4>
                <div class="f"><label>封面图片</label>
                    <div class="cover-upload" onclick="document.getElementById('artCoverFile').click()">
                        <div class="add" id="artCoverPlaceholder"><i style="font-size:24px;font-style:normal">+</i><span>点击上传</span></div>
                        <img id="artCoverImg" style="display:none;">
                    </div>
                    <input type="hidden" id="artCover">
                    <input type="file" id="artCoverFile" accept="image/*" onchange="uploadCover()">
                </div>
                <div class="switch-row"><label>设为推荐文章</label><button type="button" id="artFeaturedBtn" class="switch" onclick="this.classList.toggle('on')"></button></div>
                <div class="switch-row"><label>是否上线</label><button type="button" id="artOnlineBtn" class="switch on" onclick="this.classList.toggle('on')"></button></div>
                <div class="f"><label>发布状态</label>
                    <select id="artStatus" onchange="togglePublishDate()"><option value="published">立即发布</option><option value="draft">存为草稿</option><option value="scheduled">定时发布</option><option value="archived">归档</option></select>
                </div>
                <div class="f" id="publishDateWrapper" style="display:none"><label>预定时间</label><input type="datetime-local" id="artPublishDate"></div>
            </div>
            <div class="cfg-block">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h4 class="cfg-title" style="margin:0">智能问答 (Q&A)</h4>
                    <button class="mini-btn" type="button" style="width:auto" onclick="autoGenerateQA()">AI 一键生成</button>
                </div>
                <div class="qa-list" id="qaList"></div>
                <button class="mini-btn mt-2" type="button" onclick="addQAItem()">+ 手动添加</button>
            </div>
        `;
        // 加载分类和作者下拉
        setTimeout(() => { loadCategories(); loadStudioAuthors(); }, 0);
    } else {
        configEl.innerHTML = `
            <section class="cfg-block case-config-section" id="case-section-basic">
                <div class="case-config-heading"><span>01</span><div><h4>基础信息</h4><p>客户身份与案例检索信息</p></div></div>
                <div class="grid2">
                    <div class="f"><label>客户名称</label><input id="caseClient" placeholder="例如：海尔智家"></div>
                    <div class="f"><label>所属行业</label><select id="caseIndustry"><option value="">请选择行业</option><option>制造业</option><option>教育</option><option>零售快消</option><option>游戏文娱</option><option>金融财税</option><option>贸易物流</option><option>物业地产</option><option>其他</option></select></div>
                </div>
                <div class="f"><label>SEO Slug <span class="hint">英文语义链接</span></label><input id="artSlug" placeholder="case-slug"></div>
                <div class="f"><label>案例标签 <span class="hint">使用逗号分隔</span></label><input id="caseTags" placeholder="AI Agent, 降本增效"></div>
            </section>
            <section class="cfg-block case-config-section" id="case-section-story">
                <div class="case-config-heading"><span>02</span><div><h4>项目复盘</h4><p>按问题、目标、方案组织叙事</p></div></div>
                <div class="f"><label>客户问题 <span class="hint">每行一条</span></label><textarea id="caseProblems" rows="4" placeholder="机型版本庞杂、历史代码沉重"></textarea></div>
                <div class="f"><label>项目目标 <span class="hint">每行一条</span></label><textarea id="caseGoals" rows="4" placeholder="实现核心团队 100% 覆盖"></textarea></div>
                <div class="f"><label>解决方案 <span class="hint">每行一条</span></label><textarea id="caseSolutions" rows="6" placeholder="引入 CodeBuddy 存量代码改造"></textarea></div>
            </section>
            <section class="cfg-block case-config-section" id="case-section-impact">
                <div class="case-config-heading"><span>03</span><div><h4>成果数据</h4><p>用明确指标呈现项目价值</p></div></div>
                <div class="f"><label>关键数据 <span class="hint">每行：指标名: 数值</span></label><textarea id="caseStats" rows="5" placeholder="研发效率提升: 30%&#10;采购成本下降: 10%"></textarea></div>
                <div class="f"><label>成果补充 <span class="hint">每行一条</span></label><textarea id="caseResultTags" rows="4" placeholder="研发渗透度&#10;90%+"></textarea></div>
            </section>
            <section class="cfg-block case-config-section" id="case-section-publish">
                <div class="case-config-heading"><span>04</span><div><h4>发布设置</h4><p>封面、状态与首页推荐</p></div></div>
                <div class="f"><label>封面图片 <span class="hint">建议 16:9</span></label>
                    <div class="cover-upload" onclick="document.getElementById('artCoverFile').click()"><div class="add" id="artCoverPlaceholder"><i>+</i><span>点击上传封面</span></div><img id="artCoverImg" style="display:none;"></div>
                    <input type="hidden" id="artCover"><input type="file" id="artCoverFile" accept="image/*" onchange="uploadCover()">
                </div>
                <div class="case-publish-panel">
                    <div class="switch-row"><label>对外上线 <small>允许前台访问</small></label><button type="button" id="caseOnlineBtn" class="switch on" onclick="this.classList.toggle('on')"></button></div>
                    <div class="switch-row"><label>首页精选 <small>加入精选候选</small></label><button type="button" id="artFeaturedBtn" class="switch" onclick="this.classList.toggle('on')"></button></div>
                </div>
                <div class="f"><label>发布状态</label><select id="artStatus"><option value="published">已发布</option><option value="draft">草稿</option></select></div>
            </section>
        `;
    }

    // 渲染 GEO 侧边栏
    document.getElementById('studioGeo').innerHTML = type === 'article' ? `
        <div class="geo-card">
            <h4><i style="color:var(--purple);font-style:normal">⚡</i> GEO 综合评分 <span class="spacer"></span><span class="geo-score-badge" id="geoScore">0分</span></h4>
            <div class="geo-progress"><i id="geoProgress" style="width:0%"></i></div>
            <div class="geo-dim">
                <div class="row"><b>语义完整性 (30%)</b><span id="geoDimSemantic">0/30</span></div>
                <div class="bar"><i class="s" id="geoProgSemantic" style="width:0%"></i></div>
            </div>
            <div class="geo-dim">
                <div class="row"><b>AI 可理解性 (25%)</b><span id="geoDimAi">0/25</span></div>
                <div class="bar"><i class="a" id="geoProgAi" style="width:0%"></i></div>
            </div>
            <div class="geo-dim mb-0">
                <div class="row"><b>结构化数据 (20%)</b><span id="geoDimStruct">0/20</span></div>
                <div class="bar"><i class="st" id="geoProgStruct" style="width:0%"></i></div>
            </div>
        </div>
        <div class="geo-card" style="margin-bottom:0">
            <h4 style="margin-bottom:12px"><i style="color:var(--purple);font-style:normal">✨</i> 深度诊断建议</h4>
            <button type="button" class="geo-analyze-btn" id="btnGeoAnalyze" onclick="fetchGeoAnalysis()">执行全文 AI 诊断</button>
            <div id="geoAnalysisList" style="margin-top:12px">
                <div class="geo-analysis-empty" id="geoAnalysisEmpty">点击上方按钮，AI 将对全文进行深度扫描</div>
            </div>
        </div>
    ` : `
        <div class="case-editor-guide">
            <span>CASE EDITOR</span>
            <h3>案例内容结构</h3>
            <p>从客户背景到项目成果，按阅读顺序完成信息录入。</p>
        </div>
        <nav class="case-editor-nav" aria-label="案例编辑步骤">
            <a href="#case-section-basic"><i>01</i><span>基础信息<small>客户与分类</small></span></a>
            <a href="#case-section-story"><i>02</i><span>项目复盘<small>问题、目标、方案</small></span></a>
            <a href="#case-section-impact"><i>03</i><span>成果数据<small>指标与价值</small></span></a>
            <a href="#case-section-publish"><i>04</i><span>发布设置<small>封面与状态</small></span></a>
        </nav>
    `;

    // 绑定通用事件
    // 确保 artId 隐藏域存在（autoGenerateSlug 依赖它判断是否新文章）
    if (!document.getElementById('artId')) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden'; hidden.id = 'artId';
        document.getElementById('studioConfig').appendChild(hidden);
    }
    document.getElementById('artId').value = id || '';
    document.getElementById('studioTitleInput').addEventListener('input', () => { updateGeoScore(); autoGenerateSlug(false); });
    if(type === 'article' && window.wangEditorInstance) {
        window.wangEditorInstance.setHtml('<p><br></p>');
    }
    
    // 加载数据
    if (id) {
        document.getElementById('studioTitle').textContent = `编辑${type === 'article' ? '文章' : '案例'}`;
        loadStudioData(type, id);
    } else {
        document.getElementById('studioTitle').textContent = `新建${type === 'article' ? '文章' : '案例'}`;
        document.getElementById('studioTitleInput').value = '';
        if(type === 'article') {
            document.getElementById('artTags').value = '';
            document.getElementById('artDesc').value = '';
            document.getElementById('artSeoDesc').value = '';
            document.getElementById('artSlug').value = '';
            previewSlug();
            document.getElementById('artCategory').value = '';
            document.getElementById('artZone').value = '';
            document.getElementById('artContentStatus').value = 'full';
            document.getElementById('artTopBtn').className = 'switch';
            document.getElementById('artFeaturedBtn').className = 'switch';
            document.getElementById('artOnlineBtn').className = 'switch on';
            document.getElementById('artStatus').value = 'published';
            togglePublishDate();
            document.getElementById('manualAuthorFields').hidden = true;
            document.getElementById('newCategoryFields').hidden = true;
            qaList = [];
            renderQAList();
            setTimeout(() => { loadCategories(); loadStudioAuthors(); }, 0);
        } else {
            document.getElementById('caseClient').value = '';
            document.getElementById('caseIndustry').value = '制造业';
            document.getElementById('artSlug').value = '';
            document.getElementById('caseOnlineBtn').className = 'switch on';
            document.getElementById('artFeaturedBtn').className = 'switch';
            document.getElementById('artStatus').value = 'published';
        }
        document.getElementById('artCover').value = '';
        document.getElementById('artCoverImg').style.display = 'none';
        document.getElementById('artCoverPlaceholder').style.display = 'flex';
        updateGeoScore();
    }

    document.getElementById('studioModal').classList.add('show');
    document.getElementById('studioModal').setAttribute('aria-hidden', 'false');
};

window.closeStudio = function() {
    document.getElementById('studioModal').classList.remove('show');
    document.getElementById('studioModal').setAttribute('aria-hidden', 'true');
};

document.addEventListener('click', e => {
    if(e.target.closest('[data-action="close-studio"]')) closeStudio();
    if(e.target.closest('[data-action="save-studio"]')) saveStudioData();
});

async function loadStudioData(type, id) {
    try {
        let data;
        if (type === 'case') {
            data = state.cases.find(x => x._id === id);
        } else {
            const res = await fetch(`/api/admin/articles/${id}`, { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } });
            const d = await res.json();
            data = d;
        }
        
        if (!data) throw new Error('未找到数据');
        
        document.getElementById('studioTitleInput').value = data.title || '';
        
        if (type === 'article') {
            document.getElementById('artSlug').value = data.slug || '';
            previewSlug();
            document.getElementById('artTags').value = (data.tags || []).join(', ');
            document.getElementById('artDesc').value = data.summary || '';
            document.getElementById('artSeoDesc').value = data.seoDescription || '';
            document.getElementById('artStatus').value = data.status || 'published';
            document.getElementById('artZone').value = data.zone || '';
            document.getElementById('artContentStatus').value = data.contentStatus || 'full';
            document.getElementById('artTopBtn').className = data.top ? 'switch on' : 'switch';
            togglePublishDate();
            document.getElementById('artFeaturedBtn').className = data.isRecommended ? 'switch on' : 'switch';
            document.getElementById('artOnlineBtn').className = data.isOnline !== false ? 'switch on' : 'switch';
            if (data.publishDate) document.getElementById('artPublishDate').value = new Date(data.publishDate).toISOString().slice(0,16);
            qaList = data.qa || [];
            renderQAList();
            // 异步加载分类和作者下拉后回填选中值
            Promise.all([
                fetch('/api/categories').then(r=>r.json()).catch(()=>[]),
                fetch('/api/authors', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } }).then(r=>r.json()).catch(()=>({data:[]}))
            ]).then(([cats, authorsData]) => {
                const authors = Array.isArray(authorsData) ? authorsData : (authorsData.data || []);
                const catSel = document.getElementById('artCategory');
                if (catSel) {
                    catSel.innerHTML = '<option value="">选择分类...</option>' +
                        (cats||[]).map(c => `<option value="${c.code||c}">${c.name||c}</option>`).join('') +
                        '<option value="__new__">＋ 新增分类</option>';
                    catSel.value = data.category || '';
                }
                const authorSel = document.getElementById('artAuthorSelect');
                if (authorSel) {
                    authorSel.innerHTML = '<option value="">选择作者...</option><option value="manual">手动输入</option>' +
                        authors.map(a => `<option value="${a._id}">${a.name}</option>`).join('');
                    if (data.authorId) {
                        authorSel.value = data.authorId;
                    } else if (data.author) {
                        authorSel.value = 'manual';
                        document.getElementById('manualAuthorFields').hidden = false;
                        document.getElementById('artAuthor').value = typeof data.author === 'string' ? data.author : data.author.name || '';
                        document.getElementById('artAuthorDesc').value = typeof data.author === 'object' ? (data.author.desc || '') : '';
                    }
                }
            });
        } else {
            document.getElementById('artSlug').value = data.slug || '';
            document.getElementById('caseClient').value = data.client || '';
            
            // 确保行业字段正确回显
            const industryEl = document.getElementById('caseIndustry');
            const savedIndustry = data.industry || '';
            if (industryEl) {
                // 如果保存的行业不在选项中，添加它
                const existingOption = Array.from(industryEl.options).find(opt => opt.value === savedIndustry);
                if (savedIndustry && !existingOption) {
                    const newOption = document.createElement('option');
                    newOption.value = savedIndustry;
                    newOption.textContent = savedIndustry;
                    industryEl.insertBefore(newOption, industryEl.options[1]); // 插入到第二个位置
                }
                industryEl.value = savedIndustry;
            }
            
            document.getElementById('artStatus').value = data.status || 'published';
            document.getElementById('caseOnlineBtn').className = data.isOnline !== false ? 'switch on' : 'switch';
            document.getElementById('artFeaturedBtn').className = data.featured ? 'switch on' : 'switch';
            document.getElementById('caseTags').value = (data.tags || []).join(', ');
            document.getElementById('caseStats').value = (data.stats || []).map(s => `${s.label || ''}: ${s.value || ''}`).join('\n');
            document.getElementById('caseProblems').value = (data.problems || []).join('\n');
            document.getElementById('caseGoals').value = (data.goals || []).join('\n');
            document.getElementById('caseSolutions').value = (data.solutions || []).join('\n');
            document.getElementById('caseResultTags').value = (data.resultTags || []).join('\n');
            document.getElementById('caseOverviewInput').value = caseOverviewText(data.background);
        }
        
        const cover = data.coverImage || data.cover;
        document.getElementById('artCover').value = cover || '';
        if (cover) {
            document.getElementById('artCoverImg').src = cover;
            document.getElementById('artCoverImg').style.display = 'block';
            document.getElementById('artCoverPlaceholder').style.display = 'none';
        }
        
        if (type === 'article' && window.wangEditorInstance) {
            window.wangEditorInstance.setHtml(data.content || '');
        }
        
        updateGeoScore();
        updateGeoDescCount();
        updateSeoDescCount();
    } catch(e) {
        alert(e.message);
    }
}

async function loadStudioAuthors() {
    try {
        const res = await fetch('/api/authors', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } });
        const d = await res.json();
        const authors = Array.isArray(d) ? d : (d.data || []);
        const sel = document.getElementById('artAuthorSelect');
        if (!sel) return;
        // 保留前两个 option（空 + manual）
        const html = '<option value="">选择作者...</option><option value="manual">手动输入</option>' +
            authors.map(a => `<option value="${a._id}">${a.name}</option>`).join('');
        sel.innerHTML = html;
    } catch(e) { console.warn('加载作者列表失败', e); }
}

let saveInProgress = false;

async function saveStudioData() {
    if (saveInProgress) {
        console.warn('保存正在进行中，忽略重复请求');
        return;
    }
    
    try {
        saveInProgress = true;
        const type = window.studioType;
        const id = window.studioId;
        const title = document.getElementById('studioTitleInput').value.trim();
        if(!title) throw new Error('标题不能为空');
        
        const token = sessionStorage.getItem('token');
        if (!token) {
            throw new Error('登录已过期，请重新登录');
        }
        
        const content = window.wangEditorInstance ? window.wangEditorInstance.getHtml() : '';
        const cover = document.getElementById('artCover').value;
        const slug = document.getElementById('artSlug').value;
        const status = document.getElementById('artStatus').value;
        const featured = document.getElementById('artFeaturedBtn').classList.contains('on');
        
        let payload = {};
        let url = '';
        
        if (type === 'article') {
            url = id ? `/api/articles/${id}` : '/api/articles';
            const authorSel = document.getElementById('artAuthorSelect');
            const authorVal = authorSel ? authorSel.value : '';
            let authorId = authorVal && authorVal !== 'manual' ? authorVal : '';
            let manualAuthor;
            if (authorVal === 'manual') {
                manualAuthor = {
                    name: document.getElementById('artAuthor').value.trim(),
                    desc: document.getElementById('artAuthorDesc').value.trim()
                };
            }
            const articleSlug = normalizeSeoSlug(slug);
            const categoryValue = document.getElementById('artCategory').value;
            if (!articleSlug) {
                document.getElementById('artSlug').focus();
                throw new Error('Slug 必须由英文小写字母、数字和短横线组成');
            }
            if (categoryValue === '__new__') {
                document.getElementById('newCategoryName').focus();
                throw new Error('请先完成新增分类，或选择已有分类');
            }
            if (authorVal === 'manual' && !manualAuthor.name) {
                document.getElementById('artAuthor').focus();
                throw new Error('请填写作者姓名');
            }
            payload = {
                title,
                content,
                coverImage: cover,
                slug: articleSlug,
                status,
                isRecommended: featured,
                isOnline: document.getElementById('artOnlineBtn').classList.contains('on'),
                zone: document.getElementById('artZone').value || undefined,
                contentStatus: document.getElementById('artContentStatus').value || 'full',
                top: document.getElementById('artTopBtn').classList.contains('on'),
                category: categoryValue,
                authorId: authorId,
                author: manualAuthor && manualAuthor.name ? manualAuthor : undefined,
                tags: document.getElementById('artTags').value.split(',').map(x=>x.trim()).filter(Boolean),
                summary: document.getElementById('artDesc').value.trim().slice(0, 150),
                seoDescription: document.getElementById('artSeoDesc').value,
                publishDate: document.getElementById('artStatus').value === 'scheduled' ? document.getElementById('artPublishDate').value : undefined,
                qa: qaList
            };
        } else {
            url = id ? `/api/cases/${id}` : '/api/cases';
            const lineToList = (s) => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
            const stats = document.getElementById('caseStats').value.split('\n').map(line => {
                const idx = line.indexOf(':');
                return idx > 0 ? { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() } : { label: line.trim(), value: '' };
            }).filter(x => x.label);
            
            const industryEl = document.getElementById('caseIndustry');
            const industry = industryEl ? industryEl.value.trim() : '';
            if (!industry) {
                if (industryEl) industryEl.focus();
                throw new Error('行业分类不能为空');
            }
            
            payload = {
                title,
                background: document.getElementById('caseOverviewInput').value.trim(),
                cover,
                slug,
                status,
                featured,
                isOnline: document.getElementById('caseOnlineBtn').classList.contains('on'),
                client: document.getElementById('caseClient').value,
                industry: industry,
                tags: document.getElementById('caseTags').value.split(/[,，]/).map(x => x.trim()).filter(Boolean),
                stats,
                problems: lineToList(document.getElementById('caseProblems').value),
                goals: lineToList(document.getElementById('caseGoals').value),
                solutions: lineToList(document.getElementById('caseSolutions').value),
                resultTags: lineToList(document.getElementById('caseResultTags').value)
            };
        }
        
        const response = await fetch(url, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify(payload)
        });
        
        if (response.status === 401) {
            sessionStorage.removeItem('token');
            throw new Error('登录已过期，请重新登录');
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || `保存失败（${response.status}）`);
        }
        
        closeStudio();
        if (type === 'article') loadArticles();
        else loadCases();
        toast('保存成功');
    } catch(e) {
        if (e.message.includes('登录已过期')) {
            if (confirm('登录已过期，是否跳转到登录页？')) {
                window.location.href = '/admin/index.html';
            }
        } else {
            alert(e.message);
        }
    } finally {
        saveInProgress = false;
    }
}

window.updateSeoDescCount = updateSeoDescCount;
window.uploadCover = uploadCover;
window.toggleLeftSidebar = toggleLeftSidebar;
window.addQAItem = addQAItem;
window.removeQAItem = removeQAItem;
window.updateQAItem = updateQAItem;
window.toggleQAItem = toggleQAItem;
window.autoGenerateQA = autoGenerateQA;
window.fetchGeoAnalysis = fetchGeoAnalysis;

function triggerAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    document.getElementById('saveStatus').classList.add('d-none');
    
    autoSaveTimer = setTimeout(() => {
        if (!editor) return;
        const content = editor.getValue();
        const title = document.getElementById('artTitle').value;
        if (content && content.trim() !== '') {
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
    }, 2000); 
}

function checkLocalDraft() {
    const draft = localStorage.getItem('art_draft');
    if (draft && editor) {
        try {
            const data = JSON.parse(draft);
            if (!document.getElementById('artId').value && (Date.now() - data.timestamp < 24 * 60 * 60 * 1000)) {
                if(confirm('检测到未保存的草稿，是否恢复？')) {
                    document.getElementById('artTitle').value = data.title || '';
                    editor.setValue(data.content || '');
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
            if (window.wangEditorInstance) {
                window.wangEditorInstance.setHtml(data.content || '');
            }
            document.getElementById('artDesc').value = data.summary || '';
            const seoDescEl = document.getElementById('artSeoDesc');
            if(seoDescEl) seoDescEl.value = data.seoDescription || '';
            
            qaList = data.qa || [];
            renderQAList();
            
            updateGeoDescCount();
            updateSeoDescCount();
            
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
window.onAuthorSelectChange = onAuthorSelectChange;
window.updateGeoDescCount = updateGeoDescCount;
window.updateSeoDescCount = updateSeoDescCount;
window.autoGenerateTags = autoGenerateTags;
window.autoGenerateSummary = autoGenerateSummary;
window.smartFormat = smartFormat;
window.togglePublishDate = togglePublishDate;

function searchArticles() {
    const keyword = document.getElementById('artSearchKeyword').value.trim();
    const status = document.getElementById('artSearchStatus').value;
    loadArticles(keyword, status);
}

function loadArticles(keyword = '', status = '') {
    let url = '/api/admin/articles?limit=100'; // Get more for admin list
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    if (status) url += `&status=${status}`;
    
    toggleLoading(true);
    fetch(url, { headers: authHeaders() })
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
        // Ensure WangEditor is initialized
        const editorContainer = document.getElementById('editor-container');
        if (!editorContainer) {
            console.error('Editor container #editor-container not found!');
            showToast('编辑器初始化失败：找不到容器', 'error');
            return;
        }

        if (typeof window.wangEditorInstance === 'undefined' || !window.wangEditorInstance) {
            console.warn('WangEditor not initialized, please check initialization logic.');
            showToast('编辑器尚未就绪，请刷新页面', 'error');
            return;
        }

        // Reset form
        document.getElementById('artId').value = '';
        document.getElementById('artTitle').value = '';
        document.getElementById('artSlug').value = '';
        document.getElementById('slugPreview').textContent = '';
        document.getElementById('artCover').value = '';
        document.getElementById('artCategory').value = '';
        
        // Reset Author
        const authorSelect = document.getElementById('artAuthorSelect');
        if(authorSelect) authorSelect.value = '';
        const manualAuthorDiv = document.getElementById('manualAuthorFields');
        if(manualAuthorDiv) manualAuthorDiv.classList.add('d-none');
        
        const artAuthorEl = document.getElementById('artAuthor');
        if(artAuthorEl) artAuthorEl.value = '';
        
        const artAuthorDescEl = document.getElementById('artAuthorDesc');
        if(artAuthorDescEl) artAuthorDescEl.value = '';
        
        document.getElementById('artStatus').value = 'published';
        document.getElementById('artTags').value = '';
        document.getElementById('artFeatured').checked = false;
        
        // Reset Summaries
        document.getElementById('artDesc').value = '';
        const geoDescCountEl = document.getElementById('geoDescCount');
        if(geoDescCountEl) geoDescCountEl.textContent = '0/150';
        
        const artSeoDescEl = document.getElementById('artSeoDesc');
        if (artSeoDescEl) artSeoDescEl.value = '';
        const seoDescCountEl = document.getElementById('seoDescCount');
        if(seoDescCountEl) seoDescCountEl.textContent = '0/160';
        
        updateGeoScore(); // Reset GEO Score

        // Reset Avatar
        const artAuthorAvatarEl = document.getElementById('artAuthorAvatar');
        if(artAuthorAvatarEl) artAuthorAvatarEl.value = '';
        
        const avatarPreview = document.getElementById('artAuthorAvatarPreview');
        if(avatarPreview) {
            avatarPreview.src = '';
            avatarPreview.classList.add('d-none');
        }
        
        const artAuthorAvatarFileEl = document.getElementById('artAuthorAvatarFile');
        if(artAuthorAvatarFileEl) artAuthorAvatarFileEl.value = '';
        
        // Reset Cover
        const coverPreviewImg = document.getElementById('artCoverImg');
        const coverPlaceholder = document.getElementById('artCoverPlaceholder');
        if(coverPreviewImg) {
            coverPreviewImg.src = '';
            coverPreviewImg.classList.add('d-none');
        }
        if(coverPlaceholder) coverPlaceholder.classList.remove('d-none');
        
        // Clear Editor
        if (window.wangEditorInstance) {
            window.wangEditorInstance.setHtml('<p><br></p>');
        }
        
        if (id) {
            toggleLoading(true);
            fetch(`/api/admin/articles/${id}`, { headers: authHeaders() })
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) {
                        document.getElementById('artId').value = data._id;
                        document.getElementById('artTitle').value = data.title || '';
                        document.getElementById('artSlug').value = data.slug || '';
                        previewSlug();
                        document.getElementById('artCover').value = data.coverImage || '';
                        
                        if(data.coverImage && coverPreviewImg) {
                            coverPreviewImg.src = data.coverImage;
                            coverPreviewImg.classList.remove('d-none');
                            if(coverPlaceholder) coverPlaceholder.classList.add('d-none');
                        }
                        
                        document.getElementById('artCategory').value = data.category || '';
                        document.getElementById('artStatus').value = data.status || 'published';
                        document.getElementById('artTags').value = (data.tags || []).join(', ');
                        
                        // Handle Publish Date
                        if (data.publishDate) {
                            // Convert ISO to datetime-local format (YYYY-MM-DDTHH:mm)
                            const date = new Date(data.publishDate);
                            // Adjust to local timezone for input
                            const offset = date.getTimezoneOffset() * 60000;
                            const localISOTime = (new Date(date - offset)).toISOString().slice(0, 16);
                            document.getElementById('artPublishDate').value = localISOTime;
                        } else {
                            document.getElementById('artPublishDate').value = '';
                        }
                        
                        // Toggle date picker visibility based on status
                        togglePublishDate();
                        
                        // Author Handling
                        if (data.authorId && authorSelect) {
                            authorSelect.value = data.authorId;
                            if(manualAuthorDiv) manualAuthorDiv.classList.add('d-none');
                        } else {
                            if(authorSelect) authorSelect.value = 'manual';
                            if(manualAuthorDiv) manualAuthorDiv.classList.remove('d-none');
                            
                            const author = data.author || {};
                            const artAuthorEl = document.getElementById('artAuthor');
                            if (artAuthorEl) artAuthorEl.value = author.name || (typeof data.author === 'string' ? data.author : '');
                            
                            const artAuthorDescEl = document.getElementById('artAuthorDesc');
                            if (artAuthorDescEl) artAuthorDescEl.value = author.desc || '';
                            
                            const artAuthorDetailEl = document.getElementById('artAuthorDetail');
                            if (artAuthorDetailEl) artAuthorDetailEl.value = author.detail || '';
                            
                            const artAuthorAvatarEl = document.getElementById('artAuthorAvatar');
                            if (author.avatar) {
                                if (artAuthorAvatarEl) artAuthorAvatarEl.value = author.avatar;
                                if(avatarPreview) {
                                    avatarPreview.src = author.avatar;
                                    avatarPreview.classList.remove('d-none');
                                }
                            }
                        }
                        
                        document.getElementById('artFeatured').checked = data.isRecommended || false;
                        
                        // Load Summaries
                        document.getElementById('artDesc').value = data.summary || '';
                        updateGeoDescCount();
                        
                        const seoDescEl = document.getElementById('artSeoDesc');
                        if (seoDescEl) {
                            seoDescEl.value = data.seoDescription || '';
                            updateSeoDescCount();
                        }
                        
                        // Load Q&A
                        qaList = data.qa || [];
                        renderQAList();

                        const content = data.content || '';
                        if (window.wangEditorInstance) {
                            setTimeout(() => {
                                window.wangEditorInstance.setHtml(content);
                            }, 100);
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
        } else {
            // New Article - Check Draft
            setTimeout(checkLocalDraft, 500);
        }
        
        // Show Modal using global bootstrap or window.bootstrap
        const modalEl = document.getElementById('artModal');
        // Use window.bootstrap which is loaded in dashboard.html
        const bs = window.bootstrap; 
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
    
    let content = '';
    // Determine content based on mode
    if (window.wangEditorInstance) {
        content = window.wangEditorInstance.getHtml();
        // Check for empty content
        if (content === '<p><br></p>') content = '';
        console.log('Content from WangEditor:', content.substring(0, 50) + '...');
    } else {
        console.error('Editor is undefined!');
        showToast('编辑器未初始化', 'error');
        return;
    }

    const authorSelect = document.getElementById('artAuthorSelect');
    const authorId = authorSelect ? authorSelect.value : '';
    
    let authorData = {};
    let finalAuthorId = null;

    if (authorId && authorId !== 'manual') {
        // Selected from library
        finalAuthorId = authorId;
        // Find author object to snapshot
        const selectedAuthor = authorOptions.find(a => a._id === authorId);
        if (selectedAuthor) {
            authorData = {
                name: selectedAuthor.name,
                avatar: selectedAuthor.avatar,
                desc: selectedAuthor.desc,
                detail: selectedAuthor.detail
            };
        }
    } else {
        // Manual input
        const authorEl = document.getElementById('artAuthor');
        const authorAvatarEl = document.getElementById('artAuthorAvatar');
        const authorDescEl = document.getElementById('artAuthorDesc');
        const authorDetailEl = document.getElementById('artAuthorDetail');
        
        authorData = {
            name: authorEl ? authorEl.value.trim() : '',
            avatar: authorAvatarEl ? authorAvatarEl.value : '',
            desc: authorDescEl ? authorDescEl.value.trim() : '',
            detail: authorDetailEl ? authorDetailEl.value.trim() : ''
        };
    }

    const data = {
        title: document.getElementById('artTitle').value.trim(),
        slug: document.getElementById('artSlug').value.trim(),
        coverImage: document.getElementById('artCover').value.trim(),
        category: document.getElementById('artCategory').value,
        status: document.getElementById('artStatus').value,
        publishDate: document.getElementById('artPublishDate').value || null,
        tags: document.getElementById('artTags').value.split(/[,，]/).map(t => t.trim()).filter(t => t),
        isRecommended: document.getElementById('artFeatured').checked,
        summary: document.getElementById('artDesc').value.trim(),
        seoDescription: document.getElementById('artSeoDesc') ? document.getElementById('artSeoDesc').value.trim() : '',
        qa: typeof qaList !== 'undefined' ? qaList : (window.qaList || []),
        content: content,
        author: authorData,
        authorId: finalAuthorId,
        geoScore: window.currentGeoScores ? window.currentGeoScores.total : 0,
        geoDimensions: window.currentGeoScores ? {
            semantic: window.currentGeoScores.semantic,
            ai: window.currentGeoScores.ai,
            structure: window.currentGeoScores.structure,
            other: window.currentGeoScores.other
        } : {}
    };
    
    console.log('Data to send:', data);

    if (!data.title) { showToast('标题不能为空', 'error'); return; }
    if (!data.content || data.content === '<p><br></p>') {
        showToast('文章内容不能为空', 'error');
        return;
    }
    
    // Validate Scheduled Date
    if (data.status === 'scheduled' && !data.publishDate) {
        showToast('请设置预定发布时间', 'warning');
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
            // Try to hide modal safely
            try {
                const modalEl = document.getElementById('artModal');
                const bs = window.bootstrap;
                if (bs && modalEl) {
                    const modal = bs.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
            } catch(e) { console.error('Hide modal error:', e); }
            loadArticles();
        } else showToast(res.error, 'error');
    })
    .catch(err => {
        console.error('Save Article Error:', err);
        showToast('网络请求失败', 'error');
    });
}

function normalizeSeoSlug(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-')
        .slice(0, 60)
        .replace(/-+$/g, '');
}

function autoGenerateSlug(forceAi = false) {
    const id = studioVal('artId');
    if (id && !forceAi) return; // Don't auto-change slug for existing articles
    
    const title = studioTitle();
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
                slugInput.value = normalizeSeoSlug(data.slug);
                previewSlug();
                showToast('智能Slug生成成功');
            } else {
                showToast('生成失败: ' + (data.error || '未知错误'), 'error');
            }
        })
        .catch(e => {
            console.error('Slug AI Error:', e);
            showToast('Slug 生成失败，请填写与主题相关的英文关键词', 'error');
            slugInput.focus();
        })
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalIcon;
            }
        });
    } else if (!slugInput.value && /^[a-zA-Z0-9\s-]+$/.test(title)) {
        slugInput.value = normalizeSeoSlug(title);
        previewSlug();
    }
}

function previewSlug() {
    const slug = document.getElementById('artSlug').value.trim();
    const preview = document.getElementById('slugPreview');
    if (slug) {
        const cleanSlug = normalizeSeoSlug(slug);
        document.getElementById('artSlug').value = cleanSlug;
        preview.textContent = cleanSlug ? `预览: /insights/${cleanSlug}` : '仅支持英文小写字母、数字和短横线';
    } else {
        preview.textContent = '';
    }
    updateSeoScore();
}

function autoGenerateTags() {
    let content = '';
    if (window.wangEditorInstance) {
        content = window.wangEditorInstance.getText();
    }
    const title = studioTitle();
    
    if (!content && !title) {
        showToast('请先输入文章标题或内容', 'warning');
        return;
    }

    const btn = document.querySelector('button[onclick="autoGenerateTags()"]');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> 生成中...';
    }

    fetch('/api/tools/tags', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders()
        },
        body: JSON.stringify({ content, title })
    })
    .then(res => res.json())
    .then(data => {
        if (data.tags) {
            document.getElementById('artTags').value = data.tags;
            updateSeoScore();
            showToast('智能标签生成成功');
        } else {
            showToast('生成失败: ' + (data.error || '未知错误'), 'error');
        }
    })
    .catch(e => {
        console.error('Tags AI Error:', e);
        showToast('请求生成标签失败', 'error');
    })
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    });
}

function autoGenerateSummary(type = 'seo') {
    let content = '';
    if (window.wangEditorInstance) {
        content = window.wangEditorInstance.getText();
    }
    
    if (!content || content.trim().length < 50) {
        showToast('请先输入足够的文章内容(至少50字)', 'warning');
        return;
    }

    const btn = document.querySelector(`button[onclick="autoGenerateSummary('${type}')"]`);
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split text-brand"></i>';
    }

    fetch('/api/tools/summary', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders()
        },
        body: JSON.stringify({ content, type })
    })
    .then(res => res.json())
    .then(data => {
        if (data.summary) {
            if (type === 'seo') {
                const el = document.getElementById('artSeoDesc');
                if (el) el.value = data.summary;
                updateSeoDescCount();
                showToast('智能 SEO 摘要生成成功');
            } else if (type === 'geo') {
                const el = document.getElementById('artDesc');
                if (el) el.value = data.summary.slice(0, 150);
                updateGeoDescCount();
                showToast('智能 GEO 摘要生成成功');
            }
        } else {
            showToast('生成失败: ' + (data.error || '未知错误'), 'error');
        }
    })
    .catch(e => {
        console.error('Summary AI Error:', e);
        showToast('请求生成摘要失败', 'error');
    })
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    });
}

function uploadCover() {
    const fileInput = document.getElementById('artCoverFile');
    const file = fileInput.files[0];
    if(!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Show loading state
    const box = document.getElementById('artCoverPreviewBox');
    const placeholder = document.getElementById('artCoverPlaceholder');
    const img = document.getElementById('artCoverImg');
    
    if (placeholder) placeholder.innerHTML = '<div class="spinner-border spinner-border-sm text-brand" role="status"></div><br><small>上传中...</small>';
    
    fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': authHeaders().Authorization },
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            document.getElementById('artCover').value = data.url;
            if (img) {
                img.src = data.url;
                img.classList.remove('d-none');
            }
            if (placeholder) {
                placeholder.classList.add('d-none');
                // Reset placeholder for next time
                placeholder.innerHTML = '<i class="bi bi-image fs-4"></i><br><small>点击上传</small>';
            }
            
            // Update Alt Status Badge
            const altBadge = document.getElementById('coverAltStatus');
            if(altBadge) {
                altBadge.textContent = 'Alt已配';
                altBadge.className = 'badge bg-success-light text-success rounded-pill';
            }
            
            showToast('上传成功');
            updateSeoScore();
        } else {
            showToast('上传失败: ' + (data.error || '未知错误'), 'error');
            if (placeholder) placeholder.innerHTML = '<i class="bi bi-image fs-4"></i><br><small>点击上传</small>';
        }
    })
    .catch(err => {
        console.error('Upload Error:', err);
        showToast('上传请求出错', 'error');
        if (placeholder) placeholder.innerHTML = '<i class="bi bi-image fs-4"></i><br><small>点击上传</small>';
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
                <button class="list-group-item list-group-item-action" onclick="selectArticle('${art.title.replace(/'/g, "\\'")}', '/insights/${encodeURIComponent(art.slug)}', '${art.category}')">
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

// Toggle Publish Date Picker
function togglePublishDate() {
    const status = document.getElementById('artStatus').value;
    const wrapper = document.getElementById('publishDateWrapper');
    if (wrapper) {
        if (status === 'scheduled') {
            wrapper.style.display = 'block';
        } else {
            wrapper.style.display = 'none';
        }
    }
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
window.batchStatusArt = batchStatusArt;
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
window.togglePublishDate = togglePublishDate;
// window.toggleEditorMode = toggleEditorMode; // Removed
window.smartFormat = smartFormat;
window.showHistory = showHistory;
window.onAuthorSelectChange = onAuthorSelectChange;
if (typeof updateDescCount !== 'undefined') window.updateDescCount = updateDescCount;
