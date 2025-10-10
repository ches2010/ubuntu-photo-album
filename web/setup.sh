#!/bin/bash

# 此脚本用于在git clone后自动配置项目

# 检查是否以root权限运行
if [ "$(id -u)" -ne 0 ]; then
    echo "请使用root权限运行此脚本: sudo ./setup.sh"
    exit 1
fi

# 获取当前目录（项目根目录）
PROJECT_DIR=$(pwd)

# 安装必要的依赖
echo "1/4: 安装必要的依赖..."
apt update
apt install -y php8.1 php8.1-fpm nginx

# 设置目录权限
echo "2/4: 配置目录权限..."
chown -R www-data:www-data $PROJECT_DIR
chmod -R 755 $PROJECT_DIR

# 创建默认图片目录
echo "3/4: 创建默认图片目录..."
mkdir -p /mnt/sda2/www/photos
chown -R www-data:www-data /mnt/sda2/www/photos
chmod -R 755 /mnt/sda2/www/photos

# 配置Nginx
echo "4/4: 配置Nginx..."
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
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
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

# 重启服务
systemctl restart nginx
systemctl enable nginx
systemctl restart php8.1-fpm
systemctl enable php8.1-fpm

# 显示完成信息
IP_ADDR=$(hostname -I | awk '{print $1}')
echo "=============================================="
echo "部署完成！"
echo "您可以通过以下地址访问相册: http://$IP_ADDR"
echo "默认图片目录: /mnt/sda2/www/photos"
echo "请将图片放入上述目录，或通过设置页面更改路径"
echo "=============================================="
    
