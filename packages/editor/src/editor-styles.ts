/**
 * Editor styles injected at runtime.
 * Uses the SAME CSS variables and values as @context-towel/markdown's markdown.css
 * so the editor looks identical to the read-only MarkdownRenderer.
 *
 * Typography store sets these on document.documentElement:
 *   --font-primary, --font-mono, --font-size-base, --line-height-base,
 *   --line-height-mono, --letter-spacing-base, --font-weight-base,
 *   --font-smoothing-webkit, --font-smoothing-moz, --text-rendering
 *
 * Theme tokens set these on the editor container via inline styles:
 *   --color-bg-primary, --color-bg-secondary, --color-bg-tertiary,
 *   --color-border-primary, --color-border-secondary,
 *   --color-text-primary, --color-text-secondary, --color-text-muted,
 *   --color-accent, --color-success, --color-warning, --color-error, --color-info
 */

const STYLE_ID = 'context-towel-editor-styles'
let injected = false

const css = `
/* ProseMirror base */
.ProseMirror {
  position: relative;
  word-wrap: break-word;
  white-space: pre-wrap;
  white-space: break-spaces;
  -webkit-font-variant-ligatures: none;
  font-variant-ligatures: none;
  font-feature-settings: "liga" 0;
}
.ProseMirror pre { white-space: pre-wrap; }
.ProseMirror li { position: relative; }
.ProseMirror-hideselection *::selection { background: transparent; }
.ProseMirror-hideselection *::-moz-selection { background: transparent; }
.ProseMirror-hideselection { caret-color: transparent; }
.ProseMirror [draggable][contenteditable=false] { user-select: text; }
li.ProseMirror-selectednode { outline: none; }
img.ProseMirror-separator { display: inline !important; border: none !important; margin: 0 !important; }
.ProseMirror-gapcursor { display: none; pointer-events: none; position: absolute; }
.ProseMirror-gapcursor:after {
  content: ""; display: block; position: absolute;
  top: -2px; width: 20px; border-top: 1px solid currentColor;
  animation: ProseMirror-cursor-blink 1.1s steps(2, start) infinite;
}
@keyframes ProseMirror-cursor-blink { to { visibility: hidden; } }
.ProseMirror-focused .ProseMirror-gapcursor { display: block; }

/* ============================================================
   Editor — mirrors markdown.css exactly
   ============================================================ */

.context-towel-editor {
  width: 100%;
  min-height: 200px;
}

.context-towel-editor .ProseMirror {
  outline: none;
  font-family: var(--font-primary, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif);
  font-size: var(--font-size-base, 15px);
  line-height: var(--line-height-base, 1.6);
  letter-spacing: var(--letter-spacing-base, normal);
  font-weight: var(--font-weight-base, 400);
  -webkit-font-smoothing: var(--font-smoothing-webkit, auto);
  -moz-osx-font-smoothing: var(--font-smoothing-moz, auto);
  text-rendering: var(--text-rendering, auto);
  color: inherit;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}

/* --- Headings (from markdown.css) --- */
.context-towel-editor .ProseMirror h1,
.context-towel-editor .ProseMirror h2,
.context-towel-editor .ProseMirror h3,
.context-towel-editor .ProseMirror h4,
.context-towel-editor .ProseMirror h5,
.context-towel-editor .ProseMirror h6 {
  margin-top: 1.6em;
  margin-bottom: 1.067em;
  font-weight: 600;
  line-height: 1.25;
  color: var(--color-text-primary);
}

.context-towel-editor .ProseMirror h1 {
  font-size: 2em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--color-border-primary);
}

.context-towel-editor .ProseMirror h2 {
  font-size: 1.5em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--color-border-primary);
}

.context-towel-editor .ProseMirror h3 { font-size: 1.25em; }
.context-towel-editor .ProseMirror h4 { font-size: 1em; }

/* --- Paragraphs --- */
.context-towel-editor .ProseMirror p {
  margin-top: 0;
  margin-bottom: 1.067em;
}

/* --- Links --- */
.context-towel-editor .ProseMirror a {
  color: var(--color-accent);
  text-decoration: none;
}
.context-towel-editor .ProseMirror a:hover {
  text-decoration: underline;
}

/* --- Lists --- */
.context-towel-editor .ProseMirror ul,
.context-towel-editor .ProseMirror ol {
  margin-top: 0;
  margin-bottom: 1.067em;
  padding-left: 2em;
}

.context-towel-editor .ProseMirror li {
  margin-bottom: 0.267em;
}

.context-towel-editor .ProseMirror li + li {
  margin-top: 0.267em;
}

.context-towel-editor .ProseMirror li > p {
  margin: 0;
}

/* --- Blockquotes --- */
.context-towel-editor .ProseMirror blockquote {
  margin: 0 0 1.067em 0;
  padding: 0 1.067em;
  color: var(--color-text-muted);
  border-left: 4px solid var(--color-accent);
}

.context-towel-editor .ProseMirror blockquote > :first-child { margin-top: 0; }
.context-towel-editor .ProseMirror blockquote > :last-child { margin-bottom: 0; }

/* --- Inline code --- */
.context-towel-editor .ProseMirror code {
  font-family: var(--font-mono, 'Menlo', 'Monaco', 'Courier New', monospace);
  font-size: 85%;
  padding: 0.2em 0.4em;
  background-color: var(--color-bg-tertiary);
  border-radius: 6px;
}

/* --- Code blocks — match markdown.css .markdown-code-block exactly --- */
.context-towel-editor .ProseMirror .markdown-code-block {
  margin: 1.067em 0;
  border-radius: 8px;
  border: 1px solid var(--color-border-primary);
  overflow: hidden;
  background: var(--color-bg-primary);
  position: relative;
}

.context-towel-editor .ProseMirror .markdown-code-block .code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4em 0.8em;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-primary);
  font-size: 0.8em;
  user-select: none;
}

.context-towel-editor .ProseMirror .markdown-code-block .code-lang {
  color: var(--color-text-muted);
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.context-towel-editor .ProseMirror .markdown-code-block pre {
  margin: 0;
  padding: 1.067em;
  max-height: 500px;
  overflow: auto;
  font-size: 0.867em;
  line-height: 1.5;
  background: var(--color-bg-primary);
  cursor: text;
  border: none;
  border-radius: 0;
  color: var(--color-text-primary);
}

.context-towel-editor .ProseMirror .markdown-code-block code {
  display: block;
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-family: var(--font-mono, 'Menlo', 'Monaco', 'Courier New', monospace);
  font-size: inherit;
  color: inherit;
}

/* Fallback for any bare <pre> not wrapped by the code block NodeView */
.context-towel-editor .ProseMirror > pre {
  margin: 1.067em 0;
  padding: 1.067em;
  max-height: 500px;
  overflow: auto;
  font-size: 0.867em;
  line-height: 1.5;
  background-color: var(--color-bg-primary);
  border-radius: 8px;
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-primary);
  cursor: text;
}

.context-towel-editor .ProseMirror > pre code {
  background: transparent;
  padding: 0;
  border-radius: 0;
  display: block;
  font-size: inherit;
  color: inherit;
}

/* --- Horizontal rules --- */
.context-towel-editor .ProseMirror hr {
  border: 0;
  border-top: 1px solid var(--color-border-primary);
  margin: 1.6em 0;
}

/* --- Strong/emphasis/del — match markdown.css --- */
.context-towel-editor .ProseMirror strong {
  font-weight: 600;
  color: var(--color-text-primary);
}

.context-towel-editor .ProseMirror em {
  font-style: italic;
}

.context-towel-editor .ProseMirror del {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

/* --- Images --- */
.context-towel-editor .ProseMirror img {
  max-width: 100%;
  border-radius: 8px;
}

/* --- Tables — match markdown.css --- */
.context-towel-editor .ProseMirror table {
  border-collapse: collapse;
  border-spacing: 0;
  table-layout: auto;
  width: 100%;
  margin: 1.067em 0;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  overflow: hidden;
  font-size: 0.933em;
}

.context-towel-editor .ProseMirror th,
.context-towel-editor .ProseMirror td {
  padding: 0.533em 0.8em;
  border: 1px solid var(--color-border-primary);
  text-align: left;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
  min-width: 5.333em;
}

.context-towel-editor .ProseMirror th {
  font-weight: 600;
  background-color: var(--color-bg-tertiary);
}

.context-towel-editor .ProseMirror tr:nth-child(2n) {
  background-color: var(--color-bg-secondary);
}

.context-towel-editor .ProseMirror tr:hover {
  background-color: var(--color-bg-tertiary);
}

/* --- Card block node views --- */
.context-towel-editor .card-block-node-view {
  margin: 1.067em 0;
}

.context-towel-editor .ProseMirror-selectednode {
  outline: 2px solid var(--color-accent);
  border-radius: 6px;
}

/* --- Task list checkboxes (GFM) --- */
.context-towel-editor .ProseMirror li[data-checked] {
  list-style: none;
  margin-left: -1.5em;
  padding-left: 1.5em;
}

.context-towel-editor .ProseMirror li[data-checked] > label > input[type="checkbox"] {
  margin-top: 0.2em;
  width: 0.933em;
  height: 0.933em;
  cursor: pointer;
  accent-color: var(--color-accent);
  flex-shrink: 0;
}

/* --- Read-only mode --- */
.context-towel-editor--readonly .ProseMirror {
  caret-color: transparent;
  cursor: default;
}
.context-towel-editor--readonly .ProseMirror .markdown-code-block pre {
  cursor: default;
}
.context-towel-editor--readonly .ProseMirror-focused {
  outline: none;
}

/* --- Syntax highlighting (highlight.js) --- */
.context-towel-editor .ProseMirror .hljs { color: var(--color-text-primary); }
.context-towel-editor .ProseMirror .hljs-comment,
.context-towel-editor .ProseMirror .hljs-quote { color: var(--color-text-muted); font-style: italic; }
.context-towel-editor .ProseMirror .hljs-keyword,
.context-towel-editor .ProseMirror .hljs-selector-tag,
.context-towel-editor .ProseMirror .hljs-type { color: var(--color-accent); }
.context-towel-editor .ProseMirror .hljs-string,
.context-towel-editor .ProseMirror .hljs-addition { color: var(--color-success); }
.context-towel-editor .ProseMirror .hljs-number,
.context-towel-editor .ProseMirror .hljs-literal,
.context-towel-editor .ProseMirror .hljs-built_in { color: var(--color-warning, #f59e0b); }
.context-towel-editor .ProseMirror .hljs-title,
.context-towel-editor .ProseMirror .hljs-section { color: var(--color-info); font-weight: 600; }
.context-towel-editor .ProseMirror .hljs-deletion { color: var(--color-error); }
.context-towel-editor .ProseMirror .hljs-attr,
.context-towel-editor .ProseMirror .hljs-variable,
.context-towel-editor .ProseMirror .hljs-template-variable { color: var(--color-warning, #f59e0b); }
.context-towel-editor .ProseMirror .hljs-meta { color: var(--color-text-muted); }
.context-towel-editor .ProseMirror .hljs-emphasis { font-style: italic; }
.context-towel-editor .ProseMirror .hljs-strong { font-weight: 700; }

/* --- Mermaid diagrams --- */
.context-towel-editor .mermaid-block {
  margin: 1.067em 0;
  padding: 2.8em 1.6em 1.2em;
  background: var(--color-bg-primary);
  border-radius: 8px;
  border: 1px solid var(--color-border-primary);
  overflow-x: auto;
  cursor: pointer;
  position: relative;
}
.context-towel-editor .mermaid-block:hover {
  border-color: var(--color-accent);
}
.context-towel-editor .mermaid-svg-viewport {
  overflow: auto;
  width: 100%;
  cursor: grab;
}
.context-towel-editor .mermaid-svg-scaler {
  display: block;
}
.context-towel-editor .mermaid-block svg {
  display: block;
  width: 100%;
  height: auto;
}
.context-towel-editor .mermaid-zoom-controls {
  position: absolute;
  top: 0.5em;
  left: 0.8em;
  display: flex;
  align-items: center;
  gap: 0.267em;
  z-index: 10;
}
.context-towel-editor .mermaid-zoom-btn {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-secondary);
  padding: 0.1em 0.4em;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8em;
  line-height: 1.4;
  min-width: 1.6em;
  text-align: center;
  transition: background 0.15s, border-color 0.15s;
}
.context-towel-editor .mermaid-zoom-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-accent);
  color: var(--color-text-primary);
}
.context-towel-editor .mermaid-zoom-label {
  font-size: 0.733em;
  color: var(--color-text-muted);
  min-width: 2.8em;
  text-align: center;
  user-select: none;
}
.context-towel-editor .fullscreen-hint {
  position: absolute;
  top: 0.533em;
  right: 0.533em;
  font-size: 0.733em;
  color: var(--color-text-muted);
  background: var(--color-bg-overlay);
  padding: 0.133em 0.533em;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  z-index: 10;
}
.context-towel-editor .clickable-fullscreen:hover .fullscreen-hint {
  opacity: 1;
}

/* --- GFM Alerts --- */
.context-towel-editor .ProseMirror .md-alert {
  margin: 1.067em 0;
  padding: 0.8em 1.067em;
  border-radius: 8px;
  border-left: 4px solid var(--color-accent);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}
.context-towel-editor .ProseMirror .md-alert-title {
  font-size: 0.8em;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 0.533em;
  color: var(--color-text-muted);
}
.context-towel-editor .ProseMirror .md-alert > :first-child { margin-top: 0; }
.context-towel-editor .ProseMirror .md-alert > :last-child { margin-bottom: 0; }
.context-towel-editor .ProseMirror .md-alert-note { border-left-color: var(--color-accent); }
.context-towel-editor .ProseMirror .md-alert-tip { border-left-color: var(--color-success); }
.context-towel-editor .ProseMirror .md-alert-important { border-left-color: var(--color-accent); }
.context-towel-editor .ProseMirror .md-alert-warning { border-left-color: var(--color-warning, #f59e0b); }
.context-towel-editor .ProseMirror .md-alert-caution { border-left-color: var(--color-error); }

/* --- Draggable content --- */
.context-towel-editor .draggable-content {
  cursor: grab;
  position: relative;
}
.context-towel-editor .draggable-content:hover {
  outline: 1px dashed var(--color-accent);
  outline-offset: 4px;
}
.context-towel-editor .draggable-content:hover::after {
  content: '\\22EE\\22EE drag to terminal';
  position: absolute;
  top: -1.333em;
  right: 0.267em;
  font-size: 0.733em;
  color: var(--color-accent);
  background: var(--color-bg-primary);
  padding: 0.133em 0.4em;
  border-radius: 3px;
  pointer-events: none;
}
.context-towel-editor .draggable-content:active {
  cursor: grabbing;
}

/* --- KaTeX math --- */
.context-towel-editor .katex-display {
  margin: 1.067em 0;
  overflow-x: auto;
  overflow-y: hidden;
}

/* --- Slash command menu --- */
.context-towel-slash-menu {
  position: absolute;
  z-index: 10000;
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--color-bg-secondary, #16213e);
  border: 1px solid var(--color-border-primary, #2a2a4a);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
.slash-menu-item {
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-primary, #e0e0e0);
}
.slash-menu-item:hover,
.slash-menu-item--active {
  background: var(--color-bg-tertiary, #0d0d1a);
}
.slash-menu-empty {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--color-text-muted, #606070);
}

/* --- Block drag handle --- */
.context-towel-block-handle {
  position: absolute;
  z-index: 100;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  color: var(--color-text-muted, #606070);
  font-size: 14px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  user-select: none;
  pointer-events: none;
}
.context-towel-block-handle[data-show="true"] {
  opacity: 0.5;
  pointer-events: auto;
}
.context-towel-block-handle[data-show="true"]:hover {
  opacity: 1;
  background: var(--color-bg-tertiary, #0d0d1a);
  color: var(--color-text-secondary, #a0a0b0);
}
.context-towel-block-handle:active {
  cursor: grabbing;
}

/* --- Nested editor (card description/notes fields) --- */
.context-towel-nested-editor {
  min-height: 60px;
  border: 1px solid var(--color-border-primary, #2a2a4a);
  border-radius: 6px;
  padding: 4px;
}
.context-towel-nested-editor .ProseMirror {
  min-height: 52px;
  font-size: 0.9em;
}
.context-towel-nested-editor .ProseMirror:focus {
  outline: none;
}
`

export function ensureEditorStyles(): void {
  if (injected) return
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) {
    injected = true
    return
  }
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = css
  document.head.appendChild(style)
  injected = true
}
