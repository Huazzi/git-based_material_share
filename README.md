# 资料共享站

> [!note]
> 本质上就是将指定的git仓库的文件进行可视化的网站，只是，我最初的目的是为了储存和分享各种学习资料，所以才叫为「资料共享站」。
本项目是一个基于Git的资料共享网站。它允许用户通过配置 GitHub 或 Gitee 仓库，直接在浏览器中浏览、预览和上传文件，无需后端服务器。

## 特点

- **纯前端**: 无需服务器部署，可直接托管在 GitHub Pages, Gitee Pages 或其他静态网站托管平台。
- **GitHub/Gitee 集成**: 直接使用 GitHub/Gitee 作为文件存储和 API 服务。
- **文件浏览**: 以列表形式展示仓库中的文件和文件夹，支持目录导航。
- **文件预览**:
    - PDF (.pdf)
    - Word 文档 (.docx)
    - Markdown (.md)
    - 常见图片格式 (.png, .jpg, .gif, etc.)
    - 代码文件 (多种语言语法高亮)
    - 纯文本文件 (.txt, .log, etc.)
- **文件上传**: 支持将文件上传到当前浏览的仓库目录。
- **响应式设计**: 基础的响应式布局，适应不同屏幕尺寸。
- **配置持久化**: 仓库配置信息存储在浏览器 `localStorage` 中。

## 技术栈

- **核心框架**: Vue.js 3 (Composition API)
- **HTTP 请求**: Axios (也可使用 Fetch API)
- **样式**: 原生 CSS3 (Flexbox/Grid)
- **文件预览库**:
    - PDF.js: PDF 预览
    - Mammoth.js: .docx 转 HTML 预览
    - Marked.js: Markdown 转 HTML 预览
    - Prism.js: 代码语法高亮
- **数据存储**: 浏览器 `localStorage` (用于存储用户配置)

## 文件结构

```
/
├── index.html
├── style.css
├── app.js
├── utils.js
└── README.md
```

## 安装与运行

1.  **下载文件**:
    将 `index.html`, `style.css`, `app.js`, 和 `utils.js` 文件下载到你的本地计算机的同一个目录下。

2.  **获取 Personal Access Token (PAT)**:
    你需要在 GitHub 或 Gitee 上创建一个 PAT，用于授权应用访问你的仓库。
    -   **GitHub PAT**:
        1.  登录 GitHub。
        2.  前往 `Settings` > `Developer settings` > `Personal access tokens` > `Tokens (classic)`。
        3.  点击 `Generate new token` (或 `Generate new token (classic)`)。
        4.  给 Token 一个描述性的名字。
        5.  在 `Select scopes` 中，至少勾选 `repo` (Full control of private repositories) 权限。对于公开仓库，可能只需要 `public_repo`。
        6.  点击 `Generate token` 并复制生成的 Token。**注意：这个 Token 只会显示一次，请妥善保管。**
    -   **Gitee PAT**:
        1.  登录 Gitee。
        2.  前往 `头像` > `设置` > `安全设置` > `个人访问令牌`。
        3.  点击 `+生成新令牌`。
        4.  给 Token 一个描述性的名字。
        5.  在权限范围 (Scopes) 中，至少选择 `projects` (仓库管理)。
        6.  点击 `提交` 并复制生成的 Token。

3.  **打开应用**:
    用现代浏览器 (如 Chrome, Firefox, Edge, Safari) 打开本地的 `index.html` 文件。

4.  **配置仓库**:
    -   应用首次加载时，会弹出一个"仓库配置"对话框。
    -   **平台**: 选择 `GitHub` 或 `Gitee`。
    -   **用户名/组织名**: 输入你的 GitHub/Gitee 用户名，或者仓库所属的组织名。
    -   **仓库名**: 输入你想要访问的仓库的名称。
    -   **分支**: 输入仓库的分支，通常是 `main` 或 `master`。
    -   **Personal Access Token (PAT)**: 粘贴你在步骤 2 中获取到的 PAT。
    -   点击 "保存并加载"。

5.  **开始使用**:
    如果配置正确，你将看到仓库根目录的文件和文件夹列表。你可以：
    -   点击文件夹进入。
    -   点击文件进行预览。
    -   使用 "上传文件" 按钮上传新文件到当前目录。

## 安全提示

- **PAT 安全**: Personal Access Token (PAT) 非常敏感。它授予了对你仓库的访问权限。
    -   **最小权限原则**: 创建 PAT 时，仅授予应用所需的最小权限。
    -   **浏览器存储**: 本应用将 PAT 存储在浏览器的 `localStorage` 中。虽然方便，但这通常不被认为是高度安全的方式，尤其是在共享计算机上。请自行承担风险。
    -   **HTTPS**: 如果你将此应用部署到线上，请务必使用 HTTPS，以保护 PAT 在传输过程中的安全。
    -   **定期更换**: 定期更换你的 PAT。
    -   **不共享配置**: 不要在不信任的环境中使用或共享保存了敏感 PAT 的浏览器配置文件。

## 未来可能的改进 (基于设计文档)

- 网格视图模式切换
- 文件下载功能
- 创建新文件夹
- 用户偏好设置 (如主题切换)
- 更高级的缓存策略以提高性能
- 拖拽上传
- 多文件上传
- 完整的 i18n 国际化支持

## 贡献

欢迎提出改进意见或参与贡献！

## 许可

本项目代码基于 MIT 许可发布。 
