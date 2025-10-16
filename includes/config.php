<?php
// includes/config.php
/**
 * Ubuntu服务器相册 - 配置管理
 */

$configFile = 'config.json';

/**
 * 加载配置
 */
function loadConfig($file) {
    global $defaultConfig;
    
    if (!file_exists($file)) {
        file_put_contents($file, json_encode($defaultConfig, JSON_PRETTY_PRINT));
        return $defaultConfig;
    }
    
    $config = json_decode(file_get_contents($file), true);
    return $config ? array_merge($defaultConfig, $config) : $defaultConfig;
}

/**
 * 加载设置（用于缩略图等功能）
 */
function loadSettings() {
    global $configFile;
    return loadConfig($configFile);
}

/**
 * 保存配置
 */
function saveConfig($config) {
    global $configFile;
    
    $content = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($configFile, $content) !== false;
}

/**
 * 处理获取设置的请求
 */
function handleGetSettings() {
    global $configFile;
    $config = loadConfig($configFile);
    echo json_encode($config);
}

/**
 * 处理保存设置的请求
 */
function handleSaveSettings() {
    global $configFile;
    
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
        'port' => isset($data['port']) ? max(1, min(65535, (int)$data['port'])) : 8080,
        'thumbnailWidth' => isset($data['thumbnailWidth']) ? max(50, min(1000, (int)$data['thumbnailWidth'])) : 200,
        'thumbnailHeight' => isset($data['thumbnailHeight']) ? max(50, min(1000, (int)$data['thumbnailHeight'])) : 150
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
?>
