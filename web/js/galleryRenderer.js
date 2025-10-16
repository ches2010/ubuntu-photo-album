// web/js/galleryRenderer.js - 画廊渲染逻辑
class GalleryRenderer {
    constructor(core, elements) {
        this.core = core;
        this.elements = elements;
    }

    renderGallery() {
        const { images } = this.core.getState();
        const gallery = this.elements.get('gallery');

        if (!gallery) {
            console.error('画廊容器不存在，请检查HTML中的#gallery元素');
            return;
        }

        gallery.innerHTML = '<div class="gallery-loading"><i class="fas fa-spinner fa-spin"></i> 加载图片中...</div>';

        if (!Array.isArray(images)) {
            gallery.innerHTML = `
                <div class="no-images">
                    <p>图片数据格式错误</p>
                    <p>请刷新页面重试</p>
                    <button class="refresh-btn" onclick="window.refreshGallery()">
                        <i class="fas fa-sync-alt"></i> 刷新
                    </button>
                </div>
            `;
            return;
        }

        if (images.length === 0) {
            const { searchTerm } = this.core.getState();
            gallery.innerHTML = `
                <div class="no-images">
                    <p>没有找到图片</p>
                    ${searchTerm ? 
                        `<p>尝试修改搜索条件</p>` : 
                        `<p>请检查设置中的图片路径</p>`
                    }
                    <button class="refresh-btn" onclick="window.refreshGallery()">
                        <i class="fas fa-sync-alt"></i> 刷新图片
                    </button>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();

        images.forEach((image, index) => {
            if (!image || !image.path || !image.name) {
                console.warn('跳过无效的图片数据:', image);
                return;
            }

            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';
            
            let thumbnailUrl;
            try {
                const encodedPath = encodeURIComponent(image.path);
                thumbnailUrl = `index.php?action=getThumbnail&path=${encodedPath}`;
            } catch (e) {
                console.error('图片路径编码失败:', e, image.path);
                thumbnailUrl = 'web/images/error.png';
            }
            
            galleryItem.innerHTML = `
                <div class="gallery-item-image-container">
                    <img 
                        src="${thumbnailUrl}" 
                        alt="${this.escapeHtml(image.name || '未命名图片')}" 
                        class="gallery-item-image"
                        loading="lazy"
                        data-index="${index}"
                        data-path="${this.escapeHtml(image.path)}"
                    >
                    ${image.isNew ? '<span class="new-badge">新</span>' : ''}
                    <div class="image-loading-indicator"></div>
                </div>
                <div class="gallery-item-info">
                    <div class="gallery-item-name">${this.truncateText(this.escapeHtml(image.name || '未命名图片'), 20)}</div>
                    <div class="gallery-item-meta">
                        <span>${image.sizeFormatted || '未知大小'}</span>
                        <span>${image.modified ? new Date(image.modified * 1000).toLocaleDateString() : '未知时间'}</span>
                    </div>
                </div>
            `;

            const imgElement = galleryItem.querySelector('img');
            imgElement.addEventListener('error', function() {
                console.error(`无法加载缩略图: ${thumbnailUrl}`);
                this.src = 'web/images/error-placeholder.png';
                const errorMsg = document.createElement('div');
                errorMsg.className = 'image-error-msg';
                errorMsg.textContent = '图片加载失败';
                this.parentNode.appendChild(errorMsg);
            });

            (function(currentImage) {
                galleryItem.addEventListener('click', function(e) {
                    e.stopPropagation();
                    console.log('缩略图被点击，路径:', currentImage.path);
                    window.openImageModal(currentImage);
                });
            })(image);

            fragment.appendChild(galleryItem);
        });

        gallery.innerHTML = '';
        gallery.appendChild(fragment);
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
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
