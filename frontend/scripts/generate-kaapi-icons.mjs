import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..', '..')
const source = resolve(root, 'frontend/assets/brand/kaapi-kadai-mark.svg')
const maskableSource = resolve(root, 'frontend/assets/brand/kaapi-kadai-mark-maskable.svg')
const publicDir = resolve(root, 'frontend/public/static/img')
const backendDir = resolve(root, 'app/static/img')

const outputs = [
  ['kaapi-kadai-icon-192.png', source, 192],
  ['kaapi-kadai-icon-512.png', source, 512],
  ['kaapi-kadai-icon-maskable-192.png', maskableSource, 192],
  ['kaapi-kadai-icon-maskable-512.png', maskableSource, 512],
  ['kaapi-kadai-favicon.png', source, 32],
]

function findTool(name) {
  try {
    execFileSync('which', [name], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function renderPng(input, output, size) {
  mkdirSync(dirname(output), { recursive: true })
  if (findTool('rsvg-convert')) {
    execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), input, '-o', output], { stdio: 'inherit' })
    return
  }
  if (findTool('magick')) {
    execFileSync('magick', [input, '-resize', `${size}x${size}`, output], { stdio: 'inherit' })
    return
  }
  if (findTool('sips')) {
    execFileSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), input, '--out', output], { stdio: 'ignore' })
    return
  }
  throw new Error('No SVG rasterizer found. Install rsvg-convert, ImageMagick magick, or run on macOS with sips.')
}

if (!existsSync(source) || !existsSync(maskableSource)) {
  throw new Error('Missing Kaapi Kadai SVG source assets.')
}

mkdirSync(publicDir, { recursive: true })
mkdirSync(backendDir, { recursive: true })
copyFileSync(source, resolve(publicDir, 'kaapi-kadai-mark.svg'))
copyFileSync(source, resolve(backendDir, 'kaapi-kadai-mark.svg'))

for (const [name, input, size] of outputs) {
  const publicPath = resolve(publicDir, name)
  renderPng(input, publicPath, size)
  copyFileSync(publicPath, resolve(backendDir, name))
}
