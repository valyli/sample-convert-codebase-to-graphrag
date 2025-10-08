#!/bin/bash

# Code Graph Search 自动化部署修复脚本
# 自动执行 DEPLOYMENT_FIXES.md 中的所有修复步骤

set -e  # 遇到错误立即退出

echo "🚀 开始自动化部署修复..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函数：打印带颜色的消息
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必要工具
check_prerequisites() {
    print_status "检查必要工具..."
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI 未安装"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
        exit 1
    fi
    
    if ! command -v npx &> /dev/null; then
        print_error "npx 未安装"
        exit 1
    fi
    
    print_success "所有必要工具已安装"
}

# 步骤1：创建OpenSearch服务链接角色
create_opensearch_role() {
    print_status "创建 OpenSearch 服务链接角色..."
    
    if aws iam create-service-linked-role --aws-service-name es.amazonaws.com 2>/dev/null; then
        print_success "OpenSearch 服务链接角色创建成功"
    else
        print_warning "OpenSearch 服务链接角色可能已存在（这是正常的）"
    fi
}

# 步骤2：获取当前区域
get_region() {
    REGION=$(aws configure get region)
    if [ -z "$REGION" ]; then
        REGION="us-east-1"
        print_warning "未检测到AWS区域，使用默认值: $REGION"
    else
        print_success "检测到AWS区域: $REGION"
    fi
}

# 步骤3：获取API Gateway URL
get_api_url() {
    print_status "获取 API Gateway URL..."
    
    # 从CDK输出获取API Gateway URL
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name CodeGraphSearchStack \
        --query "Stacks[0].Outputs[?OutputKey=='CodeGraphApiEndpointCA3FA220'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$API_URL" ]; then
        print_warning "无法获取现有的 API Gateway URL，将在部署后获取"
        API_URL=""
    else
        print_success "获取到现有 API Gateway URL: $API_URL"
    fi
}

# 步骤4：修复前端API URL配置
fix_frontend_api_urls() {
    print_status "修复前端 API URL 配置..."
    
    # 如果没有API URL，先跳过，部署后再处理
    if [ -z "$API_URL" ]; then
        print_status "将在部署后更新 API URL"
        return
    fi
    
    # 修复所有Vue文件中的API URL
    local files=(
        "client/src/views/CreateView.vue"
        "client/src/views/GraphFileListView.vue" 
        "client/src/views/ListGraphView.vue"
        "client/src/views/SearchView.vue"
        "client/src/views/SettingsView.vue"
    )
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            # 直接替换为正确的API URL
            sed -i "s|http://localhost:8080|$API_URL|g" "$file"
            sed -i "s|https://.*\.execute-api\..*\.amazonaws\.com/prod|$API_URL|g" "$file"
            print_success "已修复: $file"
        else
            print_warning "文件不存在: $file"
        fi
    done
}

# 步骤4：修复URL编码问题
fix_url_encoding() {
    print_status "修复 URL 编码问题..."
    
    local create_view="client/src/views/CreateView.vue"
    if [ -f "$create_view" ]; then
        # 使用更安全的sed替换
        if grep -q "gitUrl=\${this.formData.githubUrl}" "$create_view"; then
            sed -i 's/gitUrl=${this\.formData\.githubUrl}/gitUrl=${encodeURIComponent(this.formData.githubUrl)}/g' "$create_view"
            sed -i 's/branch=${this\.formData\.branchName}/branch=${encodeURIComponent(this.formData.branchName)}/g' "$create_view"
            sed -i 's/subFolder=${this\.formData\.scanFolder}/subFolder=${encodeURIComponent(this.formData.scanFolder)}/g' "$create_view"
            print_success "URL编码修复完成"
        else
            print_warning "URL编码可能已经修复过了"
        fi
    fi
}

# 步骤5：执行部署
deploy_application() {
    print_status "开始部署应用..."
    
    # 安装依赖
    print_status "安装依赖..."
    npm install --legacy-peer-deps
    
    # 构建前端
    print_status "构建前端..."
    cd client && npm install && npm run build && cd ..
    
    # CDK部署
    print_status "执行 CDK 部署..."
    npx cdk deploy --require-approval never
    
    print_success "应用部署完成"
}

# 步骤6：更新前端API URL
update_api_urls() {
    print_status "获取部署后的 API Gateway URL..."
    
    # 从CDK输出获取API Gateway URL
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name CodeGraphSearchStack \
        --query "Stacks[0].Outputs[?OutputKey=='CodeGraphApiEndpointCA3FA220'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$API_URL" ]; then
        print_error "无法获取 API Gateway URL，请手动检查 CloudFormation 输出"
        return 1
    fi
    
    print_success "获取到 API Gateway URL: $API_URL"
    
    # 更新前端文件中的localhost
    local files=(
        "client/src/views/CreateView.vue"
        "client/src/views/GraphFileListView.vue"
        "client/src/views/ListGraphView.vue" 
        "client/src/views/SearchView.vue"
        "client/src/views/SettingsView.vue"
    )
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            # 替换localhost为实际API URL
            sed -i "s|http://localhost:8080|$API_URL|g" "$file"
            print_success "已更新: $file"
        fi
    done
    
    # 重新构建和部署前端
    print_status "重新构建前端..."
    cd client && npm run build && cd ..
    
    # 重新部署前端
    print_status "重新部署前端..."
    npx cdk deploy --require-approval never
    
    print_success "前端更新完成"
}

# 步骤7：验证部署
verify_deployment() {
    print_status "验证部署..."
    
    # 获取CloudFront URL
    CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
        --stack-name CodeGraphSearchStack \
        --query "Stacks[0].Outputs[?contains(OutputKey,'CloudFront')].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$CLOUDFRONT_URL" ]; then
        print_success "部署完成！"
        echo ""
        echo "🌐 前端访问地址: $CLOUDFRONT_URL"
        echo "🔗 API Gateway地址: $API_URL"
        echo ""
        echo "请访问前端地址验证部署是否成功"
    else
        print_warning "无法获取 CloudFront URL，请检查 CloudFormation 输出"
    fi
}

# 主函数
main() {
    echo "========================================"
    echo "  Code Graph Search 自动化部署修复"
    echo "========================================"
    echo ""
    
    check_prerequisites
    create_opensearch_role
    get_region
    fix_url_encoding
    deploy_application
    update_api_urls
    verify_deployment
    
    echo ""
    print_success "🎉 自动化修复完成！"
    echo ""
    echo "如果遇到问题，请查看 DEPLOYMENT_FIXES.md 进行手动修复"
}

# 执行主函数
main "$@"