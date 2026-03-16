// ================= FAQ Management Module =================

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
                <td class="text-truncate" style="max-width: 300px;">${faq.answer}</td>
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
    document.getElementById('faqA').value = '';
    document.getElementById('faqOrd').value = 0;
    document.getElementById('faqStatus').value = 'published';
    
    if(id) {
        fetch(`/api/faqs/${id}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('faqId').value = data._id;
            document.getElementById('faqQ').value = data.question;
            document.getElementById('faqA').value = data.answer;
            document.getElementById('faqOrd').value = data.order;
            document.getElementById('faqStatus').value = data.status || 'published';
        });
    }
    new bootstrap.Modal(document.getElementById('faqModal')).show();
}

function saveFaq() {
    const id = document.getElementById('faqId').value;
    const data = {
        question: document.getElementById('faqQ').value.trim(),
        answer: document.getElementById('faqA').value.trim(),
        order: parseInt(document.getElementById('faqOrd').value) || 0,
        status: document.getElementById('faqStatus').value
    };
    
    if(!data.question || !data.answer) { showToast('问答必填', 'error'); return; }

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

window.loadFaqs = loadFaqs;
window.openFaqModal = openFaqModal;
window.saveFaq = saveFaq;
window.deleteFaq = deleteFaq;
window.batchDeleteFaq = batchDeleteFaq;
