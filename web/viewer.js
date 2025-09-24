// viewer.js

const API_BASE_URL = '';
const CONFIG_API_URL = `${API_BASE_URL}/api/config`;
const MOVE_API_URL = `${API_BASE_URL}/api/move_image`;
const DELETE_API_URL = `${API_BASE_URL}/api/delete_image`;

// DOM 元素
const imageViewer = document.getElementById('image-viewer');
const viewerImage = document.getElementById('viewer-image');
const viewerBackBtn = document.getElementById('viewer-back-btn');
const viewerPrevBtn = document.getElementById('viewer-prev-btn');
const viewerNextBtn = document.getElementById('viewer-next-btn');
const viewerZoomInBtn = document.getElementById('viewer-zoom-in');
const viewerZoomOutBtn = document.getElementById('viewer-zoom-out');
const viewerRotateLeftBtn = document.getElementById('viewer-rotate-left');
const viewerRotateRightBtn = document.getElementById('viewer-rotate-right');
const viewerFlipBtn = document.getElementById('viewer-flip');
const viewerResetBtn = document.getElementById('viewer-reset');
const viewerMoveSelect = document.getElementById('viewer-move-select');
const viewerMoveBtn = document.getElementById('viewer-move-btn');
const viewerDeleteBtn = document.getElementById('viewer-delete');
const viewerInfo = document.getElementById('viewer-info');

let currentImageList = [];
let currentImageIndex = -1;
let currentTransform = { scale: 1, rotate: 0, flipX: false };

// --- 图片查看器逻辑 ---
function openImageViewer(imagePath, imageList) {
    currentImageList = imageList;
    currentImageIndex = currentImageList.findIndex(img => img.filepath === imagePath);
    if (currentImageIndex === -1) {
        console.error("在列表中未找到图片:", imagePath);
        return;
    }
    resetTransform();
    showImage(currentImageList[currentImageIndex]);
    loadMoveFolders(); // 加载移动目标文件夹
    updateNavigationButtons();
    imageViewer.classList.remove('hidden');
}

function closeImageViewer() {
    imageViewer.classList.add('hidden');
    viewerImage.src = '';
    currentImageList = [];
    currentImageIndex = -1;
    resetTransform();
}

function showImage(imageObj) {
    if (!imageObj) return;
    resetTransform();
    // 使用 URLSearchParams 确保路径被正确编码
    const encodedPath = encodeURIComponent(imageObj.filepath);
    viewerImage.src = `/api/image?path=${encodedPath}`;
    updateImageInfo(imageObj);
}

function updateImageInfo(imageObj) {
    if (!imageObj) {
        viewerInfo.innerHTML = '<p>无法加载图片信息。</p>';
        return;
    }

    // 获取文件大小和修改日期
    // 注意：前端 JavaScript 无法直接获取文件系统信息（如大小、日期）
    // 这些信息需要后端在 /api/images 接口提供，或者通过 HEAD 请求等方式获取
    // 为了简化，这里我们只显示已知信息
    const fileInfoHtml = `
        <div class="viewer-info-item"><strong>文件名:</strong> <span class="viewer-info-value">${imageObj.filename}</span></div>
        <div class="viewer-info-item"><strong>根文件夹:</strong> <span class="viewer-info-value">${imageObj.root_folder || 'N/A'}</span></div>
        <div class="viewer-info-item"><strong>子文件夹:</strong> <span class="viewer-info-value">${imageObj.subfolder || 'N/A'}</span></div>
        <div class="viewer-info-item"><strong>完整路径:</strong> <span class="viewer-info-value">${imageObj.filepath}</span></div>
    `;
    viewerInfo.innerHTML = fileInfoHtml;
}

function navigateImage(direction) {
    if (currentImageList.length === 0) return;
    currentImageIndex += direction;
    if (currentImageIndex < 0) currentImageIndex = currentImageList.length - 1;
    if (currentImageIndex >= currentImageList.length) currentImageIndex = 0;
    showImage(currentImageList[currentImageIndex]);
    updateNavigationButtons();
    resetTransform(); // 导航时重置变换
}

function updateNavigationButtons() {
    viewerPrevBtn.disabled = currentImageList.length <= 1;
    viewerNextBtn.disabled = currentImageList.length <= 1;
}

// --- 图像变换 ---
function applyTransform() {
    let transformString = `scale(${currentTransform.scale}) rotate(${currentTransform.rotate}deg)`;
    if (currentTransform.flipX) {
        transformString += ' scaleX(-1)';
    }
    viewerImage.style.transform = transformString;
}

function zoom(direction) {
    currentTransform.scale += 0.1 * direction;
    if (currentTransform.scale < 0.1) currentTransform.scale = 0.1; // 限制最小缩放
    applyTransform();
}

function rotate(direction) {
    currentTransform.rotate += 90 * direction;
    // 保持角度在 0-359 度范围内（可选）
    currentTransform.rotate = (currentTransform.rotate + 360) % 360;
    applyTransform();
}

function flip() {
    currentTransform.flipX = !currentTransform.flipX;
    applyTransform();
}

function resetTransform() {
    currentTransform = { scale: 1, rotate: 0, flipX: false };
    applyTransform();
}

// --- 移动和删除 ---
async function loadMoveFolders() {
    try {
        const response = await fetch(CONFIG_API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const configData = await response.json();
        
        const folders = configData.settings ? Object.fromEntries(
            Object.entries(configData.settings).filter(([key]) => key.startsWith('folder_'))
        ) : {};

        // 清空并重新填充选择框
        viewerMoveSelect.innerHTML = '<option value="">-- 移动到 --</option>';
        
        // 创建一个文档片段来优化 DOM 操作
        const fragment = document.createDocumentFragment();
        
        // 为每个根文件夹创建一个 optgroup
        for (const [key, path] of Object.entries(folders)) {
            if (path.trim()) { // 只处理非空路径
                const optgroup = document.createElement('optgroup');
                optgroup.label = `${key}: ${path}`; // 显示 key 和 路径
                optgroup.disabled = true; // 通常根文件夹本身不是移动目标
                
                // 添加根文件夹作为选项（如果需要）
                // const rootOption = document.createElement('option');
                // rootOption.value = key; // 使用 folder_key 作为值
                // rootOption.textContent = `(根目录) ${path}`;
                // optgroup.appendChild(rootOption);

                // --- 递归查找子文件夹并添加为选项 ---
                // 注意：前端 JavaScript 无法直接访问服务器文件系统来列出子文件夹。
                // 这个逻辑需要后端支持。一种方法是让后端在 /api/config 或一个新端点
                // 返回每个根文件夹下的子文件夹列表。
                // 为了简化当前实现，我们假设后端在 image 对象中提供了 subfolder 信息，
                // 并且用户在设置中只配置根目录。
                // 因此，移动功能将只允许移动到已配置的根目录。
                // 如果需要更复杂的子文件夹选择，后端需要提供 API。
                
                // 临时方案：只列出根文件夹
                 const rootOption = document.createElement('option');
                 rootOption.value = key; // 使用 folder_key 作为值
                 rootOption.textContent = path; // 只显示路径
                 fragment.appendChild(rootOption);
                
                // fragment.appendChild(optgroup);
            }
        }
        
        viewerMoveSelect.appendChild(fragment);
        
    } catch (error) {
        console.error("加载移动文件夹失败:", error);
        viewerMoveSelect.innerHTML = '<option value="">加载失败</option>';
    }
}

async function moveImage() {
    const targetFolderKey = viewerMoveSelect.value;
    const currentImage = currentImageList[currentImageIndex];
    
    if (!targetFolderKey || !currentImage) {
        alert('请选择一个目标文件夹。');
        return;
    }

    if (!confirm(`确定要将 "${currentImage.filename}" 移动到选定的文件夹吗？`)) {
        return;
    }

    try {
        const response = await fetch(MOVE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_path: currentImage.filepath,
                target_folder_key: targetFolderKey
            })
        });

        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            // 从当前列表中移除已移动的图片
            currentImageList.splice(currentImageIndex, 1);
            if (currentImageList.length === 0) {
                closeImageViewer();
            } else {
                // 导航到下一张图片
                if (currentImageIndex >= currentImageList.length) {
                    currentImageIndex = currentImageList.length - 1;
                }
                showImage(currentImageList[currentImageIndex]);
                updateNavigationButtons();
            }
        } else {
            throw new Error(data.error || '移动失败');
        }
    } catch (error) {
        console.error("移动图片失败:", error);
        alert("移动图片失败: " + error.message);
    }
}

async function deleteImage() {
    const currentImage = currentImageList[currentImageIndex];
    if (!currentImage) return;

    if (!confirm(`确定要永久删除 "${currentImage.filename}" 吗？此操作无法撤销。`)) {
        return;
    }

    try {
        const response = await fetch(DELETE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image_path: currentImage.filepath })
        });

        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            // 从当前列表中移除已删除的图片
            currentImageList.splice(currentImageIndex, 1);
            if (currentImageList.length === 0) {
                closeImageViewer();
            } else {
                // 导航到下一张图片
                if (currentImageIndex >= currentImageList.length) {
                    currentImageIndex = currentImageList.length - 1;
                }
                showImage(currentImageList[currentImageIndex]);
                updateNavigationButtons();
            }
        } else {
            throw new Error(data.error || '删除失败');
        }
    } catch (error) {
        console.error("删除图片失败:", error);
        alert("删除图片失败: " + error.message);
    }
}

// --- 事件监听器 ---
viewerBackBtn.addEventListener('click', closeImageViewer);
viewerPrevBtn.addEventListener('click', () => navigateImage(-1));
viewerNextBtn.addEventListener('click', () => navigateImage(1));
viewerZoomInBtn.addEventListener('click', () => zoom(1));
viewerZoomOutBtn.addEventListener('click', () => zoom(-1));
viewerRotateLeftBtn.addEventListener('click', () => rotate(-1));
viewerRotateRightBtn.addEventListener('click', () => rotate(1));
viewerFlipBtn.addEventListener('click', flip);
viewerResetBtn.addEventListener('click', resetTransform);
viewerMoveBtn.addEventListener('click', moveImage);
viewerDeleteBtn.addEventListener('click', deleteImage);

// --- 键盘快捷键 ---
document.addEventListener('keydown', (event) => {
    if (imageViewer.classList.contains('hidden')) return;

    switch (event.key) {
        case 'Escape':
            closeImageViewer();
            break;
        case 'ArrowLeft':
            navigateImage(-1);
            break;
        case 'ArrowRight':
            navigateImage(1);
            break;
        // 可以添加更多快捷键，例如 +/- 缩放，R 旋转等
    }
});



