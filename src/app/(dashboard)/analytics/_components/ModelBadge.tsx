// NFR8: which model the numbers come from — version, when it was trained, and on what period.
import type { ModelInfo } from "@/lib/analytics/queries";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function ModelBadge({ model }: { model: ModelInfo }) {
    if (!model) {
        return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">No forecast model yet</span>;
    }
    return (
        <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-700">
                <span className="size-1.5 rounded-full bg-indigo-600" aria-hidden />
                Model: LightGBM ONNX · {model.version}
            </span>
            <span className="text-slate-500">
                trained {ymd(model.trainedAt)} · data {ymd(model.dataFrom)} → {ymd(model.dataTo)}
            </span>
        </div>
    );
}
