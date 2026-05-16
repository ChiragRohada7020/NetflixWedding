import React, { useEffect, useRef, useState } from "react";

export default function InlineEditableText({
  value,
  onSave,
  className = "",
  as = "span",
  placeholder = "Click to edit",
  enabled = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const inputRef = useRef(null);
  const Tag = as;

  useEffect(() => setDraft(value || ""), [value]);
  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  if (!enabled) return <Tag className={className}>{value}</Tag>;

  return (
    <Tag
      className={`${className} inline-editable ${editing ? "editing" : ""}`}
      onClick={() => setEditing(true)}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={async () => {
            setEditing(false);
            if ((draft || "") !== (value || "")) await onSave(draft);
          }}
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setEditing(false);
              if ((draft || "") !== (value || "")) await onSave(draft);
            }
            if (e.key === "Escape") {
              setDraft(value || "");
              setEditing(false);
            }
          }}
        />
      ) : (
        value || placeholder
      )}
    </Tag>
  );
}
