export type ApplicationStatusTone =
  | "neutral"
  | "positive"
  | "warning"
  | "danger"
  | "muted";

export function ApplicationStatusBadge({
  className,
  label,
  tone = "neutral",
}: {
  className?: string;
  label: string;
  tone?: ApplicationStatusTone;
}) {
  const classes = [
    "application-status-badge",
    `application-status-badge--${tone}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{label}</span>;
}
