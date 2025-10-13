<?php
/**
 * Ubuntu服务器相册 - 后端处理脚本
 * 处理图片扫描、配置管理和缓存操作
 */

// 先判断是否是默认首页请求（无任何参数）
$isDefaultRequest = empty($_GET) && 
                   ($_SERVER['REQUEST_URI'] === '/' || 
                    $_SERVER['REQUEST_URI'] === '/index.php');

// 根据请求类型设置正确的Content-Type
if ($isDefaultRequest) {
    header('Content-Type: text/html; charset=utf-8');
} else {
    // 缩略图和原图请求需要特殊的Content-Type
    $action = $_GET['action'] ?? '';
    if ($action !== 'getThumbnail' && $action !== 'getImage') {
        header('Content-Type: application/json; charset=utf-8');
    }
}

// 处理跨域请求
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理OPTIONS请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 获取请求操作，默认为显示首页
$action = $_GET['action'] ?? ($isDefaultRequest ? 'default' : 'invalid');

// 数据库和配置初始化
$configFile = 'config.json';
$cacheDir = 'cache/';

// 确保缓存目录存在
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}

// 默认配置
$defaultConfig = [
    'imagePaths' => [],
    'scanSubfolders' => true,
    'maxDepth' => 0,
    'imagesPerRow' => 4,
    'cacheTTL' => 3600,
    'port' => 8080,
    'thumbnailWidth' => 200,
    'thumbnailHeight' => 150
];

// 支持的图片扩展名
$supportedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

// 初始化
init();

/**
 * 初始化函数，路由请求到相应的处理函数
 */
function init() {
    global $configFile, $defaultConfig, $action;
    
    // 确保配置文件存在
    if (!file_exists($configFile)) {
        saveConfig($defaultConfig);
    }
    
    // 路由到相应的处理函数
    switch ($action) {
        case 'getThumbnail':
            handleGetThumbnail();
            break;
        case 'getImage':
            handleGetImage();
            break;
        case 'getBase64Image':
            handleGetBase64Image();
            break;
        case 'getImages':
            handleGetImages();
            break;
        case 'getSettings':
            handleGetSettings();
            break;
        case 'saveSettings':
            handleSaveSettings();
            break;
        case 'refreshCache':
            handleRefreshCache();
            break;
        case 'default':
            // 处理默认请求，返回前端页面
            if (file_exists('index.html')) {
                // 确保内容类型正确
                header('Content-Type: text/html; charset=utf-8');
                readfile('index.html');
            } else {
                http_response_code(404);
                echo json_encode(['error' => '首页文件不存在']);
            }
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => '无效的请求动作']);
            break;
    }
}

/**
 * 解析并验证图片路径
 */
function resolveImagePath($userPath) {
    global $configFile;
    
    $settings = loadConfig($configFile);
    $decodedPath = urldecode($userPath);
    
    // 标准化路径
    $normalizedPath = str_replace(['\\', '//'], '/', $decodedPath);
    
    // 记录调试信息
    error_log("配置的图片路径: " . implode(', ', $settings['imagePaths']));
    error_log("用户请求路径: " . $normalizedPath);
    
    // 尝试每个配置的基础路径
    foreach ($settings['imagePaths'] as $basePath) {
        // 确保基础路径是绝对路径
        if (!is_absolute_path($basePath)) {
            error_log("错误: 配置的路径 '$basePath' 不是绝对路径");
            continue;
        }
        
        $basePath = rtrim($basePath, '/');
        $fullPath = $basePath . '/' . $normalizedPath;
        $fullPath = realpath($fullPath);
        
        // 检查文件是否存在且可读
        if ($fullPath && file_exists($fullPath) && is_readable($fullPath)) {
            error_log("成功解析路径: $fullPath");
            return $fullPath;
        } else {
            error_log("尝试路径无效: $fullPath");
        }
    }
    
    error_log("所有路径尝试失败");
    return false;
}

// 辅助函数：检查是否为绝对路径
function is_absolute_path($path) {
    return strpos($path, '/') === 0 || preg_match('/^[A-Za-z]:\\\/', $path);
}

/**
 * 处理获取缩略图的请求
 */
function handleGetThumbnail() {
    if (!isset($_GET['path'])) {
        http_response_code(400);
        echo json_encode(['error' => '缺少图片路径参数']);
        exit;
    }

    $imagePath = $_GET['path'];
    $settings = loadSettings();
    
    // 解析并验证图片路径
    $fullImagePath = resolveImagePath($imagePath);
    
    // 记录调试信息
    error_log("请求缩略图 - 原始路径: {$imagePath}");
    error_log("请求缩略图 - 解析后路径: " . ($fullImagePath ?: '无效路径'));
    
    // 检查文件是否存在且可读
    if (!$fullImagePath || !file_exists($fullImagePath) || !is_readable($fullImagePath)) {
        http_response_code(404);
        echo json_encode([
            'error' => '图片不存在或无权访问',
            'requestedPath' => $imagePath,
            'resolvedPath' => $fullImagePath,
            'exists' => $fullImagePath ? file_exists($fullImagePath) : false
        ]);
        exit;
    }

    // 获取配置的缩略图尺寸
    $width = isset($settings['thumbnailWidth']) ? (int)$settings['thumbnailWidth'] : 200;
    $height = isset($settings['thumbnailHeight']) ? (int)$settings['thumbnailHeight'] : 150;
    
    // 生成并输出缩略图
    generateThumbnail($fullImagePath, $width, $height);
    exit;
}

/**
 * 处理获取原图的请求
 */
function handleGetImage() {
    if (!isset($_GET['path'])) {
        http_response_code(400);
        echo json_encode(['error' => '缺少图片路径参数']);
        exit;
    }
    
    $imagePath = $_GET['path'];
    $settings = loadSettings();
    
    // 解析并验证图片路径
    $fullImagePath = resolveImagePath($imagePath);
    
    // 检查文件是否存在且可读
    if (!$fullImagePath || !file_exists($fullImagePath) || !is_readable($fullImagePath)) {
        http_response_code(404);
        echo json_encode([
            'error' => '图片不存在或无权访问',
            'requestedPath' => $imagePath,
            'resolvedPath' => $fullImagePath
        ]);
        exit;
    }
    
    // 输出原图
    $mimeType = mime_content_type($fullImagePath);
    header("Content-Type: $mimeType");
    header("Content-Length: " . filesize($fullImagePath));
    readfile($fullImagePath);
    exit;
}

/**
 * 处理获取Base64编码图片的请求
 */
function handleGetBase64Image() {
    if (!isset($_GET['path'])) {
        http_response_code(400);
        echo json_encode(['error' => '缺少图片路径参数']);
        exit;
    }
    
    $imagePath = $_GET['path'];
    $settings = loadSettings();
    
    // 解析并验证图片路径
    $fullImagePath = resolveImagePath($imagePath);
    
    // 检查文件是否存在且可读
    if (!$fullImagePath || !file_exists($fullImagePath) || !is_readable($fullImagePath)) {
        http_response_code(404);
        echo json_encode([
            'error' => '图片不存在或无权访问',
            'requestedPath' => $imagePath,
            'resolvedPath' => $fullImagePath
        ]);
        exit;
    }
    
    // 获取图片MIME类型
    $mimeType = mime_content_type($fullImagePath);
    
    // 检查是否是支持的图片类型
    $supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!in_array($mimeType, $supportedTypes)) {
        http_response_code(415);
        echo json_encode(['error' => '不支持的图片类型: ' . $mimeType]);
        exit;
    }
    
    // 读取图片内容并转换为Base64
    $imageData = file_get_contents($fullImagePath);
    if ($imageData === false) {
        http_response_code(500);
        echo json_encode(['error' => '无法读取图片内容']);
        exit;
    }
    
    $base64 = base64_encode($imageData);
    
    // 返回结果
    echo json_encode([
        'mimeType' => $mimeType,
        'base64' => $base64,
        'size' => filesize($fullImagePath)
    ]);
    exit;
}

/**
 * 处理获取图片列表的请求
 */
function handleGetImages() {
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $perPage = isset($_GET['perPage']) ? (int)$_GET['perPage'] : 20;
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    $sort = isset($_GET['sort']) ? $_GET['sort'] : 'name_asc';
    
    // 从缓存或扫描获取图片
    $images = getImages($search, $sort);
    
    // 分页处理
    $total = count($images);
    $offset = ($page - 1) * $perPage;
    $paginatedImages = array_slice($images, $offset, $perPage);
    
    // 返回结果
    echo json_encode([
        'images' => $paginatedImages,
        'pagination' => [
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'totalPages' => ceil($total / $perPage)
        ]
    ]);
}

/**
 * 处理获取设置的请求
 */
function handleGetSettings() {
    global $configFile;
    $config = loadConfig($configFile);
    echo json_encode($config);
}

/**
 * 处理保存设置的请求
 */
function handleSaveSettings() {
    global $configFile;
    
    // 确保是POST请求
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => '方法不允许，仅支持POST']);
        return;
    }
    
    // 获取并验证POST数据
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!$data) {
        http_response_code(400);
        echo json_encode(['error' => '无效的JSON数据']);
        return;
    }
    
    // 验证并准备配置数据
    $config = [
        'imagePaths' => isset($data['imagePaths']) ? array_filter(array_unique($data['imagePaths'])) : [],
        'scanSubfolders' => isset($data['scanSubfolders']) ? (bool)$data['scanSubfolders'] : true,
        'maxDepth' => isset($data['maxDepth']) ? max(0, (int)$data['maxDepth']) : 0,
        'imagesPerRow' => isset($data['imagesPerRow']) ? max(1, min(10, (int)$data['imagesPerRow'])) : 4,
        'cacheTTL' => isset($data['cacheTTL']) ? max(0, (int)$data['cacheTTL']) : 3600,
        'port' => isset($data['port']) ? max(1, min(65535, (int)$data['port'])) : 8080,
        'thumbnailWidth' => isset($data['thumbnailWidth']) ? max(50, min(1000, (int)$data['thumbnailWidth'])) : 200,
        'thumbnailHeight' => isset($data['thumbnailHeight']) ? max(50, min(1000, (int)$data['thumbnailHeight'])) : 150
    ];
    
    // 保存配置
    if (saveConfig($config)) {
        // 清除缓存，因为配置可能影响图片列表
        clearCache();
        echo json_encode(['success' => true, 'message' => '设置已保存']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => '保存设置失败']);
    }
}

/**
 * 处理刷新缓存的请求
 */
function handleRefreshCache() {
    if (clearCache()) {
        echo json_encode(['success' => true, 'message' => '缓存已刷新']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => '刷新缓存失败']);
    }
}

/**
 * 获取图片列表（从缓存或扫描）
 */
function getImages($search = '', $sort = 'name_asc') {
    global $cacheDir, $configFile;
    
    $config = loadConfig($configFile);
    $cacheKey = 'images_' . md5(json_encode($config) . $search . $sort);
    $cacheFile = $cacheDir . $cacheKey . '.json';
    
    // 检查缓存是否有效
    if (file_exists($cacheFile) && time() - filemtime($cacheFile) < $config['cacheTTL']) {
        return json_decode(file_get_contents($cacheFile), true);
    }
    
    // 缓存无效，重新扫描图片
    $images = scanImages($config, $search);
    
    // 排序图片
    $images = sortImages($images, $sort);
    
    // 保存到缓存
    file_put_contents($cacheFile, json_encode($images));
    
    return $images;
}

/**
 * 扫描图片文件
 */
function scanImages($config, $search = '') {
    global $supportedExtensions;
    
    $images = [];
    $imagePaths = $config['imagePaths'];
    
    if (empty($imagePaths)) {
        return $images;
    }
    
    foreach ($imagePaths as $basePath) {
        // 验证路径是否有效且可访问
        if (!is_dir($basePath) || !is_readable($basePath)) {
            continue;
        }
        
        // 扫描目录
        $scanResults = scanDirectory(
            $basePath, 
            $basePath, 
            $supportedExtensions, 
            $config['scanSubfolders'], 
            $config['maxDepth']
        );
        
        $images = array_merge($images, $scanResults);
    }
    
    // 搜索过滤
    if (!empty($search)) {
        $searchLower = strtolower($search);
        $images = array_filter($images, function($image) use ($searchLower) {
            return strpos(strtolower($image['name']), $searchLower) !== false ||
                   strpos(strtolower($image['path']), $searchLower) !== false;
        });
    }
    
    return array_values($images);
}

/**
 * 扫描目录获取图片 - 修复路径处理
 */
function scanDirectory($dir, $baseDir, $extensions, $scanSubfolders = true, $maxDepth = 0, $currentDepth = 0) {
    $images = [];
    $dir = rtrim($dir, '/') . '/';
    $baseDir = rtrim($baseDir, '/') . '/';
    
    $items = scandir($dir);
    if (!$items) {
        return $images;
    }
    
    foreach ($items as $item) {
        // 跳过.和..
        if ($item == '.' || $item == '..') {
            continue;
        }
        
        $path = $dir . $item;
        // 修复相对路径计算
        $relativePath = substr($path, strlen($baseDir));
        
        // 如果是目录且允许扫描子目录
        if (is_dir($path) && $scanSubfolders && ($maxDepth == 0 || $currentDepth < $maxDepth)) {
            $subdirImages = scanDirectory($path, $baseDir, $extensions, $scanSubfolders, $maxDepth, $currentDepth + 1);
            $images = array_merge($images, $subdirImages);
        } 
        // 如果是文件且是支持的图片类型
        elseif (is_file($path) && is_readable($path)) {
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            if (in_array($ext, $extensions)) {
                // 获取图片信息
                $size = filesize($path);
                $modified = filemtime($path);
                
                // 获取图片尺寸
                $dimensions = getimagesize($path);
                $width = $dimensions ? $dimensions[0] : 0;
                $height = $dimensions ? $dimensions[1] : 0;
                
                // 正确编码URL中的特殊字符
                $encodedPath = urlencode($relativePath);
                
                $images[] = [
                    'name' => pathinfo($path, PATHINFO_FILENAME),
                    'filename' => pathinfo($path, PATHINFO_BASENAME),
                    'path' => $relativePath,  // 存储正确的相对路径
                    'fullPath' => $path,
                    'size' => $size,
                    'sizeFormatted' => formatSize($size),
                    'modified' => $modified,
                    'modifiedFormatted' => date('Y-m-d H:i:s', $modified),
                    'width' => $width,
                    'height' => $height,
                    'extension' => $ext,
                    'thumbnailUrl' => 'index.php?action=getThumbnail&path=' . $encodedPath,
                    'imageUrl' => 'index.php?action=getImage&path=' . $encodedPath,
                    'base64Url' => 'index.php?action=getBase64Image&path=' . $encodedPath
                ];
            }
        }
    }
    
    return $images;
}

/**
 * 对图片进行排序
 */
function sortImages($images, $sort) {
    usort($images, function($a, $b) use ($sort) {
        switch ($sort) {
            case 'name_asc':
                return strcmp($a['name'], $b['name']);
            case 'name_desc':
                return strcmp($b['name'], $a['name']);
            case 'date_asc':
                return $a['modified'] - $b['modified'];
            case 'date_desc':
                return $b['modified'] - $a['modified'];
            case 'size_asc':
                return $a['size'] - $b['size'];
            case 'size_desc':
                return $b['size'] - $a['size'];
            default:
                return strcmp($a['name'], $b['name']);
        }
    });
    
    return $images;
}

/**
 * 加载配置
 */
function loadConfig($file) {
    global $defaultConfig;
    
    if (!file_exists($file)) {
        file_put_contents($file, json_encode($defaultConfig, JSON_PRETTY_PRINT));
        return $defaultConfig;
    }
    
    $config = json_decode(file_get_contents($file), true);
    return $config ? array_merge($defaultConfig, $config) : $defaultConfig;
}

/**
 * 加载设置（用于缩略图等功能）
 */
function loadSettings() {
    global $configFile;
    return loadConfig($configFile);
}

/**
 * 保存配置
 */
function saveConfig($config) {
    global $configFile;
    
    $content = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($configFile, $content) !== false;
}

/**
 * 清除缓存
 */
function clearCache() {
    global $cacheDir;
    
    if (!is_dir($cacheDir)) {
        return true;
    }
    
    $files = glob($cacheDir . '*.json');
    foreach ($files as $file) {
        if (is_file($file)) {
            unlink($file);
        }
    }
    
    return true;
}

/**
 * 格式化文件大小
 */
function formatSize($bytes, $decimals = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    return round($bytes / (1024 ** $pow), $decimals) . ' ' . $units[$pow];
}

/**
 * 生成并输出图片缩略图
 * @param string $imagePath 原始图片路径
 * @param int $width 缩略图宽度
 * @param int $height 缩略图高度
 */
function generateThumbnail($imagePath, $width = 200, $height = 150) {
    // 获取图片信息
    $info = getimagesize($imagePath);
    if (!$info) {
        http_response_code(415);
        echo json_encode(['error' => '无法识别的图片格式']);
        exit;
    }
    
    $mime = $info['mime'];
    
    // 根据图片类型创建原图资源
    switch ($mime) {
        case 'image/jpeg':
            $source = imagecreatefromjpeg($imagePath);
            break;
        case 'image/png':
            $source = imagecreatefrompng($imagePath);
            break;
        case 'image/gif':
            $source = imagecreatefromgif($imagePath);
            break;
        case 'image/webp':
            $source = imagecreatefromwebp($imagePath);
            break;
        default:
            http_response_code(415);
            echo json_encode(['error' => '不支持的图片类型: ' . $mime]);
            exit;
    }
    
    if (!$source) {
        http_response_code(500);
        echo json_encode(['error' => '无法处理图片']);
        exit;
    }
    
    // 获取原图尺寸
    $sourceWidth = imagesx($source);
    $sourceHeight = imagesy($source);
    
    // 计算缩略图尺寸（保持比例）
    $ratio = min($width / $sourceWidth, $height / $sourceHeight);
    $thumbnailWidth = (int)($sourceWidth * $ratio);
    $thumbnailHeight = (int)($sourceHeight * $ratio);
    
    // 创建缩略图资源
    $thumbnail = imagecreatetruecolor($thumbnailWidth, $thumbnailHeight);
    
    // 处理透明背景（针对PNG和GIF）
    if ($mime == 'image/png' || $mime == 'image/gif' || $mime == 'image/webp') {
        imagecolortransparent($thumbnail, imagecolorallocatealpha($thumbnail, 0, 0, 0, 127));
        imagesavealpha($thumbnail, true);
    }
    
    // 生成缩略图
    $success = imagecopyresampled(
        $thumbnail, $source,
        0, 0, 0, 0,
        $thumbnailWidth, $thumbnailHeight,
        $sourceWidth, $sourceHeight
    );
    
    if (!$success) {
        http_response_code(500);
        echo json_encode(['error' => '生成缩略图失败']);
        imagedestroy($source);
        imagedestroy($thumbnail);
        exit;
    }
    
    // 输出缩略图
    header("Content-Type: $mime");
    switch ($mime) {
        case 'image/jpeg':
            imagejpeg($thumbnail, null, 80); // 80% 质量
            break;
        case 'image/png':
            imagepng($thumbnail);
            break;
        case 'image/gif':
            imagegif($thumbnail);
            break;
        case 'image/webp':
            imagewebp($thumbnail, null, 80); // 80% 质量
            break;
    }
    
    // 释放资源
    imagedestroy($source);
    imagedestroy($thumbnail);
}
?>
