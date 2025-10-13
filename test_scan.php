<?php
// 测试图片路径
$testPaths = [
    '/mnt/sda2/pitrues/Xpic/aa',
    '/mnt/sda2/pitrues/Xpic/ad'
];

echo "开始测试图片访问权限...\n\n";

foreach ($testPaths as $path) {
    echo "测试路径: $path\n";
    
    // 检查路径是否存在
    if (!file_exists($path)) {
        echo "  ❌ 路径不存在\n\n";
        continue;
    }
    
    // 检查是否为目录
    if (!is_dir($path)) {
        echo "  ❌ 不是有效的目录\n\n";
        continue;
    }
    
    // 检查是否有读取权限
    if (!is_readable($path)) {
        echo "  ❌ 没有读取权限\n\n";
        continue;
    }
    
    // 尝试扫描目录中的图片文件
    $files = scandir($path);
    if (!$files) {
        echo "  ❌ 无法扫描目录内容\n\n";
        continue;
    }
    
    // 筛选图片文件
    $imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    $images = [];
    
    foreach ($files as $file) {
        if ($file == '.' || $file == '..') continue;
        
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (in_array($ext, $imageExts)) {
            $images[] = $file;
        }
    }
    
    if (count($images) > 0) {
        echo "  ✅ 目录可访问\n";
        echo "  找到 " . count($images) . " 张图片，示例:\n";
        echo "  - " . $images[0] . "\n\n";
    } else {
        echo "  ℹ️ 目录可访问，但未找到图片文件\n\n";
    }
}
