// web/js/galleryEvents.js - 事件处理逻辑
class GalleryEvents {
    constructor(core, elements, loader, modal) {
        this.core = core;
        this.elements = elements;
        this.loader = loader;
        this.modal = modal;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const { prevPageBtn, nextPageBtn, jumpToPageBtn, pageJumpInput, 
                searchBtn, searchInput, sortSelect, imageModal } = this.elements.getAll();

        // 分页按钮
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => this.goToPage(this.core.getState().currentPage - 1));
        }
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => this.goToPage(this.core.getState().currentPage + 1));
        }
        if (jumpToPageBtn) {        
            jumpToPageBtn.addEventListener('click', () => this.goToPage(parseInt(pageJumpInput.value) || 1));
        }
        if (pageJumpInput) {        
            pageJumpInput.addEventListener('keypress', (e) => {            
                if (e.key === 'Enter') {                
                    this.goToPage(parseInt(pageJumpInput.value) || 1);            
                }        
            });
        }

        // 搜索和排序
        if (searchBtn) {        
            searchBtn.addEventListener('click', () => this.searchImages(searchInput.value));
        }
        if (searchInput) {        
            searchInput.addEventListener('keypress', (e) => {            
                if (e.key === 'Enter') {                
                    this.searchImages(searchInput.value);            
                }        
            });
        }
        if (sortSelect) {        
            sortSelect.addEventListener('change', () => this.sortImages(sortSelect.value));
        }

        // 模态框关闭按钮
        const closeBtn = imageModal ? imageModal.querySelector('.close-btn') : null;
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.modal.closeImageModal());
        }

        // 点击模态框背景关闭
        if (imageModal) {
            imageModal.addEventListener('click', (e) => {
                if (e.target === imageModal) {
                    this.modal.closeImageModal();
                }
            });
        }

        // 图片操作按钮
        const modalActions = this.elements.get('modalActions');
        if (modalActions && modalActions.length) {        
            modalActions.forEach(btn => {            
                btn.addEventListener('click', () => {               
                    const action = btn.getAttribute('data-action');               
                    this.modal.handleImageAction(action);            
                });
            });
        }

        // 上一张/下一张图片按钮
        const prevImageBtn = this.elements.get('prevImageBtn');
        const nextImageBtn = this.elements.get('nextImageBtn');
        if (prevImageBtn) {
            prevImageBtn.addEventListener('click', () => this.modal.showPreviousImage());
        }
        if (nextImageBtn) {
            nextImageBtn.addEventListener('click', () => this.modal.showNextImage());
        }
        
        // 键盘事件
        document.addEventListener('keydown', (e) => this.modal.handleKeyPress(e));

        // 监听全屏状态变化
        document.addEventListener('fullscreenchange', () => {
            const imageModal = this.elements.get('imageModal');
            if (!document.fullscreenElement && imageModal) {
                imageModal.classList.remove('fullscreen');
            }
        });

        // 监听设置变化事件
        document.addEventListener('settingsSaved', (e) => {
            this.core.updateSettings(e.detail);
            this.loader.loadImages();
        });
    }

    goToPage(page) {
        const { totalPages } = this.core.getState();
        if (page < 1 || page > totalPages) return;
        
        this.core.setState({ currentPage: page });
        this.loader.loadImages();
    }

    searchImages(term) {
        this.core.setState({
            searchTerm: term,
            currentPage: 1
        });
        this.loader.loadImages();
    }

    sortImages(sortBy) {
        this.core.setState({
            sortBy: sortBy,
            currentPage: 1
        });
        this.loader.loadImages();
    }
}
