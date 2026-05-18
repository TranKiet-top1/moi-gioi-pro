import { parseCustomerRequest } from "./ai-request-parser.js";

const examples = [
  "Kh\u00e1ch c\u1ea7n Q1 d\u01b0\u1edbi 80tr, ngang tr\u00ean 5m, m\u1edf cafe",
  "T\u00ecm m\u1eb7t b\u1eb1ng Qu\u1eadn 3 ho\u1eb7c Qu\u1eadn 10, gi\u00e1 kho\u1ea3ng 60 tri\u1ec7u, h\u1ebbm xe h\u01a1i",
  "C\u1ea7n nh\u00e0 m\u1eb7t ti\u1ec1n d\u01b0\u1edbi 100tr, di\u1ec7n t\u00edch tr\u00ean 120m2, ph\u00f9 h\u1ee3p showroom",
  "Spa c\u1ea7n m\u1eb7t b\u1eb1ng T\u00e2n B\u00ecnh, gi\u00e1 40-70tr, c\u00f3 nhi\u1ec1u ph\u00f2ng",
  "C\u1ea7n m\u1eb7t b\u1eb1ng g\u1ea7n trung t\u00e2m, m\u1eb7t ti\u1ec1n, ng\u00e2n s\u00e1ch 150 tri\u1ec7u",
  "Cafe take away c\u1ea7n ngang 4m tr\u1edf l\u00ean, Qu\u1eadn 1 ho\u1eb7c Ph\u00fa Nhu\u1eadn",
  "V\u0103n ph\u00f2ng c\u1ea7n 2 l\u1ea7u tr\u1edf l\u00ean, gi\u00e1 d\u01b0\u1edbi 50tr",
  "Nh\u00e0 h\u00e0ng c\u1ea7n di\u1ec7n t\u00edch l\u1edbn tr\u00ean 200m2",
  "Kh\u00e1ch mu\u1ed1n thu\u00ea \u1edf B\u00ecnh Th\u1ea1nh, h\u1ebbm xe h\u01a1i, d\u01b0\u1edbi 45tr",
  "Showroom c\u1ea7n m\u1eb7t b\u1eb1ng \u0111\u1eb9p, m\u1eb7t ti\u1ec1n, Q7, ng\u00e2n s\u00e1ch 120tr",
];

export async function runAISuggestParserExamples() {
  for (const example of examples) {
    console.log(example, await parseCustomerRequest(example));
  }
}

export { examples as aiSuggestParserExamples };
