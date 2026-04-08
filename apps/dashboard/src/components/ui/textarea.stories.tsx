import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = { title: 'UI/Textarea', component: Textarea, tags: ['autodocs'], argTypes: { disabled: { control: 'boolean' } } };
export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = { args: { placeholder: 'Write notes...' } };
export const Disabled: Story = { args: { placeholder: 'Disabled', disabled: true } };
export const WithValue: Story = { args: { value: 'Service notes for this appointment', readOnly: true } };
