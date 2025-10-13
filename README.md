# Ubuntu 服务器相册

一个简单的 Web 应用，用于在 Ubuntu 服务器上实时浏览指定文件夹中的图片。

---

## 更新历史

V2.0.0

改用PHP，更轻量。

---

## 功能特点

- 自动扫描指定文件夹及子文件夹中的图片
- 响应式设计，适配各种设备屏幕
- 图片缩略图网格展示，支持分页浏览
- 点击图片查看大图及详细信息（大小、修改时间等）
- 支持图片下载功能
- 可自定义每行显示的图片数量
- 缓存机制提高加载速度
- 简洁的设置界面，可配置扫描参数

## 系统要求

- Ubuntu/Debian 系统
- Nginx 服务器
- PHP 7.4 及以上（含PHP-FPM）
- Git（用于克隆仓库）

## 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/ches2010/ubuntu-photo-album.git
   cd ubuntu-photo-album
   ```

2. **设置权限**
   ```bash
   # 设置项目目录权限
   sudo chown -R www-data:www-data .
   sudo chmod -R 755 .
   
   # 创建并设置缓存目录
   mkdir -p cache
   sudo chmod 775 cache
   sudo chown www-data:www-data cache
   ```

3. **配置Nginx**
   ```bash
   # 复制示例配置
   sudo cp nginx-example.conf /etc/nginx/sites-available/photo-album
   
   # 编辑配置文件，修改路径为实际项目目录
   sudo nano /etc/nginx/sites-available/photo-album
   
   # 启用站点配置
   sudo ln -s /etc/nginx/sites-available/photo-album /etc/nginx/sites-enabled/
   
   # 测试并重启Nginx
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **确保PHP-FPM运行**
   ```bash
   # 对于PHP 7.4
   sudo systemctl start php7.4-fpm
   sudo systemctl enable php7.4-fpm
   ```

5. **访问应用**
   打开浏览器，访问服务器IP:8080（默认端口）

## 配置说明

默认配置文件为`config.json`，可通过网页设置界面修改以下参数：

- **图片文件夹路径**：存储图片的目录绝对路径
- **扫描子文件夹**：是否扫描子目录中的图片
- **最大扫描深度**：限制子文件夹扫描深度（0为无限制）
- **每行显示图片数量**：调整网格布局（1-10）
- **缓存有效期**：图片信息缓存时间（秒）
- **端口设置**：应用运行端口

## 目录结构
ubuntu-photo-album/
├── index.php           # 主程序入口
├── index.html          # 前端页面
├── config.json         # 配置文件
├── cache/              # 缓存目录
├── web/
│   ├── css/            # 样式表
│   │   ├── bootstrap.min.css
│   │   └── styles.css
│   └── js/             # JavaScript文件
│       ├── app.js
│       ├── bootstrap.bundle.min.js
│       ├── gallery.js
│       └── settings.js
## 常见问题

### API返回404错误
- 检查Nginx配置中的PHP-FPM路径是否正确
- 确保`index.php`文件存在且权限正确
- 重启Nginx服务

### 无法加载图片
- 检查图片目录权限，确保www-data用户可访问
- 确认配置中的图片路径正确
- 检查图片格式是否受支持（jpg、jpeg、png、gif、webp）

### 缓存相关问题
- 点击"刷新"按钮强制刷新缓存
- 手动删除cache目录下的文件
- 调整缓存有效期设置

## 许可证

本项目采用MIT许可证，详情参见LICENSE文件。
    
