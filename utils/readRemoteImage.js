// The deadline covers headers AND body. Always dispose of an unconsumed body.
async function readRemoteImage(url, { signal, timeoutMs = 5000, maxBytes = 10 * 1024 * 1024 } = {}) {
    const fetch = (await import('node-fetch')).default;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    timer.unref();
    let response;
    const invalid = message => Object.assign(new Error(message), { status: 400 });
    try {
        response = await fetch(url, { signal: controller.signal, redirect: 'error' });
        if (!response.ok) throw invalid('Failed to fetch image from URL');
        if (Number(response.headers.get('content-length')) > maxBytes) {
            throw invalid('Image file exceeds maximum size of 10MB');
        }
        const contentType = response.headers.get('content-type');
        if (!contentType?.startsWith('image/')) throw invalid('URL does not point to a valid image');
        const chunks = [];
        let received = 0;
        for await (const chunk of response.body) {
            received += chunk.length;
            if (received > maxBytes) throw invalid('Image file exceeds maximum size of 10MB');
            chunks.push(chunk);
        }
        return { buffer: Buffer.concat(chunks), contentType };
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        response?.body?.destroy();
        controller.abort();
    }
}

module.exports = { readRemoteImage };
