# Code Graph Search 架构图

这个目录包含了基于AWS CDK定义的Code Graph Search架构图。

## 架构概述

Code Graph Search是一个使用多种AWS服务构建的系统，用于下载、处理、分析和搜索代码库。系统主要组件包括：

- **前端**：通过CloudFront分发的静态网站
- **API Gateway**：处理前端请求
- **Lambda函数**：
  - Code Downloader：下载代码库
  - Code Reader：读取和处理代码
  - Code Summarizer：创建代码摘要和图形表示
  - Search Code Graph：处理搜索查询
- **SQS队列**：管理异步处理
- **存储**：
  - S3：存储下载的代码和网站文件
  - DynamoDB：存储代码库和文件元数据
  - Neptune：图数据库，存储代码关系图
  - OpenSearch：提供搜索功能

## 架构图

架构图使用draw.io创建，文件名为`code_graph_search_architecture.drawio`。

### 查看架构图

1. 使用[draw.io](https://app.diagrams.net/)打开
2. 选择"File" > "Open from" > "Device"
3. 选择`code_graph_search_architecture.drawio`文件

或者直接在浏览器中打开：https://app.diagrams.net/#Uhttps%3A%2F%2Fraw.githubusercontent.com%2FYOUR_USERNAME%2FYOUR_REPO%2Fmain%2Fbin%2Fcode_graph_search_architecture.drawio
(需要替换YOUR_USERNAME和YOUR_REPO为实际的GitHub用户名和仓库名)

## 数据流

1. 用户通过CloudFront访问网站
2. 用户请求通过API Gateway发送到Lambda函数
3. Code Downloader函数下载代码并将任务发送到SQS队列
4. Code Reader函数从队列接收任务，处理代码并将结果发送到另一个队列
5. Code Summarizer函数创建代码摘要和图形表示，存储在Neptune和OpenSearch中
6. 用户可以通过Search Code Graph函数搜索代码库

## VPC和安全

除了客户端和API Gateway外，所有组件都部署在VPC内以提高安全性。系统使用了多种VPC端点来安全地连接AWS服务。
