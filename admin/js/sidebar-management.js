// ================= Sidebar Management Module =================

function loadSidebarData() {
    toggleLoading(true);
    fetch('/api/sidebar')
        .then(res => res.json())
        .then(data => {
            const wp = data.whitepaper || {};
            if(document.getElementById('s-wp-title')) {
                document.getElementById('s-wp-title').value = wp.title || '';
                document.getElementById('s-wp-img').value = wp.img || '';
                document.getElementById('s-wp-link').value = wp.link || '';
                document.getElementById('s-wp-desc').value = wp.desc || '';
                document.getElementById('s-wp-count').value = wp.count || '';
            }
            
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
        })
        .catch(err => showToast('加载侧边栏配置失败', 'error'))
        .finally(() => toggleLoading(false));
}

function saveSidebar() {
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
    
    if (!data.whitepaper.title) {
        showToast('白皮书标题不能为空', 'error');
        return;
    }

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
    .catch(err => showToast('请求失败', 'error'));
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
    .catch(err => showToast('上传出错', 'error'))
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
        fileInput.value = '';
    });
}

window.loadSidebarData = loadSidebarData;
window.saveSidebar = saveSidebar;
window.uploadWhitepaperImage = uploadWhitepaperImage;
