import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`inline-flex items-center ${className || ""}`}>
        <img
          src="/metana-logo-light.png"
          alt="Metana Expert Coding Bootcamps"
          className="h-8 w-auto object-contain"
        />
      </div>
    );
  }

  const currentTheme = theme === "system" ? systemTheme : theme;
  const isDark = currentTheme === "dark";

  return (
    <div className={`inline-flex items-center ${className || ""}`}>
      <img
        src={isDark ? "/metana-logo.png" : "/metana-logo-light.png"}
        alt="Metana Expert Coding Bootcamps"
        className="h-8 w-auto object-contain"
      />
    </div>
  );
}
