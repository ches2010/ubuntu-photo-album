<?php
// includes/core.php
/**
 * Ubuntu服务器相册 - 核心函数库
 */

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

/**
 * 获取图片列表（从缓存或扫描）
 */
function getImages($search = '', $sort = 'name_asc') {
    global $cacheDir, $configFile;
    
    try {
        $config = loadConfig($configFile);
        if (DEBUG) {
            error_log("[INFO] 开始扫描图片，配置路径: " . implode(', ', $config['imagePaths']));
        }
        
        // 强制重新扫描，不使用缓存
        $images = scanImages($config, $search);
        if (DEBUG) {
            error_log("[INFO] 扫描完成，找到 " . count($images) . " 张图片");
        }
        
        $images = sortImages($images, $sort);
        return $images;
    } catch (Exception $e) {
        error_log("[ERROR] 获取图片列表错误: " . $e->getMessage());
        return [];
    }
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
        // 计算相对路径
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
                
                // 修复：使用rawurlencode确保路径正确编码
                $encodedPath = rawurlencode($relativePath);
                
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
?>
