// 通用路由工具函数。从 server.js 抽离，供各 routes 模块复用。

// Escape special regex characters in user input for safe $regex queries
function escapeRegex(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sendInternalError(res, logLabel, err) {
    if (logLabel) console.error(logLabel, err);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
}

module.exports = { escapeRegex, sendInternalError };
