# Code Graph Search 部署修复指引

## 问题背景

原始项目前端配置使用 `localhost:8080`，这是开发环境配置，在生产环境中会导致 Network Error。本文档记录了成功部署所需的关键修改。

## 必要修改

### 1. 前端API URL配置

**影响文件：**
- `client/src/views/CreateView.vue`
- `client/src/views/GraphFileListView.vue`
- `client/src/views/ListGraphView.vue`
- `client/src/views/SearchView.vue`
- `client/src/views/SettingsView.vue`

**修改内容：**
```javascript
// 修改前
apiUrl: localStorage.getItem('apiUrl') || 'http://localhost:8080'

// 修改后
apiUrl: localStorage.getItem('apiUrl') || 'https://YOUR_API_GATEWAY_ID.execute-api.REGION.amazonaws.com/prod'
```

### 2. URL参数编码修复

**文件：** `client/src/views/CreateView.vue`

```javascript
// 修改前
const apiUrl = `${this.apiUrl}/createCodeGraph?gitUrl=${this.formData.githubUrl}&branch=${this.formData.branchName}&subFolder=${this.formData.scanFolder}&bedrockAPIPauseTime=${this.formData.bedrockPauseTime}`

// 修改后
const apiUrl = `${this.apiUrl}/createCodeGraph?gitUrl=${encodeURIComponent(this.formData.githubUrl)}&branch=${encodeURIComponent(this.formData.branchName)}&subFolder=${encodeURIComponent(this.formData.scanFolder)}&bedrockAPIPauseTime=${this.formData.bedrockPauseTime}`
```

### 3. API Gateway CORS配置

**文件：** `lib/code_graph_search-stack.ts`

```typescript
const api = new apigateway.LambdaRestApi(this, 'CodeGraphApi', {
  handler: codeDownloadLambdaFunction,
  proxy: false,
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
    allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
  },
});
```

## 部署步骤

### 1. 创建OpenSearch服务链接角色
```bash
aws iam create-service-linked-role --aws-service-name es.amazonaws.com
```

### 2. 执行标准部署
```bash
npm run deployAll
```

### 3. 获取API Gateway URL
从部署输出中记录：
```
CodeGraphApiEndpointCA3FA220 = https://YOUR_API_GATEWAY_ID.execute-api.REGION.amazonaws.com/prod/
```

### 4. 解决CDK缓存问题（如需要）

如果前端仍显示 `localhost:8080`：

```bash
# 清除CDK缓存
rm -rf cdk.out

# 重新构建前端
npm run buildClient

# 直接同步到S3
aws s3 sync client/dist/ s3://YOUR_WEBSITE_BUCKET/ --delete

# 清除CloudFront缓存
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

## 验证部署

1. 访问 CloudFront URL
2. 检查页面显示的 "Server API URL" 是否为 API Gateway 地址
3. 测试创建功能，成功时返回：
   ```json
   {"message": "Code Downloader succeed."}
   ```

## 架构说明

此项目采用**完全无服务器架构**：

- **前端**：S3 + CloudFront（静态网站托管）
- **后端**：API Gateway + Lambda（无服务器计算）
- **数据**：Neptune（图数据库）+ OpenSearch（搜索）+ DynamoDB

**没有EC2服务器**，`localhost:8080` 仅为开发环境配置。

## 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| Network Error | CORS未配置或API URL错误 | 检查CORS配置和API URL |
| CDK显示"no changes" | CDK缓存问题 | 清除cdk.out目录重新部署 |
| 浏览器仍显示localhost | 浏览器缓存 | 清除缓存或使用无痕模式 |
| OpenSearch创建失败 | 缺少服务链接角色 | 创建es.amazonaws.com服务链接角色 |

## 文件变更摘要

```
修改的文件：
- client/src/router.js (添加新路由)
- client/src/views/*.vue (5个文件，API URL配置)
- lib/code_graph_search-stack.ts (CORS配置)

新增的文件：
- client/src/views/NewCreateView.vue (可选，用于测试)
```