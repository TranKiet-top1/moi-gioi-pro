import { parsePremiseDescription } from "./ai-parser.js";

export const premiseParserExamples = [
  "MT Nguyễn Trãi Q5\n5x20\n1 trệt 3 lầu\ngiá 75tr\ncọc 3 tháng\nphù hợp cafe",
  "HXH Lê Văn Sỹ, Quận 3, ngang 4.5 dài 18, 2 lầu, giá 45 triệu, hợp spa",
  "Mặt tiền Cách Mạng Tháng 8 Q10, 8x25, trệt 2 lầu, 120tr, showroom",
  "Hẻm xe hơi Hoàng Hoa Thám Tân Bình 4x16 1 trệt 1 lầu giá 28m phù hợp văn phòng",
  "Q1 đường Pasteur, 6 x 22, 1 hầm 5 tầng, thuê 180 triệu, phù hợp nhà hàng",
  "Phú Nhuận - Phan Xích Long - 5x18 - trệt 3 lầu - giá 70tr - cafe / trà sữa",
  "Gò Vấp, Nguyễn Oanh, ngang 7 dài 20, dt 140m2, 2 lầu, giá 55 triệu",
  "MT Điện Biên Phủ Bình Thạnh 4.2x20 trệt lửng 2 lầu giá 65tr phù hợp nha khoa",
  "Tân Phú đường Tân Sơn Nhì hẻm 6m 5x17 3 tầng giá 38tr cọc 2 tháng",
  "Quận 7 Nguyễn Thị Thập, 10x30, 1 trệt 4 lầu, giá 250000000, phù hợp siêu thị mini",
];

export async function runPremiseParserExamples() {
  const results = [];
  for (const description of premiseParserExamples) {
    results.push({
      description,
      result: await parsePremiseDescription(description),
    });
  }
  console.table(results.map((item) => ({ description: item.description, ...item.result })));
  return results;
}
