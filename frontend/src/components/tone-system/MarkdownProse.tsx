/**
 * MarkdownProse — tone-aware rendered markdown container.
 *
 * Principle 11 (Markdown Prose Rendering): wraps react-markdown in
 * `.kk-tc-markdown` so headings, bold, lists, links, and code render
 * elegantly on both glass tones without hardcoded colors.
 * Principle 4 (Warm Coherence): links resolve to `--kk-tc-link` (warm
 * amber DARK / espresso BEIGE), never default browser blue.
 * Principle 12 (No One-Offs): replaces inline `<div className="kk-tc-markdown">
 * <ReactMarkdown>…</ReactMarkdown></div>` one-offs.
 */
import ReactMarkdown from 'react-markdown'

interface MarkdownProseProps {
  children: string
}

export function MarkdownProse({ children }: MarkdownProseProps) {
  return (
    <div className="kk-tc-markdown">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  )
}
