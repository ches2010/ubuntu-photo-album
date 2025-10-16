#!/bin/bash

# 确保脚本以root权限运行
if [ "$(id -u)" -ne 0 ]; then
    echo "请使用root权限运行此脚本: sudo $0"
    exit 1
fi

# 安装必要的软件
echo "1/5: 安装必要的软件..."
apt update
apt install -y php8.1 php7.4-fpm php7.4-cli nginx unzip wget

# 创建项目目录
echo "2/5: 创建项目目录..."
PROJECT_DIR="/var/www/photo-album"
mkdir -p $PROJECT_DIR
chown -R www-data:www-data $PROJECT_DIR
chmod -R 755 $PROJECT_DIR

# 配置Nginx
echo "3/5: 配置Nginx..."
cat > /etc/nginx/sites-available/photo-album <<EOF
server {
    listen 80;
    server_name _;
    root $PROJECT_DIR;
    index index.php;

    location / {
        try_files \$uri \$uri/ /index.php\$is_args\$args;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php7.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    # 图片缓存设置
    location ~* \.(jpg|jpeg|png|gif|webp)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }

    # 静态文件缓存
    location ~* \.(css|js|ico|svg|woff|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }
}
EOF

# 启用站点配置
ln -s /etc/nginx/sites-available/photo-album /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 重启Nginx
systemctl restart nginx
systemctl enable nginx
systemctl restart php7.4-fpm
systemctl enable php7.4-fpm

# 提示用户设置图片文件夹
echo "4/5: 配置图片文件夹路径..."
read -p "请输入图片文件夹的绝对路径 (默认: /var/www/photos): " IMAGE_FOLDER
IMAGE_FOLDER=${IMAGE_FOLDER:-/var/www/photos}

# 创建图片文件夹
mkdir -p $IMAGE_FOLDER
chown -R www-data:www-data $IMAGE_FOLDER
chmod -R 755 $IMAGE_FOLDER

# 完成部署
echo "5/5: 完成部署..."

# 显示访问信息
IP_ADDR=$(hostname -I | awk '{print $1}')
echo "=============================================="
echo "部署完成！"
echo "您可以通过以下地址访问相册: http://$IP_ADDR"
echo "图片文件夹路径: $IMAGE_FOLDER"
echo "请将您的图片放入 $IMAGE_FOLDER 文件夹中"
echo "=============================================="
    
