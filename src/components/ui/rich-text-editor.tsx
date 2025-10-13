"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Eraser,
} from "lucide-react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeightClass?: string; // e.g. "min-h-[200px]"
};

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeightClass = "min-h-[240px]",
}: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Keep external value in sync when replaced
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const addLink = () => {
    const url = window.prompt("Enter URL (https://...)", "https://");
    if (!url) return;
    exec("createLink", url);
  };

  const addImage = () => {
    const url = window.prompt("Enter image URL (https://...)", "https://");
    if (!url) return;
    exec("insertImage", url);
  };

  const clearFormatting = () => {
    exec("removeFormat");
  };

  return (
    <div className="border rounded-md bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec("bold")}
          className="h-8 px-2"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec("italic")}
          className="h-8 px-2"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec("underline")}
          className="h-8 px-2"
        >
          <Underline className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec("formatBlock", "<h1>")}
          className="h-8 px-2"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec("formatBlock", "<h2>")}
          className="h-8 px-2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec("insertUnorderedList")}
          className="h-8 px-2"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec("insertOrderedList")}
          className="h-8 px-2"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec("formatBlock", "<blockquote>")}
          className="h-8 px-2"
        >
          <Quote className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addLink}
          className="h-8 px-2"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addImage}
          className="h-8 px-2"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearFormatting}
          className="h-8 px-2"
        >
          <Eraser className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        className={`prose prose-sm max-w-none dark:prose-invert p-3 outline-none ${minHeightClass}`}
        contentEditable
        suppressContentEditableWarning
        onInput={() =>
          editorRef.current && onChange(editorRef.current.innerHTML)
        }
        onBlur={() =>
          editorRef.current && onChange(editorRef.current.innerHTML)
        }
        data-placeholder={placeholder || "Start typing..."}
        style={{ whiteSpace: "pre-wrap" }}
      />
    </div>
  );
}
