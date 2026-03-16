
// ================= Dashboard Logic =================

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
    
    if (typeof Chart === 'undefined') {
        console.error('Chart.js not loaded');
        return;
    }

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
    toggleLoading(true);
    try {
        const data = await fetchDashboardStats(startDate, endDate);
        if (data && !data.error) {
            renderTrafficChart(data.dates, data.series);
            updateSummaryCards(data.summary);
        } else {
            showToast('加载数据失败: ' + (data.error || '未知错误'), 'error');
        }
    } catch (e) {
        console.error('Load dashboard failed:', e);
        showToast('加载数据出错', 'error');
    } finally {
        toggleLoading(false);
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
    loadDashboard(s, e);
}

// Auto init if dashboard is active
document.addEventListener('DOMContentLoaded', () => {
    // If dashboard is the default view, load it
    if (document.getElementById('dashboard') && (!sessionStorage.getItem('lastSection') || sessionStorage.getItem('lastSection') === 'dashboard')) {
        setChartRange(7);
    }
});
