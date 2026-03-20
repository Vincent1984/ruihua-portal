const express = require('express');
const mongoose = require('mongoose');
const { VideoEmbedConfig, VideoEmbedHistory } = require('../models/VideoEmbedConfig');
const Video = require('../models/Video');
const https = require('https');
const url = require('url');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Limit config api to 60 requests per minute per IP
const configLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Too many requests, please try again later.' }
});

function checkVideoUrl(videoUrl) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = new url.URL(videoUrl);
            const options = {
                method: 'HEAD',
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                timeout: 5000,
                rejectUnauthorized: false // Bypass self-signed cert issues for external CDN URLs
            };
            const req = https.request(options, (res) => {
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    const contentType = res.headers['content-type'] || '';
                    if (contentType.includes('video/') || contentType.includes('application/x-mpegURL') || contentType.includes('application/vnd.apple.mpegurl')) {
                        resolve(true);
                    } else {
                        reject(new Error('Invalid content type: ' + contentType));
                    }
                } else {
                    reject(new Error('HTTP Status: ' + res.statusCode));
                }
            });
            req.on('error', (e) => reject(e));
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
            req.end();
        } catch (e) {
            reject(e);
        }
    });
}

// Generate signed script signature to prevent frontend tampering
function generateSignature(videoId) {
    const secret = process.env.JWT_SECRET || 'ruihua_secure_key_2026_!@#';
    const timestamp = Date.now();
    const hash = crypto.createHmac('sha256', secret)
                       .update(`${videoId}:${timestamp}`)
                       .digest('hex');
    return { signature: hash, timestamp };
}

module.exports = function(app, authRequired, requirePerm, logOp) {

    // 1. Admin: Save or Update Embed Config
    app.post('/api/admin/video-detail/embed/config', authRequired, requirePerm('video:edit'), async (req, res) => {
        try {
            const { videoId, embed_url, embed_settings, position, selector, dimensions, permissions, is_embed_enabled, gray_percent } = req.body;
            
            if (!videoId || !embed_url) {
                return res.status(400).json({ error: 'videoId and embed_url are required' });
            }

            // Verify URL
            try {
                await checkVideoUrl(embed_url);
            } catch (err) {
                return res.status(400).json({ error: 'Invalid Video URL: ' + err.message });
            }

            let config = await VideoEmbedConfig.findOne({ videoId });
            
            if (config) {
                // Save history before update
                await VideoEmbedHistory.create({
                    configId: config._id,
                    configData: config.toObject(),
                    version: config.version,
                    updatedBy: req.user.username
                });
                
                config.embed_url = embed_url;
                if (embed_settings) config.embed_settings = embed_settings;
                if (position) config.position = position;
                if (selector) config.selector = selector;
                if (dimensions) config.dimensions = dimensions;
                if (permissions) config.permissions = permissions;
                if (is_embed_enabled !== undefined) config.is_embed_enabled = is_embed_enabled;
                if (gray_percent !== undefined) config.gray_percent = gray_percent;
                
                config.version += 1;
                config.updatedBy = req.user.username;
                config.updatedAt = new Date();
                
                await config.save();
                await logOp('update', 'VideoEmbedConfig', `Updated config for video ${videoId} to v${config.version}`, req.user.username);
                
                // Simulate CDN Refresh (async)
                console.log(`[CDN] Triggering refresh for video config: ${videoId}`);
                
                res.json({ success: true, data: config });
            } else {
                config = new VideoEmbedConfig({
                    videoId,
                    embed_url,
                    embed_settings,
                    position,
                    selector,
                    dimensions,
                    permissions,
                    is_embed_enabled,
                    gray_percent,
                    updatedBy: req.user.username
                });
                await config.save();
                await logOp('create', 'VideoEmbedConfig', `Created config for video ${videoId}`, req.user.username);
                res.json({ success: true, data: config });
            }
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 2. Admin: Get Config
    app.get('/api/admin/video-detail/embed/config/:videoId', authRequired, requirePerm('video:list'), async (req, res) => {
        try {
            const config = await VideoEmbedConfig.findOne({ videoId: req.params.videoId });
            res.json({ success: true, data: config });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 3. Admin: Rollback Config
    app.post('/api/admin/video-detail/embed/config/:videoId/rollback', authRequired, requirePerm('video:edit'), async (req, res) => {
        try {
            const { targetVersion } = req.body;
            const config = await VideoEmbedConfig.findOne({ videoId: req.params.videoId });
            if (!config) return res.status(404).json({ error: 'Config not found' });
            
            const history = await VideoEmbedHistory.findOne({ configId: config._id, version: targetVersion });
            if (!history) return res.status(404).json({ error: 'History version not found' });
            
            // Backup current before rollback
            await VideoEmbedHistory.create({
                configId: config._id,
                configData: config.toObject(),
                version: config.version,
                updatedBy: req.user.username
            });

            // Restore data from history
            const historyData = history.configData;
            Object.assign(config, {
                embed_url: historyData.embed_url,
                embed_settings: historyData.embed_settings,
                position: historyData.position,
                selector: historyData.selector,
                dimensions: historyData.dimensions,
                permissions: historyData.permissions,
                is_embed_enabled: historyData.is_embed_enabled,
                gray_percent: historyData.gray_percent,
            });
            
            config.version += 1;
            config.updatedBy = req.user.username;
            config.updatedAt = new Date();
            
            await config.save();
            await logOp('rollback', 'VideoEmbedConfig', `Rolled back video ${req.params.videoId} to v${targetVersion}`, req.user.username);
            
            res.json({ success: true, data: config });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 4. Public: Get config for frontend rendering (with rate limit)
    app.get('/api/video/detail/config/:videoId', configLimiter, async (req, res) => {
        try {
            const { videoId } = req.params;
            const config = await VideoEmbedConfig.findOne({ videoId, is_embed_enabled: true });
            
            if (!config) {
                return res.json({ success: true, data: null });
            }

            // Gray release logic based on trailing digit of IP or user ID (if logged in)
            // Simplified gray release check using random for public users
            if (config.gray_percent < 100) {
                const randomVal = Math.floor(Math.random() * 100);
                if (randomVal >= config.gray_percent) {
                    return res.json({ success: true, data: null });
                }
            }

            // Here we would typically generate a pre-signed URL if it's a private TOS bucket.
            // Since the user asked to use HTTPS+HLS to prevent illegal download, we return the URL directly,
            // and assume the frontend player will handle the HLS stream properly.
            // If it was private, we would use getSignedUrl from AWS SDK here.
            
            const sig = generateSignature(videoId);

            const payload = {
                embed_url: config.embed_url,
                settings: config.embed_settings,
                layout: {
                    position: config.position,
                    selector: config.selector,
                    dimensions: config.dimensions
                },
                security: {
                    signature: sig.signature,
                    timestamp: sig.timestamp
                },
                tracking: {
                    version: config.version,
                    env: config.env
                }
            };

            res.json({ success: true, data: payload });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

};