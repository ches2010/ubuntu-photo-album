#!/bin/bash

# deploy.sh - Ubuntu Photo Album 一键部署脚本

set -e # 遇到错误时退出

echo "===== Ubuntu Photo Album 一键部署脚本 ====="

# 检查是否以 root 权限运行
if [[ $EUID -ne 0 ]]; then
   echo "此脚本需要 root 权限 (sudo) 来安装软件包和配置服务。"
   exit 1
fi

# 获取当前脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_NAME="ubuntu-photo-album"
SERVICE_NAME="photoalbum"
USER_NAME="photoalbum"

echo "脚本目录: $SCRIPT_DIR"

# 1. 安装系统依赖
echo "1/6: 更新包列表并安装系统依赖..."
apt update
apt install -y python3 python3-pip python3-venv nginx supervisor

# 2. 创建专用用户 (可选，但推荐)
echo "2/6: 创建专用用户 '$USER_NAME'..."
id -u $USER_NAME &>/dev/null || useradd -r -s /bin/false -m -d /var/lib/$USER_NAME $USER_NAME

# 3. 设置项目文件
echo "3/6: 设置项目文件..."
INSTALL_DIR="/opt/$PROJECT_NAME"
mkdir -p $INSTALL_DIR
# 复制当前目录下的所有文件到安装目录
cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR"/
chown -R $USER_NAME:$USER_NAME $INSTALL_DIR
chmod +x "$INSTALL_DIR/deploy.sh" # 确保脚本可执行

# 4. 创建并激活虚拟环境，安装Python依赖
echo "4/6: 创建Python虚拟环境并安装依赖..."
cd $INSTALL_DIR
sudo -u $USER_NAME python3 -m venv venv
# 使用虚拟环境中的 pip 安装依赖
sudo -u $USER_NAME bash -c "source venv/bin/activate && pip install -r requirements.txt"

# 5. 配置图片文件夹
echo "5/6: 配置图片文件夹..."
read -p "请输入存放图片的文件夹的绝对路径 (例如: /home/youruser/photos): " IMAGE_FOLDER_PATH

if [[ ! -d "$IMAGE_FOLDER_PATH" ]]; then
    echo "警告: 指定的路径 '$IMAGE_FOLDER_PATH' 不存在。"
    read -p "是否创建该文件夹? (y/N): " CREATE_DIR
    if [[ $CREATE_DIR =~ ^[Yy]$ ]]; then
        mkdir -p "$IMAGE_FOLDER_PATH"
        echo "文件夹已创建: $IMAGE_FOLDER_PATH"
    else
        echo "请确保图片文件夹路径正确。部署继续，但应用可能无法找到图片。"
    fi
fi
# 确保 photoalbum 用户有读取权限
setfacl -m u:$USER_NAME:rx "$IMAGE_FOLDER_PATH" 2>/dev/null || chmod 755 "$IMAGE_FOLDER_PATH"
# 如果文件夹内有文件，也需要设置权限 (简单起见，给所有文件rx权限)
find "$IMAGE_FOLDER_PATH" -type f -exec setfacl -m u:$USER_NAME:r {} \; 2>/dev/null || find "$IMAGE_FOLDER_PATH" -type f -exec chmod 644 {} \;
echo "已尝试为用户 '$USER_NAME' 设置对 '$IMAGE_FOLDER_PATH' 的访问权限。"

# 6. 配置 Supervisor 管理 Flask 应用
echo "6/6: 配置 Supervisor 服务..."
cat > /etc/supervisor/conf.d/$SERVICE_NAME.conf <<EOF
[program:$SERVICE_NAME]
command=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/app.py --image-folder $IMAGE_FOLDER_PATH
directory=$INSTALL_DIR
user=$USER_NAME
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/$SERVICE_NAME.log
environment=PATH="$INSTALL_DIR/venv/bin"
EOF

# 重新加载 Supervisor 配置
supervisorctl reread
supervisorctl update
supervisorctl restart $SERVICE_NAME || supervisorctl start $SERVICE_NAME

# 配置 Nginx (可选，但推荐用于生产)
echo "配置 Nginx..."
NGINX_CONF="/etc/nginx/sites-available/$SERVICE_NAME"
cat > $NGINX_CONF <<EOF
server {
    listen 80;
    server_name _; # 监听所有域名

    location / {
        proxy_pass http://127.0.0.1:5000; # Flask 默认端口
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 启用站点配置
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
# 禁用默认站点 (可选)
rm -f /etc/nginx/sites-enabled/default

# 测试 Nginx 配置并重启
nginx -t && systemctl restart nginx

echo "===== 部署完成 ====="
echo "1. Flask 应用已通过 Supervisor 管理，服务名为: $SERVICE_NAME"
echo "   查看日志: sudo tail -f /var/log/$SERVICE_NAME.log"
echo "   管理服务: sudo supervisorctl {start|stop|restart} $SERVICE_NAME"
echo ""
echo "2. Nginx 已配置为反向代理到 Flask 应用。"
echo "   Nginx 配置文件: $NGINX_CONF"
echo ""
echo "*** 请确保你的服务器防火墙允许 HTTP (端口 80) 流量 ***"
echo ""
IP_ADDRESS=$(hostname -I | awk '{print $1}')
if [ -z "$IP_ADDRESS" ]; then
    IP_ADDRESS="<your_server_ip>"
fi
echo "现在你可以通过浏览器访问: http://$IP_ADDRESS"
echo "========================"



