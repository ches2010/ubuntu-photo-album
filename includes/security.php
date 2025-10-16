<?php
// includes/security.php
/**
 * 安全工具类
 * 提供路径验证和安全检查功能
 */

/**
 * 验证路径是否在允许的范围内
 * 防止路径遍历攻击
 */
function isPathAllowed($path) {
    // 获取标准化的绝对路径
    $realPath = realpath($path);
    $allowedPath = realpath(DEFAULT_IMAGE_PATH);
    
    // 检查路径是否在允许的目录下
    if ($realPath && strpos($realPath, $allowedPath) === 0) {
        return true;
    }
    
    return false;
}

/**
 * 清理用户输入
 */
function sanitizeInput($input) {
    if (is_array($input)) {
        return array_map('sanitizeInput', $input);
    }
    
    // 移除危险字符和HTML标签
    return trim(strip_tags($input));
}

/**
 * 验证文件名是否安全
 */
function isFilenameSafe($filename) {
    // 不允许包含路径分隔符或特殊字符
    if (strpos($filename, '/') !== false || strpos($filename, '\\') !== false) {
        return false;
    }
    
    // 不允许以点开头的文件（隐藏文件）
    if (substr($filename, 0, 1) === '.') {
        return false;
    }
    
    return true;
}
?>
