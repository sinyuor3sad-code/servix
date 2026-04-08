import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './empty-state';

const meta: Meta<typeof EmptyState> = { title: 'UI/EmptyState', component: EmptyState, tags: ['autodocs'] };
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = { args: { title: 'No data found', description: 'Try adjusting your filters' } };
export const WithAction: Story = { args: { title: 'No appointments', description: 'Create your first appointment', actionLabel: 'Create Appointment' } };
