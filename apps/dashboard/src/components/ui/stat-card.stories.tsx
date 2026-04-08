import type { Meta, StoryObj } from '@storybook/react';
import { StatCard } from './stat-card';

const meta: Meta<typeof StatCard> = { title: 'UI/StatCard', component: StatCard, tags: ['autodocs'] };
export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = { args: { title: 'Total Revenue', value: '15,250 SAR', trend: '+12%', trendUp: true } };
export const Down: Story = { args: { title: 'Cancellations', value: '23', trend: '-5%', trendUp: false } };
export const NoTrend: Story = { args: { title: 'Total Clients', value: '1,234' } };
