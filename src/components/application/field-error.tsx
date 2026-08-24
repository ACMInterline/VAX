export function fieldDescriptionIds(
  ...ids: ReadonlyArray<string | false | null | undefined>
): string | undefined {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  return uniqueIds.length > 0 ? uniqueIds.join(" ") : undefined;
}

export function ApplicationFieldError({
  className,
  id,
  messages,
}: {
  className?: string;
  id: string;
  messages: readonly string[];
}) {
  if (messages.length === 0) return null;

  const classes = ["application-field-error", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div id={id} className={classes}>
      {messages.map((message, index) => (
        <p key={`${index}:${message}`}>{message}</p>
      ))}
    </div>
  );
}
