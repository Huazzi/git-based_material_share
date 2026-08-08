# 资料共享站 V2

资料共享站是一个纯前端的 GitHub 文件 Hub。它将仓库目录固定到一次提交快照，在浏览器中完成资料浏览、搜索、预览、下载以及授权后的上传、建目录和删除操作。

## 功能

- GitHub-only：不依赖自建后端或 API 代理。
- 公共仓库可匿名只读；写操作必须提供具备最小权限的 fine-grained PAT。
- 一次拉取 Git Tree 后在本地完成目录导航和文件名搜索。
- 支持列表/网格视图、面包屑、多文件原子上传、新建目录、文件删除和原子目录删除。
- 当前视图可多选文件或文件夹并打包为 ZIP；目录层级、空目录会保留，系统文件与特殊节点会排除并提示。
- 支持 PDF、DOCX、Markdown、图片、视频、代码与文本预览；HTML 始终按源码展示。
- Markdown、DOCX、SVG 和高亮 HTML 统一经过白名单清洗。
- PAT 默认只保存在当前标签页会话；用户可明确选择在本设备记住。

## 文件限制

| 操作 | 限制 |
| --- | --- |
| 上传 | 最大 25 MiB |
| 批量上传 | 最多 20 个文件、单个最大 25 MiB、总计最大 100 MiB；一次生成一个 Git commit |
| 在线预览 | 最大 25 MiB |
| 下载 | 最大 100 MiB |
| 批量 ZIP 下载 | 展开后最多 50 个文件、单个最大 100 MiB、总计最大 500 MiB |

25 MiB 以上、100 MiB 以内的文件仅允许下载；超过 100 MiB 的文件不支持读取。批量 ZIP 优先通过浏览器文件流直接保存；不支持文件流保存时使用内存 Blob，且总大小上限降为 200 MiB。GitHub API 自身的限制仍然适用。

## 本地开发

要求 Node.js `>=22.13.0`。

```powershell
npm ci
npm run dev
```

请通过 Vite 提供的本地地址访问应用，不能再直接双击 `index.html` 运行。

其他命令：

```powershell
npm run test
npm run build
npm run preview
```

## 仓库配置

首次打开时填写 GitHub owner、repository 和 branch。

- 公开仓库只读：PAT 留空。
- 私有仓库或写操作：使用 fine-grained PAT，并仅授予目标仓库所需的 Contents 读取或读写权限。
- “在此设备记住访问令牌”默认关闭。关闭时 PAT 使用 `sessionStorage`；开启后才会写入 `localStorage`。
- 从 V1 迁移时只保留有效的 GitHub 仓库信息和视图偏好，旧 PAT 不会迁移，必须重新输入。

应用不支持空仓库，也不会代表用户初始化仓库。GitHub 返回截断 Tree 时会停止加载，避免在不完整目录上执行写操作。

## 部署

项目以 Netlify 为主要部署目标：

1. 将仓库连接到 Netlify。
2. 构建命令使用 `npm run build`。
3. 发布目录使用 `dist`。

仓库中的 `netlify.toml` 已包含构建配置、SPA fallback 与基础安全响应头。生产站点必须使用 HTTPS。

## 架构与安全

- [V2 架构说明](docs/architecture-v2.md)
- [安全策略与令牌说明](SECURITY.md)
- [改造需求基线](项目改造方案.md)

V1 的《需求分析报告》仅作为历史资料保存；冲突处以《项目改造方案.md》和当前文档为准。

## 许可证

MIT
