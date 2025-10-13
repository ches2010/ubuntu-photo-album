/**
 * 画廊模块
 * 负责图片展示、分页、搜索、排序和预览功能
 */
function initGallery(settings) {
    // 画廊状态
    const galleryState = {
        currentPage: 1,
        totalPages: 1,
        imagesPerPage: 20,
        searchTerm: '',
        sortBy: 'name_asc',
        images: [],
        currentImage: null,
        transform: {
            rotation: 0,
            flipX: 1,
            flipY: 1
        }
    };

    // 更新配置
    updateSettings(settings);

    // DOM元素
    const elements = {
        gallery: document.getElementById('gallery'),
        prevPageBtn: document.getElementById('prevPage'),
        nextPageBtn: document.getElementById('nextPage'),
        pageInfo: document.getElementById('pageInfo'),
        pageJumpInput: document.getElementById('pageJumpInput'),
        jumpToPageBtn: document.getElementById('jumpToPageBtn'),
        searchInput: document.getElementById('searchInput'),
        searchBtn: document.getElementById('searchBtn'),
        sortSelect: document.getElementById('sortSelect'),
        imageModal: document.getElementById('imageModal'),
        modalImage: document.getElementById('modalImage'),
        modalTitle: document.getElementById('imageTitle'),
        modalSize: document.getElementById('imageSize'),
        modalDimensions: document.getElementById('imageDimensions'),
        modalModified: document.getElementById('imageModified'),
        downloadLink: document.getElementById('downloadLink'),
        modalActions: document.querySelectorAll('.modal-btn[data-action]'),
        modalLoader: document.getElementById('modalLoader') // 新增：模态框加载指示器
    };

    /**
     * 更新画廊设置
     * @param {Object} newSettings - 新的设置对象
     */
    function updateSettings(newSettings) {
        if (newSettings && newSettings.imagesPerRow) {
            // 更新网格布局
            elements.gallery.style.gridTemplateColumns = `repeat(${newSettings.imagesPerRow}, 1fr)`;
        }
        
        // 从设置中获取每页显示数量
        if (newSettings && newSettings.imagesPerPage) {
            galleryState.imagesPerPage = newSettings.imagesPerPage;
        }
    }

    /**
     * 加载图片列表
     */
    async function loadImages() {
        if (window.app && window.app.showLoader) {
            window.app.showLoader();
        }

        try {
            const params = new URLSearchParams({
                action: 'getImages',
                page: galleryState.currentPage,
                perPage: galleryState.imagesPerPage,
                search: galleryState.searchTerm,
                sort: galleryState.sortBy
            });

            const response = await fetch(`index.php?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            const data = await response.json();

            galleryState.images = data.images || [];
            galleryState.totalPages = data.pagination?.totalPages || 1;

            renderGallery();
            updatePagination();
        } catch (error) {
            console.error('加载图片错误:', error);
            if (window.app && window.app.showNotification) {
                window.app.showNotification('加载图片失败: ' + error.message, 'error');
            }
        } finally {
            if (window.app && window.app.hideLoader) {
                window.app.hideLoader();
            }
        }
    }

    /**
     * 渲染画廊
     */
    function renderGallery() {
        elements.gallery.innerHTML = '';

        if (galleryState.images.length === 0) {
            elements.gallery.innerHTML = `
                <div class="no-images">
                    <p>没有找到图片</p>
                    ${galleryState.searchTerm ? `<p>尝试修改搜索条件或检查图片路径设置</p>` : ''}
                </div>
            `;
            return;
        }

        galleryState.images.forEach(image => {
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';
            
            // 使用服务器生成的缩略图URL，添加新图片标记
            galleryItem.innerHTML = `
                <div class="gallery-item-image-container">
                    <img 
                        src="${getThumbnail(image.path)}" 
                        alt="${escapeHtml(image.name)}" 
                        class="gallery-item-image"
                        loading="lazy"
                        onload="this.classList.add('loaded')"
                        onerror="this.src='web/images/error-placeholder.png'"
                    >
                    ${image.isNew ? '<span class="new-badge">新</span>' : ''}
                    <div class="image-loading-indicator"></div>
                </div>
                <div class="gallery-item-info">
                    <div class="gallery-item-name">${truncateText(escapeHtml(image.name), 20)}</div>
                    <div class="gallery-item-meta">
                        <span>${image.sizeFormatted}</span>
                        <span>${new Date(image.modified * 1000).toLocaleDateString()}</span>
                    </div>
                </div>
            `;

            galleryItem.addEventListener('click', () => openImageModal(image));
            elements.gallery.appendChild(galleryItem);
        });
    }

    /**
     * 截断长文本
     * @param {string} text - 需要截断的文本
     * @param {number} maxLength - 最大长度
     * @returns {string} 截断后的文本
     */
    function truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * 获取图片缩略图URL
     * @param {string} path - 图片路径
     * @returns {string} 缩略图URL
     */
    function getThumbnail(path) {        
        try {
            // 标准化路径，处理特殊字符
            const normalizedPath = path.replace(/\\/g, '/').replace(/\/+/g, '/');
            return `index.php?action=getThumbnail&path=${encodeURIComponent(normalizedPath)}`;
        } catch (e) {
            console.error('路径编码错误:', e);
            return 'web/images/error-placeholder.png';
        }
    }

    /**
     * 更新分页控件
     */
    function updatePagination() {
        elements.pageInfo.textContent = `第 ${galleryState.currentPage} / ${galleryState.totalPages} 页`;
        elements.prevPageBtn.disabled = galleryState.currentPage <= 1;
        elements.nextPageBtn.disabled = galleryState.currentPage >= galleryState.totalPages;
        elements.pageJumpInput.value = galleryState.currentPage;
        elements.pageJumpInput.max = galleryState.totalPages;
    }

    /**
     * 打开图片预览模态框
     * @param {Object} image - 图片信息对象
     */
    async function openImageModal(image) {
        galleryState.currentImage = image;
        resetImageTransform();

        // 显示加载状态
        showModalLoader();
        elements.modalImage.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFeAJ5gMm5gAAAABJRU5ErkJggg==';
        
        try {
            // 修复Base64图片路径编码
            let imagePath = image.path;
            try {
                imagePath = decodeURIComponent(imagePath);
            } catch (e) {
                console.error('解码图片路径失败:', e);
            }
            
            // 获取Base64编码的原图
            const base64Image = await getBase64Image(imagePath);
            
            // 更新模态框内容
            elements.modalImage.src = base64Image;
            elements.modalTitle.textContent = escapeHtml(image.name);
            elements.modalSize.textContent = `大小: ${image.sizeFormatted}`;
            elements.modalDimensions.textContent = `尺寸: ${image.width} × ${image.height}`;
            elements.modalModified.textContent = `修改: ${image.modifiedFormatted}`;
            elements.downloadLink.href = base64Image;
            elements.downloadLink.download = image.filename;
        } catch (error) {
            console.error('加载图片预览失败:', error);
            if (window.app && window.app.showNotification) {
                window.app.showNotification('无法加载图片: ' + error.message, 'error');
            }
            elements.modalImage.src = 'web/images/error-placeholder.png';
        } finally {
            hideModalLoader();
        }

        // 显示模态框
        elements.imageModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * 显示模态框加载指示器
     */
    function showModalLoader() {
        if (elements.modalLoader) {
            elements.modalLoader.style.display = 'flex';
        } else {
            // 如果没有专门的加载器，使用图片占位
            elements.modalImage.classList.add('loading');
        }
    }

    /**
     * 隐藏模态框加载指示器
     */
    function hideModalLoader() {
        if (elements.modalLoader) {
            elements.modalLoader.style.display = 'none';
        } else {
            elements.modalImage.classList.remove('loading');
        }
    }

    /**
     * 获取当前图片在列表中的索引
     * @returns {number} 图片索引
     */
    function getCurrentImageIndex() {
        if (!galleryState.currentImage || !galleryState.images.length) return -1;
        
        return galleryState.images.findIndex(
            img => img.path === galleryState.currentImage.path
        );
    }

    /**
     * 查看上一张图片
     */
    function showPreviousImage() {
        const currentIndex = getCurrentImageIndex();
        if (currentIndex === -1) return;
        
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : galleryState.images.length - 1;
        openImageModal(galleryState.images[prevIndex]);
    }

    /**
     * 查看下一张图片
     */
    function showNextImage() {
        const currentIndex = getCurrentImageIndex();
        if (currentIndex === -1) return;
        
        const nextIndex = currentIndex < galleryState.images.length - 1 ? currentIndex + 1 : 0;
        openImageModal(galleryState.images[nextIndex]);
    }

    /**
     * 获取图片的Base64编码
     * @param {string} path - 图片路径
     * @returns {Promise<string>} 包含Base64编码的Promise对象
     */
    async function getBase64Image(path) {
        try {
            // 调用服务器接口获取Base64编码
            const normalizedPath = path.replace(/\\/g, '/').replace(/\/+/g, '/');
            const response = await fetch(`index.php?action=getBase64Image&path=${encodeURIComponent(normalizedPath)}`);

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }

            // 返回完整的Base64图片格式
            return `data:${result.mimeType};base64,${result.base64}`;
        } catch (error) {
            console.error('获取Base64图片错误:', error);
            // 失败时返回默认占位图
            return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        }
    }

    /**
     * 关闭图片预览模态框
     */
    function closeImageModal() {
        // 退出全屏（如果处于全屏状态）
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {
                console.error('退出全屏失败:', err);
            });
        }
        
        elements.imageModal.classList.remove('active');
        document.body.style.overflow = '';
        galleryState.currentImage = null;
        resetImageTransform();
    }

    /**
     * 重置图片变换
     */
    function resetImageTransform() {
        galleryState.transform = {
            rotation: 0,
            flipX: 1,
            flipY: 1
        };
        applyTransformations();
    }

    /**
     * 应用所有图片变换（旋转、翻转）
     * 分离出来的变换应用逻辑
     */
    function applyTransformations() {
        const { rotation, flipX, flipY } = galleryState.transform;
        elements.modalImage.style.transform = `rotate(${rotation}deg) scaleX(${flipX}) scaleY(${flipY})`;
    }

    /**
     * 处理图片变换动作
     * @param {string} action - 动作类型 ('rotateLeft', 'rotateRight', 'flipHorizontal', 'flipVertical', 'fullscreen')
     */
    function handleImageAction(action) {
        if (!galleryState.currentImage) return;

        switch (action) {
            case 'rotateLeft':
                galleryState.transform.rotation = (galleryState.transform.rotation - 90) % 360;
                break;
            case 'rotateRight':
                galleryState.transform.rotation = (galleryState.transform.rotation + 90) % 360;
                break;
            case 'flipHorizontal':
                galleryState.transform.flipX *= -1;
                break;
            case 'flipVertical':
                galleryState.transform.flipY *= -1;
                break;
            case 'fullscreen':
                toggleFullscreen();
                return;
            default:
                return;
        }

        applyTransformations();
    }

    /**
     * 切换全屏模式
     */
    function toggleFullscreen() {
        try {
            if (!document.fullscreenElement) {
                if (elements.imageModal.requestFullscreen) {
                    elements.imageModal.requestFullscreen();
                } else if (elements.imageModal.webkitRequestFullscreen) { /* Safari */
                    elements.imageModal.webkitRequestFullscreen();
                } else if (elements.imageModal.msRequestFullscreen) { /* IE11 */
                    elements.imageModal.msRequestFullscreen();
                }
                // 添加全屏状态类
                elements.imageModal.classList.add('fullscreen');
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) { /* Safari */
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) { /* IE11 */
                    document.msExitFullscreen();
                }
                // 移除全屏状态类
                elements.imageModal.classList.remove('fullscreen');
            }
        } catch (err) {
            console.error(`全屏错误: ${err.message}`);
            if (window.app && window.app.showNotification) {
                window.app.showNotification('无法切换全屏模式: ' + err.message, 'error');
            }
        }
    }

    /**
     * 处理键盘事件
     * @param {Event} e - 键盘事件对象
     */
    function handleKeyPress(e) {
        if (!elements.imageModal.classList.contains('active')) return;

        switch (e.key) {
            case 'Escape':
                // ESC键 - 关闭模态框，同时退出全屏
                e.preventDefault();
                closeImageModal();
                break;
            case 'ArrowLeft':
                // 左方向键 - 上一张图片
                e.preventDefault();
                showPreviousImage();
                break;
            case 'ArrowRight':
                // 右方向键 - 下一张图片
                e.preventDefault();
                showNextImage();
                break;
            case 'ArrowUp':
                // 上方向键 - 向左旋转
                e.preventDefault();
                handleImageAction('rotateLeft');
                break;
            case 'ArrowDown':
                // 下方向键 - 向右旋转
                e.preventDefault();
                handleImageAction('rotateRight');
                break;
            case 'h':
            case 'H':
                // H键 - 水平翻转
                e.preventDefault();
                handleImageAction('flipHorizontal');
                break;
            case 'v':
            case 'V':
                // V键 - 垂直翻转
                e.preventDefault();
                handleImageAction('flipVertical');
                break;
            case 'f':
            case 'F':
                // F键 - 全屏切换
                e.preventDefault();
                handleImageAction('fullscreen');
                break;
            case ' ':
            case 'Enter':
                e.preventDefault();
                break;
        }
    }

    /**
     * 跳转到指定页
     * @param {number} page - 页码
     */
    function goToPage(page) {
        if (page < 1 || page > galleryState.totalPages) return;
        
        galleryState.currentPage = page;
        loadImages();
    }

    /**
     * 搜索图片
     * @param {string} term - 搜索词
     */
    function searchImages(term) {
        galleryState.searchTerm = term;
        galleryState.currentPage = 1; // 重置到第一页
        loadImages();
    }

    /**
     * 排序图片
     * @param {string} sortBy - 排序方式
     */
    function sortImages(sortBy) {
        galleryState.sortBy = sortBy;
        galleryState.currentPage = 1; // 重置到第一页
        loadImages();
    }

    /**
     * HTML转义，防止XSS攻击
     * @param {string} str - 需要转义的字符串
     * @returns {string} 转义后的字符串
     */
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * 设置事件监听器
     */
    function setupEventListeners() {
        // 分页按钮
        elements.prevPageBtn.addEventListener('click', () => goToPage(galleryState.currentPage - 1));
        elements.nextPageBtn.addEventListener('click', () => goToPage(galleryState.currentPage + 1));
        elements.jumpToPageBtn.addEventListener('click', () => goToPage(parseInt(elements.pageJumpInput.value) || 1));
        elements.pageJumpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                goToPage(parseInt(elements.pageJumpInput.value) || 1);
            }
        });

        // 搜索和排序
        elements.searchBtn.addEventListener('click', () => searchImages(elements.searchInput.value));
        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchImages(elements.searchInput.value);
            }
        });
        elements.sortSelect.addEventListener('change', () => sortImages(elements.sortSelect.value));

        // 模态框关闭按钮
        const closeBtn = elements.imageModal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeImageModal);
        }

        // 点击模态框背景关闭
        elements.imageModal.addEventListener('click', (e) => {
            // 检查点击的是模态框背景而非内容
            if (e.target === elements.imageModal) {
                closeImageModal();
            }
        });

        // 图片操作按钮
        elements.modalActions.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                handleImageAction(action);
            });
        });

        // 键盘事件
        document.addEventListener('keydown', handleKeyPress);

        // 监听全屏状态变化
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                elements.imageModal.classList.remove('fullscreen');
            }
        });

        // 监听设置变化事件
        document.addEventListener('settingsSaved', (e) => {
            updateSettings(e.detail);
            // 设置变化后重新加载图片
            loadImages();
        });
    }

    // 设置事件监听
    setupEventListeners();

    // 暴露一些方法供其他模块使用
    window.refreshGallery = loadImages;

    // 初始加载图片
    loadImages();
}
    
