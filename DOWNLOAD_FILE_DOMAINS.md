# 微信小程序 downloadFile 合法域名

真机预览和正式发布前，请在微信公众平台进入：

`开发管理 → 开发设置 → 服务器域名 → downloadFile 合法域名`

根据当前项目的数据来源，需要加入以下 HTTPS 域名：

- `https://static.bjaa.com.cn`：北京画院展览、新闻及作品图片。
- `https://mmbiz.qpic.cn`：微信头像默认图片。
- `https://quanjing.artron.net`：数字展览全景图片来源。

正式启用 `data/api.ts` 中的 `BASE_URL` 后，如果后端直接返回或代理图片，还需要把该后端的 HTTPS origin 加入 `downloadFile` 合法域名。

注意：`project.private.config.json` 中的 `urlCheck: false` 只影响开发者工具，不能绕过真机和正式版的合法域名校验。
