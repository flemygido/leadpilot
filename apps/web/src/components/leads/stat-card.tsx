import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: string;
  accent?: 'blue' | 'red' | 'green' | 'orange';
}

const ACCENT: Record<NonNullable<StatCardProps['accent']>, string> = {
  blue: 'bg-blue-50 text-blue-700',
  red: 'bg-red-50 text-red-700',
  green: 'bg-green-50 text-green-700',
  orange: 'bg-orange-50 text-orange-700',
};

export function StatCard({ label, value, icon, accent = 'blue' }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg text-lg',
            ACCENT[accent],
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
