import { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, List, Link as LinkIcon, Image as ImageIcon, LayoutTemplate } from 'lucide-react';
import { TEMPLATE_VARIABLES } from '../utils/emailTemplateUtils';

const PURPLE = '#5b3fc7';
const BORDER = '#e5e2f5';

/**
 * Self-contained rich text editor for composing professional email bodies.
 * - Formatting toolbar (bold/italic/underline/list/link)
 * - Inline image upload + full-width "header banner" image upload
 * - Click-to-insert variable chips ({{student_name}} etc.)
 *
 * `initialHtml` seeds the editor. Bump `resetSignal` (e.g. a template id)
 * whenever the parent wants to reload different content into the editor.
 * `onChange(html)` fires on every edit with the editor's current innerHTML.
 */
export default function EmailRichEditor({ initialHtml, onChange, resetSignal, minHeight = 220 }) {
  const editorRef = useRef(null);
  const inlineImageInputRef = useRef(null);
  const bannerImageInputRef = useRef(null);
  const [linkPromptOpen, setLinkPromptOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml || '';
    }
    setLinkPromptOpen(false);
    setLinkUrl('');
    // Only re-seed when the caller explicitly signals a reset (e.g. picking
    // a different saved template) — not on every initialHtml reference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const emitChange = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const focusEditor = () => editorRef.current?.focus();

  const runCommand = (command, arg) => {
    focusEditor();
    document.execCommand(command, false, arg);
    emitChange();
  };

  // Robust cursor-position text insertion (used for variable chips) — does
  // not depend on the (deprecated) execCommand('insertText') return value.
  const insertTextAtCursor = (text) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.setEndAfter(node);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editor.appendChild(document.createTextNode(text));
    }
    emitChange();
  };

  const handleInlineImageSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      focusEditor();
      document.execCommand('insertImage', false, reader.result);
      emitChange();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBannerImageSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (editorRef.current) {
        editorRef.current.insertAdjacentHTML(
          'afterbegin',
          `<img src="${reader.result}" alt="Banner" style="display:block;width:100%;max-width:600px;border-radius:8px;margin-bottom:14px;" />`
        );
        emitChange();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddLink = () => {
    if (!linkUrl.trim()) { setLinkPromptOpen(false); return; }
    runCommand('createLink', linkUrl.trim());
    setLinkUrl('');
    setLinkPromptOpen(false);
  };

  return (
    <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Formatting toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 10px', background: '#faf9ff', borderBottom: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
        <ToolbarButton icon={<Bold size={15} />} title="Bold" onClick={() => runCommand('bold')} />
        <ToolbarButton icon={<Italic size={15} />} title="Italic" onClick={() => runCommand('italic')} />
        <ToolbarButton icon={<Underline size={15} />} title="Underline" onClick={() => runCommand('underline')} />
        <ToolbarButton icon={<List size={15} />} title="Bullet list" onClick={() => runCommand('insertUnorderedList')} />
        <ToolbarButton icon={<LinkIcon size={15} />} title="Insert link" onClick={() => setLinkPromptOpen((v) => !v)} active={linkPromptOpen} />
        <div style={{ width: 1, height: 20, background: BORDER, margin: '0 6px' }} />
        <ToolbarButton icon={<ImageIcon size={15} />} title="Insert image" onClick={() => inlineImageInputRef.current?.click()} />
        <ToolbarButton icon={<LayoutTemplate size={15} />} title="Set header banner image" onClick={() => bannerImageInputRef.current?.click()} />
        <input ref={inlineImageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleInlineImageSelected} />
        <input ref={bannerImageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerImageSelected} />
      </div>

      {linkPromptOpen && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, background: '#fff' }}>
          <input
            type="text"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }}
            style={{ flex: 1, padding: '6px 10px', border: `1.5px solid ${BORDER}`, borderRadius: 6, fontSize: 12.5, outline: 'none' }}
          />
          <button onClick={handleAddLink} style={{ padding: '6px 14px', background: PURPLE, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Add</button>
        </div>
      )}

      {/* Click-to-insert variable chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '8px 10px', background: '#fff', borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: 10.5, color: '#aaa', fontWeight: 700, marginRight: 2 }}>INSERT VARIABLE:</span>
        {TEMPLATE_VARIABLES.map((v) => (
          <button
            key={v.token}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertTextAtCursor(v.token)}
            style={{ padding: '4px 10px', background: '#f0ecff', color: PURPLE, border: 'none', borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            + {v.label}
          </button>
        ))}
      </div>

      {/* Editable body */}
      <div
        ref={editorRef}
        contentEditable
        onInput={emitChange}
        suppressContentEditableWarning
        style={{ minHeight, maxHeight: 360, overflowY: 'auto', padding: 16, fontSize: 13.5, lineHeight: 1.7, color: '#333', outline: 'none' }}
      />
    </div>
  );
}

function ToolbarButton({ icon, title, onClick, active }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', background: active ? '#ece8fb' : 'transparent', borderRadius: 6,
        cursor: 'pointer', color: active ? PURPLE : '#5b5b7a',
      }}
      onMouseOver={(e) => { e.currentTarget.style.background = '#ece8fb'; }}
      onMouseOut={(e) => { e.currentTarget.style.background = active ? '#ece8fb' : 'transparent'; }}
    >
      {icon}
    </button>
  );
}