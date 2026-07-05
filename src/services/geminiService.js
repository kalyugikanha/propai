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
const generatePropertyRecommendation = async ({ properties, session, userMessage = '', chatHistory = [] }) => {
  const propertySummary = properties
    .map(
      (p, i) =>
        `${i + 1}. ${p['Project Name'] || p.name} at ${p['Location'] || p.location} — Budget: ₹${p['Min Budget'] || p.minBudget}–₹${p['Max Budget'] || p.maxBudget}, Size: ${p['Size (Sqft)'] || p.size}. ${p['Description'] || p.description}`
    )
    .join('\n');

  const budgetStr = session.budget?.raw || 'as mentioned';
  const name = session.name || 'there';

  const historyStr = chatHistory.length > 0 
    ? `\nPREVIOUS CHAT HISTORY:\n${chatHistory.map(m => `${m.role === 'user' ? 'User' : 'You'}: ${m.content}`).join('\n')}\n`
    : '';

  const prompt = `
${getSystemPrompt()}

---

TASK: Write a warm, natural response to the user's latest message in English. Address the user as "${name}".
${historyStr}
USER'S LATEST MESSAGE: "${userMessage || 'Show me properties'}"

THEIR REQUIREMENTS:
- Property Type: ${session.propertyType}
- Preferred Location: ${session.location}
- Budget: ${budgetStr}

MATCHED PROPERTIES:
${propertySummary}

---

RESPONSE RULES:
- Address the user as "${name}"
- CRITICAL SCRIPT 1: If the USER'S LATEST MESSAGE is asking for a call, contact, or saying "yes" to a call, you MUST reply EXACTLY: "Thanks for sharing details, our team will call you in next 24 hours."
- CRITICAL SCRIPT 2: If the USER'S LATEST MESSAGE is asking for a visit, you MUST ask: "Kab visit karna hai? Please let me know your preferred date and time."
- CRITICAL SCRIPT 3: If the USER'S LATEST MESSAGE provides BOTH a date and time for a visit, you MUST reply EXACTLY: "Thanks for booking your visit, our expert will connect you in next 24 hours. Thanks."
- CRITICAL SCRIPT 4: If the user is just saying hi or if this is the first time showing the properties (and they haven't said call/visit yet), sound genuinely excited about the matches, mention key highlights, and you MUST end your message with EXACTLY: "If you liked that property then we can setup a call with expert or are you planning for a visit?"
- Keep the response conversational, under 80 words, NO markdown, NO bullet points, NO asterisks.

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
const generateNoResultsResponse = async (session, userMessage = '', chatHistory = []) => {
  const name = session.name || 'ji';
  const historyStr = chatHistory.length > 0 
    ? `\nPREVIOUS CHAT HISTORY:\n${chatHistory.map(m => `${m.role === 'user' ? 'User' : 'You'}: ${m.content}`).join('\n')}\n`
    : '';

  const prompt = `
${getSystemPrompt()}

---

TASK: Write a warm response to the user. No matching properties were found for their exact criteria.
${historyStr}
USER'S LATEST MESSAGE: "${userMessage || 'Show me properties'}"

THEIR REQUIREMENTS:
- Property Type: ${session.propertyType}
- Location: ${session.location}
- Budget: ${session.budget?.raw || 'as mentioned'}

Write an empathetic English response that:
- Addresses them as "${name}"
- CRITICAL SCRIPT 1: If the USER'S LATEST MESSAGE is asking for a call, contact, or saying "yes" to a call, you MUST reply EXACTLY: "Thanks for sharing details, our team will call you in next 24 hours."
- CRITICAL SCRIPT 2: If the USER'S LATEST MESSAGE is asking for a visit, you MUST ask: "Kab visit karna hai? Please let me know your preferred date and time."
- CRITICAL SCRIPT 3: If the USER'S LATEST MESSAGE provides BOTH a date and time for a visit, you MUST reply EXACTLY: "Thanks for booking your visit, our expert will connect you in next 24 hours. Thanks."
- If they aren't asking for a call or visit, genuinely apologize (1 sentence) for no exact matches, suggest exploring a slightly different area or budget, and say our Investment Manager has access to exclusive off-market properties. End by asking: "Would you like us to setup a call with an expert to discuss?"
- Keep the response conversational, under 80 words, DO NOT use markdown.

YOUR RESPONSE:
`.trim();

  return callGemini(prompt);
};

/**
 * Generate an excited opening message for a Hot Deal property inquiry.
 * @param {object} params
 * @param {string} params.propertyName
 * @param {string} params.propertyLocation
 * @param {string} params.userName
 * @returns {Promise<string>}
 */
const generateHotDealOpeningMessage = async ({ propertyName, propertyLocation, userName }) => {
  const prompt = `
You are Priya, a warm AI property advisor at JaipurPropIQ Jaipur.
${userName} showed interest in: ${propertyName} at ${propertyLocation}.
Write a SHORT 2-sentence excited welcome + ask ONE question about visit timeline or specific requirements.
Professional English tone. No markdown. Max 50 words.
`.trim();
  return callGemini(prompt);
};

/**
 * Generate a direct chat response without performing a property search.
 * @param {object} params
 */
const generateChatResponse = async ({ session, userMessage = '', chatHistory = [] }) => {
  const name = session.name || 'there';
  const historyStr = chatHistory.length > 0 
    ? `\nPREVIOUS CHAT HISTORY:\n${chatHistory.map(m => `${m.role === 'user' ? 'User' : 'You'}: ${m.content}`).join('\n')}\n`
    : '';

  const prompt = `
${getSystemPrompt()}

---

TASK: Write a natural, helpful response to the user's latest message in English. Address the user as "${name}".
${historyStr}
USER'S LATEST MESSAGE: "${userMessage}"

THEIR STATED REQUIREMENTS SO FAR (if any):
- Property Type: ${session.propertyType || 'Unknown'}
- Preferred Location: ${session.location || 'Unknown'}
- Budget: ${session.budget?.raw || 'Unknown'}

RESPONSE RULES:
- Address the user as "${name}"
- CRITICAL SCRIPT 1: If the USER'S LATEST MESSAGE is asking for a call, contact, or saying "yes" to a call, you MUST reply EXACTLY: "Thanks for sharing details, our team will call you in next 24 hours."
- CRITICAL SCRIPT 2: If the USER'S LATEST MESSAGE is asking for a visit, you MUST ask: "Kab visit karna hai? Please let me know your preferred date and time."
- CRITICAL SCRIPT 3: If the USER'S LATEST MESSAGE provides BOTH a date and time for a visit, you MUST reply EXACTLY: "Thanks for booking your visit, our expert will connect you in next 24 hours. Thanks."
- CRITICAL SCRIPT 4: If the user just downloaded a brochure (e.g. they say "I downloaded the brochure" or a hidden event message says it), proactively say: "I see you downloaded the brochure! If you liked the property, are you planning for a visit or do you need a call with our expert?"
- If they are asking about a specific property (like JVJ Silicon Valley), provide a helpful general real estate response and ask if they want to setup a call with an expert to get exclusive details.
- Keep the response conversational, under 80 words, NO markdown, NO bullet points, NO asterisks.

YOUR RESPONSE:
`.trim();

  return callGemini(prompt);
};

module.exports = {
  generateResponse,
  generatePropertyRecommendation,
  parseBudgetWithAI,
  generateNoResultsResponse,
  generateHotDealOpeningMessage,
  generateChatResponse,
};
