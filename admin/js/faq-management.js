// ================= FAQ Management Module =================

let faqEditorInstance = null;

function initFaqEditor(initialHtml = '') {
    if (!window.wangEditor) return;
    const { createEditor, createToolbar } = window.wangEditor;
    
    if (faqEditorInstance) {
        faqEditorInstance.destroy();
        faqEditorInstance = null;
    }
    
    const editorContainer = document.getElementById('faq-editor-container');
    const toolbarContainer = document.getElementById('faq-editor-toolbar');
    if (!editorContainer || !toolbarContainer) return;
    
    editorContainer.innerHTML = '';
    toolbarContainer.innerHTML = '';

    const editorConfig = {
        placeholder: '请输入详细答案...',
        MENU_CONF: {
            uploadImage: {
                server: '/api/upload',
                fieldName: 'file',
                headers: {
                    Authorization: 'Bearer ' + sessionStorage.getItem('token')
                },
                maxFileSize: 2 * 1024 * 1024,
                maxNumberOfFiles: 10,
                allowedFileTypes: ['image/*'],
                customInsert(res, insertFn) {
                    if (res.success && res.url) {
                        insertFn(res.url, '图片', res.url);
                    } else {
                        showToast(res.error || '图片上传失败', 'error');
                    }
                }
            }
        }
    };

    faqEditorInstance = createEditor({
        selector: '#faq-editor-container',
        html: initialHtml,
        config: editorConfig,
        mode: 'default'
    });

    createToolbar({
        editor: faqEditorInstance,
        selector: '#faq-editor-toolbar',
        mode: 'default'
    });
}

function loadFaqs() {
    toggleLoading(true);
    fetch('/api/faqs')
    .then(res => res.json())
    .then(data => {
        const tbody = document.getElementById('faqList');
        if(!tbody) return;
        tbody.innerHTML = data.map(faq => `
            <tr>
                <td><input type="checkbox" class="form-check-input faq-check" value="${faq._id}"></td>
                <td>${faq.order || 0}</td>
                <td class="text-truncate" style="max-width: 300px;">${faq.question}</td>
                <td class="text-truncate" style="max-width: 300px;">${faq.answer.replace(/<[^>]+>/g, ' ')}</td>
                <td>${faq.status === 'published' ? '<span class="badge bg-success">已发布</span>' : '<span class="badge bg-secondary">草稿</span>'}</td>
                <td>${new Date(faq.createdAt).toLocaleDateString()}</td>
                <td>${new Date(faq.updatedAt).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="openFaqModal('${faq._id}')">编辑</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteFaq('${faq._id}')">删除</button>
                </td>
            </tr>
        `).join('');
    })
    .catch(err => showToast('加载FAQ列表失败', 'error'))
    .finally(() => toggleLoading(false));
}

function openFaqModal(id = null) {
    document.getElementById('faqId').value = '';
    document.getElementById('faqQ').value = '';
    document.getElementById('faqDesc').value = '';
    document.getElementById('faqOrd').value = 0;
    document.getElementById('faqStatus').value = 'published';
    
    if(id) {
        fetch(`/api/faqs/${id}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('faqId').value = data._id;
            document.getElementById('faqQ').value = data.question;
            document.getElementById('faqDesc').value = data.description || '';
            document.getElementById('faqOrd').value = data.order;
            document.getElementById('faqStatus').value = data.status || 'published';
            initFaqEditor(data.answer);
            new bootstrap.Modal(document.getElementById('faqModal')).show();
        });
    } else {
        initFaqEditor('');
        new bootstrap.Modal(document.getElementById('faqModal')).show();
    }
}

function saveFaq() {
    const id = document.getElementById('faqId').value;
    const answerContent = faqEditorInstance ? faqEditorInstance.getHtml() : '';
    const data = {
        question: document.getElementById('faqQ').value.trim(),
        description: document.getElementById('faqDesc').value.trim(),
        answer: answerContent,
        order: parseInt(document.getElementById('faqOrd').value) || 0,
        status: document.getElementById('faqStatus').value
    };
    
    if(!data.question || !data.answer || data.answer === '<p><br></p>') { 
        showToast('问题和答案必填', 'error'); 
        return; 
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/faqs/${id}` : '/api/faqs';

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        if(res.success) {
            showToast('保存成功');
            bootstrap.Modal.getInstance(document.getElementById('faqModal')).hide();
            loadFaqs();
        } else showToast(res.error, 'error');
    });
}

function deleteFaq(id) {
    if(!confirm('删除?')) return;
    fetch(`/api/faqs/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then(res => res.json())
    .then(res => {
        if(res.success) {
            loadFaqs();
        } else showToast(res.error, 'error');
    });
}

function batchDeleteFaq() {
    const ids = Array.from(document.querySelectorAll('.faq-check:checked')).map(cb => cb.value);
    if(ids.length === 0) return;
    
    if(!confirm(`确定删除选中的 ${ids.length} 项吗？`)) return;
    
    toggleLoading(true);
    Promise.all(ids.map(id => fetch(`/api/faqs/${id}`, { method: 'DELETE', headers: authHeaders() })))
    .then(() => {
        showToast('批量删除完成');
        loadFaqs();
    })
    .finally(() => toggleLoading(false));
}

function exportFaqs() {
    fetch('/api/faqs')
    .then(res => res.json())
    .then(data => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "faqs_export_" + Date.now() + ".json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showToast('导出成功');
    })
    .catch(err => showToast('导出失败', 'error'));
}

function importFaqs(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error('Invalid JSON format');
            
            toggleLoading(true);
            let successCount = 0;
            
            // Sequential import to avoid rate limiting
            for (const item of data) {
                const payload = {
                    question: item.question,
                    description: item.description || '',
                    answer: item.answer,
                    order: item.order || 0,
                    status: item.status || 'published'
                };
                
                if (!payload.question || !payload.answer) continue;
                
                const res = await fetch('/api/faqs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (result.success) successCount++;
            }
            
            showToast(`成功导入 ${successCount} 条 FAQ`);
            loadFaqs();
        } catch (err) {
            showToast('导入解析失败，请检查文件格式', 'error');
        } finally {
            input.value = ''; // reset input
            toggleLoading(false);
        }
    };
    reader.readAsText(file);
}

window.loadFaqs = loadFaqs;
window.openFaqModal = openFaqModal;
window.saveFaq = saveFaq;
window.deleteFaq = deleteFaq;
window.batchDeleteFaq = batchDeleteFaq;
window.exportFaqs = exportFaqs;
window.importFaqs = importFaqs;
