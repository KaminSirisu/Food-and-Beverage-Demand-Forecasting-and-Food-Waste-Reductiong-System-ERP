type FieldProps = React.ComponentProps<"input"> & { id: string; label: string; errors?: string[] };

export function Field({ id, label, errors, ...input }: FieldProps) {
    const hasError = Boolean(errors?.length);
    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={id} className="text-sm font-medium text-slate-900">
                {label}
            </label>
            <input 
                id={id}
                aria-invalid={hasError}
                aria-describedby={hasError ? `${id}-error` : undefined}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 aria-invalid:border-red-500 read-only:bg-slate-50 read-only:text-slate-500"
                {...input}
            />
            {hasError && (
                <p id={`${id}-error`} className="text-xs text-red-600">
                    {errors![0]}
                </p>
            )}
        </div>
    )
}