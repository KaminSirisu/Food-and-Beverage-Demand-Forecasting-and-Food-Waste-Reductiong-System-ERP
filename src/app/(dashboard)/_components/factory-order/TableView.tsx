// All-items table: every SKU with an editable Left now (SM4) and Order stepper.
import { OrderBadges } from "./OrderBadges";
import { Stepper } from "./Stepper";
import { tone, type Handlers, type Line } from "./order-view";

type Props = { rows: Line[] } & Handlers;

export function TableView({ rows, onLeft, onOrder, locked }: Props) {
    const edge = { red: "border-l-red-400", amber: "border-l-amber-400" };
    const bg = { red: "bg-red-50/40", amber: "bg-amber-50/40" };

    return (
        <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                        <th className="px-3 py-2 font-semibold">Item</th>
                        {["Left now", "Tonight", "Usable", "Need", "Suggested", "Order"].map((h) => (
                            <th key={h} className="px-3 py-2 text-center font-semibold">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rows.map(({ input, row }) => {
                        const t = tone(row);
                        return (
                            <tr key={input.itemNo} className={t ? bg[t] : ""}>
                                <td className={`border-l-4 px-3 py-3 ${t ? edge[t] : "border-l-transparent"}`}>
                                    <p className="font-semibold text-slate-900">{input.itemNo}</p>
                                    <p className="text-xs text-slate-500">{input.nameTh} · {input.shelfLifeDays} {input.shelfLifeDays === 1 ? "day" : "days"}</p>
                                    <OrderBadges row={row} />
                                </td>
                                <td className="px-3 text-center">
                                    <input
                                        type="number"
                                        min={0}
                                        inputMode="numeric"
                                        aria-label={`${input.itemNo} left now`}
                                        value={row.leftNow}
                                        disabled={locked}
                                        onChange={(e) => onLeft(input.itemNo, e.target.value)}
                                        className="w-16 rounded-lg border border-slate-300 py-1.5 text-center font-semibold"
                                    />
                                </td>
                                <td className="px-3 text-center font-semibold">{row.tonight}</td>
                                <td className={`px-3 text-center font-semibold ${row.usable === 0 ? "text-slate-400" : ""}`}>{row.usable}</td>
                                <td className="px-3 text-center font-semibold">{row.need}</td>
                                <td className="px-3 text-center text-base font-bold">{row.suggested}</td>
                                <td className="px-3 text-center">
                                    <Stepper label={`${input.itemNo} order`} value={row.ordered} onChange={(v) => onOrder(input.itemNo, v)} disabled={locked} />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500">
                Tonight = expected left at close · Usable = can sell tomorrow · Need = tomorrow&apos;s forecast · Suggested = Need − Usable
            </p>
        </div>
    );
}