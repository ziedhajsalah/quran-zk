import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { contrastRatio, hexRgb } from '../contrast'
import {
  appCssVariablesResolver,
  appTheme,
  componentTokens,
  gray,
  semanticColors,
} from '../../src/theme'

const theme = mergeMantineTheme(DEFAULT_THEME, appTheme)
const variables = appCssVariablesResolver(theme)
const textVariables = {
  light: [
    '--mantine-color-dimmed',
    '--mantine-color-placeholder',
    '--app-accent-text',
    '--mantine-color-gray-light-color',
  ],
  dark: [
    '--mantine-color-dimmed',
    '--mantine-color-placeholder',
    '--app-accent-text',
  ],
} as const

describe('secondary text semantics', () => {
  it.each([
    semanticColors.background,
    semanticColors.surface,
    semanticColors.surfaceContainerLow,
    semanticColors.surfaceContainerHigh,
    semanticColors.surfaceContainerHighest,
    semanticColors.surfaceDim,
    componentTokens.inputs.background,
    theme.colors.primary[0],
  ])('meets normal-text AA on light neutral surface %s', (background) => {
    for (const name of textVariables.light) {
      expect(
        contrastRatio(hexRgb(variables.light[name]), hexRgb(background)),
        name,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each([4, 5, 6, 7, 8])(
    'meets normal-text AA on dark surface %s',
    (shade) => {
      for (const name of textVariables.dark) {
        expect(
          contrastRatio(
            hexRgb(variables.dark[name]),
            hexRgb(theme.colors.dark[shade]),
          ),
          name,
        ).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it('changes text/background semantics, not palette, border or disabled variables', () => {
    expect(theme.colors.gray).toEqual(gray)
    expect(gray[6]).toBe('#bec9be')
    expect(semanticColors.outline).toBe('#6f7a70')
    expect(semanticColors.outlineVariant).toBe('#bec9be')
    expect(variables.variables).toEqual({})
    for (const scheme of ['light', 'dark'] as const) {
      expect(Object.keys(variables[scheme]).sort()).toEqual(
        [
          '--app-input-background',
          '--app-page-background',
          ...textVariables[scheme],
        ].sort(),
      )
    }
    expect(variables.light['--app-page-background']).toBe(
      semanticColors.background,
    )
    expect(variables.dark['--app-page-background']).toBe(theme.colors.dark[7])
    expect(variables.dark['--app-input-background']).toBe(theme.colors.dark[6])
    expect(variables.dark['--mantine-color-dimmed']).toBe(theme.colors.dark[1])
  })
})
