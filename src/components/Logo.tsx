interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <span className={`text-2xl font-bold tracking-tight ${className || ''}`}>
      <span className="text-primary">m</span>
      <span className="text-foreground">etana</span>
    </span>
  );
}
