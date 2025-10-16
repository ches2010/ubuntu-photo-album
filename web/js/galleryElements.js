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
            // 统一模态框信息元素的ID命名，增加一致性
            modalTitle: document.getElementById('modalTitle') || {},
            modalSize: document.getElementById('modalSize') || {},
            modalDimensions: document.getElementById('modalDimensions') || {},
            modalModified: document.getElementById('modalModified') || {},
            downloadLink: document.getElementById('downloadLink') || {},
            modalActions: document.querySelectorAll('.modal-btn[data-action]') || {},
            modalLoader: document.getElementById('modalLoader'),
            // 修复：将ID统一为prevImageBtn和nextImageBtn，与galleryModal.js中使用的名称一致
            prevImageBtn: document.getElementById('prevImageBtn'),
            nextImageBtn: document.getElementById('nextImageBtn')
        };
    }

    get(key) {
        return this.elements[key];
    }

    getAll() {
        return this.elements;
    }

    validateRequiredElements() {
        // 扩展必要元素列表，包含导航按钮
        const requiredElements = [
            { id: 'gallery', element: this.elements.gallery, name: '画廊容器' },
            { id: 'imageModal', element: this.elements.imageModal, name: '图片模态框' },
            { id: 'modalImage', element: this.elements.modalImage, name: '模态框图片元素' },
            { id: 'prevImageBtn', element: this.elements.prevImageBtn, name: '上一张图片按钮' },
            { id: 'nextImageBtn', element: this.elements.nextImageBtn, name: '下一张图片按钮' }
        ];

        requiredElements.forEach(item => {
            if (!item.element || item.element.nodeType !== 1) {
                console.error(`关键元素缺失: #${item.id} (${item.name})`);
                window.app?.showNotification(`功能异常: 缺少${item.name}`, 'error');
            }
        });
    }
}
