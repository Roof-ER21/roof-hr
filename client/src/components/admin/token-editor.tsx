/**
 * TokenEditor — a what-you-see-is-what-you-get box for email text that
 * contains {{placeholders}}.
 *
 * The people editing the welcome email are HR staff, not developers. So the
 * raw HTML never appears: the email's own inline styling is rendered as-is
 * (the browser edits the real DOM, so colours and sizes survive), and each
 * {{token}} is shown as a small labelled chip ("First name") that cannot be
 * typed inside of. On the way back out, chips turn into {{token}} again, so
 * the server sees exactly the format it always did.
 */
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Bold, Italic, Underline, List, Link2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface EditorToken {
  token: string;
  label: string;
  description: string;
}

interface Props {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  tokens: EditorToken[];
  /** Subject-line mode: one line, plain text, no formatting toolbar. */
  singleLine?: boolean;
  className?: string;
}

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const CHIP_CLASS =
  'tok-chip inline-block align-baseline rounded border border-blue-200 bg-blue-50 px-1.5 text-[0.85em] font-medium leading-tight text-blue-800 select-none';
const UNKNOWN_CHIP_CLASS =
  'tok-chip inline-block align-baseline rounded border border-red-200 bg-red-50 px-1.5 text-[0.85em] font-medium leading-tight text-red-800 select-none';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chipHtml(token: string, tokens: EditorToken[]): string {
  const known = tokens.find((t) => t.token === token);
  const label = known ? known.label : `{{${token}}}`;
  const title = known ? known.description : 'Not a known placeholder — it will be sent exactly as written';
  return `<span data-token="${escapeHtml(token)}" contenteditable="false" class="${known ? CHIP_CLASS : UNKNOWN_CHIP_CLASS}" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
}

/** Stored form ({{token}} inside HTML or plain text) → what the editor shows. */
function toEditable(value: string, tokens: EditorToken[], singleLine: boolean): string {
  const base = singleLine ? escapeHtml(value) : value;
  return base.replace(TOKEN_RE, (_m, name: string) => chipHtml(name, tokens));
}

/** What the editor shows → stored form. */
function fromEditable(root: HTMLElement, singleLine: boolean): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>('span[data-token]').forEach((chip) => {
    chip.replaceWith(document.createTextNode(`{{${chip.dataset.token}}}`));
  });
  if (singleLine) return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
  return clone.innerHTML;
}

export default function TokenEditor({ id, value, onChange, tokens, singleLine = false, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // The value we last handed to onChange. When the parent echoes it back we
  // must not rewrite the DOM, or the caret would jump to the start on every keystroke.
  const lastEmitted = useRef<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (value === lastEmitted.current) return;
    ref.current.innerHTML = toEditable(value, tokens, singleLine);
    lastEmitted.current = value;
    // Tokens can arrive after the first render; re-chip when they do.
  }, [value, tokens, singleLine]);

  const emit = () => {
    if (!ref.current) return;
    const next = fromEditable(ref.current, singleLine);
    lastEmitted.current = next;
    onChange(next);
  };

  const rememberSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const focusEditor = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (savedRange.current && el.contains(savedRange.current.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    } else {
      // No remembered caret: go to the end.
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const exec = (command: string, arg?: string) => {
    focusEditor();
    document.execCommand(command, false, arg);
    emit();
  };

  const insertToken = (token: string) => {
    focusEditor();
    // A trailing space so the person can keep typing after the chip.
    document.execCommand('insertHTML', false, `${chipHtml(token, tokens)}&nbsp;`);
    emit();
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    // Plain text only: pasting from Word or a web page would otherwise drag
    // its fonts and colours into the email.
    e.preventDefault();
    let text = e.clipboardData.getData('text/plain');
    if (singleLine) text = text.replace(/\s+/g, ' ');
    document.execCommand('insertText', false, text);
    emit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (singleLine && e.key === 'Enter') e.preventDefault();
  };

  const toolbarButton = (icon: React.ReactNode, title: string, onClick: () => void) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 px-2"
      title={title}
      aria-label={title}
      // Keep focus (and the caret) in the editor when the button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </Button>
  );

  return (
    <div className={className}>
      {!singleLine && (
        <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 bg-muted/40 px-2 py-1">
          {toolbarButton(<Bold className="h-4 w-4" />, 'Bold', () => exec('bold'))}
          {toolbarButton(<Italic className="h-4 w-4" />, 'Italic', () => exec('italic'))}
          {toolbarButton(<Underline className="h-4 w-4" />, 'Underline', () => exec('underline'))}
          {toolbarButton(<List className="h-4 w-4" />, 'Bulleted list', () => exec('insertUnorderedList'))}
          {toolbarButton(<Link2 className="h-4 w-4" />, 'Add a link', () => {
            rememberSelection();
            setLinkOpen((o) => !o);
          })}
          {linkOpen && (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (linkUrl.trim()) exec('createLink', linkUrl.trim());
                setLinkUrl('');
                setLinkOpen(false);
              }}
            >
              <Input
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                className="h-8 w-56"
              />
              <Button type="submit" size="sm" className="h-8">
                Add
              </Button>
            </form>
          )}
        </div>
      )}

      <div
        id={id}
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={!singleLine}
        spellCheck
        onInput={emit}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onBlur={rememberSelection}
        className={
          singleLine
            ? 'min-h-10 w-full whitespace-nowrap overflow-x-auto rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            : 'min-h-[360px] max-h-[65vh] w-full overflow-y-auto rounded-b-md border bg-white p-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
        }
      />

      {tokens.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Plus className="h-3 w-3" />
            Insert:
          </span>
          {tokens.map((t) => (
            <button
              key={t.token}
              type="button"
              title={t.description}
              className={`${CHIP_CLASS} cursor-pointer hover:bg-blue-100`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertToken(t.token)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
