/**
 * 相册主页面功能模块
 * 负责图片加载、分页、查看和操作
 */
document.addEventListener('DOMContentLoaded', () => {
    // 初始化主题
    if (typeof loadSavedTheme === 'function') {
        loadSavedTheme();
    }
    
    // 初始化相册功能
    initGallery();
});

function initGallery() {
    // 全局变量
    let currentPage = 1;
    let perPage = 40;
    let totalImages = 0;
    let totalPages = 1;
    let allImages = [];
    let currentImageIndex = -1;
    let configuredFolders = [];
    
    // 图片变换状态
    let zoomLevel = 1;
    let rotation = 0;
    let flipped = false;
    
    // DOM元素
    const imageGrid = document.getElementById('imageGrid');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    const perPageSelect = document.getElementById('perPage');
    const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
    const modalImage = document.getElementById('modalImage');
    const imageContainer = document.getElementById('imageContainer');
    const modalFilename = document.getElementById('modalFilename');
    const modalInfo = document.getElementById('modalInfo');
    const deleteImageBtn = document.getElementById('deleteImage');
    const closeModalBtn = document.getElementById('closeModal');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const prevImageBtn = document.getElementById('prevImageBtn');
    const nextImageBtn = document.getElementById('nextImageBtn');
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const resetViewBtn = document.getElementById('resetView');
    const rotateImageBtn = document.getElementById('rotateImage');
    const flipImageBtn = document.getElementById('flipImage');
    const targetFolderSelect = document.getElementById('targetFolder');
    const moveImageBtn = document.getElementById('moveImageBtn');
    const pageJumpInput = document.getElementById('pageJumpInput');
    const jumpToPageBtn = document.getElementById('jumpToPageBtn');
    
    // 事件监听
    prevPageBtn.addEventListener('click', () => goToPage(currentPage - 1));
    nextPageBtn.addEventListener('click', () => goToPage(currentPage + 1));
    perPageSelect.addEventListener('change', (e) => {
        perPage = parseInt(e.target.value);
        currentPage = 1; // 重置到第一页
        loadImages();
    });
    deleteImageBtn.addEventListener('click', deleteCurrentImage);
    closeModalBtn.addEventListener('click', () => imageModal.hide());
    prevImageBtn.addEventListener('click', showPrevImage);
    nextImageBtn.addEventListener('click', showNextImage);
    zoomInBtn.addEventListener('click', () => zoomImage(0.1));
    zoomOutBtn.addEventListener('click', () => zoomImage(-0.1));
    resetViewBtn.addEventListener('click', resetImageView);
    rotateImageBtn.addEventListener('click', () => rotateImage(90));
    flipImageBtn.addEventListener('click', flipImage);
    moveImageBtn.addEventListener('click', moveCurrentImage);
    jumpToPageBtn.addEventListener('click', handlePageJump);
    pageJumpInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handlePageJump();
        }
    });
    
    // 模态框事件
    imageModal._element.addEventListener('show.bs.modal', () => {
        document.addEventListener('keydown', handleKeyPress);
    });
    
    imageModal._element.addEventListener('hide.bs.modal', () => {
        document.removeEventListener('keydown', handleKeyPress);
        resetImageView();
    });
    
    // 初始化加载
    loadFolders();
    loadImages();
    
    /**
     * 处理页码跳转
     */
    function handlePageJump() {
        const page = parseInt(pageJumpInput.value.trim(), 10);
        
        // 验证输入
        if (isNaN(page) || page < 1 || page > totalPages) {
            showNotification(`请输入有效的页码 (1-${totalPages})`, 'warning');
            pageJumpInput.select();
            return;
        }
        
        // 跳转到指定页
        goToPage(page);
        pageJumpInput.value = '';
    }
    
    /**
     * 加载图片文件夹配置
     */
    function loadFolders() {
        fetch('/api/config')
            .then(response => {
                if (!response.ok) throw new Error('加载文件夹配置失败');
                return response.json();
            })
            .then(config => {
                configuredFolders = config.image_folders || [];
                populateFolderSelect();
            })
            .catch(error => {
                console.error('加载文件夹出错:', error);
            });
    }
    
    /**
     * 填充文件夹选择下拉框
     */
    function populateFolderSelect() {
        const currentValue = targetFolderSelect.value;
        
        while (targetFolderSelect.options.length > 1) {
            targetFolderSelect.remove(1);
        }
        
        configuredFolders.forEach((folder, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = folder;
            targetFolderSelect.appendChild(option);
        });
        
        if (currentValue) {
            targetFolderSelect.value = currentValue;
        }
    }
    
    /**
     * 加载图片
     */
    function loadImages() {
        showLoading();
        return fetch(`/api/images?page=${currentPage}&per_page=${perPage}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`加载图片失败: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                allImages = data.images || [];
                totalImages = data.total_images || 0;
                totalPages = data.total_pages || 1;
                
                // 更新UI
                renderImages();
                updatePagination();
                hideLoading();
                return data;
            })
            .catch(error => {
                console.error('加载图片出错:', error);
                showNotification('加载图片失败: ' + error.message, 'error');
                hideLoading();
                throw error;
            });
    }
    
    /**
     * 渲染图片网格
     */
    function renderImages() {
        imageGrid.innerHTML = '';
        
        if (allImages.length === 0) {
            imageGrid.innerHTML = '<div class="text-center"><p>没有找到图片</p></div>';
            return;
        }
        
        allImages.forEach((image, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            imageItem.innerHTML = `
                <img src="/images/${image.id}" alt="${image.filename}" class="image-thumbnail">
                <div class="image-info">
                    <div>${truncateText(image.filename, 15)}</div>
                    <div>${image.date}</div>
                    <div>${image.size}</div>
                </div>
            `;
            
            imageItem.addEventListener('click', () => {
                openImageModal(image, index);
            });
            
            imageGrid.appendChild(imageItem);
        });
    }
    
    /**
     * 打开图片模态框
     */
    function openImageModal(image, index) {
        currentImageIndex = index;
        modalImage.src = `/images/${image.id}`;
        modalImage.alt = image.filename;
        modalFilename.textContent = image.filename;
        modalInfo.textContent = `大小: ${image.size} | 修改日期: ${image.date} | 路径: ${image.relative_path}`;
        
        deleteImageBtn.dataset.imageId = image.id;
        moveImageBtn.dataset.imageId = image.id;
        
        updateNavigationButtons();
        imageModal.show();
    }
    
    /**
     * 显示上一张图片
     */
    function showPrevImage() {
        if (currentImageIndex > 0) {
            currentImageIndex--;
            const prevImage = allImages[currentImageIndex];
            openImageModal(prevImage, currentImageIndex);
        }
    }
    
    /**
     * 显示下一张图片
     */
    function showNextImage() {
        if (currentImageIndex < allImages.length - 1) {
            currentImageIndex++;
            const nextImage = allImages[currentImageIndex];
            openImageModal(nextImage, currentImageIndex);
        }
    }
    
    /**
     * 更新导航按钮状态
     */
    function updateNavigationButtons() {
        prevImageBtn.disabled = currentImageIndex <= 0;
        nextImageBtn.disabled = currentImageIndex >= allImages.length - 1;
        
        prevImageBtn.style.opacity = currentImageIndex <= 0 ? 0.5 : 1;
        nextImageBtn.style.opacity = currentImageIndex >= allImages.length - 1 ? 0.5 : 1;
    }
    
    /**
     * 缩放图片
     */
    function zoomImage(amount) {
        zoomLevel = Math.max(0.1, Math.min(5, zoomLevel + amount));
        applyImageTransformations();
    }
    
    /**
     * 旋转图片
     */
    function rotateImage(degrees) {
        rotation = (rotation + degrees) % 360;
        applyImageTransformations();
    }
    
    /**
     * 翻转图片
     */
    function flipImage() {
        flipped = !flipped;
        applyImageTransformations();
    }
    
    /**
     * 重置图片视图
     */
    function resetImageView() {
        zoomLevel = 1;
        rotation = 0;
        flipped = false;
        applyImageTransformations();
    }
    
    /**
     * 应用图片变换
     */
    function applyImageTransformations() {
        let transform = `scale(${zoomLevel}) rotate(${rotation}deg)`;
        if (flipped) {
            transform += ' scaleX(-1)';
        }
        imageContainer.style.transform = transform;
    }
    
    /**
     * 处理键盘事件
     */
    function handleKeyPress(e) {
        // 如果正在输入文本，不处理快捷键
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (e.key) {
            case 'ArrowLeft':
                showPrevImage();
                e.preventDefault();
                break;
            case 'ArrowRight':
                showNextImage();
                e.preventDefault();                
                break;
            case 'Escape':
                imageModal.hide();
                break;
            case '+':
            case '=':
                e.preventDefault();
                zoomImage(0.1);
                break;
            case '-':
            case '_':
                e.preventDefault();
                zoomImage(-0.1);
                break;
            case '0':
                e.preventDefault();
                resetImageView();
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                rotateImage(90);
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                flipImage();
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                if (currentImageIndex !== -1) {
                    deleteCurrentImage();
                }
                break;
            case 'Escape':
                e.preventDefault();
                imageModal.hide();
                break;
        }
    }
    
    /**
     * 删除当前图片
     */
    function deleteCurrentImage() {
        const imageId = deleteImageBtn.dataset.imageId;
        if (!imageId) return;
        
        if (confirm('确定要删除这张图片吗？此操作不可恢复。')) {
            fetch(`/api/images/${imageId}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || '删除失败');
                    });
                }
                return response.json();
            })
            .then(data => {
                showNotification(data.message, 'success');
                
                const deletedIndex = currentImageIndex;
                imageModal.hide();
                
                loadImages()
                    .then(() => {
                        if (allImages.length > 0) {
                            const newIndex = deletedIndex < allImages.length ? deletedIndex : allImages.length - 1;
                            openImageModal(allImages[newIndex], newIndex);
                        } else if (currentPage > 1) {
                            goToPage(currentPage - 1);
                        }
                    })
                    .catch(error => {
                        console.error('重新加载图片失败:', error);
                    });
            })
            .catch(error => {
                console.error('删除图片出错:', error);
                showNotification('删除图片失败: ' + error.message, 'error');
            });
        }
    }
    
    /**
     * 移动当前图片
     */
    function moveCurrentImage() {
        const imageId = moveImageBtn.dataset.imageId;
        const targetFolderIndex = targetFolderSelect.value;
        
        if (!imageId || targetFolderIndex === '') {
            showNotification('请选择目标文件夹', 'warning');
            return;
        }
        
        if (confirm('确定要移动这张图片吗？')) {
            fetch(`/api/images/${imageId}/move`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    target_folder_index: targetFolderIndex
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || '移动失败');
                    });
                }
                return response.json();
            })
            .then(data => {
                showNotification(data.message, 'success');
                
                const currentIndex = currentImageIndex;
                imageModal.hide();
                
                loadImages()
                    .then(() => {
                        if (allImages.length > 0) {
                            const newIndex = Math.min(currentIndex, allImages.length - 1);
                            openImageModal(allImages[newIndex], newIndex);
                        } else if (currentPage > 1) {
                            goToPage(currentPage - 1);
                        }
                    })
                    .catch(error => {
                        console.error('重新加载图片失败:', error);
                    });
            })
            .catch(error => {
                console.error('移动图片出错:', error);
                showNotification('移动图片失败: ' + error.message, 'error');
            });
        }
    }
    
    /**
     * 更新分页控件
     */
    function updatePagination() {
        pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页 (总计 ${totalImages} 张图片)`;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
        pageJumpInput.max = totalPages;
    }
    
    /**
     * 跳转到指定页
     */
    function goToPage(page) {
        if (page < 1 || page > totalPages) return;
        currentPage = page;
        loadImages();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    /**
     * 显示加载状态
     */
    function showLoading() {
        loadingIndicator.style.display = 'block';
    }
    
    /**
     * 隐藏加载状态
     */
    function hideLoading() {
        loadingIndicator.style.display = 'none';
    }
    
    /**
     * 显示通知
     */
    function showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = 'notification';
        
        if (type === 'success') {
            notification.classList.add('bg-success');
        } else if (type === 'error') {
            notification.classList.add('bg-danger');
        } else if (type === 'warning') {
            notification.classList.add('bg-warning', 'text-dark');
        } else {
            notification.classList.add('bg-info');
        }
        
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
    
    /**
     * 截断长文本
     */
    function truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
}
