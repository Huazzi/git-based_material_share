# V2 架构说明

## 分层

```text
Vue components
  -> composables / application coordination
  -> StorageProvider contract
  -> GitHubStorageProvider
  -> GitHub client
  -> GitHub REST API
```

组件不直接调用 Axios 或 GitHub API。预览组件只接收 Blob/文本及展示元数据，不感知仓库令牌。

## 一致性快照

初始化顺序为 Git ref → commit → recursive tree。`RepositorySnapshot` 将目录、搜索和状态查询构建为本地索引，所有 raw 内容读取都带初始化时的 commit SHA。

截断 Tree 与空仓库会失败关闭；应用不会展示部分目录，也不会隐式创建首次提交。symlink 和 submodule 作为只读特殊节点展示。

## 写操作

一个 provider 只拥有一个 `MutationQueue`。上传、建目录、删除文件和删除目录都在队列内重新读取必要的远端状态。失败任务不会阻塞后续任务，网络失败或超时不会触发自动重试。

目录删除按以下步骤生成一个原子提交：

```text
fresh ref -> current commit/tree -> complete recursive tree
          -> leaf sha:null entries -> new commit -> update ref(force:false)
```

若提交成功但快照刷新失败，错误会携带 `applied: true` 和 commit SHA，界面只提示刷新，不重发写请求。

## 预览管线

`PreviewModal` 通过注册表选择按需加载的预览组件。关闭预览、切换文件或切换仓库会中止请求，并通过 epoch 防止旧结果覆盖新结果。图片/视频 URL、PDF render task、observer 和 document task 均在替换或卸载时释放。

PDF、DOCX 与代码预览独立拆包；PDF worker 从本地构建产物加载，不依赖运行时 CDN。

## 配置迁移

V2 使用版本化的 repository、preferences、session token、remembered token 与 migration key。旧配置仅迁移合法 GitHub owner/repo/branch 和 list/grid 偏好；旧 PAT 必须删除或覆盖为非敏感字段，否则阻止初始化并提示用户清理站点数据。

## 错误边界

组件只接收去敏后的 `AppError`。Axios request config、Authorization header 和原始响应不会进入 Toast 或组件状态。限流、认证、权限、冲突、网络、截断 Tree、大小策略及“提交成功但刷新失败”均有稳定错误码。
