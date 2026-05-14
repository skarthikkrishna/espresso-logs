# Aria — Design History

## Learnings

### 2026-05-13: Chip Component Design Review

- **Badge radius convention:** The design system explicitly sets `.badge { border-radius: var(--bevel-radius); }` in `index.css` line 385-387. All badge-like components should use `--bevel-radius` (0.625rem/10px), NOT `rounded-full`. This is a deliberate departure from pill shapes.

- **Spacing token discovery:** The app uses consistent padding scales. For compact inline labels like chips, `px-2.5 py-1` provides better breathing room than the tighter `px-2 py-0.5`. Text crowding is a common issue at small sizes.

- **Backdrop-blur layering:** Chips typically render inside already-frosted containers (glass-card, liquid-card). Adding `backdrop-blur-sm` to the chip itself is visually redundant and can be safely removed.

- **Design system token sources:** Key tokens live in `index.css :root` block (lines 37-60): `--glass-*`, `--bevel-*`, `--btn-*`, `--input-*`. DaisyUI theme colors are in the `@plugin "daisyui/theme"` block (lines 8-30).
