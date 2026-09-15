/** 图片保存公共逻辑：远程图片先下载，本地/临时图片直接保存。 */

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'errMsg' in error) {
    return String((error as { errMsg?: string }).errMsg || '')
  }
  return error instanceof Error ? error.message : String(error || '')
}

function ensureAlbumPermission(): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: (setting) => {
        if (setting.authSetting['scope.writePhotosAlbum']) {
          resolve()
          return
        }
        wx.authorize({
          scope: 'scope.writePhotosAlbum',
          success: () => resolve(),
          fail: (error) => reject(new Error(`PHOTO_PERMISSION_DENIED:${errorMessage(error)}`))
        })
      },
      fail: (error) => reject(new Error(`PHOTO_PERMISSION_CHECK_FAILED:${errorMessage(error)}`))
    })
  })
}

function downloadRemoteImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success: (result) => {
        if (result.statusCode >= 200 && result.statusCode < 300 && result.tempFilePath) {
          resolve(result.tempFilePath)
          return
        }
        reject(new Error(`IMAGE_DOWNLOAD_FAILED:HTTP ${result.statusCode}`))
      },
      fail: (error) => reject(new Error(`IMAGE_DOWNLOAD_FAILED:${errorMessage(error)}`))
    })
  })
}

/** 为 image/Canvas 准备本地可用路径；远程 URL 下载后返回 tempFilePath。 */
export async function resolveImageToLocalPath(source: string): Promise<string> {
  if (!source) throw new Error('IMAGE_PATH_EMPTY')
  return /^https?:\/\//i.test(source)
    ? downloadRemoteImage(source)
    : source
}

function saveLocalImage(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(),
      fail: (error) => reject(new Error(`IMAGE_SAVE_FAILED:${errorMessage(error)}`))
    })
  })
}

export async function saveImageToAlbum(source: string): Promise<void> {
  if (!source) throw new Error('IMAGE_PATH_EMPTY')
  await ensureAlbumPermission()
  const filePath = await resolveImageToLocalPath(source)
  await saveLocalImage(filePath)
}

export function isAlbumPermissionError(error: unknown): boolean {
  return /PHOTO_PERMISSION|auth|authorize|deny|permission/i.test(errorMessage(error))
}

export function getImageSaveErrorText(error: unknown): string {
  const message = errorMessage(error)
  if (message.includes('IMAGE_PATH_EMPTY')) return '没有找到需要保存的图片'
  if (message.includes('IMAGE_DOWNLOAD_FAILED')) {
    if (/domain|url not in domain list/i.test(message)) return '图片下载域名未加入小程序 downloadFile 合法域名'
    return `远程图片下载失败：${message.split('IMAGE_DOWNLOAD_FAILED:').pop() || '网络异常'}`
  }
  if (message.includes('PHOTO_PERMISSION_CHECK_FAILED')) return '无法读取相册授权状态，请稍后重试'
  if (message.includes('IMAGE_SAVE_FAILED')) return `保存到相册失败：${message.split('IMAGE_SAVE_FAILED:').pop() || '未知错误'}`
  return '图片保存失败，请稍后重试'
}
