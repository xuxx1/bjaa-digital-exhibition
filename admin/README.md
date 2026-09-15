# 北京画院内容管理后台

这是与当前小程序 dataset 配套的本地内容管理后台，不依赖云开发或测试 AppID 权限。

## 启动

在 PowerShell 中运行：

```powershell
.\admin\start-admin.ps1
```

浏览器访问 `http://127.0.0.1:8787`。

## 数据安全

- 后台直接读取项目 `dataset` 下的 JSON 数据。
- 每次保存、新增或删除前，原文件会复制到 `admin/backups`。
- `admin/content.db` 仅保存操作审计记录。
- “生成小程序数据包”会输出到 `admin/exports/miniprogram-content.json`。
