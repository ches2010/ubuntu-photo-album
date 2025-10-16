// web/js/galleryLoader.js - 图片加载逻辑
class GalleryLoader {
    constructor(core, elements, renderer) {
        this.core = core;
        this.elements = elements;
        this.renderer = renderer;
    }

    async loadImages() {
        if (window.app && window.app.showLoader) {
            window.app.showLoader();
        }

        try {
            const { currentPage, imagesPerPage, searchTerm, sortBy } = this.core.getState();
            const page = Math.max(1, parseInt(currentPage) || 1);
            const perPage = Math.max(1, Math.min(100, parseInt(imagesPerPage) || 20));
            const search = searchTerm || '';
            const sort = sortBy || 'name_asc';

            const validSorts = ['name_asc', 'name_desc', 'date_asc', 'date_desc', 'size_asc', 'size_desc'];
            const finalSort = validSorts.includes(sort) ? sort : 'name_asc';

            const params = new URLSearchParams({               
                action: 'getImages', 
                page: page.toString(),
                perPage: perPage.toString(),
                search: search,
                sort: finalSort
            });

            const response = await fetch(`index.php?${params.toString()}`);
                
            if (!response.ok) {
                let errorDetails = '';
                try {
                    const errorData = await response.json();
                    errorDetails = errorData.error ? `: ${errorData.error}` : '';
                } catch (e) {
                    
                }
                throw new Error(`获取图片列表失败 (HTTP ${response.status})${errorDetails}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('服务器返回非JSON数据');
            }
            const data = await response.json();

            if (typeof data !== 'object' || !Array.isArray(data.images) || !data.pagination) {
                throw new Error('服务器返回无效格式');                
            }

            this.core.setState({
                images: data.images,
                totalPages: Math.max(1, data.pagination.totalPages || 1)
            });

            this.renderer.renderGallery();
            this.updatePagination();
        } catch (error) {
            console.error('加载图片错误:', error);
            if (window.app && window.app.showNotification) {
                window.app.showNotification('加载图片失败: ' + error.message, 'error');
            }
            const gallery = document.getElementById('gallery');
            if (gallery) {
                gallery.innerHTML = ` 
                    <div class="error-state">
                        <p>无法加载图片列表</p>
                        <p class="error-message">${error.message}</p>
                        <button class="retry-btn" onclick="window.loadImages()">重试</button>
                    </div>
                `;
            }
        } finally {
            if (window.app && window.app.hideLoader) {
                window.app.hideLoader();
            }
        }
    }

    updatePagination() {
        const { currentPage, totalPages } = this.core.getState();
        const pageInfo = this.elements.get('pageInfo');
        const prevPageBtn = this.elements.get('prevPageBtn');
        const nextPageBtn = this.elements.get('nextPageBtn');
        const pageJumpInput = this.elements.get('pageJumpInput');

        if (pageInfo.textContent !== undefined) {
            pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;
        }
        if (prevPageBtn) {
            prevPageBtn.disabled = currentPage <= 1;
        }
        if (nextPageBtn) {
            nextPageBtn.disabled = currentPage >= totalPages;
        }
        if (pageJumpInput.value !== undefined) {
            pageJumpInput.value = currentPage;
            pageJumpInput.max = totalPages;
        }
    }
}
