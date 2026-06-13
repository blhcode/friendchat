import { addUser, listUsers, removeUser } from './admin/users'
import { downloadFile, formatFileSize } from './chat/payload'
import { login } from './auth/login'
import {
  captureBootstrapTokenFromUrl,
  clearSession,
  getReadToken,
  getRepoConfig,
  restoreSession,
  setReadToken,
  setRepoConfig,
} from './auth/session'
import { loadAppConfig, isLocalMode } from './config'
import { createChatController, formatTimestamp, type ChatController } from './chat/ui'
import { isSetupComplete, runSetup } from './setup/wizard'
import { seedFromConfig } from './setup/seed'
import { getStorageLabel } from './storage'
import { getTheme, themeToggleLabel, toggleTheme } from './theme'
import type { ChatMessage } from './chat/ui'
import type { Session, UserRecord } from './types'

type View = 'loading' | 'setup' | 'login' | 'chat' | 'admin'

let chatController: ChatController | null = null

const SELECTED_CONTACT_KEY = 'chat_selected_contact'

export async function initApp(root: HTMLElement): Promise<void> {
  captureBootstrapTokenFromUrl()
  await render(root, 'loading')

  const appConfig = await loadAppConfig()

  if (isLocalMode()) {
    await seedFromConfig(appConfig)
    const session = await restoreSession()
    if (session) {
      await render(root, 'chat', session)
      return
    }
    await render(root, 'login')
    return
  }

  // GitHub mode: use config.json if provided, otherwise localStorage + wizard
  if (appConfig.github?.owner && appConfig.github?.repo) {
    setRepoConfig({
      owner: appConfig.github.owner.trim(),
      repo: appConfig.github.repo.trim(),
    })
  }
  if (appConfig.github?.pat?.trim()) {
    setReadToken(appConfig.github.pat.trim())
  }

  if (appConfig.admin.username && appConfig.admin.password) {
    await seedFromConfig(appConfig)
  }

  const config = getRepoConfig()
  const readToken = getReadToken()

  if (!config) {
    await render(root, 'setup')
    return
  }

  if (readToken) {
    const setupDone = await isSetupComplete(config, readToken)
    if (!setupDone) {
      await render(root, 'setup')
      return
    }
  }

  const session = await restoreSession()
  if (session) {
    await render(root, 'chat', session)
    return
  }

  await render(root, 'login')
}

async function render(root: HTMLElement, view: View, session?: Session): Promise<void> {
  if (chatController) {
    chatController.stop()
    chatController = null
  }

  root.innerHTML = ''

  switch (view) {
    case 'loading':
      root.innerHTML = '<div class="center"><p class="muted">Loading…</p></div>'
      break
    case 'setup':
      renderSetup(root)
      break
    case 'login':
      renderLogin(root)
      break
    case 'chat':
      if (session) await renderChat(root, session)
      break
    case 'admin':
      if (session) await renderAdmin(root, session)
      break
  }
}

function modeBanner(): string {
  if (!isLocalMode()) return ''
  return '<p class="mode-banner">Local test mode — data saved to <code>data/</code> folder</p>'
}

function themeToggleButton(): string {
  return `<button type="button" id="theme-btn" class="link-btn" title="Toggle theme">${themeToggleLabel(getTheme())}</button>`
}

function bindThemeToggle(root: HTMLElement): void {
  root.querySelector('#theme-btn')?.addEventListener('click', () => {
    const next = toggleTheme()
    const btn = root.querySelector<HTMLButtonElement>('#theme-btn')
    if (btn) btn.textContent = themeToggleLabel(next)
  })
}

function renderMessageContent(m: ChatMessage): string {
  if (m.type === 'file' && m.file) {
    const size = formatFileSize(m.file.size)
    return `
      <div class="file-message">
        <span class="file-icon" aria-hidden="true">📎</span>
        <div class="file-info">
          <span class="file-name">${escapeHtml(m.file.name)}</span>
          <span class="file-size">${size}</span>
        </div>
        <button type="button" class="file-download" data-msg-id="${escapeHtml(m.id)}">Download</button>
      </div>
    `
  }
  return `<div class="message-text">${escapeHtml(m.text ?? '')}</div>`
}

function renderSetup(root: HTMLElement): void {
  root.innerHTML = `
    <div class="card setup-card">
      <h1>Friends Chat Setup</h1>
      <p class="muted">One-time setup for your private GitHub repo. Or copy <code>config.example.json</code> to <code>config.json</code> and set <code>"mode": "local"</code> to test without GitHub.</p>
      <p><button type="button" id="goto-login" class="link-btn">Already set up? Log in</button></p>
      <div class="card-actions">${themeToggleButton()}</div>
      <form id="setup-form" class="form">
        <label>GitHub username (owner)
          <input name="owner" required autocomplete="username" />
        </label>
        <label>Repository name
          <input name="repo" required placeholder="Friends-Chat-Online" />
        </label>
        <label>GitHub PAT (Contents read &amp; write)
          <input name="apiToken" type="password" required autocomplete="off" />
        </label>
        <label>Admin username
          <input name="adminUsername" required autocomplete="username" />
        </label>
        <label>Admin password
          <input name="adminPassword" type="password" required minlength="8" autocomplete="new-password" />
        </label>
        <button type="submit">Complete setup</button>
        <p id="setup-error" class="error" hidden></p>
      </form>
    </div>
  `

  const form = root.querySelector<HTMLFormElement>('#setup-form')!
  const errorEl = root.querySelector<HTMLElement>('#setup-error')!

  bindThemeToggle(root)

  root.querySelector('#goto-login')?.addEventListener('click', async () => {
    await render(root, 'login')
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errorEl.hidden = true
    const data = new FormData(form)
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    button.disabled = true
    button.textContent = 'Setting up…'

    try {
      await runSetup({
        owner: String(data.get('owner')),
        repo: String(data.get('repo')),
        apiToken: String(data.get('apiToken')),
        adminUsername: String(data.get('adminUsername')),
        adminPassword: String(data.get('adminPassword')),
      })
      const session = await login(
        getReadToken() ?? undefined,
        String(data.get('adminUsername')),
        String(data.get('adminPassword')),
      )
      await render(root, 'chat', session)
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : 'Setup failed.'
      errorEl.hidden = false
      button.disabled = false
      button.textContent = 'Complete setup'
    }
  })
}

function renderLogin(root: HTMLElement): void {
  const local = isLocalMode()
  const hasReadToken = Boolean(getReadToken())
  const hasConfig = Boolean(getRepoConfig())

  root.innerHTML = `
    <div class="card login-card">
      <h1>Friends Chat</h1>
      ${modeBanner()}
      <p class="muted">End-to-end encrypted chat (${getStorageLabel()} mode).</p>
      ${local ? '<p class="hint">Login with the username and password from your <code>config.json</code> file.</p>' : ''}
      ${!local && !hasConfig ? '<p><button type="button" id="goto-setup" class="link-btn">First time? Run setup</button></p>' : ''}
      <div class="card-actions">${themeToggleButton()}</div>
      <form id="login-form" class="form">
        ${!local && !hasConfig ? `
        <label>GitHub username (owner)
          <input name="owner" required autocomplete="username" />
        </label>
        <label>Repository name
          <input name="repo" required />
        </label>
        ` : ''}
        ${!local && !hasReadToken ? `
        <label>Site access token (ask admin)
          <input name="readToken" type="password" required autocomplete="off" />
          <span class="hint">One-time per browser. Admin can share: <code>?bootstrap=TOKEN</code></span>
        </label>
        ` : ''}
        <label>Username
          <input name="username" required autocomplete="username" />
        </label>
        <label>Password
          <input name="password" type="password" required autocomplete="current-password" />
        </label>
        <button type="submit">Log in</button>
        <p id="login-error" class="error" hidden></p>
      </form>
    </div>
  `

  const form = root.querySelector<HTMLFormElement>('#login-form')!
  const errorEl = root.querySelector<HTMLElement>('#login-error')!

  bindThemeToggle(root)

  root.querySelector('#goto-setup')?.addEventListener('click', async () => {
    await render(root, 'setup')
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errorEl.hidden = true
    const data = new FormData(form)
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    button.disabled = true

    try {
      if (!isLocalMode()) {
        let config = getRepoConfig()
        if (!config) {
          config = {
            owner: String(data.get('owner')).trim(),
            repo: String(data.get('repo')).trim(),
          }
          setRepoConfig(config)
        }

        let readToken = getReadToken()
        if (!readToken) {
          readToken = String(data.get('readToken')).trim()
          if (!readToken) throw new Error('Site access token is required.')
          setReadToken(readToken)
        }
      }

      const session = await login(
        getReadToken() ?? undefined,
        String(data.get('username')),
        String(data.get('password')),
      )
      await render(root, 'chat', session)
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : 'Login failed.'
      errorEl.hidden = false
      button.disabled = false
    }
  })
}

async function renderChat(root: HTMLElement, session: Session): Promise<void> {
  const adminLink =
    session.role === 'admin'
      ? '<button type="button" id="admin-btn" class="link-btn">Admin</button>'
      : ''

  let contacts: UserRecord[] = []
  try {
    const allUsers = await listUsers(session)
    contacts = allUsers.filter(
      (u) => u.username.toLowerCase() !== session.username.toLowerCase(),
    )
  } catch {
    contacts = []
  }

  const stored = sessionStorage.getItem(SELECTED_CONTACT_KEY)
  const selected =
    contacts.find((u) => u.username.toLowerCase() === stored?.toLowerCase())?.username ??
    contacts[0]?.username ??
    null

  if (selected) {
    sessionStorage.setItem(SELECTED_CONTACT_KEY, selected)
  }

  const contactListHtml =
    contacts.length === 0
      ? '<p class="contacts-empty muted">No other users yet. Ask an admin to add friends.</p>'
      : contacts
          .map(
            (u) => `
        <button type="button" class="contact-btn ${u.username === selected ? 'active' : ''}" data-contact="${escapeHtml(u.username)}">
          <span class="contact-name">${escapeHtml(u.username)}</span>
          <span class="contact-hint">Private chat</span>
        </button>
      `,
          )
          .join('')

  root.innerHTML = `
    <div class="chat-shell">
      <aside class="contacts-sidebar">
        <div class="contacts-header">
          <h2>Messages</h2>
          <p class="muted">Logged in as ${escapeHtml(session.username)}</p>
          ${modeBanner()}
        </div>
        <div class="contacts-list">${contactListHtml}</div>
        <div class="contacts-footer">
          ${themeToggleButton()}
          ${adminLink}
          <button type="button" id="logout-btn" class="link-btn">Log out</button>
        </div>
      </aside>
      <div class="chat-main">
        ${
          selected
            ? `
        <header class="chat-header">
          <div>
            <h1>${escapeHtml(selected)}</h1>
            <p class="muted">End-to-end encrypted private chat</p>
          </div>
        </header>
        <div id="message-list" class="message-list"></div>
        <p id="chat-error" class="error chat-error" hidden></p>
        <form id="chat-form" class="chat-form">
          <label class="file-btn" title="Attach file (max 512 KB)">
            <input type="file" id="file-input" hidden />
            📎
          </label>
          <input name="message" placeholder="Message ${escapeHtml(selected)}…" autocomplete="off" />
          <button type="submit">Send</button>
        </form>
        `
            : `
        <div class="chat-empty">
          <h1>Friends Chat</h1>
          <p class="muted">Select a contact to start a private conversation.</p>
        </div>
        `
        }
      </div>
    </div>
  `

  bindThemeToggle(root)

  root.querySelectorAll<HTMLButtonElement>('.contact-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const contact = btn.dataset.contact
      if (!contact || contact === selected) return
      sessionStorage.setItem(SELECTED_CONTACT_KEY, contact)
      await renderChat(root, session)
    })
  })

  root.querySelector('#logout-btn')?.addEventListener('click', async () => {
    clearSession()
    sessionStorage.removeItem(SELECTED_CONTACT_KEY)
    await render(root, 'login')
  })

  root.querySelector('#admin-btn')?.addEventListener('click', async () => {
    await render(root, 'admin', session)
  })

  if (!selected) return

  const messageList = root.querySelector<HTMLElement>('#message-list')!
  const form = root.querySelector<HTMLFormElement>('#chat-form')!
  const errorEl = root.querySelector<HTMLElement>('#chat-error')!
  const input = form.querySelector<HTMLInputElement>('input[name="message"]')!
  const fileInput = root.querySelector<HTMLInputElement>('#file-input')!
  let latestMessages: ChatMessage[] = []

  const showMessages = (messages: ChatMessage[]) => {
    latestMessages = messages
    messageList.innerHTML = messages
      .map(
        (m) => `
        <div class="message ${m.sender === session.username ? 'own' : ''}" data-id="${escapeHtml(m.id)}">
          <div class="message-meta">
            <span class="sender">${escapeHtml(m.sender)}</span>
            <span class="time">${formatTimestamp(m.timestamp)}</span>
          </div>
          ${renderMessageContent(m)}
        </div>
      `,
      )
      .join('')
    messageList.scrollTop = messageList.scrollHeight
  }

  messageList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.classList.contains('file-download')) return
    const msgId = target.dataset.msgId
    const msg = latestMessages.find((m) => m.id === msgId)
    if (msg?.type === 'file' && msg.file) {
      downloadFile(msg.file.name, msg.file.mime, msg.file.data)
    }
  })

  chatController = createChatController(session, selected, showMessages, (msg) => {
    errorEl.textContent = msg
    errorEl.hidden = false
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const text = input.value
    if (!text.trim()) return
    input.value = ''
    input.disabled = true
    try {
      await chatController!.send(text)
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : 'Failed to send.'
      errorEl.hidden = false
    } finally {
      input.disabled = false
      input.focus()
    }
  })

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (!file) return
    errorEl.hidden = true
    try {
      await chatController!.sendFile(file)
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : 'Failed to send file.'
      errorEl.hidden = false
    }
  })
}

async function renderAdmin(root: HTMLElement, session: Session): Promise<void> {
  let users: UserRecord[] = []

  root.innerHTML = `
    <div class="card admin-card">
      <header class="admin-header">
        <h1>Admin Panel</h1>
        <div class="header-actions">
          ${themeToggleButton()}
          <button type="button" id="back-btn" class="link-btn">Back to chat</button>
        </div>
      </header>
      <section>
        <h2>Add user</h2>
        <form id="add-user-form" class="form">
          <label>Username
            <input name="username" required autocomplete="off" />
          </label>
          <label>Password
            <input name="password" type="password" required minlength="8" autocomplete="new-password" />
          </label>
          <button type="submit">Add user</button>
        </form>
        <p id="admin-error" class="error" hidden></p>
        <p id="admin-success" class="success" hidden></p>
      </section>
      <section>
        <h2>Users</h2>
        <ul id="user-list" class="user-list"><li class="muted">Loading…</li></ul>
      </section>
    </div>
  `

  const userList = root.querySelector<HTMLElement>('#user-list')!
  const form = root.querySelector<HTMLFormElement>('#add-user-form')!
  const errorEl = root.querySelector<HTMLElement>('#admin-error')!
  const successEl = root.querySelector<HTMLElement>('#admin-success')!

  const refreshUsers = async () => {
    users = await listUsers(session)
    userList.innerHTML = users
      .map((u) => {
        const isSelf = u.username.toLowerCase() === session.username.toLowerCase()
        const removeBtn = isSelf
          ? ''
          : `<button type="button" class="remove-user link-btn" data-username="${escapeHtml(u.username)}">Remove</button>`
        return `
        <li>
          <span class="user-name">${escapeHtml(u.username)}</span>
          <span class="user-actions">
            <span class="badge ${u.role}">${u.role}</span>
            ${removeBtn}
          </span>
        </li>
      `
      })
      .join('')
  }

  bindThemeToggle(root)

  try {
    await refreshUsers()
  } catch (err) {
    userList.innerHTML = `<li class="error">${escapeHtml(err instanceof Error ? err.message : 'Failed to load users')}</li>`
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errorEl.hidden = true
    successEl.hidden = true
    const data = new FormData(form)
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    button.disabled = true

    try {
      await addUser(
        session,
        {
          username: String(data.get('username')),
          password: String(data.get('password')),
        },
        session.roomKey,
      )
      form.reset()
      successEl.textContent = 'User added successfully.'
      successEl.hidden = false
      await refreshUsers()
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : 'Failed to add user.'
      errorEl.hidden = false
    } finally {
      button.disabled = false
    }
  })

  userList.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement
    if (!target.classList.contains('remove-user')) return
    const username = target.dataset.username
    if (!username) return
    if (!confirm(`Remove user "${username}"? They will no longer be able to log in.`)) return

    errorEl.hidden = true
    successEl.hidden = true
    try {
      await removeUser(session, username)
      successEl.textContent = `Removed ${username}.`
      successEl.hidden = false
      await refreshUsers()
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : 'Failed to remove user.'
      errorEl.hidden = false
    }
  })

  root.querySelector('#back-btn')?.addEventListener('click', async () => {
    await render(root, 'chat', session)
  })
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
