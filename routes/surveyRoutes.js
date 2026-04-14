const rateLimit = require('express-rate-limit');
const SurveySubmission = require('../models/SurveySubmission');
const XLSX = require('xlsx');

// High concurrency rate limiter for survey submission
const surveySubmitLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 600, // allow 600 requests per minute per IP for high concurrency
    message: { error: '提交过于频繁，请稍后再试' }
});

module.exports = function(app, authRequired, requirePerm, logOp) {

    // 1. Submit Survey (Public)
    app.post('/api/survey/submit', surveySubmitLimiter, async (req, res) => {
        try {
            const {
                topicInterest,
                participationForm,
                wechatId,
                channel,
                sourceUrl,
                utm_source,
                utm_medium,
                utm_campaign,
                utm_term,
                utm_content,
                behavior
            } = req.body;

            if (!topicInterest || !participationForm || !wechatId) {
                return res.status(400).json({ error: '请填写所有必填字段（感兴趣的话题、参与形式、微信号）' });
            }

            // Client might pass startTime and submitTime
            let behaviorData = {};
            if (behavior && behavior.startTime) {
                const startTime = new Date(behavior.startTime);
                const submitTime = new Date();
                const durationMs = submitTime.getTime() - startTime.getTime();
                behaviorData = {
                    startTime,
                    submitTime,
                    durationMs,
                    userAgent: req.headers['user-agent'],
                    ip: req.ip || req.connection.remoteAddress
                };
            }

            // Use cookies for UTM if not directly in body
            const utmParams = {
                utm_source: utm_source || req.cookies?.utm_source,
                utm_medium: utm_medium || req.cookies?.utm_medium,
                utm_campaign: utm_campaign || req.cookies?.utm_campaign,
                utm_term: utm_term || req.cookies?.utm_term,
                utm_content: utm_content || req.cookies?.utm_content
            };

            // Derive channel logic: explicitly passed > utm_source > 'organic'
            const finalChannel = channel || utmParams.utm_source || 'organic';

            const submission = new SurveySubmission({
                topicInterest,
                participationForm,
                wechatId,
                channel: finalChannel,
                sourceUrl: sourceUrl || req.get('Referrer'),
                utmParams,
                utm_source: utmParams.utm_source || '',
                utm_medium: utmParams.utm_medium || '',
                utm_campaign: utmParams.utm_campaign || '',
                utm_term: utmParams.utm_term || '',
                utm_content: utmParams.utm_content || '',
                behavior: behaviorData
            });

            await submission.save();

            res.status(200).json({
                success: true,
                message: '问卷提交成功',
                data: {
                    id: submission._id
                }
            });
        } catch (error) {
            console.error('Survey Submission Error:', error);
            res.status(500).json({ error: '服务器错误，问卷提交失败，请稍后重试' });
        }
    });

    // 2. Admin: Get Survey List
    app.get('/api/admin/survey/list', authRequired, requirePerm('appointment:list'), async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;

            const filter = {};
            if (req.query.channel) {
                filter.channel = req.query.channel;
            }
            if (req.query.utm_source) filter.utm_source = req.query.utm_source;
            if (req.query.utm_medium) filter.utm_medium = req.query.utm_medium;
            if (req.query.utm_campaign) filter.utm_campaign = req.query.utm_campaign;
            if (req.query.utm_term) filter.utm_term = req.query.utm_term;
            if (req.query.utm_content) filter.utm_content = req.query.utm_content;
            if (req.query.startDate && req.query.endDate) {
                filter.createdAt = {
                    $gte: new Date(req.query.startDate),
                    $lte: new Date(req.query.endDate)
                };
            }

            const total = await SurveySubmission.countDocuments(filter);
            const list = await SurveySubmission.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            res.json({
                success: true,
                total,
                page,
                limit,
                data: list
            });
        } catch (error) {
            console.error('Survey List Error:', error);
            res.status(500).json({ error: '获取列表失败' });
        }
    });

    // 3. Admin: Analytics Dashboard Data
    app.get('/api/admin/survey/analytics', authRequired, requirePerm('appointment:list'), async (req, res) => {
        try {
            const filter = {};
            if (req.query.startDate && req.query.endDate) {
                filter.createdAt = {
                    $gte: new Date(req.query.startDate),
                    $lte: new Date(req.query.endDate)
                };
            }

            const totalSubmissions = await SurveySubmission.countDocuments(filter);

            // Group by topicInterest
            const topicStats = await SurveySubmission.aggregate([
                { $match: filter },
                { $group: { _id: "$topicInterest", count: { $sum: 1 } } }
            ]);

            // Group by participationForm
            const formStats = await SurveySubmission.aggregate([
                { $match: filter },
                { $group: { _id: "$participationForm", count: { $sum: 1 } } }
            ]);

            // Group by channel
            const channelStats = await SurveySubmission.aggregate([
                { $match: filter },
                { $group: { _id: "$channel", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            const utmSourceStats = await SurveySubmission.aggregate([
                { $match: filter },
                { $group: { _id: "$utm_source", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 30 }
            ]);

            // Calculate average duration
            const behaviorStats = await SurveySubmission.aggregate([
                { $match: filter },
                { $match: { "behavior.durationMs": { $exists: true, $gt: 0 } } },
                { $group: { _id: null, avgDurationMs: { $avg: "$behavior.durationMs" } } }
            ]);

            const avgDurationMs = behaviorStats.length > 0 ? Math.round(behaviorStats[0].avgDurationMs) : 0;

            res.json({
                success: true,
                data: {
                    totalSubmissions,
                    topicStats: topicStats.map(item => ({ label: item._id, value: item.count })),
                    formStats: formStats.map(item => ({ label: item._id, value: item.count })),
                    channelStats: channelStats.map(item => ({ label: item._id || 'organic', value: item.count })),
                    utmSourceStats: utmSourceStats.map(item => ({ label: item._id || '(empty)', value: item.count })),
                    avgDurationMs
                }
            });

        } catch (error) {
            console.error('Survey Analytics Error:', error);
            res.status(500).json({ error: '获取统计数据失败' });
        }
    });

    // 4. Admin: Export to Excel
    app.get('/api/admin/survey/export', authRequired, requirePerm('appointment:list'), async (req, res) => {
        try {
            const filter = {};
            if (req.query.channel) {
                filter.channel = req.query.channel;
            }
            if (req.query.utm_source) filter.utm_source = req.query.utm_source;
            if (req.query.utm_medium) filter.utm_medium = req.query.utm_medium;
            if (req.query.utm_campaign) filter.utm_campaign = req.query.utm_campaign;
            if (req.query.utm_term) filter.utm_term = req.query.utm_term;
            if (req.query.utm_content) filter.utm_content = req.query.utm_content;
            if (req.query.startDate && req.query.endDate) {
                filter.createdAt = {
                    $gte: new Date(req.query.startDate),
                    $lte: new Date(req.query.endDate)
                };
            }

            // Needs to decrypt wechatId manually if using lean() because lean() bypasses mongoose getters
            // So we use full documents here.
            const fullDocs = await SurveySubmission.find(filter).sort({ createdAt: -1 });

            const data = fullDocs.map(doc => {
                const durationSeconds = doc.behavior && doc.behavior.durationMs 
                    ? Math.round(doc.behavior.durationMs / 1000) 
                    : '';
                
                return {
                    '提交时间': new Date(doc.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
                    '感兴趣话题': doc.topicInterest,
                    '参与形式': doc.participationForm,
                    '微信号': doc.wechatId, // Mongoose getter handles decryption
                    '渠道': doc.channel,
                    'UTM Source': doc.utm_source || '',
                    'UTM Medium': doc.utm_medium || '',
                    'UTM Campaign': doc.utm_campaign || '',
                    'UTM Term': doc.utm_term || '',
                    'UTM Content': doc.utm_content || '',
                    '来源URL': doc.sourceUrl || '',
                    '填写耗时(秒)': durationSeconds,
                    'User-Agent': doc.behavior?.userAgent || '',
                    'IP': doc.behavior?.ip || ''
                };
            });

            if (data.length === 0) {
                data.push({ '提示': '没有符合条件的数据' });
            }

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "调研问卷数据");

            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            res.setHeader('Content-Disposition', `attachment; filename="survey_data_${timestamp}.xlsx"`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);

            if (logOp) {
                logOp(req.user._id, '导出问卷数据', `导出了 ${data.length} 条记录`);
            }

        } catch (error) {
            console.error('Survey Export Error:', error);
            res.status(500).json({ error: '导出失败' });
        }
    });

    // 5. Admin: Delete Single Survey Record
    app.delete('/api/admin/survey/:id', authRequired, requirePerm('appointment:delete'), async (req, res) => {
        try {
            const { id } = req.params;
            if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
                return res.status(400).json({ success: false, error: '无效的记录ID' });
            }

            const deleted = await SurveySubmission.findByIdAndDelete(id);
            if (!deleted) {
                return res.status(404).json({ success: false, error: '记录不存在或已删除' });
            }

            if (logOp) {
                logOp(req.user._id, '删除问卷记录', `删除问卷记录 ID: ${id}`);
            }

            res.json({ success: true, message: '删除成功' });
        } catch (error) {
            console.error('Survey Delete Error:', error);
            res.status(500).json({ success: false, error: '删除失败' });
        }
    });

    // 6. Admin: Batch Delete Survey Records
    app.post('/api/admin/survey/batch-delete', authRequired, requirePerm('appointment:delete'), async (req, res) => {
        try {
            const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
            const validIds = ids.filter((id) => typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id));

            if (!validIds.length) {
                return res.status(400).json({ success: false, error: '请选择有效的删除记录' });
            }

            const result = await SurveySubmission.deleteMany({ _id: { $in: validIds } });

            if (logOp) {
                logOp(req.user._id, '批量删除问卷记录', `批量删除 ${result.deletedCount || 0} 条记录`);
            }

            res.json({
                success: true,
                message: `已删除 ${result.deletedCount || 0} 条记录`,
                deletedCount: result.deletedCount || 0
            });
        } catch (error) {
            console.error('Survey Batch Delete Error:', error);
            res.status(500).json({ success: false, error: '批量删除失败' });
        }
    });
};
