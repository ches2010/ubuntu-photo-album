<?php
// includes/utils.php
/**
 * Ubuntu服务器相册 - 工具函数
 */

/**
 * 解析并验证图片路径
 */
function resolveImagePath($userPath) {
    global $configFile;
    
    try {
        $settings = loadConfig($configFile);
        $decodedPath = urldecode($userPath);
        $normalizedPath = str_replace(['\\', '//'], '/', $decodedPath);
        
        if (DEBUG) {
            error_log("[INFO] 解析图片路径: 用户请求='$normalizedPath'");
        }
        
        foreach ($settings['imagePaths'] as $basePath) {
            if (!is_absolute_path($basePath)) {
                error_log("[WARNING] 配置路径 '$basePath' 不是绝对路径，已跳过");
                continue;
            }
            
            $basePath = rtrim($basePath, '/');
            $fullPath = $basePath . '/' . $normalizedPath;
            $fullPath = realpath($fullPath);
            
            if ($fullPath && file_exists($fullPath) && is_readable($fullPath)) {
                if (DEBUG) {
                    error_log("[INFO] 成功解析路径: $fullPath");
                }
                return $fullPath;
            }
        }
      
        // 尝试直接使用用户提供的绝对路径
        if (is_absolute_path($normalizedPath)) {
            $fullPath = realpath($normalizedPath);
            if ($fullPath && file_exists($fullPath) && is_readable($fullPath)) {
                if (DEBUG) {
                    error_log("[INFO] 解析成功(绝对路径): '$fullPath'");
                }
                return $fullPath;
            }
        }
        
        error_log("[ERROR] 解析失败: 找不到文件 '$normalizedPath'");
        return false;
    } catch (Exception $e) {
        error_log("[ERROR] 路径解析错误: " . $e->getMessage());
        return false;
    }
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
 * 辅助函数：检查是否为绝对路径
 */
function is_absolute_path($path) {
    return strpos($path, '/') === 0 || preg_match('/^[A-Za-z]:\\\/', $path);
}
?>
