<?php
// 自动检测项目根目录（支持git clone部署）
define('PROJECT_ROOT', __DIR__);

// 加载配置
$configFile = PROJECT_ROOT . '/config.ini';
// 如果配置文件不存在，创建默认配置
if (!file_exists($configFile)) {
    $defaultConfig = '[settings]
image_folder = "/mnt/sda2/www/photos"
scan_subfolders = "true"
max_depth = "0"
images_per_row = "5"
cache_duration = "600"
cache_path = "' . PROJECT_ROOT . '/cache"
';
    file_put_contents($configFile, $defaultConfig);
}
$config = parse_ini_file($configFile, true);

// 确保缓存目录存在
if (!file_exists($config['settings']['cache_path'])) {
    mkdir($config['settings']['cache_path'], 0755, true);
}

// 路由处理
$requestUri = $_SERVER['REQUEST_URI'];

// 处理API请求
if (strpos($requestUri, '/api/') === 0) {
    handleApiRequest($requestUri, $config);
    exit;
}

// 处理图片请求
if (strpos($requestUri, '/images/') === 0) {
    handleImageRequest($requestUri, $config);
    exit;
}

// 处理静态文件
if (preg_match('/\.(css|js|png|jpg|jpeg|gif|webp|ico)$/', $requestUri)) {
    $filePath = PROJECT_ROOT . $requestUri;
    if (file_exists($filePath) && is_file($filePath)) {
        // 设置适当的MIME类型
        $mimeType = getMimeType($filePath);
        header("Content-Type: $mimeType");
        readfile($filePath);
        exit;
    }
}

// 提供首页
if ($requestUri === '/' || $requestUri === '/index.html') {
    readfile(PROJECT_ROOT . '/index.html');
    exit;
}

// 404响应
http_response_code(404);
echo "404 Not Found";
exit;

// API请求处理函数
function handleApiRequest($uri, $config) {
    header("Content-Type: application/json");
    
    // 处理图片API
    if ($requestUri === '/api/images') {
        // 实现图片列表获取逻辑
        header('Content-Type: application/json');
        echo json_encode([
            'images' => [],
            'total_pages' => 0,
            'total_images' => 0
        ]);
        exit;
    }
    
    // 设置API - 获取
    if ($requestUri === '/api/config') {
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            header('Content-Type: application/json');
            echo json_encode([
                'image_folders' => [$config['settings']['image_folder']],
                'scan_subfolders' => $config['settings']['scan_subfolders'] === 'true',
                'max_depth' => intval($config['settings']['max_depth']),
                'images_per_row' => intval($config['settings']['images_per_row']),
                'port' => 8080
            ]);
            exit;
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true);
            // 保存配置逻辑...
            header('Content-Type: application/json');
            echo json_encode(['status' => 'success']);
            exit;
        }
    }
    
    // API不存在
    http_response_code(404);
    echo json_encode(['error' => 'API不存在']);
}

// 图片请求处理函数
function handleImageRequest($uri, $config) {
    $pathParts = explode('/', trim($uri, '/'));
    if (count($pathParts) < 2) {
        http_response_code(404);
        exit;
    }
    
    $fileId = implode('/', array_slice($pathParts, 1));
    list($encodedPath, $folderIdx) = explode('_folder', $fileId);
    
    if ($encodedPath === null || $folderIdx === null) {
        http_response_code(404);
        exit;
    }
    
    $relativePath = urldecode($encodedPath);
    $imageFolder = $config['settings']['image_folder'];
    
    $filePath = $imageFolder . '/' . $relativePath;
    
    if (file_exists($filePath) && is_file($filePath) && 
        strpos(realpath($filePath), realpath($imageFolder)) === 0) {
        
        $mimeType = getMimeType($filePath);
        header("Content-Type: $mimeType");
        readfile($filePath);
        exit;
    }
    
    http_response_code(404);
    exit;
}

// 获取图片列表
function getImages($config, $page = 1, $perPage = 40, $forceRefresh = false) {
    $imageFolder = $config['settings']['image_folder'];
    $scanSubfolders = $config['settings']['scan_subfolders'] === 'true';
    $maxDepth = (int)$config['settings']['max_depth'];
    $cacheDuration = (int)$config['settings']['cache_duration'];
    $cachePath = $config['settings']['cache_path'];
    
    // 确保缓存目录存在
    if (!file_exists($cachePath)) {
        mkdir($cachePath, 0755, true);
    }
    
    // 生成缓存键
    $cacheKey = md5($imageFolder . ($scanSubfolders ? '1' : '0') . $maxDepth);
    $cacheFile = $cachePath . '/' . $cacheKey . '.json';
    
    // 检查缓存
    $allImages = [];
    if (!$forceRefresh && file_exists($cacheFile) && 
        time() - filemtime($cacheFile) < $cacheDuration) {
        $allImages = json_decode(file_get_contents($cacheFile), true);
    } else {
        // 扫描图片
        $allowedExt = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'];
        
        if (is_dir($imageFolder)) {
            $allImages = scanImages($imageFolder, $imageFolder, $allowedExt, $scanSubfolders, $maxDepth);
            
            // 保存缓存
            file_put_contents($cacheFile, json_encode($allImages));
        }
    }
    
    // 分页处理
    $total = count($allImages);
    $totalPages = max(1, (int)ceil($total / $perPage));
    $page = max(1, min($page, $totalPages));
    $start = ($page - 1) * $perPage;
    $paginated = array_slice($allImages, $start, $perPage);
    
    return [
        'images' => $paginated,
        'page' => $page,
        'per_page' => $perPage,
        'total_images' => $total,
        'total_pages' => $totalPages,
        'images_per_row' => (int)$config['settings']['images_per_row']
    ];
}

// 扫描图片文件夹
function scanImages($rootFolder, $currentFolder, $allowedExt, $scanSubfolders, $maxDepth, $currentDepth = 0) {
    $images = [];
    $iterator = new DirectoryIterator($currentFolder);
    
    foreach ($iterator as $fileinfo) {
        if ($fileinfo->isDot()) continue;
        
        // 检查深度限制
        if ($currentDepth > $maxDepth && $maxDepth != 0) continue;
        
        if ($fileinfo->isDir() && $scanSubfolders) {
            // 递归扫描子文件夹
            $subfolderImages = scanImages(
                $rootFolder, 
                $fileinfo->getPathname(), 
                $allowedExt, 
                $scanSubfolders, 
                $maxDepth, 
                $currentDepth + 1
            );
            $images = array_merge($images, $subfolderImages);
        } elseif ($fileinfo->isFile()) {
            // 检查文件扩展名
            $ext = strtolower($fileinfo->getExtension());
            if (in_array($ext, $allowedExt)) {
                $relativePath = str_replace($rootFolder . '/', '', $fileinfo->getPathname());
                $folderIdx = 0; // 单文件夹模式下固定为0
                
                $images[] = [
                    'id' => urlencode($relativePath) . "_folder{$folderIdx}",
                    'filename' => $fileinfo->getFilename(),
                    'folder' => str_replace($rootFolder . '/', '', $fileinfo->getPath()),
                    'relative_path' => $relativePath,
                    'size' => formatSize($fileinfo->getSize()),
                    'modified' => date('Y-m-d H:i:s', $fileinfo->getMTime()),
                    'extension' => $ext
                ];
            }
        }
    }
    
    return $images;
}

// 格式化文件大小
function formatSize($bytes) {
    if ($bytes < 1024) return "$bytes B";
    if ($bytes < 1048576) return number_format($bytes / 1024, 1) . " KB";
    if ($bytes < 1073741824) return number_format($bytes / 1048576, 1) . " MB";
    return number_format($bytes / 1073741824, 1) . " GB";
}

// 获取MIME类型
function getMimeType($filePath) {
    $extension = pathinfo($filePath, PATHINFO_EXTENSION);
    $mimeTypes = [
        'css' => 'text/css',
        'js' => 'application/javascript',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'ico' => 'image/x-icon',
        'svg' => 'image/svg+xml',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2'
    ];
    
    return $mimeTypes[strtolower($extension)] ?? 'application/octet-stream';
}

// 清除缓存
function clearCache($config) {
    $cachePath = $config['settings']['cache_path'];
    if (file_exists($cachePath) && is_dir($cachePath)) {
        $files = glob($cachePath . '/*.json');
        foreach ($files as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
    }
}
    
