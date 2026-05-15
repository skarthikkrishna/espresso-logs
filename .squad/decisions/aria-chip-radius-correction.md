# Design Decision: Chip Border Radius Correction

**Date:** 2026-05-13  
**Author:** Aria (Designer)  
**Status:** PENDING IMPLEMENTATION  
**Affects:** `frontend/src/components/Chip.tsx`

---

## Problem Statement

The `<Chip />` component currently uses Tailwind's `rounded` class. My previous review recommended `rounded` under the mistaken belief that it matched `--bevel-radius: 10px`. This was **incorrect**.

| Class | Computed Value |
|-------|---------------|
| `rounded-sm` | 2px (0.125rem) |
| `rounded` | **4px** (0.25rem) |
| `rounded-md` | 6px (0.375rem) |
| `rounded-lg` | 8px (0.5rem) |
| `rounded-xl` | 12px (0.75rem) |
| `rounded-full` | 9999px (pill) |
| `--bevel-radius` | **10px** (0.625rem) |

Tailwind's `rounded` = 4px ≠ 10px. The chip appears too square.

---

## Analysis

### 1. Design Token Source (`index.css` lines 47-48)

```css
:root {
  --bevel-radius: 0.625rem;  /* = 10px */
}
```

### 2. Badge Override (`index.css` lines 384-387)

```css
/* ── Badge border-radius — match --bevel-radius token; fixes square roast-level badges */
.badge {
  border-radius: var(--bevel-radius);
}
```

The `.badge` class explicitly uses `--bevel-radius`. However, **the `<Chip />` component does NOT use the `.badge` class** — it uses custom Tailwind classes and therefore does not inherit this override.

### 3. Current Chip.tsx Implementation

```tsx
className={`... rounded bg-amber-900/30 ...`}
```

`rounded` = 4px. The chip is nearly square, not the soft "squircle" Karthik expects.

### 4. Design Language Documentation

`docs/requirements/design-language.md` **does not exist**. No formal chip/badge radius spec is documented. However, the `index.css` `.badge` rule and `--bevel-radius` token establish the **de facto standard**: 10px border radius for badge-like elements.

---

## What is a "Squircle"?

A true iOS-style squircle uses a continuous curvature function (`border-radius` + `superellipse`), which CSS cannot natively express. However, for practical purposes, a **sufficiently rounded rectangle** (10-12px radius on small elements) reads as a "squircle" to users. The visual distinction at chip scale (<30px height) is imperceptible.

**Standard `border-radius` with 10px achieves the desired visual.**

---

## Recommendation

### Correct Tailwind Class: `rounded-[0.625rem]` (arbitrary value)

| Option | Value | Verdict |
|--------|-------|---------|
| `rounded-lg` | 8px | Close but not exact |
| `rounded-xl` | 12px | Slightly too round |
| `rounded-[10px]` | 10px | ✅ Exact match (arbitrary px) |
| `rounded-[0.625rem]` | 10px | ✅ **Preferred** (matches token unit) |

**Why `rounded-[0.625rem]` over `rounded-[10px]`?**  
The token `--bevel-radius` is defined in rem (`0.625rem`). Using the same unit maintains consistency if the base font size ever changes.

---

## Final Specification for Finn

**File:** `frontend/src/components/Chip.tsx`  
**Current:** `rounded`  
**Replace with:** `rounded-[0.625rem]`

```diff
- className={`inline-flex items-center text-xs px-2.5 py-1 rounded bg-amber-900/30 ...`}
+ className={`inline-flex items-center text-xs px-2.5 py-1 rounded-[0.625rem] bg-amber-900/30 ...`}
```

---

## Answers to Task Questions

| Question | Answer |
|----------|--------|
| Was my previous `rounded` recommendation wrong? | **Yes.** `rounded` = 4px, not 10px. |
| Correct class for squircle? | `rounded-[0.625rem]` (arbitrary value = 10px = `--bevel-radius`) |
| Does design language define chip radius? | No formal `design-language.md` exists. The de facto standard is `index.css` line 47: `--bevel-radius: 0.625rem`. |
| Is squircle achievable with CSS border-radius? | **Yes, effectively.** True superellipse squircles require SVG/canvas, but 10px `border-radius` on chip-sized elements is visually indistinguishable. |

---

## Token Alignment Note

For future-proofing, consider defining a Tailwind v4 theme extension to expose `--bevel-radius` as a utility:

```css
@theme {
  --radius-bevel: 0.625rem;
}
```

This would enable `rounded-bevel` as a semantic class. Out of scope for this fix.
