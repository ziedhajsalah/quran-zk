import {
  DEFAULT_THEME,
  createTheme,
} from '@mantine/core'
import type {
  MantineColorsTuple,
  MantineGradient,
  MantinePrimaryShade,
  MantineThemeOverride,
} from '@mantine/core'

// Palette ramps: each Mantine color must have 10 shades from 0 to 9.
export const primary = [
  '#eefbf2',
  '#dcf2e3',
  '#b8e3c5',
  '#8fcda1',
  '#66b57d',
  '#2f8b52',
  '#004d27',
  '#003f20',
  '#002f18',
  '#001f10',
] as const satisfies MantineColorsTuple

export const secondary = [
  '#f2f6f2',
  '#e5ece6',
  '#cfd9d1',
  '#b6c3b8',
  '#9aa99d',
  '#7f8f82',
  '#667769',
  '#526153',
  '#3d493e',
  '#283029',
] as const satisfies MantineColorsTuple

export const tertiary = [
  '#fcf6e8',
  '#f4ead0',
  '#e8d7a5',
  '#dbc178',
  '#caa84f',
  '#a8862d',
  '#725515',
  '#5e450f',
  '#493508',
  '#332403',
] as const satisfies MantineColorsTuple

export const gray = [
  '#ffffff',
  '#f8faf5',
  '#f2f4ef',
  '#e7e9e4',
  '#e1e3de',
  '#d8dbd6',
  '#bec9be',
  '#99a39a',
  '#6f7a70',
  '#191c1a',
] as const satisfies MantineColorsTuple

export const paletteKeys = {
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
  neutral: 'gray',
} as const

export const primaryShade: MantinePrimaryShade = {
  light: 6,
  dark: 8,
}

// Semantic colors from the design system.
export const semanticColors = {
  background: '#f8faf5',
  surface: '#ffffff',
  surfaceContainerLow: '#f2f4ef',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerHigh: '#e7e9e4',
  surfaceContainerHighest: '#e1e3de',
  surfaceDim: '#d8dbd6',
  onSurface: '#191c1a',
  onSurfaceVariant: '#6f7a70',
  outline: '#6f7a70',
  outlineVariant: '#bec9be',
  primaryContainer: '#006837',
  tertiaryContainer: '#725515',
  primaryFixed: '#9ef6b6',
  onPrimary: '#ffffff',
} as const

export const typography = {
  bodyFontFamily: 'Manrope, sans-serif',
  headingFontFamily: '"Noto Serif", serif',
  monospaceFontFamily: DEFAULT_THEME.fontFamilyMonospace,
  headings: {
    h1: { fontSize: '3.5rem', lineHeight: '', fontWeight: '' },
    h2: { fontSize: '', lineHeight: '', fontWeight: '' },
    h3: { fontSize: '', lineHeight: '', fontWeight: '' },
    h4: { fontSize: '', lineHeight: '', fontWeight: '' },
    h5: { fontSize: '', lineHeight: '', fontWeight: '' },
    h6: { fontSize: '', lineHeight: '', fontWeight: '' },
  },
  arabicScale: 1.15,
} as const

export const radii = {
  xs: '',
  sm: '',
  md: '0.375rem',
  lg: '',
  xl: '0.75rem',
} as const

export const spacing = {
  xs: '',
  sm: '',
  md: '',
  lg: '',
  xl: '',
  '10': '3.5rem',
  '16': '',
  '20': '',
} as const

export const shadows = {
  xs: '',
  sm: '',
  md: '',
  lg: '',
  xl: '',
  ambient: '0 20px 40px rgba(25, 28, 26, 0.06)',
} as const

export const gradients: { primaryCta: MantineGradient } = {
  primaryCta: {
    from: '#004d27',
    to: '#006837',
    deg: 180,
  },
}

export const glass = {
  surfaceOpacity: 0.8,
  backdropBlur: '12px',
} as const

export const componentTokens = {
  buttons: {
    primaryRadius: 'xl',
    secondaryBorderOpacity: 0.3,
  },
  cards: {
    ayahBorderWidth: '4px',
    ayahBorderColor: '#004d27',
  },
  inputs: {
    background: '#e7e9e4',
    radius: 'md',
  },
  progressRosary: {
    complete: '#004d27',
    incomplete: '#9ef6b6',
  },
  home: {
    heroRadius: '2.5rem',
    cardRadius: '2rem',
    navRadius: '2rem',
    iconRadius: '1.25rem',
    bottomNavMaxWidth: '26rem',
    floatingActionOffset: '1.5rem',
    floatingActionBottom: '7.5rem',
    floatingActionSize: '3.5rem',
  },
} as const

export const themeTokens = {
  primary,
  secondary,
  tertiary,
  gray,
  paletteKeys,
  primaryShade,
  semanticColors,
  typography,
  radii,
  spacing,
  shadows,
  gradients,
  glass,
  componentTokens,
} as const

function pickFilled(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== ''),
  )
}

function resolveHeadingSize(
  key: keyof typeof typography.headings,
): (typeof DEFAULT_THEME.headings.sizes)[typeof key] {
  return {
    ...DEFAULT_THEME.headings.sizes[key],
    ...pickFilled(typography.headings[key]),
  }
}

export const mantineThemeOverrides: MantineThemeOverride = {
  black: semanticColors.onSurface,
  white: semanticColors.surfaceContainerLowest,
  colors: {
    primary,
    secondary,
    tertiary,
    gray,
  },
  primaryColor: paletteKeys.primary,
  primaryShade,
  autoContrast: true,
  cursorType: 'pointer',
  defaultGradient: gradients.primaryCta,
  fontFamily: typography.bodyFontFamily,
  fontFamilyMonospace: typography.monospaceFontFamily,
  headings: {
    fontFamily: typography.headingFontFamily,
    fontWeight: DEFAULT_THEME.headings.fontWeight,
    textWrap: 'balance',
    sizes: {
      h1: resolveHeadingSize('h1'),
      h2: resolveHeadingSize('h2'),
      h3: resolveHeadingSize('h3'),
      h4: resolveHeadingSize('h4'),
      h5: resolveHeadingSize('h5'),
      h6: resolveHeadingSize('h6'),
    },
  },
  defaultRadius: 'md',
  radius: {
    ...DEFAULT_THEME.radius,
    ...pickFilled(radii),
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    ...pickFilled(spacing),
  },
  shadows: {
    ...DEFAULT_THEME.shadows,
    ...pickFilled(shadows),
  },
  components: {
    Button: {
      defaultProps: {
        radius: componentTokens.buttons.primaryRadius,
      },
      styles: {
        root: {
          fontWeight: 600,
        },
      },
    },
    Card: {
      defaultProps: {
        radius: 'xl',
        shadow: 'sm',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'xl',
      },
    },
    TextInput: {
      defaultProps: {
        radius: componentTokens.inputs.radius,
      },
      styles: {
        input: {
          backgroundColor: componentTokens.inputs.background,
          borderColor: 'transparent',
        },
        label: {
          color: semanticColors.onSurfaceVariant,
        },
      },
    },
    Textarea: {
      defaultProps: {
        radius: componentTokens.inputs.radius,
      },
      styles: {
        input: {
          backgroundColor: componentTokens.inputs.background,
          borderColor: 'transparent',
        },
        label: {
          color: semanticColors.onSurfaceVariant,
        },
      },
    },
  },
  other: {
    paletteKeys,
    semanticColors,
    typography,
    glass,
    componentTokens,
  },
}

export const appTheme = createTheme(mantineThemeOverrides)
