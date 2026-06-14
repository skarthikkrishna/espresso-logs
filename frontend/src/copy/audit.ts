/**
 * Copy allowlist audit (spec-043 T002).
 *
 * AST-based enforcement that visible user-facing copy comes from the registry.
 * Per Quinn carry-forward note 2 the audit targets *render sinks and
 * accessibility props only*. It deliberately inspects nothing else, so it cannot
 * false-positive on class names, routes, query keys, enum values, test ids, or
 * data values — those never flow through the inspected positions.
 *
 * Inspected positions (render sinks):
 *  - JSX text nodes (visible text between tags, including CTA labels, toast,
 *    modal, and helper text rendered as children).
 *  - String-literal values of the accessibility/visible-copy attributes in
 *    {@link COPY_ATTRIBUTES} (`aria-label`, `alt`, `placeholder`, `title`, …).
 *
 * Never inspected (structurally exempt):
 *  - Any other JSX attribute — `className`, `to`, `href`, `id`, `htmlFor`,
 *    `role`, `type`, `name`, `key`, `value`, `data-*` (incl. `data-testid`), …
 *  - String literals outside JSX — enum values, query keys, object keys,
 *    function arguments, route constants, etc.
 *  - Attribute values written as `{expression}` — assumed registry-sourced or
 *    dynamic data and validated by their own source.
 */

import ts from 'typescript'

export type CopyViolationKind = 'jsx-text' | 'jsx-attribute'

export interface CopyViolation {
  /** The offending trimmed string. */
  text: string
  kind: CopyViolationKind
  /** Attribute name when `kind === 'jsx-attribute'`. */
  attribute?: string
  line: number
  column: number
}

/**
 * Accessibility and visible-copy attributes whose string-literal values are
 * operator-owned copy. Only these attributes are inspected.
 */
export const COPY_ATTRIBUTES: ReadonlySet<string> = new Set([
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-placeholder',
  'aria-valuetext',
  'alt',
  'placeholder',
  'title',
])

/**
 * A candidate counts as user-facing copy only when it contains at least one word
 * of two or more letters. This exempts bare data/unit suffixes ("g", "g →",
 * "%", "→") and numeric/symbolic fragments produced by interpolated data lines,
 * while still catching real words and sentences.
 */
const MEANINGFUL_COPY = /[A-Za-z]{2,}/

export const isMeaningfulCopy = (raw: string): boolean => MEANINGFUL_COPY.test(raw.trim())

const getAttributeName = (attr: ts.JsxAttribute): string =>
  ts.isIdentifier(attr.name) ? attr.name.escapedText.toString() : attr.name.getText()

/**
 * Returns the copy violations in a single `.tsx` source string.
 *
 * @param fileName  Name used for diagnostics and TSX parsing.
 * @param source    The source text to audit.
 * @param approved  Allowlist of approved copy (typically `APPROVED_COPY`).
 */
export function auditCopySource(
  fileName: string,
  source: string,
  approved: ReadonlySet<string>,
): CopyViolation[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  )

  const violations: CopyViolation[] = []

  const report = (node: ts.Node, text: string, kind: CopyViolationKind, attribute?: string): void => {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    violations.push({ text, kind, attribute, line: line + 1, column: character + 1 })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const text = node.text.trim()
      if (isMeaningfulCopy(text) && !approved.has(text)) {
        report(node, text, 'jsx-text')
      }
    } else if (ts.isJsxAttribute(node)) {
      const name = getAttributeName(node)
      const init = node.initializer
      if (COPY_ATTRIBUTES.has(name) && init && ts.isStringLiteral(init)) {
        const text = init.text.trim()
        if (isMeaningfulCopy(text) && !approved.has(text)) {
          report(init, text, 'jsx-attribute', name)
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}
