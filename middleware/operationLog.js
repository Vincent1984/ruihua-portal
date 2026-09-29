const { AsyncLocalStorage } = require('async_hooks');
const OperationLog = require('../models/OperationLog');

// 以 AsyncLocalStorage 传递请求上下文，使 logOp 在不改动大量调用点的情况下拿到真实客户端 IP
const requestContext = new AsyncLocalStorage();

/**
 * 早期中间件：为每个请求建立上下文（server.js 中注册，需在路由之前）。
 * 依赖 app.set('trust proxy', 1) 才能取到代理后的真实客户端 IP。
 */
function operationLogContext(req, res, next) {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || '';
    requestContext.run({ ip }, next);
}

/**
 * 操作日志记录。从 server.js 抽离，避免 routes 反向依赖 server.js。
 * @param {string} action
 * @param {string} module
 * @param {string} detail
 * @param {string} [operator]
 */
async function logOp(action, module, detail, operator) {
    const store = requestContext.getStore();
    try {
        await OperationLog.create({
            action,
            module,
            detail,
            operator: operator || 'System',
            ip: (store && store.ip) || ''
        });
    } catch (e) {
        console.error('Logging failed:', e);
    }
}

logOp.operationLogContext = operationLogContext;

module.exports = logOp;
