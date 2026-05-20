document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
});

async function loadConfig() {
    toggleLoading(true);
    try {
        const response = await fetch('/api/admin/nqoc/debate/config', {
            headers: authHeaders()
        });
        const result = await response.json();
        if (result.success && result.data) {
            const data = result.data;
            
            // Topic 1
            const t1Status = document.getElementById('topic1_status');
            t1Status.value = data.topic1_status || (data.topic1_isOpen ? 'in_progress' : 'ended');
            if(window.updateSelectColor) updateSelectColor(t1Status);
            document.getElementById('topic1_proVotes').value = data.topic1_proVotes;
            document.getElementById('topic1_conVotes').value = data.topic1_conVotes;

            // Topic 2
            const t2Status = document.getElementById('topic2_status');
            t2Status.value = data.topic2_status || (data.topic2_isOpen ? 'in_progress' : 'ended');
            if(window.updateSelectColor) updateSelectColor(t2Status);
            document.getElementById('topic2_proVotes').value = data.topic2_proVotes;
            document.getElementById('topic2_conVotes').value = data.topic2_conVotes;

            document.getElementById('maxVotesPerDevice').value = data.maxVotesPerDevice;
        } else {
            showToast(result.error || '加载配置失败', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('加载配置失败', 'error');
    } finally {
        toggleLoading(false);
    }
}

async function saveConfig() {
    const configData = {
        topic1_status: document.getElementById('topic1_status').value,
        topic1_proVotes: parseInt(document.getElementById('topic1_proVotes').value) || 0,
        topic1_conVotes: parseInt(document.getElementById('topic1_conVotes').value) || 0,
        
        topic2_status: document.getElementById('topic2_status').value,
        topic2_proVotes: parseInt(document.getElementById('topic2_proVotes').value) || 0,
        topic2_conVotes: parseInt(document.getElementById('topic2_conVotes').value) || 0,
        
        maxVotesPerDevice: parseInt(document.getElementById('maxVotesPerDevice').value) || 5
    };

    toggleLoading(true);
    try {
        const response = await fetch('/api/admin/nqoc/debate/config', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(configData)
        });
        const result = await response.json();
        if (result.success) {
            showToast('配置保存成功', 'success');
        } else {
            showToast(result.error || '保存失败', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('保存失败', 'error');
    } finally {
        toggleLoading(false);
    }
}
