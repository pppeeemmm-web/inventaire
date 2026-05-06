'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import { useEffect } from 'react'

// ── Toolbar button ─────────────────────────────────────────────────────────

function Btn({
  active, disabled, onClick, title, children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      style={{
        padding: '3px 7px',
        borderRadius: 3,
        border: 'none',
        background: active ? 'var(--ac)' : 'transparent',
        color: active ? 'white' : 'var(--tx2)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 11,
        fontFamily: 'inherit',
        opacity: disabled ? 0.35 : 1,
        lineHeight: 1,
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return (
    <span style={{
      width: 1, height: 14, background: 'var(--bd)',
      display: 'inline-block', margin: '0 4px', verticalAlign: 'middle',
    }} />
  )
}

// ── RichEditor ─────────────────────────────────────────────────────────────

interface Props {
  value: string          // HTML string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

export function RichEditor({ value, onChange, placeholder = '', minHeight = 160 }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML()
      onChange(html)
    },
    editorProps: {
      attributes: {
        style: [
          'outline:none',
          `min-height:${minHeight}px`,
          'font-size:13px',
          'line-height:1.7',
          'color:var(--tx1)',
          'font-family:inherit',
          'padding:12px 14px',
        ].join(';'),
      },
    },
  })

  // Sync external value changes (e.g. file import) without re-initialising
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value || '', false)
    }
  }, [value, editor])

  if (!editor) return null

  const e = editor

  return (
    <div style={{
      border: '1px solid var(--bd)',
      borderRadius: 4,
      background: 'var(--bg0)',
      overflow: 'hidden',
    }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 2,
        padding: '5px 8px',
        borderBottom: '1px solid var(--bd)',
        background: 'var(--bg1)',
      }}>
        {/* Text style */}
        <Btn title="Gras" active={e.isActive('bold')} onClick={() => e.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </Btn>
        <Btn title="Italique" active={e.isActive('italic')} onClick={() => e.chain().focus().toggleItalic().run()}>
          <em>I</em>
        </Btn>
        <Btn title="Souligné" active={e.isActive('underline')} onClick={() => e.chain().focus().toggleUnderline().run()}>
          <span style={{ textDecoration: 'underline' }}>U</span>
        </Btn>
        <Btn title="Barré" active={e.isActive('strike')} onClick={() => e.chain().focus().toggleStrike().run()}>
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </Btn>

        <Sep />

        {/* Headings */}
        <Btn title="Titre H2" active={e.isActive('heading', { level: 2 })} onClick={() => e.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </Btn>
        <Btn title="Titre H3" active={e.isActive('heading', { level: 3 })} onClick={() => e.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </Btn>

        <Sep />

        {/* Lists */}
        <Btn title="Liste à puces" active={e.isActive('bulletList')} onClick={() => e.chain().focus().toggleBulletList().run()}>
          ≡
        </Btn>
        <Btn title="Liste numérotée" active={e.isActive('orderedList')} onClick={() => e.chain().focus().toggleOrderedList().run()}>
          1≡
        </Btn>
        <Btn title="Citation" active={e.isActive('blockquote')} onClick={() => e.chain().focus().toggleBlockquote().run()}>
          "
        </Btn>

        <Sep />

        {/* Alignment */}
        <Btn title="Aligner à gauche" active={e.isActive({ textAlign: 'left' })} onClick={() => e.chain().focus().setTextAlign('left').run()}>
          ⬤◯◯
        </Btn>
        <Btn title="Centrer" active={e.isActive({ textAlign: 'center' })} onClick={() => e.chain().focus().setTextAlign('center').run()}>
          ◯⬤◯
        </Btn>
        <Btn title="Justifier" active={e.isActive({ textAlign: 'justify' })} onClick={() => e.chain().focus().setTextAlign('justify').run()}>
          ▤
        </Btn>

        <Sep />

        {/* History */}
        <Btn title="Annuler" disabled={!e.can().undo()} onClick={() => e.chain().focus().undo().run()}>
          ↩
        </Btn>
        <Btn title="Refaire" disabled={!e.can().redo()} onClick={() => e.chain().focus().redo().run()}>
          ↪
        </Btn>

        <Sep />

        {/* Clear */}
        <Btn title="Effacer le formatage" onClick={() => e.chain().focus().clearNodes().unsetAllMarks().run()}>
          ✕fmt
        </Btn>
      </div>

      {/* ── Editor area ── */}
      <EditorContent editor={editor} />

      {/* Placeholder (Tiptap's built-in extension needs CSS; simpler to do it ourselves) */}
      {editor.isEmpty && placeholder && (
        <div style={{
          position: 'absolute',
          pointerEvents: 'none',
          color: 'var(--tx3)',
          fontSize: 13,
          padding: '12px 14px',
          opacity: 0.4,
          fontFamily: 'inherit',
        }}>
          {placeholder}
        </div>
      )}

      {/* Tiptap prose styles */}
      <style>{`
        .tiptap { position: relative; }
        .tiptap p { margin: 0 0 0.5em; }
        .tiptap h2 { font-size: 1.2em; font-weight: 600; margin: 0.8em 0 0.4em; }
        .tiptap h3 { font-size: 1em; font-weight: 600; margin: 0.6em 0 0.3em; }
        .tiptap ul, .tiptap ol { padding-left: 1.4em; margin: 0.4em 0; }
        .tiptap li { margin: 0.15em 0; }
        .tiptap blockquote {
          border-left: 3px solid var(--ac);
          padding-left: 12px;
          color: var(--tx3);
          margin: 0.6em 0;
          font-style: italic;
        }
        .tiptap strong { font-weight: 700; }
        .tiptap em { font-style: italic; }
        .tiptap s { text-decoration: line-through; }
        .tiptap u { text-decoration: underline; }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: var(--tx3);
          opacity: 0.4;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>
    </div>
  )
}

// ── Utility: strip HTML tags to plain text ─────────────────────────────────
export function htmlToPlain(html: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
                     