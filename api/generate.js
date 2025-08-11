const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text } = req.body || {};

    if (typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Field `text` (non-empty string) is required' });
    }

    const SYSTEM_PROMPT = `I will provide you with multiple text blocks containing names, addresses, phone numbers, and sometimes email IDs or course amounts.

Please convert each block into a JSON object with only three fields:

"name" – Properly capitalized.

"address" – Merge all address lines including the pincode into one line, separated by commas.

"phone" – Return as a string. If there are multiple phone numbers, put them in an array of strings. Remove country codes like +91 and whitespace inside numbers.

Do not include email, course amount, or any other fields.
Output should be a JSON array of objects.

Here's the format to follow:

[
  {
    "name": "Full Name",
    "address": "Full address, including pincode",
    "phone": "Phone number as string or array"
  }
]

Return ONLY the final JSON array as valid JSON, with no additional text, no code fences, and no explanations.`;

    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0,
      stream: false
    });

    const content = response.choices?.[0]?.message?.content ?? '';

    // Try to extract JSON array from the content robustly
    let resultToSend = content;
    try {
      // If content includes extra text, try to find the first [ ... ] block
      const start = content.indexOf('[');
      const end = content.lastIndexOf(']');
      const maybeJson = start !== -1 && end !== -1 && end > start
        ? content.slice(start, end + 1)
        : content;
      resultToSend = JSON.parse(maybeJson);
    } catch (_) {
      // leave as-is; caller will see raw text
    }

    return res.status(200).json(resultToSend);
  } catch (error) {
    const message = error?.response?.data || error?.message || 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
