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
            // 匹配HTML中的实际ID - 模态框信息元素
            modalTitle: document.getElementById('imageTitle') || {},
            modalSize: document.getElementById('imageSize') || {},
            modalDimensions: document.getElementById('imageDimensions') || {},
            modalModified: document.getElementById('imageModified') || {},
            downloadLink: document.getElementById('downloadLink') || {},
            modalActions: document.querySelectorAll('.modal-btn[data-action]') || [],
            modalLoader: document.getElementById('modalLoader'),
            // 匹配HTML中的实际ID - 导航按钮
            prevImageBtn: document.getElementById('prevImageBtn'),
            nextImageBtn: document.getElementById('nextImageBtn'),
            // 添加其他可能需要的元素
            galleryView: document.getElementById('galleryView'),
            settingsView: document.getElementById('settingsView'),
            galleryBtn: document.getElementById('galleryBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            refreshBtn: document.getElementById('refreshBtn'),
            notification: document.getElementById('notification'),
            loader: document.getElementById('loader')
        };
    }

    get(key) {
        return this.elements[key];
    }

    getAll() {
        return { ...this.elements };
    }

    validateRequiredElements() {
        const requiredElements = [
            { id: 'gallery', element: this.elements.gallery, name: '画廊容器' },
            { id: 'imageModal', element: this.elements.imageModal, name: '图片模态框' },
            { id: 'modalImage', element: this.elements.modalImage, name: '模态框图片元素' },
            { id: 'prevImageBtn', element: this.elements.prevImageBtn, name: '上一张图片按钮' },
            { id: 'nextImageBtn', element: this.elements.nextImageBtn, name: '下一张图片按钮' },
            { id: 'imageTitle', element: this.elements.modalTitle, name: '图片标题元素' },
            { id: 'downloadLink', element: this.elements.downloadLink, name: '下载链接' }
        ];

        requiredElements.forEach(item => {
            if (!item.element || item.element.nodeType !== 1) {
                console.error(`关键元素缺失: #${item.id} (${item.name})`);
                window.app?.showNotification(`功能异常: 缺少${item.name}`, 'error');
            }
        });
    }
}
