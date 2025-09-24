// viewer.js
(function(window) {
    'use strict';

    // --- DOM Elements ---
    const viewerImage = document.getElementById('viewer-image');
    const viewerInfo = document.getElementById('viewer-info');
    const viewerBackBtn = document.getElementById('viewer-back-btn');
    // --- New Navigation Buttons ---
    const viewerPrevBtn = document.getElementById('viewer-prev-btn');
    const viewerNextBtn = document.getElementById('viewer-next-btn');
    // --- End New Navigation Buttons ---
    const viewerZoomInBtn = document.getElementById('viewer-zoom-in');
    const viewerZoomOutBtn = document.getElementById('viewer-zoom-out');
    const viewerRotateLeftBtn = document.getElementById('viewer-rotate-left');
    const viewerRotateRightBtn = document.getElementById('viewer-rotate-right');
    const viewerFlipBtn = document.getElementById('viewer-flip');
    const viewerResetBtn = document.getElementById('viewer-reset');
    const viewerDeleteBtn = document.getElementById('viewer-delete');
    const viewerMoveSelect = document.getElementById('viewer-move-select');
    const viewerMoveBtn = document.getElementById('viewer-move-btn');

    const IMAGE_SERVE_URL = `/images/`;
    const DELETE_API_URL = `/api/images/`;
    const MOVE_API_URL = `/api/images/`; // Base URL, will append ID

    // --- Viewer State ---
    let currentImageId = null;
    let currentImageData = null; // Full data object for the current image
    let allImagesData = []; // Store reference to all image data for navigation
    let scale = 1;
    let rotation = 0; // Degrees
    let isFlipped = false;

    // --- Helper Functions ---
    function getCurrentImageIndex() {
        if (!currentImageId || !Array.isArray(allImagesData) || allImagesData.length === 0) {
            return -1;
        }
        return allImagesData.findIndex(img => img.id === currentImageId);
    }

    function navigateToImage(imageId) {
        if (imageId) {
            open(imageId, allImagesData); // Re-open with the same data set
        }
    }

    // --- API Interaction ---
    async function deleteImage(imageId) {
        if (!confirm(`确定要永久删除文件 '${currentImageData.filename}' 吗？此操作无法撤销。`)) {
            return; // User cancelled
        }
        try {
            const response = await fetch(`${DELETE_API_URL}${encodeURIComponent(imageId)}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                
                // Find index before deletion
                const currentIndex = getCurrentImageIndex();
                
                // Close viewer first
                closeImageViewer(); 
                
                // Dispatch event to reload gallery
                window.dispatchEvent(new CustomEvent('viewerAction', { detail: { action: 'delete', imageId } }));
                
                // Optional: Navigate to next/previous image if available
                // This part depends on how the gallery handles updates after delete
                // For now, we just close the viewer.
                /*
                if (allImagesData.length > 1) {
                    let newIndex = currentIndex;
                    if (currentIndex >= allImagesData.length - 1) {
                        // If last item was deleted, go to previous
                        newIndex = Math.max(0, currentIndex - 1);
                    }
                    // else stay at currentIndex, which now points to the next item
                    const nextImageId = allImagesData[newIndex]?.id;
                    if (nextImageId && nextImageId !== imageId) {
                         // Re-open viewer with next image
                         setTimeout(() => open(nextImageId, allImagesData), 100); 
                    }
                }
                */
                
            } else {
                throw new Error(data.error || '删除失败');
            }
        } catch (error) {
            console.error("删除图片时出错:", error);
            alert("删除图片失败: " + error.message);
        }
    }

    async function moveImage(imageId, targetFolderIndex) {
         if (targetFolderIndex === '' || targetFolderIndex === null || targetFolderIndex === undefined) {
             alert("请选择一个目标文件夹。");
             return;
         }
         if (parseInt(targetFolderIndex, 10) === currentImageData.folder_index) {
             alert("目标文件夹与当前文件夹相同。");
             return;
         }
        try {
            const response = await fetch(`${MOVE_API_URL}${encodeURIComponent(imageId)}/move`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ target_folder_index: targetFolderIndex })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                // Update the current image ID if it changed (e.g., new ID after move)
                if (data.new_file_id) {
                    currentImageId = data.new_file_id;
                    // Update the image source with the new ID
                    viewerImage.src = `${IMAGE_SERVE_URL}${encodeURIComponent(currentImageId)}`;
                }
                // Dispatch event to reload gallery
                window.dispatchEvent(new CustomEvent('viewerAction', { detail: { action: 'move', imageId, newImageId: data.new_file_id, targetFolderIndex } }));
            } else {
                if (response.status === 409) { // Conflict
                     alert(`移动失败: ${data.error}`);
                } else {
                     throw new Error(data.error || '移动失败');
                }
            }
        } catch (error) {
            console.error("移动图片时出错:", error);
            alert("移动图片失败: " + error.message);
        }
    }


    // --- Viewer Logic ---
    function updateImageTransform() {
        // Combine scale, rotation, and flip into a single transform string
        let transformValue = `scale(${scale}) rotate(${rotation}deg)`;
        if (isFlipped) {
            // Apply flip after scale/rotate. scaleX(-1) flips horizontally.
            transformValue += ' scaleX(-1)';
        }
        viewerImage.style.transform = transformValue;
    }

    function resetViewerState() {
        scale = 1;
        rotation = 0;
        isFlipped = false;
        updateImageTransform();
    }

    function populateMoveSelect(folders, currentFolderIndex) {
        viewerMoveSelect.innerHTML = '<option value="">-- 移动到 --</option>';
        folders.forEach((folderPath, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `📁 文件夹 ${index + 1}: ${folderPath}`;
            if (index === currentFolderIndex) {
                option.disabled = true;
                option.textContent += ' (当前)';
            }
            viewerMoveSelect.appendChild(option);
        });
    }

    function open(imageId, allImageData) {
        // Store reference to all image data for navigation
        allImagesData = allImageData || [];
        
        const imageData = allImagesData.find(img => img.id === imageId);
        if (!imageData) {
            console.error("找不到图片数据 ID:", imageId);
            alert("无法打开图片：数据丢失。");
            return;
        }

        currentImageId = imageId;
        currentImageData = imageData;
        // Ensure folder_index is available or derive it
        if (currentImageData.folder_index === undefined) {
             currentImageData.folder_index = allImagesData.map(d => d.folder).indexOf(imageData.folder);
        }

        // Set image source
        viewerImage.src = `${IMAGE_SERVE_URL}${encodeURIComponent(imageId)}`;
        
        // Set image info
        viewerInfo.innerHTML = `
            <strong>${imageData.filename}</strong><br>
            大小: ${imageData.size}<br>
            日期: ${imageData.date}<br>
            文件夹: ${imageData.folder}
        `;

        // Populate move select
        // Get unique folders from allImageData
        const uniqueFolders = [...new Set(allImagesData.map(img => img.folder))];
        populateMoveSelect(uniqueFolders, currentImageData.folder_index);

        // Reset state for new image
        resetViewerState();
        
        // Update navigation button states
        updateNavigationButtons();

        console.log("Opened viewer for image:", imageId);
    }
    
    function updateNavigationButtons() {
        const currentIndex = getCurrentImageIndex();
        if (viewerPrevBtn) {
            viewerPrevBtn.disabled = currentIndex <= 0;
        }
        if (viewerNextBtn) {
            viewerNextBtn.disabled = currentIndex < 0 || currentIndex >= allImagesData.length - 1;
        }
    }

    function closeImageViewer() { // Renamed from 'close' to avoid conflict
        // Reset image source to prevent loading old image briefly
        viewerImage.src = '';
        currentImageId = null;
        currentImageData = null;
        allImagesData = [];
        window.dispatchEvent(new CustomEvent('viewerClosed'));
    }

    // --- Event Listeners ---
    viewerBackBtn.addEventListener('click', closeImageViewer);
    
    // --- New Navigation Event Listeners ---
    if (viewerPrevBtn) {
        viewerPrevBtn.addEventListener('click', () => {
            const currentIndex = getCurrentImageIndex();
            if (currentIndex > 0) {
                const prevImageId = allImagesData[currentIndex - 1].id;
                navigateToImage(prevImageId);
            }
        });
    }
    
    if (viewerNextBtn) {
        viewerNextBtn.addEventListener('click', () => {
            const currentIndex = getCurrentImageIndex();
            if (currentIndex >= 0 && currentIndex < allImagesData.length - 1) {
                const nextImageId = allImagesData[currentIndex + 1].id;
                navigateToImage(nextImageId);
            }
        });
    }
    // --- End New Navigation Event Listeners ---

    viewerZoomInBtn.addEventListener('click', () => {
        scale *= 1.2;
        updateImageTransform();
        updateNavigationButtons(); // Optional: update if buttons depend on state
    });

    viewerZoomOutBtn.addEventListener('click', () => {
        scale /= 1.2;
        // Optional: prevent scale from getting too small
        if (scale < 0.1) scale = 0.1;
        updateImageTransform();
        updateNavigationButtons(); // Optional: update if buttons depend on state
    });

    viewerRotateLeftBtn.addEventListener('click', () => {
        rotation -= 90;
        updateImageTransform();
        updateNavigationButtons(); // Optional: update if buttons depend on state
    });

    viewerRotateRightBtn.addEventListener('click', () => {
        rotation += 90;
        updateImageTransform();
        updateNavigationButtons(); // Optional: update if buttons depend on state
    });

    viewerFlipBtn.addEventListener('click', () => {
        isFlipped = !isFlipped;
        updateImageTransform();
        updateNavigationButtons(); // Optional: update if buttons depend on state
    });

    viewerResetBtn.addEventListener('click', () => {
        resetViewerState();
        updateNavigationButtons(); // Optional: update if buttons depend on state
    });

    viewerDeleteBtn.addEventListener('click', () => {
        if (currentImageId) {
            deleteImage(currentImageId);
        }
    });

    viewerMoveBtn.addEventListener('click', () => {
        if (currentImageId) {
            const targetIndex = viewerMoveSelect.value;
            moveImage(currentImageId, targetIndex);
        }
    });

    // Expose API to global scope
    window.PhotoAlbumViewer = {
        open: open,
        close: closeImageViewer // Expose the renamed close function
    };

})(window);


