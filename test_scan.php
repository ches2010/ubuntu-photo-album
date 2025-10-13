<?php
$configFile = 'config.json';
$defaultConfig = [
    'imagePaths' => ['/mnt/sda2/pitrues/Xpic/aa', '/mnt/sda2/pitrues/Xpic/ad'],
    'scanSubfolders' => true,
    'maxDepth' => 0
];

// 读取配置
function loadConfig($file, $default) {
    if (!file_exists($file)) return $default;
    $config = json_decode(file_get_contents($file), true);
    return $config ? array_merge($default, $config) : $default;
}

$config = loadConfig($configFile, $defaultConfig);
$supportedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$images = [];

// 扫描函数
function scanDir($dir, $base, $exts, $scanSub, $maxDepth, $depth = 0) {
    $result = [];
    $items = scandir($dir);
    if (!$items) return $result;
    
    foreach ($items as $item) {
        if ($item == '.' || $item == '..') continue;
        $path = $dir . '/' . $item;
        
        if (is_dir($path) && $scanSub && ($maxDepth == 0 || $depth < $maxDepth)) {
            $result = array_merge($result, scanDir($path, $base, $exts, $scanSub, $maxDepth, $depth + 1));
        } elseif (is_file($path)) {
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            if (in_array($ext, $exts)) {
                $result[] = $path;
            }
        }
    }
    return $result;
}

// 执行扫描
foreach ($config['imagePaths'] as $path) {
    if (is_dir($path)) {
        $images = array_merge($images, scanDir($path, $path, $supportedExtensions, 
            $config['scanSubfolders'], $config['maxDepth']));
    }
}

// 输出结果
echo "找到 " . count($images) . " 张图片:\n";
foreach ($images as $img) {
    echo "- $img\n";
}
?>
