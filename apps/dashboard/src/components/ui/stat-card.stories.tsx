import type { Meta, StoryObj } from '@storybook/react';
import { StatCard } from './stat-card';

const meta: Meta<typeof StatCard> = { title: 'UI/StatCard', component: StatCard, tags: ['autodocs'] };
export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = { args: { label: 'Total Revenue', value: '15,250 SAR', trend: { value: 12, direction: 'up' } } };
export const Down: Story = { args: { label: 'Cancellations', value: '23', trend: { value: 5, direction: 'down' } } };
export const NoTrend: Story = { args: { label: 'Total Clients', value: '1,234' } };
