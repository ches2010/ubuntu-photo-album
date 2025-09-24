from flask import Flask, jsonify, send_from_directory, abort, request
import os
import datetime
import configparser
import urllib.parse
import shutil
from pathlib import Path

# --- 配置 ---
CONFIG_FILE = 'config.ini'
# 确定项目根目录和web目录
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
WEB_ROOT = os.path.join(PROJECT_ROOT, 'web')

# 确保web目录存在
Path(WEB_ROOT).mkdir(parents=True, exist_ok=True)

# 默认配置
DEFAULT_CONFIG = {
    'settings': {
        'port': '5000',
        'debug': 'False',
        'images_per_row': '5',
        'scan_subfolders': 'True',
        'max_depth': '3',
        'folder_1': '/path/to/your/images'
    }
}

def load_config():
    """加载配置文件，如不存在则创建默认配置"""
    config = configparser.ConfigParser()
    if not os.path.exists(CONFIG_FILE):
        print(f"配置文件 {CONFIG_FILE} 不存在，创建默认配置")
        config.read_dict(DEFAULT_CONFIG)
        save_config(config)
    else:
        config.read(CONFIG_FILE)
    
    # 确保所有必要的配置项都存在
    for section in DEFAULT_CONFIG:
        if not config.has_section(section):
            config.add_section(section)
        for key, value in DEFAULT_CONFIG[section].items():
            if not config.has_option(section, key):
                config.set(section, key, value)
    
    return config

def save_config(config):
    """保存配置到文件"""
    try:
        with open(CONFIG_FILE, 'w') as configfile:
            config.write(configfile)
        return True
    except Exception as e:
        print(f"保存配置失败: {e}")
        return False

# 加载配置
app_config = load_config()
PORT = app_config.getint('settings', 'port', fallback=int(DEFAULT_CONFIG['settings']['port']))
DEBUG = app_config.getboolean('settings', 'debug', fallback=False)
IMAGES_PER_ROW_DEFAULT = app_config.getint('settings', 'images_per_row', fallback=5)

app = Flask(__name__)

# 支持的图片扩展名
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'}

def allowed_file(filename):
    """检查文件是否为允许的图片格式"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_info(filepath):
    """获取文件大小和修改日期信息"""
    try:
        stat = os.stat(filepath)
        size_bytes = stat.st_size
        
        # 格式化文件大小
        if size_bytes < 1024:
            size = f"{size_bytes} B"
        elif size_bytes < 1024**2:
            size = f"{size_bytes/1024:.1f} KB"
        elif size_bytes < 1024**3:
            size = f"{size_bytes/(1024**2):.1f} MB"
        else:
            size = f"{size_bytes/(1024**3):.1f} GB"
            
        # 格式化修改日期
        mtime = datetime.datetime.fromtimestamp(stat.st_mtime)
        date_str = mtime.strftime('%Y-%m-%d')
        return size, date_str
    except OSError:
        return "Unknown", "Unknown"

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
    """从配置中提取所有有效的图片文件夹"""
    folders = []
    if config.has_section('settings'):
        for key, value in config.items('settings'):
            if key.startswith('folder_') and value.strip():
                folder_path = value.strip()
                if os.path.exists(folder_path) and os.path.isdir(folder_path):
                    folders.append(folder_path)
                else:
                    app.logger.warning(f"配置的文件夹不存在或不是目录: {folder_path}")
    return folders

# --- 路由 ---
@app.route('/')
def index():
    """相册首页"""
    return send_from_directory(WEB_ROOT, 'index.html')

@app.route('/settings')
def settings_page():
    """设置页面"""
    return send_from_directory(WEB_ROOT, 'settings.html')

@app.route('/api/images')
def list_images():
    """API端点：返回分页的图片列表"""
    current_config = load_config()
    configured_folders = get_configured_folders(current_config)
    
    # 获取分页参数
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 40))
        
        # 限制每页数量
        if per_page not in [40, 80]:
            per_page = 40
            
        if page < 1:
            page = 1
    except ValueError:
        page = 1
        per_page = 40

    images_per_row = current_config.getint('settings', 'images_per_row', fallback=IMAGES_PER_ROW_DEFAULT)
    scan_subfolders = current_config.getboolean('settings', 'scan_subfolders', fallback=True)
    max_depth = current_config.getint('settings', 'max_depth', fallback=0)

    if not configured_folders:
        app.logger.error("没有配置有效的图片文件夹")
        return jsonify({
            "error": "服务器上未配置有效的图片文件夹。请检查设置。", 
            "images_per_row": images_per_row
        }), 500

    all_images = []
    folder_map = {}
    
    for folder_path in configured_folders:
        try:
            if scan_subfolders:
                filepaths = scan_folder_recursive(folder_path, max_depth=max_depth)
            else:
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
                    
                    # 生成唯一ID
                    encoded_path = urllib.parse.quote(relative_path, safe='')
                    unique_id = f"{encoded_path}_folder{folder_index}"
                    
                    all_images.append({
                        'id': unique_id,
                        'filename': filename,
                        'folder': folder_path,
                        'relative_path': relative_path,
                        'size': size,
                        'date': date
                    })
                    folder_map[key] = True
                    
        except Exception as e:
            app.logger.error(f"扫描文件夹 {folder_path} 时出错: {e}")

    # 排序
    all_images.sort(key=lambda x: (x['folder'], x['relative_path'].lower()))
    
    # 分页处理
    total_images = len(all_images)
    total_pages = max(1, (total_images + per_page - 1) // per_page)  # 向上取整
    start = (page - 1) * per_page
    end = start + per_page
    paginated_images = all_images[start:end]
    
    response_data = {
        "images": paginated_images,
        "page": page,
        "per_page": per_page,
        "total_images": total_images,
        "total_pages": total_pages,
        "images_per_row": images_per_row,
        "scan_subfolders": scan_subfolders
    }
    return jsonify(response_data)

@app.route('/images/<path:file_id>')
def serve_image(file_id):
    """API端点：提供图片文件"""
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
            return send_from_directory(os.path.dirname(filepath), os.path.basename(filepath))
        else:
            abort(404)
    except (ValueError, IndexError):
        abort(404)
    except Exception as e:
        app.logger.error(f"提供图片 {file_id} 时出错: {e}")
        abort(500)

@app.route('/api/images/<path:file_id>', methods=['DELETE'])
def delete_image(file_id):
    """API端点：删除图片"""
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
        filename = os.path.basename(filepath)
        
        if os.path.exists(filepath) and os.path.isfile(filepath):
            os.remove(filepath)
            app.logger.info(f"已删除文件: {filepath}")
            return jsonify({"message": f"文件 '{filename}' 已成功删除。"}), 200
        else:
            return jsonify({"error": f"文件 '{filename}' 不存在。"}), 404
            
    except (ValueError, IndexError):
        return jsonify({"error": "无效的文件ID格式。"}), 400
    except PermissionError:
        app.logger.error(f"权限错误，无法删除文件: {filepath}")
        return jsonify({"error": f"权限不足，无法删除文件 '{filename}'。"}), 403
    except Exception as e:
        app.logger.error(f"删除文件 {file_id} 时出错: {e}")
        return jsonify({"error": f"删除文件时发生内部错误: {str(e)}"}), 500

@app.route('/api/images/<path:file_id>/move', methods=['POST'])
def move_image(file_id):
    """API端点：移动图片到其他文件夹"""
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

    # 解析源文件ID
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
        
        # 处理同名文件
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

@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    """处理配置的获取和保存"""
    if request.method == 'POST':
        try:
            config_data = request.get_json()
            
            if not isinstance(config_data, dict):
                return jsonify({"error": "无效的数据格式，期望一个对象"}), 400
                
            config = load_config()
            
            # 更新基本设置
            for key in ['port', 'debug', 'images_per_row', 'scan_subfolders', 'max_depth']:
                if key in config_data:
                    config.set('settings', key, str(config_data[key]))
            
            # 处理图片文件夹
            if 'image_folders' in config_data and isinstance(config_data['image_folders'], list):
                # 先移除所有现有文件夹配置
                for key in list(config['settings'].keys()):
                    if key.startswith('folder_'):
                        config.remove_option('settings', key)
                
                # 添加新的文件夹配置
                for i, folder_path in enumerate(config_data['image_folders'], 1):
                    if folder_path and isinstance(folder_path, str):
                        config.set('settings', f'folder_{i}', folder_path.strip())
            
            # 保存配置
            if save_config(config):
                return jsonify({"message": "配置已成功保存"})
            else:
                return jsonify({"error": "保存配置到文件失败"}), 500
                
        except Exception as e:
            app.logger.error(f"保存配置时出错: {str(e)}")
            return jsonify({"error": f"保存配置失败: {str(e)}"}), 500
    
    # GET 请求 - 返回当前配置
    try:
        config = load_config()
        
        config_dict = {
            'port': config.getint('settings', 'port', fallback=5000),
            'debug': config.getboolean('settings', 'debug', fallback=False),
            'images_per_row': config.getint('settings', 'images_per_row', fallback=5),
            'scan_subfolders': config.getboolean('settings', 'scan_subfolders', fallback=True),
            'max_depth': config.getint('settings', 'max_depth', fallback=3),
            'image_folders': []
        }
        
        # 收集图片文件夹配置
        i = 1
        while True:
            folder_key = f'folder_{i}'
            if config.has_option('settings', folder_key):
                folder_path = config.get('settings', folder_key)
                if folder_path:
                    config_dict['image_folders'].append(folder_path)
                i += 1
            else:
                break
        
        return jsonify(config_dict)
        
    except Exception as e:
        app.logger.error(f"获取配置时出错: {str(e)}")
        return jsonify({"error": f"获取配置失败: {str(e)}"}), 500

# 静态文件路由 - 确保可以访问CSS、JS等静态资源
@app.route('/css/<path:path>')
def send_css(path):
    return send_from_directory(os.path.join(WEB_ROOT, 'css'), path)

@app.route('/js/<path:path>')
def send_js(path):
    return send_from_directory(os.path.join(WEB_ROOT, 'js'), path)

# 404错误处理
@app.errorhandler(404)
def page_not_found(e):
    return send_from_directory(WEB_ROOT, '404.html'), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=DEBUG)
