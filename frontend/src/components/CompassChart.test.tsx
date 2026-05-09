import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CompassChart from './CompassChart';

// ── Shared layout constants (mirrors CompassChart internals) ──────────────────
const W = 300, H = 220
const PADDING = { top: 20, right: 20, bottom: 52, left: 45 }
const chartW = W - PADDING.left - PADDING.right   // 235
const chartH = H - PADDING.top - PADDING.bottom   // 148
const RATIO_MIN = 1.0, RATIO_MAX = 3.0

const xScale = (r: number) => PADDING.left + ((r - RATIO_MIN) / (RATIO_MAX - RATIO_MIN)) * chartW
// Updated to match new defaults: timeMin=15, timeMax=60
const yScale = (s: number) => PADDING.top + ((60 - s) / (60 - 15)) * chartH

// Equal-thirds zone boundaries
const x1 = PADDING.left + chartW / 3        // ≈ 123.33
const x2 = PADDING.left + (2 * chartW) / 3  // ≈ 201.67
// const y1 = PADDING.top  + chartH / 3        // = 80
// const y2 = PADDING.top  + (2 * chartH) / 3  // = 130

describe('CompassChart', () => {
  it('renders_9_zones', () => {
    render(<CompassChart />);
    const zones = document.querySelectorAll('g[style*="cursor:pointer"], g[style*="cursor: pointer"]');
    expect(zones).toHaveLength(9);
  });

  it('all_9_taste_labels_present', () => {
    const handler = vi.fn();
    render(<CompassChart onSelectZone={handler} />);
    const groups = document.querySelectorAll('g[style*="cursor:pointer"], g[style*="cursor: pointer"]');
    groups.forEach(g => fireEvent.click(g));
    expect(handler).toHaveBeenCalledTimes(9);
    const called = handler.mock.calls.map((c: unknown[]) => c[0] as string);
    const expected = [
      'Weak & bitter', 'Bitter', 'Harsh & bitter',
      'Weak & sweet', 'Sweet & balanced', 'Bitter & astringent',
      'Weak & sour', 'Sour', 'Astringent & sour',
    ];
    expected.forEach(t => expect(called).toContain(t));
  });

  it('click_fires_onSelectZone', () => {
    const handler = vi.fn();
    render(<CompassChart onSelectZone={handler} />);
    // In the three-pass structure, zone labels are rendered outside cursor-pointer groups.
    // Find the Sweet & balanced zone group directly — it is zones[4] (row 1, col 1 = centre).
    const groups = document.querySelectorAll('g[style*="cursor:pointer"], g[style*="cursor: pointer"]');
    expect(groups.length).toBe(9);
    fireEvent.click(groups[4]);
    expect(handler).toHaveBeenCalledWith('Sweet & balanced');
  });

  it('selected_taste_highlighted', () => {
    render(<CompassChart selectedTaste="Bitter" />);
    // Find all clickable zone groups
    const groups = Array.from(
      document.querySelectorAll('g[style*="cursor:pointer"], g[style*="cursor: pointer"]')
    );
    // In the three-pass structure, zone labels are NOT inside cursor-pointer groups.
    // "Bitter" is zones[1] (row 0, col 1 = centre column, slow row).
    const bitterGroup = groups[1];
    expect(bitterGroup).not.toBeNull();
    // Selected zone: first rect is transparent hit target; second rect is the selection overlay
    // with rgba(255,255,255,0.06) fill (selected-only branch).
    const rects = bitterGroup.querySelectorAll('rect');
    let hasSelectionOverlay = false;
    rects.forEach(rect => {
      const fill = rect.getAttribute('fill') ?? '';
      if (fill.includes('255,255,255')) hasSelectionOverlay = true;
    });
    expect(hasSelectionOverlay).toBe(true);
    // All other zones must NOT have a white-fill selection overlay
    groups
      .filter((_, i) => i !== 1)
      .forEach(g => {
        const groupRects = g.querySelectorAll('rect');
        let hasWhiteFill = false;
        groupRects.forEach(r => {
          const fill = r.getAttribute('fill') ?? '';
          if (fill.includes('255,255,255')) hasWhiteFill = true;
        });
        expect(hasWhiteFill).toBe(false);
      });
  });

  // ── Updated: now requires doseG for ratio-based X axis ─────────────────────
  // doseG=18, yieldG=36 → ratio=2.0 → dotX = 45 + ((2-1)/2)*235 = 162.5
  // timeSec=30 → dotY = 20 + (30/45)*148 ≈ 118.67  (new defaults: timeMin=15, timeMax=60)
  it('dot_position_correct', () => {
    render(<CompassChart doseG={18} yieldG={36} timeSec={30} />);
    const circle = document.querySelector('circle');
    expect(circle).not.toBeNull();
    const cx = parseFloat(circle!.getAttribute('cx') ?? '0');
    const cy = parseFloat(circle!.getAttribute('cy') ?? '0');
    expect(cx).toBe(162.5);
    expect(cy).toBeCloseTo(118.67, 1);
  });

  it('no_dot_when_null', () => {
    render(<CompassChart yieldG={undefined} timeSec={undefined} />);
    expect(document.querySelector('circle')).toBeNull();
  });

  // ── T024: clamping test — dot stays at axis boundary when ratio exceeds max ─
  // doseG=18, yieldG=65 → ratio ≈ 3.61 → clamped to RATIO_MAX=3.0
  // dotX = 45 + ((3.0-1.0)/2.0)*235 = 45 + 235 = 280
  it('clamps dot at axis boundary when ratio exceeds max', () => {
    render(<CompassChart doseG={18} yieldG={65} timeSec={30} onSelectZone={() => {}} />);
    const circles = document.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);
    const cx = parseFloat(circles[0].getAttribute('cx') ?? '0');
    expect(cx).toBeCloseTo(280, 0);
    expect(cx).toBeLessThanOrEqual(280);
  });

  // ── T023: guidance text absent when no active zone ───────────────────────
  it('guidance text is absent (empty) when yieldG and timeSec are null', () => {
    render(<CompassChart onSelectZone={() => {}} />);
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion!.textContent?.trim()).toBe('');
  });

  // ── T023: guidance text present for Sweet & balanced zone ────────────────
  // doseG=18, yieldG=36 → ratio=2.0 → dotX=162.5 (middle column)
  // timeSec=35 → dotY = 30 + (25/45)*150 ≈ 113.3 (middle row, between y1=80 and y2=130)
  // → Sweet & balanced zone  (updated timeSec from 30 to 35 for new timeMin=15,timeMax=60 defaults)
  it('guidance text is rendered when dot lands in Sweet & balanced zone', () => {
    render(<CompassChart doseG={18} yieldG={36} timeSec={35} onSelectZone={() => {}} />);
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion!.textContent).toMatch(/ideal extraction/i);
  });

  // ── T023: aria-live="polite" attribute present on guidance container ─────
  it('aria-live="polite" attribute is present on guidance container', () => {
    render(<CompassChart doseG={18} yieldG={36} timeSec={35} onSelectZone={() => {}} />);
    const el = document.querySelector('[aria-live="polite"]');
    expect(el).not.toBeNull();
    expect(el!.getAttribute('aria-live')).toBe('polite');
  });

  // ── T023: split-state paragraph renders when selectedTaste ≠ activeZoneTaste
  // doseG=18, yieldG=48, timeSec=35 → ratio≈2.667 → dotX≈240.8 → right column
  // timeSec=35 → dotY ≈ 113.3 → middle row → Bitter & astringent
  // selectedTaste = "Sweet & balanced" ≠ "Bitter & astringent" → split-state shows
  // (timeSec updated from 30 to 35 for new timeMin=15,timeMax=60 defaults)
  it('split-state paragraph renders when selectedTaste differs from active zone', () => {
    const { rerender } = render(
      <CompassChart doseG={18} yieldG={48} timeSec={35} selectedTaste="Sweet & balanced" onSelectZone={() => {}} />
    );
    const splitPara = document.body.textContent;
    expect(splitPara).toMatch(/Your parameters suggest/i);

    // Split-state must be absent when selectedTaste equals the active zone taste
    rerender(
      <CompassChart doseG={18} yieldG={48} timeSec={35} selectedTaste="Bitter & astringent" onSelectZone={() => {}} />
    );
    expect(document.body.textContent).not.toMatch(/Your parameters suggest/i);
  });

  // ── New tests for Extraction Compass redesign ─────────────────────────────

  // Test 1: Ratio axis — standard double shot at 1:2 lands in centre column
  // doseG=18, yieldG=36 → ratio=2.0 → dotX=162.5
  // x1 ≈ 123.33, x2 ≈ 201.67 → centre column
  it('ratio_axis_dot_in_centre_column', () => {
    render(<CompassChart doseG={18} yieldG={36} timeSec={30} />);
    const circles = document.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);
    const cx = parseFloat(circles[0].getAttribute('cx') ?? '0');
    expect(cx).toBeGreaterThanOrEqual(x1);
    expect(cx).toBeLessThan(x2);
  });

  // Test 2: Single basket shot — 9g dose, 18g yield = perfect 1:2 ratio
  // Must land in CENTRE column (ratio=2.0), NOT left column (the old absolute-yield bug)
  it('single_basket_shot_lands_in_centre_column_not_left', () => {
    render(<CompassChart doseG={9} yieldG={18} timeSec={30} />);
    const circles = document.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);
    const cx = parseFloat(circles[0].getAttribute('cx') ?? '0');
    // With old absolute-yield axis: xScale(18) ≈ 117px → left column (< x1)
    // With new ratio axis: xScale(2.0) = 162.5 → centre column
    expect(cx).toBeGreaterThanOrEqual(x1);  // NOT left column
    expect(cx).toBeLessThan(x2);            // NOT right column
    expect(cx).toBe(xScale(2.0));           // Exactly at ratio 2.0
  });

  // Test 3: Equal grid — verify zone boundaries are derived from chartW/3 formula
  // x1 = PADDING.left + chartW/3 ≈ 123.33px (not old magic xScale(25) ≈ 143px)
  // x2 = PADDING.left + 2*chartW/3 ≈ 201.67px (not old magic xScale(45) ≈ 221px)
  it('equal_thirds_grid_boundaries_are_derived_not_magic', () => {
    // Verify formula: each column is exactly chartW/3 wide
    expect(x2 - x1).toBeCloseTo(chartW / 3, 5);
    expect(x1 - PADDING.left).toBeCloseTo(chartW / 3, 5);

    // Verify at runtime: dot at ratio ≈ 1.667 (left boundary of centre) maps to ≈ x1
    // doseG=6, yieldG=10 → ratio = 10/6 ≈ 1.6667
    render(<CompassChart doseG={6} yieldG={10} timeSec={30} />);
    const circles = document.querySelectorAll('circle');
    const cx = parseFloat(circles[0].getAttribute('cx') ?? '0');
    expect(cx).toBeCloseTo(x1, 0);  // ≈ 123.33px
  });

  // Test 4: Null-dose fallback — renders without crashing, shows callout, no dot
  it('null_dose_fallback_renders_without_crashing', () => {
    expect(() => {
      render(<CompassChart yieldG={36} timeSec={30} />);
    }).not.toThrow();
    // No dot when doseG is absent (ratio cannot be computed)
    expect(document.querySelector('circle')).toBeNull();
  });

  // Test 5: Guidance on click — shows guidance text for selectedTaste even without a live dot
  it('guidance_shown_for_selected_taste_without_live_dot', () => {
    render(<CompassChart selectedTaste="Sour" />);
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    // New guidance for Sour: 'Under-extracted — try a finer grind or extend shot time by 3–5 s.'
    expect(liveRegion!.textContent).toMatch(/under-extracted/i);
  });

  // Test 6: Updated guidance strings — spot-check 'Bitter' returns ratio-aware string
  it('bitter_guidance_string_is_ratio_aware', () => {
    render(<CompassChart selectedTaste="Bitter" />);
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    // New string: 'Over-extracted — try a coarser grind or reduce shot time by 3–5 s.'
    expect(liveRegion!.textContent).toMatch(/reduce shot time/i);
  });

  // ── Track A: zoneBoundaries prop tests ─────────────────────────────────────

  // Test: timeSec=50 within [15,55] renders dot (not clamped/hidden) when
  // zoneBoundaries = { timeMin: 15, timeMax: 55, ratioInnerThird: 1.8, ratioOuterThird: 2.8 }
  it('dot renders with custom zoneBoundaries when timeSec is within range', () => {
    render(
      <CompassChart
        doseG={18}
        yieldG={36}
        timeSec={50}
        zoneBoundaries={{ timeMin: 15, timeMax: 55, ratioInnerThird: 1.8, ratioOuterThird: 2.8 }}
      />
    );
    const circle = document.querySelector('circle');
    expect(circle).not.toBeNull();
    // dotY = 20 + ((55 - 50) / (55 - 15)) * 148 = 20 + (5/40)*148 = 20 + 18.5 = 38.5
    const cy = parseFloat(circle!.getAttribute('cy') ?? '0');
    expect(cy).toBeCloseTo(38.5, 1);
  });

  // Test: zone boundary labels always show equal-thirds ratio values derived from the grid,
  // not from zoneBoundaries (grid is fixed for visual uniformity; labels follow the grid).
  it('zone boundary labels show grid-derived equal-thirds ratio values', () => {
    const { container } = render(
      <CompassChart
        zoneBoundaries={{ timeMin: 15, timeMax: 55, ratioInnerThird: 1.8, ratioOuterThird: 2.8 }}
      />
    );
    const allText = container.querySelectorAll('text');
    const textContents = Array.from(allText).map(t => t.textContent?.trim() ?? '');
    // RATIO_MIN=1.0, RATIO_MAX=3.0 → equal thirds at 1.667 and 2.333
    expect(textContents).toContain('1.67');
    expect(textContents).toContain('2.33');
  });

  // ── Track A: aurora + radial gradient tests ────────────────────────────────

  // Test: radialGradient in defs (SC-003 / FR-015a)
  it('has_radial_gradient_in_defs', () => {
    render(<CompassChart />)
    const defs = document.querySelector('defs')
    expect(defs).not.toBeNull()
    const radials = defs!.querySelectorAll('radialGradient')
    expect(radials.length).toBeGreaterThanOrEqual(1)
  })

  // Test: aurora overlay present after mouseMove + rAF flush (SC-003 / FR-015b)
  it('aurora_overlay_present_after_mouseMove', async () => {
    vi.useFakeTimers()
    render(<CompassChart />)
    const svg = document.querySelector('svg')!
    fireEvent.mouseMove(svg, { clientX: 150, clientY: 110 })
    await act(async () => { vi.runAllTimers() })
    expect(document.querySelector('[data-testid="aurora-overlay"]')).not.toBeNull()
    vi.useRealTimers()
  })

  // Test: aurora overlay absent after mouseLeave (FR-015c)
  it('aurora_overlay_absent_after_mouseLeave', async () => {
    vi.useFakeTimers()
    render(<CompassChart />)
    const svg = document.querySelector('svg')!
    fireEvent.mouseMove(svg, { clientX: 150, clientY: 110 })
    await act(async () => { vi.runAllTimers() })
    fireEvent.mouseLeave(svg)
    await act(async () => { vi.runAllTimers() })
    expect(document.querySelector('[data-testid="aurora-overlay"]')).toBeNull()
    vi.useRealTimers()
  })

  // Test: zone labels font-size >= 9 (SC-002)
  it('zone_labels_font_size_at_least_9px', () => {
    render(<CompassChart />)
    document.querySelectorAll('text').forEach(el => {
      const fs = parseFloat(el.getAttribute('font-size') ?? '0')
      if (fs > 0) expect(fs).toBeGreaterThanOrEqual(9)
    })
  })

  // Test: zone-cell rects have no solid per-cell stroke (SC-004)
  it('zone_cell_rects_have_no_solid_stroke', () => {
    render(<CompassChart />)
    document.querySelectorAll('[data-testid="zone-cell"]').forEach(el => {
      const strokeWidth = parseFloat(el.getAttribute('stroke-width') ?? '0')
      const stroke = el.getAttribute('stroke')
      expect(strokeWidth <= 0 || stroke === 'none' || stroke === null).toBe(true)
    })
  })
});
