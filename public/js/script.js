// 渠道溯源功能 - URL参数解析
function extractUtmParameters() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const utmParameters = {
            utm_source: urlParams.get('utm_source')?.trim() || null,
            utm_medium: urlParams.get('utm_medium')?.trim() || null,
            utm_campaign: urlParams.get('utm_campaign')?.trim() || null,
            utm_term: urlParams.get('utm_term')?.trim() || null,
            utm_content: urlParams.get('utm_content')?.trim() || null
        };
        // 过滤掉null值
        return Object.fromEntries(Object.entries(utmParameters).filter(([_, value]) => value !== null));
    } catch (error) {
        console.error('解析URL参数失败:', error);
        return {};
    }
}

// 简单的加密函数
function encryptUtmData(data) {
    try {
        return btoa(encodeURIComponent(JSON.stringify(data)));
    } catch (error) {
        console.error('加密失败:', error);
        return null;
    }
}

// 简单的解密函数
function decryptUtmData(encryptedData) {
    try {
        return JSON.parse(decodeURIComponent(atob(encryptedData)));
    } catch (error) {
        console.error('解密失败:', error);
        return {};
    }
}

// 设置Cookie函数
function setCookie(name, value, days) {
    try {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
        return true;
    } catch (error) {
        console.error('设置Cookie失败:', error);
        return false;
    }
}

// 获取Cookie函数
function getCookie(name) {
    try {
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith(`${name}=`))
            ?.split('=')[1];
        return cookieValue || null;
    } catch (error) {
        console.error('获取Cookie失败:', error);
        return null;
    }
}

// 验证UTM参数合法性
function isValidUtmParameter(value) {
    // 只允许字母、数字、下划线、连字符和空格，长度限制100
    return /^[a-zA-Z0-9_\-\s]{1,100}$/.test(value);
}

// 验证并清理UTM参数对象
function validateUtmParameters(params) {
    const validated = {};
    Object.entries(params).forEach(([key, value]) => {
        if (key.startsWith('utm_') && isValidUtmParameter(value)) {
            validated[key] = value;
        }
    });
    return validated;
}

// 渠道溯源初始化
function initUtmTracking() {
    try {
        // 检查是否已有utm_data的Cookie
        const existingData = getCookie('utm_data_encrypted');
        
        // 如果没有现有Cookie或现有Cookie不完整，尝试从URL中提取
        const utmParameters = extractUtmParameters();
        
        // 如果URL中有UTM参数
        if (Object.keys(utmParameters).length > 0) {
            // 验证参数
            const validatedParams = validateUtmParameters(utmParameters);
            
            if (Object.keys(validatedParams).length > 0) {
                // 如果已有数据，合并新旧数据（新数据优先）
                let finalData = validatedParams;
                if (existingData) {
                    const existingParams = decryptUtmData(existingData);
                    finalData = { ...existingParams, ...validatedParams };
                }
                
                // 加密并存储到Cookie，设置30天过期
                const encryptedData = encryptUtmData(finalData);
                if (encryptedData) {
                    setCookie('utm_data_encrypted', encryptedData, 30);
                }
            }
        }
    } catch (error) {
        console.error('渠道溯源初始化失败:', error);
        // 出错时不影响其他功能
    }
}

// 获取当前所有UTM参数
function getCurrentUtmParameters() {
    try {
        const encryptedData = getCookie('utm_data_encrypted');
        if (encryptedData) {
            const decryptedData = decryptUtmData(encryptedData);
            return validateUtmParameters(decryptedData);
        }
        return {};
    } catch (error) {
        console.error('获取UTM参数失败:', error);
        return {};
    }
}

// 为兼容旧代码，保留原函数
function getCurrentUtmSource() {
    const params = getCurrentUtmParameters();
    return params.utm_source || null;
}

// 后台管理 - 渲染表单数据
function renderAppointments(data) {
    try {
        const appointmentsList = document.getElementById('appointmentsList');
        if (!appointmentsList) return;
        
        appointmentsList.innerHTML = '';
        
        if (data && data.length > 0) {
            data.forEach(appointment => {
                const row = document.createElement('tr');
                const statusBadge = appointment.status === 'processed' ? '<span class="badge bg-success">已处理</span>' : 
                                  (appointment.status === 'archived' ? '<span class="badge bg-secondary">已归档</span>' : '<span class="badge bg-warning text-dark">新预约</span>');
                
                row.innerHTML = `
                    <td>${appointment.name || '-'}</td>
                    <td>${appointment.phone || '-'}</td>
                    <td>${appointment.company || '-'}</td>
                    <td>${appointment.title || '-'}</td>
                    <td>${appointment.problem || '-'}</td>
                    <td>${appointment.source || '-'}</td>
                    <td>
                        <span class="badge bg-light text-dark border">${appointment.utm_source || '-'}</span>
                        ${appointment.utm_campaign ? `<br><small class="text-muted">${appointment.utm_campaign}</small>` : ''}
                    </td>
                    <td>${statusBadge}</td>
                    <td>${appointment.createdAt ? new Date(appointment.createdAt).toLocaleString('zh-CN') : '-'}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary dropdown-toggle" data-bs-toggle="dropdown">状态</button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="javascript:void(0)" onclick="updateAppointmentStatus('${appointment._id}', 'new')">标记为新预约</a></li>
                                <li><a class="dropdown-item" href="javascript:void(0)" onclick="updateAppointmentStatus('${appointment._id}', 'processed')">标记为已处理</a></li>
                                <li><a class="dropdown-item" href="javascript:void(0)" onclick="updateAppointmentStatus('${appointment._id}', 'archived')">归档</a></li>
                            </ul>
                            <button class="btn btn-outline-danger" onclick="deleteAppointment('${appointment._id}')">删除</button>
                        </div>
                    </td>
                `;
                appointmentsList.appendChild(row);
            });
        } else {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `<td colspan="9" class="text-center py-3 text-muted">暂无数据</td>`;
            appointmentsList.appendChild(emptyRow);
        }
    } catch (error) {
        console.error('渲染表单数据失败:', error);
    }
}

// 后台管理 - 获取表单数据
async function getAppointments(page = 1) {
    try {
        // 构建查询参数
        const queryParams = new URLSearchParams({
            page,
            limit: 20
        });
        
        const response = await fetch(`/api/appointments?${queryParams.toString()}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data && data.data) {
            renderAppointments(data.data);
            
            // 更新分页信息
            const appointmentsTotal = document.getElementById('appointmentsTotal');
            const pageNum = document.getElementById('appointmentPageNum');
            const totalPages = document.getElementById('appointmentTotalPages');
            
            if (appointmentsTotal) {
                appointmentsTotal.textContent = data.pagination.total;
            }
            
            if (pageNum) {
                pageNum.textContent = data.pagination.page;
            }
            
            if (totalPages) {
                totalPages.textContent = data.pagination.pages;
            }
            
            window.appointmentCurrentPage = data.pagination.page;
            window.appointmentTotalPages = data.pagination.pages;
        } else {
            // Error handling or empty data handling if data.data is missing
             const appointmentsList = document.getElementById('appointmentsList');
             if (appointmentsList) {
                 appointmentsList.innerHTML = `<tr><td colspan="9" class="text-center py-3 text-danger">加载失败: ${data.error || '未知错误'}</td></tr>`;
             }
        }
    } catch (error) {
        console.error('获取表单数据失败:', error);
         const appointmentsList = document.getElementById('appointmentsList');
         if (appointmentsList) {
             appointmentsList.innerHTML = `<tr><td colspan="9" class="text-center py-3 text-danger">网络错误</td></tr>`;
         }
    }
}

// 后台管理 - 切换表单页面
function changeAppointmentPage(delta) {
    const currentPage = window.appointmentCurrentPage || 1;
    const totalPages = window.appointmentTotalPages || 1;
    const newPage = currentPage + delta;
    
    if (newPage < 1 || newPage > totalPages) return;
    
    getAppointments(newPage);
}

// 后台管理 - 导出表单数据
function exportAppointments() {
    try {
        // 跳转到导出接口
        window.location.href = `/api/appointments/export`;
    } catch (error) {
        console.error('导出失败:', error);
    }
}

// 后台管理 - 显示指定部分
function show(sectionId) {
    try {
        // 隐藏所有section
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        // 移除所有nav的active状态
        document.querySelectorAll('.sidebar a').forEach(nav => {
            nav.classList.remove('active');
        });
        
        // 显示指定section
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('active');
        }
        
        // 设置对应nav为active
        const nav = document.getElementById(`nav-${sectionId}`);
        if (nav) {
            nav.classList.add('active');
        }
        
        // 如果是表单管理，加载数据
        if (sectionId === 'appointments') {
            getAppointments(1, {}); // 重置筛选，从第一页开始
        }
    } catch (error) {
        console.error('切换section失败:', error);
    }
}

// 页面加载时初始化
window.addEventListener('DOMContentLoaded', async function() {
    // 检查是否是后台页面
    if (window.location.pathname.includes('/admin/dashboard.html')) {
        const authed = await ensureAdminAuth();
        if (!authed) return;
        // 初始化筛选状态
        window.currentFilters = {};
        
        // 初始化编辑器
        initQuillEditor();
        
        // 初始化FAQ和文章数据
        loadFaqs();
        loadArticles();
        loadCategories();
        if (typeof loadBannerData === 'function') loadBannerData();
        if (typeof loadSidebarData === 'function') loadSidebarData();
        
        // 如果当前没有active的section，默认显示第一个
        const activeSection = document.querySelector('.section.active');
        if (!activeSection && document.getElementById('appointments')) {
            show('appointments');
        } else if (activeSection && activeSection.id === 'appointments') {
            // 如果当前已显示表单管理，重新加载数据
            getAppointments(1, {});
        }
    } else if (window.location.pathname.includes('/article') || window.location.pathname.includes('/article.html')) {
        // 前台文章详情页初始化
        initUtmTracking();
        loadArticleDetail();
        renderSidebar();
        window.addEventListener('scroll', updateProgressBar);
    } else {
        // 前台其他页面初始化UTM跟踪
        initUtmTracking();
    }
});

// 管理后台 - 认证校验与请求头
async function ensureAdminAuth() {
    try {
        const token = sessionStorage.getItem('token');
        const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
        if (!token || !isLoggedIn) {
            window.location.href = '/admin/index.html';
            return false;
        }
        const res = await fetch('/api/auth/verify', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (!data || data.success !== true) {
            window.location.href = '/admin/index.html';
            return false;
        }
        return true;
    } catch (e) {
        console.error('认证校验失败:', e);
        window.location.href = '/admin/index.html';
        return false;
    }
}

function getAuthHeaders() {
    const token = sessionStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
}

function getAuthHeaderOnly() {
    const token = sessionStorage.getItem('token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
}

// 初始化富文本编辑器
let quillEditor = null;
function initQuillEditor() {
    if (window.location.pathname.includes('/admin/dashboard.html')) {
        // 初始化富文本编辑器
        quillEditor = new Quill('#editor', {
            theme: 'snow',
            placeholder: '开始编辑内容...',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'align': [] }],
                    ['link', 'image'],
                    ['clean']
                ]
            }
        });
    }
}

// 打开FAQ编辑模态框
function openFaqModal(id = null) {
    try {
        // 重置表单
        document.getElementById('faqId').value = '';
        document.getElementById('faqOrd').value = '';
        document.getElementById('faqStatus').value = 'published';
        document.getElementById('faqQ').value = '';
        document.getElementById('faqA').value = '';
        
        // 如果是编辑模式，加载数据
        if (id) {
            fetch(`/api/faqs/${id}`)
                .then(response => response.json())
                .then(data => {
                    if (data && !data.error) {
                        document.getElementById('faqId').value = data._id;
                        document.getElementById('faqOrd').value = data.order || '';
                        document.getElementById('faqStatus').value = data.status || 'published';
                        document.getElementById('faqQ').value = data.question || '';
                        document.getElementById('faqA').value = data.answer || '';
                    }
                })
                .catch(error => {
                    console.error('加载FAQ数据失败:', error);
                    showToast('加载数据失败', 'error');
                });
        }
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('faqModal'));
        modal.show();
    } catch (error) {
        console.error('打开FAQ模态框失败:', error);
        showToast('操作失败', 'error');
    }
}

// 保存FAQ
function saveFaq() {
    try {
        const id = document.getElementById('faqId').value;
        const order = document.getElementById('faqOrd').value;
        const status = document.getElementById('faqStatus').value;
        const question = document.getElementById('faqQ').value.trim();
        const answer = document.getElementById('faqA').value.trim();
        
        // 验证必填项
        if (!question || !answer) {
            showToast('请填写问题和回答', 'error');
            return;
        }
        
        const data = {
            order: order ? parseInt(order) : 0,
            status,
            question,
            answer,
            updatedAt: new Date().toISOString()
        };
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/faqs/${id}` : '/api/faqs';
        
        fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        })
            .then(response => response.json())
            .then(data => {
                if (data && !data.error) {
                    showToast('保存成功');
                    // 关闭模态框
                    const modal = bootstrap.Modal.getInstance(document.getElementById('faqModal'));
                    modal.hide();
                    // 重新加载列表
                    loadFaqs();
                } else {
                    showToast(data.error || '保存失败', 'error');
                }
            })
            .catch(error => {
                console.error('保存FAQ失败:', error);
                showToast('保存失败', 'error');
            });
    } catch (error) {
        console.error('保存FAQ异常:', error);
        showToast('操作失败', 'error');
    }
}

// 加载FAQ列表
function loadFaqs() {
    try {
        fetch('/api/faqs')
            .then(response => response.json())
            .then(data => {
                if (data && Array.isArray(data) && !data.error) {
                    renderFaqList(data);
                } else {
                    console.error('获取FAQ列表失败:', data.error);
                    renderFaqList([]);
                }
            })
            .catch(error => {
                console.error('获取FAQ列表异常:', error);
                renderFaqList([]);
            });
    } catch (error) {
        console.error('加载FAQ异常:', error);
    }
}

// 渲染FAQ列表
function renderFaqList(faqs) {
    const faqList = document.getElementById('faqList');
    if (!faqList) return;
    
    faqList.innerHTML = '';
    
    if (faqs.length === 0) {
        faqList.innerHTML = `<tr><td colspan="7" class="text-center py-3 text-muted">暂无数据</td></tr>`;
        return;
    }
    
    // 按排序字段排序
    faqs.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    faqs.forEach(faq => {
        const row = document.createElement('tr');
        const createdAt = faq.createdAt ? new Date(faq.createdAt).toLocaleString('zh-CN') : '-';
        const updatedAt = faq.updatedAt ? new Date(faq.updatedAt).toLocaleString('zh-CN') : '-';
        const status = faq.status || 'published';
        const statusText = status === 'published' ? '<span class="text-success">已发布</span>' : '<span class="text-warning">草稿</span>';
        
        row.innerHTML = `
            <td>${faq.order || '-'}</td>
            <td class="max-w-xs overflow-hidden text-ellipsis">${faq.question || '-'}</td>
            <td class="max-w-xs overflow-hidden text-ellipsis">${faq.answer ? faq.answer.replace(/<[^>]*>/g, '').substring(0, 50) + '...' : '-'}</td>
            <td>${statusText}</td>
            <td>${createdAt}</td>
            <td>${updatedAt}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openFaqModal('${faq._id}')">编辑</button>
                <button class="btn btn-sm btn-danger ml-2" onclick="deleteFaq('${faq._id}')">删除</button>
            </td>
        `;
        faqList.appendChild(row);
    });
}

// 删除FAQ
function deleteFaq(id) {
    try {
        if (!confirm('确定要删除这条FAQ吗？')) {
            return;
        }
        
        fetch(`/api/faqs/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaderOnly()
        })
            .then(response => response.json())
            .then(data => {
                if (data && !data.error) {
                    showToast('删除成功');
                    // 重新加载列表
                    loadFaqs();
                } else {
                    showToast(data.error || '删除失败', 'error');
                }
            })
            .catch(error => {
                console.error('删除FAQ失败:', error);
                showToast('删除失败', 'error');
            });
    } catch (error) {
        console.error('删除FAQ异常:', error);
        showToast('删除失败', 'error');
    }
}

// 打开文章编辑模态框
function openArtModal(id = null) {
    try {
        // 重置表单
        document.getElementById('artId').value = '';
        document.getElementById('artTitle').value = '';
        document.getElementById('artCover').value = '';
        document.getElementById('artCategory').value = '';
        document.getElementById('artAuthor').value = '';
        document.getElementById('artFeatured').checked = false;
        document.getElementById('artDesc').value = '';
        
        // 重置编辑器
        if (quillEditor) {
            quillEditor.root.innerHTML = '';
        }
        
        // 如果是编辑模式，加载数据
        if (id) {
            fetch(`/api/articles/${id}`)
                .then(response => response.json())
                .then(data => {
                    if (data && !data.error) {
                        document.getElementById('artId').value = data._id;
                        document.getElementById('artTitle').value = data.title || '';
                        document.getElementById('artCover').value = data.coverImage || '';
                        document.getElementById('artCategory').value = data.category || '';
                        document.getElementById('artAuthor').value = data.author?.name || data.author || '';
                        document.getElementById('artFeatured').checked = data.featured || false;
                        document.getElementById('artDesc').value = data.summary || '';
                        
                        // 设置编辑器内容
                        if (quillEditor) {
                            quillEditor.root.innerHTML = data.content || '';
                        }
                    }
                })
                .catch(error => {
                    console.error('加载文章数据失败:', error);
                    showToast('加载数据失败', 'error');
                });
        }
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('artModal'));
        modal.show();
    } catch (error) {
        console.error('打开文章模态框失败:', error);
        showToast('操作失败', 'error');
    }
}

// 保存文章
function saveArt() {
    try {
        const id = document.getElementById('artId').value;
        const title = document.getElementById('artTitle').value.trim();
        const coverImage = document.getElementById('artCover').value.trim();
        const category = document.getElementById('artCategory').value;
        const authorName = document.getElementById('artAuthor').value.trim();
        const authorDesc = document.getElementById('artAuthorDesc').value.trim();
        const featured = document.getElementById('artFeatured').checked;
        const summary = document.getElementById('artDesc').value.trim();
        const content = quillEditor ? quillEditor.root.innerHTML : '';
        
        // 验证必填项
        if (!title || !category || !content) {
            showToast('请填写标题、分类和内容', 'error');
            return;
        }
        
        // 添加详细的表单数据日志
        console.log('准备提交文章数据:', { id, title, category, featured, hasContent: !!content });
        
        // 根据更新后的模型结构构建作者对象
        const data = {
            title,
            coverImage,
            category,
            author: authorName ? {
                name: authorName,
                avatar: '', 
                desc: authorDesc,
                detail: ''
            } : null,
            isRecommended: featured, // 修改为模型中定义的isRecommended字段
            summary,
            content,
            publishDate: new Date()
        };
        
        // 如果没有选择作者，使用默认作者
        if (!data.author) {
            data.author = {
                name: '系统管理员',
                avatar: '',
                desc: '',
                detail: ''
            };
        }
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/articles/${id}` : '/api/articles';
        
        fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        })
            .then(response => {
                console.log('API响应状态:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('保存文章响应:', data);
                // 修改判断逻辑，根据服务器返回的success字段判断
                if (data && data.success === true) {
                    showToast('保存成功');
                    // 关闭模态框
                    const modal = bootstrap.Modal.getInstance(document.getElementById('artModal'));
                    modal.hide();
                    // 重新加载列表
                    loadArticles();
                } else {
                    showToast(data.error || '保存失败', 'error');
                }
            })
            .catch(error => {
                console.error('保存文章失败:', error);
                showToast('保存失败，请检查网络连接或服务器状态', 'error');
            });
    } catch (error) {
        console.error('保存文章异常:', error);
        showToast('操作失败，请刷新页面后重试', 'error');
    }
}

// 加载文章列表
function loadArticles(keyword = '') {
    try {
        let url = '/api/articles';
        if (keyword) url += `?keyword=${encodeURIComponent(keyword)}`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data)) {
                    renderArticleList(data);
                } else {
                    console.error('获取文章列表失败:', data.error);
                    renderArticleList([]);
                }
            })
            .catch(error => {
                console.error('获取文章列表异常:', error);
                renderArticleList([]);
            });
    } catch (error) {
        console.error('加载文章异常:', error);
    }
}

// 搜索文章
function searchArticles() {
    const keyword = document.getElementById('artSearchKeyword').value;
    loadArticles(keyword);
}

// 渲染文章列表
function renderArticleList(articles) {
    const artList = document.getElementById('artList');
    if (!artList) return;
    
    artList.innerHTML = '';
    
    if (articles.length === 0) {
        artList.innerHTML = `<tr><td colspan="7" class="text-center py-3 text-muted">暂无数据</td></tr>`;
        return;
    }
    
    // 按发布日期倒序排序
    articles.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
    
    articles.forEach((article, index) => {
        const row = document.createElement('tr');
        
        // 获取分类名称
        const cat = allCategories.find(c => c.code === article.category);
        const categoryName = cat ? cat.name : (article.category || '-');
        
        const authorName = article.author?.name || article.author || '-';
        const status = article.isRecommended ? '<span class="badge bg-warning text-dark">推荐</span>' : '<span class="badge bg-secondary">普通</span>';
        
        row.innerHTML = `
            <td><input type="checkbox" class="form-check-input" value="${article._id}"></td>
            <td>${index + 1}</td>
            <td>${article.title || '-'}</td>
            <td>${categoryName}</td>
            <td>${authorName}</td>
            <td>${status}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openArtModal('${article._id}')">编辑</button>
                <button class="btn btn-sm btn-danger ml-2" onclick="deleteArticle('${article._id}')">删除</button>
            </td>
        `;
        artList.appendChild(row);
    });
}

// 删除文章
function deleteArticle(id) {
    try {
        if (!confirm('确定要删除这篇文章吗？')) {
            return;
        }
        
        fetch(`/api/articles/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaderOnly()
        })
            .then(response => response.json())
            .then(data => {
                if (data && !data.error) {
                    showToast('删除成功');
                    // 重新加载列表
                    loadArticles();
                } else {
                    showToast(data.error || '删除失败', 'error');
                }
            })
            .catch(error => {
                console.error('删除文章失败:', error);
                showToast('删除失败', 'error');
            });
    } catch (error) {
        console.error('删除文章异常:', error);
        showToast('删除失败', 'error');
    }
}

// 保存Banner配置
function saveBanner() {
    try {
        const data = {
            title: document.getElementById('b-title').value.trim(),
            subTitle: document.getElementById('b-subTitle').value.trim(),
            desc: document.getElementById('b-desc').value.trim(),
            cta1Text: document.getElementById('b-cta1Text').value.trim(),
            cta1Link: document.getElementById('b-cta1Link').value.trim(),
            cta2Text: document.getElementById('b-cta2Text').value.trim(),
            cta2Link: document.getElementById('b-cta2Link').value.trim(),
            image: document.getElementById('b-image').value.trim()
        };
        
    fetch('/api/banner', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    })
            .then(response => response.json())
            .then(data => {
                if (data && !data.error) {
                    showToast('保存成功');
                    // 重新加载Banner数据
                    loadBannerData();
                } else {
                    showToast(data.error || '保存失败', 'error');
                }
            })
            .catch(error => {
                console.error('保存Banner失败:', error);
                showToast('保存失败', 'error');
            });
    } catch (error) {
        console.error('保存Banner异常:', error);
        showToast('保存失败', 'error');
    }
}

// 保存侧边栏配置
function saveSidebar() {
    try {
        const data = {
            whitepaper: {
                title: document.getElementById('s-wp-title').value.trim(),
                img: document.getElementById('s-wp-img').value.trim(),
                link: document.getElementById('s-wp-link').value.trim()
            },
            recommendedArticles: [
                {
                    title: document.getElementById('s-r1-t').value.trim(),
                    link: document.getElementById('s-r1-l').value.trim(),
                    category: document.getElementById('s-r1-c').value.trim()
                },
                {
                    title: document.getElementById('s-r2-t').value.trim(),
                    link: document.getElementById('s-r2-l').value.trim(),
                    category: document.getElementById('s-r2-c').value.trim()
                }
            ]
        };
        
    fetch('/api/sidebar', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    })
            .then(response => response.json())
            .then(data => {
                if (data && !data.error) {
                    showToast('保存成功');
                    // 重新加载侧边栏数据
                    loadSidebarData();
                } else {
                    showToast(data.error || '保存失败', 'error');
                }
            })
            .catch(error => {
                console.error('保存侧边栏失败:', error);
                showToast('保存失败', 'error');
            });
    } catch (error) {
        console.error('保存侧边栏异常:', error);
        showToast('保存失败', 'error');
    }
}

// 加载Banner数据
function loadBannerData() {
    try {
        fetch('/api/banner')
            .then(response => response.json())
            .then(data => {
                if (data && !data.error) {
                    document.getElementById('b-title').value = data.title || '';
                    document.getElementById('b-subTitle').value = data.subTitle || '';
                    document.getElementById('b-desc').value = data.desc || '';
                    document.getElementById('b-cta1Text').value = data.cta1Text || '';
                    document.getElementById('b-cta1Link').value = data.cta1Link || '';
                    document.getElementById('b-cta2Text').value = data.cta2Text || '';
                    document.getElementById('b-cta2Link').value = data.cta2Link || '';
                    document.getElementById('b-image').value = data.image || '';
                }
            })
            .catch(error => {
                console.error('加载Banner数据失败:', error);
            });
    } catch (error) {
        console.error('加载Banner异常:', error);
    }
}

// 加载侧边栏数据
function loadSidebarData() {
    try {
        fetch('/api/sidebar')
            .then(response => response.json())
            .then(data => {
                if (data && !data.error) {
                    const wp = data.whitepaper || {};
                    document.getElementById('s-wp-title').value = wp.title || '';
                    document.getElementById('s-wp-img').value = wp.img || '';
                    document.getElementById('s-wp-link').value = wp.link || '';
                    document.getElementById('s-wp-desc').value = wp.desc || '';
                    document.getElementById('s-wp-count').value = wp.count || '';
                    
                    const recArticles = data.recommendedArticles || [];
                    if (recArticles[0]) {
                        document.getElementById('s-r1-t').value = recArticles[0].title || '';
                        document.getElementById('s-r1-l').value = recArticles[0].link || '';
                        document.getElementById('s-r1-c').value = recArticles[0].category || '';
                    }
                    if (recArticles[1]) {
                        document.getElementById('s-r2-t').value = recArticles[1].title || '';
                        document.getElementById('s-r2-l').value = recArticles[1].link || '';
                        document.getElementById('s-r2-c').value = recArticles[1].category || '';
                    }
                }
            })
            .catch(error => {
                console.error('加载侧边栏数据失败:', error);
            });
    } catch (error) {
        console.error('加载侧边栏异常:', error);
    }
}

// 错误提示与成功反馈函数
function showToast(message, type = 'success') {
    // 检查是否已存在toast元素，避免重复创建
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        // 创建toast容器
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        toastContainer.style.display = 'flex';
        toastContainer.style.flexDirection = 'column';
        toastContainer.style.gap = '10px';
        document.body.appendChild(toastContainer);
    }
    
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = 'toast alert';
    toast.style.minWidth = '250px';
    toast.style.padding = '15px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'center';
    toast.style.textAlign = 'center';
    
    // 根据类型设置样式
    if (type === 'error') {
        toast.style.backgroundColor = '#f8d7da';
        toast.style.color = '#721c24';
        toast.style.border = '1px solid #f5c6cb';
    } else {
        toast.style.backgroundColor = '#d4edda';
        toast.style.color = '#155724';
        toast.style.border = '1px solid #c3e6cb';
    }
    
    // 设置消息内容
    toast.textContent = message;
    
    // 添加到容器
    toastContainer.appendChild(toast);
    
    // 显示动画
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // 自动关闭
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode === toastContainer) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// --- Category Management ---
let allCategories = [];

function loadCategories() {
    fetch('/api/categories')
        .then(res => res.json())
        .then(data => {
            allCategories = data;
            renderCategoryList(data);
            updateCategorySelects(data);
        })
        .catch(err => console.error('Load categories failed:', err));
}

function renderCategoryList(categories) {
    const list = document.getElementById('categoryList');
    if (!list) return;
    list.innerHTML = categories.map(c => `
        <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
                <strong>${c.name}</strong> <small class="text-muted">(${c.code})</small>
                <br><small class="text-muted">排序: ${c.order} | 文章: ${c.articleCount || 0}</small>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-primary" onclick="editCategory('${c._id}')">编辑</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${c._id}')">删除</button>
            </div>
        </div>
    `).join('');
}

function updateCategorySelects(categories) {
    const artSelect = document.getElementById('artCategory');
    if (artSelect) {
        // Keep the first option (Select...)
        artSelect.innerHTML = '<option value="">选择分类...</option>' + 
            categories.map(c => `<option value="${c.code}">${c.name}</option>`).join('');
    }
}

function openCategoryModal() {
    document.getElementById('catId').value = '';
    document.getElementById('catName').value = '';
    document.getElementById('catCode').value = '';
    document.getElementById('catOrder').value = 0;
    new bootstrap.Modal(document.getElementById('categoryModal')).show();
    loadCategories();
}

function editCategory(id) {
    const cat = allCategories.find(c => c._id === id);
    if (cat) {
        document.getElementById('catId').value = cat._id;
        document.getElementById('catName').value = cat.name;
        document.getElementById('catCode').value = cat.code;
        document.getElementById('catOrder').value = cat.order;
        // The list is inside the modal, so the modal is already open
    }
}

function saveCategory() {
    const id = document.getElementById('catId').value;
    const data = {
        name: document.getElementById('catName').value,
        code: document.getElementById('catCode').value,
        order: document.getElementById('catOrder').value
    };
    
    if (!data.name || !data.code) {
        showToast('名称和代码必填', 'error');
        return;
    }
    
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/categories/${id}` : '/api/categories';
    
    fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            showToast('保存分类成功');
            loadCategories(); // Reload list
            // Clear form
            document.getElementById('catId').value = '';
            document.getElementById('catName').value = '';
            document.getElementById('catCode').value = '';
            document.getElementById('catOrder').value = 0;
        } else {
            showToast(res.error || '保存失败', 'error');
        }
    });
}

function deleteCategory(id) {
    if (!confirm('确定删除该分类吗？')) return;
    fetch(`/api/categories/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                showToast('删除成功');
                loadCategories();
            } else {
                showToast(res.error, 'error');
            }
        });
}

// --- Cover Upload ---

function uploadCover() {
    const fileInput = document.getElementById('artCoverFile');
    const file = fileInput.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    fetch('/api/upload', {
        method: 'POST',
        headers: getAuthHeaderOnly(),
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('artCover').value = data.url;
            showToast('上传成功');
            document.getElementById('artCoverPreview').classList.remove('d-none');
            document.getElementById('artCoverPreview').querySelector('img').src = data.url;
        } else {
            showToast('上传失败', 'error');
        }
    })
    .catch(err => showToast('上传出错', 'error'));
}

// 登录表单处理
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('u').value;
        const password = document.getElementById('p').value;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // 登录成功，保存登录状态到sessionStorage
                sessionStorage.setItem('isLoggedIn', 'true');
                if (result.token) sessionStorage.setItem('token', result.token);
                // 跳转到管理后台主页
                window.location.href = 'dashboard.html';
            } else {
                // 登录失败，显示错误信息
                alert('登录失败: ' + (result.message || '账号或密码错误'));
            }
        } catch (error) {
            console.error('登录请求失败:', error);
            alert('登录请求失败，请检查网络连接');
        }
    });
}
// Global variable to store current article ID
let currentArticleId = null;

// 前台文章详情页 - 加载文章详情
async function loadArticleDetail() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        let id = urlParams.get('id');
        let slug = null;
        
        // If no ID, try to extract slug from URL path
        if (!id) {
            const path = window.location.pathname;
            // Matches /article/some-slug or /article/some-slug.html
            const match = path.match(/\/article\/(.+?)(\.html)?$/);
            if (match && match[1]) {
                slug = match[1].replace('.html', '');
            }
        }
        
        if (!id && !slug) {
            const t = document.getElementById('article-title');
            const c = document.getElementById('article-container');
            if (t) t.textContent = '未找到文章';
            if (c) c.innerHTML = `<div class="text-center text-slate-500 py-10">抱歉，未提供有效的文章ID或链接。</div>`;
            return;
        }

        let apiUrl;
        if (id) {
            apiUrl = '/api/articles/' + id;
        } else {
            apiUrl = `/api/articles/detail/query?slug=${slug}`;
        }

        const response = await fetch(apiUrl);
        if (!response.ok) {
            const t = document.getElementById('article-title');
            const c = document.getElementById('article-container');
            if (response.status === 404) {
                if (t) t.textContent = '文章不存在或已删除';
                if (c) c.innerHTML = `<div class="text-center text-slate-500 py-10">抱歉，您访问的文章不存在或已被删除。</div>`;
            } else {
                if (t) t.textContent = '文章加载失败';
                if (c) c.innerHTML = `<div class="text-center text-slate-500 py-10">加载文章时出现错误，请稍后重试。</div>`;
            }
            return;
        }
        const data = await response.json();

        if (data.error) {
            const t = document.getElementById('article-title');
            const c = document.getElementById('article-container');
            if (t) t.textContent = '文章加载失败';
            if (c) c.innerHTML = `<div class="text-center text-slate-500 py-10">${data.error}</div>`;
            return;
        }
        
        // Store the resolved ID
        currentArticleId = data._id;

        // Render Data
        document.title = data.title + ' - 瑞华智策';
        if(document.getElementById('breadcrumb-title')) document.getElementById('breadcrumb-title').textContent = data.title;
        if(document.getElementById('article-title')) document.getElementById('article-title').textContent = data.title;
        if(document.getElementById('article-date')) document.getElementById('article-date').textContent = new Date(data.publishDate).toLocaleDateString('zh-CN');
        
        // Estimate read time
        const readTime = Math.ceil((data.content || '').length / 500) || 1;
        if(document.getElementById('article-readtime')) document.getElementById('article-readtime').textContent = readTime;
        
        if(document.getElementById('article-author')) {
             const authorName = data.author && data.author.name ? data.author.name : (typeof data.author === 'string' ? data.author : '瑞华智策');
             document.getElementById('article-author').textContent = authorName;
        }

        // Render Sidebar Author Info
        if (data.author && typeof data.author === 'object') {
            if (document.getElementById('expert-title')) {
                document.getElementById('expert-title').textContent = data.author.name || '瑞华智策专家组';
            }
            if (document.getElementById('expert-desc')) {
                document.getElementById('expert-desc').textContent = data.author.desc || '人力资本价值经营研究院';
            }
            if (document.getElementById('expert-detail')) {
                document.getElementById('expert-detail').textContent = data.author.detail || '瑞华智策汇聚了来自华为、人瑞人才及全球顶尖咨询机构的实战专家。';
            }
            if (document.getElementById('expert-avatar')) {
                const avatarEl = document.getElementById('expert-avatar');
                const avatarSrc = data.author.avatar || '/images/rhzclogo.png';
                
                // Set source with cache busting if it's an uploaded image
                if (avatarSrc.startsWith('/uploads/')) {
                    avatarEl.src = `${avatarSrc}?v=${Date.now()}`;
                } else {
                    avatarEl.src = avatarSrc;
                }
                
                // Error handling
                avatarEl.onerror = function() {
                    console.error('Avatar load error:', this.src);
                    if (this.src.indexOf('rhzclogo.png') === -1) {
                        this.src = '/images/rhzclogo.png';
                    }
                };
            }
        }
        
        // Render Content
        const container = document.getElementById('article-container');
        if(container) container.innerHTML = data.content || '';
        
        // Update Like Count
        const likeCount = document.getElementById('likeCount');
        if (likeCount) likeCount.textContent = data.likes || 0;

        // Initialize Button States
        if (currentArticleId) {
            checkArticleStatus(currentArticleId);
        }

    } catch (error) {
        console.error('Error loading article:', error);
    }
}

// 前台文章详情页 - 点赞
async function likeArticle() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) return;

    // Check LocalStorage
    const likedArticles = JSON.parse(localStorage.getItem('liked_articles') || '[]');
    if (likedArticles.includes(id)) {
        alert('您已经点赞过这篇文章了');
        return;
    }

    try {
        const response = await fetch('/api/articles/' + id + '/like', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            // Update UI
            const likeCount = document.getElementById('likeCount');
            if(likeCount) likeCount.textContent = data.likes;
            
            const btn = document.getElementById('likeBtn');
            if(btn) {
                btn.classList.add('text-red-500', 'bg-red-50');
                const icon = btn.querySelector('i');
                if(icon) icon.classList.replace('far', 'fas');
            }
            
            // Save to LocalStorage
            likedArticles.push(id);
            localStorage.setItem('liked_articles', JSON.stringify(likedArticles));
        }
    } catch (error) {
        console.error('Error liking article:', error);
    }
}

// 前台文章详情页 - 收藏 (本地存储)
function collectArticle() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = currentArticleId || urlParams.get('id');
    if (!id) return;

    const collectedArticles = JSON.parse(localStorage.getItem('collected_articles') || '[]');
    const index = collectedArticles.indexOf(id);
    
    const btn = document.getElementById('collectBtn');
    const text = document.getElementById('collectText');
    if(!btn || !text) return;
    
    const icon = btn.querySelector('i');

    if (index === -1) {
        // Collect
        collectedArticles.push(id);
        text.textContent = '已收藏';
        btn.classList.add('text-yellow-500', 'bg-yellow-50');
        if(icon) icon.classList.replace('far', 'fas');
    } else {
        // Uncollect
        collectedArticles.splice(index, 1);
        text.textContent = '收藏';
        btn.classList.remove('text-yellow-500', 'bg-yellow-50');
        if(icon) icon.classList.replace('fas', 'far');
    }
    
    localStorage.setItem('collected_articles', JSON.stringify(collectedArticles));
}

// 前台文章详情页 - 检查状态
function checkArticleStatus(id) {
    // Check Like
    const likedArticles = JSON.parse(localStorage.getItem('liked_articles') || '[]');
    if (likedArticles.includes(id)) {
        const btn = document.getElementById('likeBtn');
        if (btn) {
            btn.classList.add('text-red-500', 'bg-red-50');
            const icon = btn.querySelector('i');
            if(icon) icon.classList.replace('far', 'fas');
        }
    }

    // Check Collect
    const collectedArticles = JSON.parse(localStorage.getItem('collected_articles') || '[]');
    if (collectedArticles.includes(id)) {
        const btn = document.getElementById('collectBtn');
        if (btn) {
            btn.classList.add('text-yellow-500', 'bg-yellow-50');
            const icon = btn.querySelector('i');
            if(icon) icon.classList.replace('far', 'fas');
            const text = document.getElementById('collectText');
            if(text) text.textContent = '已收藏';
        }
    }
}

// 渲染侧边栏 (前台)
async function renderSidebar() {
    try {
        const response = await fetch('/api/sidebar');
        const data = await response.json();
        
        if (data && !data.error) {
            // 更新白皮书信息
            const wp = data.whitepaper || {};
            if (wp.title) {
                const t = document.getElementById('whitepaper-title');
                if (t) t.textContent = wp.title;
            }
            if (wp.link) {
                const l = document.getElementById('whitepaper-link');
                if (l) l.href = wp.link;
            }
            if (wp.desc) {
                const d = document.getElementById('whitepaper-desc');
                if (d) d.textContent = wp.desc;
            }
            if (wp.count) {
                const c = document.getElementById('whitepaper-count');
                if (c) c.textContent = wp.count;
            }

            // Image handling
            const titleEl = document.getElementById('whitepaper-title');
            if (titleEl) {
                const iconContainer = titleEl.previousElementSibling;
                if (iconContainer && iconContainer.classList.contains('w-16')) {
                    if (wp.img) {
                        // Replace content with image
                        iconContainer.innerHTML = `<img src="${wp.img}" alt="Whitepaper" class="w-full h-full object-cover rounded-full">`;
                        // Remove default background/color classes to avoid clash
                        iconContainer.classList.remove('bg-brand-50', 'text-brand-600');
                    } else {
                        // Revert to default icon
                        iconContainer.innerHTML = `<i class="fas fa-file-pdf"></i>`;
                        iconContainer.classList.add('bg-brand-50', 'text-brand-600');
                    }
                }
            }
            
            // 更新推荐文章
            const recArticles = data.recommendedArticles || [];
            if (recArticles[0]) {
                if (recArticles[0].title) {
                    const el = document.getElementById('rec-title-1');
                    if (el) el.textContent = recArticles[0].title;
                }
                if (recArticles[0].link) {
                    const el = document.getElementById('rec-link-1');
                    if (el) el.href = recArticles[0].link;
                }
                if (recArticles[0].category) {
                    const el = document.getElementById('rec-cat-1');
                    if (el) el.textContent = recArticles[0].category;
                }
            }
            if (recArticles[1]) {
                if (recArticles[1].title) {
                    const el = document.getElementById('rec-title-2');
                    if (el) el.textContent = recArticles[1].title;
                }
                if (recArticles[1].link) {
                    const el = document.getElementById('rec-link-2');
                    if (el) el.href = recArticles[1].link;
                }
                if (recArticles[1].category) {
                    const el = document.getElementById('rec-cat-2');
                    if (el) el.textContent = recArticles[1].category;
                }
            }
        }
    } catch (error) {
        console.error('渲染侧边栏失败:', error);
    }
}

// 阅读进度条
function updateProgressBar() {
    const progressBar = document.getElementById('progress-bar');
    if (!progressBar) return;
    
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
    const clientHeight = document.documentElement.clientHeight || document.body.clientHeight;
    
    const scrolled = (scrollTop / (scrollHeight - clientHeight)) * 100;
    progressBar.style.width = scrolled + '%';
}

// --- Whitepaper Download Modal Functions ---

function openWhitepaperModal() {
    try {
        const modal = document.getElementById('whitepaperModal');
        const backdrop = document.getElementById('wpModalBackdrop');
        const panel = document.getElementById('wpModalPanel');
        
        if (modal) {
            modal.classList.remove('hidden');
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            // Trigger animations
            setTimeout(() => {
                if(backdrop) backdrop.classList.remove('opacity-0');
                if(panel) {
                    panel.classList.remove('opacity-0', 'scale-95');
                    panel.classList.add('opacity-100', 'scale-100');
                }
            }, 10);
        } else {
            console.error('Whitepaper modal element not found');
        }
    } catch (e) {
        console.error('Error opening whitepaper modal:', e);
    }
}

function closeWhitepaperModal() {
    try {
        const modal = document.getElementById('whitepaperModal');
        const backdrop = document.getElementById('wpModalBackdrop');
        const panel = document.getElementById('wpModalPanel');
        
        if (modal) {
            if(backdrop) backdrop.classList.add('opacity-0');
            if(panel) {
                panel.classList.remove('opacity-100', 'scale-100');
                panel.classList.add('opacity-0', 'scale-95');
            }
            
            // Restore body scroll
            document.body.style.overflow = '';

            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }
    } catch (e) {
        console.error('Error closing whitepaper modal:', e);
    }
}

function openWpSuccessModal() {
    const modal = document.getElementById('wpSuccessModal');
    const backdrop = document.getElementById('wpSuccessBackdrop');
    const panel = document.getElementById('wpSuccessPanel');
    
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            panel.classList.remove('opacity-0', 'scale-95');
            panel.classList.add('opacity-100', 'scale-100');
        }, 10);
    }
}

function closeWpSuccessModal() {
    const modal = document.getElementById('wpSuccessModal');
    const backdrop = document.getElementById('wpSuccessBackdrop');
    const panel = document.getElementById('wpSuccessPanel');
    
    if (modal) {
        backdrop.classList.add('opacity-0');
        panel.classList.remove('opacity-100', 'scale-100');
        panel.classList.add('opacity-0', 'scale-95');
        
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
}

async function handleWhitepaperSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const btn = document.getElementById('wpSubmitBtn');
    const originalText = btn.innerHTML;
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Add whitepaper name
    const titleEl = document.getElementById('whitepaper-title');
    data.whitepaperName = titleEl ? titleEl.textContent : '2025年度白皮书';
    data.source = window.location.href;
    
    // Add UTM params if available
    if (typeof getCurrentUtmParameters === 'function') {
        const utm = getCurrentUtmParameters();
        Object.assign(data, utm);
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
        
        const response = await fetch('/api/whitepaper/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            closeWhitepaperModal();
            form.reset();
            setTimeout(() => {
                openWpSuccessModal();
            }, 300);
        } else {
            alert(result.error || '提交失败，请稍后重试');
        }
    } catch (error) {
        console.error('Submission error:', error);
        alert('网络错误，请检查您的网络连接');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
