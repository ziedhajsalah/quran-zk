import { MantineProvider } from '@mantine/core'
import type { Preview } from '@storybook/react-vite'
import '../src/styles/app.css'

const preview: Preview = {
  decorators: [
    (Story) => (
      <MantineProvider defaultColorScheme="light">
        <div style={{ padding: '1rem' }}>
          <Story />
        </div>
      </MantineProvider>
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
