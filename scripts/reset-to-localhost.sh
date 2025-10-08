#!/bin/bash

# 重置脚本 - 将所有API URL恢复为localhost:8080
# 用于在执行自动化脚本前重置到原始状态

set -e

echo "🔄 重置 API URL 为 localhost:8080..."

# 要重置的文件列表
files=(
    "client/src/views/CreateView.vue"
    "client/src/views/GraphFileListView.vue"
    "client/src/views/ListGraphView.vue"
    "client/src/views/SearchView.vue"
    "client/src/views/SettingsView.vue"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        # 将任何 API Gateway URL 替换为 localhost:8080
        sed -i "s|https://.*\.execute-api\..*\.amazonaws\.com/prod|http://localhost:8080|g" "$file"
        echo "✅ 已重置: $file"
    else
        echo "⚠️  文件不存在: $file"
    fi
done

echo "🎉 重置完成！现在可以运行自动化脚本了"
echo ""
echo "接下来运行："
echo "  ./scripts/auto-fix-deployment.sh  # 完整部署"
echo "  或"
echo "  ./scripts/quick-fix.sh           # 快速修复"