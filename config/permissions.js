const PERMISSION_GROUPS = [
    {
        group: '系统管理',
        permissions: [
            { code: 'all', name: '全部权限 (超级管理员)', dangerous: true },
            { code: 'dashboard:view', name: '查看数据看板' },
            { code: 'system:manage', name: '系统/SEO/GEO 管理', dangerous: true }
        ]
    },
    {
        group: '内容管理',
        permissions: [
            { code: 'article:list', name: '查看文章' },
            { code: 'article:create', name: '发布文章' },
            { code: 'article:edit', name: '编辑文章' },
            { code: 'article:delete', name: '删除文章', dangerous: true },
            { code: 'faq:list', name: '查看FAQ' },
            { code: 'faq:create', name: '新增FAQ' },
            { code: 'faq:edit', name: '编辑FAQ' },
            { code: 'faq:delete', name: '删除FAQ', dangerous: true },
            { code: 'case:list', name: '查看案例' },
            { code: 'case:create', name: '新增案例' },
            { code: 'case:edit', name: '编辑案例' },
            { code: 'case:delete', name: '删除案例', dangerous: true },
            { code: 'featured-case:list', name: '查看首页精选案例' },
            { code: 'featured-case:edit', name: '编辑首页精选案例' },
            { code: 'expert:list', name: '查看讲师/专家' },
            { code: 'expert:create', name: '新增讲师/专家' },
            { code: 'expert:edit', name: '编辑讲师/专家' },
            { code: 'expert:delete', name: '删除讲师/专家', dangerous: true },
            { code: 'page:list', name: '查看页面内容' },
            { code: 'page:edit', name: '编辑页面内容' },
            { code: 'global-config:list', name: '查看全局配置' },
            { code: 'global-config:edit', name: '编辑全局配置' },
            { code: 'banner:manage', name: 'Banner管理' },
            { code: 'sidebar:manage', name: '侧边栏配置' },
            { code: 'upload:write', name: '上传文件/图片' },
            { code: 'ai:use', name: '使用AI/SEO/GEO工具' }
        ]
    },
    {
        group: '线索与活动',
        permissions: [
            { code: 'lead:list', name: '查看官网线索' },
            { code: 'lead:edit', name: '处理官网线索' },
            { code: 'lead:delete', name: '删除官网线索', dangerous: true },
            { code: 'lead:export', name: '导出官网线索', dangerous: true },
            { code: 'appointment:list', name: '查看线索/预约/问卷（兼容旧权限）' },
            { code: 'appointment:edit', name: '处理线索/活动' },
            { code: 'appointment:delete', name: '删除线索/活动', dangerous: true },
            { code: 'appointment:export', name: '导出线索/活动数据', dangerous: true }
        ]
    },
    {
        group: '新质组织',
        permissions: [
            { code: 'nqoc:manage', name: '新质组织管理（兼容旧权限）' },
            { code: 'nqoc:list', name: '查看新质组织数据' },
            { code: 'nqoc:edit', name: '编辑新质组织数据' },
            { code: 'nqoc:delete', name: '删除新质组织数据', dangerous: true },
            { code: 'nqoc:export', name: '导出新质组织数据', dangerous: true }
        ]
    },
    {
        group: '视频管理',
        permissions: [
            { code: 'video:list', name: '查看视频' },
            { code: 'video:create', name: '新增视频' },
            { code: 'video:edit', name: '编辑视频' },
            { code: 'video:delete', name: '删除视频', dangerous: true }
        ]
    }
];

const PERMISSIONS = PERMISSION_GROUPS.flatMap(group =>
    group.permissions.map(permission => ({ ...permission, group: group.group }))
);

const PERMISSION_CODES = PERMISSIONS.map(permission => permission.code);
const PERMISSION_CODE_SET = new Set(PERMISSION_CODES);

function normalizePermissions(permissions) {
    return Array.isArray(permissions) ? [...new Set(permissions.filter(Boolean).map(String))] : [];
}

function validatePermissions(permissions) {
    const normalized = normalizePermissions(permissions);
    return {
        permissions: normalized,
        invalid: normalized.filter(permission => !PERMISSION_CODE_SET.has(permission))
    };
}

module.exports = {
    PERMISSION_GROUPS,
    PERMISSIONS,
    PERMISSION_CODES,
    PERMISSION_CODE_SET,
    normalizePermissions,
    validatePermissions
};
