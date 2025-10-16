<?php
// includes/cache_handler.php
/**
 * Ubuntu服务器相册 - 缓存处理
 */

/**
 * 处理刷新缓存的请求
 */
function handleRefreshCache() {
    // 防止重复清理
    static $processed = false;
    if ($processed) {
        echo json_encode([
            'success' => true,
            'message' => '缓存已刷新',
            'clearedCount' => 0
        ]);
        return;
    }
    
    // 清除图片缓存前先统计文件数
    $fileCount = count(glob($GLOBALS['cacheDir'] . '*'));
    
    // 只调用一次clearCache()并存储结果
    $cacheCleared = clearCache();
  
    if ($cacheCleared) {
        // 主动触发一次图片扫描
        getImages();
      
        echo json_encode([
            'success' => true,
            'message' => '缓存已刷新，共清理 ' . $fileCount . ' 个文件',
            'clearedCount' => $fileCount
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'error' => '刷新缓存失败',
            'success' => false
        ]);
    }
    
    $processed = true;
}

/**
 * 清除缓存
 */
function clearCache() {
    global $cacheDir;
    
    // 防止重复清理
    static $cleared = false;
    if ($cleared) {
        return true;
    }
    
    if (!is_dir($cacheDir)) {
        // 如果缓存目录不存在，创建它
        mkdir($cacheDir, 0755, true);
        $cleared = true;
        return true;
    }

    // 清除所有缓存文件
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($cacheDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
  
    foreach ($files as $fileinfo) {
        $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
        if (!$todo($fileinfo->getRealPath())) {
            error_log("[ERROR] 清除缓存失败: " . $fileinfo->getRealPath());
            return false;
        }
    }

    // 记录缓存清理成功日志
    error_log("[INFO] 缓存已成功清除");
    $cleared = true;
    return true;
}
?>
