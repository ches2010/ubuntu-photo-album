// web/js/galleryElements.js - DOM元素管理
class GalleryElements {
    constructor() {
        this.elements = {
            gallery: document.getElementById('gallery'),
            prevPageBtn: document.getElementById('prevPage'),
            nextPageBtn: document.getElementById('nextPage'),
            pageInfo: document.getElementById('pageInfo') || {},
            pageJumpInput: document.getElementById('pageJumpInput') || {},
            jumpToPageBtn: document.getElementById('jumpToPageBtn') || {},
            searchInput: document.getElementById('searchInput') || {},
            searchBtn: document.getElementById('searchBtn') || {},
            sortSelect: document.getElementById('sortSelect') || {},
            imageModal: document.getElementById('imageModal') || {},
            modalImage: document.getElementById('modalImage') || {},
            modalTitle: document.getElementById('imageTitle') || {},
            modalSize: document.getElementById('imageSize') || {},
            modalDimensions: document.getElementById('imageDimensions') || {},
            modalModified: document.getElementById('imageModified') || {},
            downloadLink: document.getElementById('downloadLink') || {},
            modalActions: document.querySelectorAll('.modal-btn[data-action]') || {},
            modalLoader: document.getElementById('modalLoader'),
            prevImageBtn: document.getElementById('prevImage'),
            nextImageBtn: document.getElementById('nextImage')
        };
    }

    get(key) {
        return this.elements[key];
    }

    getAll() {
        return this.elements;
    }

    validateRequiredElements() {
        const requiredElements = [
            { id: 'gallery', element: this.elements.gallery, name: '画廊容器' },
            { id: 'imageModal', element: this.elements.imageModal, name: '图片模态框' },
            { id: 'modalImage', element: this.elements.modalImage, name: '模态框图片元素' }
        ];

        requiredElements.forEach(item => {
            if (!item.element || item.element.nodeType !== 1) {
                console.error(`关键元素缺失: #${item.id} (${item.name})`);
                window.app?.showNotification(`功能异常: 缺少${item.name}`, 'error');
            }
        });
    }
}
