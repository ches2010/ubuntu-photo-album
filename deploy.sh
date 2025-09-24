#!/bin/bash

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

# 2. 创建专用用户
echo "2/6: 创建专用用户 '$USER_NAME'..."
id -u $USER_NAME &>/dev/null || useradd -r -s /bin/false -m -d /var/lib/$USER_NAME $USER_NAME

# 3. 设置项目文件
echo "3/6: 设置项目文件..."
INSTALL_DIR="/opt/$PROJECT_NAME"
mkdir -p $INSTALL_DIR
cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR"/
chown $USER_NAME:$USER_NAME "$INSTALL_DIR/config.ini"
chmod 644 "$INSTALL_DIR/config.ini"
chown -R $USER_NAME:$USER_NAME $INSTALL_DIR
chmod +x "$INSTALL_DIR/deploy.sh"

# 4. 创建并激活虚拟环境，安装Python依赖
echo "4/6: 创建Python虚拟环境并安装依赖..."
cd $INSTALL_DIR
sudo -u $USER_NAME python3 -m venv venv
sudo -u $USER_NAME bash -c "source venv/bin/activate && pip install -r requirements.txt"

# 5. 配置提示（不再直接修改配置文件，而是引导用户通过网页设置）
echo "5/6: 配置说明..."
read -p "请输入初始图片文件夹的绝对路径 (例如: /home/youruser/photos): " IMAGE_FOLDER_PATH

if [[ ! -d "$IMAGE_FOLDER_PATH" ]]; then
    echo "警告: 指定的路径 '$IMAGE_FOLDER_PATH' 不存在。"
    read -p "是否创建该文件夹? (y/N): " CREATE_DIR
    if [[ $CREATE_DIR =~ ^[Yy]$ ]]; then
        mkdir -p "$IMAGE_FOLDER_PATH"
        echo "文件夹已创建: $IMAGE_FOLDER_PATH"
    fi
fi

# 设置初始文件夹权限
setfacl -R -m u:$USER_NAME:rx "$IMAGE_FOLDER_PATH" 2>/dev/null || chmod -R 755 "$IMAGE_FOLDER_PATH"
echo "已为用户 '$USER_NAME' 设置对 '$IMAGE_FOLDER_PATH' 的访问权限。"

# 仅设置初始文件夹，其他配置通过网页设置
sed -i "s|^folder_1 = .*|folder_1 = $IMAGE_FOLDER_PATH|" "$INSTALL_DIR/config.ini"

# 6. 配置 Supervisor 管理 Flask 应用
echo "6/6: 配置 Supervisor 服务..."
cat > /etc/supervisor/conf.d/$SERVICE_NAME.conf <<EOF
[program:$SERVICE_NAME]
command=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/app.py
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

# 配置 Nginx
echo "配置 Nginx..."
NGINX_CONF="/etc/nginx/sites-available/$SERVICE_NAME"
cat > $NGINX_CONF <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl restart nginx

echo "===== 部署完成 ====="
echo "1. 应用已部署，服务名为: $SERVICE_NAME"
echo "2. 访问相册后，可以通过右上角的设置按钮配置："
echo "   - 子文件夹扫描选项"
echo "   - 每行显示的图片数量"
echo "   - 添加多个图片文件夹"
echo ""
IP_ADDRESS=$(hostname -I | awk '{print $1}')
if [ -z "$IP_ADDRESS" ]; then
    IP_ADDRESS="<your_server_ip>"
fi
echo "请通过浏览器访问: http://$IP_ADDRESS"
echo "========================"
