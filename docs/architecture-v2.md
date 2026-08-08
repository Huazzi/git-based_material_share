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

一个 provider 只拥有一个 `MutationQueue`。上传、建目录、删除文件和删除目录都在队列内重新读取必要的远端状态。失败任务不会阻塞后续任务，网络失败或超时不会触发自动重试。写请求在没有收到响应时进入“结果不确定”状态，原命令会被关闭并要求刷新核验。

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

V2 使用版本化的 repository、preferences、session token、remembered token 与 migration key。仓库与令牌以可回滚事务写入，全部成功后才切换活动 provider。旧配置仅迁移合法 GitHub owner/repo/branch 和 list/grid 偏好；每次启动都会再次清理可能由回滚版本产生的旧 PAT，删除或覆盖失败时阻止初始化。

## 错误边界

组件只接收去敏后的 `AppError`。Axios request config、Authorization header 和原始响应不会进入 Toast 或组件状态。限流、认证、权限、冲突、网络、截断 Tree、大小策略及“提交成功但刷新失败”均有稳定错误码。

## 批量上传

`BatchUploadPlanner` 在界面确认和 provider 写入前使用同一套纯函数规则校验文件数、单文件/总大小、远端冲突和批次内重名。每个冲突必须明确选择重命名、覆盖或跳过；批次内后续重名只能重命名或跳过。

provider 在唯一的 `MutationQueue` 中重新读取最新 ref/commit/tree，并用审批时的计划指纹重新校验。通过后按顺序创建 blob，再用 `base_tree` 创建一个 tree 和一个 commit，最后以 `force:false` 更新分支。只有 ref 更新被标记为分支 mutation；在此之前失败不会改变分支。

## 批量 ZIP 下载

选择状态只属于当前视图。列表/网格切换会保留选择，导航、搜索、刷新或切换仓库会清空选择。

`BatchDownloadPlanner` 在当前 `RepositorySnapshot` 上展开目录，去重重叠选择，保留目录层级和空目录，并排除 `.gitkeep`、元数据文件、symlink 与 submodule。所有文件读取都显式携带计划捕获的 commit SHA；网络并发上限为 3，ZIP 条目按稳定路径顺序写入，任一失败会取消其余请求且不提交最终文件。

ZIP 输出优先使用 File System Access API 的 writable stream，允许最多 500 MiB 的批量策略；没有 writable stream 时回退到 Zip.js `BlobWriter`，回退上限为 200 MiB。取消或失败会中止 writable stream；Blob 回退只在完整归档成功后触发浏览器下载。
