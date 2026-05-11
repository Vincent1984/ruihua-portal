const express = require('express');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

module.exports = function(app, authRequired, logOp) {
    // Determine if TOS is configured
    const useTos = process.env.TOS_ACCESS_KEY && process.env.TOS_SECRET_KEY;
    let s3Client = null;
    
    if (useTos) {
        s3Client = new S3Client({
            region: process.env.TOS_REGION || 'cn-beijing',
            endpoint: process.env.TOS_ENDPOINT || 'https://tos-cn-beijing.volces.com',
            credentials: {
                accessKeyId: process.env.TOS_ACCESS_KEY,
                secretAccessKey: process.env.TOS_SECRET_KEY,
            }
        });
    }

    // Generate Presigned URL for Direct Upload
    app.post('/api/upload/presign', authRequired, async (req, res) => {
        try {
            if (!useTos) {
                return res.status(400).json({ error: 'TOS is not configured. Direct upload not available.' });
            }
            
            const { filename, contentType } = req.body;
            if (!filename || !contentType) {
                return res.status(400).json({ error: 'filename and contentType are required' });
            }

            const ext = path.extname(filename);
            const key = `uploads/${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;

            const command = new PutObjectCommand({
                Bucket: process.env.TOS_BUCKET_NAME,
                Key: key,
                ContentType: contentType
            });

            const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            
            res.json({
                success: true,
                uploadUrl: signedUrl,
                fileUrl: `${process.env.TOS_PUBLIC_URL}/${key}`,
                key: key
            });
        } catch (e) {
            console.error('Presign error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Fallback: Local upload configuration
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = path.join(__dirname, '..', 'public', 'uploads');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            const ext = path.extname(file.originalname);
            cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
        }
    });

    const upload = multer({ storage: storage });

    // Local upload endpoint
    app.post('/api/upload', authRequired, upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            // Return public URL path
            const url = `/uploads/${req.file.filename}`;
            res.json({ success: true, url });
        } catch (e) {
            console.error('Upload error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Fetch image from URL and save locally
    app.post('/api/upload/fetch-url', authRequired, async (req, res) => {
        try {
            const { url } = req.body;
            if (!url) {
                return res.status(400).json({ error: 'No URL provided' });
            }

            const fetch = (await import('node-fetch')).default;
            const response = await fetch(url);
            if (!response.ok) {
                return res.status(400).json({ error: 'Failed to fetch image from URL' });
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('image/')) {
                return res.status(400).json({ error: 'URL does not point to a valid image' });
            }

            let ext = '';
            if (contentType === 'image/jpeg') ext = '.jpg';
            else if (contentType === 'image/png') ext = '.png';
            else if (contentType === 'image/gif') ext = '.gif';
            else if (contentType === 'image/webp') ext = '.webp';
            else ext = '.jpg'; // fallback

            const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
            const dir = path.join(__dirname, '..', 'public', 'uploads');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const filepath = path.join(dir, filename);
            const dest = fs.createWriteStream(filepath);
            response.body.pipe(dest);

            await new Promise((resolve, reject) => {
                dest.on('finish', resolve);
                dest.on('error', reject);
            });

            const localUrl = `/uploads/${filename}`;
            res.json({ success: true, url: localUrl });
        } catch (e) {
            console.error('Fetch URL error:', e);
            res.status(500).json({ error: e.message });
        }
    });
};