/**
 * 设置页面功能模块
 * 负责配置的加载、显示和保存
 */
document.addEventListener('DOMContentLoaded', () => {
    // 初始化主题
    if (typeof loadSavedTheme === 'function') {
        loadSavedTheme();
    }
    
    // 初始化设置页面功能
    initSettings();
});

function initSettings() {
    // DOM元素
    const addFolderBtn = document.querySelector('.add-folder-btn');
    const saveSettingsBtn = document.querySelector('.save-settings-btn');
    const folderContainer = document.getElementById('folderContainer');
    
    // 事件监听
    if (addFolderBtn) {
        addFolderBtn.addEventListener('click', addFolderInput);
    } else {
        console.error('未找到添加文件夹按钮');
    }
    
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    } else {
        console.error('未找到保存配置按钮');
    }
    
    // 加载配置
    loadSettings();
    
    /**
     * 加载配置并显示在表单中
     */
    function loadSettings() {
        console.log('开始加载配置');
        
        fetch('/api/config')
            .then(response => {
                console.log('配置请求响应状态:', response.status);
                if (!response.ok) {
                    throw new Error(`HTTP错误: 状态码 ${response.status}`);
                }
                return response.json();
            })
            .then(config => {
                console.log('成功获取配置:', config);
                
                // 隐藏加载提示
                const loadingEl = document.getElementById('loadingFolders');
                if (loadingEl) loadingEl.style.display = 'none';
                
                // 填充基本配置
                document.getElementById('port').value = config.port?.toString() || '5000';
                document.getElementById('debug').checked = config.debug ?? false;
                document.getElementById('imagesPerRow').value = config.images_per_row?.toString() || '5';
                document.getElementById('scanSubfolders').checked = config.scan_subfolders ?? true;
                document.getElementById('maxDepth').value = config.max_depth?.toString() || '3';
                
                // 处理文件夹配置
                if (!folderContainer) {
                    console.error('未找到文件夹容器元素');
                    return;
                }
                
                // 确保image_folders是数组
                let folders = [];
                if (Array.isArray(config.image_folders)) {
                    folders = config.image_folders;
                } else {
                    console.warn('image_folders不是数组，使用空数组');
                    folders = [];
                }
                
                // 清除现有内容（保留加载提示以外的内容）
                Array.from(folderContainer.children).forEach(child => {
                    if (child.id !== 'loadingFolders') {
                        folderContainer.removeChild(child);
                    }
                });
                
                // 添加已配置的文件夹
                if (folders.length === 0) {
                    console.log('没有找到已配置的文件夹，添加一个空输入框');
                    addFolderInput('');
                } else {
                    console.log(`找到${folders.length}个已配置的文件夹`);
                    folders.forEach((folder) => {
                        // 确保文件夹路径是字符串
                        const folderPath = typeof folder === 'string' ? folder : '';
                        addFolderInput(folderPath);
                    });
                }
            })
            .catch(error => {
                console.error('获取配置失败:', error);
                // 隐藏加载提示
                const loadingEl = document.getElementById('loadingFolders');
                if (loadingEl) {
                    loadingEl.textContent = '加载文件夹配置失败';
                    loadingEl.classList.add('text-danger');
                }
                showNotification('获取配置失败: ' + error.message, 'error');
            });
    }
    
    /**
     * 添加文件夹输入框
     */
    function addFolderInput(value = '') {
        console.log('添加文件夹输入框，值:', value);
        
        if (!folderContainer) {
            console.error('未找到文件夹容器，无法添加输入框');
            return;
        }
        
        const div = document.createElement('div');
        div.className = 'folder-input-group mb-3';
        div.innerHTML = `
            <div class="input-group">
                <input type="text" class="folder-input form-control" 
                       placeholder="图片文件夹绝对路径" 
                       value="${escapeHtml(value)}">
                <button type="button" class="btn btn-danger remove-folder-btn">删除</button>
            </div>
        `;
        
        // 添加到容器
        folderContainer.appendChild(div);
        
        // 为删除按钮绑定事件
        const removeBtn = div.querySelector('.remove-folder-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', function() {
                removeFolderInput(this);
            });
        }
        
        // 自动聚焦到新添加的输入框
        const input = div.querySelector('.folder-input');
        if (input) input.focus();
    }
    
    /**
     * 移除文件夹输入框
     */
    function removeFolderInput(button) {
        const inputGroup = button.closest('.folder-input-group');
        
        if (inputGroup && folderContainer) {
            // 检查是否只剩最后一个输入框
            const folderGroups = folderContainer.querySelectorAll('.folder-input-group');
            if (folderGroups.length > 1) {
                folderContainer.removeChild(inputGroup);
                console.log('文件夹输入框已删除');
            } else {
                showNotification('至少需要保留一个图片文件夹', 'warning');
            }
        }
    }
    
    /**
     * 保存配置
     */
    function saveSettings() {
        console.log('开始保存配置');
        
        // 收集文件夹路径
        const folderInputs = document.getElementsByClassName('folder-input');
        const folders = Array.from(folderInputs).map(input => {
            return input.value.trim();
        }).filter(folder => folder); // 过滤空值
        
        console.log('要保存的文件夹:', folders);
        
        // 收集表单数据
        const formData = {
            port: parseInt(document.getElementById('port').value),
            debug: document.getElementById('debug').checked,
            images_per_row: parseInt(document.getElementById('imagesPerRow').value),
            scan_subfolders: document.getElementById('scanSubfolders').checked,
            max_depth: parseInt(document.getElementById('maxDepth').value),
            image_folders: folders
        };
        
        // 验证数据
        if (folders.length === 0) {
            showNotification('至少需要设置一个图片文件夹', 'error');
            return;
        }
        
        if (isNaN(formData.port) || formData.port < 1 || formData.port > 65535) {
            showNotification('请输入有效的端口号 (1-65535)', 'error');
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
            console.log('保存配置响应状态:', response.status);
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `保存失败: HTTP状态码 ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('配置保存成功:', data);
            showNotification('配置已成功保存', 'success');
            // 刷新配置显示
            setTimeout(loadSettings, 1000);
        })
        .catch(error => {
            console.error('保存配置失败:', error);
            showNotification('保存配置失败: ' + error.message, 'error');
        });
    }
    
    /**
     * 显示通知
     */
    function showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.textContent = message;
        notification.className = 'notification';
        
        // 添加类型样式
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
    
    /**
     * 防止XSS的辅助函数
     */
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
