const STATUS_LABELS = { not_started: '未开始', in_progress: '进行中', ended: '已结束' };

document.addEventListener('DOMContentLoaded', () => {
    ['topic1_proVotes', 'topic1_conVotes', 'topic2_proVotes', 'topic2_conVotes', 'maxVotesPerDevice']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', refreshStats);
        });
    loadConfig();
});

function showLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) el.style.display = 'flex';
}

function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) el.style.display = 'none';
}

function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('on'), 2200);
}

function setStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function num(id) {
    const el = document.getElementById(id);
    return el ? (parseInt(el.value, 10) || 0) : 0;
}

function refreshStats() {
    const t1Status = document.getElementById('topic1_status');
    setStat('statTopic1Status', t1Status ? (STATUS_LABELS[t1Status.value] || '—') : '—');
    setStat('statTopic1Total', num('topic1_proVotes') + num('topic1_conVotes'));
    setStat('statTopic2Total', num('topic2_proVotes') + num('topic2_conVotes'));
    setStat('statMaxVotes', num('maxVotesPerDevice') || '—');
}

function updateSelectColor(select) {
    if (!select) return;
    select.classList.remove('st-not', 'st-on', 'st-end');
    if (select.value === 'not_started') select.classList.add('st-not');
    if (select.value === 'in_progress') select.classList.add('st-on');
    if (select.value === 'ended') select.classList.add('st-end');
    refreshStats();
}

async function loadConfig() {
    showLoading();
    try {
        const response = await fetch('/api/admin/nqoc/debate/config', { headers: authHeaders() });
        const result = await response.json();
        if (result.success && result.data) {
            const data = result.data;

            const t1Status = document.getElementById('topic1_status');
            t1Status.value = data.topic1_status || (data.topic1_isOpen ? 'in_progress' : 'ended');
            updateSelectColor(t1Status);
            document.getElementById('topic1_proVotes').value = data.topic1_proVotes ?? 0;
            document.getElementById('topic1_conVotes').value = data.topic1_conVotes ?? 0;

            const t2Status = document.getElementById('topic2_status');
            t2Status.value = data.topic2_status || (data.topic2_isOpen ? 'in_progress' : 'ended');
            updateSelectColor(t2Status);
            document.getElementById('topic2_proVotes').value = data.topic2_proVotes ?? 0;
            document.getElementById('topic2_conVotes').value = data.topic2_conVotes ?? 0;

            document.getElementById('maxVotesPerDevice').value = data.maxVotesPerDevice ?? 5;
            refreshStats();
        } else {
            toast(result.error || '加载配置失败');
        }
    } catch (e) {
        console.error(e);
        toast('加载配置失败');
    } finally {
        hideLoading();
    }
}

async function saveConfig() {
    const configData = {
        topic1_status: document.getElementById('topic1_status').value,
        topic1_proVotes: num('topic1_proVotes'),
        topic1_conVotes: num('topic1_conVotes'),
        topic2_status: document.getElementById('topic2_status').value,
        topic2_proVotes: num('topic2_proVotes'),
        topic2_conVotes: num('topic2_conVotes'),
        maxVotesPerDevice: num('maxVotesPerDevice') || 5
    };

    showLoading();
    try {
        const response = await fetch('/api/admin/nqoc/debate/config', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(configData)
        });
        const result = await response.json();
        if (result.success) {
            refreshStats();
            toast('配置保存成功');
        } else {
            toast(result.error || '保存失败');
        }
    } catch (e) {
        console.error(e);
        toast('保存失败');
    } finally {
        hideLoading();
    }
}
