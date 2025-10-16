// web/js/galleryCore.js - 核心数据管理
class GalleryCore {
    constructor() {
        this.state = {
            images: [],
            filteredImages: [],
            currentImage: null,
            currentPage: 1,
            imagesPerPage: 12,
            totalPages: 1,
            transform: {
                rotation: 0,
                flipX: 1,
                flipY: 1
            },
            searchQuery: '',
            sortOption: 'name_asc',
            isLoading: false
        };
        
        this.observers = [];
    }

    // 获取当前状态
    getState() {
        return { ...this.state };
    }

    // 更新状态
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notifyObservers();
    }

    // 注册观察者
    subscribe(observer) {
        this.observers.push(observer);
    }

    // 通知所有观察者状态变化
    notifyObservers() {
        this.observers.forEach(observer => observer(this.getState()));
    }

    // 设置图片列表
    setImages(images) {
        this.setState({ 
            images, 
            filteredImages: this.filterAndSortImages(images),
            currentPage: 1
        });
        this.calculateTotalPages();
    }

    // 从列表中移除图片
    removeImage(imagePath) {
        const updatedImages = this.state.images.filter(img => img.path !== imagePath);
        this.setImages(updatedImages);
    }

    // 过滤和排序图片
    filterAndSortImages(images) {
        let result = [...images];
        
        // 应用搜索过滤
        if (this.state.searchQuery) {
            const query = this.state.searchQuery.toLowerCase();
            result = result.filter(img => 
                img.name.toLowerCase().includes(query) ||
                img.path.toLowerCase().includes(query)
            );
        }
        
        // 应用排序
        result.sort((a, b) => {
            switch (this.state.sortOption) {
                case 'name_asc':
                    return a.name.localeCompare(b.name);
                case 'name_desc':
                    return b.name.localeCompare(a.name);
                case 'date_asc':
                    return new Date(a.modified) - new Date(b.modified);
                case 'date_desc':
                    return new Date(b.modified) - new Date(a.modified);
                case 'size_asc':
                    return a.size - b.size;
                case 'size_desc':
                    return b.size - a.size;
                default:
                    return 0;
            }
        });
        
        return result;
    }

    // 计算总页数
    calculateTotalPages() {
        const totalPages = Math.ceil(this.state.filteredImages.length / this.state.imagesPerPage);
        this.setState({ totalPages });
        
        // 如果当前页超出总页数，调整到最后一页
        if (this.state.currentPage > totalPages && totalPages > 0) {
            this.setState({ currentPage: totalPages });
        }
    }

    // 获取当前页的图片
    getCurrentPageImages() {
        const startIndex = (this.state.currentPage - 1) * this.state.imagesPerPage;
        const endIndex = startIndex + this.state.imagesPerPage;
        return this.state.filteredImages.slice(startIndex, endIndex);
    }

    // 切换到上一页
    prevPage() {
        if (this.state.currentPage > 1) {
            this.setState({ currentPage: this.state.currentPage - 1 });
        }
    }

    // 切换到下一页
    nextPage() {
        if (this.state.currentPage < this.state.totalPages) {
            this.setState({ currentPage: this.state.currentPage + 1 });
        }
    }

    // 跳转到指定页
    jumpToPage(page) {
        if (page >= 1 && page <= this.state.totalPages) {
            this.setState({ currentPage: page });
        }
    }

    // 设置每页显示的图片数量
    setImagesPerPage(count) {
        this.setState({ imagesPerPage: count, currentPage: 1 });
        this.calculateTotalPages();
    }

    // 设置搜索查询
    setSearchQuery(query) {
        this.setState({ searchQuery: query, currentPage: 1 });
        this.setState({
            filteredImages: this.filterAndSortImages(this.state.images)
        });
        this.calculateTotalPages();
    }

    // 设置排序选项
    setSortOption(option) {
        this.setState({ sortOption: option, currentPage: 1 });
        this.setState({
            filteredImages: this.filterAndSortImages(this.state.images)
        });
    }

    // 刷新画廊
    async refreshGallery() {
        this.setState({ isLoading: true });
        
        try {
            // 调用加载器重新加载图片
            if (this.loader) {
                await this.loader.loadImages();
            }
        } catch (error) {
            console.error('刷新画廊失败:', error);
            window.app?.showNotification('刷新失败: ' + error.message, 'error');
        } finally {
            this.setState({ isLoading: false });
        }
    }

    // 设置加载器
    setLoader(loader) {
        this.loader = loader;
    }
}
