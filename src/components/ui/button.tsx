import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold whitespace-nowrap transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        primary: 'bg-teal text-white hover:bg-[#0c5a5a]',
        ink: 'bg-ink text-white hover:bg-[#21344f]',
        soft: 'bg-sand text-ink hover:bg-line',
        outline: 'border border-line bg-card text-ink hover:bg-sand',
        ghost: 'text-ink hover:bg-sand',
        danger: 'bg-danger text-white',
        dangerSoft: 'text-danger hover:bg-accent-soft',
      },
      size: { md: 'min-h-12 px-5 text-[16px]', sm: 'min-h-11 px-3.5 text-[15px]', icon: 'h-11 w-11 rounded-full', lg: 'min-h-14 px-6 text-[17px]' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
type Props = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };
export function Button({ className, variant, size, asChild, type, ...p }: Props) {
  const C: any = asChild ? Slot : 'button';
  return <C type={asChild ? undefined : (type ?? 'button')} className={cn(buttonVariants({ variant, size }), className)} {...p} />;
}
