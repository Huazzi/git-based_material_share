function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileExtension(filename) {
    if (!filename) return '';
    return filename.split('.').pop().toLowerCase();
}

function getFileIcon(filename) {
    const ext = getFileExtension(filename);
    
    // 根据扩展名返回不同的图标
    switch (ext) {
        case 'pdf': return '📄';
        case 'doc':
        case 'docx': return '📝';
        case 'xls':
        case 'xlsx': return '📊';
        case 'ppt':
        case 'pptx': return '📊';
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'bmp':
        case 'svg': return '🖼️';
        case 'mp4':
        case 'mov':
        case 'avi':
        case 'webm': return '🎬';
        case 'mp3':
        case 'wav':
        case 'ogg': return '🎵';
        case 'zip': return '🤐';
        case 'rar':
        case 'tar':
        case 'gz': return '📦';
        case 'md': return '📑';
        case 'html':
        case 'htm': return '🌐';
        case 'js': return '📜';
        case 'css': return '🎨';
        case 'json': return '📋';
        default: return '📄';
    }
}

// 获取基于Font Awesome的文件图标类
function getFileIconClass(filename) {
    if (!filename) return 'fas fa-file';
    
    const ext = getFileExtension(filename);
    
    // 根据扩展名返回Font Awesome图标类
    switch (ext) {
        case 'pdf': return 'fas fa-file-pdf';
        case 'doc':
        case 'docx': return 'fas fa-file-word';
        case 'xls':
        case 'xlsx': return 'fas fa-file-excel';
        case 'ppt':
        case 'pptx': return 'fas fa-file-powerpoint';
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'bmp':
        case 'svg': return 'fas fa-file-image';
        case 'mp4':
        case 'mov':
        case 'avi':
        case 'webm': return 'fas fa-file-video';
        case 'mp3':
        case 'wav':
        case 'ogg': return 'fas fa-file-audio';
        case 'zip':
        case 'rar':
        case 'tar':
        case 'gz': return 'fas fa-file-archive';
        case 'md': return 'fab fa-markdown';
        case 'html':
        case 'htm': return 'fab fa-html5';
        case 'js': return 'fab fa-js';
        case 'css': return 'fab fa-css3-alt';
        case 'py': return 'fab fa-python';
        case 'java': return 'fab fa-java';
        case 'php': return 'fab fa-php';
        case 'c':
        case 'cpp':
        case 'h': return 'fas fa-file-code';
        case 'txt': return 'fas fa-file-alt';
        case 'json': return 'fas fa-file-code';
        case 'xml': return 'fas fa-file-code';
        case 'csv': return 'fas fa-file-csv';
        default: return 'fas fa-file';
    }
}

// 将文件转换为Base64
async function encodeFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// 格式化日期
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    // 显示相对时间或绝对日期
    if (diffDay < 1) {
        if (diffHour < 1) {
            if (diffMin < 1) {
                return '刚刚';
            }
            return `${diffMin}分钟前`;
        }
        return `${diffHour}小时前`;
    } else if (diffDay < 7) {
        return `${diffDay}天前`;
    } else {
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
}

// 下载文件
function downloadFileFromUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || getFilenameFromUrl(url);
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// 从URL中获取文件名
function getFilenameFromUrl(url) {
    if (!url) return '';
    const parts = url.split('/');
    return parts[parts.length - 1];
}

// 去除文件名中的非法字符
function sanitizeFilename(filename) {
    if (!filename) return '';
    return filename.replace(/[\\/:*?"<>|]/g, '_');
}

// 生成唯一文件名（处理名称冲突）
function generateUniqueFilename(filename, existingFiles) {
    if (!existingFiles || !existingFiles.length) return filename;
    
    const ext = getFileExtension(filename);
    const baseName = filename.substring(0, filename.length - (ext.length ? ext.length + 1 : 0));
    
    let counter = 1;
    let newName = filename;
    
    while (existingFiles.some(file => file.name === newName)) {
        newName = `${baseName} (${counter}).${ext}`;
        counter++;
    }
    
    return newName;
}

// 检查文件是否存在
function fileExists(filename, files) {
    if (!files || !files.length) return false;
    return files.some(file => file.name === filename);
}

// 解析提交日期
function parseCommitDate(commitData) {
    if (!commitData) return null;
    
    // 处理不同API返回的日期格式
    if (commitData.commit && commitData.commit.committer && commitData.commit.committer.date) {
        return new Date(commitData.commit.committer.date);
    }
    
    if (commitData.committer && commitData.committer.date) {
        return new Date(commitData.committer.date);
    }
    
    return null;
}

// 处理API错误
function handleApiError(error) {
    if (error.response) {
        // 服务器返回了错误状态码
        const status = error.response.status;
        const message = error.response.data?.message || '未知错误';
        
        if (status === 401 || status === 403) {
            return `认证失败: ${message}. 请检查您的PAT令牌和权限。`;
        } else if (status === 404) {
            return `未找到资源: ${message}. 请检查路径和配置。`;
        } else if (status === 422) {
            return `请求无效: ${message}. 请检查提交的数据。`;
        } else if (status === 429) {
            return `API请求过于频繁: ${message}. 请稍后再试。`;
        } else {
            return `API错误 (${status}): ${message}`;
        }
    } else if (error.request) {
        // 请求已发送但未收到响应
        return '无法连接到服务器，请检查网络连接。';
    } else {
        // 发送请求时出错
        return `请求错误: ${error.message}`;
    }
}

// 创建空白文件内容
function createPlaceholderContent() {
    return btoa(""); // 返回空字符串的base64编码
}
