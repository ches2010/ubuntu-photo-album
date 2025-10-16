<?php
// includes/base64_handler.php
/**
 * Ubuntu服务器相册 - Base64图片处理
 */

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
?>
