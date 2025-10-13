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
            // 加载设置
            await loadSettings();
            
            // 初始化子模块
            if (typeof initGallery === 'function') {
                initGallery(appState.settings);
            }
            
            if (typeof initSettings === 'function') {
                initSettings(appState.settings);
            }
            
            // 设置事件监听
            setupEventListeners();
            
            // 显示初始视图
            switchView(appState.currentView);
        } catch (error) {
            showNotification('应用初始化失败: ' + error.message, 'error');
            console.error('初始化错误:', error);
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
     * 切换视图
     * @param {string} viewName - 视图名称 ('gallery' 或 'settings')
     */
    function switchView(view) {
        if (view === appState.currentView) return;
        
        appState.currentView = view;
        
        // 更新视图显示状态
        elements.galleryView.classList.toggle('active', view === 'gallery');
        elements.settingsView.classList.toggle('active', view === 'settings');
        
        // 更新按钮状态
        elements.galleryBtn.classList.toggle('active', view === 'gallery');
        elements.settingsBtn.classList.toggle('active', view === 'settings');
        
        // 如果切换到画廊，刷新图片列表
        if (view === 'gallery') {
            if (window.loadGallery) {
                window.loadGallery();
            }
        } 
        // 如果切换到设置，加载设置
        else if (view === 'settings' && appState.settings && window.initSettings) {
            window.initSettings(appState.settings);
        }
    }

    /**
     * 显示通知
     * @param {string} message - 通知内容
     * @param {string} type - 通知类型：success, error, info
     */
    function showNotification(message, type = 'info') {
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
        elements.loader.style.display = 'flex';
    }

    /**
     * 隐藏加载指示器
     */
    function hideLoader() {
        elements.loader.style.display = 'none';
    }

    /**
     * 刷新缓存并重新加载图片
     */
    async function refreshCache() {
        showLoader();
        try {
            const response = await fetch('index.php?action=refreshCache');
            const result = await response.json();
            
            if (response.ok) {
                showNotification('缓存已刷新，正在重新加载图片...', 'success');
                // 重新加载图片
                if (window.loadGallery) {
                    window.loadGallery();
                }
            } else {
                showNotification('刷新缓存失败: ' + (result.error || '未知错误'), 'error');
            }
        } catch (error) {
            console.error('刷新缓存错误:', error);
            showNotification('刷新缓存时发生错误', 'error');
        } finally {
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
            showNotification('设置已保存', 'success');
            switchView('gallery');
        });
    }

    /**
     * 初始化应用
     */
    function initApp() {
        setupEventListeners();
        loadSettings();
        
        // 初始化画廊
        if (window.initGallery) {
            window.initGallery();
        }
        
        // 暴露方法供其他模块使用
        window.app = {
            showNotification,
            showLoader,
            hideLoader,
            switchView
        };
    }

    // 启动应用
    initApp();
});
