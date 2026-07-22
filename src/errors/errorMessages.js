const MESSAGES = {
  AUTH_REQUIRED: '需要配置 Personal Access Token 才能执行写操作。',
  AUTH_INVALID: 'Personal Access Token 无效，请重新输入。',
  PERMISSION_DENIED: '当前令牌没有执行此操作的权限。',
  REPOSITORY_NOT_FOUND_OR_PRIVATE: '仓库不存在，或该私有仓库需要访问令牌。',
  RESOURCE_NOT_FOUND: '请求的仓库资源不存在。',
  RATE_LIMITED: 'GitHub API 请求额度已用尽，请稍后重试。',
  SECONDARY_RATE_LIMITED: 'GitHub 暂时限制了请求频率，请稍后重试。',
  GIT_CONFLICT: '远端分支已经变化，请刷新后重新确认操作。',
  VALIDATION_FAILED: 'GitHub 拒绝了该操作，请检查输入或刷新后重试。',
  TREE_TRUNCATED: '仓库文件树超过 V2 支持范围，已停止加载以避免显示不完整数据。',
  EMPTY_REPOSITORY_UNSUPPORTED: '目标分支尚无初始提交，请先在 GitHub 创建一个文件。',
  UPLOAD_TOO_LARGE: '文件超过 25 MiB，无法上传。',
  PREVIEW_TOO_LARGE: '文件超过 25 MiB，只能下载。',
  DOWNLOAD_TOO_LARGE: '文件超过 100 MiB，GitHub Contents API 不支持下载。',
  NETWORK_ERROR: '网络连接失败，请检查连接后重试。',
  GITHUB_UNAVAILABLE: 'GitHub 服务暂时不可用，请稍后重试。',
  MUTATION_RESULT_UNKNOWN: '写操作已发送，但无法确认 GitHub 是否已提交。已停止重试，请刷新并核对仓库。',
  MUTATION_APPLIED_REFRESH_FAILED: '操作已提交，但文件列表刷新失败。请手动刷新。',
  DOWNLOAD_IN_PROGRESS: '已有文件正在下载，请等待完成或取消后重试。',
  CONFIG_STORAGE_BLOCKED: '无法安全清除旧令牌。请清除此站点数据，并在 GitHub 撤销旧令牌。',
  CONFIG_STORAGE_UNAVAILABLE: '浏览器存储不可用，无法保存仓库配置。',
  SESSION_CHANGED: '仓库会话已经切换，请重新执行操作。',
  SESSION_BUSY: '仓库写操作进行中，暂时不能切换或重置仓库。',
  UNKNOWN: '发生未知错误，请重试。',
};

export function getErrorMessage(error) {
  return MESSAGES[error?.code] || error?.message || MESSAGES.UNKNOWN;
}
