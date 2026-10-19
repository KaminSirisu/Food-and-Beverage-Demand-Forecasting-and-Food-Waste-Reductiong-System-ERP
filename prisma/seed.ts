// Master data: the flagship branch and the 8 in-scope SKUs (from the slide 2 table).
import { db } from "../src/lib/db";

const SKUS = [
  { itemNo: "SC220", nameTh: "ชิฟฟ่อนมะพร้าวอ่อน", nameEn: "Young coconut chiffon", categoryCode: "SC", categoryName: "Cake slice", price: 13, shelfLifeDays: 1 },
  { itemNo: "SB094", nameTh: "ปังบัตเตอร์มิลค์", nameEn: "Buttermilk bread", categoryCode: "SB", categoryName: "Bread", price: 20, shelfLifeDays: 2 },
  { itemNo: "SB062", nameTh: "ปังบัตเตอร์ครีม", nameEn: "Butter cream bun", categoryCode: "SB", categoryName: "Bread", price: 13, shelfLifeDays: 2 },
  { itemNo: "SB078", nameTh: "ปังเนยสดน้ำตาล", nameEn: "Butter sugar bread", categoryCode: "SB", categoryName: "Bread", price: 10, shelfLifeDays: 2 },
  { itemNo: "ST058", nameTh: "ตะโก้เผือก (4 ชิ้น)", nameEn: "Taro ta-ko (4 pcs)", categoryCode: "ST", categoryName: "Thai dessert", price: 30, shelfLifeDays: 1 },
  { itemNo: "SC076", nameTh: "เค้กส้ม", nameEn: "Orange cake slice", categoryCode: "SC", categoryName: "Cake slice", price: 45, shelfLifeDays: 3 },
  { itemNo: "SCP1993", nameTh: "เค้กมินิมอลมินิ วน-ชมพู", nameEn: "Minimal mini cake", categoryCode: "SCP", categoryName: "Pound cake", price: 90, shelfLifeDays: 5 },
  { itemNo: "ST068", nameTh: "ข้าวต้มมัด", nameEn: "Khao tom mat", categoryCode: "ST", categoryName: "Thai dessert", price: 13, shelfLifeDays: 1 },
];

async function main() {
  // TODO(Leader): confirm the demo branch — slides use 801 (Central Salaya); Appendix A says 804.
  await db.branch.upsert({ where: { storeNo: 801 }, update: { isActive: true }, create: { storeNo: 801, name: "Central Salaya", isActive: true } });
  for (const s of SKUS) {
    await db.sku.upsert({ where: { itemNo: s.itemNo }, update: { ...s, inScope: true }, create: { ...s, inScope: true } });
  }
  // Branch default thresholds (categoryCode = null). Unique keys treat NULLs as distinct, so check first.
  const hasDefault = await db.branchThreshold.findFirst({ where: { storeNo: 801, categoryCode: null } });
  if (!hasDefault) await db.branchThreshold.create({ data: { storeNo: 801 } });
  console.log("seeded: branch 801, 8 SKUs, default thresholds");
}

main().finally(() => db.$disconnect());
