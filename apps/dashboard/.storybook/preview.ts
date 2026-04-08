import type { Preview } from '@storybook/react';
import React from 'react';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    layout: 'centered',
  },
  decorators: [
    (Story) =>
      React.createElement('div', { dir: 'rtl', lang: 'ar', style: { fontFamily: 'system-ui, sans-serif' } },
        React.createElement(Story)
      ),
  ],
};
export default preview;
