import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-800',
        hot: 'bg-red-100 text-red-700',
        nurture: 'bg-yellow-100 text-yellow-800',
        unscored: 'bg-slate-100 text-slate-500',
        success: 'bg-green-100 text-green-700',
        info: 'bg-blue-100 text-blue-700',
        warning: 'bg-orange-100 text-orange-700',
        muted: 'bg-slate-100 text-slate-600',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
