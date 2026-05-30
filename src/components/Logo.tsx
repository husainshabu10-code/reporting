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
  if (variant === "horizontal-green" || variant === "horizontal-white") {
    const toneClass = variant === "horizontal-white" ? "logo-brand-white" : "logo-brand-green";
    return (
      <span className={`logo-brand ${toneClass} ${className}`} aria-label="Ashara Mubarakah">
        <img
          src={LOGO_SOURCES.emblem}
          alt=""
          className="logo-brand-emblem"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          aria-hidden="true"
        />
        <span className="logo-brand-text">
          <span>ASHARA</span>
          <span>MUBARAKAH</span>
        </span>
      </span>
    );
  }

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
