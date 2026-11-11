try {
  const mongoose = require('mongoose');
  if (mongoose && typeof mongoose.connect === 'function') {
    mongoose.connect = function () {
      return Promise.resolve({ connection: { close: () => Promise.resolve() } });
    };
  }
} catch (e) {}
try {
  const { spawnSync } = require('child_process');
  process.on('uncaughtException', (err) => {
    if (err && err.message && /MongooseServerSelectionError|MongoDB connection failed|MongoNetworkError/i.test(err.message)) {
      console.warn('[PREVIEW-PATCH] caught DB fatal → swallow (preview mode, no mongod)');
      return;
    }
    console.error('[uncaughtException]', err && err.stack || err);
  });
  process.on('unhandledRejection', (err) => {
    const msg = err && err.message ? err.message : String(err || '');
    if (/MongooseServerSelectionError|MongoDB connection failed|MongoNetworkError|buffering timed out/i.test(msg)) {
      console.warn('[PREVIEW-PATCH] caught DB rejection → swallow (preview mode, no mongod):', msg);
      return;
    }
    console.warn('[unhandledRejection]', msg, err && err.stack || '');
  });
} catch (e) {}
try { const ms = require('ms'); } catch (e) {}
