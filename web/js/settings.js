/**
 * 设置功能模块
 * 负责配置管理和用户设置
 */
export default class Settings {
    constructor(gallery) {
        // 保存相册实例引用
        this.gallery = gallery;
        
        this.elements = this.initElements();
        
        // 绑定事件处理函数
        this.openSettingsModal = this.openSettingsModal.bind(this);
        this.closeSettingsModal = this.closeSettingsModal.bind(this);
        this.handleSettingsSubmit = this.handleSettingsSubmit.bind(this);
        
        this.initEventListeners();
    }

    initElements() {
        return {
            settingsBtn: document.getElementById('settingsBtn'),
            settingsModal: document.getElementById('settingsModal'),
            settingsForm: document.getElementById('settingsForm'),
            closeSettingsBtn: document.getElementById('closeSettingsBtn'),
            cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
            imageFolder: document.getElementById('imageFolder'),
            scanSubfolders: document.getElementById('scanSubfolders'),
            maxDepth: document.getElementById('maxDepth'),
            imagesPerRow: document.getElementById('imagesPerRow'),
            cacheDuration: document.getElementById('cacheDuration')
        };
    }

    initEventListeners() {
        // 设置按钮点击事件
        if (this.elements.settingsBtn) {
            this.elements.settingsBtn.addEventListener('click', this.openSettingsModal);
        } else {
            console.warn('settingsBtn元素不存在');
        }

        // 关闭设置按钮事件
        if (this.elements.closeSettingsBtn) {
            this.elements.closeSettingsBtn.addEventListener('click', this.closeSettingsModal);
        }
        if (this.elements.cancelSettingsBtn) {
            this.elements.cancelSettingsBtn.addEventListener('click', this.closeSettingsModal);
        }

        // 设置表单提交事件
        if (this.elements.settingsForm) {
            this.elements.settingsForm.addEventListener('submit', this.handleSettingsSubmit);
        }

        // 点击模态框背景关闭
        if (this.elements.settingsModal) {
            this.elements.settingsModal.addEventListener('click', (e) => {
                if (e.target === this.elements.settingsModal) {
                    this.closeSettingsModal();
                }
            });
        }

        // ESC键关闭设置模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.settingsModal && 
                !this.elements.settingsModal.classList.contains('hidden')) {
                this.closeSettingsModal();
            }
        });
    }

    // 打开设置模态框
    openSettingsModal() {
        // 显示加载状态
        this.gallery.showLoading();
        
        fetch('/api/config')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`加载设置失败: ${response.status}`);
                }
                return response.json();
            })
            .then(settings => {
                // 填充表单数据
                if (this.elements.imageFolder) {
                    this.elements.imageFolder.value = settings.image_folder || '';
                }
                if (this.elements.scanSubfolders) {
                    this.elements.scanSubfolders.checked = settings.scan_subfolders === 'true';
                }
                if (this.elements.maxDepth) {
                    this.elements.maxDepth.value = settings.max_depth || 0;
                }
                if (this.elements.imagesPerRow) {
                    this.elements.imagesPerRow.value = settings.images_per_row || 5;
                }
                if (this.elements.cacheDuration) {
                    this.elements.cacheDuration.value = settings.cache_duration || 600;
                }
                
                // 显示模态框
                if (this.elements.settingsModal) {
                    this.elements.settingsModal.classList.remove('hidden');
                    document.body.style.overflow = 'hidden';
                }
            })
            .catch(error => {
                console.error('加载设置失败:', error);
                this.gallery.showErrorState('加载设置失败: ' + error.message);
            })
            .finally(() => {
                // 隐藏加载状态
                this.gallery.hideLoading();
            });
    }

    // 关闭设置模态框
    closeSettingsModal() {
        if (this.elements.settingsModal) {
            this.elements.settingsModal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    // 处理设置提交
    handleSettingsSubmit(e) {
        e.preventDefault();
        if (this.gallery.state.isLoading) return;

        // 收集表单数据
        const formData = {
            image_folder: this.elements.imageFolder ? this.elements.imageFolder.value : '',
            scan_subfolders: this.elements.scanSubfolders ? this.elements.scanSubfolders.checked : false,
            max_depth: this.elements.maxDepth ? this.elements.maxDepth.value : 0,
            images_per_row: this.elements.imagesPerRow ? this.elements.imagesPerRow.value : 5,
            cache_duration: this.elements.cacheDuration ? this.elements.cacheDuration.value : 600
        };

        // 显示加载状态
        this.gallery.showLoading();
        
        fetch('/api/config', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`保存设置失败: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                // 关闭模态框
                this.closeSettingsModal();
                
                // 重置到第一页并刷新图片
                this.gallery.state.currentPage = 1;
                return this.gallery.loadImages(true);
            } else {
                throw new Error('保存设置失败');
            }
        })
        .catch(error => {
            console.error('保存设置失败:', error);
            this.gallery.showErrorState('保存设置失败: ' + error.message);
        })
        .finally(() => {
            // 隐藏加载状态
            this.gallery.hideLoading();
        });
    }
}
