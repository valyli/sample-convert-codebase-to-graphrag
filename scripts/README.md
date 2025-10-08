# 自动化部署脚本

这个目录包含了自动化处理 `DEPLOYMENT_FIXES.md` 中所有修复步骤的脚本。

## 脚本说明

### 1. `reset-to-localhost.sh` - 重置脚本

**适用场景：** 文件中已包含 API Gateway URL，需要重置为 localhost:8080

**功能：**
- ✅ 将所有 API Gateway URL 重置为 localhost:8080
- ✅ 为自动化脚本准备干净的起始状态

**使用方法：**
```bash
./scripts/reset-to-localhost.sh
```

### 2. `auto-fix-deployment.sh` - 完整自动化部署

**适用场景：** 全新部署或需要完整修复的项目

**功能：**
- ✅ 创建 OpenSearch 服务链接角色
- ✅ 自动检测 AWS 区域
- ✅ 修复前端 API URL 配置
- ✅ 修复 URL 编码问题
- ✅ 执行完整部署
- ✅ 自动获取 API Gateway URL 并更新前端
- ✅ 清除 CloudFront 缓存
- ✅ 验证部署结果

**使用方法：**
```bash
./scripts/auto-fix-deployment.sh
```

### 2. `quick-fix.sh` - 快速修复

**适用场景：** 项目已部署但 API URL 配置错误

**功能：**
- ✅ 自动获取正确的 API Gateway URL
- ✅ 修复所有前端文件中的 API URL
- ✅ 重新构建和部署前端

**使用方法：**
```bash
./scripts/quick-fix.sh
```

## 使用建议

### 首次部署
```bash
# 如果文件中已包含 API Gateway URL，先重置
./scripts/reset-to-localhost.sh

# 然后使用完整自动化脚本
./scripts/auto-fix-deployment.sh
```

### 已部署项目修复
```bash
# 使用快速修复脚本（不需要重置）
./scripts/quick-fix.sh
```

### 当前情况（文件已包含 API Gateway URL）
```bash
# 先重置为 localhost
./scripts/reset-to-localhost.sh

# 然后执行自动化修复
./scripts/auto-fix-deployment.sh
```

### 手动验证
部署完成后，访问 CloudFront URL 并检查：
1. 页面是否正常显示
2. "Server API URL" 是否显示正确的 API Gateway 地址
3. 创建功能是否正常工作

## 前置条件

确保已安装并配置：
- AWS CLI
- Node.js & npm
- CDK CLI

## 故障排除

如果脚本执行失败：

1. **权限问题**
   ```bash
   chmod +x scripts/*.sh
   ```

2. **AWS 认证问题**
   ```bash
   aws configure
   ```

3. **依赖问题**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

4. **手动回退**
   如果自动化脚本出现问题，可以参考 `DEPLOYMENT_FIXES.md` 进行手动修复。

## 脚本特性

- 🛡️ **安全性**：使用 `set -e` 确保遇到错误时立即停止
- 🎨 **用户友好**：彩色输出和清晰的状态信息
- 🔄 **幂等性**：可以重复执行而不会造成问题
- 📝 **详细日志**：每个步骤都有清晰的状态反馈

## 贡献

如果发现脚本有问题或需要改进，请：
1. 查看 `DEPLOYMENT_FIXES.md` 了解手动修复步骤
2. 更新相应的脚本
3. 测试脚本功能
4. 提交 PR