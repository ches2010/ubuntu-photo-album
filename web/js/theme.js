/**
 * 主题管理模块
 * 负责主题切换、保存和应用
 */
document.addEventListener('DOMContentLoaded', () => {
    // 初始化主题选择器
    initThemeSelector();
    // 加载保存的主题
    loadSavedTheme();
});

/**
 * 初始化主题选择器事件
 */
function initThemeSelector() {
    const themeSelector = document.getElementById('themeSelector');
    if (!themeSelector) {
        console.error('未找到主题选择器元素');
        return;
    }
    
    // 监听主题选择变化
    themeSelector.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        applyTheme(selectedTheme);
        saveThemePreference(selectedTheme);
    });
}

/**
 * 应用指定主题
 * @param {string} theme - 主题名称：'light'、'dark' 或 'vintage'
 */
function applyTheme(theme) {
    const root = document.documentElement;
    
    // 移除所有主题类
    root.classList.remove('theme-light', 'theme-dark', 'theme-vintage');
    
    // 添加选中的主题类
    switch(theme) {
        case 'dark':
            root.classList.add('theme-dark');
            break;
        case 'vintage':
            root.classList.add('theme-vintage');
            break;
        case 'light':
        default:
            root.classList.add('theme-light');
            break;
    }
    
    console.log(`已应用主题: ${theme}`);
}

/**
 * 保存主题偏好到本地存储
 * @param {string} theme - 主题名称
 */
function saveThemePreference(theme) {
    try {
        localStorage.setItem('photoAlbumTheme', theme);
        console.log(`已保存主题偏好: ${theme}`);
    } catch (e) {
        console.error('保存主题偏好失败:', e);
    }
}

/**
 * 加载保存的主题偏好
 */
function loadSavedTheme() {
    try {
        const savedTheme = localStorage.getItem('photoAlbumTheme');
        const themeSelector = document.getElementById('themeSelector');
        
        // 如果有保存的主题，应用它
        if (savedTheme) {
            applyTheme(savedTheme);
            // 更新选择器
            if (themeSelector) {
                themeSelector.value = savedTheme;
            }
        } else if (themeSelector) {
            // 如果没有保存的主题，应用默认选择的主题
            applyTheme(themeSelector.value);
        }
    } catch (e) {
        console.error('加载主题偏好失败:', e);
        // 加载失败时应用默认主题
        applyTheme('light');
    }
}
