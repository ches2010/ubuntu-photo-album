/**
 * 应用入口文件
 * 初始化相册和设置模块
 */
import Gallery from './gallery.js';
import Settings from './settings.js';

// 初始化主题
function initTheme() {
    // 检查是否有保存的主题偏好
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // 应用主题
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark-theme');
    } else {
        document.documentElement.classList.remove('dark-theme');
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 初始化主题
    initTheme();
    
    try {
        // 初始化相册模块
        const gallery = new Gallery();
        
        // 初始化设置模块，并传入相册实例引用
        const settings = new Settings(gallery);
        
        // 加载图片
        gallery.loadImages();
    } catch (error) {
        console.error('应用初始化失败:', error);
        // 显示错误信息给用户
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); padding: 15px; background: #ff4444; color: white; border-radius: 4px; z-index: 1000;';
        errorDiv.textContent = '应用加载失败: ' + error.message;
        document.body.appendChild(errorDiv);
        
        // 3秒后自动隐藏错误信息
        setTimeout(() => {
            errorDiv.style.opacity = '0';
            errorDiv.style.transition = 'opacity 0.5s';
            setTimeout(() => errorDiv.remove(), 500);
        }, 3000);
    }
});
    
