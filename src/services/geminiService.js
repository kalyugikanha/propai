/**
 * Gemini Service
 * Wraps the Google Generative AI SDK.
 *
 * IMPORTANT: Gemini never receives raw Google Sheets data or API credentials.
 * The backend prepares structured context and passes only what Gemini needs.
 *
 * Responsibilities:
 *   - generateResponse()            → conversational replies for any flow step
 *   - generatePropertyRecommendation() → rich recommendation from property list
 *   - parseBudgetWithAI()           → natural language budget extraction fallback
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const { stripMarkdown } = require('../utils/helpers');
const logger = require('../utils/logger');

// ── Initialization ────────────────────────────────────────────────────────────

let _model = null;

const getModel = () => {
  if (!_model) {
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    _model = genAI.getGenerativeModel({
      model: config.geminiModel,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 512,
      },
    });
  }
  return _model;
};

// ── System Prompt ─────────────────────────────────────────────────────────────

let _systemPrompt = null;

const getSystemPrompt = () => {
  if (_systemPrompt) return _systemPrompt;

  const promptPath = path.join(__dirname, '../../../prompts/system-prompt.md');
  if (fs.existsSync(promptPath)) {
    _systemPrompt = fs.readFileSync(promptPath, 'utf-8');
    logger.debug('System prompt loaded from file');
  } else {
    _systemPrompt = `You are ${config.agentName}, a warm and professional AI Property Assistant for ${config.agencyName}, a real estate company based in Jaipur, India. You help visitors find suitable properties and capture their contact details for follow-up.`;
    logger.warn('System prompt file not found. Using default prompt.');
  }

  return _systemPrompt;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const callGemini = async (promptText) => {
  const model = getModel();
  try {
    const result = await model.generateContent(promptText);
    const text = result.response.text().trim();
    return stripMarkdown(text);
  } catch (err) {
    logger.error('Gemini API call failed:', err.message);
    throw new Error('AI service is temporarily unavailable. Please try again in a moment.');
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a conversational response for a given flow step.
 *
 * @param {object} params
 * @param {string} params.userMessage       - raw user input
 * @param {object} params.context           - collected session data (no PII to Gemini for mobile)
 * @param {string} params.step              - current FLOW_STEP
 * @param {string} [params.customInstruction] - override instruction for this specific call
 * @returns {Promise<string>} plain-text response
 */
const generateResponse = async ({ userMessage, context, step, customInstruction }) => {
  // Never send mobile number to Gemini
  const safeContext = { ...context };
  delete safeContext.mobile;

  const prompt = `
${getSystemPrompt()}

---

CURRENT STEP: ${step}
${customInstruction ? `TASK: ${customInstruction}` : ''}

COLLECTED INFORMATION:
${JSON.stringify(safeContext, null, 2)}

USER SAID: "${userMessage || '(no message)'}"

---

RESPONSE RULES:
- Respond in warm, conversational English (2-4 sentences max)
- Do NOT use markdown, asterisks, bullet points, or headings
- Do NOT mention "step names" or internal logic
- Do NOT make up property details
- If asking a question, ask ONE question only
- Address the visitor by first name if known
- Stay focused on Jaipur real estate

YOUR RESPONSE:
`.trim();

  return callGemini(prompt);
};

/**
 * Generate a property recommendation message from a list of matched properties.
 *
 * @param {object} params
 * @param {object[]} params.properties  - formatted property objects from propertyService
 * @param {object} params.session       - current session (name, propertyType, location, budget)
 * @returns {Promise<string>}
 */
const generatePropertyRecommendation = async ({ properties, session }) => {
  const propertySummary = properties
    .map(
      (p, i) =>
        `${i + 1}. ${p['Project Name'] || p.name} — ${p['Location'] || p.location}, ${p['Size (Sqft)'] || p.size} sqft. ${p['Description'] || p.description}`
    )
    .join('\n');

  const budgetStr = session.budget?.raw || 'as mentioned';

  const prompt = `
${getSystemPrompt()}

---

TASK: Write a property recommendation message for a visitor named ${session.name || 'the visitor'}.

THEIR REQUIREMENTS:
- Property Type: ${session.propertyType}
- Preferred Location: ${session.location}
- Budget: ${budgetStr}

TOP MATCHING PROPERTIES:
${propertySummary}

---

RESPONSE RULES:
- Address ${session.name || 'the visitor'} by first name
- Open with excitement that you found great matches
- Naturally mention the property names and locations (no bullet points or markdown)
- Keep it under 80 words
- End by asking: "Would you like our Investment Manager to contact you with more details?"
- Do NOT use asterisks, markdown, or list formatting

YOUR RESPONSE:
`.trim();

  return callGemini(prompt);
};

/**
 * Use Gemini to extract a budget amount from freeform text (fallback when budgetParser fails).
 *
 * @param {string} userMessage
 * @returns {Promise<{ amount: number|null, raw: string|null }>}
 */
const parseBudgetWithAI = async (userMessage) => {
  const prompt = `
Extract the budget amount from the user's message. Return ONLY valid JSON with no explanation.

Message: "${userMessage}"

Required format: {"amount": <number in INR>, "raw": "<original budget text>"}

Conversion rules:
- 1 Crore = 10,000,000
- 1 Lakh = 100,000
- Examples:
  "50 lakhs" → {"amount": 5000000, "raw": "50 lakhs"}
  "1 crore"  → {"amount": 10000000, "raw": "1 crore"}
  "1.5 cr"   → {"amount": 15000000, "raw": "1.5 cr"}
  "80L"      → {"amount": 8000000, "raw": "80L"}
  "2.5 crore"→ {"amount": 25000000, "raw": "2.5 crore"}

If no budget is found: {"amount": null, "raw": null}

JSON ONLY:
`.trim();

  try {
    const model = getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Extract JSON safely
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        amount: parsed.amount || null,
        raw: parsed.raw || null,
      };
    }
  } catch (err) {
    logger.warn('Gemini budget parse failed:', err.message);
  }

  return { amount: null, raw: null };
};

/**
 * Generate a no-results empathetic response.
 * @param {object} session
 * @returns {Promise<string>}
 */
const generateNoResultsResponse = async (session) => {
  const prompt = `
${getSystemPrompt()}

---

TASK: No matching properties were found for ${session.name || 'the visitor'}.

THEIR REQUIREMENTS:
- Property Type: ${session.propertyType}
- Location: ${session.location}
- Budget: ${session.budget?.raw || 'as mentioned'}

Write an empathetic, helpful response that:
- Apologizes genuinely (1 sentence)
- Explains our Investment Manager has access to exclusive off-market properties
- Asks if they would like our Investment Manager to contact them personally
- Is under 60 words
- Does not use markdown

YOUR RESPONSE:
`.trim();

  return callGemini(prompt);
};

module.exports = {
  generateResponse,
  generatePropertyRecommendation,
  parseBudgetWithAI,
  generateNoResultsResponse,
};
