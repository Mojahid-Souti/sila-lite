type Props = {
  value: number;
  readonly?: boolean;
  onChange?: (v: number) => void;
};

export function RatingStars({ value, readonly = false, onChange }: Props) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(star)}
          className={`text-base leading-none transition-colors ${
            readonly ? "cursor-default" : "cursor-pointer hover:text-amber-400"
          } ${star <= Math.round(value) ? "text-amber-400" : "text-neutral-200"}`}
          aria-label={readonly ? `${value} stars` : `Rate ${star} stars`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
