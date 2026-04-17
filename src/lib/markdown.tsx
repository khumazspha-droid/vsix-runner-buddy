import React from "react";

// Tiny safe-ish markdown renderer for chat bubbles.
// Supports: **bold**, *italic*, `code`, > blockquote, lists, line breaks.
// Not a full parser — purpose-built for short chat messages.

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inline(s: string): string {
  let out = escapeHtml(s);
  // code spans
  out = out.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[0.85em]">$1</code>',
  );
  // bold
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let quoteBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-1 pl-5">
          {listBuffer.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(item) }} />
          ))}
        </ul>,
      );
      listBuffer = [];
    }
  };
  const flushQuote = () => {
    if (quoteBuffer.length) {
      blocks.push(
        <blockquote
          key={`bq-${blocks.length}`}
          className="my-1 border-l-2 border-primary/60 pl-3 text-muted-foreground italic"
          dangerouslySetInnerHTML={{ __html: inline(quoteBuffer.join(" ")) }}
        />,
      );
      quoteBuffer = [];
    }
  };

  for (const raw of lines) {
    const line = raw;
    if (/^\s*[-*]\s+/.test(line)) {
      flushQuote();
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flushList();
      quoteBuffer.push(line.replace(/^\s*>\s?/, ""));
      continue;
    }
    flushList();
    flushQuote();
    if (line.trim() === "") {
      blocks.push(<div key={`sp-${blocks.length}`} className="h-2" />);
    } else {
      blocks.push(
        <p
          key={`p-${blocks.length}`}
          className="leading-relaxed"
          dangerouslySetInnerHTML={{ __html: inline(line) }}
        />,
      );
    }
  }
  flushList();
  flushQuote();

  return <div className="space-y-1 text-sm">{blocks}</div>;
}
