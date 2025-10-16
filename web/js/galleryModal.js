// web/js/galleryModal.js - 模态框相关逻辑
class GalleryModal {
    constructor(core, elements) {
        this.core = core;
        this.elements = elements;
    }

    async openImageModal(image) {
        if (!image || !image.path) {
            console.error('无效的图片对象:', image);
            window.app?.showNotification('无效的图片数据', 'error');
            return;
        }
        
        this.core.setState({ currentImage: image });
        this.resetImageTransform();

        const imageModal = this.elements.get('imageModal');
        const modalImage = this.elements.get('modalImage');
        
        if (!imageModal || !modalImage) {
            console.error('模态框元素缺失，请检查DOM结构');
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
            this.elements.get('modalTitle').textContent = this.escapeHtml(image.name || '未知图片');
            this.elements.get('modalSize').textContent = `大小: ${image.sizeFormatted || '未知'}`;
            this.elements.get('modalDimensions').textContent = `尺寸: ${image.width || img.width} × ${image.height || img.height}`;
            this.elements.get('modalModified').textContent = `修改: ${image.modifiedFormatted || '未知时间'}`;
            this.elements.get('downloadLink').href = imageUrl;
            this.elements.get('downloadLink').download = image.filename || '未命名图片';
            
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
        imageModal.classList.remove('active');
        document.body.style.overflow = '';
        this.core.setState({ currentImage: null });
        this.resetImageTransform();
    }

    updateNavigationButtons() {
        const currentIndex = this.getCurrentImageIndex();
        const { images } = this.core.getState();
        const totalImages = images.length;
        const hasOnlyOneImage = totalImages <= 1;
        const isFirstImage = currentIndex === 0;
        const isLastImage = currentIndex === totalImages - 1;
        
        const prevImageBtn = this.elements.get('prevImageBtn');
        const nextImageBtn = this.elements.get('nextImageBtn');
        
        if (prevImageBtn) {
            prevImageBtn.disabled = hasOnlyOneImage || isFirstImage;
            prevImageBtn.classList.toggle('disabled', hasOnlyOneImage || isFirstImage);
        }
        
        if (nextImageBtn) {
            nextImageBtn.disabled = hasOnlyOneImage || isLastImage;
            nextImageBtn.classList.toggle('disabled', hasOnlyOneImage || isLastImage);
        }
    }

    getCurrentImageIndex() {
        const { currentImage, images } = this.core.getState();
        if (!currentImage || !images.length) {
            return -1;
        }
        
        return images.findIndex(
            img => img.path === currentImage.path
        );
    }

    showPreviousImage() {
        const currentIndex = this.getCurrentImageIndex();
        if (currentIndex <= 0) return;
        
        const { images } = this.core.getState();
        this.openImageModal(images[currentIndex - 1]);
    }

    showNextImage() {
        const currentIndex = this.getCurrentImageIndex();
        if (currentIndex === -1 || currentIndex >= images.length - 1) return;
        
        const { images } = this.core.getState();
        this.openImageModal(images[currentIndex + 1]);
    }

    showModalLoader() {
        const modalLoader = this.elements.get('modalLoader');
        if (modalLoader) {
            modalLoader.style.display = 'flex';
        } else {
            const modalImage = this.elements.get('modalImage');
            modalImage.classList.add('loading');
        }
    }

    hideModalLoader() {
        const modalLoader = this.elements.get('modalLoader');
        if (modalLoader) {
            modalLoader.style.display = 'none';
        } else {
            const modalImage = this.elements.get('modalImage');
            modalImage.classList.remove('loading');
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
        modalImage.style.transform = `rotate(${rotation}deg) scaleX(${flipX}) scaleY(${flipY})`;
    }

    handleImageAction(action) {
        const { currentImage } = this.core.getState();

        if (!currentImage) return;

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
                window.app.showNotification('无法切换全屏模式: + err.message, 'error');
            }
        }
    }

    handleKeyPress(e) {
        const imageModal = this.elements.get('imageModal');
        if (!imageModal.classList.contains('active')) return;

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
