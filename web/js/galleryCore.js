// web/js/galleryCore.js - 画廊核心状态管理
class GalleryCore {
    constructor(settings = {}) {
        this.state = {
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
        this.updateSettings(settings);
    }

    updateSettings(newSettings) {
        if (newSettings && newSettings.imagesPerPage) {
            this.state.imagesPerPage = newSettings.imagesPerPage;
        }
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    getState() {
        return this.state;
    }
}
