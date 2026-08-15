import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import type { NewJob } from './queue'
import type { Settings } from '../shared/types'
import {
  downloadFfmpeg,
  downloadYtdlp,
  getBinaryStatus,
  openEngineFolder,
  resetEngine,
  updateYtdlp
} from './binaries'
import { clearHistory, getHistory, removeEntry, withExistence } from './history'
import { cleanup as tempCleanup, preview as tempPreview } from './services/TempManager'
import * as queue from './queue'
import { getSettings, saveSettings } from './settings'
import { probe, probeSingle } from './ytdlp'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
/** Chi thoat that su khi nguoi dung chon Thoat, khong phai khi dong cua so. */
let quitting = false

function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'build', 'icon.png')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: '#0d0f13',
    autoHideMenuBar: true,
    title: 'VidGrab',
    icon: existsSync(iconPath()) ? iconPath() : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.on('close', (e) => {
    if (!quitting && getSettings().minimizeToTray) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  // Link ngoai (kenh nguoi dang, trang goc...) mo bang trinh duyet he thong,
  // khong bao gio mo trong cua so app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showWindow(): void {
  if (!mainWindow) return createWindow()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function setupTray(enabled: boolean): void {
  if (!enabled) {
    tray?.destroy()
    tray = null
    return
  }
  if (tray) return
  const image = existsSync(iconPath())
    ? nativeImage.createFromPath(iconPath()).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty()
  tray = new Tray(image)
  tray.setToolTip('VidGrab')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Mở VidGrab', click: showWindow },
      { type: 'separator' },
      {
        label: 'Thoát',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', showWindow)
}

// Chi cho phep mot phien ban chay; mo lan hai se dua cua so cu len truoc.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showWindow)

  app.whenReady().then(() => {
    createWindow()
    setupTray(getSettings().minimizeToTray)

    queue.onQueueChange((jobs) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('queue:update', jobs)
      }
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (getSettings().minimizeToTray) return
  queue.shutdown()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  quitting = true
  queue.shutdown()
})

/* ------------------------------- IPC ------------------------------- */

ipcMain.handle('analyze', async (_e, urls: string[]) => {
  // Phan tich song song theo lo, tranh mo hang chuc tien trinh cung luc.
  const results: Awaited<ReturnType<typeof probe>>[] = []
  const batchSize = 3
  for (let i = 0; i < urls.length; i += batchSize) {
    results.push(...(await Promise.all(urls.slice(i, i + batchSize).map(probe))))
  }
  return results
})

ipcMain.handle('analyze:single', (_e, url: string) => probeSingle(url))

ipcMain.handle('download', (_e, items: NewJob[], startNow: boolean) =>
  queue.enqueue(items, startNow)
)

ipcMain.handle('queue:list', () => queue.getJobs())
ipcMain.handle('queue:cancel', (_e, id: string) => queue.cancel(id))
ipcMain.handle('queue:pause', (_e, id: string) => queue.pause(id))
ipcMain.handle('queue:resume', (_e, id: string) => queue.resume(id))
ipcMain.handle('queue:retry', (_e, id: string) => queue.retry(id))
ipcMain.handle('queue:remove', (_e, id: string) => queue.remove(id))
ipcMain.handle('queue:pauseAll', () => queue.pauseAll())
ipcMain.handle('queue:resumeAll', () => queue.resumeAll())
ipcMain.handle('queue:cancelAll', () => queue.cancelAll())
ipcMain.handle('queue:retryAllFailed', () => queue.retryAllFailed())
ipcMain.handle('queue:clearFinished', () => queue.clearFinished())

ipcMain.handle('history:list', () => withExistence(getHistory()))
ipcMain.handle('history:remove', (_e, id: string) => removeEntry(id))
ipcMain.handle('history:clear', () => clearHistory())

ipcMain.handle('settings:get', () => getSettings())
ipcMain.handle('settings:save', (_e, patch: Partial<Settings>) => {
  const next = saveSettings(patch)
  if ('minimizeToTray' in patch) setupTray(next.minimizeToTray)
  if ('launchAtStartup' in patch) {
    app.setLoginItemSettings({ openAtLogin: next.launchAtStartup, args: ['--hidden'] })
  }
  return next
})

ipcMain.handle('settings:chooseFolder', async () => {
  if (!mainWindow) return null
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Chọn thư mục lưu video'
  })
  return res.canceled ? null : res.filePaths[0]
})

ipcMain.handle('settings:chooseFfmpeg', async () => {
  if (!mainWindow) return null
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Chọn ffmpeg.exe',
    filters: [{ name: 'ffmpeg', extensions: ['exe'] }]
  })
  return res.canceled ? null : res.filePaths[0]
})

ipcMain.handle('settings:chooseCookieFile', async () => {
  if (!mainWindow) return null
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Chọn file cookies.txt',
    filters: [{ name: 'Cookie (Netscape)', extensions: ['txt'] }]
  })
  return res.canceled ? null : res.filePaths[0]
})

ipcMain.handle('dialog:openUrlFile', async () => {
  if (!mainWindow) return null
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Chọn file .txt chứa danh sách link',
    filters: [{ name: 'Danh sách link', extensions: ['txt'] }]
  })
  if (res.canceled) return null
  try {
    const { readFileSync } = await import('fs')
    return readFileSync(res.filePaths[0], 'utf-8')
  } catch {
    return null
  }
})

ipcMain.handle('shell:openFolder', (_e, filePath: string) => {
  if (filePath && existsSync(filePath)) shell.showItemInFolder(filePath)
  else void shell.openPath(getSettings().outputDir)
})

ipcMain.handle('shell:openFile', (_e, filePath: string) => {
  if (filePath && existsSync(filePath)) return shell.openPath(filePath)
  return 'Không tìm thấy file'
})

ipcMain.handle('shell:openExternal', (_e, url: string) => {
  // Chi mo http/https — chan cac scheme co the chay lenh tren may.
  if (/^https?:\/\//i.test(url)) return shell.openExternal(url)
  return null
})

ipcMain.handle('temp:preview', () => {
  const plan = tempPreview(getSettings().outputDir, queue.getProtectedPrefixes())
  return { count: plan.remove.length, bytes: plan.bytes, names: plan.remove.map((f) => f.name) }
})

ipcMain.handle('temp:cleanup', () =>
  tempCleanup(getSettings().outputDir, queue.getProtectedPrefixes())
)

ipcMain.handle('engine:status', () => getBinaryStatus())
ipcMain.handle('engine:openFolder', () => openEngineFolder())
ipcMain.handle('engine:reset', async () => {
  resetEngine()
  return getBinaryStatus()
})

function engineTask(task: () => Promise<unknown>) {
  return async (): Promise<ReturnType<typeof getBinaryStatus>> => {
    const send = (p: unknown): void => {
      mainWindow?.webContents.send('engine:progress', p)
    }
    try {
      await task()
      return await getBinaryStatus()
    } catch (err) {
      send({ stage: 'error', percent: 0, message: (err as Error).message })
      throw err
    }
  }
}

ipcMain.handle('engine:installYtdlp', () =>
  engineTask(() => downloadYtdlp((p) => mainWindow?.webContents.send('engine:progress', p)))()
)
ipcMain.handle('engine:updateYtdlp', () =>
  engineTask(() => updateYtdlp((p) => mainWindow?.webContents.send('engine:progress', p)))()
)
ipcMain.handle('engine:installFfmpeg', () =>
  engineTask(() => downloadFfmpeg((p) => mainWindow?.webContents.send('engine:progress', p)))()
)

ipcMain.handle('app:version', () => app.getVersion())
