import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = { title: 'UI/Badge', component: Badge, tags: ['autodocs'], argTypes: { variant: { control: 'select', options: ['default', 'secondary', 'destructive', 'outline'] } } };
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = { args: { children: 'Active' } };
export const Secondary: Story = { args: { children: 'Pending', variant: 'secondary' } };
export const Destructive: Story = { args: { children: 'Cancelled', variant: 'destructive' } };
export const Outline: Story = { args: { children: 'Draft', variant: 'outline' } };
