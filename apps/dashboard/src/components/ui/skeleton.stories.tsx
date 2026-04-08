import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './skeleton';

const meta: Meta<typeof Skeleton> = { title: 'UI/Skeleton', component: Skeleton, tags: ['autodocs'] };
export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = { args: { className: 'w-48 h-4' } };
export const Circle: Story = { args: { className: 'w-12 h-12 rounded-full' } };
export const Card: Story = { args: { className: 'w-full h-32 rounded-lg' } };
