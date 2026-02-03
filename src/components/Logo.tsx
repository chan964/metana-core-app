interface LogoProps {
  className?: string;
}
export function Logo({
  className
}: LogoProps) {
  return <span className={`text-2xl font-bold tracking-tight ${className || ''}`}>
      <span className="text-primary">​Metana
    </span>
      
    </span>;
}