// ================= Banner Management Module =================

function loadBannerData() {
    console.log('Loading Banner Data...');
    // Use Store if available, else fetch directly
    if (window.bannerStore) {
        window.bannerStore.fetchConfig().then(() => {
            const data = window.bannerStore.data;
            updateBannerUI(data);
        });
    } else {
        toggleLoading(true);
        fetch('/api/banner')
            .then(res => res.json())
            .then(data => updateBannerUI(data))
            .catch(err => showToast('加载Banner配置失败', 'error'))
            .finally(() => toggleLoading(false));
    }
}

function updateBannerUI(data) {
    if(!document.getElementById('b-title')) return;
    document.getElementById('b-title').value = data.title || '';
    document.getElementById('b-subTitle').value = data.subTitle || '';
    document.getElementById('b-desc').value = data.desc || '';
    document.getElementById('b-cta1Text').value = data.cta1?.text || '';
    document.getElementById('b-cta1Link').value = data.cta1?.link || '';
    document.getElementById('b-cta2Text').value = data.cta2?.text || '';
    document.getElementById('b-cta2Link').value = data.cta2?.link || '';
    document.getElementById('b-image').value = data.image || '';
}

function saveBanner() {
    const data = {
        title: document.getElementById('b-title').value.trim(),
        subTitle: document.getElementById('b-subTitle').value.trim(),
        desc: document.getElementById('b-desc').value.trim(),
        cta1: {
            text: document.getElementById('b-cta1Text').value.trim(),
            link: document.getElementById('b-cta1Link').value.trim()
        },
        cta2: {
            text: document.getElementById('b-cta2Text').value.trim(),
            link: document.getElementById('b-cta2Link').value.trim()
        },
        image: document.getElementById('b-image').value.trim()
    };

    if (!data.title) {
        showToast('主标题不能为空', 'error');
        return;
    }

    if (window.bannerStore) {
        window.bannerStore.saveConfig(data)
            .then(() => showToast('Banner配置已保存'))
            .catch(err => showToast('保存失败: ' + err.message, 'error'));
    } else {
        fetch('/api/banner', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) showToast('Banner配置已保存');
            else showToast('保存失败: ' + (data.error || '未知错误'), 'error');
        })
        .catch(err => showToast('请求失败', 'error'));
    }
}

// Export
window.loadBannerData = loadBannerData;
window.saveBanner = saveBanner;
