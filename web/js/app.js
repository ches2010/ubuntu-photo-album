/**
 * 应用主控制器
 * 负责初始化应用、管理视图切换和全局状态
 */
document.addEventListener('DOMContentLoaded', function() {
    // 全局状态
    const appState = {
        currentView: 'gallery',
        settings: {},
        isLoading: false
    };

    // DOM元素
    const elements = {
        galleryView: document.getElementById('galleryView'),
        settingsView: document.getElementById('settingsView'),
        galleryBtn: document.getElementById('galleryBtn'),
        settingsBtn: document.getElementById('settingsBtn'),
        refreshBtn: document.getElementById('refreshBtn'),
        notification: document.getElementById('notification'),
        loader: document.getElementById('loader')
    };
   
    /**
     * 初始化应用
     */
    async function initApp() {
        showLoader();
        
        try {
            // 1. 先加载设置（确保画廊有必要的配置）
            const response = await fetch('index.php?action=getSettings');
            if (!response.ok) throw new Error('加载设置失败: HTTP ' + response.status);

            appState.settings = await response.json();
            console.log('设置加载完成:', appState.settings);
            
            // 2. 验证必要的设置项
            if (!appState.settings.imagePaths || appState.settings.imagePaths.length === 0) {
                throw new Error('未配置图片路径，请在设置中添加图片文件夹');
            }

            // 3. 确保gallery.js已加载并暴露必要方法
            if (typeof initGallery === 'function') {
                throw new Error('画廊模块未加载，请检查gallery.js是否正确引入');
            }

            // 4. 初始化画廊并传递完整设置
            initGallery(appState.settings);

            // 5. 显式触发图片加载（关键修复：确保初始化后立即加载图片）
            if (window.refreshGallery) {
                console.log('主动触发图片加载');
                window.refreshGallery();
            } else {
                throw new Error('未找到刷新画廊的方法');
            }

            // 6. 初始化其他模块
            if (typeof initSettings === 'function') {
                initSettings(appState.settings);
            }
            
            // 7. 设置事件监听
            setupEventListeners();
            
            // 8. 显示初始视图
            switchView(appState.currentView);
        } catch (error) {
            console.error('初始化错误:', error);
            showNotification('应用初始化失败: ' + error.message, 'error');

            // 显示错误页面和重试按钮
            const errorContainer = document.createElement('div');
            errorContainer.className = 'initialization-error';
            errorContainer.innerHTML = `
                <h3>应用加载失败</h3>
                <p>${error.message}</p>
                <button id="retryInitBtn" class="btn">重新初始化</button>
            `;
            document.body.appendChild(errorContainer);
            document.getElementById('retryInitBtn').addEventListener('click', () => {
                errorContainer.remove();
                initApp();
            });
        } finally {
            hideLoader();
        }
    }

    /**
     * 加载设置
     */
    async function loadSettings() {
        try {
            const response = await fetch('index.php?action=getSettings');
            if (!response.ok) throw new Error('加载设置失败');
            
            appState.settings = await response.json();
            
            // 初始化设置面板
            if (window.initSettings) {
                window.initSettings(appState.settings);
            }
        } catch (error) {
            console.error('加载设置错误:', error);
            showNotification('加载设置失败', 'error');
        }
    }

    /**
     * 切换视图 - 修复画廊视图切换时的图片加载
     */
    function switchView(view) {
        if (view === appState.currentView) return;
        
        appState.currentView = view;
        
        // 更新视图显示状态
        if (elements.galleryView) {
            elements.galleryView.classList.toggle('active', view === 'gallery');
        }
        if (elements.settingsView) {
            elements.settingsView.classList.toggle('active', view === 'settings');
        }
        
        // 更新按钮状态
        if (elements.galleryBtn) {
            elements.galleryBtn.classList.toggle('active', view === 'gallery');
        }
        if (elements.settingsBtn) {
            elements.settingsBtn.classList.toggle('active', view === 'settings');
        }
        
        // 切换到画廊时强制刷新图片（关键修复）
        if (view === 'gallery') {
            console.log('切换到画廊视图，刷新图片');
            if (window.refreshGallery) {
                window.refreshGallery();
            } else if (window.loadGallery) {
                window.loadGallery(1);
            }
        }
    }

    /**
     * 显示通知
     * @param {string} message - 通知内容
     * @param {string} type - 通知类型：success, error, info
     */
    function showNotification(message, type = 'info') {
        if (!elements.notification) return;
        
        elements.notification.textContent = message;
        elements.notification.className = 'notification ' + type;
        elements.notification.style.display = 'block';
        
        setTimeout(() => {
            elements.notification.style.display = 'none';
        }, 3000);
    }

    /**
     * 显示加载指示器
     */
    function showLoader() {
        appState.isLoading = true;
        if (elements.loader) {
            elements.loader.style.display = 'flex';
        }
    }

    /**
     * 隐藏加载指示器
     */
    function hideLoader() {
        appState.isLoading = false;
        if (elements.loader) {
            elements.loader.style.display = 'none';
        }
    }

    /**
     * 刷新缓存并重新加载图片
     */
    async function refreshCache() {
        // 防止重复点击
        if (appState.isLoading) return;
        
        const refreshBtn = elements.refreshBtn;
        if (!refreshBtn) return;
        
        const originalText = refreshBtn.innerHTML;
        
        // 更新按钮状态和显示
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 刷新中...';
        
        showLoader();        
        try {
            // 发送刷新缓存请求，禁用缓存确保请求有效
            const response = await fetch('index.php?action=refreshCache', {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });            
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                showNotification(`缓存已刷新: ${result.message}`, 'success');
                
                // 刷新缓存后立即重新加载图片（关键修复）
                setTimeout(() => {
                    // 重新加载图片列表
                    if (window.loadGallery) {
                        window.refreshGallery();
                    }
                }, 500);
            } else {
                showNotification('刷新缓存失败: ' + (result.error || '未知错误'), 'error');
            }
        } catch (error) {
            console.error('刷新缓存错误:', error);
            showNotification('刷新缓存时发生错误: ' + error.message, 'error');
        } finally {
            // 恢复按钮状态
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = originalText;
            hideLoader();
        }
    }

    /**
     * 设置事件监听器
     */
    function setupEventListeners() {
        // 确保按钮元素存在再绑定事件
        if (elements.galleryBtn) {
            elements.galleryBtn.addEventListener('click', () => switchView('gallery'));
        }
        
        if (elements.settingsBtn) {
            elements.settingsBtn.addEventListener('click', () => switchView('settings'));
        }
        
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', refreshCache);
        }
        
        // 监听设置保存事件，更新本地设置并刷新画廊
        document.addEventListener('settingsSaved', (e) => {
            appState.settings = e.detail;
            showNotification('设置已保存，正在刷新图片...', 'success');
            
            // 保存设置后自动刷新缓存和图片
            setTimeout(() => {
                refreshCache();
                switchView('gallery');
            }, 500);
        });
    }

    /**
     * 初始化应用 - 修复版
     * 确保设置加载完成后再初始化画廊，解决时序问题
     */
    function init() {
        // 先设置事件监听
        setupEventListeners();
        
        // 加载设置并在完成后初始化画廊（关键修复）
        loadSettings().then(() => {
            console.log('设置加载完成，准备初始化画廊');
            
            // 确保gallery.js已加载且设置有效
            if (typeof window.initGallery !== 'function') {
                console.error('初始化失败：未找到initGallery函数，请检查gallery.js是否正确引入');
                showNotification('画廊模块加载失败', 'error');
                return;
            }
            
            if (!appState.settings) {
                console.error('初始化失败：设置数据为空');
                showNotification('无法加载应用设置', 'error');
                return;
            }
            
            // 传递设置参数初始化画廊（关键修复）
            window.initGallery(appState.settings);
            
            // 显式触发图片加载
            if (window.refreshGallery) {
                console.log('初始化完成，触发图片加载');
                window.refreshGallery();
            } else {
                console.warn('未找到refreshGallery方法，尝试手动加载');
                if (window.loadGallery) {
                    window.loadGallery(1);
                }
            }
        }).catch(error => {
            console.error('初始化流程出错:', error);
            showNotification('应用初始化失败: ' + error.message, 'error');
        });
        
        // 暴露方法供其他模块使用
        window.app = {
            showNotification,
            showLoader,
            hideLoader,
            switchView,
            refreshCache
        };
    }


    // 启动应用
    init();
});
    
