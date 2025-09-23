# app.py
from flask import Flask, jsonify, send_from_directory, abort, render_template_string
import os
import datetime
import argparse

# --- Configuration ---
# 默认图片文件夹路径 (可通过命令行参数或环境变量覆盖)
DEFAULT_IMAGE_FOLDER = '/path/to/your/images'
# 前端HTML文件夹
WEB_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')

app = Flask(__name__)
# 优先级: 命令行参数 > 环境变量 > 默认值
app.config['IMAGE_FOLDER'] = DEFAULT_IMAGE_FOLDER

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

@app.route('/api/images')
def list_images():
    """API端点：返回图片文件列表及其信息"""
    image_folder = app.config['IMAGE_FOLDER']
    if not os.path.exists(image_folder):
        app.logger.error(f"Image folder does not exist: {image_folder}")
        return jsonify({"error": "Image folder does not exist on the server"}), 500

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
    image_folder = app.config['IMAGE_FOLDER']
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

def main():
    parser = argparse.ArgumentParser(description='Run the Ubuntu Photo Album web app.')
    parser.add_argument('--image-folder', type=str, help='Path to the folder containing images')
    args = parser.parse_args()

    if args.image_folder:
        app.config['IMAGE_FOLDER'] = os.path.abspath(args.image_folder)
        print(f"Image folder set via command line argument to: {app.config['IMAGE_FOLDER']}")
    elif 'IMAGE_FOLDER' in os.environ:
        app.config['IMAGE_FOLDER'] = os.path.abspath(os.environ['IMAGE_FOLDER'])
        print(f"Image folder set via environment variable to: {app.config['IMAGE_FOLDER']}")
    else:
        print(f"Using default or previously configured image folder: {app.config['IMAGE_FOLDER']}")

    if not os.path.exists(app.config['IMAGE_FOLDER']):
        print(f"Warning: Configured image folder '{app.config['IMAGE_FOLDER']}' does not exist.")

    print(f"Web root is: {WEB_ROOT}")
    print("Starting Flask development server...")
    print(" * Running on all addresses (0.0.0.0)")
    print(f" * Image folder is: {app.config['IMAGE_FOLDER']}")
    # 注意：生产环境请勿使用 app.run()
    app.run(host='0.0.0.0', port=80, debug=False) # 默认运行在 80 端口

if __name__ == '__main__':
    main()



