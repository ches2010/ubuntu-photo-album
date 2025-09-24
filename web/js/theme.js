/**
 * 主题切换功能模块
 * 负责处理主题选择、应用和保存
 */
document.addEventListener('DOMContentLoaded', () => {
    const themeSelect = document.getElementById('themeSelect');
    
    // 如果存在主题选择器
    if (themeSelect) {
        // 加载保存的主题或使用默认主题
        loadSavedTheme();
        
        // 监听主题选择变化
        themeSelect.addEventListener('change', (e) => {
            applyTheme(e.target.value);
        });
    }
});

/**
 * 加载保存的主题
 */
function loadSavedTheme() {
    try {
        const savedTheme = localStorage.getItem('photoAlbumTheme');
        if (savedTheme) {
            applyTheme(savedTheme);
            // 更新选择器
            const themeSelect = document.getElementById('themeSelect');
            if (themeSelect) {
                themeSelect.value = savedTheme;
            }
        }
    } catch (error) {
        console.error('加载保存的主题失败:', error);
        // 使用默认主题
        applyTheme('light');
    }
}

/**
 * 应用指定的主题
 * @param {string} theme - 主题名称 (light, dark, sepia)
 */
function applyTheme(theme) {
    // 移除所有主题类
    document.documentElement.classList.remove('light', 'dark', 'sepia');
    
    // 添加选中的主题类
    if (['light', 'dark', 'sepia'].includes(theme)) {
        document.documentElement.classList.add(theme);
        
        // 保存主题偏好
        try {
            localStorage.setItem('photoAlbumTheme', theme);
        } catch (error) {
            console.error('保存主题偏好失败:', error);
        }
    } else {
        // 默认使用浅色主题
        document.documentElement.classList.add('light');
    }
}
