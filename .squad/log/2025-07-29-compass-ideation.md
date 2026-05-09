# Ideation Session: 2025-07-29 — CompassChart.tsx Redesign

## Participants
- **Finn** (Frontend Engineer)
- **Priya** (Product Manager)

## Summary
Finn and Priya ideated on a comprehensive redesign of CompassChart.tsx, the brew-ratio visualization component. Discussion focused on:
- Restoring the 3×3 grid (9 zones) with equal-thirds X-axis distribution
- Per-cell guidance strings contextualizing each taste-profile zone
- Null-dose UX handling and time-axis behaviour
- User story acceptance criteria and scope boundaries

## Outcomes
- **Grid Layout**: Equal-thirds X-axis math, 9 clickable taste-profile zones (row-major, SVG top→bottom)
- **Per-Cell Guidance**: Contextual strings for each zone (e.g., "Weak & bitter", "Sweet & balanced")
- **UX Scope**: 8 acceptance criteria defined for contextualisation feature
- **Time-Axis Messaging**: Clarified time-series interaction model and guidance acceptance criteria
- **Priority Ranking**: Feature prioritization documented for phased rollout

## Artifacts
- Updated acceptance criteria in spec.md (8 user stories)
- CompassChart.tsx implementation plan in .squad/orchestration-log/
