# Netlify 部署 CORS 问题解决方案

## 问题描述

将网站部署到 Netlify 后，使用预览功能时出现 CORS (跨域资源共享) 错误：

```
Access to fetch at 'https://gitee.com/...' from origin 'https://git-materials.netlify.app' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

这是因为 Gitee 服务器未配置允许从其他域名（如 Netlify 网站）直接访问其资源。

## 解决方案

我们通过以下方式解决：

1. 创建 Netlify 代理函数 (`netlify/functions/proxy.js`)，用于转发请求到 Gitee
2. 修改应用代码，使用代理服务器访问外部资源
3. 添加 Netlify 配置文件

### 修改内容

1. **添加代理功能**：创建 `netlify/functions/proxy.js` 代理服务
2. **配置 Netlify**：添加 `netlify.toml` 配置文件
3. **修改应用代码**：修改 `app.js` 中以下功能，使用代理替代直接访问
   - PDF 预览
   - 图片预览
   - 视频预览
   - 文档预览
   - 文件下载

## 部署说明

1. 确保安装函数依赖：`npm install`
2. 部署到 Netlify （可通过 Git 自动部署或手动上传）
3. 确保 Netlify 函数已正确配置和部署

## 测试

部署后，测试以下功能：
- PDF 文件预览
- 图片查看
- 视频播放
- 文档查看
- 文件下载 