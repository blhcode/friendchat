import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, Connect } from 'vite'
import { createHash } from 'node:crypto'

const DATA_DIR = path.resolve('data')
const CONFIG_PATH = path.resolve('config.json')

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function fileSha(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function readDataFile(name: string): { data: unknown; sha: string } | null {
  const filePath = path.join(DATA_DIR, name)
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf8')
  return { data: JSON.parse(content), sha: fileSha(content) }
}

function writeDataFile(name: string, data: unknown, expectedSha: string | null): string {
  const filePath = path.join(DATA_DIR, name)
  const content = JSON.stringify(data, null, 2)
  const newSha = fileSha(content)

  if (expectedSha && fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8')
    if (fileSha(existing) !== expectedSha) {
      const err = new Error('Conflict') as Error & { status: number }
      err.status = 409
      throw err
    }
  }

  fs.writeFileSync(filePath, content, 'utf8')
  return newSha
}

function sendJson(res: Connect.ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function localDataPlugin(): Plugin {
  return {
    name: 'local-data',
    configureServer(server) {
      ensureDataDir()

      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''

        if (url === '/config.json') {
          if (!fs.existsSync(CONFIG_PATH)) {
            sendJson(res, 404, {
              error: 'config.json not found. Copy config.example.json to config.json and edit it.',
            })
            return
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(fs.readFileSync(CONFIG_PATH, 'utf8'))
          return
        }

        const match = url.match(/^\/api\/data\/([\w.-]+\.json)(\?.*)?$/)
        if (!match) {
          next()
          return
        }

        const fileName = match[1]

        if (req.method === 'GET') {
          try {
            const result = readDataFile(fileName)
            if (!result) {
              sendJson(res, 404, { error: 'Not found' })
              return
            }
            sendJson(res, 200, result)
          } catch (err) {
            sendJson(res, 500, { error: err instanceof Error ? err.message : 'Read failed' })
          }
          return
        }

        if (req.method === 'PUT') {
          let body = ''
          req.on('data', (chunk) => {
            body += chunk
          })
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body) as { data: unknown; sha: string | null }
              const sha = writeDataFile(fileName, parsed.data, parsed.sha)
              sendJson(res, 200, { sha })
            } catch (err) {
              const status = (err as { status?: number }).status ?? 500
              sendJson(res, status, { error: err instanceof Error ? err.message : 'Write failed' })
            }
          })
          return
        }

        next()
      })
    },
  }
}
