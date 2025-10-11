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
    
    // 初始化相册模块
    const gallery = new Gallery();
    
    // 初始化设置模块，并传入相册实例引用
    const settings = new Settings(gallery);
    
    // 加载图片
    gallery.loadImages();
});
