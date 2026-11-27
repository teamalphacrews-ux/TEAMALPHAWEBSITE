// Choose the stronger contrast against a studio's custom document color.
export function documentAccentInk(hex) {
  const [red, green, blue] = hex.slice(1).match(/../g).map(pair => {
    const value = parseInt(pair, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? '#000' : '#fff';
}
