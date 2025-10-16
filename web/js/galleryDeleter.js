// web/js/galleryDeleter.js - 图片删除功能模块
class GalleryDeleter {
    constructor(core, elements) {
        this.core = core;
        this.elements = elements;
        
        // 绑定上下文
        this.deleteCurrentImage = this.deleteCurrentImage.bind(this);
        this.handleDeleteAction = this.handleDeleteAction.bind(this);
        
        // 初始化事件监听
        this.initEventListeners();
    }

    /**
     * 初始化删除相关的事件监听
     */
    initEventListeners() {
        const deleteBtn = this.elements.get('deleteBtn') || 
                         document.querySelector('.modal-btn.delete[data-action="delete"]');
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', this.handleDeleteAction);
        }
        
        // 监听键盘删除事件
        document.addEventListener('keydown', (e) => {
            const imageModal = this.elements.get('imageModal');
            if (imageModal && imageModal.classList.contains('active')) {
                // Delete键或Backspace键触发删除
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    this.handleDeleteAction();
                }
            }
        });
    }

    /**
     * 处理删除操作的入口
     */
    handleDeleteAction() {
        const { currentImage } = this.core.getState();
        
        if (!currentImage || !currentImage.path) {
            console.error('没有可删除的图片');
            window.app?.showNotification('无法删除：没有选中的图片', 'error');
            return;
        }
        
        this.confirmAndDelete(currentImage);
    }

    /**
     * 显示确认对话框并执行删除
     * @param {Object} image - 要删除的图片对象
     */
    confirmAndDelete(image) {
        // 显示确认对话框
        const confirmDelete = confirm(
            `确定要删除图片 "${image.name}" 吗？\n` +
            `此操作不可撤销，文件将被永久删除。`
        );
        
        if (confirmDelete) {
            this.deleteCurrentImage(image);
        }
    }

    /**
     * 执行删除图片的核心逻辑
     * @param {Object} image - 要删除的图片对象
     */
    async deleteCurrentImage(image) {
        try {
            // 显示加载状态
            this.core.setState({ isLoading: true });
            
            // 标准化路径
            let normalizedPath = image.path
                .replace(/\\/g, '/')
                .replace(/\/+/g, '/');
            
            if (normalizedPath.includes(':')) {
                normalizedPath = normalizedPath.split(':').slice(1).join(':');
            }
            
            const encodedPath = encodeURIComponent(normalizedPath);
            const deleteUrl = `index.php?action=deleteImage&path=${encodedPath}`;
            
            console.log(`尝试删除图片: ${deleteUrl}`);
            
            // 发送删除请求到服务器
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            const result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.message || `删除失败: HTTP状态码 ${response.status}`);
            }
            
            // 删除成功，更新本地数据
            const modal = window.galleryModal; // 假设模态框实例在全局可访问
            if (modal) {
                modal.closeImageModal();
            }
            
            // 从核心数据中移除图片
            this.core.removeImage(image.path);
            
            // 显示成功通知
            window.app?.showNotification(`图片 "${image.name}" 已成功删除`, 'success');
            console.log(`图片 "${image.name}" 已删除`);
            
        } catch (error) {
            console.error('删除图片失败:', error);
            window.app?.showNotification('删除失败: ' + error.message, 'error');
        } finally {
            // 隐藏加载状态
            this.core.setState({ isLoading: false });
        }
    }

    /**
     * 清理事件监听
     */
    destroy() {
        const deleteBtn = this.elements.get('deleteBtn') || 
                         document.querySelector('.modal-btn.delete[data-action="delete"]');
        
        if (deleteBtn) {
            deleteBtn.removeEventListener('click', this.handleDeleteAction);
        }
    }
}
