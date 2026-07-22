# 安全说明

## 令牌模型

本项目没有后端，GitHub PAT 会从浏览器直接发送到 `api.github.com`。

- 优先使用 GitHub fine-grained PAT，并限制到单个目标仓库。
- 匿名浏览公开仓库时不要填写 PAT。
- PAT 默认存入 `sessionStorage`，关闭标签页后失效；只有明确勾选“在此设备记住访问令牌”才会存入 `localStorage`。
- 重置配置会清除会话和本地令牌。V1 的旧令牌不会迁移。
- 不要在共享设备、受控浏览器扩展未知的环境或非 HTTPS 站点保存令牌。

如果怀疑令牌泄漏，请立即在 GitHub 撤销令牌并清除站点数据。

## 内容安全

- Markdown、DOCX、SVG 与 Prism 生成的标记必须经过统一的 DOMPurify 白名单清洗后才能进入 DOM。
- HTML 文件只按源码预览，不执行仓库中的脚本。
- 文件内容固定读取初始化时的 commit SHA，避免目录信息与预览内容来自不同版本。
- 上传/预览上限为 25 MiB，下载上限为 100 MiB，并在请求前、响应头和最终 Blob 三处校验。
- 写操作串行执行且不自动重试；Git ref 更新始终使用 `force: false`。

## 响应头与 CSP

Netlify 配置已启用 `nosniff`、严格来源策略、禁止 iframe 嵌入及基础 Permissions Policy。严格 Content-Security-Policy 尚未启用：Markdown 远程资源策略、GitHub API 连接范围以及 PDF worker 的生产策略需要先在真实部署环境验证。启用 CSP 前不得移除现有的内容清洗和大小限制。

## 报告问题

请通过项目仓库的私密安全报告渠道提交漏洞。报告中不要包含可用 PAT、私有仓库内容或其他凭据。
