// app.js
const API_BASE_URL = '';
const IMAGES_API_URL = `${API_BASE_URL}/api/images`;
const CONFIG_API_URL = `${API_BASE_URL}/api/config`;

let allImages = [];
let currentSettings = { images_per_row: 5 };

// DOM 元素
const galleryPage = document.getElementById('gallery-page');
const settingsPage = document.getElementById('settings-page');
const galleryContainer = document.getElementById('gallery-container');
const refreshBtn = document.getElementById('refresh-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsForm = document.getElementById('settings-form');
const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
const addFolderBtn = document.getElementById('add-folder-btn');
const imagesPerRowInput = document.getElementById('images-per-row');

// --- 页面导航 ---
function showGalleryPage() {
    settingsPage.classList.add('hidden');
    galleryPage.classList.remove('hidden');
}

function showSettingsPage() {
    galleryPage.classList.add('hidden');
    settingsPage.classList.remove('hidden');
    loadSettingsForForm(); // 加载设置到表单
}

// --- 设置管理 ---
async function loadSettingsForForm() {
    try {
        const response = await fetch(CONFIG_API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        currentSettings = data.settings || {};
        imagesPerRowInput.value = currentSettings.images_per_row || 5;
        
        // 清除旧的文件夹输入框
        const folderInputsContainer = settingsForm.querySelector('div');
        if (folderInputsContainer) {
             folderInputsContainer.innerHTML = '';
        }

        // 创建新的文件夹输入框
        const folderKeys = Object.keys(currentSettings).filter(key => key.startsWith('folder_'));
        folderKeys.forEach(key => {
            const value = currentSettings[key];
            if (value) { // 只加载非空路径
                createFolderInputInForm(value);
            }
        });
        // 确保至少有一个输入框
        if (folderKeys.length === 0 || !folderKeys.some(k => currentSettings[k])) {
            createFolderInputInForm('');
        }
    } catch (error) {
        console.error("加载设置到表单失败:", error);
        alert("加载设置失败: " + error.message);
    }
}

function createFolderInputInForm(folderPath = '') {
    const folderInputsContainer = settingsForm.querySelector('div'); // 假设第一个 div 是放文件夹输入的
    const folderCount = folderInputsContainer.querySelectorAll('input[type="text"]').length + 1;
    const folderDiv = document.createElement('div');
    folderDiv.innerHTML = `
        <label for="folder_${folderCount}">文件夹路径 ${folderCount}:</label>
        <input type="text" id="folder_${folderCount}" name="folder_${folderCount}" value="${folderPath}" placeholder="/path/to/your/images">
        <button type="button" onclick="this.parentElement.remove()">-</button>
        <br><br>
    `;
    folderInputsContainer.appendChild(folderDiv);
}

// --- 图片加载与显示 ---
async function loadAndDisplayImages() {
    try {
        galleryContainer.innerHTML = '<p>加载中...</p>';
        const response = await fetch(IMAGES_API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allImages = await response.json();
        displayImages(allImages);
    } catch (error) {
        console.error("加载图片失败:", error);
        galleryContainer.innerHTML = `<p>加载图片失败: ${error.message}</p>`;
    }
}

function displayImages(images) {
    if (images.length === 0) {
        galleryContainer.innerHTML = '<p>未找到图片。</p>';
        return;
    }

    const imagesPerRow = parseInt(currentSettings.images_per_row, 10) || 5;
    galleryContainer.style.gridTemplateColumns = `repeat(${imagesPerRow}, 1fr)`;

    galleryContainer.innerHTML = '';
    images.forEach(img => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        // 使用 URLSearchParams 确保路径被正确编码
        const encodedPath = encodeURIComponent(img.filepath);
        galleryItem.innerHTML = `
            <img src="/api/image?path=${encodedPath}" alt="${img.filename}" data-full-path="${img.filepath}">
            <div class="gallery-item-info">
                <span class="filename">${img.filename}</span>
                ${
                    img.subfolder
                        ? `<span class="subfolder">${img.subfolder}</span>`
                        : ''
                }
            </div>
        `;
        galleryItem.querySelector('img').addEventListener('click', () => {
            openImageViewer(img.filepath, images);
        });
        galleryContainer.appendChild(galleryItem);
    });
}

// --- 事件监听器 ---
refreshBtn.addEventListener('click', loadAndDisplayImages);
settingsBtn.addEventListener('click', showSettingsPage);
cancelSettingsBtn.addEventListener('click', showGalleryPage);

addFolderBtn.addEventListener('click', () => {
    createFolderInputInForm('');
});

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(settingsForm);
    const settingsData = {};
    
    // 处理 images_per_row
    settingsData.images_per_row = formData.get('images_per_row') || '5';

    // 处理文件夹路径
    const folderInputs = settingsForm.querySelectorAll('input[name^="folder_"]');
    let folderIndex = 1;
    folderInputs.forEach(input => {
        const value = input.value.trim();
        if (value) { // 只保存非空路径
            settingsData[`folder_${folderIndex}`] = value;
            folderIndex++;
        }
    });

    try {
        const response = await fetch(CONFIG_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ settings: settingsData })
        });

        if (response.ok) {
            alert('设置已保存。');
            // 重新加载设置和图片
            await loadSettingsForForm();
            showGalleryPage();
            loadAndDisplayImages();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || '保存失败');
        }
    } catch (error) {
        console.error("保存设置失败:", error);
        alert("保存设置失败: " + error.message);
    }
});

// --- 初始化 ---
window.addEventListener('load', async () => {
    await loadSettingsForForm(); // 初始加载设置
    loadAndDisplayImages();     // 初始加载图片
});



