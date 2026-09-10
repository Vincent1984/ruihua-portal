const OperationLog = require('../models/OperationLog');

/**
 * 操作日志记录。从 server.js 抽离，避免 routes 反向依赖 server.js。
 * @param {string} action
 * @param {string} module
 * @param {string} detail
 * @param {string} [operator]
 */
async function logOp(action, module, detail, operator) {
    try {
        await OperationLog.create({
            action,
            module,
            detail,
            operator: operator || 'System',
            ip: '127.0.0.1' // Simplify for now
        });
    } catch (e) {
        console.error('Logging failed:', e);
    }
}

module.exports = logOp;
