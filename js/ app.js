// 全局状态
const state = {
    currentPage: 1,
    perPage: 40,
    totalPages: 0,
    totalImages: 0,
    imagesPerRow: 5
};

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 加载图片列表
    loadImages();
    
    // 事件监听
    document.getElementById('prevPage').addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            loadImages();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        if (state.currentPage < state.totalPages) {
            state.currentPage++;
            loadImages();
        }
    });
    
    document.getElementById('perPageSelect').addEventListener('change', (e) => {
        state.perPage = parseInt(e.target.value);
        state.currentPage = 1;
        loadImages();
    });
    
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadImages(true);
    });
    
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
    document.getElementById('closeSettings').addEventListener('click', closeSettingsModal);
    document.getElementById('cancelSettings').addEventListener('click', closeSettingsModal);
    document.getElementById('settingsForm').addEventListener('submit', saveSettings);
    document.getElementById('closeModal').addEventListener('click', closeImageModal);
    document.getElementById('emptySettingsBtn').addEventListener('click', openSettingsModal);
    document.getElementById('errorRefreshBtn').addEventListener('click', () => loadImages(true));
    
    // 点击模态框背景关闭
    document.getElementById('imageModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('imageModal')) {
            closeImageModal();
        }
    });
    
    // 按ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeImageModal();
            closeSettingsModal();
        }
    });
});

// 加载图片列表
function loadImages(forceRefresh = false) {
    // 显示加载状态
    showLoading();
    hideEmptyState();
    hideErrorState();
    
    // 构建API URL
    let url = `/api/images?page=${state.currentPage}&per_page=${state.perPage}`;
    if (forceRefresh) {
        url += `&t=${new Date().getTime()}`;
    }
    
    // 调用API
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应不正常');
            }
            return response.json();
        })
        .then(data => {
            // 更新状态
            state.totalPages = data.total_pages;
            state.totalImages = data.total_images;
            state.imagesPerRow = data.images_per_row;
            
            // 更新UI
            updateImageGrid(data.images);
            updatePagination();
            updateGridColumns();
            
            // 隐藏加载状态
            hideLoading();
            
            // 如果没有图片，显示空状态
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
    grid.innerHTML = '';
    
    images.forEach(image => {
        const imageUrl = `/images/${image.id}`;
        
        // 创建图片项
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item bg-white rounded-lg shadow overflow-hidden';
        imageItem.innerHTML = `
            <img src="${imageUrl}" alt="${image.filename}" class="image-thumbnail" loading="lazy">
            <div class="p-2">
                <p class="text-sm font-medium truncate" title="${image.filename}">${image.filename}</p>
                ${image.folder ? `<p class="text-xs text-gray-500 truncate" title="${image.folder}">${image.folder}</p>` : ''}
            </div>
        `;
        
        // 点击查看大图
        imageItem.addEventListener('click', () => {
            openImageModal(image);
        });
        
        grid.appendChild(imageItem);
    });
}

// 更新分页控件
function updatePagination() {
    const pagination = document.getElementById('pagination');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    // 更新分页信息
    pageInfo.textContent = `第 ${state.currentPage} 页，共 ${state.totalPages} 页 (${state.totalImages} 张图片)`;
    
    // 启用/禁用分页按钮
    prevBtn.disabled = state.currentPage <= 1;
    nextBtn.disabled = state.currentPage >= state.totalPages;
    
    // 显示或隐藏分页控件
    if (state.totalPages > 1) {
        pagination.classList.remove('hidden');
    } else {
        pagination.classList.add('hidden');
    }
}

// 更新网格列数
function updateGridColumns() {
    const grid = document.getElementById('imageGrid');
    grid.style.setProperty('--columns', state.imagesPerRow);
}

// 打开图片查看模态框
function openImageModal(image) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalPath = document.getElementById('modalPath');
    const modalSize = document.getElementById('modalSize');
    const modalModified = document.getElementById('modalModified');
    const modalExtension = document.getElementById('modalExtension');
    const downloadLink = document.getElementById('downloadLink');
    
    // 设置模态框内容
    modalImage.src = `/images/${image.id}`;
    modalTitle.textContent = image.filename;
    modalPath.textContent = image.folder ? `${image.folder}/${image.filename}` : image.filename;
    modalSize.textContent = image.size;
    modalModified.textContent = image.modified;
    modalExtension.textContent = image.extension.toUpperCase();
    downloadLink.href = `/images/${image.id}`;
    downloadLink.download = image.filename;
    
    // 显示模态框
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // 防止背景滚动
}

// 关闭图片查看模态框
function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.add('hidden');
    document.body.style.overflow = ''; // 恢复背景滚动
}

// 打开设置模态框
function openSettingsModal() {
    // 获取当前设置
    fetch('/api/settings')
        .then(response => response.json())
        .then(settings => {
            // 填充表单
            document.getElementById('imageFolder').value = settings.image_folder || '';
            document.getElementById('scanSubfolders').checked = settings.scan_subfolders === 'true';
            document.getElementById('maxDepth').value = settings.max_depth || 0;
            document.getElementById('imagesPerRow').value = settings.images_per_row || 5;
            document.getElementById('cacheDuration').value = settings.cache_duration || 600;
            
            // 显示模态框
            document.getElementById('settingsModal').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        });
}

// 关闭设置模态框
function closeSettingsModal() {
    document.getElementById('settingsModal').classList.add('hidden');
    document.body.style.overflow = '';
}

// 保存设置
function saveSettings(e) {
    e.preventDefault();
    
    // 收集表单数据
    const settings = {
        image_folder: document.getElementById('imageFolder').value,
        scan_subfolders: document.getElementById('scanSubfolders').checked ? 'true' : 'false',
        max_depth: document.getElementById('maxDepth').value,
        images_per_row: document.getElementById('imagesPerRow').value,
        cache_duration: document.getElementById('cacheDuration').value
    };
    
    // 保存设置
    fetch('/api/settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // 关闭模态框
            closeSettingsModal();
            
            // 重新加载图片
            state.currentPage = 1;
            loadImages(true);
            
            // 显示成功消息
            alert('设置已保存');
        } else {
            alert('保存失败: ' + (data.message || '未知错误'));
        }
    })
    .catch(error => {
        console.error('保存设置失败:', error);
        alert('保存设置时发生错误');
    });
}

// 显示加载状态
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

// 隐藏加载状态
function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

// 显示空状态
function showEmptyState() {
    document.getElementById('emptyState').classList.remove('hidden');
}

// 隐藏空状态
function hideEmptyState() {
    document.getElementById('emptyState').classList.add('hidden');
}

// 显示错误状态
function showErrorState(message) {
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message || '加载图片时发生错误';
    errorState.classList.remove('hidden');
}

// 隐藏错误状态
function hideErrorState() {
    document.getElementById('errorState').classList.add('hidden');
}
    
