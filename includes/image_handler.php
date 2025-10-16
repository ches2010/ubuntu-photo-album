<?php
// includes/image_handler.php
/**
 * Ubuntu服务器相册 - 图片处理
 */

/**
 * 处理获取图片列表的请求
 */
function handleGetImages() {
    try {
        // 验证并处理分页参数
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $perPage = isset($_GET['perPage']) ? (int)$_GET['perPage'] : 20;
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $sort = isset($_GET['sort']) ? $_GET['sort'] : 'name_asc';
        
        // 验证参数有效性
        if ($page < 1) $page = 1;
        if ($perPage < 1 || $perPage > 100) $perPage = 20;
        
        // 验证排序参数
        $validSorts = ['name_asc', 'name_desc', 'date_asc', 'date_desc', 'size_asc', 'size_desc'];
        if (!in_array($sort, $validSorts)) {
            $sort = 'name_asc';
        }
        
        // 从缓存或扫描获取图片
        $images = getImages($search, $sort);
        
        // 分页处理
        $total = count($images);
        $offset = ($page - 1) * $perPage;
        $paginatedImages = array_slice($images, $offset, $perPage);
        
        // 返回正确的JSON响应
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'images' => $paginatedImages,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'perPage' => $perPage,
                'totalPages' => ceil($total / $perPage)
            ]
        ]);
        exit;
        
    } catch (Exception $e) {
        // 捕获所有异常，返回详细错误信息
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
        echo json_encode([
            'error' => '获取图片列表失败',
            'details' => DEBUG ? $e->getMessage() : '内部服务器错误'
        ]);
        exit;
    }
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

    // 输出图片内容
    header("Content-Type: $mimeType");
    header("Cache-Control: public, max-age=3600"); // 缓存1小时
    header("Pragma: public");
    readfile($fullImagePath);
    exit;
}
?>
