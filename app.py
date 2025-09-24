# app.py
from flask import Flask, jsonify, send_from_directory, abort, request, redirect, url_for, render_template_string
import os
import datetime
import configparser
import argparse

# --- Configuration ---
CONFIG_FILE = 'config.ini'
WEB_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')

# 默认配置
DEFAULT_CONFIG = {
    'settings': {
        'image_folder': '/path/to/your/images',
        'port': '80',
        'debug': 'False'
    }
}

def load_config():
    """Load configuration from config.ini or create it with defaults."""
    config = configparser.ConfigParser()
    if not os.path.exists(CONFIG_FILE):
        print(f"配置文件 {CONFIG_FILE} 不存在，将创建默认配置文件。")
        config.read_dict(DEFAULT_CONFIG)
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
IMAGE_FOLDER = app_config.get('settings', 'image_folder', fallback=DEFAULT_CONFIG['settings']['image_folder'])
PORT = app_config.getint('settings', 'port', fallback=int(DEFAULT_CONFIG['settings']['port']))
DEBUG = app_config.getboolean('settings', 'debug', fallback=DEFAULT_CONFIG['settings']['debug'])

app = Flask(__name__)
app.config['IMAGE_FOLDER'] = IMAGE_FOLDER

# 支持的图片扩展名
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff', 'webp'}

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

@app.route('/api/images')
def list_images():
    """API端点：返回图片文件列表及其信息"""
    # 每次请求都重新加载配置，以获取最新的 image_folder
    current_config = load_config()
    image_folder = current_config.get('settings', 'image_folder', fallback=DEFAULT_CONFIG['settings']['image_folder'])
    app.config['IMAGE_FOLDER'] = image_folder # 更新应用配置

    if not os.path.exists(image_folder):
        app.logger.error(f"Image folder does not exist: {image_folder}")
        return jsonify({"error": "Image folder does not exist on the server. Please check the settings."}), 500

    images = []
    try:
        for filename in os.listdir(image_folder):
            filepath = os.path.join(image_folder, filename)
            if os.path.isfile(filepath) and allowed_file(filename):
                size, date = get_file_info(filepath)
                images.append({
                    'filename': filename,
                    'size': size,
                    'date': date
                })
        # 按文件名字母顺序排序
        images.sort(key=lambda x: x['filename'].lower())
        return jsonify(images)
    except Exception as e:
        app.logger.error(f"Error listing images: {e}")
        return jsonify({"error": f"Failed to list images: {str(e)}"}), 500

@app.route('/images/<path:filename>')
def serve_image(filename):
    """API端点：提供图片文件"""
    # 重新加载配置以获取最新路径
    current_config = load_config()
    image_folder = current_config.get('settings', 'image_folder', fallback=DEFAULT_CONFIG['settings']['image_folder'])
    app.config['IMAGE_FOLDER'] = image_folder

    try:
        # send_from_directory 会处理路径安全问题
        return send_from_directory(image_folder, filename)
    except FileNotFoundError:
        app.logger.warning(f"Image not found: {filename}")
        abort(404)
    except Exception as e:
        app.logger.error(f"Error serving image {filename}: {e}")
        abort(500)

@app.route('/')
def index():
    """提供前端HTML页面"""
    index_path = os.path.join(WEB_ROOT, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(WEB_ROOT, 'index.html')
    else:
        return "Frontend (index.html) not found. Please ensure it's in the 'web' folder.", 404

# --- 新增：设置相关的路由 ---

@app.route('/settings')
def settings_page():
    """提供设置页面"""
    settings_path = os.path.join(WEB_ROOT, 'settings.html')
    if os.path.exists(settings_path):
        return send_from_directory(WEB_ROOT, 'settings.html')
    else:
        return "Settings page (settings.html) not found.", 404

@app.route('/api/config', methods=['GET'])
def get_config():
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
    global app_config # 允许修改全局配置对象
    data = request.get_json()
    if not data or 'settings' not in data:
        return jsonify({"error": "Invalid data format. Expected 'settings' object."}), 400

    new_image_folder = data['settings'].get('image_folder')
    if not new_image_folder:
        return jsonify({"error": "Image folder path is required."}), 400

    # 验证新路径（简单检查是否存在）
    if not os.path.exists(new_image_folder):
         # 不直接报错，允许用户设置一个尚不存在但可能后续创建的路径
         print(f"Warning: New image folder path does not exist yet: {new_image_folder}")

    # 更新内存中的配置对象
    if not app_config.has_section('settings'):
        app_config.add_section('settings')
    app_config.set('settings', 'image_folder', new_image_folder)
    
    # 保存到文件
    try:
        save_config(app_config)
        # 更新 Flask app 的配置
        app.config['IMAGE_FOLDER'] = new_image_folder
        return jsonify({"message": "Configuration updated successfully."}), 200
    except Exception as e:
        app.logger.error(f"Error saving config: {e}")
        return jsonify({"error": f"Failed to save configuration: {str(e)}"}), 500


def main():
    # 从命令行参数覆盖配置文件中的端口和调试模式（如果需要）
    parser = argparse.ArgumentParser(description='Run the Ubuntu Photo Album web app.')
    parser.add_argument('--port', type=int, help='Port to run the server on')
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')
    args = parser.parse_args()

    use_port = args.port if args.port else PORT
    use_debug = args.debug if args.debug else DEBUG

    print(f"Web root is: {WEB_ROOT}")
    print(f"Configuration file is: {CONFIG_FILE}")
    print(f" * Image folder is: {app.config['IMAGE_FOLDER']}")
    print(f" * Running on port: {use_port}")
    print(f" * Debug mode: {use_debug}")
    print("Starting Flask development server...")
    print(" * Running on all addresses (0.0.0.0)")
    # 注意：生产环境请勿使用 app.run()
    app.run(host='0.0.0.0', port=use_port, debug=use_debug)

if __name__ == '__main__':
    main()



