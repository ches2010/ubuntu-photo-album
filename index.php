<?php
/**
 * Ubuntu服务器相册 - 入口文件
 * index.php
 * 处理请求路由
 */

// 加载核心函数库
require_once 'includes/core.php';
require_once 'includes/config.php';
require_once 'includes/image_handler.php';
require_once 'includes/thumbnail_handler.php';
require_once 'includes/base64_handler.php';
require_once 'includes/cache_handler.php';
require_once 'includes/utils.php';

// 调试模式控制 - 开启调试以查看详细错误
define('DEBUG', true);

// 设置PHP错误报告级别
if (DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(E_ERROR | E_WARNING);
    ini_set('display_errors', 0);
}

// 设置错误日志文件
ini_set('log_errors', 1);
ini_set('error_log', '/var/log/php/photo-album.log');

// 确保必要目录存在
$cacheDir = 'cache/';
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}

// 先判断是否是默认首页请求（无任何参数）
$isDefaultRequest = empty($_GET) && 
                   ($_SERVER['REQUEST_URI'] === '/' || 
                    $_SERVER['REQUEST_URI'] === '/index.php');

// 根据请求类型设置正确的Content-Type
if ($isDefaultRequest) {
    header('Content-Type: text/html; charset=utf-8');
} else {
    // 缩略图和原图请求需要特殊的Content-Type
    $action = $_GET['action'] ?? '';
    if ($action !== 'getThumbnail' && $action !== 'getImage') {
        header('Content-Type: application/json; charset=utf-8');
    }
}

// 处理跨域请求
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理OPTIONS请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 获取请求操作，默认为显示首页
$action = $_GET['action'] ?? ($isDefaultRequest ? 'default' : 'invalid');

// 初始化
init();

/**
 * 初始化函数，路由请求到相应的处理函数
 */
function init() {
    global $configFile, $defaultConfig, $action;
    
    // 确保配置文件存在
    if (!file_exists($configFile)) {
        saveConfig($defaultConfig);
    }
    
    // 路由到相应的处理函数
    switch ($action) {
        case 'getThumbnail':
            handleGetThumbnail();
            break;
        case 'getImage':
            handleGetImage();
            break;
        case 'getBase64Image':
            handleGetBase64Image();
            break;
        case 'getImages':
            handleGetImages();
            break;
        case 'getSettings':
            handleGetSettings();
            break;
        case 'saveSettings':
            handleSaveSettings();
            break;
        case 'refreshCache':
            handleRefreshCache();
            break;
        case 'default':
            // 处理默认请求，返回前端页面
            if (file_exists('index.html')) {
                // 确保内容类型正确
                header('Content-Type: text/html; charset=utf-8');
                readfile('index.html');
            } else {
                http_response_code(404);
                echo json_encode(['error' => '首页文件不存在']);
            }
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => '无效的请求动作: ' . $action]);
            break;
    }
}
?>



