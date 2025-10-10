<?php
// 定义项目根目录
define('ROOT_DIR', __DIR__);

// 加载配置
$config = loadConfig();

// 路由处理
handleRequest();

/**
 * 加载配置文件
 */
function loadConfig() {
    $configFile = ROOT_DIR . '/config.ini';
    if (!file_exists($configFile)) {
        // 创建默认配置
        $defaultConfig = <<<INI
[settings]
image_folder = "/var/www/photos"
scan_subfolders = "true"
max_depth = "0"
images_per_row = "5"
cache_duration = "600"
INI;
        file_put_contents($configFile, $defaultConfig);
    }
    return parse_ini_file($configFile, true);
}

/**
 * 处理请求路由
 */
function handleRequest() {
    $requestUri = $_SERVER['REQUEST_URI'];
    
    // API路由 - 图片列表
    if (preg_match('/^\/api\/images/', $requestUri)) {
        handleImagesApi();
        exit;
    }
    
    // API路由 - 设置
    if (preg_match('/^\/api\/settings/', $requestUri)) {
        handleSettingsApi();
        exit;
    }
    
    // 图片访问路由
    if (preg_match('/^\/images\/(.+)$/', $requestUri, $matches)) {
        handleImageAccess($matches[1]);
        exit;
    }
    
    // 静态文件路由
    if (preg_match('/^\/(css|js|fonts)\/.+/', $requestUri, $matches)) {
        $path = ROOT_DIR . $requestUri;
        if (file_exists($path) && is_file($path)) {
            serveStaticFile($path);
            exit;
        }
    }
    
    // 首页路由
    if ($requestUri === '/' || $requestUri === '/index.html') {
        serveIndexPage();
        exit;
    }
    
    // 404 Not Found
    http_response_code(404);
    echo "404 Not Found";
    exit;
}

/**
 * 处理图片列表API请求
 */
function handleImagesApi() {
    global $config;
    
    // 获取分页参数
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $perPage = isset($_GET['per_page']) ? (int)$_GET['per_page'] : 40;
    $forceRefresh = isset($_GET['t']);
    
    // 扫描图片
    $images = scanImages($forceRefresh);
    $totalImages = count($images);
    $totalPages = max(1, (int)ceil($totalImages / $perPage));
    
    // 分页处理
    $start = ($page - 1) * $perPage;
    $paginatedImages = array_slice($images, $start, $perPage);
    
    // 返回JSON响应
    header('Content-Type: application/json');
    echo json_encode([
        'images' => $paginatedImages,
        'page' => $page,
        'per_page' => $perPage,
        'total_images' => $totalImages,
        'total_pages' => $totalPages,
        'images_per_row' => $config['settings']['images_per_row'] ?? 5
    ]);
}

/**
 * 处理设置API请求
 */
function handleSettingsApi() {
    global $config;
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // 保存设置
        $data = json_decode(file_get_contents('php://input'), true);
        if ($data) {
            $config['settings'] = array_merge(
                $config['settings'],
                array_intersect_key($data, $config['settings'])
            );
            
            // 写入配置文件
            $iniContent = "[settings]\n";
            foreach ($config['settings'] as $key => $value) {
                $iniContent .= "{$key} = \"{$value}\"\n";
            }
            file_put_contents(ROOT_DIR . '/config.ini', $iniContent);
            
            // 清除缓存
            clearImageCache();
            
            header('Content-Type: application/json');
            echo json_encode(['status' => 'success', 'message' => '设置已保存']);
            exit;
        }
        
        header('Content-Type: application/json');
        echo json_encode(['status' => 'error', 'message' => '无效的设置数据']);
        exit;
    }
    
    // 获取当前设置
    header('Content-Type: application/json');
    echo json_encode($config['settings']);
    exit;
}

/**
 * 处理图片访问请求
 */
function handleImageAccess($fileId) {
    // 解析文件ID
    list($encodedPath, $folderIdx) = explode('_folder', $fileId);
    $relativePath = urldecode($encodedPath);
    
    // 获取图片文件夹
    global $config;
    $imageFolder = $config['settings']['image_folder'];
    
    // 构建完整路径
    $filePath = $imageFolder . '/' . $relativePath;
    
    // 安全检查 - 确保文件在指定目录内
    $realImageFolder = realpath($imageFolder);
    $realFilePath = realpath($filePath);
    
    if ($realFilePath && strpos($realFilePath, $realImageFolder) === 0 && is_file($realFilePath)) {
        // 输出图片
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $mimes = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'bmp' => 'image/bmp',
            'tiff' => 'image/tiff'
        ];
        
        header('Content-Type: ' . ($mimes[$ext] ?? 'image/*'));
        header('Cache-Control: public, max-age=3600');
        readfile($realFilePath);
        exit;
    }
    
    // 图片不存在
    http_response_code(404);
    exit;
}

/**
 * 扫描图片文件
 */
function scanImages($forceRefresh = false) {
    global $config;
    
    // 缓存处理
    $cacheDir = ROOT_DIR . '/cache';
    $cacheFile = $cacheDir . '/images_cache.json';
    $cacheDuration = (int)($config['settings']['cache_duration'] ?? 600);
    
    // 如果缓存有效且不需要强制刷新，则使用缓存
    if (!$forceRefresh && file_exists($cacheFile) && 
        (time() - filemtime($cacheFile) < $cacheDuration)) {
        return json_decode(file_get_contents($cacheFile), true);
    }
    
    // 确保缓存目录存在
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0755, true);
    }
    
    // 扫描图片
    $imageFolder = $config['settings']['image_folder'];
    $scanSubfolders = $config['settings']['scan_subfolders'] === 'true';
    $maxDepth = (int)($config['settings']['max_depth'] ?? 0);
    
    $allowedExt = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'];
    $images = [];
    
    if (is_dir($imageFolder)) {
        // 构建迭代器
        $flags = RecursiveDirectoryIterator::SKIP_DOTS;
        $iterator = new RecursiveDirectoryIterator($imageFolder, $flags);
        
        if ($scanSubfolders) {
            $iterator = new RecursiveIteratorIterator(
                $iterator,
                RecursiveIteratorIterator::SELF_FIRST
            );
            
            // 设置最大深度
            if ($maxDepth > 0) {
                $iterator->setMaxDepth($maxDepth);
            }
        }
        
        // 遍历文件
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $ext = strtolower($file->getExtension());
                if (in_array($ext, $allowedExt)) {
                    $relativePath = str_replace($imageFolder . '/', '', $file->getPathname());
                    $folder = str_replace($imageFolder, '', $file->getPath());
                    $folder = $folder ? ltrim($folder, '/') : '';
                    
                    $images[] = [
                        'id' => urlencode($relativePath) . "_folder0",
                        'filename' => $file->getFilename(),
                        'folder' => $folder,
                        'size' => formatSize($file->getSize()),
                        'modified' => date('Y-m-d H:i:s', $file->getMTime()),
                        'extension' => $ext
                    ];
                }
            }
        }
    }
    
    // 保存缓存
    file_put_contents($cacheFile, json_encode($images));
    
    return $images;
}

/**
 * 清除图片缓存
 */
function clearImageCache() {
    $cacheFile = ROOT_DIR . '/cache/images_cache.json';
    if (file_exists($cacheFile)) {
        unlink($cacheFile);
    }
}

/**
 * 提供静态文件
 */
function serveStaticFile($path) {
    $ext = pathinfo($path, PATHINFO_EXTENSION);
    $mimes = [
        'css' => 'text/css',
        'js' => 'application/javascript',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'eot' => 'font/eot'
    ];
    
    header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
    header('Cache-Control: public, max-age=86400'); // 缓存1天
    readfile($path);
}

/**
 * 提供首页
 */
function serveIndexPage() {
    $indexFile = ROOT_DIR . '/index.html';
    if (file_exists($indexFile)) {
        header('Content-Type: text/html');
        readfile($indexFile);
    } else {
        http_response_code(404);
        echo "Index file not found";
    }
}

/**
 * 格式化文件大小
 */
function formatSize($bytes) {
    if ($bytes < 1024) return "$bytes B";
    if ($bytes < 1048576) return number_format($bytes / 1024, 1) . " KB";
    if ($bytes < 1073741824) return number_format($bytes / 1048576, 1) . " MB";
    return number_format($bytes / 1073741824, 1) . " GB";
}
    
