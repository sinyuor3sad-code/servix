import type { Meta, StoryObj } from '@storybook/react';
import { Spinner } from './spinner';

const meta: Meta<typeof Spinner> = { title: 'UI/Spinner', component: Spinner, tags: ['autodocs'] };
export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {};
export const Small: Story = { args: { className: 'w-4 h-4' } };
export const Large: Story = { args: { className: 'w-12 h-12' } };
