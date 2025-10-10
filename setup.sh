#!/bin/bash

# 此脚本用于在git clone后自动配置项目，使用8080端口避免冲突

# 检查是否以root权限运行
if [ "$(id -u)" -ne 0 ]; then
    echo "请使用root权限运行此脚本: sudo ./setup.sh"
    exit 1
fi

# 清理可能的错误源
echo "0/5: 清理错误的软件源..."
rm -f /etc/apt/sources.list.d/v2raya.list
apt-key adv --refresh-keys --keyserver keyserver.ubuntu.com

# 获取当前目录（项目根目录）
PROJECT_DIR=$(pwd)

# 安装必要的依赖 - 使用系统支持的PHP版本
echo "1/5: 安装必要的依赖..."
apt update
apt install -y php php-fpm nginx

# 检查PHP是否安装成功
if ! command -v php &> /dev/null; then
    echo "PHP安装失败，尝试替代方案..."
    apt install -y php7.4 php7.4-fpm
fi

# 设置目录权限
echo "2/5: 配置目录权限..."
chown -R www-data:www-data $PROJECT_DIR
chmod -R 755 $PROJECT_DIR

# 创建缓存目录
mkdir -p $PROJECT_DIR/cache
chown -R www-data:www-data $PROJECT_DIR/cache
chmod 755 $PROJECT_DIR/cache

# 创建默认图片目录
echo "3/5: 创建默认图片目录..."
mkdir -p /mnt/sda2/www/photos
chown -R www-data:www-data /mnt/sda2/www/photos
chmod -R 755 /mnt/sda2/www/photos

# 配置Nginx使用8080端口
echo "4/5: 配置Nginx（使用8080端口）..."
# 先删除已存在的配置链接
rm -f /etc/nginx/sites-enabled/photo-album

cat > /etc/nginx/sites-available/photo-album <<EOF
server {
    listen 8080;  # 使用8080端口避免冲突
    server_name _;
    root $PROJECT_DIR;
    index index.php;

    location / {
        try_files \$uri \$uri/ /index.php\$is_args\$args;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php-fpm.sock;
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

# 重启服务 - 自动检测PHP-FPM版本
echo "5/5: 启动服务..."
systemctl restart nginx
systemctl enable nginx

# 检测并启动正确的PHP-FPM服务
PHP_FPM_SERVICE=$(ls /etc/init.d/ | grep php | grep -i fpm | head -n 1)
if [ -n "$PHP_FPM_SERVICE" ]; then
    systemctl restart $PHP_FPM_SERVICE
    systemctl enable $PHP_FPM_SERVICE
else
    echo "警告: 未找到PHP-FPM服务，尝试通用启动命令..."
    systemctl restart php-fpm
    systemctl enable php-fpm
fi

# 显示完成信息
IP_ADDR=$(hostname -I | awk '{print $1}')
echo "=============================================="
echo "部署完成！"
echo "您可以通过以下地址访问相册: http://$IP_ADDR:8080"  # 增加端口号
echo "默认图片目录: /mnt/sda2/www/photos"
echo "请将图片放入上述目录，或通过设置页面更改路径"
echo "=============================================="
    
