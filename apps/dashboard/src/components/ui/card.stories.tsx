import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './card';
import React from 'react';

const meta: Meta<typeof Card> = { title: 'UI/Card', component: Card, tags: ['autodocs'] };
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = { render: () => <Card><CardHeader><CardTitle>Card Title</CardTitle></CardHeader><CardContent><p>Card content goes here.</p></CardContent><CardFooter><p>Footer</p></CardFooter></Card> };
export const Simple: Story = { render: () => <Card><CardContent><p>Simple card with content only.</p></CardContent></Card> };
