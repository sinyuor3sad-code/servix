interface ColorShades {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

function mixColor(
  base: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  amount: number,
): string {
  return rgbToHex(
    base.r + (target.r - base.r) * amount,
    base.g + (target.g - base.g) * amount,
    base.b + (target.b - base.b) * amount,
  );
}

/**
 * Generate a full shade palette (50–950) from a single hex primary color.
 * Light shades mix toward white, dark shades toward a deep navy for richness.
 */
export function generateShades(hex: string): ColorShades {
  const base = hexToRgb(hex);
  const white = { r: 255, g: 255, b: 255 };
  const dark = { r: 15, g: 15, b: 30 };

  return {
    50: mixColor(base, white, 0.92),
    100: mixColor(base, white, 0.82),
    200: mixColor(base, white, 0.65),
    300: mixColor(base, white, 0.45),
    400: mixColor(base, white, 0.2),
    500: hex,
    600: mixColor(base, dark, 0.15),
    700: mixColor(base, dark, 0.3),
    800: mixColor(base, dark, 0.45),
    900: mixColor(base, dark, 0.6),
    950: mixColor(base, dark, 0.75),
  };
}

/**
 * Generate CSS variable declarations for a primary color.
 * Returns an object mapping `--primary-50` through `--primary-950` to hex values.
 */
export function generateCssVariables(hex: string): Record<string, string> {
  const shades = generateShades(hex);
  const vars: Record<string, string> = {};

  for (const [shade, value] of Object.entries(shades)) {
    vars[`--primary-${shade}`] = value;
  }

  return vars;
}

/**
 * Apply generated color variables to an element's style (client-side only).
 */
export function applyColorVariables(element: HTMLElement, hex: string): void {
  const vars = generateCssVariables(hex);
  for (const [key, value] of Object.entries(vars)) {
    element.style.setProperty(key, value);
  }
}
