// Unit tests for the dashboard's projected waste tonight (manual 3.1.2 no. 1).
import { describe, expect, it } from "vitest";
import type { OrderInputs } from "@/lib/orders/formula";
import { projectedWasteTonight } from "./risk";

const line = (o: Partial<OrderInputs> & Pick<OrderInputs, "itemNo">): OrderInputs => ({
    nameTh: o.itemNo, categoryCode: "SB", price: 10, shelfLifeDays: 2, restOfDay: 0, tomorrow: 0, leftNow: 0, savedOrdered: null, ...o,
});

describe("projectedWasteTonight", () => {
    it("counts last-day stock left at close × price", () => {
        // 22 on the shelf, 4 more sold today → 18 left at close × ฿13
        expect(projectedWasteTonight([line({ itemNo: "ST068", price: 13, shelfLifeDays: 1, leftNow: 22, restOfDay: 4 })])).toBe(234);
    });

    it("ignores multi-day items: their leftover is sold tomorrow", () => {
        expect(projectedWasteTonight([line({ itemNo: "SB062", price: 17, shelfLifeDays: 2, leftNow: 40, restOfDay: 10, tomorrow: 11 })])).toBe(0);
    });

    it("is 0 when the item will sell out before close", () => {
        expect(projectedWasteTonight([line({ itemNo: "SC220", price: 13, shelfLifeDays: 1, leftNow: 5, restOfDay: 8 })])).toBe(0);
    });

    it("adds up several SKUs", () => {
        const lines = [
            line({ itemNo: "ST068", price: 13, shelfLifeDays: 1, leftNow: 10, restOfDay: 4 }), // 6 × 13 = 78
            line({ itemNo: "ST058", price: 30, shelfLifeDays: 1, leftNow: 5, restOfDay: 3 }), // 2 × 30 = 60
        ];
        expect(projectedWasteTonight(lines)).toBe(138);
    });
});
