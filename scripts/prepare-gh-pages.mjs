import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'

const dist = join(process.cwd(), 'dist')
const index = join(dist, 'index.html')
const fallback = join(dist, '404.html')

if (!existsSync(index)) {
  console.error('dist/index.html not found. Run build:gh-pages first.')
  process.exit(1)
}

// GitHub Pages SPA fallback — serve index.html for unknown routes
copyFileSync(index, fallback)
console.log('Created dist/404.html for GitHub Pages SPA routing.')
