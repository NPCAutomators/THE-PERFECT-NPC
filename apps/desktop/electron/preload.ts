import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('zorinDesktop', {
  getConnection: profile => ipcRenderer.invoke('zorin:connection', profile),
  revalidateConnection: () => ipcRenderer.invoke('zorin:connection:revalidate'),
  touchBackend: profile => ipcRenderer.invoke('zorin:backend:touch', profile),
  getGatewayWsUrl: profile => ipcRenderer.invoke('zorin:gateway:ws-url', profile),
  openSessionWindow: (sessionId, opts) => ipcRenderer.invoke('zorin:window:openSession', sessionId, opts),
  openWindow: () => ipcRenderer.invoke('zorin:window:openInstance'),
  claimAmbientCue: key => ipcRenderer.invoke('zorin:ambient:claim', key),
  petOverlay: {
    // Main renderer → main process: window lifecycle + drag. `request` is
    // `{ bounds, screen }`; resolves with the screen bounds it actually used.
    open: request => ipcRenderer.invoke('zorin:pet-overlay:open', request),
    close: () => ipcRenderer.invoke('zorin:pet-overlay:close'),
    setBounds: bounds => ipcRenderer.send('zorin:pet-overlay:set-bounds', bounds),
    setIgnoreMouse: ignore => ipcRenderer.send('zorin:pet-overlay:ignore-mouse', ignore),
    // Flip the overlay focusable (and focus it) while the composer needs keys.
    setFocusable: focusable => ipcRenderer.send('zorin:pet-overlay:set-focusable', focusable),
    // Main renderer → overlay (forwarded by main): push the latest pet state.
    pushState: payload => ipcRenderer.send('zorin:pet-overlay:state', payload),
    // Overlay → main renderer (forwarded by main): pop back in / composer submit.
    control: payload => ipcRenderer.send('zorin:pet-overlay:control', payload),
    // Overlay subscribes to state pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('zorin:pet-overlay:state', listener)

      return () => ipcRenderer.removeListener('zorin:pet-overlay:state', listener)
    },
    // Main renderer subscribes to overlay control messages.
    onControl: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('zorin:pet-overlay:control', listener)

      return () => ipcRenderer.removeListener('zorin:pet-overlay:control', listener)
    }
  },
  getBootProgress: () => ipcRenderer.invoke('zorin:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('zorin:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('zorin:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('zorin:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('zorin:connection-config:test', payload),
  sshConfigHosts: () => ipcRenderer.invoke('zorin:ssh-config:hosts'),
  sshResolveHost: host => ipcRenderer.invoke('zorin:ssh-config:resolve', host),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('zorin:connection-config:probe', remoteUrl),
  oauthLoginConnectionConfig: remoteUrl => ipcRenderer.invoke('zorin:connection-config:oauth-login', remoteUrl),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('zorin:connection-config:oauth-logout', remoteUrl),
  // Zorin Cloud: one portal login powers discovery + silent per-agent sign-in
  // (cloud-auto-discovery Phase 3).
  cloud: {
    status: () => ipcRenderer.invoke('zorin:cloud:status'),
    login: () => ipcRenderer.invoke('zorin:cloud:login'),
    logout: () => ipcRenderer.invoke('zorin:cloud:logout'),
    discover: org => ipcRenderer.invoke('zorin:cloud:discover', org),
    agentSignIn: dashboardUrl => ipcRenderer.invoke('zorin:cloud:agent-sign-in', dashboardUrl)
  },
  profile: {
    get: () => ipcRenderer.invoke('zorin:profile:get'),
    set: name => ipcRenderer.invoke('zorin:profile:set', name)
  },
  api: request => ipcRenderer.invoke('zorin:api', request),
  notify: payload => ipcRenderer.invoke('zorin:notify', payload),
  requestMicrophoneAccess: () => ipcRenderer.invoke('zorin:requestMicrophoneAccess'),
  readFileDataUrl: filePath => ipcRenderer.invoke('zorin:readFileDataUrl', filePath),
  readFileText: filePath => ipcRenderer.invoke('zorin:readFileText', filePath),
  selectPaths: options => ipcRenderer.invoke('zorin:selectPaths', options),
  writeClipboard: text => ipcRenderer.invoke('zorin:writeClipboard', text),
  saveImageFromUrl: url => ipcRenderer.invoke('zorin:saveImageFromUrl', url),
  saveImageBuffer: (data, ext) => ipcRenderer.invoke('zorin:saveImageBuffer', { data, ext }),
  saveClipboardImage: () => ipcRenderer.invoke('zorin:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('zorin:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('zorin:watchPreviewFile', url),
  stopPreviewFileWatch: id => ipcRenderer.invoke('zorin:stopPreviewFileWatch', id),
  setTitleBarTheme: payload => ipcRenderer.send('zorin:titlebar-theme', payload),
  setNativeTheme: mode => ipcRenderer.send('zorin:native-theme', mode),
  setTranslucency: payload => ipcRenderer.send('zorin:translucency', payload),
  setKeepAwake: on => ipcRenderer.send('zorin:keep-awake', on),
  setPreviewShortcutActive: active => ipcRenderer.send('zorin:previewShortcutActive', Boolean(active)),
  openExternal: url => ipcRenderer.invoke('zorin:openExternal', url),
  openPreviewInBrowser: url => ipcRenderer.invoke('zorin:openPreviewInBrowser', url),
  fetchLinkTitle: url => ipcRenderer.invoke('zorin:fetchLinkTitle', url),
  sanitizeWorkspaceCwd: cwd => ipcRenderer.invoke('zorin:workspace:sanitize', cwd),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('zorin:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('zorin:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('zorin:setting:defaultProjectDir:pick')
  },
  zoom: {
    // Current zoom of this window, as { level, percent }.
    get: () => ipcRenderer.invoke('zorin:zoom:get'),
    setPercent: percent => ipcRenderer.send('zorin:zoom:set-percent', percent),
    // Fires on every zoom change, including the Ctrl/Cmd +/-/0 shortcuts,
    // so the settings UI can stay in sync with the keyboard.
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('zorin:zoom:changed', listener)

      return () => ipcRenderer.removeListener('zorin:zoom:changed', listener)
    }
  },
  revealLogs: () => ipcRenderer.invoke('zorin:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('zorin:logs:recent'),
  readDir: dirPath => ipcRenderer.invoke('zorin:fs:readDir', dirPath),
  gitRoot: startPath => ipcRenderer.invoke('zorin:fs:gitRoot', startPath),
  revealPath: targetPath => ipcRenderer.invoke('zorin:fs:reveal', targetPath),
  openDir: dirPath => ipcRenderer.invoke('zorin:fs:openDir', dirPath),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('zorin:fs:rename', targetPath, newName),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('zorin:fs:writeText', filePath, content),
  trashPath: targetPath => ipcRenderer.invoke('zorin:fs:trash', targetPath),
  git: {
    worktreeList: repoPath => ipcRenderer.invoke('zorin:git:worktreeList', repoPath),
    worktreeAdd: (repoPath, options) => ipcRenderer.invoke('zorin:git:worktreeAdd', repoPath, options),
    worktreeRemove: (repoPath, worktreePath, options) =>
      ipcRenderer.invoke('zorin:git:worktreeRemove', repoPath, worktreePath, options),
    branchSwitch: (repoPath, branch) => ipcRenderer.invoke('zorin:git:branchSwitch', repoPath, branch),
    branchList: repoPath => ipcRenderer.invoke('zorin:git:branchList', repoPath),
    baseBranchList: repoPath => ipcRenderer.invoke('zorin:git:baseBranchList', repoPath),
    repoStatus: repoPath => ipcRenderer.invoke('zorin:git:repoStatus', repoPath),
    fileDiff: (repoPath, filePath) => ipcRenderer.invoke('zorin:git:fileDiff', repoPath, filePath),
    scanRepos: (roots, options) => ipcRenderer.invoke('zorin:git:scanRepos', roots, options),
    review: {
      list: (repoPath, scope, baseRef) => ipcRenderer.invoke('zorin:git:review:list', repoPath, scope, baseRef),
      diff: (repoPath, filePath, scope, baseRef, staged) =>
        ipcRenderer.invoke('zorin:git:review:diff', repoPath, filePath, scope, baseRef, staged),
      stage: (repoPath, filePath) => ipcRenderer.invoke('zorin:git:review:stage', repoPath, filePath),
      unstage: (repoPath, filePath) => ipcRenderer.invoke('zorin:git:review:unstage', repoPath, filePath),
      revert: (repoPath, filePath) => ipcRenderer.invoke('zorin:git:review:revert', repoPath, filePath),
      revParse: (repoPath, ref) => ipcRenderer.invoke('zorin:git:review:revParse', repoPath, ref),
      commit: (repoPath, message, push) => ipcRenderer.invoke('zorin:git:review:commit', repoPath, message, push),
      commitContext: repoPath => ipcRenderer.invoke('zorin:git:review:commitContext', repoPath),
      push: repoPath => ipcRenderer.invoke('zorin:git:review:push', repoPath),
      shipInfo: repoPath => ipcRenderer.invoke('zorin:git:review:shipInfo', repoPath),
      createPr: repoPath => ipcRenderer.invoke('zorin:git:review:createPr', repoPath)
    }
  },
  terminal: {
    cwd: id => ipcRenderer.invoke('zorin:terminal:cwd', id),
    dispose: id => ipcRenderer.invoke('zorin:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('zorin:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('zorin:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('zorin:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `zorin:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `zorin:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('zorin:close-preview-requested', listener)

    return () => ipcRenderer.removeListener('zorin:close-preview-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('zorin:open-updates', listener)

    return () => ipcRenderer.removeListener('zorin:open-updates', listener)
  },
  onDeepLink: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('zorin:deep-link', listener)

    return () => ipcRenderer.removeListener('zorin:deep-link', listener)
  },
  signalDeepLinkReady: () => ipcRenderer.invoke('zorin:deep-link-ready'),
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('zorin:window-state-changed', listener)

    return () => ipcRenderer.removeListener('zorin:window-state-changed', listener)
  },
  onFocusSession: callback => {
    const listener = (_event, sessionId) => callback(sessionId)
    ipcRenderer.on('zorin:focus-session', listener)

    return () => ipcRenderer.removeListener('zorin:focus-session', listener)
  },
  onNotificationAction: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('zorin:notification-action', listener)

    return () => ipcRenderer.removeListener('zorin:notification-action', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('zorin:preview-file-changed', listener)

    return () => ipcRenderer.removeListener('zorin:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('zorin:backend-exit', listener)

    return () => ipcRenderer.removeListener('zorin:backend-exit', listener)
  },
  // Soft gateway-mode apply finished tearing down the primary backend. Renderer
  // should wipe session lists + re-dial without a window reload.
  onConnectionApplied: callback => {
    const listener = () => callback()
    ipcRenderer.on('zorin:connection:applied', listener)

    return () => ipcRenderer.removeListener('zorin:connection:applied', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('zorin:power-resume', listener)

    return () => ipcRenderer.removeListener('zorin:power-resume', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('zorin:boot-progress', listener)

    return () => ipcRenderer.removeListener('zorin:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.ts (apps/desktop/electron/bootstrap-runner.ts).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('zorin:bootstrap:get'),
  resetBootstrap: () => ipcRenderer.invoke('zorin:bootstrap:reset'),
  repairBootstrap: () => ipcRenderer.invoke('zorin:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('zorin:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('zorin:bootstrap:event', listener)

    return () => ipcRenderer.removeListener('zorin:bootstrap:event', listener)
  },
  getVersion: () => ipcRenderer.invoke('zorin:version'),
  getRemoteDisplayReason: () => ipcRenderer.invoke('zorin:get-remote-display-reason'),
  uninstall: {
    summary: () => ipcRenderer.invoke('zorin:uninstall:summary'),
    run: mode => ipcRenderer.invoke('zorin:uninstall:run', { mode })
  },
  updates: {
    check: () => ipcRenderer.invoke('zorin:updates:check'),
    apply: opts => ipcRenderer.invoke('zorin:updates:apply', opts),
    getBranch: () => ipcRenderer.invoke('zorin:updates:branch:get'),
    setBranch: name => ipcRenderer.invoke('zorin:updates:branch:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('zorin:updates:progress', listener)

      return () => ipcRenderer.removeListener('zorin:updates:progress', listener)
    }
  },
  themes: {
    fetchMarketplace: id => ipcRenderer.invoke('zorin:vscode-theme:fetch', id),
    searchMarketplace: query => ipcRenderer.invoke('zorin:vscode-theme:search', query)
  }
})
