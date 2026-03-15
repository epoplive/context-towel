import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcCss = resolve(__dirname, '..', 'src', 'markdown.css')
const distJs = resolve(__dirname, '..', 'dist', 'index.js')

const css = readFileSync(srcCss, 'utf8')
let js = readFileSync(distJs, 'utf8')

// Replace the empty object that tsup creates for the CSS import
js = js.replace('var markdown_default = {};', `var markdown_default = ${JSON.stringify(css)};`)

// Also set cssText directly if the pattern exists
js = js.replace('var cssText = null;', `var cssText = ${JSON.stringify(css)};`)

writeFileSync(distJs, js)
console.log(`Inlined ${css.length} bytes of CSS into dist/index.js`)
