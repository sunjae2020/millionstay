import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Heading2, List, ListOrdered, Link2, Undo, Redo } from "lucide-react";

// Minimal TipTap WYSIWYG editor. Emits HTML via onChange; controlled by `value`.
// Ported (trimmed) from the Edubee CRM rich-text editor.
interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

function ToolButton({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`h-7 w-7 inline-flex items-center justify-center rounded border text-xs ${active ? "bg-primary/15 border-primary/20 text-primary" : "bg-white border-border hover:bg-muted/50"}`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 280 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? "Write the template…" }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: "prose prose-sm max-w-none focus:outline-none p-3", style: `min-height:${minHeight}px` } },
  });

  // Keep the editor in sync when the value changes externally (e.g. locale switch).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("Link URL");
    if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    else editor.chain().focus().unsetLink().run();
  };

  return (
    <div className="border rounded-md bg-white">
      <div className="flex flex-wrap gap-1 border-b p-1.5">
        <ToolButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></ToolButton>
        <ToolButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></ToolButton>
        <ToolButton title="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5" /></ToolButton>
        <ToolButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></ToolButton>
        <ToolButton title="Ordered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></ToolButton>
        <ToolButton title="Link" active={editor.isActive("link")} onClick={addLink}><Link2 className="h-3.5 w-3.5" /></ToolButton>
        <div className="flex-1" />
        <ToolButton title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo className="h-3.5 w-3.5" /></ToolButton>
        <ToolButton title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo className="h-3.5 w-3.5" /></ToolButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
