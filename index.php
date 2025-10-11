<?php
/**
 * Ubuntu服务器相册 - 后端处理脚本
 * 处理图片扫描、配置管理和缓存操作
 */

// 确保输出为JSON格式
header('Content-Type: application/json; charset=utf-8');

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
$action = $_GET['action'] ?? 'default';

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
    'port' => 8080
];

// 支持的图片扩展名
$supportedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

// 初始化
init();

/**
 * 初始化函数，路由请求到相应的处理函数
 */
function init() {
    global $configFile, $defaultConfig;
    
    // 确保配置文件存在
    if (!file_exists($configFile)) {
        saveConfig($defaultConfig);
    }
    
    // 获取请求动作
    $action = $_GET['action'] ?? '';
    
    // 路由到相应的处理函数
    switch ($action) {
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
            // 新增：处理默认请求，返回前端页面
            if (file_exists('index.html')) {
                            // 切换到HTML内容类型
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
    $config = loadConfig();
    echo json_encode($config);
}

/**
 * 处理保存设置的请求
 */
function handleSaveSettings() {
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
        'port' => isset($data['port']) ? max(1, min(65535, (int)$data['port'])) : 8080
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
    
    $config = loadConfig();
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
 * 扫描目录获取图片
 */
function scanDirectory($dir, $baseDir, $extensions, $scanSubfolders = true, $maxDepth = 0, $currentDepth = 0) {
    $images = [];
    $items = scandir($dir);
    
    if (!$items) {
        return $images;
    }
    
    foreach ($items as $item) {
        // 跳过.和..
        if ($item == '.' || $item == '..') {
            continue;
        }
        
        $path = $dir . '/' . $item;
        $relativePath = str_replace($baseDir . '/', '', $path);
        
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
                
                $images[] = [
                    'name' => pathinfo($path, PATHINFO_FILENAME),
                    'filename' => pathinfo($path, PATHINFO_BASENAME),
                    'path' => $relativePath,
                    'fullPath' => $path,
                    'size' => $size,
                    'sizeFormatted' => formatSize($size),
                    'modified' => $modified,
                    'modifiedFormatted' => date('Y-m-d H:i:s', $modified),
                    'width' => $width,
                    'height' => $height,
                    'extension' => $ext
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
    $defaultConfig = [
        'imagePaths' => [],
        'scanSubfolders' => true,
        'maxDepth' => 0,
        'imagesPerRow' => 4,
        'cacheTTL' => 3600,
        'port' => 8080
    ];
    
    if (!file_exists($file)) {
        file_put_contents($file, json_encode($defaultConfig, JSON_PRETTY_PRINT));
        return $defaultConfig;
    }
    
    $config = json_decode(file_get_contents($file), true);
    return $config ? array_merge($defaultConfig, $config) : $defaultConfig;
}

$config = loadConfig($configFile);


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
?>
