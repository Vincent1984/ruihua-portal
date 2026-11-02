const AiDemandSurvey = require('../models/AiDemandSurvey');
const XLSX = require('xlsx');

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 列表 / 导出共用的筛选条件
function buildFilter(query) {
    const filter = {};

    const keyword = String(query.keyword || '').trim();
    if (keyword) {
        const re = new RegExp(escapeRegex(keyword), 'i');
        filter.$or = [{ dept: re }, { title: re }, { contact: re }, { q1: re }];
    }

    const dept = String(query.dept || '').trim();
    if (dept) filter.dept = dept;

    const synced = String(query.dingtalk_synced || '').trim();
    if (synced === 'true') filter.dingtalk_synced = true;
    if (synced === 'false') filter.dingtalk_synced = false;

    const { startDate, endDate } = query;
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = end;
        }
    }

    return filter;
}

function formatTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

// 导出到 Excel 的中文表头
function toExportRow(doc) {
    return {
        '提交时间': formatTime(doc.createdAt),
        '提交编号': doc.submission_id || '',
        '所属部门': doc.dept || '',
        '需求名称': doc.title || '',
        '需求联系人': doc.contact || '',
        'Q1 具体工作': doc.q1 || '',
        'Q2 目前怎么做': doc.q2 || '',
        'Q3 头疼问题': doc.q3 || '',
        'Q3 其他': doc.q3_other || '',
        'Q4 发生频率': doc.q4 || '',
        'Q5 每月件数': doc.q5_count || '',
        'Q5 每件分钟': doc.q5_minutes || '',
        'Q5 参与人数': doc.q5_people || '',
        'Q5 月工时': doc.q5_hours || '',
        'Q6 所需资料/系统': doc.q6 || '',
        'Q6 其他': doc.q6_other || '',
        'Q7 处理方式': doc.q7 || '',
        'Q8 出错影响': doc.q8 || '',
        'Q9 期望效果': doc.q9 || '',
        'Q9 其他': doc.q9_other || '',
        'Q10 真实案例': doc.q10 || '',
        '附件名称': doc.attachment_name || '',
        '页面地址': doc.page || '',
        '来源': doc.source || '',
        '钉钉表格同步': doc.dingtalk_synced ? '成功' : '未同步',
        '同步错误': doc.dingtalk_error || '',
        'IP': doc.ip || ''
    };
}

module.exports = function(app, authRequired, requirePerm, logOp) {

    // 1. 后台：表单提交列表
    app.get('/api/admin/ai-demand-surveys', authRequired, requirePerm('appointment:list'), async (req, res) => {
        try {
            const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
            const filter = buildFilter(req.query);

            const total = await AiDemandSurvey.countDocuments(filter);
            const list = await AiDemandSurvey.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

            res.json({
                success: true,
                data: list,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit) || 0
                }
            });
        } catch (error) {
            console.error('AiDemandSurvey List Error:', error);
            res.status(500).json({ success: false, error: '获取表单列表失败' });
        }
    });

    // 2. 后台：导出 Excel
    app.get('/api/admin/ai-demand-surveys/export', authRequired, requirePerm('appointment:export'), async (req, res) => {
        try {
            const filter = buildFilter(req.query);
            const docs = await AiDemandSurvey.find(filter).sort({ createdAt: -1 }).lean();
            const data = docs.map(toExportRow);

            if (data.length === 0) data.push({ '提示': '没有符合条件的数据' });

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'AI需求问卷');
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            res.setHeader('Content-Disposition', `attachment; filename="ai_demand_surveys_${timestamp}.xlsx"`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);

            if (logOp) logOp(req.user._id, '导出 AI 需求问卷', `导出了 ${docs.length} 条记录`);
        } catch (error) {
            console.error('AiDemandSurvey Export Error:', error);
            res.status(500).json({ success: false, error: '导出失败' });
        }
    });

    // 3. 后台：删除单条
    app.delete('/api/admin/ai-demand-surveys/:id', authRequired, requirePerm('appointment:delete'), async (req, res) => {
        try {
            const { id } = req.params;
            if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
                return res.status(400).json({ success: false, error: '无效的记录ID' });
            }

            const deleted = await AiDemandSurvey.findByIdAndDelete(id);
            if (!deleted) {
                return res.status(404).json({ success: false, error: '记录不存在或已删除' });
            }

            if (logOp) logOp(req.user._id, '删除 AI 需求问卷', `删除记录 ID: ${id}`);
            res.json({ success: true, message: '删除成功' });
        } catch (error) {
            console.error('AiDemandSurvey Delete Error:', error);
            res.status(500).json({ success: false, error: '删除失败' });
        }
    });

    // 4. 后台：批量删除
    app.post('/api/admin/ai-demand-surveys/batch-delete', authRequired, requirePerm('appointment:delete'), async (req, res) => {
        try {
            const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
            const validIds = ids.filter((id) => typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id));
            if (!validIds.length) {
                return res.status(400).json({ success: false, error: '请选择有效的删除记录' });
            }

            const result = await AiDemandSurvey.deleteMany({ _id: { $in: validIds } });
            if (logOp) logOp(req.user._id, '批量删除 AI 需求问卷', `批量删除 ${result.deletedCount || 0} 条记录`);

            res.json({
                success: true,
                message: `已删除 ${result.deletedCount || 0} 条记录`,
                deletedCount: result.deletedCount || 0
            });
        } catch (error) {
            console.error('AiDemandSurvey Batch Delete Error:', error);
            res.status(500).json({ success: false, error: '批量删除失败' });
        }
    });
};
