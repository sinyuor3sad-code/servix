import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './input';

const meta: Meta<typeof Input> = { title: 'UI/Input', component: Input, tags: ['autodocs'], argTypes: { type: { control: 'select', options: ['text', 'password', 'email', 'tel', 'number'] }, disabled: { control: 'boolean' } } };
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = { args: { placeholder: 'Enter text...' } };
export const Password: Story = { args: { type: 'password', placeholder: 'Password' } };
export const Disabled: Story = { args: { placeholder: 'Disabled', disabled: true } };
export const WithValue: Story = { args: { value: 'Pre-filled value', readOnly: true } };
export const Phone: Story = { args: { type: 'tel', placeholder: '+966...' } };
