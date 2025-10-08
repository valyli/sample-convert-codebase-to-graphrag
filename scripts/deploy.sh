#!/bin/bash

# 统一部署脚本 - 支持完整部署和快速修复

set -e

# 参数解析
FULL_DEPLOY=false
QUICK_FIX=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --full)
            FULL_DEPLOY=true
            shift
            ;;
        --quick)
            QUICK_FIX=true
            shift
            ;;
        *)
            echo "用法: $0 [--full|--quick]"
            echo "  --full   完整部署（首次部署或全新环境）"
            echo "  --quick  快速修复（仅更新API URL）"
            exit 1
            ;;
    esac
done

if [ "$FULL_DEPLOY" = true ]; then
    echo "🚀 执行完整部署..."
    bash scripts/auto-fix-deployment.sh
elif [ "$QUICK_FIX" = true ]; then
    echo "⚡ 执行快速修复..."
    bash scripts/quick-fix.sh
else
    echo "请选择部署模式："
    echo "  $0 --full   # 完整部署"
    echo "  $0 --quick  # 快速修复"
fi