export function contrastRatio(
  foreground: Array<number>,
  background: Array<number>,
) {
  function luminance(rgb: Array<number>) {
    const [red, green, blue] = rgb.map((channel) => {
      const value = channel / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }
  const values = [luminance(foreground), luminance(background)]
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05)
}

export function hexRgb(hex: string) {
  return [1, 3, 5].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  )
}
