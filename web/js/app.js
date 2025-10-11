/**
 * 应用主控制器
 * 负责初始化应用、管理视图切换和全局状态
 */
document.addEventListener('DOMContentLoaded', () => {
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
     * 加载应用设置
     */
    async function loadSettings() {
        try {
            const response = await fetch('index.php?action=getSettings');
            
            if (!response.ok) {
                throw new Error('获取设置失败');
            }
            
            appState.settings = await response.json();
            return appState.settings;
        } catch (error) {
            console.error('加载设置错误:', error);
            throw error;
        }
    }

    /**
     * 切换视图
     * @param {string} viewName - 视图名称 ('gallery' 或 'settings')
     */
    function switchView(viewName) {
        if (viewName !== 'gallery' && viewName !== 'settings') {
            return;
        }
        
        appState.currentView = viewName;
        
        // 更新视图显示状态
        elements.galleryView.classList.toggle('active', viewName === 'gallery');
        elements.settingsView.classList.toggle('active', viewName === 'settings');
        
        // 更新按钮激活状态
        elements.galleryBtn.classList.toggle('active', viewName === 'gallery');
        elements.settingsBtn.classList.toggle('active', viewName === 'settings');
        
        // 如果切换到画廊，刷新图片列表
        if (viewName === 'gallery' && typeof refreshGallery === 'function') {
            refreshGallery();
        }
    }

    /**
     * 显示通知
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型 ('success', 'error' 或 'info')
     * @param {number} duration - 显示时长(毫秒)，默认3000
     */
    function showNotification(message, type = 'info', duration = 3000) {
        const notification = elements.notification;
        
        // 设置通知内容和类型
        notification.textContent = message;
        notification.className = 'notification';
        notification.classList.add(type, 'show');
        
        // 自动隐藏
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
    }

    /**
     * 显示加载指示器
     */
    function showLoader() {
        appState.isLoading = true;
        elements.loader.classList.add('show');
    }

    /**
     * 隐藏加载指示器
     */
    function hideLoader() {
        appState.isLoading = false;
        elements.loader.classList.remove('show');
    }

    /**
     * 刷新缓存并重新加载数据
     */
    async function refreshCache() {
        if (appState.isLoading) return;
        
        showLoader();
        
        try {
            const response = await fetch('index.php?action=refreshCache');
            
            if (!response.ok) {
                throw new Error('刷新缓存失败');
            }
            
            const result = await response.json();
            
            if (result.success) {
                showNotification(result.message, 'success');
                
                // 刷新画廊
                if (typeof refreshGallery === 'function') {
                    refreshGallery();
                }
            } else {
                showNotification(result.error || '刷新缓存失败', 'error');
            }
        } catch (error) {
            showNotification('刷新缓存时出错: ' + error.message, 'error');
            console.error('刷新缓存错误:', error);
        } finally {
            hideLoader();
        }
    }

    /**
     * 设置事件监听器
     */
    function setupEventListeners() {
        // 视图切换按钮
        elements.galleryBtn.addEventListener('click', () => switchView('gallery'));
        elements.settingsBtn.addEventListener('click', () => switchView('settings'));
        
        // 刷新缓存按钮
        elements.refreshBtn.addEventListener('click', refreshCache);
        
        // 监听设置保存事件，以便更新应用状态
        document.addEventListener('settingsSaved', async (e) => {
            appState.settings = e.detail;
            showNotification('设置已保存', 'success');
            
            // 如果当前在画廊视图，刷新图片
            if (appState.currentView === 'gallery' && typeof refreshGallery === 'function') {
                refreshGallery();
            }
        });
    }

    // 暴露一些方法供其他模块使用
    window.app = {
        showNotification,
        showLoader,
        hideLoader,
        getSettings: () => ({ ...appState.settings }),
        switchView
    };

    // 初始化应用
    initApp();
});
