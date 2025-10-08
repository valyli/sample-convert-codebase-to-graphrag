#!/bin/bash

# 快速修复脚本 - 仅修复API URL和重新部署前端
# 适用于已经部署但API URL配置错误的情况

set -e

echo "🔧 快速修复 API URL 配置..."

# 获取当前API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
    --stack-name CodeGraphSearchStack \
    --query "Stacks[0].Outputs[?OutputKey=='CodeGraphApiEndpointCA3FA220'].OutputValue" \
    --output text 2>/dev/null)

if [ -z "$API_URL" ]; then
    echo "❌ 无法获取 API Gateway URL"
    exit 1
fi

echo "✅ 检测到 API Gateway URL: $API_URL"

# 修复前端文件
files=(
    "client/src/views/CreateView.vue"
    "client/src/views/GraphFileListView.vue"
    "client/src/views/ListGraphView.vue"
    "client/src/views/SearchView.vue"
    "client/src/views/SettingsView.vue"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        # 替换任何localhost或错误的API URL
        sed -i "s|http://localhost:8080|$API_URL|g" "$file"
        sed -i "s|https://.*\.execute-api\..*\.amazonaws\.com/prod|$API_URL|g" "$file"
        echo "✅ 已修复: $file"
    fi
done

# 重新构建前端
echo "🔨 重新构建前端..."
cd client && npm run build && cd ..

# 重新部署
echo "🚀 重新部署..."
npx cdk deploy --require-approval never

echo "🎉 快速修复完成！"