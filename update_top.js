// nqoc-survey.js
let SURVEY_MAPPINGS = {};

document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    try {
        const response = await fetch('/admin/js/survey_mappings.json');
        if (response.ok) {
            SURVEY_MAPPINGS = await response.json();
        }
    } catch (e) {
        console.error("Failed to fetch survey_mappings.json", e);
    }
    
    await loadChannels(); // Wait for channels to map codes to names
    await loadData(1);
    await loadStats();
    await loadTrackingStats();
    hideLoading();
});

function showLoading() { document.getElementById('loadingOverlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; }