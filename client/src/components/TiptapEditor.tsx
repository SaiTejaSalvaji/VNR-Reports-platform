import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Underline } from '@tiptap/extension-underline';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Table as TableIcon,
  Plus,
  Minus
} from 'lucide-react';

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

const TiptapEditor: React.FC<TiptapEditorProps> = ({
  value,
  onChange,
  placeholder,
  readOnly = false
}) => {
  const [isInitialized, setIsInitialized] = React.useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'tiptap-table'
        }
      }),
      TableRow,
      TableHeader,
      TableCell.configure({
        HTMLAttributes: {
          class: 'tiptap-table-cell'
        }
      })
    ],
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
    onCreate: () => {
      setIsInitialized(true);
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
        'data-placeholder': placeholder || 'Enter content...'
      }
    }
  });

  // Update editable state when readOnly prop changes
  React.useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Only update content from external changes, not from user typing
  React.useEffect(() => {
    if (!editor || !isInitialized) return;

    const currentContent = editor.getHTML();
    // Only update if content is different and editor is not focused
    if (value !== currentContent && !editor.isFocused) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor, isInitialized]);

  if (!editor) {
    return null;
  }

  return (
    <div className="tiptap-editor-container">
      {!readOnly && (
        <div className="tiptap-toolbar">
          {/* Text Formatting */}
          <div className="toolbar-group">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`toolbar-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
              title="Bold"
              type="button"
            >
              <Bold size={18} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`toolbar-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
              title="Italic"
              type="button"
            >
              <Italic size={18} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`toolbar-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
              title="Underline"
              type="button"
            >
              <UnderlineIcon size={18} />
            </button>
          </div>

          <div className="toolbar-divider"></div>

          {/* Headings */}
          <div className="toolbar-group">
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
              title="Heading 1"
              type="button"
            >
              <Heading1 size={18} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
              title="Heading 2"
              type="button"
            >
              <Heading2 size={18} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`}
              title="Heading 3"
              type="button"
            >
              <Heading3 size={18} />
            </button>
          </div>

          <div className="toolbar-divider"></div>

          {/* Lists */}
          <div className="toolbar-group">
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`toolbar-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
              title="Bullet List"
              type="button"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`toolbar-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
              title="Numbered List"
              type="button"
            >
              <ListOrdered size={18} />
            </button>
          </div>

          <div className="toolbar-divider"></div>

          {/* Table Controls */}
          <div className="toolbar-group">
            <button
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className="toolbar-btn"
              title="Insert Table (3x3)"
              type="button"
            >
              <TableIcon size={18} />
            </button>
            {editor.isActive('table') && (
              <>
                <button
                  onClick={() => editor.chain().focus().addColumnBefore().run()}
                  className="toolbar-btn toolbar-btn-sm"
                  title="Add Column Before"
                  type="button"
                >
                  <Plus size={16} /> Col
                </button>
                <button
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  className="toolbar-btn toolbar-btn-sm"
                  title="Delete Column"
                  type="button"
                >
                  <Minus size={16} /> Col
                </button>
                <button
                  onClick={() => editor.chain().focus().addRowBefore().run()}
                  className="toolbar-btn toolbar-btn-sm"
                  title="Add Row Before"
                  type="button"
                >
                  <Plus size={16} /> Row
                </button>
                <button
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className="toolbar-btn toolbar-btn-sm"
                  title="Delete Row"
                  type="button"
                >
                  <Minus size={16} /> Row
                </button>
                <button
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="toolbar-btn toolbar-btn-danger"
                  title="Delete Table"
                  type="button"
                >
                  Delete Table
                </button>
              </>
            )}
          </div>

        </div>
      )}

      <EditorContent editor={editor} />

      <style>{`
        .tiptap-editor-container {
          border: 1px solid #dee2e6;
          border-radius: 0.375rem;
          overflow: hidden;
          background: white;
        }

        .tiptap-toolbar {
          background-color: #f8f9fa;
          padding: 0.5rem;
          border-bottom: 1px solid #dee2e6;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }

        .toolbar-group {
          display: flex;
          gap: 0.25rem;
        }

        .toolbar-divider {
          width: 1px;
          height: 24px;
          background-color: #dee2e6;
        }

        .toolbar-btn {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.375rem 0.5rem;
          border: 1px solid #dee2e6;
          background: white;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: all 0.15s;
          font-size: 0.75rem;
          font-weight: 500;
          color: #495057;
        }

        .toolbar-btn:hover {
          background: #e9ecef;
          border-color: #adb5bd;
        }

        .toolbar-btn.is-active {
          background: #4f46e5;
          color: white;
          border-color: #4338ca;
        }

        .toolbar-btn-sm {
          padding: 0.25rem 0.375rem;
          font-size: 0.7rem;
        }

        .toolbar-btn-danger {
          color: #dc3545;
          border-color: #dc3545;
        }

        .toolbar-btn-danger:hover {
          background: #dc3545;
          color: white;
        }

        .toolbar-help {
          display: flex;
          align-items: center;
          padding: 0.25rem 0.5rem;
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 0.25rem;
          max-width: 400px;
        }

        .tiptap-editor-content {
          min-height: 500px;
        }

        .tiptap-editor-content .ProseMirror {
          padding: 1rem;
          min-height: 500px;
          outline: none;
        }

        .tiptap-editor-content .ProseMirror:focus {
          outline: none;
        }

        /* Placeholder */
        .tiptap-editor-content .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #6c757d;
          pointer-events: none;
          height: 0;
          float: left;
        }

        /* Typography */
        .tiptap-editor-content h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          line-height: 1.2;
          color: #000000;
        }

        .tiptap-editor-content h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: #000000;
        }

        .tiptap-editor-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
          color: #000000;
        }

        .tiptap-editor-content p {
          margin: 0.5rem 0;
          line-height: 1.6;
        }

        .tiptap-editor-content ul,
        .tiptap-editor-content ol {
          margin: 0.5rem 0;
          padding-left: 2rem;
        }

        .tiptap-editor-content ul {
          list-style-type: disc;
        }

        .tiptap-editor-content ol {
          list-style-type: decimal;
        }

        .tiptap-editor-content li {
          margin: 0.25rem 0;
          display: list-item;
        }

        /* Table Styles - Auto-sizing based on content */
        .tiptap-editor-content .tiptap-table {
          border-collapse: collapse;
          margin: 1rem 0;
          width: 100%;
          table-layout: auto;
        }

        .tiptap-editor-content .tiptap-table td,
        .tiptap-editor-content .tiptap-table th {
          min-width: 100px;
          border: 2px solid #ced4da;
          padding: 0.5rem 0.75rem;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
          word-wrap: break-word;
          white-space: normal;
        }

        .tiptap-editor-content .tiptap-table th {
          background-color: #f8f9fa;
          font-weight: 600;
          text-align: left;
        }

        .tiptap-editor-content .tiptap-table .selectedCell {
          background: #e7f3ff;
        }

        /* Allow table to scroll horizontally if too wide */
        .tiptap-editor-content .ProseMirror {
          overflow-x: auto;
        }

        /* Read-only styles */
        .tiptap-editor-content .ProseMirror[contenteditable="false"] {
          background-color: #f8f9fa;
          cursor: default;
        }

        /* Strong/Bold */
        .tiptap-editor-content strong {
          font-weight: 700;
        }

        /* Emphasis/Italic */
        .tiptap-editor-content em {
          font-style: italic;
        }

        /* Underline */
        .tiptap-editor-content u {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default TiptapEditor;
