# app.py
from flask import Flask, jsonify, send_from_directory, abort, request
import os
import datetime
import configparser
import argparse
import urllib.parse # For URL encoding

# --- Configuration ---
CONFIG_FILE = 'config.ini'
WEB_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')

# 默认配置
DEFAULT_CONFIG = {
    'settings': {
        'port': '80',
        'debug': 'False',
        'images_per_row': '5' # Default value
    }
}

def load_config():
    """Load configuration from config.ini or create it with defaults."""
    config = configparser.ConfigParser()
    if not os.path.exists(CONFIG_FILE):
        print(f"配置文件 {CONFIG_FILE} 不存在，将创建默认配置文件。")
        config.read_dict(DEFAULT_CONFIG)
        # Add a default folder entry
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
        # 简单转换文件大小
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
    # 每次请求都重新加载配置
    current_config = load_config()
    configured_folders = get_configured_folders(current_config)
    
    # 获取每行照片数设置
    images_per_row = current_config.getint('settings', 'images_per_row', fallback=IMAGES_PER_ROW_DEFAULT)

    if not configured_folders:
        app.logger.error("没有配置有效的图片文件夹。")
        return jsonify({"error": "服务器上未配置有效的图片文件夹。请检查设置。", "images_per_row": images_per_row}), 500

    all_images = []
    folder_map = {} # 用于记录文件名到文件夹的映射，处理重名文件
    for folder_path in configured_folders:
        try:
            for filename in os.listdir(folder_path):
                filepath = os.path.join(folder_path, filename)
                if os.path.isfile(filepath) and allowed_file(filename):
                    # 使用 (filename, folder_path) 作为唯一键来处理重名文件
                    key = (filename, folder_path)
                    if key not in folder_map:
                        size, date = get_file_info(filepath)
                        # 为每个文件生成一个唯一的 ID，用于前端请求
                        # 这里简单地使用 文件名_文件夹索引_文件扩展名
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
            # 可以选择跳过错误文件夹或返回错误，这里选择记录日志并继续

    # 按文件名排序
    all_images.sort(key=lambda x: x['filename'].lower())
    
    # 将 images_per_row 也返回给前端
    response_data = {
        "images": all_images,
        "images_per_row": images_per_row
    }
    return jsonify(response_data)

@app.route('/images/<path:file_id>')
def serve_image(file_id):
    """API端点：根据唯一ID提供图片文件"""
    # 重新加载配置以获取最新路径
    current_config = load_config()
    configured_folders = get_configured_folders(current_config)

    if not configured_folders:
         abort(500) # 或返回特定错误

    # 解析 file_id 来找到对应的文件夹和文件名
    # 假设 file_id 格式为 {encoded_name}_folder{index}{ext}
    try:
        # 简单反向解析，实际项目中可能需要更健壮的方法
        parts = file_id.split('_folder')
        if len(parts) != 2:
            abort(404)
        encoded_name_part, index_ext_part = parts
        # index_ext_part 应该是 "index.ext"
        index_ext_split = index_ext_part.split('.', 1)
        if len(index_ext_split) != 2:
            abort(404)
        folder_index_str, ext = index_ext_split
        folder_index = int(folder_index_str)
        
        # 解码文件名 (这里假设前端用 quote 编码了文件名)
        decoded_name = urllib.parse.unquote(encoded_name_part)
        filename = f"{decoded_name}.{ext}"

        if folder_index < 0 or folder_index >= len(configured_folders):
            abort(404)
        
        folder_path = configured_folders[folder_index]
        filepath = os.path.join(folder_path, filename)
        
        if os.path.exists(filepath) and os.path.isfile(filepath):
             # send_from_directory 会处理路径安全问题
            return send_from_directory(folder_path, filename)
        else:
            abort(404)
    except (ValueError, IndexError):
        abort(404)
    except Exception as e:
        app.logger.error(f"Error serving image {file_id}: {e}")
        abort(500)

@app.route('/')
def index():
    """提供前端HTML页面"""
    index_path = os.path.join(WEB_ROOT, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(WEB_ROOT, 'index.html')
    else:
        return "Frontend (index.html) not found. Please ensure it's in the 'web' folder.", 404

# --- 设置相关的路由 ---

@app.route('/settings')
def settings_page():
    """提供设置页面"""
    settings_path = os.path.join(WEB_ROOT, 'settings.html')
    if os.path.exists(settings_path):
        return send_from_directory(WEB_ROOT, 'settings.html')
    else:
        return "Settings page (settings.html) not found.", 404

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
    
    # 更新内存中的配置对象
    if not app_config.has_section('settings'):
        app_config.add_section('settings')
    
    # 更新所有设置项
    for key, value in new_settings.items():
        # 确保 key 是字符串
        key_str = str(key)
        # 特殊处理 folder_x 键，确保值是字符串
        if key_str.startswith('folder_'):
             app_config.set('settings', key_str, str(value) if value else '')
        else:
             app_config.set('settings', key_str, str(value))

    # 保存到文件
    try:
        save_config(app_config)
        return jsonify({"message": "Configuration updated successfully."}), 200
    except Exception as e:
        app.logger.error(f"Error saving config: {e}")
        return jsonify({"error": f"Failed to save configuration: {str(e)}"}), 500

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



