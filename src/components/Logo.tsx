type LogoVariant = "horizontal-green" | "horizontal-white" | "vertical" | "emblem";

const LOGO_SOURCES: Record<LogoVariant, string> = {
  "horizontal-green": "/brand/ashara-logo-horizontal-green.png",
  "horizontal-white": "/brand/ashara-logo-horizontal-white.png",
  vertical: "/brand/ashara-logo-vertical.png",
  emblem: "/brand/ashara-emblem-gold.png"
};

export function Logo({
  variant = "horizontal-green",
  className = "",
  priority = false
}: {
  variant?: LogoVariant;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={LOGO_SOURCES[variant]}
      alt="Ashara Mubarakah"
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
