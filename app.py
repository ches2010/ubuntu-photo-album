# app.py
from flask import Flask, jsonify, send_from_directory, abort, request, send_file
import os
import datetime
import configparser
import argparse
import urllib.parse
import shutil # For moving files

# --- Configuration ---
CONFIG_FILE = 'config.ini'
WEB_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')

# 默认配置
DEFAULT_CONFIG = {
    'settings': {
        'port': '80',
        'debug': 'False',
        'images_per_row': '5',
        'scan_subfolders': 'True',  # 新增默认配置
        'max_depth': '3'            # 新增默认配置
    }
}

def load_config():
    """Load configuration from config.ini or create it with defaults."""
    config = configparser.ConfigParser()
    if not os.path.exists(CONFIG_FILE):
        print(f"配置文件 {CONFIG_FILE} 不存在，将创建默认配置文件。")
        config.read_dict(DEFAULT_CONFIG)
        config.set('settings', 'folder_1', '/path/to/your/images')
        save_config(config)
    else:
        config.read(CONFIG_FILE)
    return config

def save_config(config):
    """Save the configuration object to config.ini."""
    with open(CONFIG_FILE, 'w') as configfile:
        config.write(configfile)

# Load config at startup
app_config = load_config()
PORT = app_config.getint('settings', 'port', fallback=int(DEFAULT_CONFIG['settings']['port']))
DEBUG = app_config.getboolean('settings', 'debug', fallback=DEFAULT_CONFIG['settings']['debug'])
IMAGES_PER_ROW_DEFAULT = app_config.getint('settings', 'images_per_row', fallback=int(DEFAULT_CONFIG['settings']['images_per_row']))

app = Flask(__name__)

# 支持的图片扩展名
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'}

def allowed_file(filename):
    """检查文件扩展名是否为允许的图片格式"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_info(filepath):
    """获取文件信息：大小和修改日期"""
    try:
        stat = os.stat(filepath)
        size_bytes = stat.st_size
        if size_bytes < 1024:
            size = f"{size_bytes} B"
        elif size_bytes < 1024**2:
            size = f"{size_bytes/1024:.1f} KB"
        elif size_bytes < 1024**3:
            size = f"{size_bytes/(1024**2):.1f} MB"
        else:
            size = f"{size_bytes/(1024**3):.1f} GB"
            
        mtime = datetime.datetime.fromtimestamp(stat.st_mtime)
        date_str = mtime.strftime('%Y-%m-%d')
        return size, date_str
    except OSError:
        return "Unknown", "Unknown"

# 新增：递归扫描文件夹函数
def scan_folder_recursive(folder_path, current_depth=0, max_depth=0):
    """递归扫描文件夹及其子文件夹中的图片"""
    images = []
    # 检查是否达到最大深度
    if max_depth > 0 and current_depth > max_depth:
        return images
        
    try:
        with os.scandir(folder_path) as entries:
            for entry in entries:
                if entry.is_dir(follow_symlinks=False):
                    # 递归扫描子文件夹
                    subfolder_images = scan_folder_recursive(
                        entry.path, 
                        current_depth + 1, 
                        max_depth
                    )
                    images.extend(subfolder_images)
                elif entry.is_file() and allowed_file(entry.name):
                    images.append(entry.path)
    except PermissionError:
        app.logger.warning(f"没有权限访问文件夹: {folder_path}")
    except Exception as e:
        app.logger.error(f"扫描文件夹 {folder_path} 时出错: {e}")
        
    return images

def get_configured_folders(config):
    """从配置对象中提取所有配置的文件夹路径"""
    folders = []
    if config.has_section('settings'):
        for key, value in config.items('settings'):
            if key.startswith('folder_') and value.strip():
                folder_path = value.strip()
                if os.path.exists(folder_path):
                    folders.append(folder_path)
                else:
                    print(f"警告: 配置的文件夹不存在: {folder_path}")
    return folders

@app.route('/api/images')
def list_images():
    """API端点：返回所有配置文件夹中的图片文件列表及其信息"""
    current_config = load_config()
    configured_folders = get_configured_folders(current_config)
    images_per_row = current_config.getint('settings', 'images_per_row', fallback=IMAGES_PER_ROW_DEFAULT)

    # 获取子文件夹扫描配置
    scan_subfolders = current_config.getboolean('settings', 'scan_subfolders', fallback=True)
    max_depth = current_config.getint('settings', 'max_depth', fallback=0)

    if not configured_folders:
        app.logger.error("没有配置有效的图片文件夹。")
        return jsonify({"error": "服务器上未配置有效的图片文件夹。请检查设置。", "images_per_row": images_per_row}), 500

    all_images = []
    folder_map = {}
    for folder_path in configured_folders:
        try:
            if scan_subfolders:
                # 递归扫描所有子文件夹
                filepaths = scan_folder_recursive(folder_path, max_depth=max_depth)
            else:
                # 只扫描当前文件夹
                filepaths = [
                    os.path.join(folder_path, f) 
                    for f in os.listdir(folder_path) 
                    if os.path.isfile(os.path.join(folder_path, f)) and allowed_file(f)
                ]

            for filepath in filepaths:
                filename = os.path.basename(filepath)
                relative_path = os.path.relpath(filepath, folder_path)
                key = (relative_path, folder_path)
                
                if key not in folder_map:
                    size, date = get_file_info(filepath)
                    folder_index = configured_folders.index(folder_path)
                    
                    # 生成包含相对路径的唯一ID
                    encoded_path = urllib.parse.quote(relative_path, safe='')
                    unique_id = f"{encoded_path}_folder{folder_index}"
                    
                    all_images.append({
                        'id': unique_id,
                        'filename': filename,
                        'folder': folder_path,
                        'relative_path': relative_path,  # 新增相对路径信息
                        'size': size,
                        'date': date
                    })
                    folder_map[key] = True
                    
        except Exception as e:
            app.logger.error(f"扫描文件夹 {folder_path} 时出错: {e}")

    # 按文件夹和相对路径排序
    all_images.sort(key=lambda x: (x['folder'], x['relative_path'].lower()))
    
    response_data = {
        "images": all_images,
        "images_per_row": images_per_row,
        "scan_subfolders": scan_subfolders
    }
    return jsonify(response_data)

@app.route('/images/<path:file_id>')
def serve_image(file_id):
    """API端点：根据唯一ID提供图片文件（支持子文件夹）"""
    current_config = load_config()
    configured_folders = get_configured_folders(current_config)

    if not configured_folders:
         abort(500)

    try:
        parts = file_id.split('_folder')
        if len(parts) != 2:
            abort(404)
        encoded_path_part, folder_index_str = parts
        folder_index = int(folder_index_str)
        
        decoded_path = urllib.parse.unquote(encoded_path_part)

        if folder_index < 0 or folder_index >= len(configured_folders):
            abort(404)
        
        folder_path = configured_folders[folder_index]
        filepath = os.path.join(folder_path, decoded_path)
        
        if os.path.exists(filepath) and os.path.isfile(filepath) and allowed_file(filepath):
            # 提供文件时需要返回完整路径的目录和文件名
            return send_from_directory(os.path.dirname(filepath), os.path.basename(filepath))
        else:
            abort(404)
    except (ValueError, IndexError):
        abort(404)
    except Exception as e:
        app.logger.error(f"Error serving image {file_id}: {e}")
        abort(500)

# --- 新增：图片操作 API ---

@app.route('/api/images/<path:file_id>', methods=['DELETE'])
def delete_image(file_id):
    """API端点：根据唯一ID删除图片文件"""
    current_config = load_config()
    configured_folders = get_configured_folders(current_config)

    if not configured_folders:
        return jsonify({"error": "服务器配置错误：未找到图片文件夹。"}), 500

    try:
        parts = file_id.split('_folder')
        if len(parts) != 2:
            return jsonify({"error": "无效的文件ID格式。"}), 400
        encoded_path_part, folder_index_str = parts
        folder_index = int(folder_index_str)
        
        decoded_path = urllib.parse.unquote(encoded_path_part)

        if folder_index < 0 or folder_index >= len(configured_folders):
            return jsonify({"error": "文件ID对应的文件夹不存在。"}), 404
        
        folder_path = configured_folders[folder_index]
        filepath = os.path.join(folder_path, decoded_path)
        
        if os.path.exists(filepath) and os.path.isfile(filepath):
            os.remove(filepath)
            app.logger.info(f"已删除文件: {filepath}")
            return jsonify({"message": f"文件 '{os.path.basename(filepath)}' 已成功删除。"}), 200
        else:
            return jsonify({"error": "文件不存在。"}), 404
            
    except (ValueError, IndexError):
        return jsonify({"error": "无效的文件ID格式。"}), 400
    except PermissionError:
        app.logger.error(f"权限错误，无法删除文件: {filepath}")
        return jsonify({"error": "权限不足，无法删除文件。"}), 403
    except Exception as e:
        app.logger.error(f"删除文件 {file_id} 时出错: {e}")
        return jsonify({"error": f"删除文件时发生内部错误: {str(e)}"}), 500


@app.route('/api/images/<path:file_id>/move', methods=['POST'])
def move_image(file_id):
    """API端点：根据唯一ID移动图片文件到指定文件夹"""
    current_config = load_config()
    configured_folders = get_configured_folders(current_config)
    
    if not configured_folders:
        return jsonify({"error": "服务器配置错误：未找到图片文件夹。"}), 500

    data = request.get_json()
    target_folder_index_str = data.get('target_folder_index')
    
    if target_folder_index_str is None:
        return jsonify({"error": "缺少 'target_folder_index' 参数。"}), 400
    
    try:
        target_folder_index = int(target_folder_index_str)
    except ValueError:
        return jsonify({"error": "'target_folder_index' 必须是整数。"}), 400

    if target_folder_index < 0 or target_folder_index >= len(configured_folders):
        return jsonify({"error": "目标文件夹索引无效。"}), 400
        
    target_folder_path = configured_folders[target_folder_index]

    # --- 解析源文件ID ---
    try:
        parts = file_id.split('_folder')
        if len(parts) != 2:
            return jsonify({"error": "无效的源文件ID格式。"}), 400
        encoded_path_part, source_folder_index_str = parts
        source_folder_index = int(source_folder_index_str)
        
        decoded_path = urllib.parse.unquote(encoded_path_part)
        source_filepath = os.path.join(configured_folders[source_folder_index], decoded_path)
        filename = os.path.basename(source_filepath)

        if source_folder_index < 0 or source_folder_index >= len(configured_folders):
            return jsonify({"error": "源文件ID对应的文件夹不存在。"}), 404
        
        if not os.path.exists(source_filepath) or not os.path.isfile(source_filepath):
            return jsonify({"error": "源文件不存在。"}), 404

        # 目标文件路径
        target_filepath = os.path.join(target_folder_path, filename)
        
        # 检查目标文件是否已存在
        counter = 1
        while os.path.exists(target_filepath):
            name, ext = os.path.splitext(filename)
            target_filepath = os.path.join(target_folder_path, f"{name}_{counter}{ext}")
            counter += 1

        # 移动文件
        shutil.move(source_filepath, target_filepath)
        app.logger.info(f"已移动文件: {source_filepath} -> {target_filepath}")
        
        return jsonify({
            "message": f"文件 '{filename}' 已成功移动到目标文件夹。",
            "new_filename": os.path.basename(target_filepath)
        }), 200
            
    except (ValueError, IndexError):
        return jsonify({"error": "无效的文件ID格式。"}), 400
    except PermissionError:
        app.logger.error(f"权限错误，无法移动文件")
        return jsonify({"error": "权限不足，无法移动文件。"}), 403
    except Exception as e:
        app.logger.error(f"移动文件 {file_id} 时出错: {e}")
        return jsonify({"error": f"移动文件时发生内部错误: {str(e)}"}), 500

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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=DEBUG)
