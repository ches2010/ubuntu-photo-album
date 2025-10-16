<?php
// includes/scan_handler.php
/**
 * 扫描处理器
 * 负责扫描文件系统中的图片
 */

/**
 * 处理扫描图片的请求
 */
function handleScanImagesRequest() {
    try {
        // 强制重新扫描并更新缓存
        $imageList = scanImages(DEFAULT_IMAGE_PATH);
        
        // 保存到缓存
        @mkdir('cache', 0755, true);
        file_put_contents('cache/image_list.json', json_encode($imageList));
        
        echo json_encode([
            'success' => true,
            'message' => '扫描完成',
            'count' => count($imageList)
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => '扫描失败: ' . $e->getMessage()
        ]);
    }
}

/**
 * 扫描目录中的图片文件
 */
function scanImages($dir, $depth = 0) {
    $images = [];
    
    // 检查目录是否存在
    if (!is_dir($dir)) {
        throw new Exception("目录不存在: " . $dir);
    }
    
    // 检查目录是否可访问
    if (!is_readable($dir)) {
        throw new Exception("无法访问目录: " . $dir);
    }
    
    // 检查是否超过最大深度
    if (MAX_SCAN_DEPTH > 0 && $depth > MAX_SCAN_DEPTH) {
        return $images;
    }
    
    $items = scandir($dir);
    
    foreach ($items as $item) {
        // 跳过当前目录和父目录
        if ($item === '.' || $item === '..') {
            continue;
        }
        
        $path = $dir . '/' . $item;
        
        // 如果是目录且允许扫描子目录
        if (is_dir($path) && SCAN_SUBFOLDERS) {
            // 递归扫描子目录
            $subDirImages = scanImages($path, $depth + 1);
            $images = array_merge($images, $subDirImages);
        } 
        // 如果是文件且是图片
        elseif (is_file($path) && isImageFile($path)) {
            // 获取图片信息
            $images[] = getImageInfo($path);
        }
    }
    
    return $images;
}

/**
 * 获取图片详细信息
 */
function getImageInfo($path) {
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($path);
    
    // 获取图片尺寸
    $dimensions = getimagesize($path);
    $width = $dimensions ? $dimensions[0] : 0;
    $height = $dimensions ? $dimensions[1] : 0;
    
    // 获取文件大小
    $size = filesize($path);
    
    // 获取修改时间
    $modified = filemtime($path);
    
    // 获取相对路径（相对于默认图片目录）
    $relativePath = str_replace(DEFAULT_IMAGE_PATH, '', $path);
    
    return [
        'name' => basename($path),
        'filename' => basename($path),
        'path' => $relativePath,
        'fullPath' => $path,
        'size' => $size,
        'sizeFormatted' => formatFileSize($size),
        'modified' => $modified,
        'modifiedFormatted' => date('Y-m-d H:i:s', $modified),
        'width' => $width,
        'height' => $height,
        'mimeType' => $mimeType
    ];
}

/**
 * 格式化文件大小为人类可读的格式
 */
function formatFileSize($bytes, $decimals = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    $bytes /= (1 << (10 * $pow));
    
    return round($bytes, $decimals) . ' ' . $units[$pow];
}
?>
