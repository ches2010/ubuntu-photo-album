// 确保DOM完全加载后执行
document.addEventListener('DOMContentLoaded', function() {
    // 全局状态
    const state = {
        currentPage: 1,
        perPage: 40,
        totalPages: 0,
        totalImages: 0,
        imagesPerRow: 5
    };

    // 获取DOM元素并绑定事件
    const refreshBtn = document.getElementById('refreshBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const perPageSelect = document.getElementById('perPageSelect');
    const settingsForm = document.getElementById('settingsForm');
    const cancelSettingsBtn = document.getElementById('cancelSettings');
    const closeSettingsBtn = document.getElementById('closeSettings');
    const imageModal = document.getElementById('imageModal');
    const closeModalBtn = document.getElementById('closeModal');

    // 绑定按钮事件
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            console.log('刷新按钮被点击');
            loadImages(true);
        });
    } else {
        console.error('未找到刷新按钮元素');
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', function() {
            console.log('设置按钮被点击');
            openSettingsModal();
        });
    } else {
        console.error('未找到设置按钮元素');
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            if (state.currentPage > 1) {
                state.currentPage--;
                loadImages();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                loadImages();
            }
        });
    }

    if (perPageSelect) {
        perPageSelect.addEventListener('change', function(e) {
            state.perPage = parseInt(e.target.value);
            state.currentPage = 1;
            loadImages();
        });
    }

    if (settingsForm) {
        settingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveSettings();
        });
    }

    if (cancelSettingsBtn) {
        cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', closeSettingsModal);
    }

    if (imageModal) {
        imageModal.addEventListener('click', function(e) {
            if (e.target === imageModal) {
                closeImageModal();
            }
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeImageModal);
    }

    // 键盘事件
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeImageModal();
            closeSettingsModal();
        }
    });

    // 初始加载图片
    loadImages();

    // 加载图片列表
    function loadImages(forceRefresh = false) {
        showLoading();
        hideEmptyState();
        hideErrorState();
        
        let url = `/api/images?page=${state.currentPage}&per_page=${state.perPage}`;
        if (forceRefresh) {
            url += `&t=${new Date().getTime()}`;
        }
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP错误: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                state.totalPages = data.total_pages;
                state.totalImages = data.total_images;
                state.imagesPerRow = data.images_per_row;
                
                updateImageGrid(data.images);
                updatePagination();
                updateGridColumns();
                hideLoading();
                
                if (state.totalImages === 0) {
                    showEmptyState();
                }
            })
            .catch(error => {
                console.error('加载图片失败:', error);
                hideLoading();
                showErrorState(error.message);
            });
    }

    // 更新图片网格
    function updateImageGrid(images) {
        const grid = document.getElementById('imageGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        images.forEach(image => {
            const imageUrl = `/images/${image.id}`;
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            imageItem.innerHTML = `
                <img src="${imageUrl}" alt="${image.filename}" class="image-thumbnail" loading="lazy">
                <div class="image-info">
                    <p class="image-name">${image.filename}</p>
                    ${image.folder ? `<p class="image-path">${image.folder}</p>` : ''}
                </div>
            `;
            
            imageItem.addEventListener('click', () => openImageModal(image));
            grid.appendChild(imageItem);
        });
    }

    // 更新分页
    function updatePagination() {
        const pagination = document.getElementById('pagination');
        const pageInfo = document.getElementById('pageInfo');
        
        if (!pagination || !pageInfo) return;
        
        pageInfo.textContent = `第 ${state.currentPage} 页，共 ${state.totalPages} 页 (${state.totalImages} 张图片)`;
        prevPageBtn.disabled = state.currentPage <= 1;
        nextPageBtn.disabled = state.currentPage >= state.totalPages;
        
        pagination.classList.toggle('hidden', state.totalPages <= 1);
    }

    // 更新网格列数
    function updateGridColumns() {
        const grid = document.getElementById('imageGrid');
        if (grid) {
            grid.style.setProperty('--columns', state.imagesPerRow);
        }
    }

    // 打开图片模态框
    function openImageModal(image) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        const modalTitle = document.getElementById('modalTitle');
        const modalPath = document.getElementById('modalPath');
        const modalSize = document.getElementById('modalSize');
        const modalModified = document.getElementById('modalModified');
        const modalExtension = document.getElementById('modalExtension');
        const downloadLink = document.getElementById('downloadLink');
        
        if (!modal || !modalImage || !modalTitle) return;
        
        modalImage.src = `/images/${image.id}`;
        modalTitle.textContent = image.filename;
        modalPath.textContent = image.folder ? `${image.folder}/${image.filename}` : image.filename;
        modalSize.textContent = image.size;
        modalModified.textContent = image.modified;
        modalExtension.textContent = image.extension.toUpperCase();
        
        if (downloadLink) {
            downloadLink.href = `/images/${image.id}`;
            downloadLink.download = image.filename;
        }
        
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    // 关闭图片模态框
    function closeImageModal() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    // 打开设置模态框
    function openSettingsModal() {
        fetch('/api/config')
            .then(response => {
                if (!response.ok) throw new Error('加载设置失败');
                return response.json();
            })
            .then(settings => {
                const imageFolder = document.getElementById('imageFolder');
                const scanSubfolders = document.getElementById('scanSubfolders');
                const maxDepth = document.getElementById('maxDepth');
                const imagesPerRow = document.getElementById('imagesPerRow');
                const cacheDuration = document.getElementById('cacheDuration');
                const settingsModal = document.getElementById('settingsModal');
                
                if (imageFolder) imageFolder.value = settings.image_folder || '';
                if (scanSubfolders) scanSubfolders.checked = settings.scan_subfolders === 'true';
                if (maxDepth) maxDepth.value = settings.max_depth || 0;
                if (imagesPerRow) imagesPerRow.value = settings.images_per_row || 5;
                if (cacheDuration) cacheDuration.value = settings.cache_duration || 600;
                if (settingsModal) {
                    settingsModal.classList.remove('hidden');
                    document.body.style.overflow = 'hidden';
                }
            })
            .catch(error => {
                console.error('加载设置失败:', error);
                alert('无法加载设置，请稍后重试');
            });
    }

    // 关闭设置模态框
    function closeSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    // 保存设置
    function saveSettings() {
        const settings = {
            image_folder: document.getElementById('imageFolder').value,
            scan_subfolders: document.getElementById('scanSubfolders').checked ? 'true' : 'false',
            max_depth: document.getElementById('maxDepth').value,
            images_per_row: document.getElementById('imagesPerRow').value,
            cache_duration: document.getElementById('cacheDuration').value
        };
        
        fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        })
        .then(response => {
            if (!response.ok) throw new Error('保存设置失败');
            return response.json();
        })
        .then(data => {
            alert('设置已保存');
            closeSettingsModal();
            loadImages(true); // 重新加载图片
        })
        .catch(error => {
            console.error('保存设置失败:', error);
            alert('保存设置失败，请稍后重试');
        });
    }

    // 加载状态显示
    function showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    function hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    // 空状态显示
    function showEmptyState() {
        document.getElementById('emptyState').classList.remove('hidden');
    }

    function hideEmptyState() {
        document.getElementById('emptyState').classList.add('hidden');
    }

    // 错误状态显示
    function showErrorState(message) {
        const errorState = document.getElementById('errorState');
        const errorMessage = document.getElementById('errorMessage');
        if (errorState && errorMessage) {
            errorMessage.textContent = message;
            errorState.classList.remove('hidden');
        }
    }

    function hideErrorState() {
        document.getElementById('errorState').classList.add('hidden');
    }
});
