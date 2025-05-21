const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

const app = createApp({
    setup() {
        // 初始化 PDF.js
        if (window.pdfjsLib) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
        }

        const config = reactive({
            platform: 'github',
            owner: '',
            repo: '',
            branch: 'main',
            token: ''
        });
        const configError = ref('');
        const configLoaded = ref(false);
        const showConfigModal = ref(false);

        const currentPath = ref('');
        const files = ref([]);
        const isLoading = ref(false);
        const apiError = ref('');
        
        const currentView = ref('list'); // 'list' or 'grid'
        const toggleView = () => {
            currentView.value = currentView.value === 'list' ? 'grid' : 'list';
            localStorage.setItem('preferredView', currentView.value);
        };

        const searchQuery = ref('');
        const searchResults = ref([]);
        const isSearchActive = ref(false);
        const isSearching = ref(false);
        
        const showUploadModal = ref(false);
        const fileToUpload = ref(null);
        const uploadFileName = ref('');
        const commitMessage = ref('');
        const isUploading = ref(false);
        const uploadError = ref('');
        const uploadProgress = ref(0);
        const uploadInProgress = ref(false);
        const isDragging = ref(false);
        const fileExists = ref(false);
        const conflictResolution = ref('rename'); // 'rename' or 'overwrite'

        const showFolderModal = ref(false);
        const newFolderName = ref('');
        const folderCommitMessage = ref('创建新文件夹');
        const isCreatingFolder = ref(false);
        const folderError = ref('');

        const showDeleteModal = ref(false);
        const itemToDelete = ref(null);
        const deleteCommitMessage = ref('');
        const isDeleting = ref(false);
        const deleteError = ref('');

        const showFilePreview = ref(false);
        const previewItemName = ref('');
        const previewItem = ref(null);
        const previewContent = ref('');
        const previewType = ref('');
        const previewLanguage = ref('');
        const previewLoading = ref(false);
        const previewError = ref('');

        const pdfDocument = ref(null);
        const pdfCurrentPage = ref(1);
        const pdfTotalPages = ref(0);
        const pdfScale = ref(1.5);

        const notification = reactive({
            show: false,
            message: '',
            type: 'info', // 'info', 'success', 'error', 'warning'
            timeout: null
        });

        const GITHUB_API_BASE = 'https://api.github.com';
        const GITEE_API_BASE = 'https://gitee.com/api/v5';

        const apiBaseUrl = computed(() => {
            return config.platform === 'github' ? GITHUB_API_BASE : GITEE_API_BASE;
        });

        const headers = computed(() => {
            const h = {
                'Accept': 'application/vnd.github.v3+json', // For GitHub
            };
            if (config.token) {
                h['Authorization'] = `token ${config.token}`;
            }
            return h;
        });
        
        const currentPathParts = computed(() => {
            return currentPath.value.split('/').filter(p => p !== '');
        });

        const displayedFiles = computed(() => {
            return isSearchActive.value ? searchResults.value : files.value;
        });

        function getPathForBreadcrumb(index) {
            return '/' + currentPathParts.value.slice(0, index + 1).join('/');
        }

        function loadConfig() {
            const storedConfig = localStorage.getItem('learningSiteConfig');
            const storedView = localStorage.getItem('preferredView');
            
            if (storedView && ['list', 'grid'].includes(storedView)) {
                currentView.value = storedView;
            }
            
            if (storedConfig) {
                try {
                    const parsedConfig = JSON.parse(storedConfig);
                    Object.assign(config, parsedConfig);
                    // 基本验证
                    if (config.owner && config.repo) {
                         configLoaded.value = true;
                         return true;
                    } else {
                        configError.value = "本地配置无效，请重新填写。";
                        showConfigModal.value = true;
                        return false;
                    }
                } catch (e) {
                    console.error("解析本地配置失败:", e);
                    localStorage.removeItem('learningSiteConfig');
                    configError.value = "解析本地配置失败，请重新配置。";
                    showConfigModal.value = true;
                    return false;
                }
            } else {
                showConfigModal.value = true; // 如果没有找到配置则显示配置界面
                return false;
            }
        }

        function saveConfig() {
            if (!config.owner || !config.repo || !config.token) {
                configError.value = "用户名、仓库名和 PAT 不能为空。";
                return false;
            }
            localStorage.setItem('learningSiteConfig', JSON.stringify(config));
            configError.value = ''; // 清除之前的错误信息
            configLoaded.value = true;
            return true;
        }
        
        async function saveConfigAndLoadFiles() {
            if (saveConfig()) {
                showConfigModal.value = false;
                await fetchDirectoryContents('/'); // 保存后加载根目录
                showNotification('配置已保存', 'success');
            }
        }

        function resetConfig() {
            localStorage.removeItem('learningSiteConfig');
            Object.assign(config, { platform: 'github', owner: '', repo: '', branch: 'main', token: '' });
            configLoaded.value = false;
            showConfigModal.value = true;
            files.value = [];
            currentPath.value = '';
            configError.value = "配置已重置，请重新填写。";
        }

        async function fetchDirectoryContents(path = '') {
            if (!configLoaded.value || !config.owner || !config.repo) {
                apiError.value = "仓库配置不完整，请先设置。";
                showConfigModal.value = true;
                return;
            }
            isLoading.value = true;
            apiError.value = '';
            files.value = []; // 清除之前的文件
            currentPath.value = path.startsWith('/') ? path : `/${path}`;
            if (currentPath.value === '/') currentPath.value = ''; // API 期望根目录为空

            let url = `${apiBaseUrl.value}/repos/${config.owner}/${config.repo}/contents${currentPath.value}`;
            if (config.branch) {
                url += `?ref=${config.branch}`;
            }

            try {
                const response = await axios.get(url, { headers: headers.value });
                
                // 获取提交历史以获取最后修改日期
                await Promise.all(response.data.map(async (item) => {
                    if (item.type === 'file') {
                        try {
                            // 获取文件的最后提交
                            const commitsUrl = `${apiBaseUrl.value}/repos/${config.owner}/${config.repo}/commits`;
                            const params = {
                                path: item.path,
                                per_page: 1
                            };
                            if (config.branch) {
                                params.sha = config.branch;
                            }
                            
                            const commitsResponse = await axios.get(commitsUrl, { 
                                headers: headers.value,
                                params: params
                            });
                            
                            if (commitsResponse.data && commitsResponse.data.length > 0) {
                                const commitDate = parseCommitDate(commitsResponse.data[0]);
                                if (commitDate) {
                                    item.lastModified = commitDate;
                                }
                            }
                        } catch (e) {
                            console.warn(`无法获取文件 ${item.name} 的提交历史`, e);
                        }
                    }
                }));
                
                files.value = response.data
                    .sort((a, b) => { // 排序：文件夹优先，然后按名称
                        if (a.type === 'dir' && b.type !== 'dir') return -1;
                        if (a.type !== 'dir' && b.type === 'dir') return 1;
                        return a.name.localeCompare(b.name);
                    });
            } catch (error) {
                console.error("获取目录内容失败:", error);
                if (error.response) {
                     apiError.value = handleApiError(error);
                     if (error.response.status === 401 || error.response.status === 403) {
                        configError.value = "PAT无效或权限不足。请检查仓库设置。";
                        showConfigModal.value = true;
                     }
                } else {
                    apiError.value = `加载文件列表失败: ${error.message}. 请检查网络连接和配置。`;
                }
            } finally {
                isLoading.value = false;
                // 如果是搜索状态，恢复到正常浏览状态
                if (isSearchActive.value) {
                    isSearchActive.value = false;
                    searchResults.value = [];
                    searchQuery.value = '';
                }
            }
        }

        async function searchFiles() {
            if (!searchQuery.value.trim()) {
                return;
            }
            
            isSearching.value = true;
            isSearchActive.value = true;
            searchResults.value = [];
            apiError.value = '';
            
            try {
                // 使用GitHub的Search API或递归查询目录
                if (config.platform === 'github') {
                    // GitHub提供了搜索API
                    const searchUrl = `${GITHUB_API_BASE}/search/code`;
                    const query = `${searchQuery.value} in:path repo:${config.owner}/${config.repo}`;
                    
                    const response = await axios.get(searchUrl, {
                        headers: headers.value,
                        params: {
                            q: query,
                            per_page: 100
                        }
                    });
                    
                    // 处理搜索结果
                    if (response.data.items && response.data.items.length > 0) {
                        // 获取每个文件的详细信息
                        const fileDetailsPromises = response.data.items.map(async (item) => {
                            try {
                                const fileUrl = `${apiBaseUrl.value}/repos/${config.owner}/${config.repo}/contents/${item.path}`;
                                const fileResponse = await axios.get(fileUrl, {
                                    headers: headers.value,
                                    params: { ref: config.branch }
                                });
                                return fileResponse.data;
                            } catch (e) {
                                console.warn(`无法获取文件 ${item.path} 的详细信息`, e);
                                return null;
                            }
                        });
                        
                        const fileDetails = await Promise.all(fileDetailsPromises);
                        searchResults.value = fileDetails.filter(item => item !== null);
                    }
                } else {
                    // Gitee没有专门的搜索API，需要递归遍历目录
                    searchResults.value = await recursiveSearch('', searchQuery.value);
                }
                
                if (searchResults.value.length === 0) {
                    showNotification(`没有找到匹配 "${searchQuery.value}" 的文件`, 'info');
                } else {
                    showNotification(`找到 ${searchResults.value.length} 个匹配结果`, 'success');
                }
            } catch (error) {
                console.error("搜索文件失败:", error);
                apiError.value = `搜索失败: ${error.response?.data?.message || error.message}`;
                showNotification('搜索出错，请重试', 'error');
            } finally {
                isSearching.value = false;
            }
        }
        
        // 递归搜索目录（用于Gitee或GitHub的深度搜索）
        async function recursiveSearch(path, query, results = []) {
            try {
                const url = `${apiBaseUrl.value}/repos/${config.owner}/${config.repo}/contents${path}`;
                const response = await axios.get(url, {
                    headers: headers.value,
                    params: { ref: config.branch }
                });
                
                const items = response.data;
                
                // 检查当前目录中的文件
                for (const item of items) {
                    if (item.type === 'file' && item.name.toLowerCase().includes(query.toLowerCase())) {
                        results.push(item);
                    } else if (item.type === 'dir') {
                        // 递归搜索子目录
                        await recursiveSearch(`${path}/${item.name}`, query, results);
                    }
                }
                
                return results;
            } catch (error) {
                console.warn(`搜索路径 ${path} 失败:`, error);
                return results;
            }
        }
        
        function clearSearch() {
            isSearchActive.value = false;
            searchResults.value = [];
            searchQuery.value = '';
        }

        function navigateToPath(path) {
            fetchDirectoryContents(path);
        }

        function goUp() {
            if (currentPath.value === '' || currentPath.value === '/') return;
            const parts = currentPath.value.split('/').filter(p => p);
            parts.pop();
            navigateToPath('/' + parts.join('/'));
        }
        
        function handleItemClick(item) {
            if (item.type === 'dir') {
                navigateToPath(item.path);
            } else if (item.type === 'file') {
                openFilePreview(item);
            }
        }

        function resetUpload() {
            fileToUpload.value = null;
            uploadFileName.value = '';
            commitMessage.value = '';
            uploadError.value = '';
            fileExists.value = false;
        }

        function dragOverHandler(event) {
            isDragging.value = true;
        }
        
        function dragLeaveHandler(event) {
            isDragging.value = false;
        }
        
        function dropHandler(event) {
            isDragging.value = false;
            const droppedFile = event.dataTransfer.files[0];
            if (droppedFile) {
                prepareFileForUpload({ target: { files: [droppedFile] } });
            }
        }

        function prepareFileForUpload(event) {
            const selected = event.target.files[0];
            if (selected) {
                fileToUpload.value = selected;
                uploadFileName.value = selected.name;
                commitMessage.value = `上传 ${selected.name}`; // 默认提交信息
                uploadError.value = '';
                
                // 检查文件是否已存在
                checkFileExists(selected.name);
            }
        }
        
        async function checkFileExists(filename) {
            const filePath = (currentPath.value ? currentPath.value.substring(1) + '/' : '') + filename;
            
            try {
                const url = `${apiBaseUrl.value}/repos/${config.owner}/${config.repo}/contents/${filePath}`;
                await axios.get(url, {
                    headers: headers.value,
                    params: { ref: config.branch }
                });
                
                // 如果请求成功，表示文件存在
                fileExists.value = true;
                conflictResolution.value = 'rename'; // 默认选择重命名
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    // 文件不存在
                    fileExists.value = false;
                } else {
                    console.warn('检查文件是否存在时出错:', error);
                }
            }
        }
        
        async function uploadFile() {
            if (!fileToUpload.value) {
                uploadError.value = "请先选择一个文件。";
                return;
            }
            if (!commitMessage.value.trim()) {
                uploadError.value = "请输入提交信息。";
                return;
            }
            
            const finalFilename = uploadFileName.value || fileToUpload.value.name;
            
            // 处理文件名冲突
            let targetFilename = finalFilename;
            if (fileExists.value) {
                if (conflictResolution.value === 'rename') {
                    // 自动重命名文件
                    const ext = getFileExtension(finalFilename);
                    const baseName = finalFilename.substring(0, finalFilename.length - (ext.length ? ext.length + 1 : 0));
                    const timestamp = new Date().getTime();
                    targetFilename = `${baseName}_${timestamp}.${ext}`;
                }
            }

            isUploading.value = true;
            uploadError.value = '';
            uploadInProgress.value = true;
            uploadProgress.value = 0;

            try {
                // 模拟上传进度
                const progressInterval = setInterval(() => {
                    if (uploadProgress.value < 90) {
                        uploadProgress.value += Math.floor(Math.random() * 10) + 1;
                    }
                }, 200);
                
                const base64Content = await encodeFileAsBase64(fileToUpload.value);
                const filePath = (currentPath.value ? currentPath.value.substring(1) + '/' : '') + targetFilename;
                
                let url = `${apiBaseUrl.value}/repos/${config.owner}/${config.repo}/contents/${filePath}`;
                
                const payload = {
                    message: commitMessage.value,
                    content: base64Content,
                    branch: config.branch
                };

                // 检查文件是否存在以获取SHA（用于更新）
                if (fileExists.value && conflictResolution.value === 'overwrite') {
                    try {
                        const existingFile = await axios.get(url + `?ref=${config.branch}`, { headers: headers.value });
                        if (existingFile.data && existingFile.data.sha) {
                            payload.sha = existingFile.data.sha;
                        }
                    } catch (e) {
                        // 如果文件不存在，预期会返回404，不需要SHA
                        if (e.response && e.response.status !== 404) throw e;
                    }
                }

                const method = config.platform === 'github' ? 'put' : 'post'; // GitHub使用PUT，Gitee使用POST进行创建/更新

                await axios[method](url, payload, { headers: headers.value });
                
                clearInterval(progressInterval);
                uploadProgress.value = 100;
                
                // 显示一小段时间完成状态
                setTimeout(() => {
                    uploadInProgress.value = false;
                    showUploadModal.value = false;
                    resetUpload();
                    fetchDirectoryContents(currentPath.value); // 刷新列表
                    showNotification('文件上传成功', 'success');
                }, 500);
            } catch (error) {
                console.error("文件上传失败:", error);
                uploadError.value = `上传失败: ${error.response?.data?.message || error.message}`;
                uploadInProgress.value = false;
                showNotification('文件上传失败', 'error');
            } finally {
                isUploading.value = false;
            }
        }

        // 新建文件夹功能
        function createFolder() {
            showFolderModal.value = true;
            newFolderName.value = '';
            folderCommitMessage.value = '创建新文件夹';
            folderError.value = '';
        }
        
        async function confirmCreateFolder() {
            if (!newFolderName.value.trim()) {
                folderError.value = "请输入文件夹名称。";
                return;
            }
            
            // 移除文件夹名中的非法字符
            const sanitizedName = sanitizeFilename(newFolderName.value.trim());
            if (sanitizedName !== newFolderName.value) {
                newFolderName.value = sanitizedName;
                folderError.value = "文件夹名称包含非法字符，已自动替换。";
                return;
            }
            
            isCreatingFolder.value = true;
            folderError.value = '';
            
            try {
                // GitHub不支持直接创建空文件夹，需要创建一个占位文件
                const placeholderFilePath = `${currentPath.value ? currentPath.value.substring(1) + '/' : ''}${newFolderName.value}/.gitkeep`;
                const url = `${apiBaseUrl.value}/repos/${config.owner}/${config.repo}/contents/${placeholderFilePath}`;
                
                const payload = {
                    message: folderCommitMessage.value,
                    content: createPlaceholderContent(),
                    branch: config.branch
                };
                
                const method = config.platform === 'github' ? 'put' : 'post';
                await axios[method](url, payload, { headers: headers.value });
                
                showFolderModal.value = false;
                await fetchDirectoryContents(currentPath.value);
                showNotification(`文件夹 "${newFolderName.value}" 已创建`, 'success');
            } catch (error) {
                console.error("创建文件夹失败:", error);
                folderError.value = `创建失败: ${error.response?.data?.message || error.message}`;
                showNotification('创建文件夹失败', 'error');
            } finally {
                isCreatingFolder.value = false;
            }
        }
        
        // 文件删除功能
        function showDeleteConfirm(item) {
            itemToDelete.value = item;
            deleteCommitMessage.value = `删除 ${item.name}`;
            deleteError.value = '';
            showDeleteModal.value = true;
        }
        
        async function confirmDelete() {
            if (!itemToDelete.value) {
                return;
            }
            
            isDeleting.value = true;
            deleteError.value = '';
            
            try {
                const url = `${apiBaseUrl.value}/repos/${config.owner}/${config.repo}/contents/${itemToDelete.value.path}`;
                
                // 获取当前文件的SHA
                const fileResponse = await axios.get(url, {
                    headers: headers.value,
                    params: { ref: config.branch }
                });
                
                const sha = fileResponse.data.sha;
                
                // 删除文件
                await axios.delete(url, {
                    headers: headers.value,
                    data: {
                        message: deleteCommitMessage.value,
                        sha: sha,
                        branch: config.branch
                    }
                });
                
                showDeleteModal.value = false;
                await fetchDirectoryContents(currentPath.value);
                showNotification(`${itemToDelete.value.type === 'dir' ? '文件夹' : '文件'} "${itemToDelete.value.name}" 已删除`, 'success');
            } catch (error) {
                console.error("删除失败:", error);
                deleteError.value = `删除失败: ${error.response?.data?.message || error.message}`;
                showNotification('删除失败', 'error');
            } finally {
                isDeleting.value = false;
            }
        }
        
        // 文件下载功能
        function downloadFile(item) {
            if (!item || !item.download_url) {
                showNotification('无法下载，缺少下载链接', 'error');
                return;
            }
            
            // 防止点击事件传播导致错误行为
            if (event) {
                event.stopPropagation();
            }
            
            try {
                downloadFileFromUrl(item.download_url, item.name);
                showNotification(`已开始下载：${item.name}`, 'success');
            } catch (error) {
                console.error("下载失败:", error);
                showNotification('下载失败，请重试', 'error');
            }
        }

        // 文件预览
        async function openFilePreview(item) {
            previewItemName.value = item.name;
            previewItem.value = item;
            showFilePreview.value = true;
            previewLoading.value = true;
            previewError.value = '';
            previewContent.value = '';
            previewType.value = '';
            previewLanguage.value = '';
            
            // 重置PDF预览状态
            pdfDocument.value = null;
            pdfCurrentPage.value = 1;
            pdfTotalPages.value = 0;
            pdfScale.value = 1.5;

            const extension = getFileExtension(item.name);

            try {
                let url = `${apiBaseUrl.value}/repos/${config.owner}/${config.repo}/contents/${item.path}`;
                if (config.branch) {
                    url += `?ref=${config.branch}`;
                }
                
                const response = await axios.get(url, { 
                    headers: headers.value
                });

                const fileData = response.data;
                let contentToPreview = '';

                if (fileData.encoding === 'base64') {
                    contentToPreview = atob(fileData.content);
                } else {
                    contentToPreview = fileData.content || "无法解码文件内容或内容为空。";
                }

                if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) {
                    previewType.value = 'image';
                    previewContent.value = item.download_url || `data:image/${extension};base64,${fileData.content}`;
                } else if (extension === 'pdf') {
                    previewType.value = 'pdf';
                    const pdfUrl = item.download_url;
                    if (pdfUrl) {
                        try {
                            // 确保 PDF.js 已加载
                            if (!window.pdfjsLib) {
                                throw new Error('PDF.js library not loaded');
                            }

                            // 设置预览类型为PDF，确保DOM渲染PDF容器
                            previewType.value = 'pdf';
                            
                            // 等待DOM更新完成，确保PDF容器已渲染
                            await nextTick();
                            
                            // 显示加载状态
                            previewLoading.value = true;
                            
                            // 加载 PDF 文档
                            const loadingTask = pdfjsLib.getDocument({
                                url: pdfUrl,
                                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/cmaps/',
                                cMapPacked: true,
                            });

                            // 等待 PDF 加载完成
                            const pdf = await loadingTask.promise;
                            pdfDocument.value = pdf;
                            pdfTotalPages.value = pdf.numPages;
                            
                            // 再次等待 DOM 更新，确保 pdf-viewer 元素存在
                            await nextTick();
                            
                            // 检查并创建PDF查看器元素（如果不存在）
                            let pdfViewer = document.getElementById('pdf-viewer');
                            if (!pdfViewer) {
                                // 如果容器不存在，则创建一个
                                const pdfContainer = document.querySelector('.pdf-container');
                                if (pdfContainer) {
                                    pdfViewer = document.createElement('div');
                                    pdfViewer.id = 'pdf-viewer';
                                    pdfViewer.className = 'pdf-viewer';
                                    pdfContainer.appendChild(pdfViewer);
                                } else {
                                    // 确保预览内容区域存在
                                    const previewContent = document.querySelector('.preview-content');
                                    if (previewContent) {
                                        // 创建容器结构
                                        const pdfContainer = document.createElement('div');
                                        pdfContainer.className = 'pdf-container';
                                        
                                        pdfViewer = document.createElement('div');
                                        pdfViewer.id = 'pdf-viewer';
                                        pdfViewer.className = 'pdf-viewer';
                                        
                                        pdfContainer.appendChild(pdfViewer);
                                        previewContent.appendChild(pdfContainer);
                                    } else {
                                        throw new Error('预览内容区域不存在');
                                    }
                                }
                            }
                            
                            // 渲染当前页面
                            await renderPdfPage(pdfCurrentPage.value);
                            
                        } catch (pdfError) {
                            console.error('PDF预览错误:', pdfError);
                            previewError.value = `PDF 预览失败: ${pdfError.message}`;
                        }
                    } else {
                        throw new Error('PDF下载链接不可用');
                    }
                } else if (['mp4', 'webm', 'ogg', 'mov'].includes(extension)) {
                    // 视频预览
                    previewType.value = 'video';
                    previewContent.value = item.download_url;
                    
                    // 等待DOM更新，然后初始化Plyr播放器
                    await nextTick();
                    
                    try {
                        const videoPlayer = document.getElementById('video-player');
                        if (videoPlayer) {
                            // 初始化Plyr
                            new Plyr(videoPlayer, {
                                controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
                                autoplay: false
                            });
                        }
                    } catch (videoError) {
                        console.warn('视频播放器初始化失败:', videoError);
                    }
                } else if (extension === 'docx') {
                    previewType.value = 'docx';
                    // Mammoth.js需要ArrayBuffer，获取原始内容
                    const docxResponse = await axios.get(item.download_url, { responseType: 'arraybuffer' });
                    const result = await mammoth.convertToHtml({ arrayBuffer: docxResponse.data });
                    previewContent.value = result.value; // HTML内容
                } else if (extension === 'md') {
                    previewType.value = 'markdown';
                    // 使用Marked转换Markdown为HTML
                    previewContent.value = marked.parse(contentToPreview);
                } else if (['js', 'json', 'html', 'css', 'xml', 'py', 'rb', 'java', 'c', 'cpp', 'cs', 'php', 'sh', 'ts', 'go', 'swift', 'kt'].includes(extension)) {
                    previewType.value = 'code';
                    previewLanguage.value = extension === 'json' ? 'javascript' : extension;
                    
                    // 使用Prism.js代码高亮
                    const highlightedCode = Prism.highlight(
                        contentToPreview, 
                        Prism.languages[previewLanguage.value] || Prism.languages.markup, 
                        previewLanguage.value
                    );
                    previewContent.value = highlightedCode;
                } else if (['txt', 'log', 'csv', 'ini', 'yaml', 'yml'].includes(extension) || contentToPreview.length < 1024 * 5) {
                    previewType.value = 'text';
                    previewContent.value = contentToPreview;
                } else {
                    previewType.value = 'unsupported';
                    previewError.value = `不支持预览 .${extension} 文件。您可以下载此文件查看。`;
                }

            } catch (error) {
                console.error("获取/处理预览文件失败:", error);
                previewError.value = `预览文件失败: ${error.message}`;
            } finally {
                previewLoading.value = false;
                // 如果是代码且内容已更改，重新高亮
                if (previewType.value === 'code' && !previewError.value) {
                    // Vue可能需要一段时间来更新DOM
                    setTimeout(() => Prism.highlightAllUnder(document.querySelector('.code-preview')), 0);
                }
            }
        }
        
        // PDF页面导航功能
        async function renderPdfPage(pageNumber) {
            if (!pdfDocument.value) return;
            
            try {
                previewLoading.value = true;
                
                const page = await pdfDocument.value.getPage(pageNumber);
                const viewport = page.getViewport({ scale: pdfScale.value });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                
                await page.render(renderContext).promise;
                
                const pdfViewer = document.getElementById('pdf-viewer');
                if (pdfViewer) {
                    pdfViewer.innerHTML = '';
                    pdfViewer.appendChild(canvas);
                    pdfCurrentPage.value = pageNumber;
                }
            } catch (error) {
                console.error('渲染PDF页面失败:', error);
                previewError.value = `无法渲染PDF页面: ${error.message}`;
            } finally {
                previewLoading.value = false;
            }
        }
        
        async function pdfNextPage() {
            if (pdfCurrentPage.value < pdfTotalPages.value) {
                await renderPdfPage(pdfCurrentPage.value + 1);
            }
        }
        
        async function pdfPrevPage() {
            if (pdfCurrentPage.value > 1) {
                await renderPdfPage(pdfCurrentPage.value - 1);
            }
        }
        
        async function pdfZoomIn() {
            pdfScale.value += 0.25;
            await renderPdfPage(pdfCurrentPage.value);
        }
        
        async function pdfZoomOut() {
            if (pdfScale.value > 0.5) {
                pdfScale.value -= 0.25;
                await renderPdfPage(pdfCurrentPage.value);
            }
        }

        function closeFilePreview() {
            showFilePreview.value = false;
            previewItemName.value = '';
            previewItem.value = null;
            previewContent.value = '';
            previewType.value = '';
            
            // 清理PDF查看器
            const pdfViewer = document.getElementById('pdf-viewer');
            if (pdfViewer) pdfViewer.innerHTML = '';
            
            // 清理视频播放器
            const videoPlayer = document.getElementById('video-player');
            if (videoPlayer && videoPlayer.plyr) {
                videoPlayer.plyr.destroy();
            }
        }
        
        // 通知系统
        function showNotification(message, type = 'info', duration = 3000) {
            // 清除之前的超时
            if (notification.timeout) {
                clearTimeout(notification.timeout);
            }
            
            // 设置新通知
            notification.message = message;
            notification.type = type;
            notification.show = true;
            
            // 设置自动关闭定时器
            notification.timeout = setTimeout(() => {
                notification.show = false;
            }, duration);
        }
        
        function getNotificationIcon() {
            switch (notification.type) {
                case 'success': return 'fas fa-check-circle';
                case 'error': return 'fas fa-exclamation-circle';
                case 'warning': return 'fas fa-exclamation-triangle';
                default: return 'fas fa-info-circle';
            }
        }

        onMounted(() => {
            if (loadConfig()) {
                 fetchDirectoryContents(currentPath.value || '/');
            } else {
                showConfigModal.value = true;
            }
        });
        
        // 监听配置变化，需要重新获取
        watch(() => [config.owner, config.repo, config.branch, config.platform], () => {
            if(configLoaded.value && config.owner && config.repo) {
                // 避免在模态框打开时用户编辑时重新获取
                if (!showConfigModal.value) {
                    fetchDirectoryContents(currentPath.value || '/');
                }
            }
        });


        return {
            config,
            configError,
            configLoaded,
            showConfigModal,
            saveConfig,
            saveConfigAndLoadFiles,
            resetConfig,
            
            currentPath,
            currentPathParts,
            getPathForBreadcrumb,
            files,
            displayedFiles,
            isLoading,
            apiError,
            currentView,
            toggleView,
            
            fetchDirectoryContents,
            navigateToPath,
            goUp,
            handleItemClick,
            
            searchQuery,
            searchResults,
            isSearchActive,
            isSearching,
            searchFiles,
            clearSearch,
            
            showUploadModal,
            fileToUpload,
            uploadFileName,
            commitMessage,
            isUploading,
            uploadError,
            uploadProgress,
            uploadInProgress,
            isDragging,
            fileExists,
            conflictResolution,
            prepareFileForUpload,
            uploadFile,
            dragOverHandler,
            dragLeaveHandler,
            dropHandler,
            resetUpload,
            
            showFolderModal,
            newFolderName,
            folderCommitMessage,
            isCreatingFolder,
            folderError,
            createFolder,
            confirmCreateFolder,
            
            showDeleteModal,
            itemToDelete,
            deleteCommitMessage,
            isDeleting,
            deleteError,
            showDeleteConfirm,
            confirmDelete,
            
            downloadFile,
            
            showFilePreview,
            previewItemName,
            previewItem,
            previewContent,
            previewType,
            previewLanguage,
            previewLoading,
            previewError,
            openFilePreview,
            closeFilePreview,
            
            pdfCurrentPage,
            pdfTotalPages,
            pdfNextPage,
            pdfPrevPage,
            pdfZoomIn,
            pdfZoomOut,
            
            notification,
            getNotificationIcon,

            // 从utils.js导入的实用函数
            formatFileSize,
            getFileIcon,
            getFileIconClass,
            getFileExtension,
            formatDate
        };
    }
});

app.mount('#app');

// 使utils.js的实用函数全局可用
window.formatFileSize = formatFileSize;
window.getFileIcon = getFileIcon;
window.getFileIconClass = getFileIconClass;
window.getFileExtension = getFileExtension;
window.encodeFileAsBase64 = encodeFileAsBase64;
window.formatDate = formatDate;
window.downloadFileFromUrl = downloadFileFromUrl;
window.sanitizeFilename = sanitizeFilename;
window.generateUniqueFilename = generateUniqueFilename;
window.fileExists = fileExists;
window.parseCommitDate = parseCommitDate;
window.handleApiError = handleApiError;
window.createPlaceholderContent = createPlaceholderContent;
