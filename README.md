# Ubuntu 服务器相册

一个简单的 Web 应用，用于在 Ubuntu 服务器上实时浏览指定文件夹中的图片。

## 功能

*   列出指定文件夹中的所有图片。
*   在网页上以缩略图形式展示图片。
*   点击图片可查看大图及信息。
*   提供一键部署脚本 (适用于 Ubuntu/Debian)。

## 技术栈

*   **后端**: Python, Flask
*   **前端**: HTML, CSS, JavaScript

## 快速开始 (Ubuntu/Debian 服务器)

### 一键部署

1.  **克隆仓库**:
  
    ```bash
    git clone https://github.com/你的用户名/ubuntu-photo-album.git
    cd ubuntu-photo-album
    ```

2.  **运行部署脚本**:
    ```bash
    chmod +x deploy.sh
    sudo ./deploy.sh
    ```
    脚本会提示你输入图片文件夹的绝对路径。

3.  **访问**:
    脚本完成后，会输出访问地址，通常是 `http://<你的服务器IP>`。

### 手动部署

1.  **安装 Python 和 pip** (如果尚未安装):
    ```bash
    sudo apt update
    sudo apt install python3 python3-pip python3-venv -y
    ```

2.  **创建虚拟环境并安装依赖**:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```

3.  **配置**:
    *   编辑 `app.py` 文件，设置 `IMAGE_FOLDER` 变量为你存放图片的文件夹的**绝对路径**。
    *   (可选) 修改 `WEB_ROOT` 或其他配置。

4.  **运行**:
    ```bash
    python app.py
    ```
    默认会在 `http://0.0.0.0:5000` 启动开发服务器。

    **注意**: 对于生产环境，请使用 Gunicorn 和 Nginx。


## 许可证

本项目采用 MIT 许可证。详情请见 [LICENSE](LICENSE) 文件。
    *   部署完成后，根据脚本输出的 IP 地址访问你的相册。

这个结构提供了一个完整的、可部署到 GitHub 并在 Ubuntu 服务器上一键安装的相册解决方案。
