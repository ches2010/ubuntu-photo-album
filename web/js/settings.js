/**
 * 设置功能模块
 * 负责配置的加载、显示和保存
 */
export default class Settings {
    constructor(galleryInstance) {
        // 保存相册实例引用，用于配置更改后刷新相册
        this.gallery = galleryInstance;
        
        // 缓存DOM元素
        this.elements = this.initElements();
        
        // 初始化事件监听
        this.initEventListeners();
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        return {
            settingsBtn: document.getElementById('settingsBtn'),
            settingsModal: document.getElementById('settingsModal'),
            settingsForm: document.getElementById('settingsForm'),
            cancelSettingsBtn: document.getElementById('cancelSettings'),
            closeSettingsBtn: document.getElementById('closeSettings'),
            folderContainer: document.getElementById('folderContainer'),
            addFolderBtn: document.querySelector('.add-folder-btn'),
            saveSettingsBtn: document.querySelector('.save-settings-btn'),
            notification: document.getElementById('notification'),
            loadingFolders: document.getElementById('loadingFolders')
        };
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 设置按钮事件
        if (this.elements.settingsBtn) {
            this.elements.settingsBtn.addEventListener('click', () => this.openSettingsModal());
        }

        // 设置表单事件
        if (this.elements.settingsForm) {
            this.elements.settingsForm.addEventListener('submit', (e) => this.saveSettings(e));
        }

        // 关闭设置按钮事件
        if (this.elements.cancelSettingsBtn) {
            this.elements.cancelSettingsBtn.addEventListener('click', () => this.closeSettingsModal());
        }
        if (this.elements.closeSettingsBtn) {
            this.elements.closeSettingsBtn.addEventListener('click', () => this.closeSettingsModal());
        }

        // 添加文件夹按钮事件
        if (this.elements.addFolderBtn) {
            this.elements.addFolderBtn.addEventListener('click', () => this.addFolderInput());
        } else {
            console.error('未找到添加文件夹按钮');
        }

        // 键盘事件 - ESC关闭设置模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.elements.settingsModal.classList.contains('hidden')) {
                this.closeSettingsModal();
            }
        });
    }

    /**
     * 打开设置模态框并加载配置
     */
    openSettingsModal() {
        const settingsModal = this.elements.settingsModal;
        if (!settingsModal) return;
        
        // 显示加载状态
        if (this.elements.loadingFolders) {
            this.elements.loadingFolders.style.display = 'block';
            this.elements.loadingFolders.textContent = '加载配置中...';
            this.elements.loadingFolders.classList.remove('text-danger');
        }
        
        fetch('/api/config')
            .then(response => {
                if (!response.ok) throw new Error('加载设置失败');
                return response.json();
            })
            .then(config => {
                // 填充表单数据
                this.populateSettingsForm(config);
                
                // 显示模态框
                settingsModal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            })
            .catch(error => {
                console.error('加载设置失败:', error);
                this.showNotification('加载设置失败: ' + error.message, 'error');
                
                // 更新加载提示
                if (this.elements.loadingFolders) {
                    this.elements.loadingFolders.textContent = '加载配置失败';
                    this.elements.loadingFolders.classList.add('text-danger');
                }
            });
    }

    /**
     * 填充设置表单数据
     */
    populateSettingsForm(config) {
        // 填充基本配置
        document.getElementById('port').value = config.port?.toString() || '5000';
        document.getElementById('debug').checked = config.debug ?? false;
        document.getElementById('imagesPerRow').value = config.images_per_row?.toString() || '5';
        document.getElementById('scanSubfolders').checked = config.scan_subfolders ?? true;
        document.getElementById('maxDepth').value = config.max_depth?.toString() || '3';
        document.getElementById('cacheDuration').value = config.cache_duration?.toString() || '600';
        
        // 处理文件夹配置
        if (!this.elements.folderContainer) {
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
        Array.from(this.elements.folderContainer.children).forEach(child => {
            if (child.id !== 'loadingFolders') {
                this.elements.folderContainer.removeChild(child);
            }
        });
        
        // 隐藏加载提示
        if (this.elements.loadingFolders) {
            this.elements.loadingFolders.style.display = 'none';
        }
        
        // 添加已配置的文件夹
        if (folders.length === 0) {
            console.log('没有找到已配置的文件夹，添加一个空输入框');
            this.addFolderInput('');
        } else {
            console.log(`找到${folders.length}个已配置的文件夹`);
            folders.forEach((folder) => {
                // 确保文件夹路径是字符串
                const folderPath = typeof folder === 'string' ? folder : '';
                this.addFolderInput(folderPath);
            });
        }
    }

    /**
     * 关闭设置模态框
     */
    closeSettingsModal() {
        const settingsModal = this.elements.settingsModal;
        if (settingsModal) {
            settingsModal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    /**
     * 保存设置
     */
    saveSettings(event) {
        event.preventDefault();
        if (this.gallery.state.isLoading) return;

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
            cache_duration: parseInt(document.getElementById('cacheDuration').value),
            image_folders: folders
        };
        
        // 验证数据
        if (folders.length === 0) {
            this.showNotification('至少需要设置一个图片文件夹', 'error');
            return;
        }
        
        if (isNaN(formData.port) || formData.port < 1 || formData.port > 65535) {
            this.showNotification('请输入有效的端口号 (1-65535)', 'error');
            return;
        }
        
        this.gallery.showLoading();
        
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
            console.log('配置保存成功:', data);
            this.showNotification('配置已成功保存', 'success');
            this.closeSettingsModal();
            
            // 重置到第一页并刷新图片
            this.gallery.state.currentPage = 1;
            this.gallery.loadImages(true);
        })
        .catch(error => {
            console.error('保存配置失败:', error);
            this.showNotification('保存配置失败: ' + error.message, 'error');
        })
        .finally(() => {
            this.gallery.hideLoading();
        });
    }

    /**
     * 添加文件夹输入框
     */
    addFolderInput(value = '') {
        console.log('添加文件夹输入框，值:', value);
        
        if (!this.elements.folderContainer) {
            console.error('未找到文件夹容器，无法添加输入框');
            return;
        }
        
        const div = document.createElement('div');
        div.className = 'folder-input-group mb-3';
        div.innerHTML = `
            <div class="input-group">
                <input type="text" class="folder-input form-control" 
                       placeholder="图片文件夹绝对路径" 
                       value="${this.escapeHtml(value)}">
                <button type="button" class="btn btn-danger remove-folder-btn">删除</button>
            </div>
        `;
        
        // 添加到容器
        this.elements.folderContainer.appendChild(div);
        
        // 为删除按钮绑定事件
        const removeBtn = div.querySelector('.remove-folder-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeFolderInput(removeBtn));
        }
        
        // 自动聚焦到新添加的输入框
        const input = div.querySelector('.folder-input');
        if (input) input.focus();
    }
    
    /**
     * 移除文件夹输入框
     */
    removeFolderInput(button) {
        const inputGroup = button.closest('.folder-input-group');
        
        if (inputGroup && this.elements.folderContainer) {
            // 检查是否只剩最后一个输入框
            const folderGroups = this.elements.folderContainer.querySelectorAll('.folder-input-group');
            if (folderGroups.length > 1) {
                this.elements.folderContainer.removeChild(inputGroup);
                console.log('文件夹输入框已删除');
            } else {
                this.showNotification('至少需要保留一个图片文件夹', 'warning');
            }
        }
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        const notification = this.elements.notification;
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
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
