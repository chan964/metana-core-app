import { Link } from "react-router-dom";

export function Logo({ className }: LogoProps) {
  return (
    <Link to="/" className={`inline-flex items-center ${className || ""}`}>
      <img
        src="https://metana.io/wp-content/uploads/2022/07/Metana-Logo.png"
        alt="Metana Expert Coding Bootcamps"
        className="h-8 w-[160px] object-contain"
      />
    </Link>
  );
}
