<?php
/**
 * 图片删除处理器
 * 负责处理图片删除请求并返回结果
 */

/**
 * 处理删除图片的请求
 */
function handleDeleteImageRequest() {
    // 只允许DELETE方法
    if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => '只允许DELETE方法'
        ]);
        exit;
    }
    
    // 验证路径参数
    if (!isset($_GET['path'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => '缺少路径参数'
        ]);
        exit;
    }
    
    try {
        $path = urldecode($_GET['path']);
        $fullPath = buildFullImagePath($path);
        
        // 安全检查
        if (!isPathAllowed($fullPath)) {
            throw new Exception("不允许删除该路径的文件: " . $fullPath);
        }
        
        // 检查文件是否存在
        if (!file_exists($fullPath)) {
            throw new Exception("文件不存在");
        }
        
        // 检查是否为图片文件
        if (!isImageFile($fullPath)) {
            throw new Exception("不支持的文件类型，只能删除图片文件");
        }
        
        // 执行删除
        if (!unlink($fullPath)) {
            throw new Exception("删除失败，可能没有权限");
        }
        
        // 删除成功，清除缓存
        clearImageCache();
        
        echo json_encode([
            'success' => true,
            'message' => '文件已成功删除',
            'path' => $path
        ]);
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
}

/**
 * 清除图片缓存
 */
function clearImageCache() {
    // 实现缓存清除逻辑
    // 例如删除缓存目录中的文件或更新缓存时间戳
    $cacheFile = 'cache/image_list.json';
    if (file_exists($cacheFile)) {
        unlink($cacheFile);
    }
}
?>
