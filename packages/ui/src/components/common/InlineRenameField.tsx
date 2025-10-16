import { useEffect, useId, useState, type FormEvent, type ReactElement } from "react";
import { Pencil, X } from "lucide-react";

const DEFAULT_MAX_LENGTH = 64;
const NAME_PATTERN = /^[\p{L}\p{N} .,'\-()]+$/u;

function validateName(value: string, maxLength: number): string | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "Name cannot be empty.";
  }

  if (trimmed.length > maxLength) {
    return `Name must be ${maxLength} characters or fewer.`;
  }

  if (!NAME_PATTERN.test(trimmed)) {
    return "Name contains unsupported characters.";
  }

  return null;
}

export interface InlineRenameFieldProps {
  readonly name: string;
  readonly label: string;
  readonly renameLabel?: string;
  readonly submitLabel?: string;
  readonly maxLength?: number;
  readonly disabledReason?: string;
  readonly onSubmit: (nextName: string) => Promise<void> | void;
}

export function InlineRenameField({
  name,
  label,
  renameLabel = "Rename",
  submitLabel = "Save",
  maxLength = DEFAULT_MAX_LENGTH,
  disabledReason,
  onSubmit
}: InlineRenameFieldProps): ReactElement {
  const inputId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setDraft(name);
    setIsEditing(false);
    setError(null);
    setIsSubmitting(false);
  }, [name]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateName(draft, maxLength);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (draft.trim() === name.trim()) {
      setIsEditing(false);
      setError(null);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(draft.trim());
      setIsEditing(false);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message.length > 0 ? message : "Failed to submit rename intent.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <h2 className="text-3xl font-semibold text-text-primary" aria-live="polite">
          {name}
        </h2>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border-base bg-canvas-base px-3 py-1 text-sm font-medium text-text-primary transition hover:border-accent-primary/40 hover:bg-canvas-subtle/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
          onClick={() => {
            setIsEditing(true);
            setDraft(name);
            setError(null);
          }}
          disabled={Boolean(disabledReason)}
          title={disabledReason}
        >
          <Pencil aria-hidden="true" className="size-4" />
          {renameLabel}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2"
      aria-label={`Rename ${label.toLowerCase()}`}
    >
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        value={draft}
        maxLength={maxLength}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        className="rounded-lg border border-border-base bg-canvas-base px-3 py-1 text-3xl font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        disabled={isSubmitting}
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg border border-accent-primary/60 bg-accent-primary/10 px-3 py-1 text-sm font-medium text-text-primary transition hover:border-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised disabled:opacity-60"
          disabled={isSubmitting}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border-base bg-canvas-base px-3 py-1 text-sm text-text-muted transition hover:border-border-strong hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
          onClick={() => {
            setIsEditing(false);
            setDraft(name);
            setError(null);
          }}
          disabled={isSubmitting}
        >
          <X aria-hidden="true" className="size-4" />
          Cancel
        </button>
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-accent-critical">
          {error}
        </p>
      ) : null}
    </form>
  );
}
