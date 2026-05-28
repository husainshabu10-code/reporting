import { Logo } from "@/components/Logo";

export function LoadingScreen({
  message = "Loading...",
  helperText = "Preparing your workspace",
  fullScreen = true
}: {
  message?: string;
  helperText?: string;
  fullScreen?: boolean;
}) {
  return (
    <section className={fullScreen ? "loading-screen" : "loading-screen loading-screen-inline"} role="status" aria-live="polite" aria-label={message}>
      <div className="loading-card">
        <Logo variant="emblem" className="loading-logo" priority />
        <p className="loading-brand">ASHARA MUBARAKAH</p>
        <p className="loading-message">{message}</p>
        <MinimalDotsLoader />
        <p className="loading-helper">{helperText}</p>
      </div>
    </section>
  );
}

export function MinimalDotsLoader({ label = "Loading" }: { label?: string }) {
  return (
    <span className="minimal-dots-loader" aria-label={label}>
      <span />
      <span />
      <span />
    </span>
  );
}

export function InlineLoader({ label = "Loading" }: { label?: string }) {
  return (
    <span className="inline-loader" role="status" aria-label={label}>
      <MinimalDotsLoader label={label} />
    </span>
  );
}

export function PageSkeleton({ message = "Loading..." }: { message?: string }) {
  return <LoadingScreen message={message} helperText="Preparing your workspace" />;
}
