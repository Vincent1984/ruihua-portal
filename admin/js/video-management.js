// Wrap in IIFE to avoid global scope pollution and 'createApp has already been declared' errors
(() => {
const { createApp, ref, reactive, onMounted, onUnmounted, computed, watch } = Vue;

const VideoApp = {
    setup() {
        const activeTab = ref('videos');
        
        // --- State ---
        const videos = ref([]);
        const categories = ref([]);
        const treeCategories = ref([]);
        const loading = ref(false);
        const authors = ref([]);

        // Pagination
        const total = ref(0);
        const page = ref(1);
        const limit = ref(10);
        
        // Search
        const searchQuery = reactive({
            keyword: '',
            category: ''
        });

        const enableThreeColumnEditor = ref(true);
        const brandColor = '#7c4dff';

        // Modals
        const videoModalVisible = ref(false);
        const editorRef = ref(null);
        const toolbarRef = ref(null);
        let wangEditorInstance = null;
        const categoryModalVisible = ref(false);
        const embedModalVisible = ref(false);
        const seoScoreLoading = ref(false);
        const faqLoading = ref(false);
        const generateFaqLoading = ref(false);
        const faqList = ref([]);
        const seoScoreResult = reactive({
            total: 0,
            seo: 0,
            geo: 0,
            level: '',
            summary: '',
            suggestions: []
        });
        const editorWorkspaceRef = ref(null);
        const isBrowserFullscreen = ref(false);
        const showFullscreenHint = ref(false);
        const fullscreenHintText = ref('已进入全屏模式，按 Esc 可退出');
        let fullscreenHintTimer = null;
        const workspaceStyle = computed(() => {
            // Using #7c4dff as primary color and calculating WCAG compliant shades
            const base = `--el-color-primary:${brandColor};--el-color-primary-light-3:#a382ff;--el-color-primary-light-5:#bda6ff;--el-color-primary-light-7:#d7caff;--el-color-primary-light-8:#e4dcff;--el-color-primary-light-9:#f4f0ff;--el-color-primary-dark-2:#633ecc;background:#faf9ff;`;
            return isBrowserFullscreen.value ? `${base}height:100vh;` : base;
        });

        // Forms
        const embedForm = reactive({
            videoId: '',
            videoTitle: '',
            embed_url: '',
            is_embed_enabled: false,
            gray_percent: 100,
            position: 'top',
            selector: '',
            embed_settings: {
                autoplay: false,
                loop: false,
                preload: 'auto',
                poster: '',
                watermark: ''
            },
            dimensions: {
                width: '100%',
                height: 'auto'
            }
        });

        const videoForm = reactive({
            _id: '',
            title: '',
            videoCategories: [],
            slug: '',
            thumbnail: '',
            thumbnailAlt: '',
            videoUrl: '',
            embedCode: '',
            description: '',
            content: '',
            duration: '',
            durationSeconds: 0,
            tags: [],
            speaker: '',
            isRecommended: false,
            showProductivityAd: true,
            status: 'published',
            // SEO & GEO Optimization Fields
            metaTitle: '',
            metaDescription: '',
            seoKeywords: [],
            geoSummary: '',
            structuredData: '',
            faqs: []
        });

        const categoryForm = reactive({
            _id: '',
            name: '',
            parentId: null,
            level: 1,
            description: '',
            order: 0,
            seoTitle: '',
            seoDescription: ''
        });

        const authHeaders = () => {
            const token = sessionStorage.getItem('token');
            return { 'Authorization': `Bearer ${token}` };
        };

        // --- Categories API ---
        const loadCategories = async () => {
            try {
                const res = await fetch('/api/video-categories/tree', { headers: authHeaders() });
                const data = await res.json();
                if (data.success) {
                    treeCategories.value = data.data;
                    // Flatten for select options
                    const flatten = (nodes, prefix = '') => {
                        let result = [];
                        nodes.forEach(n => {
                            result.push({ ...n, labelName: prefix + n.name });
                            if (n.children) {
                                result = result.concat(flatten(n.children, prefix + '-- '));
                            }
                        });
                        return result;
                    };
                    categories.value = flatten(data.data);
                }
            } catch (e) {
                ElementPlus.ElMessage.error('获取分类失败');
            }
        };

        const saveCategory = async () => {
            try {
                const isEdit = !!categoryForm._id;
                const url = isEdit ? `/api/video-categories/${categoryForm._id}` : '/api/video-categories';
                const method = isEdit ? 'PUT' : 'POST';
                
                // Remove empty _id to prevent MongoDB Cast to ObjectId error
                const payload = { ...categoryForm };
                if (!payload._id) delete payload._id;
                if (!payload.parentId) delete payload.parentId;

                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    ElementPlus.ElMessage.success('保存成功');
                    categoryModalVisible.value = false;
                    loadCategories();
                } else {
                    ElementPlus.ElMessage.error(data.error || '保存失败');
                }
            } catch (e) {
                ElementPlus.ElMessage.error('网络错误');
            }
        };

        const deleteCategory = async (node, data) => {
            try {
                await ElementPlus.ElMessageBox.confirm('确认删除该分类?', '提示', { type: 'warning' });
                const res = await fetch(`/api/video-categories/${data._id}`, {
                    method: 'DELETE',
                    headers: authHeaders()
                });
                const result = await res.json();
                if (result.success) {
                    ElementPlus.ElMessage.success('删除成功');
                    loadCategories();
                } else {
                    ElementPlus.ElMessage.error(result.error || '删除失败');
                }
            } catch (e) {
                if (e !== 'cancel') console.error(e);
            }
        };

        const openCategoryModal = (parent = null, editData = null) => {
            Object.assign(categoryForm, {
                _id: '', name: '', parentId: null, level: 1, description: '', order: 0, seoTitle: '', seoDescription: ''
            });
            if (parent) {
                categoryForm.parentId = parent._id;
                categoryForm.level = parent.level + 1;
            }
            if (editData) {
                Object.assign(categoryForm, editData);
            }
            categoryModalVisible.value = true;
        };

        // --- Videos API ---
        const loadVideos = async () => {
            loading.value = true;
            try {
                const params = new URLSearchParams({
                    page: page.value,
                    limit: limit.value,
                    keyword: searchQuery.keyword,
                    category: searchQuery.category === 'all' ? '' : searchQuery.category
                });
                const res = await fetch(`/api/videos?${params}`, { headers: authHeaders() });
                const data = await res.json();
                if (data.data) {
                    videos.value = data.data;
                    total.value = data.pagination.total;
                } else {
                    videos.value = data; // Legacy fallback
                    total.value = data.length;
                }
            } catch (e) {
                ElementPlus.ElMessage.error('获取视频失败');
            } finally {
                loading.value = false;
            }
        };

        const initEditor = () => {
            if (!window.wangEditor) return;
            const { createEditor, createToolbar } = window.wangEditor;
            
            // Destroy existing instance if any
            if (wangEditorInstance) {
                wangEditorInstance.destroy();
                wangEditorInstance = null;
            }

            // Ensure DOM elements are available
            setTimeout(() => {
                if (!editorRef.value || !toolbarRef.value) return;
                
                // Clear container before init to avoid duplicates
                editorRef.value.innerHTML = '';
                toolbarRef.value.innerHTML = '';

                const editorConfig = {
                    placeholder: '请输入详细内容...',
                    MENU_CONF: {
                        uploadImage: {
                            server: '/api/upload',
                            fieldName: 'file',
                            headers: {
                                Authorization: 'Bearer ' + sessionStorage.getItem('token')
                            },
                            maxFileSize: 2 * 1024 * 1024,
                            maxNumberOfFiles: 10,
                            allowedFileTypes: ['image/*'],
                            customInsert(res, insertFn) {
                                if (res.success && res.url) {
                                    insertFn(res.url, '图片', res.url);
                                } else {
                                    ElementPlus.ElMessage.error(res.error || '图片上传失败');
                                }
                            }
                        }
                    },
                    onChange(editor) {
                        videoForm.content = editor.getHtml();
                    }
                };

                wangEditorInstance = createEditor({
                    selector: editorRef.value,
                    html: videoForm.content || '',
                    config: editorConfig,
                    mode: 'default'
                });

                createToolbar({
                    editor: wangEditorInstance,
                    selector: toolbarRef.value,
                    mode: 'default'
                });
            }, 100); // Wait for el-dialog animation/rendering
        };

        const openVideoModal = (video = null) => {
            Object.assign(videoForm, {
                _id: '', title: '', videoCategories: [], slug: '', thumbnail: '', thumbnailAlt: '',
                videoUrl: '', embedCode: '', description: '', content: '', duration: '', durationSeconds: 0,
                tags: [], speaker: '', isRecommended: false, status: 'published',
                metaTitle: '', metaDescription: '', seoKeywords: [], geoSummary: '', structuredData: ''
            });
            Object.assign(seoScoreResult, {
                total: 0,
                seo: 0,
                geo: 0,
                level: '',
                summary: '',
                suggestions: []
            });
            if (video) {
                Object.assign(videoForm, video);
                // Handle legacy speakers array data format if any
                if (video.speakers && video.speakers.length > 0) {
                    videoForm.speaker = video.speakers[0].authorId || video.speakers[0];
                }
            }
            videoModalVisible.value = true;
            initEditor();
        };

        const runSeoGeoScore = async () => {
            if (!videoForm.title) return ElementPlus.ElMessage.warning('请先填写视频标题');
            seoScoreLoading.value = true;
            try {
                const res = await fetch('/api/tools/video/score', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({
                        title: videoForm.title,
                        description: videoForm.description,
                        content: videoForm.content,
                        tags: videoForm.tags,
                        metaTitle: videoForm.metaTitle,
                        metaDescription: videoForm.metaDescription,
                        geoSummary: videoForm.geoSummary
                    })
                });
                const data = await res.json();
                if (data.success && data.data) {
                    Object.assign(seoScoreResult, data.data);
                    ElementPlus.ElMessage.success('评分完成');
                } else {
                    throw new Error(data.error || '评分失败');
                }
            } catch (e) {
                ElementPlus.ElMessage.error(e.message || '评分失败');
            } finally {
                seoScoreLoading.value = false;
            }
        };

        onUnmounted(() => {
            if (wangEditorInstance) {
                wangEditorInstance.destroy();
                wangEditorInstance = null;
            }
        });

        const syncFullscreenState = () => {
            const fullscreenEl = document.fullscreenElement
                || document.webkitFullscreenElement
                || document.mozFullScreenElement
                || document.msFullscreenElement;
            isBrowserFullscreen.value = !!fullscreenEl;
            if (!fullscreenEl) {
                fullscreenHintText.value = '已退出全屏模式';
                showFullscreenHint.value = true;
                clearTimeout(fullscreenHintTimer);
                fullscreenHintTimer = setTimeout(() => {
                    showFullscreenHint.value = false;
                }, 1800);
            }
        };

        const requestBrowserFullscreen = async () => {
            const target = editorWorkspaceRef.value || document.documentElement;
            if (!target) return;
            try {
                if (target.requestFullscreen) {
                    await target.requestFullscreen({ navigationUI: 'hide' });
                } else if (target.webkitRequestFullscreen) {
                    target.webkitRequestFullscreen();
                } else if (target.mozRequestFullScreen) {
                    target.mozRequestFullScreen();
                } else if (target.msRequestFullscreen) {
                    target.msRequestFullscreen();
                }
                fullscreenHintText.value = '已进入全屏模式，按 Esc 可退出';
                showFullscreenHint.value = true;
                clearTimeout(fullscreenHintTimer);
                fullscreenHintTimer = setTimeout(() => {
                    showFullscreenHint.value = false;
                }, 2200);
            } catch (e) {
                ElementPlus.ElMessage.warning('浏览器不支持全屏模式或被拦截');
            }
        };

        const exitBrowserFullscreen = async () => {
            try {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            } catch (e) {
                ElementPlus.ElMessage.warning('退出全屏失败，请按 Esc 重试');
            }
        };

        const toggleBrowserFullscreen = async () => {
            if (isBrowserFullscreen.value) {
                await exitBrowserFullscreen();
            } else {
                await requestBrowserFullscreen();
            }
        };

        const handleFullscreenKeydown = async (e) => {
            if (!videoModalVisible.value) return;
            if (e.key === 'F11') {
                fullscreenHintText.value = '提示：当前支持工作台全屏，若地址栏仍显示属于浏览器安全策略';
                showFullscreenHint.value = true;
                clearTimeout(fullscreenHintTimer);
                fullscreenHintTimer = setTimeout(() => {
                    showFullscreenHint.value = false;
                }, 2600);
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
                e.preventDefault();
                await toggleBrowserFullscreen();
            }
        };

        const saveVideo = async () => {
            try {
                if (!videoForm.title) {
                    return ElementPlus.ElMessage.warning('请填写标题');
                }
                
                // 1. Auto fill thumbnail ALT if empty
                if (videoForm.thumbnail && !videoForm.thumbnailAlt) {
                    videoForm.thumbnailAlt = videoForm.title;
                }
                // 2. Auto fill metaTitle if empty
                if (!videoForm.metaTitle) {
                    videoForm.metaTitle = videoForm.title;
                }

                if (videoForm.slug && !validateSlug()) {
                    return ElementPlus.ElMessage.warning('Slug 格式不正确');
                }
                const isEdit = !!videoForm._id;
                const url = isEdit ? `/api/videos/${videoForm._id}` : '/api/videos';
                const method = isEdit ? 'PUT' : 'POST';
                
                const payload = { ...videoForm };
                if (!payload._id) delete payload._id;
                
                // Convert speaker string back to speakers array format for backend
                if (payload.speaker) {
                    payload.speakers = [{ authorId: payload.speaker, role: '主讲' }];
                } else {
                    payload.speakers = [];
                }
                delete payload.speaker;

                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    ElementPlus.ElMessage.success('保存成功');
                    videoModalVisible.value = false;
                    loadVideos();
                } else {
                    ElementPlus.ElMessage.error(data.error || '保存失败');
                }
            } catch (e) {
                ElementPlus.ElMessage.error('网络错误');
            }
        };

        const deleteVideo = async (id) => {
            try {
                await ElementPlus.ElMessageBox.confirm('确认删除该视频?', '提示', { type: 'warning' });
                const res = await fetch(`/api/videos/${id}`, {
                    method: 'DELETE',
                    headers: authHeaders()
                });
                const result = await res.json();
                if (result.success) {
                    ElementPlus.ElMessage.success('删除成功');
                    loadVideos();
                } else {
                    ElementPlus.ElMessage.error(result.error || '删除失败');
                }
            } catch (e) {
                if (e !== 'cancel') console.error(e);
            }
        };

        // --- Embed Config API ---
        const openEmbedModal = async (video) => {
            embedForm.videoId = video._id;
            embedForm.videoTitle = video.title;
            // Reset form
            Object.assign(embedForm, {
                embed_url: '',
                is_embed_enabled: false,
                gray_percent: 100,
                position: 'top',
                selector: '',
                embed_settings: { autoplay: false, loop: false, preload: 'auto', poster: '', watermark: '' },
                dimensions: { width: '100%', height: 'auto' }
            });
            embedForm.videoId = video._id;
            embedForm.videoTitle = video.title;

            try {
                const res = await fetch(`/api/admin/video-detail/embed/config/${video._id}`, { headers: authHeaders() });
                const data = await res.json();
                if (data.success && data.data) {
                    Object.assign(embedForm, data.data);
                }
            } catch (e) {
                console.error(e);
            }
            embedModalVisible.value = true;
        };

        const saveEmbedConfig = async () => {
            try {
                if (!embedForm.embed_url) return ElementPlus.ElMessage.warning('请填写嵌入视频URL');
                const res = await fetch('/api/admin/video-detail/embed/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify(embedForm)
                });
                const data = await res.json();
                if (data.success) {
                    ElementPlus.ElMessage.success('嵌入配置保存成功，并已触发 CDN 刷新');
                    embedModalVisible.value = false;
                } else {
                    ElementPlus.ElMessage.error(data.error || '保存失败');
                }
            } catch (e) {
                ElementPlus.ElMessage.error('网络错误');
            }
        };

        // --- AI Tools ---
        const generateSlug = async () => {
            if (!videoForm.title) return ElementPlus.ElMessage.warning('请先填写标题');
            try {
                const res = await fetch('/api/tools/video/slug', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ title: videoForm.title })
                });
                const data = await res.json();
                if (data.success) {
                    videoForm.slug = data.data;
                    ElementPlus.ElMessage.success('Slug 生成成功');
                    validateSlug();
                } else throw new Error(data.error);
            } catch (e) {
                ElementPlus.ElMessage.error(e.message || '生成失败');
            }
        };

        const slugError = ref('');
        const validateSlug = () => {
            if (!videoForm.slug) {
                slugError.value = '';
                return true;
            }
            // Require 3 to 5 words separated by hyphens
            const parts = videoForm.slug.split('-');
            const isAllLetters = parts.every(p => /^[a-z0-9]+$/.test(p));
            if (!isAllLetters || parts.length < 3 || parts.length > 5) {
                slugError.value = 'Slug 必须包含3-5个英文或数字关键词，用连字符拼接';
                return false;
            }
            slugError.value = '';
            return true;
        };

        // Watch for manual changes
        watch(() => videoForm.slug, () => {
            if (videoForm.slug) {
                // Auto format to lowercase and replace non-alphanumeric with hyphens
                const cleaned = videoForm.slug.toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-');
                if (cleaned !== videoForm.slug) {
                    videoForm.slug = cleaned;
                }
            }
            validateSlug();
        });

        const generateTagsLoading = ref(false);

        const generateTags = async () => {
            if (!videoForm.title) return ElementPlus.ElMessage.warning('请先填写标题');
            
            generateTagsLoading.value = true;
            
            // Set up AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
            
            try {
                const res = await fetch('/api/tools/video/tags', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ title: videoForm.title, description: videoForm.description }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                const data = await res.json();
                
                if (data.success && Array.isArray(data.data)) {
                    const newTags = data.data.map(t => t.name);
                    videoForm.tags = [...new Set([...videoForm.tags, ...newTags])];
                    ElementPlus.ElMessage.success('标签生成成功');
                } else throw new Error(data.error);
            } catch (e) {
                clearTimeout(timeoutId);
                if (e.name === 'AbortError') {
                    ElementPlus.ElMessage.error('生成超时(30秒)，请重试');
                } else {
                    ElementPlus.ElMessage.error(e.message || '生成失败');
                }
            } finally {
                generateTagsLoading.value = false;
            }
        };

        const parseDuration = async () => {
            if (!videoForm.videoUrl) return ElementPlus.ElMessage.warning('请先提供视频URL或上传视频');
            try {
                const res = await fetch('/api/tools/video/parse-metadata', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ videoUrl: videoForm.videoUrl })
                });
                const data = await res.json();
                if (data.success) {
                    videoForm.duration = data.data.duration;
                    videoForm.durationSeconds = data.data.durationSeconds;
                    ElementPlus.ElMessage.success('时长解析成功');
                } else throw new Error(data.error);
            } catch (e) {
                ElementPlus.ElMessage.error(e.message || '解析失败');
            }
        };

        // --- Authors Search ---
        const loadAuthors = async () => {
            try {
                const res = await fetch(`/api/authors/search`, { headers: authHeaders() });
                const data = await res.json();
                if (data.success) {
                    authors.value = data.data;
                }
            } catch (e) {
                console.error('获取专家列表失败', e);
            }
        };

        const generateSEOLoading = ref(false);

        const generateSEO = async () => {
            if (!videoForm.title) return ElementPlus.ElMessage.warning('请先填写视频标题');
            
            // Auto fill metaTitle with video title if it's currently empty
            if (!videoForm.metaTitle) {
                videoForm.metaTitle = videoForm.title;
            }
            
            generateSEOLoading.value = true;
            
            // Set up AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

            try {
                const res = await fetch('/api/tools/video/seo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ 
                        title: videoForm.title, 
                        description: videoForm.description,
                        content: videoForm.content
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                const data = await res.json();
                
                if (data.success && data.data) {
                    videoForm.metaTitle = data.data.metaTitle || videoForm.metaTitle;
                    videoForm.metaDescription = data.data.metaDescription || videoForm.metaDescription;
                    videoForm.geoSummary = data.data.geoSummary || videoForm.geoSummary;
                    
                    if (data.data.seoKeywords && Array.isArray(data.data.seoKeywords)) {
                        videoForm.seoKeywords = [...new Set([...videoForm.seoKeywords, ...data.data.seoKeywords])];
                    }
                    ElementPlus.ElMessage.success('SEO & GEO 智能生成成功');
                } else throw new Error(data.error);
            } catch (e) {
                clearTimeout(timeoutId);
                if (e.name === 'AbortError') {
                    ElementPlus.ElMessage.error('生成超时(30秒)，请重试');
                } else {
                    ElementPlus.ElMessage.error(e.message || '生成失败');
                }
            } finally {
                generateSEOLoading.value = false;
            }
        };

        const generateFaq = async () => {
            if (!videoForm.title) return ElementPlus.ElMessage.warning('请先填写视频标题');
            generateFaqLoading.value = true;
            
            // Set up AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
            
            try {
                const res = await fetch('/api/tools/qa', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ 
                        title: videoForm.title, 
                        content: videoForm.content || videoForm.description || ''
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                const data = await res.json();
                
                if (data.qa && Array.isArray(data.qa)) {
                    if (!videoForm.faqs) videoForm.faqs = [];
                    videoForm.faqs = [...videoForm.faqs, ...data.qa];
                    ElementPlus.ElMessage.success('FAQ 生成成功');
                } else throw new Error(data.error || '返回格式错误');
            } catch (e) {
                clearTimeout(timeoutId);
                if (e.name === 'AbortError') {
                    ElementPlus.ElMessage.error('生成超时(30秒)，请重试');
                } else {
                    ElementPlus.ElMessage.error(e.message || '生成FAQ失败');
                }
            } finally {
                generateFaqLoading.value = false;
            }
        };

        const addVideoFaq = () => {
            if (!videoForm.faqs) videoForm.faqs = [];
            videoForm.faqs.push({ question: '', answer: '' });
        };

        const removeVideoFaq = (index) => {
            if (videoForm.faqs) {
                videoForm.faqs.splice(index, 1);
            }
        };

        // --- Thumbnail Upload ---
        const handleThumbnailUpload = (res) => {
            if (res.success) {
                videoForm.thumbnail = res.url;
                videoForm.thumbnailAlt = videoForm.title || 'Video Thumbnail';
                ElementPlus.ElMessage.success('上传成功');
            } else {
                ElementPlus.ElMessage.error(res.error || '上传失败');
            }
        };

        const handleVideoUpload = (res) => {
            if (res.success) {
                videoForm.videoUrl = res.url;
                ElementPlus.ElMessage.success('视频上传成功，正在解析时长...');
                parseDuration();
            } else {
                ElementPlus.ElMessage.error(res.error || '上传失败');
            }
        };

        onMounted(() => {
            loadCategories();
            loadVideos();
            loadAuthors();
            document.addEventListener('fullscreenchange', syncFullscreenState);
            document.addEventListener('webkitfullscreenchange', syncFullscreenState);
            document.addEventListener('mozfullscreenchange', syncFullscreenState);
            document.addEventListener('MSFullscreenChange', syncFullscreenState);
            window.addEventListener('keydown', handleFullscreenKeydown);
        });

        onUnmounted(() => {
            document.removeEventListener('fullscreenchange', syncFullscreenState);
            document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
            document.removeEventListener('mozfullscreenchange', syncFullscreenState);
            document.removeEventListener('MSFullscreenChange', syncFullscreenState);
            window.removeEventListener('keydown', handleFullscreenKeydown);
            clearTimeout(fullscreenHintTimer);
        });

        return {
            activeTab, videos, categories, treeCategories, loading, total, page, limit, searchQuery,
            videoModalVisible, categoryModalVisible, embedModalVisible, videoForm, categoryForm, embedForm, authors,
            enableThreeColumnEditor, seoScoreLoading, seoScoreResult, faqLoading, faqList,
            editorWorkspaceRef, isBrowserFullscreen, showFullscreenHint, fullscreenHintText, toggleBrowserFullscreen, workspaceStyle, brandColor,
            editorRef, toolbarRef, generateFaqLoading, generateSEOLoading, generateTagsLoading,
            loadCategories, saveCategory, deleteCategory, openCategoryModal,
            loadVideos, openVideoModal, saveVideo, deleteVideo, openEmbedModal, saveEmbedConfig,
            generateSlug, generateTags, parseDuration, generateSEO, generateFaq, addVideoFaq, removeVideoFaq, runSeoGeoScore, loadAuthors, handleThumbnailUpload, handleVideoUpload,
            slugError, validateSlug,
            uploadHeaders: computed(() => authHeaders())
        };
    },
    template: `
        <div class="video-app-container p-4 bg-white rounded shadow-sm">
            <el-tabs v-model="activeTab">
                <!-- Videos Tab -->
                <el-tab-pane label="视频管理" name="videos">
                    <div class="d-flex justify-content-between mb-3">
                        <div class="d-flex gap-2">
                            <el-input v-model="searchQuery.keyword" placeholder="搜索标题..." style="width: 200px"></el-input>
                            <el-select v-model="searchQuery.category" placeholder="全部分类" style="width: 150px" clearable>
                                <el-option v-for="cat in categories" :key="cat._id" :label="cat.labelName" :value="cat._id"></el-option>
                            </el-select>
                            <el-button type="primary" @click="loadVideos">查询</el-button>
                        </div>
                        <el-button type="success" @click="openVideoModal(null)"><el-icon><Plus /></el-icon> 新增视频</el-button>
                    </div>
                    
                    <el-table :data="videos" v-loading="loading" border style="width: 100%">
                        <el-table-column prop="title" label="视频信息" min-width="200">
                            <template #default="{row}">
                                <div class="d-flex align-items-center">
                                    <el-image :src="row.thumbnail" style="width: 80px; height: 45px; border-radius: 4px; margin-right: 10px;" fit="cover"></el-image>
                                    <div>
                                        <div class="fw-bold text-truncate" style="max-width: 200px" :title="row.title">
                                            <el-tag v-if="row.isRecommended" size="small" type="warning" effect="dark" class="me-1">荐</el-tag>
                                            {{ row.title }}
                                        </div>
                                        <div class="text-muted small">{{ row.slug }}</div>
                                    </div>
                                </div>
                            </template>
                        </el-table-column>
                        <el-table-column label="分类" width="120">
                            <template #default="{row}">
                                <span v-if="row.videoCategories && row.videoCategories.length">{{ row.videoCategories.length }} 个分类</span>
                                <span v-else>{{ row.category || '-' }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="status" label="状态" width="100">
                            <template #default="{row}">
                                <el-tag :type="row.status === 'published' ? 'success' : (row.status === 'draft' ? 'info' : 'warning')">
                                    {{ row.status === 'published' ? '已发布' : (row.status === 'draft' ? '草稿' : '归档') }}
                                </el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column prop="views" label="浏览" width="80"></el-table-column>
                        <el-table-column label="操作" width="220" fixed="right">
                            <template #default="{row}">
                                <el-button size="small" @click="openVideoModal(row)">编辑</el-button>
                                <el-button size="small" type="primary" plain @click="openEmbedModal(row)">嵌入配置</el-button>
                                <el-button size="small" type="danger" @click="deleteVideo(row._id)">删除</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                    
                    <div class="mt-3 d-flex justify-content-end">
                        <el-pagination v-model:current-page="page" v-model:page-size="limit" :total="total" layout="total, prev, pager, next" @current-change="loadVideos"></el-pagination>
                    </div>
                </el-tab-pane>

                <!-- Categories Tab -->
                <el-tab-pane label="分类体系" name="categories">
                    <div class="mb-3">
                        <el-button type="primary" @click="openCategoryModal(null)"><el-icon><Plus /></el-icon> 添加主分类</el-button>
                    </div>
                    <el-tree :data="treeCategories" node-key="_id" default-expand-all :expand-on-click-node="false">
                        <template #default="{ node, data }">
                            <div class="custom-tree-node d-flex justify-content-between align-items-center w-100 pe-3">
                                <span>{{ data.name }} <span class="text-muted small ms-2">/{{ data.seoTitle || data.name }}/</span></span>
                                <span>
                                    <el-button link type="primary" size="small" @click="openCategoryModal(data)">添加子类</el-button>
                                    <el-button link type="success" size="small" @click="openCategoryModal(null, data)">编辑</el-button>
                                    <el-button link type="danger" size="small" @click="deleteCategory(node, data)">删除</el-button>
                                </span>
                            </div>
                        </template>
                    </el-tree>
                </el-tab-pane>
            </el-tabs>

            <el-dialog v-model="videoModalVisible" fullscreen destroy-on-close top="2vh" class="video-workbench-fullscreen">
                <template #header>
                    <div class="d-flex align-items-center justify-content-between w-100 pe-3">
                        <div class="d-flex align-items-center">
                            <div class="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 36px; height: 36px;">
                                <i class="bi bi-camera-video"></i>
                            </div>
                            <div>
                                <div class="fw-bold">视频创作工作台</div>
                                <small class="text-secondary">三栏发布模式（仅视频模块生效）</small>
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <el-button @click="toggleBrowserFullscreen" :style="{ borderColor: brandColor, color: '#0f172a' }">
                                <i class="bi me-1" :class="isBrowserFullscreen ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'"></i>
                                {{ isBrowserFullscreen ? '退出全屏' : '全屏' }}
                            </el-button>
                            <el-button @click="videoModalVisible = false" :style="{ borderColor: brandColor }">关闭</el-button>
                            <el-button type="primary" @click="saveVideo" :style="{ background: brandColor, borderColor: brandColor, color: '#ffffff' }"><i class="bi bi-send me-1"></i>发布视频</el-button>
                        </div>
                    </div>
                </template>
                <div class="container-fluid p-0" ref="editorWorkspaceRef" :style="workspaceStyle">
                    <div v-if="showFullscreenHint" class="px-3 pt-2">
                        <el-alert :title="fullscreenHintText" type="info" show-icon :closable="false"></el-alert>
                    </div>
                    <div class="px-3 px-xl-4 pt-2 pb-2 border-bottom" :style="{ background: '#edfdff', borderColor: brandColor + '55' }">
                        <div class="row justify-content-center">
                            <div class="col-12 col-xl-8">
                                <div class="d-flex align-items-center gap-2">
                                    <el-upload action="/api/upload" :headers="uploadHeaders" :show-file-list="false" :on-success="handleVideoUpload" accept="video/*">
                                        <el-button :style="{ background: brandColor, borderColor: brandColor, color: '#ffffff' }">上传视频源</el-button>
                                    </el-upload>
                                    <el-input v-model="videoForm.videoUrl" placeholder="请输入视频源链接（位于顶部中央）"></el-input>
                                    <el-button @click="parseDuration" :style="{ borderColor: brandColor, color: '#0f172a' }">提取时长</el-button>
                                    <el-input v-model="videoForm.duration" placeholder="00:00" style="max-width: 110px;"></el-input>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="row g-0" style="min-height: calc(100vh - 170px);">
                        <div class="col-12 col-xl-3 border-end" style="background: #f5fcfd;">
                            <div class="p-3 p-xl-4 h-100 overflow-auto">
                                <div class="mb-3">
                                    <div class="text-secondary fw-bold small text-uppercase mb-2">GEO (生成式引擎优化) / SEO 评分</div>
                                    <div class="card border-light shadow-sm">
                                        <div class="card-body">
                                            <div class="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <div class="small text-muted">总分</div>
                                                    <div class="fs-3 fw-bold text-primary">{{ seoScoreResult.total || 0 }}</div>
                                                </div>
                                                <el-button :loading="seoScoreLoading" type="primary" plain @click="runSeoGeoScore" :style="{ borderColor: brandColor, color: '#0f172a', background: '#ecfcff' }">
                                                    <el-icon class="me-1"><Cpu /></el-icon>AI评分
                                                </el-button>
                                            </div>
                                            <div class="small text-muted mb-2">SEO：{{ seoScoreResult.seo || 0 }} / GEO：{{ seoScoreResult.geo || 0 }}</div>
                                            <div class="small text-success mb-2" v-if="seoScoreResult.level">评级：{{ seoScoreResult.level }}</div>
                                            <div class="small text-secondary" v-if="seoScoreResult.summary">{{ seoScoreResult.summary }}</div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div class="text-secondary fw-bold small text-uppercase mb-2">优化建议</div>
                                    <div class="card border-light shadow-sm">
                                        <div class="card-body">
                                            <div v-if="!seoScoreResult.suggestions || seoScoreResult.suggestions.length === 0" class="text-muted small">
                                                点击 AI评分 生成 GEO(生成式引擎优化) / SEO 建议
                                            </div>
                                            <div v-else class="d-flex flex-column gap-2">
                                                <div v-for="(item, idx) in seoScoreResult.suggestions" :key="idx" class="p-2 rounded bg-light border">
                                                    <div class="small fw-bold text-dark">{{ item.title || ('建议 ' + (idx + 1)) }}</div>
                                                    <div class="small text-secondary">{{ item.suggestion || item }}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-xl-6 border-end" style="background:#ffffff;">
                            <div class="p-3 p-xl-4 h-100 overflow-auto">
                                <div class="text-secondary fw-bold small text-uppercase mb-3">内容编辑</div>
                                <el-form :model="videoForm" label-position="top">
                                    <el-form-item label="视频标题" required>
                                        <el-input v-model="videoForm.title" placeholder="请输入视频标题"></el-input>
                                    </el-form-item>
                                    <el-row :gutter="12">
                                        <el-col :span="12">
                                            <el-form-item label="所属分类">
                                                <el-select v-model="videoForm.videoCategories" multiple placeholder="选择分类" style="width: 100%">
                                                    <el-option v-for="cat in categories" :key="cat._id" :label="cat.labelName" :value="cat._id"></el-option>
                                                </el-select>
                                            </el-form-item>
                                        </el-col>
                                        <el-col :span="12">
                                            <el-form-item label="状态">
                                                <el-select v-model="videoForm.status" style="width: 100%">
                                                    <el-option label="已发布" value="published"></el-option>
                                                    <el-option label="草稿" value="draft"></el-option>
                                                    <el-option label="归档" value="archived"></el-option>
                                                </el-select>
                                            </el-form-item>
                                        </el-col>
                                    </el-row>
                                    <el-form-item label="视频简介">
                                        <el-input type="textarea" v-model="videoForm.description" rows="4" placeholder="输入视频简介"></el-input>
                                    </el-form-item>
                                    <el-form-item label="详细内容">
                                        <div style="border: 1px solid #dcdfe6; border-radius: 4px; z-index: 100; width: 100%;">
                                            <div ref="toolbarRef" style="border-bottom: 1px solid #dcdfe6;"></div>
                                            <div ref="editorRef" style="height: 400px; overflow-y: hidden;"></div>
                                        </div>
                                    </el-form-item>
                                    
                                    <el-form-item label="AI 智能问答 (FAQ)">
                                        <div class="mb-2 w-100 d-flex justify-content-between align-items-center">
                                            <el-button type="primary" plain size="small" @click="generateFaq" :loading="generateFaqLoading" :disabled="generateFaqLoading" style="border-color:#7c4dff; color:#7c4dff; background:#f4f0ff;">
                                                <el-icon class="me-1"><MagicStick /></el-icon>{{ generateFaqLoading ? '生成中...' : '根据标题和内容生成 FAQ' }}
                                            </el-button>
                                            <el-button type="success" plain size="small" @click="addVideoFaq">
                                                <el-icon class="me-1"><Plus /></el-icon>手动新增
                                            </el-button>
                                        </div>
                                        
                                        <div v-if="videoForm.faqs && videoForm.faqs.length > 0" class="w-100 d-flex flex-column gap-3 mt-2">
                                            <el-card v-for="(faq, index) in videoForm.faqs" :key="index" shadow="never" class="position-relative" style="background: #faf9ff; border-color: #e4dcff;">
                                                <el-button type="danger" circle size="small" class="position-absolute" style="top: 10px; right: 10px; z-index: 10;" @click="removeVideoFaq(index)">
                                                    <el-icon><Delete /></el-icon>
                                                </el-button>
                                                <el-input v-model="faq.question" placeholder="问题标题" class="mb-2" style="width: 90%;">
                                                    <template #prepend>Q{{index + 1}}</template>
                                                </el-input>
                                                <el-input v-model="faq.answer" type="textarea" rows="3" placeholder="问题解答..."></el-input>
                                            </el-card>
                                        </div>
                                        <div v-else class="w-100 p-4 text-center text-muted bg-light border rounded">
                                            暂无 FAQ 数据
                                        </div>
                                    </el-form-item>
                                    <el-form-item label="智能标签">
                                        <div class="d-flex w-100">
                                            <el-select v-model="videoForm.tags" multiple filterable allow-create default-first-option placeholder="输入标签按回车" style="width: calc(100% - 88px);">
                                            </el-select>
                                            <el-button type="warning" plain @click="generateTags" :loading="generateTagsLoading" :disabled="generateTagsLoading" class="ms-2" style="width:100px; border-color:#7c4dff; color:#7c4dff; background:#f4f0ff;">
                                                <el-icon v-if="!generateTagsLoading"><Cpu /></el-icon>
                                                {{ generateTagsLoading ? '生成中...' : '生成' }}
                                            </el-button>
                                        </div>
                                    </el-form-item>
                                    <el-form-item>
                                        <el-checkbox v-model="videoForm.isRecommended">设为推荐视频</el-checkbox>
                                        <el-checkbox v-model="videoForm.showProductivityAd" class="ms-4">显示"组织人效体检"广告位</el-checkbox>
                                    </el-form-item>
                                </el-form>
                            </div>
                        </div>
                        <div class="col-12 col-xl-3 bg-body">
                            <div class="p-3 p-xl-4 h-100 overflow-auto">
                                <div class="text-secondary fw-bold small text-uppercase mb-3">发布与优化配置</div>
                                <div class="card border-light shadow-sm mb-3">
                                    <div class="card-body">
                                        <el-form :model="videoForm" label-position="top">
                                            <el-form-item label="自定义 URL (Slug)" :error="slugError">
                                                <el-input v-model="videoForm.slug" placeholder="如 ai-basics-tutorial" @input="validateSlug" @blur="validateSlug">
                                                    <template #append>
                                                        <el-button @click="generateSlug"><el-icon><MagicStick /></el-icon></el-button>
                                                    </template>
                                                </el-input>
                                            </el-form-item>
                                            <el-form-item label="SEO 元标题">
                                                <el-input v-model="videoForm.metaTitle" maxlength="60" show-word-limit></el-input>
                                            </el-form-item>
                                            <el-form-item label="SEO 元描述">
                                                <el-input type="textarea" v-model="videoForm.metaDescription" rows="3" maxlength="160" show-word-limit></el-input>
                                            </el-form-item>
                                            <el-form-item label="SEO 核心关键词">
                                                <el-select v-model="videoForm.seoKeywords" multiple filterable allow-create default-first-option placeholder="输入后回车" style="width: 100%">
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item>
                                                <template #label>
                                                    GEO 智能摘要
                                                    <el-tooltip content="用于中国大模型检索与答案生成语义召回" placement="top">
                                                        <el-icon class="ms-1" style="color: #909399;"><QuestionFilled /></el-icon>
                                                    </el-tooltip>
                                                </template>
                                                <el-input type="textarea" v-model="videoForm.geoSummary" rows="4" placeholder="输入GEO摘要"></el-input>
                                            </el-form-item>
                                            <el-button type="primary" plain style="width:100%; border-color:#7c4dff; color:#7c4dff; background:#f4f0ff;" @click="generateSEO" :loading="generateSEOLoading" :disabled="generateSEOLoading">
                                                <el-icon v-if="!generateSEOLoading" class="me-1"><MagicStick /></el-icon>
                                                {{ generateSEOLoading ? '生成中...' : 'AI生成SEO/GEO' }}
                                            </el-button>
                                        </el-form>
                                    </div>
                                </div>
                                <div class="card border-light shadow-sm">
                                    <div class="card-body">
                                        <el-form :model="videoForm" label-position="top">
                                            <el-form-item label="缩略图">
                                                <el-upload class="avatar-uploader" action="/api/upload" :headers="uploadHeaders" :show-file-list="false" :on-success="handleThumbnailUpload" accept="image/*">
                                                    <img v-if="videoForm.thumbnail" :src="videoForm.thumbnail" class="avatar" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px;" />
                                                    <el-icon v-else class="avatar-uploader-icon" style="width: 100%; height: 120px; border: 1px dashed #d9d9d9; border-radius: 4px; display: flex; align-items: center; justify-content: center;"><Plus /></el-icon>
                                                </el-upload>
                                                <div class="text-muted small mt-1">建议尺寸比例 16:9 (如 1280x720 像素)，支持 jpg/png 格式。</div>
                                            </el-form-item>
                                            <el-form-item label="视频时长">
                                                <div class="d-flex w-100">
                                                    <el-input v-model="videoForm.duration" placeholder="00:00"></el-input>
                                                    <el-button class="ms-2" @click="parseDuration">提取</el-button>
                                                </div>
                                            </el-form-item>
                                            <el-form-item label="关联专家">
                                                <el-select v-model="videoForm.speaker" clearable filterable placeholder="请选择专家" style="width: 100%">
                                                    <el-option v-for="item in authors" :key="item._id" :label="item.name" :value="item._id">
                                                        <div class="d-flex align-items-center">
                                                            <el-avatar :size="24" :src="item.avatar" class="me-2"></el-avatar>
                                                            <span>{{ item.name }}</span>
                                                        </div>
                                                    </el-option>
                                                </el-select>
                                            </el-form-item>
                                        </el-form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </el-dialog>

            <!-- Category Edit Modal -->
            <el-dialog v-model="categoryModalVisible" :title="categoryForm._id ? '编辑分类' : '新增分类'" width="500px">
                <el-form :model="categoryForm" label-width="100px">
                    <el-form-item label="分类名称" required>
                        <el-input v-model="categoryForm.name"></el-input>
                    </el-form-item>
                    <el-form-item label="排序">
                        <el-input-number v-model="categoryForm.order" :min="0"></el-input-number>
                    </el-form-item>
                    <el-form-item label="SEO 标题">
                        <el-input v-model="categoryForm.seoTitle"></el-input>
                    </el-form-item>
                    <el-form-item label="分类描述">
                        <el-input type="textarea" v-model="categoryForm.description" rows="3"></el-input>
                    </el-form-item>
                </el-form>
                <template #footer>
                    <span class="dialog-footer">
                        <el-button @click="categoryModalVisible = false">取消</el-button>
                        <el-button type="primary" @click="saveCategory">保存</el-button>
                    </span>
                </template>
            </el-dialog>

            <!-- Embed Config Modal -->
            <el-dialog v-model="embedModalVisible" title="视频嵌入配置" width="800px" destroy-on-close>
                <el-alert title="注意：配置保存后，将自动对 TOS 鉴权 URL 和 CDN 缓存进行刷新，预计 30s 内全网生效。" type="info" show-icon class="mb-4"></el-alert>
                <el-form :model="embedForm" label-width="120px">
                    <el-form-item label="视频名称">
                        <strong>{{ embedForm.videoTitle }}</strong>
                    </el-form-item>
                    <el-form-item label="TOS 视频链接" required>
                        <el-input v-model="embedForm.embed_url" placeholder="如 https://ruihuaconsulting.tos-cn-shanghai.volces.com/andi01.mp4"></el-input>
                        <div class="text-muted small mt-1">系统会在保存前发送 HEAD 请求进行预检，必须为可访问的 video 类型文件。</div>
                    </el-form-item>
                    
                    <div class="el-divider el-divider--horizontal my-4"></div>
                    <h6 class="mb-3 fw-bold">播放器参数配置</h6>
                    
                    <el-row :gutter="20">
                        <el-col :span="8">
                            <el-form-item label="自动播放">
                                <el-switch v-model="embedForm.embed_settings.autoplay"></el-switch>
                            </el-form-item>
                        </el-col>
                        <el-col :span="8">
                            <el-form-item label="循环播放">
                                <el-switch v-model="embedForm.embed_settings.loop"></el-switch>
                            </el-form-item>
                        </el-col>
                        <el-col :span="8">
                            <el-form-item label="预加载策略">
                                <el-select v-model="embedForm.embed_settings.preload" style="width: 100%">
                                    <el-option label="自动 (Auto)" value="auto"></el-option>
                                    <el-option label="仅元数据 (Metadata)" value="metadata"></el-option>
                                    <el-option label="不预加载 (None)" value="none"></el-option>
                                </el-select>
                            </el-form-item>
                        </el-col>
                    </el-row>
                    
                    <el-form-item label="自定义水印">
                        <el-input v-model="embedForm.embed_settings.watermark" placeholder="输入水印文字或图片URL"></el-input>
                    </el-form-item>
                </el-form>
                <template #footer>
                    <span class="dialog-footer">
                        <el-button @click="embedModalVisible = false">取消</el-button>
                        <el-button type="primary" @click="saveEmbedConfig">保存配置</el-button>
                    </span>
                </template>
            </el-dialog>
        </div>
    `
};

// Register Vue App
let videoAppMounted = false;

function mountVideoApp() {
    if (videoAppMounted) return;
    
    // Check dependencies
    if (typeof Vue === 'undefined' || typeof ElementPlus === 'undefined') {
        console.warn('Vue or ElementPlus not loaded yet, retrying...');
        setTimeout(mountVideoApp, 200);
        return;
    }

    const mountPoint = document.getElementById('videoApp');
    if (!mountPoint) {
        console.warn('#videoApp element not found, retrying...');
        setTimeout(mountVideoApp, 200);
        return;
    }

    try {
        const app = Vue.createApp(VideoApp);
        app.use(ElementPlus);
        // Register icons
        if (typeof ElementPlusIconsVue !== 'undefined') {
            for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
                app.component(key, component);
            }
        }
        app.mount('#videoApp');
        videoAppMounted = true;
        console.log('Video Vue App Mounted successfully.');
    } catch (e) {
        console.error('Failed to mount Video App:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 轮询检查依赖是否加载完毕
    const checkLibs = setInterval(() => {
        if (window.Vue && window.ElementPlus && window.ElementPlusIconsVue) {
            clearInterval(checkLibs);
            mountVideoApp();
        }
    }, 100);
});

// Expose to window so router.js can trigger reload if needed
window.mountVideoApp = mountVideoApp;
})();
