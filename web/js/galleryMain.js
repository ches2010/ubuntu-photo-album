// web/js/galleryMain.js - 主入口
function initGallery(settings) {
    const core = new GalleryCore(settings);
    const elements = new GalleryElements();
    const renderer = new GalleryRenderer(core, elements);
    const loader = new GalleryLoader(core, elements, renderer);
    const modal = new GalleryModal(core, elements);
    const events = new GalleryEvents(core, elements, loader, modal);
    const deleter = new GalleryDeleter(core, elements);

    elements.validateRequiredElements();
    
    // 暴露一些方法供其他模块使用
    window.loadImages = () => loader.loadImages();
    window.refreshGallery = () => loader.loadImages();
    window.openImageModal = (image) => modal.openImageModal(image);

    window.galleryCore = core;
    window.galleryModal = modal;
    window.galleryDeleter = deleter;
    
    // 初始加载图片
    loader.loadImages();
}
