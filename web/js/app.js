/**
 * 应用入口文件
 * 初始化相册和设置模块
 */
// 等待DOM完全加载
document.addEventListener('DOMContentLoaded', () => {
    // 动态导入模块，确保加载顺序
    Promise.all([
        import('./gallery.js'),
        import('./settings.js')
    ]).then(([GalleryModule, SettingsModule]) => {
        try {
            // 初始化相册模块
            const gallery = new GalleryModule.default();
            
            // 初始化设置模块，并传入相册实例引用
            const settings = new SettingsModule.default(gallery);
            
            // 验证关键元素是否存在
            const criticalElements = [
                'imageGrid', 'refreshBtn', 'settingsBtn'
            ];
            
            criticalElements.forEach(id => {
                if (!document.getElementById(id)) {
                    console.warn(`关键元素 ${id} 不存在，可能导致功能异常`);
                }
            });
            
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
        }
    }).catch(error => {
        console.error('模块加载失败:', error);
        alert('无法加载必要的功能模块，请检查网络或重新部署应用');
    });
});
