const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const nullableString = { type: ['string', 'null'] };

const SCHEMA = {
  name: 'call_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'english', 'extraction'],
    properties: {
      summary: { type: 'string' },
      english: { type: 'array', items: { type: 'string' } },
      extraction: {
        type: 'object',
        additionalProperties: false,
        required: ['patient_name', 'phone', 'reason_for_visit', 'preferred_datetime', 'intent'],
        properties: { patient_name: nullableString, phone: nullableString, reason_for_visit: nullableString, preferred_datetime: nullableString, intent: nullableString },
      },
    },
  },
};

const SYSTEM = `You analyse a phone call between a patient and a dental clinic receptionist in Bangladesh. Turns are numbered and may be in Bangla, English or both.
Return JSON with:
- summary: two or three plain English sentences about what the patient wanted and what was agreed.
- english: an English translation of every turn, same order and same length as the input, one string per turn.
- extraction: patient_name (Latin script), phone (digits as spoken, converted to ASCII), reason_for_visit (English), preferred_datetime (as stated), intent (one of booking, reschedule, cancel, enquiry, callback, other). Use null when unknown. Never invent values.`;

/** Post-call English summary, translation and extraction with a small chat model. */
export class OpenAICallAnalyzer {
  constructor({ apiKey, model = 'gpt-4.1-mini', fetchFn = (...args) => fetch(...args) }) {
    Object.assign(this, { apiKey, model, fetchFn });
  }

  async analyze({ turns }) {
    const transcript = turns.map((t, i) => `${i + 1}. ${t.speaker === 'agent' ? 'Receptionist' : 'Patient'}: ${t.textBn}`).join('\n');
    const response = await this.fetchFn(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: transcript }],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI analysis failed with status ${response.status}`);
    const parsed = JSON.parse((await response.json()).choices[0].message.content);
    const x = parsed.extraction ?? {};
    return {
      summary: parsed.summary,
      english: parsed.english,
      extraction: { patientName: x.patient_name, phone: x.phone, reasonForVisit: x.reason_for_visit, preferredDatetime: x.preferred_datetime, intent: x.intent },
    };
  }
}
