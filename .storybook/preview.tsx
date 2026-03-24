import { DirectionProvider, MantineProvider } from '@mantine/core'
import { appTheme } from '../src/theme'
import type { Preview } from '@storybook/react-vite'
import '../src/styles/app.css'

const preview: Preview = {
  decorators: [
    (Story) => (
      <DirectionProvider initialDirection="rtl">
        <MantineProvider theme={appTheme} defaultColorScheme="light">
          <div style={{ padding: '1rem' }} lang="ar" dir="rtl">
            <Story />
          </div>
        </MantineProvider>
      </DirectionProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
}

export default preview
