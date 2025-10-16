// web/js/galleryModal.js - 模态框相关逻辑
class GalleryModal {
    constructor(core, elements) {
        this.core = core;
        this.elements = elements;
        this.zoomLevel = 1; // 默认缩放级别
        this.minZoom = 0.1; // 最小缩放比例
        this.maxZoom = 5;   // 最大缩放比例
        this.zoomStep = 0.1; // 每次缩放步长
        
        // 绑定事件处理函数的上下文
        this.showPreviousImage = this.showPreviousImage.bind(this);
        this.showNextImage = this.showNextImage.bind(this);
        this.handleDeleteImage = this.handleDeleteImage.bind(this);
        this.handleWheelZoom = this.handleWheelZoom.bind(this);
        
        // 验证必要元素是否存在
        this.validateRequiredElements();
        
        // 初始化时绑定按钮事件
        this.bindNavigationEvents();
        this.bindZoomEvents();
    }

    // 绑定缩放相关事件
    bindZoomEvents() {
        const modalImageContainer = this.elements.get('modalImage').parentElement;
        if (modalImageContainer) {
            modalImageContainer.addEventListener('wheel', this.handleWheelZoom);
        }
    }

    // 处理鼠标滚轮缩放
    handleWheelZoom(e) {
        e.preventDefault();
        
        // 判断滚轮方向
        if (e.deltaY < 0) {
            // 向上滚动 - 放大
            this.zoomIn();
        } else {
            // 向下滚动 - 缩小
            this.zoomOut();
        }
    }

    // 放大图片
    zoomIn() {
        if (this.zoomLevel < this.maxZoom) {
            this.zoomLevel += this.zoomStep;
            this.applyZoom();
        }
    }

    // 缩小图片
    zoomOut() {
        if (this.zoomLevel > this.minZoom) {
            this.zoomLevel -= this.zoomStep;
            this.applyZoom();
        }
    }

    // 应用缩放
    applyZoom() {
        const modalImage = this.elements.get('modalImage');
        if (modalImage) {
            // 获取当前的变换信息
            const { transform } = this.core.getState();
            const { rotation, flipX, flipY } = transform;
            
            // 应用缩放和其他变换
            modalImage.style.transform = 
                `rotate(${rotation}deg) scaleX(${flipX}) scaleY(${flipY}) scale(${this.zoomLevel})`;
            
            // 显示当前缩放比例（可选）
            console.log(`缩放级别: ${this.zoomLevel.toFixed(1)}x`);
        }
    }

    // 重置缩放
    resetZoom() {
        this.zoomLevel = 1;
        this.applyZoom();
    }

    // 处理图片删除
    async handleDeleteImage() {
        const { currentImage } = this.core.getState();
        if (!currentImage || !currentImage.path) {
            return;
        }
        
        // 确认删除
        const confirmDelete = confirm(`确定要删除图片 "${currentImage.name}" 吗？此操作不可恢复。`);
        if (!confirmDelete) {
            return;
        }
        
        try {
            // 显示加载状态
            this.showModalLoader();
            
            // 发送删除请求到服务器
            const normalizedPath = currentImage.path
                .replace(/\\/g, '/')
                .replace(/\/+/g, '/');
            const encodedPath = encodeURIComponent(normalizedPath);
            
            const response = await fetch(`index.php?action=deleteImage&path=${encodedPath}`, {
                method: 'DELETE',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                // 关闭模态框
                this.closeImageModal();
                
                // 通知核心删除了图片，并刷新画廊
                this.core.removeImage(currentImage.path);
                this.core.refreshGallery();
                
                // 显示成功消息
                window.app?.showNotification('图片已成功删除', 'success');
            } else {
                throw new Error(result.message || '删除图片失败');
            }
        } catch (error) {
            console.error('删除图片错误:', error);
            window.app?.showNotification('删除失败: ' + error.message, 'error');
        } finally {
            this.hideModalLoader();
        }
    }

    // 验证必要的DOM元素是否存在
    validateRequiredElements() {
        const requiredElements = [
            'imageModal', 
            'modalImage', 
            'prevImageBtn', 
            'nextImageBtn',
            'modalTitle',
            'modalSize',
            'modalDimensions',
            'modalModified',
            'downloadLink'
        ];
        
        const missingElements = [];
        
        requiredElements.forEach(elementId => {
            if (!this.elements.get(elementId)) {
                missingElements.push(elementId);
            }
        });
        
        if (missingElements.length > 0) {
            console.error('缺失必要的模态框元素:', missingElements);
            window.app?.showNotification(
                `图片预览功能异常: 缺少必要组件`, 
                'error'
            );
        }
    }

    // 绑定导航按钮事件
    bindNavigationEvents() {
        const prevBtn = this.elements.get('prevImageBtn');
        const nextBtn = this.elements.get('nextImageBtn');
        const deleteBtn = document.querySelector('.modal-btn.delete');
        
        // 上一张按钮
        if (prevBtn) {
            prevBtn.removeEventListener('click', this.showPreviousImage);
            prevBtn.addEventListener('click', this.showPreviousImage);
        } else {
            console.warn('上一张按钮元素(prevImageBtn)未找到，无法绑定事件');
        }
        
        // 下一张按钮
        if (nextBtn) {
            nextBtn.removeEventListener('click', this.showNextImage);
            nextBtn.addEventListener('click', this.showNextImage);
        } else {
            console.warn('下一张按钮元素(nextImageBtn)未找到，无法绑定事件');
        }
        
        // 删除按钮
        if (deleteBtn) {
            deleteBtn.removeEventListener('click', this.handleDeleteImage);
            deleteBtn.addEventListener('click', this.handleDeleteImage);
        } else {
            console.warn('删除按钮元素未找到，无法绑定事件');
        }
    }

    async openImageModal(image) {
        if (!image || !image.path) {
            console.error('无效的图片对象:', image);
            window.app?.showNotification('无效的图片数据', 'error');
            return;
        }
        
        // 重置缩放级别
        this.resetZoom();
        
        // 检查模态框主元素是否存在
        const imageModal = this.elements.get('imageModal');
        if (!imageModal) {
            console.error('模态框主元素(imageModal)不存在');
            return;
        }
        
        this.core.setState({ currentImage: image });
        this.resetImageTransform();

        const modalImage = this.elements.get('modalImage');
        
        if (!modalImage) {
            console.error('模态框图片元素(modalImage)缺失');
            window.app?.showNotification('图片预览功能不可用', 'error');
            return;
        }

        this.showModalLoader();
        modalImage.src = 'web/images/loading.png';
        imageModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        try {
            let normalizedPath = image.path
                .replace(/\\/g, '/')
                .replace(/\/+/g, '/');
            
            if (normalizedPath.includes(':')) {
                normalizedPath = normalizedPath.split(':').slice(1).join(':');
            }
            
            const encodedPath = encodeURIComponent(normalizedPath);
            const imageUrl = `index.php?action=getImage&path=${encodedPath}`;
            
            console.log('尝试加载原图:', imageUrl);
            console.log('原始路径:', image.path);
            console.log('标准化路径:', normalizedPath);
            
            const img = new Image();
            img.src = imageUrl;
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => {
                    reject(new Error(`无法加载图片: ${imageUrl}\n可能原因: 路径错误或文件不存在`));
                };
            });
            
            modalImage.src = imageUrl;
            
            // 安全更新模态框信息，检查元素是否存在
            const modalTitle = this.elements.get('modalTitle');
            if (modalTitle) modalTitle.textContent = this.escapeHtml(image.name || '未知图片');
            
            const modalSize = this.elements.get('modalSize');
            if (modalSize) modalSize.textContent = `大小: ${image.sizeFormatted || '未知'}`;
            
            const modalDimensions = this.elements.get('modalDimensions');
            if (modalDimensions) modalDimensions.textContent = `尺寸: ${image.width || img.width} × ${image.height || img.height}`;
            
            const modalModified = this.elements.get('modalModified');
            if (modalModified) modalModified.textContent = `修改: ${image.modifiedFormatted || '未知时间'}`;
            
            const downloadLink = this.elements.get('downloadLink');
            if (downloadLink) {
                downloadLink.href = imageUrl;
                downloadLink.download = image.filename || '未命名图片';
            }
            
            this.updateNavigationButtons();
        } catch (error) {
            console.error('加载图片预览失败:', error);
            window.app?.showNotification('无法加载图片: ' + error.message, 'error');
            modalImage.src = 'web/images/error-placeholder.png';
        } finally {
            this.hideModalLoader();
        }
    }

    closeImageModal() {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {
                console.error('退出全屏失败:', err);
            });
        }
        
        const imageModal = this.elements.get('imageModal');
        if (imageModal) {
            imageModal.classList.remove('active');
        }
        document.body.style.overflow = '';
        this.core.setState({ currentImage: null });
        this.resetImageTransform();
    }

    updateNavigationButtons() {
        const prevImageBtn = this.elements.get('prevImageBtn');
        const nextImageBtn = this.elements.get('nextImageBtn');
        
        // 检查按钮元素是否存在
        if (!prevImageBtn || !nextImageBtn) {
            console.error('导航按钮元素缺失: ' + 
                (prevImageBtn ? '' : 'prevImageBtn ') + 
                (nextImageBtn ? '' : 'nextImageBtn'));
            return;
        }
        
        const currentIndex = this.getCurrentImageIndex();
        const { images } = this.core.getState();
        const totalImages = images ? images.length : 0;
        
        // 更新按钮状态
        const canGoPrev = totalImages > 1 && currentIndex > 0;
        const canGoNext = totalImages > 1 && currentIndex < totalImages - 1;
        
        prevImageBtn.disabled = !canGoPrev;
        prevImageBtn.classList.toggle('disabled', !canGoPrev);
        prevImageBtn.style.opacity = canGoPrev ? '1' : '0.5';
        prevImageBtn.style.cursor = canGoPrev ? 'pointer' : 'not-allowed';
        
        nextImageBtn.disabled = !canGoNext;
        nextImageBtn.classList.toggle('disabled', !canGoNext);
        nextImageBtn.style.opacity = canGoNext ? '1' : '0.5';
        nextImageBtn.style.cursor = canGoNext ? 'pointer' : 'not-allowed';
    }

    getCurrentImageIndex() {
        const { currentImage, images } = this.core.getState();
        if (!currentImage || !images || !images.length) {
            return -1;
        }
        
        return images.findIndex(
            img => img.path === currentImage.path
        );
    }

    showPreviousImage() {
        // 先检查按钮是否存在
        if (!this.elements.get('prevImageBtn')) {
            console.error('上一张按钮元素不存在，无法执行导航');
            return;
        }
        
        const { images } = this.core.getState();
        if (!images || images.length <= 1) {
            console.log('没有足够的图片用于导航');
            return;
        }
        
        const currentIndex = this.getCurrentImageIndex();
        if (currentIndex <= 0 || currentIndex === -1) {
            console.log('已经是第一张图片');
            return;
        }
        
        console.log(`导航到上一张图片，当前索引: ${currentIndex}, 目标索引: ${currentIndex - 1}`);
        this.openImageModal(images[currentIndex - 1]);
    }

    showNextImage() {
        // 先检查按钮是否存在
        if (!this.elements.get('nextImageBtn')) {
            console.error('下一张按钮元素不存在，无法执行导航');
            return;
        }
        
        const { images } = this.core.getState();
        if (!images || images.length <= 1) {
            console.log('没有足够的图片用于导航');
            return;
        }
        
        const currentIndex = this.getCurrentImageIndex();
        if (currentIndex === -1 || currentIndex >= images.length - 1) {
            console.log('已经是最后一张图片');
            return;
        }
        
        console.log(`导航到下一张图片，当前索引: ${currentIndex}, 目标索引: ${currentIndex + 1}`);
        this.openImageModal(images[currentIndex + 1]);
    }

    showModalLoader() {
        const modalLoader = this.elements.get('modalLoader');
        if (modalLoader) {
            modalLoader.style.display = 'flex';
        } else {
            const modalImage = this.elements.get('modalImage');
            if (modalImage) modalImage.classList.add('loading');
        }
    }

    hideModalLoader() {
        const modalLoader = this.elements.get('modalLoader');
        if (modalLoader) {
            modalLoader.style.display = 'none';
        } else {
            const modalImage = this.elements.get('modalImage');
            if (modalImage) modalImage.classList.remove('loading');
        }
    }

    resetImageTransform() {
        this.core.setState({
            transform: {
                rotation: 0,
                flipX: 1,
                flipY: 1
            }
        });
        this.applyTransformations();
    }

    applyTransformations() {
        const { transform } = this.core.getState();
        const { rotation, flipX, flipY } = transform;
        const modalImage = this.elements.get('modalImage');
        if (modalImage) {
            // 应用所有变换（包括缩放）
            modalImage.style.transform = 
                `rotate(${rotation}deg) scaleX(${flipX}) scaleY(${flipY}) scale(${this.zoomLevel})`;
        }
    }

    handleImageAction(action) {
        const { currentImage } = this.core.getState();
        if (!currentImage) return;

        // 处理缩放相关操作
        switch (action) {
            case 'zoomIn':
                this.zoomIn();
                return;
            case 'zoomOut':
                this.zoomOut();
                return;
            case 'resetZoom':
                this.resetZoom();
                return;
            case 'delete':
                this.handleDeleteImage();
                return;
        }

        const { transform } = this.core.getState();
        let newTransform = { ...transform };

        switch (action) {
            case 'rotateLeft':
                newTransform.rotation = (newTransform.rotation - 90) % 360;
                break;
            case 'rotateRight':
                newTransform.rotation = (newTransform.rotation + 90) % 360;
                break;
            case 'flipHorizontal':
                newTransform.flipX *= -1;
                break;
            case 'flipVertical':
                newTransform.flipY *= -1;
                break;
            case 'fullscreen':
                this.toggleFullscreen();
                return;
            default:
                return;
        }

        this.core.setState({ transform: newTransform });
        this.applyTransformations();
    }

    toggleFullscreen() {
        const imageModal = this.elements.get('imageModal');
        if (!imageModal) {
            console.error('模态框元素不存在，无法切换全屏');
            return;
        }
        
        try {
            if (!document.fullscreenElement) {
                if (imageModal.requestFullscreen) {
                    imageModal.requestFullscreen();
                } else if (imageModal.webkitRequestFullscreen) { /* Safari */
                    imageModal.webkitRequestFullscreen();
                } else if (imageModal.msRequestFullscreen) { /* IE11 */
                    imageModal.msRequestFullscreen();
                }
                imageModal.classList.add('fullscreen');
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) { /* Safari */
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) { /* IE11 */
                    document.msExitFullscreen();
                }
                imageModal.classList.remove('fullscreen');
            }
        } catch (err) {
            console.error(`全屏错误: ${err.message}`);
            if (window.app && window.app.showNotification) {
                window.app.showNotification('无法切换全屏模式: ' + err.message, 'error');
            }
        }
    }

    handleKeyPress(e) {
        const imageModal = this.elements.get('imageModal');
        if (!imageModal || !imageModal.classList.contains('active')) return;

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                this.closeImageModal();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.showPreviousImage();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.showNextImage();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.handleImageAction('rotateLeft');
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.handleImageAction('rotateRight');
                break;
            case 'h':
            case 'H':
                e.preventDefault();
                this.handleImageAction('flipHorizontal');
                break;
            case 'v':
            case 'V':
                e.preventDefault();
                this.handleImageAction('flipVertical');
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                this.handleImageAction('fullscreen');
                break;
            case '+':
            case '=':
                e.preventDefault();
                this.zoomIn();
                break;
            case '-':
                e.preventDefault();
                this.zoomOut();
                break;
            case '0':
                e.preventDefault();
                this.resetZoom();
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                this.handleDeleteImage();
                break;
            case ' ':
            case 'Enter':
                e.preventDefault();
                break;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
