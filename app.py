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
        'images_per_row': '5'
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

    if not configured_folders:
        app.logger.error("没有配置有效的图片文件夹。")
        return jsonify({"error": "服务器上未配置有效的图片文件夹。请检查设置。", "images_per_row": images_per_row}), 500

    all_images = []
    folder_map = {}
    for folder_path in configured_folders:
        try:
            for filename in os.listdir(folder_path):
                filepath = os.path.join(folder_path, filename)
                if os.path.isfile(filepath) and allowed_file(filename):
                    key = (filename, folder_path)
                    if key not in folder_map:
                        size, date = get_file_info(filepath)
                        folder_index = configured_folders.index(folder_path)
                        name, ext = os.path.splitext(filename)
                        unique_id = f"{urllib.parse.quote(name, safe='')}_folder{folder_index}{ext}"
                        
                        all_images.append({
                            'id': unique_id,
                            'filename': filename,
                            'folder': folder_path,
                            'size': size,
                            'date': date
                        })
                        folder_map[key] = True
        except Exception as e:
            app.logger.error(f"扫描文件夹 {folder_path} 时出错: {e}")

    all_images.sort(key=lambda x: x['filename'].lower())
    
    response_data = {
        "images": all_images,
        "images_per_row": images_per_row
    }
    return jsonify(response_data)

@app.route('/images/<path:file_id>')
def serve_image(file_id):
    """API端点：根据唯一ID提供图片文件"""
    current_config = load_config()
    configured_folders = get_configured_folders(current_config)

    if not configured_folders:
         abort(500)

    try:
        parts = file_id.split('_folder')
        if len(parts) != 2:
            abort(404)
        encoded_name_part, index_ext_part = parts
        index_ext_split = index_ext_part.split('.', 1)
        if len(index_ext_split) != 2:
            abort(404)
        folder_index_str, ext = index_ext_split
        folder_index = int(folder_index_str)
        
        decoded_name = urllib.parse.unquote(encoded_name_part)
        filename = f"{decoded_name}.{ext}"

        if folder_index < 0 or folder_index >= len(configured_folders):
            abort(404)
        
        folder_path = configured_folders[folder_index]
        filepath = os.path.join(folder_path, filename)
        
        if os.path.exists(filepath) and os.path.isfile(filepath):
            return send_from_directory(folder_path, filename)
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
        encoded_name_part, index_ext_part = parts
        index_ext_split = index_ext_part.split('.', 1)
        if len(index_ext_split) != 2:
            return jsonify({"error": "无效的文件ID格式。"}), 400
        folder_index_str, ext = index_ext_split
        folder_index = int(folder_index_str)
        
        decoded_name = urllib.parse.unquote(encoded_name_part)
        filename = f"{decoded_name}.{ext}"

        if folder_index < 0 or folder_index >= len(configured_folders):
            return jsonify({"error": "文件ID对应的文件夹不存在。"}), 404
        
        folder_path = configured_folders[folder_index]
        filepath = os.path.join(folder_path, filename)
        
        if os.path.exists(filepath) and os.path.isfile(filepath):
            os.remove(filepath)
            app.logger.info(f"已删除文件: {filepath}")
            return jsonify({"message": f"文件 '{filename}' 已成功删除。"}), 200
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
        encoded_name_part, index_ext_part = parts
        index_ext_split = index_ext_part.split('.', 1)
        if len(index_ext_split) != 2:
            return jsonify({"error": "无效的源文件ID格式。"}), 400
        source_folder_index_str, ext = index_ext_split
        source_folder_index = int(source_folder_index_str)
        
        decoded_name = urllib.parse.unquote(encoded_name_part)
        filename = f"{decoded_name}.{ext}"

        if source_folder_index < 0 or source_folder_index >= len(configured_folders):
            return jsonify({"error": "源文件ID对应的文件夹不存在。"}), 404
        
        source_folder_path = configured_folders[source_folder_index]
        source_file_path = os.path.join(source_folder_path, filename)
        
        if not (os.path.exists(source_file_path) and os.path.isfile(source_file_path)):
            return jsonify({"error": "源文件不存在。"}), 404
            
        # --- 执行移动 ---
        target_file_path = os.path.join(target_folder_path, filename)
        
        # 检查目标文件是否已存在
        if os.path.exists(target_file_path):
            return jsonify({"error": f"目标文件夹中已存在名为 '{filename}' 的文件。"}), 409 # Conflict

        shutil.move(source_file_path, target_file_path)
        
        # 生成新的文件ID
        new_unique_id = f"{urllib.parse.quote(decoded_name, safe='')}_folder{target_folder_index}{ext}"
        
        app.logger.info(f"已移动文件: {source_file_path} -> {target_file_path}")
        return jsonify({
            "message": f"文件 '{filename}' 已成功移动到 '{target_folder_path}'。",
            "new_file_id": new_unique_id
        }), 200
            
    except (ValueError, IndexError):
        return jsonify({"error": "无效的源文件ID格式。"}), 400
    except PermissionError as e:
        app.logger.error(f"权限错误，无法移动文件: {source_file_path} -> {target_file_path}. Error: {e}")
        return jsonify({"error": "权限不足，无法移动文件。"}), 403
    except Exception as e:
        app.logger.error(f"移动文件 {file_id} 时出错: {e}")
        return jsonify({"error": f"移动文件时发生内部错误: {str(e)}"}), 500


# --- 提供前端页面 ---

@app.route('/')
def index():
    """提供前端HTML页面"""
    index_path = os.path.join(WEB_ROOT, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(WEB_ROOT, 'index.html')
    else:
        return "Frontend (index.html) not found. Please ensure it's in the 'web' folder.", 404

@app.route('/settings')
def settings_page():
    """提供设置页面"""
    settings_path = os.path.join(WEB_ROOT, 'settings.html')
    if os.path.exists(settings_path):
        return send_from_directory(WEB_ROOT, 'settings.html')
    else:
        return "Settings page (settings.html) not found.", 404

# --- 设置相关的 API ---

@app.route('/api/config', methods=['GET'])
def get_config_api():
    """API端点：获取当前配置"""
    current_config = load_config()
    config_dict = {}
    for section in current_config.sections():
        config_dict[section] = {}
        for key, value in current_config.items(section):
            config_dict[section][key] = value
    return jsonify(config_dict)

@app.route('/api/config', methods=['POST'])
def update_config():
    """API端点：更新配置"""
    global app_config
    data = request.get_json()
    if not data or 'settings' not in data:
        return jsonify({"error": "Invalid data format. Expected 'settings' object."}), 400

    new_settings = data['settings']
    
    if not app_config.has_section('settings'):
        app_config.add_section('settings')
    
    for key, value in new_settings.items():
        key_str = str(key)
        if key_str.startswith('folder_'):
             app_config.set('settings', key_str, str(value) if value else '')
        else:
             app_config.set('settings', key_str, str(value))

    try:
        save_config(app_config)
        return jsonify({"message": "Configuration updated successfully."}), 200
    except Exception as e:
        app.logger.error(f"Error saving config: {e}")
        return jsonify({"error": f"Failed to save configuration: {str(e)}"}), 500

# --- 提供静态资源 ---

@app.route('/viewer.js')
def serve_viewer_js():
    """提供图片查看器的 JavaScript 文件"""
    js_path = os.path.join(WEB_ROOT, 'viewer.js')
    if os.path.exists(js_path):
        return send_from_directory(WEB_ROOT, 'viewer.js')
    else:
        abort(404)

@app.route('/styles.css')
def serve_styles_css():
    """提供 CSS 文件"""
    css_path = os.path.join(WEB_ROOT, 'styles.css')
    if os.path.exists(css_path):
        return send_from_directory(WEB_ROOT, 'styles.css')
    else:
        abort(404)


def main():
    parser = argparse.ArgumentParser(description='Run the Ubuntu Photo Album web app.')
    parser.add_argument('--port', type=int, help='Port to run the server on')
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')
    args = parser.parse_args()

    use_port = args.port if args.port else PORT
    use_debug = args.debug if args.debug else DEBUG

    print(f"Web root is: {WEB_ROOT}")
    print(f"Configuration file is: {CONFIG_FILE}")
    print(f" * Running on port: {use_port}")
    print(f" * Debug mode: {use_debug}")
    print("Starting Flask development server...")
    print(" * Running on all addresses (0.0.0.0)")
    app.run(host='0.0.0.0', port=use_port, debug=use_debug)

if __name__ == '__main__':
    main()


