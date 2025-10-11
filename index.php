<?php
// 定义项目根目录
define('PROJECT_ROOT', __DIR__);
define('CACHE_DIR', PROJECT_ROOT . '/cache');
define('CACHE_DURATION', 600); // 默认缓存时间(秒)

// 确保缓存目录存在并设置正确权限
if (!is_dir(CACHE_DIR)) {
    mkdir(CACHE_DIR, 0775, true);
    chmod(CACHE_DIR, 0775);
}

// 加载配置
$configFile = PROJECT_ROOT . '/config.json';
$defaultConfig = [
    'settings' => [
        'image_folder' => '/mnt/sda2/www/photos',
        'scan_subfolders' => 'true',
        'max_depth' => '0',
        'images_per_row' => '5',
        'cache_duration' => (string)CACHE_DURATION,
        'port' => '8080'
    ]
];

// 初始化配置文件
if (!file_exists($configFile)) {
    file_put_contents($configFile, json_encode($defaultConfig, JSON_PRETTY_PRINT));
    chmod($configFile, 0664);
}

$config = json_decode(file_get_contents($configFile), true);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log("配置文件解析错误，使用默认配置: " . json_last_error_msg());
    $config = $defaultConfig;
}

// 处理API请求
handleApiRequest($_SERVER['REQUEST_URI'], $config);

// 处理API请求的函数
function handleApiRequest($requestUri, $config) {
    // 处理配置API
    if ($requestUri === '/api/config') {
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            header('Content-Type: application/json');
            echo json_encode([
                'image_folder' => $config['settings']['image_folder'],
                'scan_subfolders' => $config['settings']['scan_subfolders'],
                'max_depth' => $config['settings']['max_depth'],
                'images_per_row' => $config['settings']['images_per_row'],
                'cache_duration' => $config['settings']['cache_duration'],
                'port' => $config['settings']['port']
            ]);
            exit;
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true);
            if ($data) {
                $configFile = PROJECT_ROOT . '/config.json';
                $currentConfig = json_decode(file_get_contents($configFile), true);
                
                $currentConfig['settings'] = array_merge(
                    $currentConfig['settings'],
                    $data
                );
                
                file_put_contents($configFile, json_encode($currentConfig, JSON_PRETTY_PRINT));
                
                // 清除缓存
                clearCache();
                
                header('Content-Type: application/json');
                echo json_encode(['status' => 'success']);
                exit;
            }
        }
    }
    
    // 处理图片API
    if (strpos($requestUri, '/api/images') === 0) {
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $perPage = isset($_GET['per_page']) ? (int)$_GET['per_page'] : 40;
        $forceRefresh = isset($_GET['t']);
        
        // 验证分页参数
        $page = max(1, $page);
        $perPage = max(10, min(100, $perPage)); // 限制每页数量范围
        
        $images = getImages($config, $forceRefresh);
        $totalImages = count($images);
        $totalPages = max(1, ceil($totalImages / $perPage));
        $offset = ($page - 1) * $perPage;
        $paginatedImages = array_slice($images, $offset, $perPage);
        
        header('Content-Type: application/json');
        echo json_encode([
            'images' => $paginatedImages,
            'total_images' => $totalImages,
            'total_pages' => $totalPages,
            'current_page' => $page,
            'images_per_row' => $config['settings']['images_per_row']
        ]);
        exit;
    }
    
    // 处理图片访问
    if (preg_match('/^\/images\/(\d+)$/', $requestUri, $matches)) {
        $imageId = (int)$matches[1];
        $images = getImages($config);
        
        if (isset($images[$imageId])) {
            $imagePath = $images[$imageId]['path'];
            if (file_exists($imagePath)) {
                $mimeType = getMimeType($imagePath);
                header("Content-Type: $mimeType");
                header("Cache-Control: public, max-age=86400"); // 缓存1天
                readfile($imagePath);
                exit;
            }
        }
        
        // 图片未找到
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => '图片未找到']);
        exit;
    }
}

// 获取图片列表（带缓存）
function getImages($config, $forceRefresh = false) {
    $cacheFile = CACHE_DIR . '/images.json';
    $cacheDuration = (int)$config['settings']['cache_duration'];
    
    // 检查缓存是否有效
    if (!$forceRefresh && file_exists($cacheFile) && 
        (time() - filemtime($cacheFile) < $cacheDuration)) {
        $cached = file_get_contents($cacheFile);
        return json_decode($cached, true) ?: [];
    }
    
    // 缓存无效，重新扫描
    $imageFolder = $config['settings']['image_folder'];
    $scanSubfolders = $config['settings']['scan_subfolders'] === 'true';
    $maxDepth = (int)$config['settings']['max_depth'];
    
    $images = [];
    if (is_dir($imageFolder)) {
        $images = scanImages($imageFolder, $imageFolder, 0, $scanSubfolders, $maxDepth);
    } else {
        error_log("图片目录不存在: $imageFolder");
    }
    
    // 保存到缓存
    file_put_contents($cacheFile, json_encode($images));
    
    return $images;
}

// 扫描图片文件
function scanImages($rootDir, $currentDir, $currentDepth, $scanSubfolders, $maxDepth) {
    $images = [];
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    // 检查目录是否可访问
    if (!is_readable($currentDir)) {
        error_log("无法访问目录: $currentDir");
        return $images;
    }
    
    $items = @scandir($currentDir); // 使用@抑制错误信息
    if ($items === false) {
        error_log("扫描目录失败: $currentDir");
        return $images;
    }
    
    foreach ($items as $item) {
        if ($item == '.' || $item == '..') continue;
        
        $path = $currentDir . '/' . $item;
        $relativePath = str_replace($rootDir . '/', '', $path);
        
        if (is_dir($path) && $scanSubfolders && 
            ($maxDepth == 0 || $currentDepth < $maxDepth)) {
            // 递归扫描子文件夹
            $subfolderImages = scanImages(
                $rootDir, 
                $path, 
                $currentDepth + 1, 
                $scanSubfolders, 
                $maxDepth
            );
            $images = array_merge($images, $subfolderImages);
        } elseif (is_file($path)) {
            $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            if (in_array($extension, $allowedExtensions)) {
                $stat = @stat($path);
                if ($stat) {
                    $size = formatSize($stat['size']);
                    $modified = date('Y-m-d H:i:s', $stat['mtime']);
                    
                    $folder = dirname($relativePath);
                    $folder = $folder == '.' ? '' : $folder;
                    
                    $images[] = [
                        'id' => count($images),
                        'filename' => basename($path),
                        'folder' => $folder,
                        'path' => $path,
                        'size' => $size,
                        'modified' => $modified,
                        'extension' => $extension
                    ];
                }
            }
        }
    }
    
    return $images;
}

// 格式化文件大小
function formatSize($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    return round($bytes / pow(1024, $pow), $precision) . ' ' . $units[$pow];
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
        'ico' => 'image/x-icon'
    ];
    return $mimeTypes[strtolower($extension)] ?? 'application/octet-stream';
}

// 清除缓存
function clearCache() {
    $cacheDir = CACHE_DIR;
    if (is_dir($cacheDir)) {
        $files = glob($cacheDir . '/*');
        foreach ($files as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
    }
}

// 如果不是API请求，输出HTML页面
include 'index.html';
?>
