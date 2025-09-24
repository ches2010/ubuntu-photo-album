# 新增配置管理相关API和路由
@app.route('/api/config', methods=['GET'])
def get_config():
    """获取当前配置"""
    current_config = load_config()
    
    # 提取需要前端展示的配置项
    config_data = {
        'port': current_config.getint('settings', 'port'),
        'debug': current_config.getboolean('settings', 'debug'),
        'images_folders': get_configured_folders(current_config),
        'images_per_row': current_config.getint('settings', 'images_per_row'),
        'scan_subfolders': current_config.getboolean('settings', 'scan_subfolders'),
        'max_depth': current_config.getint('settings', 'max_depth')
    }
    
    return jsonify(config_data)

@app.route('/api/config', methods=['POST'])
def update_config():
    """更新配置"""
    try:
        data = request.get_json()
        current_config = load_config()
        
        # 更新基本设置
        if 'port' in data:
            current_config.set('settings', 'port', str(data['port']))
        if 'debug' in data:
            current_config.set('settings', 'debug', str(data['debug']).lower())
        if 'images_per_row' in data:
            current_config.set('settings', 'images_per_row', str(data['images_per_row']))
        if 'scan_subfolders' in data:
            current_config.set('settings', 'scan_subfolders', str(data['scan_subfolders']).lower())
        if 'max_depth' in data:
            current_config.set('settings', 'max_depth', str(data['max_depth']))
        
        # 先清除所有folder_*配置
        folder_keys = [key for key in current_config['settings'] if key.startswith('folder_')]
        for key in folder_keys:
            del current_config['settings'][key]
        
        # 添加新的文件夹配置
        if 'image_folders' in data and isinstance(data['image_folders'], list):
            for i, folder in enumerate(data['image_folders']):
                if folder.strip():  # 只添加非空路径
                    current_config.set('settings', f'folder_{i+1}', folder.strip())
        
        # 保存配置
        save_config(current_config)
        
        # 重启应用才能使端口等设置生效（这里只是记录，实际重启需要通过Supervisor）
        app.logger.info("配置已更新，部分设置需要重启应用才能生效")
        
        return jsonify({"message": "配置已更新，部分设置需要重启应用才能生效"})
    except Exception as e:
        app.logger.error(f"更新配置时出错: {e}")
        return jsonify({"error": f"更新配置失败: {str(e)}"}), 500

@app.route('/settings')
def settings_page():
    """配置页面路由"""
    return send_from_directory(WEB_ROOT, 'settings.html')
