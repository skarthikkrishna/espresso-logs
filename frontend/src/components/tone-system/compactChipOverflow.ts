export function getFittingCompactChipCount(
  chipWidths: number[],
  gap: number,
  containerWidth: number,
  moreWidth: number,
): number {
  const chipCount = chipWidths.length
  if (chipCount === 0) return 0
  if (containerWidth <= 0) return 0

  const totalChipWidth = chipWidths.reduce((sum, width) => sum + width, 0)
  const totalGapWidth = Math.max(0, chipCount - 1) * gap
  if (totalChipWidth + totalGapWidth <= containerWidth) return chipCount

  for (let visible = chipCount - 1; visible >= 0; visible -= 1) {
    const visibleChipWidth = chipWidths.slice(0, visible).reduce((sum, width) => sum + width, 0)
    const visibleGapWidth = Math.max(0, visible - 1) * gap
    const moreGapWidth = visible > 0 ? gap : 0
    if (visibleChipWidth + visibleGapWidth + moreGapWidth + moreWidth <= containerWidth) {
      return visible
    }
  }

  return 0
}
