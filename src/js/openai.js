const PARSER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    district: { type: ["string", "null"] },
    ward: { type: ["string", "null"] },
    street: { type: ["string", "null"] },
    width: { type: ["number", "null"] },
    length: { type: ["number", "null"] },
    area: { type: ["number", "null"] },
    floors: { type: ["number", "null"] },
    price: { type: ["number", "null"] },
    deposit_months: { type: ["number", "null"] },
    business_type: { type: ["string", "null"] },
    road_type: { type: ["string", "null"], enum: ["Mặt tiền", "Hẻm xe hơi", "Hẻm", null] },
  },
  required: [
    "district",
    "ward",
    "street",
    "width",
    "length",
    "area",
    "floors",
    "price",
    "deposit_months",
    "business_type",
    "road_type",
  ],
};

function getEnvValue(key) {
  return import.meta.env?.[key] || "";
}

function extractResponseText(response) {
  if (response?.output_text) return response.output_text;

  const contentItems = response?.output?.flatMap((item) => item.content || []) || [];
  const textItem = contentItems.find((item) => item.type === "output_text" && item.text);
  return textItem?.text || "";
}

async function callConfiguredParserEndpoint(text, regexResult) {
  const endpoint = getEnvValue("VITE_OPENAI_PARSER_ENDPOINT");
  if (!endpoint) return null;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, regexResult }),
  });

  if (!response.ok) {
    throw new Error(`Parser endpoint failed: ${response.status}`);
  }

  return response.json();
}

export async function callOpenAIParser(text, regexResult = {}) {
  try {
    const endpointResult = await callConfiguredParserEndpoint(text, regexResult);
    if (endpointResult) return endpointResult;

    const apiKey = getEnvValue("VITE_OPENAI_API_KEY");
    if (!apiKey) {
      console.info("[AI Parser] Missing VITE_OPENAI_API_KEY or VITE_OPENAI_PARSER_ENDPOINT. Using regex only.");
      return null;
    }

    const model = getEnvValue("VITE_OPENAI_MODEL") || "gpt-5-mini";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "Bạn là parser dữ liệu mặt bằng cho thuê tại Việt Nam.",
                  "Chỉ trả JSON hợp lệ theo schema.",
                  "Không markdown, không giải thích, không text thừa.",
                  "Nếu không chắc field nào, dùng null.",
                  "Giá thuê trả bằng VND dạng number. 75tr = 75000000.",
                  "Quận chuẩn hóa dạng 'Quận 5' nếu là Q5/q5.",
                ].join(" "),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({ description: text, regexResult }),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "premise_description_parse",
            strict: true,
            schema: PARSER_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI parser failed: ${response.status}`);
    }

    const data = await response.json();
    const outputText = extractResponseText(data);
    return outputText ? JSON.parse(outputText) : null;
  } catch (error) {
    console.warn("[AI Parser] OpenAI parse failed. Falling back to regex result.", error);
    return null;
  }
}
