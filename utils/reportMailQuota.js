const crypto = require('crypto');

const DEFAULTS = { perMinute: 4, perDay: 100 };
function limits() {
    const read = (key, fallback) => {
        const value = Number(process.env[key]);
        return Number.isSafeInteger(value) && value > 0 && value <= 10000 ? value : fallback;
    };
    return { perMinute: read('REPORT_SMTP_PER_MINUTE', DEFAULTS.perMinute), perDay: read('REPORT_SMTP_PER_DAY', DEFAULTS.perDay) };
}
function dayWindow(now) {
    const offset = 8 * 3600000;
    const start = Math.floor((now + offset) / 86400000) * 86400000 - offset;
    return new Date(start + 86400000);
}
function createQuota(connection, account) {
    const collection = connection.collection('report_mail_quotas');
    const id = crypto.createHash('sha256').update(account.toLowerCase()).digest('hex');
    async function get() {
        return collection.findOne({ _id: id });
    }
    async function acquire(now = Date.now(), priority = true) {
        const policy = limits();
        const dayEnd = dayWindow(now);
        for (let retry = 0; retry < 5; retry++) {
            const current = await get();
            const recent = (current?.recent || []).filter(time => time > now - 60000);
            const count = Number(current?.dayEnd) === +dayEnd ? current.count : 0;
            const dailyCap = priority ? policy.perDay : Math.max(1, policy.perDay - Math.ceil(policy.perDay * 0.2));
            const waitUntil = Math.max(Number(current?.pausedUntil) || 0, Number(current?.leaseUntil) || 0,
                count >= dailyCap ? +dayEnd : 0, recent.length >= policy.perMinute ? recent[0] + 60000 : 0);
            if (waitUntil > now) return { waitUntil: new Date(waitUntil) };
            const lease = crypto.randomUUID();
            const state = { recent: [...recent, now], count: count + 1, dayEnd, lease, leaseUntil: new Date(now + 180000) };
            if (!current) {
                try { await collection.insertOne({ _id: id, revision: 1, ...state }); return { lease }; }
                catch (err) { if (err.code !== 11000) throw err; }
            } else {
                const result = await collection.updateOne({ _id: id, revision: current.revision }, { $set: state, $inc: { revision: 1 } });
                if (result.modifiedCount) return { lease };
            }
        }
        return { waitUntil: new Date(now + 15000) };
    }
    async function release(lease, pauseMs = 0) {
        const update = { $unset: { lease: 1, leaseUntil: 1 }, $inc: { revision: 1 } };
        if (pauseMs) update.$max = { pausedUntil: new Date(Date.now() + pauseMs) };
        await collection.updateOne({ _id: id, lease }, update);
    }
    async function summary() {
        const state = await get();
        const policy = limits();
        const now = Date.now();
        const usedToday = Number(state?.dayEnd) === +dayWindow(now) ? state.count : 0;
        return { ...policy, resetsAt: dayWindow(now), autoReserve: policy.perDay - Math.max(1, policy.perDay - Math.ceil(policy.perDay * 0.2)), usedToday, remainingToday: Math.max(0, policy.perDay - usedToday), pausedUntil: state?.pausedUntil || null };
    }
    return { acquire, release, summary };
}
module.exports = { createQuota, dayWindow };
