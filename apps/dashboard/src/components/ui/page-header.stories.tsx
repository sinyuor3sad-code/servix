import type { Meta, StoryObj } from '@storybook/react';
import { PageHeader } from './page-header';

const meta: Meta<typeof PageHeader> = { title: 'UI/PageHeader', component: PageHeader, tags: ['autodocs'] };
export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = { args: { title: 'Appointments', description: 'Manage your salon appointments' } };
export const Simple: Story = { args: { title: 'Dashboard' } };
