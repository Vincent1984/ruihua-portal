const assert = require('assert');
const fs = require('fs');
const http = require('http');
const vm = require('vm');
const crypto = require('crypto');
const path = require('path');
const { EventEmitter, once } = require('events');
const { PassThrough, pipeline } = require('stream');
const { readRemoteImage } = require('../utils/readRemoteImage');
const root = path.join(__dirname, '..');

describe('Remote resource lifecycle', function () {
    let origin, base, sockets;
    beforeEach(async function () {
        sockets = new Set();
        origin = http.createServer();
        origin.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
        origin.listen(0, '127.0.0.1');
        await once(origin, 'listening');
        base = `http://127.0.0.1:${origin.address().port}`;
    });
    afterEach(async function () {
        for (const socket of sockets) socket.destroy();
        await new Promise(resolve => origin.close(resolve));
    });
    it('times out a stalled image body after receiving headers', async function () {
        origin.on('request', (req, res) => { res.writeHead(200, { 'Content-Type': 'image/png' }); res.write('partial'); });
        await assert.rejects(readRemoteImage(base, { timeoutMs: 50 }), /abort/i);
    });
    for (const [label, headers] of [
        ['invalid type', { 'Content-Type': 'text/plain' }],
        ['oversized body', { 'Content-Type': 'image/png', 'Content-Length': '20000000' }]
    ]) it(`closes an unconsumed image response with ${label}`, async function () {
        let closed;
        origin.on('request', (req, res) => {
            closed = once(res, 'close'); res.writeHead(200, headers); res.write('partial');
        });
        await assert.rejects(readRemoteImage(base), error => error.status === 400);
        await closed;
    });
    it('enforces the byte limit without Content-Length', async function () {
        origin.on('request', (req, res) => { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end('too large'); });
        await assert.rejects(readRemoteImage(base, { maxBytes: 3 }), /maximum size/);
    });
    it('returns a complete valid image', async function () {
        origin.on('request', (req, res) => { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end('image'); });
        assert.strictEqual((await readRemoteImage(base)).buffer.toString(), 'image');
    });
    it('aborts image consumption when the caller disconnects', async function () {
        const controller = new AbortController();
        origin.on('request', (req, res) => { res.writeHead(200, { 'Content-Type': 'image/png' }); res.write('partial'); controller.abort(); });
        await assert.rejects(readRemoteImage(base, { signal: controller.signal }), /abort/i);
    });
    it('destroys the PDF downstream when a real upstream sends a partial body then resets', async function () {
        const source = fs.readFileSync(path.join(root, 'routes/nqocFrontend.js'), 'utf8');
        const start = source.indexOf("    app.get('/nqoc/report-2026.pdf'");
        let route;
        vm.runInNewContext(source.slice(start, source.indexOf('\n    const legacy =', start)), {
            app: { get: (p, fn) => { route = fn; } },
            https: { get: (url, opts, cb) => http.get(base, cb) }, pipeline,
            REPORT_PDF_URL: base, REPORT_PDF_AGENT: {}, reportPdfSecret: 'test',
            reportPdfSignature: () => 'valid', crypto, Buffer
        });
        origin.on('request', (req, res) => {
            res.writeHead(200, { 'Content-Length': '10000' }); res.write('partial');
            setTimeout(() => res.destroy(), 10);
        });
        const res = new PassThrough(); res.resume();
        res.headersSent = false; res.status = () => res; res.setHeader = () => {}; res.redirect = () => res.end();
        const closed = new Promise(resolve => res.once('close', resolve));
        res.on('error', () => {});
        route({ query: { exp: Date.now() + 60000, sig: 'valid' }, headers: {} }, res);
        await closed;
        assert.strictEqual(res.destroyed, true);
    });
});

describe('AI upstream cancellation', function () {
    for (const stage of ['headers', 'body', 'deadline']) {
        it(`aborts a pending ${stage} operation and clears the inflight entry`, async function () {
            const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
            const start = source.indexOf("app.post('/api/ai/chat'");
            let route, upstreamSignal, cancelled = 0;
            const res = new EventEmitter(); res.headersSent = true;
            res.end = () => {}; res.write = () => {};
            const inflight = new Set();
            const context = {
                app: { post: (p, m, fn) => { route = fn; } }, aiChatLimiter: () => {},
                process: { env: { DEEPSEEK_API_KEY: 'test' } }, aiGuard: () => null,
                aiInflight: inflight, AI_ADVISOR_SYSTEM_PROMPT: 'test', aiSseHead: () => {}, aiSseSend: () => {},
                AbortController, TextDecoder, setInterval, clearInterval, clearTimeout,
                setTimeout: fn => setTimeout(fn, 40), console: { error: () => {} },
                deepseekChatStream: async (messages, opts) => {
                    upstreamSignal = opts.signal;
                    if (stage === 'headers') return new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(new Error('aborted'))));
                    return {
                        read: () => new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(new Error('aborted')))),
                        cancel: async () => { cancelled++; }, releaseLock: () => {}
                    };
                }
            };
            vm.runInNewContext(source.slice(start, source.indexOf('// --- Tools API ---', start)), context);
            const work = route({ ip: 'test', body: { question: 'test' } }, res);
            await new Promise(setImmediate);
            if (stage !== 'deadline') res.emit('close');
            await work;
            assert.strictEqual(upstreamSignal.aborted, true);
            assert.strictEqual(inflight.size, 0);
            assert.strictEqual(res.listenerCount('close'), 0);
            if (stage !== 'headers') assert.strictEqual(cancelled, 1);
        });
    }
});
