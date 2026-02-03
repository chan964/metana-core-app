import { SubmissionState } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  state: SubmissionState;
  className?: string;
}

const stateConfig: Record<SubmissionState, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: {
    label: 'Draft',
    variant: 'secondary',
  },
  submitted: {
    label: 'Submitted',
    variant: 'outline',
  },
  graded: {
    label: 'Graded',
    variant: 'default',
  },
  finalised: {
    label: 'Finalised',
    variant: 'default',
  },
};

export function StatusBadge({ state, className }: StatusBadgeProps) {
  const config = stateConfig[state];

  return (
    <Badge 
      variant={config.variant} 
      className={cn(
        state === 'draft' && 'bg-muted text-muted-foreground',
        state === 'submitted' && 'border-primary/50 text-foreground',
        state === 'graded' && 'bg-primary/80 text-primary-foreground',
        state === 'finalised' && 'bg-primary text-primary-foreground',
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
