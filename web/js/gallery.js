/**
 * 相册核心功能模块
 * 负责图片加载、展示和相关交互
 */
export default class Gallery {
    constructor() {
        // 状态管理
        this.state = {
            currentPage: 1,
            perPage: 40,
            totalPages: 0,
            totalImages: 0,
            imagesPerRow: 5,
            isLoading: false
        };
        
        // 缓存DOM元素
        this.elements = this.initElements();
        
        // 绑定事件处理函数的上下文
        this.handleRefresh = this.handleRefresh.bind(this);
        this.changePage = this.changePage.bind(this);
        this.handlePerPageChange = this.handlePerPageChange.bind(this);
        this.closeImageModal = this.closeImageModal.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        
        // 初始化事件监听
        this.initEventListeners();
    }
    
    // 初始化DOM元素引用
    initElements() {
        return {
            refreshBtn: document.getElementById('refreshBtn'),
            prevPageBtn: document.getElementById('prevPage'),
            nextPageBtn: document.getElementById('nextPage'),
            perPageSelect: document.getElementById('perPageSelect'),
            imageModal: document.getElementById('imageModal'),
            closeModalBtn: document.getElementById('closeModal'),
            imageGrid: document.getElementById('imageGrid'),
            pagination: document.getElementById('pagination'),
            pageInfo: document.getElementById('pageInfo'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            emptyState: document.getElementById('emptyState'),
            errorState: document.getElementById('errorState'),
            errorMessage: document.getElementById('errorMessage'),
            modalImage: document.getElementById('modalImage'),
            modalTitle: document.getElementById('modalTitle'),
            modalPath: document.getElementById('modalPath'),
            modalSize: document.getElementById('modalSize'),
            modalModified: document.getElementById('modalModified'),
            modalExtension: document.getElementById('modalExtension'),
            downloadLink: document.getElementById('downloadLink')
        };
    }
    
    // 初始化事件监听
    initEventListeners() {
        // 确保元素存在再绑定事件，避免错误
        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.addEventListener('click', this.handleRefresh);
        }
        
        if (this.elements.prevPageBtn) {
            this.elements.prevPageBtn.addEventListener('click', () => this.changePage(-1));
        }
        
        if (this.elements.nextPageBtn) {
            this.elements.nextPageBtn.addEventListener('click', () => this.changePage(1));
        }
        
        if (this.elements.perPageSelect) {
            this.elements.perPageSelect.addEventListener('change', this.handlePerPageChange);
        }
        
        if (this.elements.imageModal) {
            this.elements.imageModal.addEventListener('click', (e) => {
                if (e.target === this.elements.imageModal) {
                    this.closeImageModal();
                }
            });
        }
        
        if (this.elements.closeModalBtn) {
            this.elements.closeModalBtn.addEventListener('click', this.closeImageModal);
        }
        
        // 键盘事件监听
        document.addEventListener('keydown', this.handleKeyPress);
    }
    
    // 处理刷新
    handleRefresh() {
        if (this.state.isLoading) return;
        
        const btn = this.elements.refreshBtn;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '🔄 刷新中...';
        }
        
        this.loadImages(true)
            .then(() => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '🔄 刷新';
                }
            })
            .catch(() => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '🔄 刷新';
                }
            });
    }
    
    // 处理分页变化
    changePage(delta) {
        const newPage = this.state.currentPage + delta;
        if (newPage >= 1 && newPage <= this.state.totalPages) {
            this.state.currentPage = newPage;
            this.loadImages();
        }
    }
    
    // 处理每页数量变化
    handlePerPageChange(e) {
        this.state.perPage = parseInt(e.target.value);
        this.state.currentPage = 1;
        this.loadImages();
    }
    
    // 加载图片列表
    loadImages(forceRefresh = false) {
        return new Promise((resolve, reject) => {
            if (this.state.isLoading) {
                resolve();
                return;
            }

            this.showLoading();
            this.hideEmptyState();
            this.hideErrorState();
            
            let url = `/api/images?page=${this.state.currentPage}&per_page=${this.state.perPage}`;
            if (forceRefresh) {
                url += `&t=${new Date().getTime()}`;
            }
            
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`加载失败 (${response.status})`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (!data || typeof data !== 'object') {
                        throw new Error('无效的数据格式');
                    }
                    
                    // 更新状态
                    this.state.totalPages = data.total_pages || 0;
                    this.state.totalImages = data.total_images || 0;
                    this.state.imagesPerRow = data.images_per_row || 5;
                    
                    // 更新UI
                    this.updateImageGrid(data.images || []);
                    this.updatePagination();
                    this.updateGridColumns();
                    
                    if (this.state.totalImages === 0) {
                        this.showEmptyState();
                    }
                    
                    resolve();
                })
                .catch(error => {
                    console.error('加载图片失败:', error);
                    this.showErrorState(error.message);
                    reject(error);
                })
                .finally(() => {
                    this.hideLoading();
                });
        });
    }
    
    // 更新图片网格
    updateImageGrid(images) {
        if (!this.elements.imageGrid) return;
        
        this.elements.imageGrid.innerHTML = '';
        
        if (images.length === 0) return;
        
        images.forEach(image => {
            const imageUrl = `/images/${image.id}`;
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            imageItem.innerHTML = `
                <img src="${imageUrl}" alt="${this.escapeHtml(image.filename)}" 
                     class="image-thumbnail" loading="lazy">
                <div class="image-info">
                    <p class="image-name">${this.truncateText(image.filename, 15)}</p>
                    ${image.folder ? `<p class="image-path">${this.escapeHtml(image.folder)}</p>` : ''}
                </div>
            `;
            
            imageItem.addEventListener('click', () => this.openImageModal(image));
            this.elements.imageGrid.appendChild(imageItem);
        });
    }
    
    // 更新分页控件
    updatePagination() {
        if (!this.elements.pagination || !this.elements.pageInfo) return;
        
        this.elements.pageInfo.textContent = 
            `第 ${this.state.currentPage} 页，共 ${this.state.totalPages} 页 (${this.state.totalImages} 张图片)`;
        
        if (this.elements.prevPageBtn) {
            this.elements.prevPageBtn.disabled = this.state.currentPage <= 1;
        }
        
        if (this.elements.nextPageBtn) {
            this.elements.nextPageBtn.disabled = this.state.currentPage >= this.state.totalPages;
        }
        
        this.elements.pagination.classList.toggle('hidden', this.state.totalPages <= 1);
    }
    
    // 更新网格列数
    updateGridColumns() {
        if (this.elements.imageGrid) {
            this.elements.imageGrid.style.setProperty('--columns', this.state.imagesPerRow);
        }
    }
    
    // 打开图片模态框
    openImageModal(image) {
        if (!this.elements.imageModal || !this.elements.modalImage || !this.elements.modalTitle) return;
        
        this.elements.modalImage.src = `/images/${image.id}`;
        this.elements.modalTitle.textContent = this.escapeHtml(image.filename);
        
        if (this.elements.modalPath) {
            this.elements.modalPath.textContent = image.folder 
                ? `${this.escapeHtml(image.folder)}/${this.escapeHtml(image.filename)}` 
                : this.escapeHtml(image.filename);
        }
        
        if (this.elements.modalSize) {
            this.elements.modalSize.textContent = image.size;
        }
        
        if (this.elements.modalModified) {
            this.elements.modalModified.textContent = image.modified;
        }
        
        if (this.elements.modalExtension) {
            this.elements.modalExtension.textContent = image.extension.toUpperCase();
        }
        
        if (this.elements.downloadLink) {
            this.elements.downloadLink.href = `/images/${image.id}`;
            this.elements.downloadLink.download = image.filename;
        }
        
        this.elements.imageModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    // 关闭图片模态框
    closeImageModal() {
        if (this.elements.imageModal) {
            this.elements.imageModal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }
    
    // 处理键盘事件
    handleKeyPress(e) {
        // ESC键关闭模态框
        if (e.key === 'Escape') {
            this.closeImageModal();
        }
        
        // 左右箭头键翻页（当模态框关闭时）
        if (this.elements.imageModal && this.elements.imageModal.classList.contains('hidden')) {
            if (e.key === 'ArrowLeft') {
                this.changePage(-1);
            } else if (e.key === 'ArrowRight') {
                this.changePage(1);
            }
        }
    }
    
    // 显示加载状态
    showLoading() {
        this.state.isLoading = true;
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.classList.remove('hidden');
        }
    }
    
    // 隐藏加载状态
    hideLoading() {
        this.state.isLoading = false;
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.classList.add('hidden');
        }
    }
    
    // 显示空状态
    showEmptyState() {
        if (this.elements.emptyState) {
            this.elements.emptyState.classList.remove('hidden');
        }
    }
    
    // 隐藏空状态
    hideEmptyState() {
        if (this.elements.emptyState) {
            this.elements.emptyState.classList.add('hidden');
        }
    }
    
    // 显示错误状态
    showErrorState(message) {
        if (this.elements.errorState && this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorState.classList.remove('hidden');
        }
    }
    
    // 隐藏错误状态
    hideErrorState() {
        if (this.elements.errorState) {
            this.elements.errorState.classList.add('hidden');
        }
    }
    
    // 工具函数: 截断文本
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    // 工具函数: 防XSS
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
    
