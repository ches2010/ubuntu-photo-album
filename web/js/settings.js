/**
 * 设置模块
 * 负责配置的加载、编辑和保存
 */
function initSettings(initialSettings) {
    // 设置状态
    let settings = { ...initialSettings };

    // DOM元素
    const elements = {
        settingsForm: document.getElementById('settingsForm'),
        imagePathInput: document.getElementById('imagePath'),
        addPathBtn: document.getElementById('addPathBtn'),
        pathList: document.getElementById('pathList'),
        scanSubfolders: document.getElementById('scanSubfolders'),
        maxDepth: document.getElementById('maxDepth'),
        imagesPerRow: document.getElementById('imagesPerRow'),
        imagesPerRowValue: document.getElementById('imagesPerRowValue'),
        cacheTTL: document.getElementById('cacheTTL'),
        port: document.getElementById('port'),
        resetSettingsBtn: document.getElementById('resetSettingsBtn')
    };

    /**
     * 渲染路径列表
     */
    function renderPathList() {
        elements.pathList.innerHTML = '';
        
        if (!settings.imagePaths || settings.imagePaths.length === 0) {
            elements.pathList.innerHTML = '<p class="empty-path-list">没有添加图片文件夹路径</p>';
            return;
        }
        
        settings.imagePaths.forEach((path, index) => {
            const pathItem = document.createElement('div');
            pathItem.className = 'path-item';
            pathItem.innerHTML = `
                <span>${escapeHtml(path)}</span>
                <button class="path-item-remove" data-index="${index}">&times;</button>
            `;
            elements.pathList.appendChild(pathItem);
        });
        
        // 添加删除事件监听
        document.querySelectorAll('.path-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.getAttribute('data-index'));
                removePath(index);
            });
        });
    }

    /**
     * 添加图片路径
     * @param {string} path - 要添加的路径
     */
    function addPath(path) {
        if (!path || path.trim() === '') return;
        
        const trimmedPath = path.trim();
        
        // 检查路径是否已存在
        if (settings.imagePaths && settings.imagePaths.includes(trimmedPath)) {
            if (window.app && window.app.showNotification) {
                window.app.showNotification('该路径已存在', 'info');
            }
            return;
        }
        
        // 初始化数组（如果不存在）
        if (!settings.imagePaths) {
            settings.imagePaths = [];
        }
        
        // 添加路径并重新渲染
        settings.imagePaths.push(trimmedPath);
        renderPathList();
        elements.imagePathInput.value = '';
    }

    /**
     * 移除图片路径
     * @param {number} index - 要移除的路径索引
     */
    function removePath(index) {
        if (settings.imagePaths && index >= 0 && index < settings.imagePaths.length) {
            settings.imagePaths.splice(index, 1);
            renderPathList();
        }
    }

    /**
     * 保存设置
     */
    async function saveSettings() {
        if (window.app && window.app.showLoader) {
            window.app.showLoader();
        }

        try {
            // 从表单更新设置
            settings.scanSubfolders = elements.scanSubfolders.checked;
            settings.maxDepth = parseInt(elements.maxDepth.value) || 0;
            settings.imagesPerRow = parseInt(elements.imagesPerRow.value) || 4;
            settings.cacheTTL = parseInt(elements.cacheTTL.value) || 3600;
            settings.port = parseInt(elements.port.value) || 8080;

            // 验证设置
            if (!settings.imagePaths || settings.imagePaths.length === 0) {
                if (window.app && window.app.showNotification) {
                    window.app.showNotification('请至少添加一个图片文件夹路径', 'error');
                }
                return false;
            }

            // 发送到服务器保存
            const response = await fetch('index.php?action=saveSettings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '保存设置失败');
            }

            // 触发设置已保存事件
            const event = new CustomEvent('settingsSaved', { detail: settings });
            document.dispatchEvent(event);

            return true;
        } catch (error) {
            console.error('保存设置错误:', error);
            if (window.app && window.app.showNotification) {
                window.app.showNotification('保存设置失败: ' + error.message, 'error');
            }
            return false;
        } finally {
            if (window.app && window.app.hideLoader) {
                window.app.hideLoader();
            }
        }
    }

    /**
     * 重置设置为默认值
     */
    function resetSettings() {
        if (confirm('确定要重置所有设置为默认值吗？')) {
            // 获取默认设置
            fetch('index.php?action=getSettings')
                .then(response => response.json())
                .then(defaultSettings => {
                    settings = { ...defaultSettings };
                    loadSettingsIntoForm();
                    renderPathList();
                    
                    if (window.app && window.app.showNotification) {
                        window.app.showNotification('设置已重置为默认值', 'info');
                    }
                })
                .catch(error => {
                    console.error('重置设置错误:', error);
                    if (window.app && window.app.showNotification) {
                        window.app.showNotification('重置设置失败: ' + error.message, 'error');
                    }
                });
        }
    }

    /**
     * 将设置加载到表单中
     */
    function loadSettingsIntoForm() {
        elements.scanSubfolders.checked = settings.scanSubfolders || false;
        elements.maxDepth.value = settings.maxDepth || 0;
        elements.imagesPerRow.value = settings.imagesPerRow || 4;
        elements.imagesPerRowValue.textContent = settings.imagesPerRow || 4;
        elements.cacheTTL.value = settings.cacheTTL || 3600;
        elements.port.value = settings.port || 8080;
    }

    /**
     * HTML转义，防止XSS攻击
     * @param {string} str - 需要转义的字符串
     * @returns {string} 转义后的字符串
     */
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * 设置事件监听器
     */
    function setupEventListeners() {
        // 添加路径按钮
        elements.addPathBtn.addEventListener('click', () => {
            addPath(elements.imagePathInput.value);
        });

        // 输入框回车添加路径
        elements.imagePathInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addPath(elements.imagePathInput.value);
            }
        });

        // 图片每行数量滑块
        elements.imagesPerRow.addEventListener('input', (e) => {
            elements.imagesPerRowValue.textContent = e.target.value;
        });

        // 表单提交
        elements.settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSettings();
        });

        // 重置按钮
        elements.resetSettingsBtn.addEventListener('click', resetSettings);
    }

    // 初始化
    loadSettingsIntoForm();
    renderPathList();
    setupEventListeners();

    // 暴露方法供其他模块使用
    window.getSettings = () => ({ ...settings });
}
