const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { once } = require('events');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

describe('TOS resource lifecycle', function () {
    for (const fail of [false, true]) {
        it(`closes the file even when the SDK ${fail ? 'rejects before reading' : 'returns without consuming the body'}`, async function () {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-stream-'));
            const file = path.join(dir, 'video');
            fs.writeFileSync(file, 'test video');
            let body;
            const failure = new Error('connection failed');
            const context = {
                fs, process, PutObjectCommand, useTosUpload: true,
                toTosPublicUrl: key => `https://example.test/${key}`,
                tosClient: { send: async command => {
                    body = command.input.Body;
                    // Open a real descriptor, but leave the body unconsumed.
                    await once(body, 'open');
                    if (fail) throw failure;
                } }
            };
            const start = source.indexOf('async function uploadFileToTos(');
            const end = source.indexOf('\nfunction buildSignedDingTalkWebhookUrl', start);
            vm.runInNewContext(source.slice(start, end) + '\nthis.upload = uploadFileToTos;', context);
            try {
                const result = context.upload(file, 'video', 'video/mp4', 10);
                if (fail) await assert.rejects(result, error => error === failure);
                else assert.strictEqual(await result, 'https://example.test/video');
                assert.strictEqual(body.destroyed, true);
                if (!body.closed) await once(body, 'close');
                assert.strictEqual(body.fd, null);
            } finally {
                if (body) body.destroy();
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    }

    it('the installed SDK applies pool limits and timeouts from the shorthand config', async function () {
        const start = source.indexOf('const tosClient =');
        const end = source.indexOf('\nif (useTosUpload)', start);
        const context = {
            S3Client, process: { env: { TOS_ACCESS_KEY: 'test' } },
            useTosUpload: true, tosEndpoint: 'https://example.test', tosSecretAccessKey: 'test'
        };
        vm.runInNewContext(source.slice(start, end) + '\nthis.client = tosClient;', context);
        try {
            const handler = context.client.config.requestHandler;
            const config = await handler.configProvider;
            // No request is sent; initialize the lazy config for normal destroy() cleanup.
            handler.config = config;
            assert.strictEqual(config.connectionTimeout, 10000);
            assert.strictEqual(config.socketTimeout, 60000);
            assert.strictEqual(config.httpsAgent.maxSockets, 32);
            assert.strictEqual(config.httpsAgent.maxFreeSockets, 4);
            assert.strictEqual(config.httpsAgent.keepAlive, true);
            assert.strictEqual(config.httpsAgent.options.timeout, 60000);
        } finally {
            context.client.destroy();
        }
    });
});
