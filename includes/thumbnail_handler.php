<?php
// includes/thumbnail_handler.php
/**
 * Ubuntu服务器相册 - 缩略图处理
 */

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

    // 获取配置的缩略图尺寸
    $width = isset($settings['thumbnailWidth']) ? (int)$settings['thumbnailWidth'] : 200;
    $height = isset($settings['thumbnailHeight']) ? (int)$settings['thumbnailHeight'] : 150;
    
    // 生成并输出缩略图
    generateThumbnail($fullImagePath, $width, $height);
    exit;
}

/**
 * 生成并输出图片缩略图
 */
function generateThumbnail($imagePath, $width = 200, $height = 150) {
    // 清除之前的输出
    ob_clean();
    flush();
  
    // 验证原图存在
    if (!file_exists($imagePath) || !is_readable($imagePath)) {
        http_response_code(404);
        exit;
    }
  
    // 获取图片信息
    $info = getimagesize($imagePath);
    if (!$info) {
        http_response_code(415);
        exit;
    }
    
    $mime = $info['mime'];

    // 输出正确的响应头
    header("Content-Type: $mime");
    header("Cache-Control: public, max-age=86400"); // 缓存1天
    header("Pragma: public");
  
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
            error_log("[ERROR] 不支持的图片类型: $mime 路径: $imagePath");
            http_response_code(415);
            exit;
    }
    
    if (!$source) {
        error_log("[ERROR] 无法创建图片资源: $imagePath");
        http_response_code(500);
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
    if (!$thumbnail) {
        error_log("[ERROR] 无法创建缩略图资源: $imagePath");
        imagedestroy($source);
        http_response_code(500);
        exit;
    }
    
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
        error_log("[ERROR] 缩略图生成失败: $imagePath");
        imagedestroy($source);
        imagedestroy($thumbnail);
        http_response_code(500);
        exit;
    }

    // 输出缩略图
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
    exit;
}
?>
