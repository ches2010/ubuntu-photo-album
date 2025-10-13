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
        modalActions: document.querySelectorAll('.modal-btn[data-action]')
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
            
            // 使用服务器生成的缩略图URL
            galleryItem.innerHTML = `
                <img 
                    src="${getThumbnail(image.path)}" 
                    alt="${escapeHtml(image.name)}" 
                    class="gallery-item-image"
                    loading="lazy"
                    onload="this.classList.add('loaded')"
                >
                <div class="gallery-item-info">
                    <div class="gallery-item-name">${escapeHtml(image.name)}</div>
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
     * 获取图片缩略图URL
     * @param {string} path - 图片路径
     * @returns {string} 缩略图URL
     */
    function getThumbnail(path) {
        // 修复路径编码问题，确保特殊字符正确编码
        try {
            // 先解码再编码，处理可能的双重编码问题
            const decodedPath = decodeURIComponent(path);
            return `index.php?action=getThumbnail&path=${encodeURIComponent(decodedPath)}`;
        } catch (e) {
            console.error('路径编码错误:', e);
            return `index.php?action=getThumbnail&path=${encodeURIComponent(path)}`;
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
        }

        // 显示模态框
        elements.imageModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * 获取图片的Base64编码
     * @param {string} path - 图片路径
     * @returns {Promise<string>} 包含Base64编码的Promise对象
     */
    async function getBase64Image(path) {
        try {
            // 调用服务器接口获取Base64编码
            const response = await fetch(`index.php?action=getBase64Image&path=${encodeURIComponent(path)}`);

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
        applyImageTransform();
    }

    /**
     * 应用图片变换（旋转、翻转）
     */
    function applyImageTransform() {
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

        applyImageTransform();
    }

    /**
     * 切换全屏模式
     */
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            elements.imageModal.requestFullscreen().catch(err => {
                console.error(`全屏错误: ${err.message}`);
                if (window.app && window.app.showNotification) {
                    window.app.showNotification('无法进入全屏模式: ' + err.message, 'error');
                }
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
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
                closeImageModal();
                break;
            case 'ArrowLeft':
                handleImageAction('rotateLeft');
                break;
            case 'ArrowRight':
                handleImageAction('rotateRight');
                break;
            case 'h':
                handleImageAction('flipHorizontal');
                break;
            case 'v':
                handleImageAction('flipVertical');
                break;
            case 'f':
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
        elements.imageModal.querySelector('.close-btn').addEventListener('click', closeImageModal);

        // 点击模态框背景关闭
        elements.imageModal.addEventListener('click', (e) => {
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
