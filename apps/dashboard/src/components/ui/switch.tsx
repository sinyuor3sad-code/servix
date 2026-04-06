'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
      'transition-all duration-[var(--duration-normal)] ease-[var(--ease-out-expo)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-[var(--brand-primary)] data-[state=checked]:shadow-[0_0_12px_color-mix(in_srgb,var(--brand-primary)_25%,transparent)]',
      'data-[state=unchecked]:bg-[var(--muted)]',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0',
        'transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out-expo)]',
        'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
        'rtl:data-[state=checked]:-translate-x-5 rtl:data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
