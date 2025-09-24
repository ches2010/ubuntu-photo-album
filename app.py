# app.py
import os
import configparser
from flask import Flask, jsonify, request, send_from_directory, render_template_string
from flask_cors import CORS
import shutil

app = Flask(__name__, static_folder='web', static_url_path='')
CORS(app)  # 允许跨域请求

CONFIG_FILE = 'config.ini'
DEFAULT_IMAGES_PER_ROW = 5
DEFAULT_PORT = 80
DEFAULT_DEBUG = False

# --- 配置管理 ---
def load_config():
    """从 config.ini 加载配置"""
    config = configparser.ConfigParser()
    if not os.path.exists(CONFIG_FILE):
        # 如果配置文件不存在，创建一个默认的
        config['settings'] = {
            'port': str(DEFAULT_PORT),
            'debug': str(DEFAULT_DEBUG),
            'images_per_row': str(DEFAULT_IMAGES_PER_ROW),
            'folder_1': '/path/to/your/images' # 示例路径
        }
        with open(CONFIG_FILE, 'w') as configfile:
            config.write(configfile)
        print(f"已创建默认配置文件: {CONFIG_FILE}")
    else:
        config.read(CONFIG_FILE)
    return config

def save_config(config):
    """将配置保存到 config.ini"""
    with open(CONFIG_FILE, 'w') as configfile:
        config.write(configfile)

# --- 图片处理逻辑 ---
def get_image_files_from_folders(folders):
    """从指定的文件夹列表及其子文件夹中递归获取图片文件信息"""
    valid_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff')
    images = []
    for folder_key, folder_path in folders.items():
        root_folder_path = folder_path.strip()
        if not root_folder_path or not os.path.isdir(root_folder_path):
            continue # 跳过无效或空的路径

        # 使用 os.walk 递归遍历目录
        for dirpath, _, filenames in os.walk(root_folder_path):
            for filename in filenames:
                if filename.lower().endswith(valid_extensions):
                    full_path = os.path.join(dirpath, filename)
                    # 计算相对于根文件夹的子文件夹路径
                    try:
                        subfolder_rel_path = os.path.relpath(dirpath, root_folder_path)
                        # 如果文件直接在根文件夹下，subfolder_rel_path 会是 '.'
                        subfolder = subfolder_rel_path if subfolder_rel_path != '.' else ''
                    except ValueError:
                        # 如果 dirpath 和 root_folder_path 不在同一个驱动器上（Windows），relpath 会抛出 ValueError
                        # 这种情况下，我们可以选择将 subfolder 设为空或使用完整路径的一部分
                        # 这里我们简单地设为空，或者可以记录日志
                        subfolder = ''
                        print(f"Warning: Could not determine relative path for {dirpath} from {root_folder_path}")

                    images.append({
                        'filename': filename,
                        'filepath': full_path, # 用于后端处理
                        'url': f"/api/image?path={full_path}", # 用于前端显示
                        'folder_key': folder_key, # 用于移动功能
                        'root_folder': root_folder_path, # 添加根文件夹路径
                        'subfolder': subfolder # 添加子文件夹路径
                    })
    return images

# --- 路由 ---
@app.route('/')
def index():
    """提供主页面"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/settings')
def settings():
    """提供设置页面"""
    return send_from_directory('web', 'settings.html')

@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    """处理配置的获取和更新"""
    config = load_config()
    if request.method == 'GET':
        # 返回配置 (转换为字典)
        settings_dict = {k: v for k, v in config['settings'].items()}
        return jsonify({'settings': settings_dict})

    elif request.method == 'POST':
        # 更新配置
        data = request.get_json()
        if not data or 'settings' not in data:
            return jsonify({'error': '无效的请求数据'}), 400

        new_settings = data['settings']
        # 更新 config 对象
        for key, value in new_settings.items():
            config.set('settings', key, str(value)) # 确保值是字符串

        save_config(config)
        return jsonify({'message': '配置已更新'})

@app.route('/api/images')
def get_images():
    """获取所有图片列表"""
    config = load_config()
    folders = {k: v for k, v in config['settings'].items() if k.startswith('folder_') and v.strip()}
    images = get_image_files_from_folders(folders)
    return jsonify(images)

@app.route('/api/image')
def serve_image():
    """提供单个图片文件"""
    image_path = request.args.get('path')
    if not image_path or not os.path.exists(image_path):
        return "图片未找到", 404
    
    directory = os.path.dirname(image_path)
    filename = os.path.basename(image_path)
    return send_from_directory(directory, filename)

@app.route('/api/move_image', methods=['POST'])
def move_image():
    """移动图片到另一个配置的文件夹"""
    data = request.get_json()
    if not data:
        return jsonify({'error': '缺少请求数据'}), 400

    image_path = data.get('image_path')
    target_folder_key = data.get('target_folder_key')

    if not image_path or not target_folder_key:
        return jsonify({'error': '缺少 image_path 或 target_folder_key'}), 400

    if not os.path.exists(image_path):
        return jsonify({'error': '源图片不存在'}), 404

    config = load_config()
    target_folder_path = config.get('settings', target_folder_key, fallback=None)

    if not target_folder_path:
        return jsonify({'error': f'目标文件夹 {target_folder_key} 未在配置中找到'}), 400

    if not os.path.isdir(target_folder_path):
         return jsonify({'error': f'目标路径 {target_folder_path} 不是有效目录'}), 400

    try:
        # 构造目标文件的完整路径
        filename = os.path.basename(image_path)
        destination_path = os.path.join(target_folder_path, filename)

        # 检查目标文件是否已存在
        if os.path.exists(destination_path):
            return jsonify({'error': f'文件 {filename} 已存在于目标文件夹中'}), 409 # Conflict

        # 执行移动操作
        shutil.move(image_path, destination_path)
        return jsonify({'message': f'图片已成功移动到 {target_folder_path}'})
    except Exception as e:
        return jsonify({'error': f'移动图片时出错: {str(e)}'}), 500

@app.route('/api/delete_image', methods=['POST'])
def delete_image():
    """删除图片"""
    data = request.get_json()
    if not data:
        return jsonify({'error': '缺少请求数据'}), 400

    image_path = data.get('image_path')
    if not image_path:
        return jsonify({'error': '缺少 image_path'}), 400

    if not os.path.exists(image_path):
        return jsonify({'error': '图片不存在'}), 404

    try:
        os.remove(image_path)
        return jsonify({'message': '图片已成功删除'})
    except Exception as e:
        return jsonify({'error': f'删除图片时出错: {str(e)}'}), 500

if __name__ == '__main__':
    config = load_config()
    port = int(config.get('settings', 'port', fallback=DEFAULT_PORT))
    debug = config.getboolean('settings', 'debug', fallback=DEFAULT_DEBUG)
    print(f"启动服务器于端口 {port}, Debug模式: {debug}")
    app.run(host='0.0.0.0', port=port, debug=debug)



