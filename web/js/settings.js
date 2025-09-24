// 加载配置并显示在表单中
function loadSettings() {
    fetch('/api/config')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(config => {
            // 为所有配置项添加空值检查
            document.getElementById('port').value = config.port?.toString() || '5000';
            document.getElementById('debug').checked = config.debug ?? false;
            document.getElementById('imagesPerRow').value = config.images_per_row?.toString() || '5';
            document.getElementById('scanSubfolders').checked = config.scan_subfolders ?? true;
            document.getElementById('maxDepth').value = config.max_depth?.toString() || '3';
            
            // 加载图片文件夹配置
            const folderContainer = document.getElementById('folderContainer');
            folderContainer.innerHTML = ''; // 清空现有内容
            
            // 确保image_folders是数组
            const folders = Array.isArray(config.image_folders) ? config.image_folders : [];
            
            // 添加已配置的文件夹
            folders.forEach((folder, index) => {
                addFolderInput(folder || '');
            });
            
            // 如果没有文件夹，添加一个空输入框
            if (folders.length === 0) {
                addFolderInput('');
            }
        })
        .catch(error => {
            console.error('获取配置失败:', error);
            showNotification('获取配置失败: ' + error.message, 'error');
        });
}

// 保存配置
function saveSettings() {
    // 收集表单数据
    const formData = {
        port: parseInt(document.getElementById('port').value),
        debug: document.getElementById('debug').checked,
        images_per_row: parseInt(document.getElementById('imagesPerRow').value),
        scan_subfolders: document.getElementById('scanSubfolders').checked,
        max_depth: parseInt(document.getElementById('maxDepth').value),
        image_folders: Array.from(document.getElementsByClassName('folder-input'))
            .map(input => input.value.trim())
            .filter(folder => folder) // 过滤空值
    };

    // 验证端口号
    if (isNaN(formData.port) || formData.port < 1 || formData.port > 65535) {
        showNotification('请输入有效的端口号 (1-65535)', 'error');
        return;
    }

    // 验证每行图片数量
    if (isNaN(formData.images_per_row) || formData.images_per_row < 1 || formData.images_per_row > 20) {
        showNotification('请输入有效的每行图片数量 (1-20)', 'error');
        return;
    }

    // 验证最大深度
    if (isNaN(formData.max_depth) || formData.max_depth < 0 || formData.max_depth > 10) {
        showNotification('请输入有效的最大深度 (0-10)', 'error');
        return;
    }

    // 发送保存请求
    fetch('/api/config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || `保存失败: HTTP状态码 ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        showNotification('配置已成功保存', 'success');
        // 2秒后刷新页面，显示更新后的配置
        setTimeout(() => {
            loadSettings();
        }, 2000);
    })
    .catch(error => {
        console.error('保存配置失败:', error);
        showNotification('保存配置失败: ' + error.message, 'error');
    });
}

// 添加文件夹输入框
function addFolderInput(value = '') {
    const container = document.getElementById('folderContainer');
    const div = document.createElement('div');
    div.className = 'folder-input-group mb-3';
    div.innerHTML = `
        <div class="input-group">
            <input type="text" class="folder-input form-control" placeholder="图片文件夹路径" value="${escapeHtml(value)}">
            <button type="button" class="btn btn-danger" onclick="removeFolderInput(this)">删除</button>
        </div>
    `;
    container.appendChild(div);
}

// 移除文件夹输入框
function removeFolderInput(button) {
    const container = document.getElementById('folderContainer');
    const inputGroup = button.closest('.folder-input-group');
    
    // 确保至少保留一个输入框
    if (container.children.length > 1) {
        container.removeChild(inputGroup);
    } else {
        showNotification('至少需要保留一个图片文件夹', 'warning');
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification';
    
    // 添加类型相关的样式
    if (type === 'success') {
        notification.classList.add('bg-success', 'text-white');
    } else if (type === 'error') {
        notification.classList.add('bg-danger', 'text-white');
    } else if (type === 'warning') {
        notification.classList.add('bg-warning', 'text-dark');
    } else {
        notification.classList.add('bg-info', 'text-white');
    }
    
    // 显示通知
    notification.style.display = 'block';
    
    // 3秒后隐藏
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// 防止XSS的辅助函数
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 页面加载时加载配置
document.addEventListener('DOMContentLoaded', loadSettings);
