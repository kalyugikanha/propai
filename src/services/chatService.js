/**
 * Chat Service — Conversation State Machine
 *
 * This is the primary brain of the application.
 * It receives a (sessionId, userMessage) pair and advances the conversation
 * through the defined FLOW_STEPS, coordinating all other services.
 *
 * Flow:
 *   startSession()    → called when widget opens (returns auto-greeting)
 *   processMessage()  → called for every user message
 */

const sessionService = require('./sessionService');
const propertyService = require('./propertyService');
const leadService = require('./leadService');
const geminiService = require('./geminiService');
const { parse: parseBudget } = require('../utils/budgetParser');
const { isValidIndianMobile, sanitizeString, getFirstName } = require('../utils/helpers');
const {
  FLOW_STEPS,
  PROPERTY_TYPES,
  JAIPUR_LOCATIONS,
  LOCATION_QUICK_REPLY_LIMIT,
  BUDGET_QUICK_REPLIES,
} = require('../config/constants');
const config = require('../config/env');
const logger = require('../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────

const YES_KEYWORDS = ['yes', 'haan', 'ha', 'ok', 'okay', 'sure', 'contact', 'call', 'connect', 'please'];
const NO_KEYWORDS = ['no', 'nahi', 'nope', 'not', 'thanks'];
const RESTART_KEYWORDS = ['more', 'again', 'search', 'different', 'other', 'change', 'restart'];

const containsAny = (text, keywords) =>
  keywords.some((kw) => text.toLowerCase().includes(kw));

// ── Response Builder ──────────────────────────────────────────────────────────

const buildResponse = (override = {}) => ({
  reply: '',
  step: FLOW_STEPS.COLLECT_NAME,
  quickReplies: [],
  properties: [],
  ...override,
});

// ── Start Session (Initial Greeting) ─────────────────────────────────────────

/**
 * Called when the chat widget opens.
 * Creates (or restores) a session and returns the greeting message.
 *
 * @param {string} sessionId
 * @returns {{ sessionId, reply, step, quickReplies, properties }}
 */
const startSession = (sessionId) => {
  // If session already exists and is mid-flow, restore it
  const existing = sessionService.getSession(sessionId);
  if (existing && existing.step !== FLOW_STEPS.DONE) {
    logger.info(`Restoring session: ${sessionId} at step ${existing.step}`);
    return buildResponse({
      reply: `Welcome back, ${getFirstName(existing.name) || 'there'}! 👋 Let's continue where we left off.`,
      step: existing.step,
      quickReplies: getQuickRepliesForStep(existing.step),
    });
  }

  // New session
  const session = sessionService.createSession(sessionId);
  logger.info(`New session started: ${sessionId}`);

  return buildResponse({
    reply:
      `Hello 👋\n\nWelcome to ${config.agencyName}.\n\nI'm ${config.agentName}, your AI Property Assistant. I'm here to help you find the perfect property in Jaipur!\n\nMay I know your name?`,
    step: FLOW_STEPS.COLLECT_NAME,
  });
};

// ── Quick Replies per Step ────────────────────────────────────────────────────

const getQuickRepliesForStep = (step) => {
  switch (step) {
    case FLOW_STEPS.COLLECT_PROPERTY_TYPE:
      return PROPERTY_TYPES;
    case FLOW_STEPS.COLLECT_LOCATION:
      return JAIPUR_LOCATIONS.slice(0, LOCATION_QUICK_REPLY_LIMIT);
    case FLOW_STEPS.COLLECT_BUDGET:
      return BUDGET_QUICK_REPLIES;
    case FLOW_STEPS.SHOW_RESULTS:
    case FLOW_STEPS.NO_RESULTS:
    case FLOW_STEPS.CONFIRM_CONTACT:
      return ['Yes, contact me 📞', 'Search again 🔄'];
    default:
      return [];
  }
};

// ── Main Message Processor ────────────────────────────────────────────────────

/**
 * Process an incoming user message against the current session step.
 *
 * @param {string} sessionId
 * @param {string} rawMessage
 * @returns {Promise<object>} response payload for the widget
 */
const processMessage = async (sessionId, rawMessage) => {
  const message = sanitizeString(rawMessage, 500);

  // Get or create session
  let session = sessionService.getSession(sessionId);
  if (!session) {
    session = sessionService.createSession(sessionId);
    logger.info(`Session not found, created new: ${sessionId}`);
  }

  // Touch activity timestamp
  sessionService.updateActivity(sessionId);

  // Append user message to history
  sessionService.addMessage(sessionId, 'user', message);

  logger.info(`[${sessionId}] Step: ${session.step} | Message: "${message.slice(0, 60)}"`);

  let response;

  // ── State Machine ───────────────────────────────────────────────────────────

  switch (session.step) {

    // ─────────────────────────────────────────────────────────────────────────
    case FLOW_STEPS.COLLECT_NAME: {
      const name = message.trim().split(/\s+/).slice(0, 3).join(' ');
      sessionService.updateSession(sessionId, { name });

      const reply = await geminiService.generateResponse({
        userMessage: message,
        context: { name },
        step: FLOW_STEPS.COLLECT_NAME,
        customInstruction: `The visitor's name is "${name}". Welcome them warmly by first name. Then politely ask for their 10-digit mobile number so our Investment Manager can reach them if needed.`,
      });

      sessionService.updateStep(sessionId, FLOW_STEPS.COLLECT_MOBILE);
      response = buildResponse({ reply, step: FLOW_STEPS.COLLECT_MOBILE });
      break;
    }

    // ─────────────────────────────────────────────────────────────────────────
    case FLOW_STEPS.COLLECT_MOBILE: {
      const cleaned = message.replace(/[\s\-()]/g, '');

      if (!isValidIndianMobile(cleaned)) {
        response = buildResponse({
          reply: `Please enter a valid 10-digit Indian mobile number (starting with 6-9). For example: 9876543210`,
          step: FLOW_STEPS.COLLECT_MOBILE,
        });
        break;
      }

      sessionService.updateSession(sessionId, { mobile: cleaned });

      const reply = await geminiService.generateResponse({
        userMessage: message,
        context: { name: session.name },
        step: FLOW_STEPS.COLLECT_MOBILE,
        customInstruction: `Mobile number confirmed. Now ask ${getFirstName(session.name)} what type of property they are looking for. Mention the options: Villa, Plot, Apartment, or Commercial.`,
      });

      sessionService.updateStep(sessionId, FLOW_STEPS.COLLECT_PROPERTY_TYPE);
      response = buildResponse({
        reply,
        step: FLOW_STEPS.COLLECT_PROPERTY_TYPE,
        quickReplies: PROPERTY_TYPES,
      });
      break;
    }

    // ─────────────────────────────────────────────────────────────────────────
    case FLOW_STEPS.COLLECT_PROPERTY_TYPE: {
      const typeMatch = PROPERTY_TYPES.find((t) =>
        message.toLowerCase().includes(t.toLowerCase())
      );

      if (!typeMatch) {
        response = buildResponse({
          reply: `Please select a property type: Villa, Plot, Apartment, or Commercial.`,
          step: FLOW_STEPS.COLLECT_PROPERTY_TYPE,
          quickReplies: PROPERTY_TYPES,
        });
        break;
      }

      sessionService.updateSession(sessionId, { propertyType: typeMatch });

      const reply = await geminiService.generateResponse({
        userMessage: message,
        context: { name: session.name, propertyType: typeMatch },
        step: FLOW_STEPS.COLLECT_PROPERTY_TYPE,
        customInstruction: `${getFirstName(session.name)} wants a ${typeMatch}. Now ask which area or locality in Jaipur they prefer. You can suggest: Jagatpura, Vaishali Nagar, Ajmer Road, Tonk Road, or any other area.`,
      });

      sessionService.updateStep(sessionId, FLOW_STEPS.COLLECT_LOCATION);
      response = buildResponse({
        reply,
        step: FLOW_STEPS.COLLECT_LOCATION,
        quickReplies: JAIPUR_LOCATIONS.slice(0, LOCATION_QUICK_REPLY_LIMIT),
      });
      break;
    }

    // ─────────────────────────────────────────────────────────────────────────
    case FLOW_STEPS.COLLECT_LOCATION: {
      const inputLower = message.toLowerCase().trim();

      // Try to match a known locality (for clean data)
      const matched = JAIPUR_LOCATIONS.find(
        (loc) =>
          inputLower.includes(loc.toLowerCase()) ||
          loc.toLowerCase().includes(inputLower)
      );
      const location = matched || message.trim();

      sessionService.updateSession(sessionId, { location });

      const reply = await geminiService.generateResponse({
        userMessage: message,
        context: { name: session.name, propertyType: session.propertyType, location },
        step: FLOW_STEPS.COLLECT_LOCATION,
        customInstruction: `Location is "${location}". Now ask ${getFirstName(session.name)} for their budget. Mention they can say it naturally like "50 Lakhs", "1 Crore", etc.`,
      });

      sessionService.updateStep(sessionId, FLOW_STEPS.COLLECT_BUDGET);
      response = buildResponse({
        reply,
        step: FLOW_STEPS.COLLECT_BUDGET,
        quickReplies: BUDGET_QUICK_REPLIES,
      });
      break;
    }

    // ─────────────────────────────────────────────────────────────────────────
    case FLOW_STEPS.COLLECT_BUDGET: {
      // Try fast local parser first, fall back to Gemini
      let budgetAmount = parseBudget(message);
      let budgetRaw = message.trim();

      if (!budgetAmount) {
        const aiParsed = await geminiService.parseBudgetWithAI(message);
        budgetAmount = aiParsed.amount;
        budgetRaw = aiParsed.raw || message.trim();
      }

      if (!budgetAmount) {
        response = buildResponse({
          reply: `I couldn't quite understand that. Could you tell me your budget in Lakhs or Crores? For example: "50 Lakhs", "1 Crore", or "2.5 Crore".`,
          step: FLOW_STEPS.COLLECT_BUDGET,
          quickReplies: BUDGET_QUICK_REPLIES,
        });
        break;
      }

      // Store budget and move to SEARCHING
      sessionService.updateSession(sessionId, {
        budget: { raw: budgetRaw, amount: budgetAmount },
        step: FLOW_STEPS.SEARCHING,
      });

      // Immediately search
      try {
        // Re-fetch session with budget
        const updatedSession = sessionService.getSession(sessionId);

        const matchedProperties = await propertyService.searchProperties({
          propertyType: updatedSession.propertyType,
          location: updatedSession.location,
          budget: budgetAmount,
        });

        if (matchedProperties.length === 0) {
          // ── No results ──────────────────────────────────────────────────────
          const reply = await geminiService.generateNoResultsResponse(updatedSession);
          sessionService.updateSession(sessionId, { recommendedProjects: [] });
          sessionService.updateStep(sessionId, FLOW_STEPS.NO_RESULTS);

          response = buildResponse({
            reply,
            step: FLOW_STEPS.NO_RESULTS,
            quickReplies: ['Yes, contact me 📞', 'Search again 🔄'],
          });

        } else {
          // ── Show results ────────────────────────────────────────────────────
          const projectNames = matchedProperties.map((p) => p['Project Name'] || '').filter(Boolean);
          sessionService.updateSession(sessionId, { recommendedProjects: projectNames });

          const reply = await geminiService.generatePropertyRecommendation({
            properties: matchedProperties,
            session: updatedSession,
          });

          sessionService.updateStep(sessionId, FLOW_STEPS.SHOW_RESULTS);

          // Format properties for widget display
          const formattedProps = matchedProperties.map(propertyService.formatProperty);

          response = buildResponse({
            reply,
            step: FLOW_STEPS.SHOW_RESULTS,
            quickReplies: ['Yes, contact me 📞', 'Search again 🔄'],
            properties: formattedProps,
          });
        }

      } catch (searchErr) {
        logger.error('Property search failed:', searchErr);
        sessionService.updateStep(sessionId, FLOW_STEPS.COLLECT_BUDGET);
        response = buildResponse({
          reply: `Sorry, I ran into a technical issue while searching. Could you please try again?`,
          step: FLOW_STEPS.COLLECT_BUDGET,
          quickReplies: BUDGET_QUICK_REPLIES,
        });
      }
      break;
    }

    // ─────────────────────────────────────────────────────────────────────────
    case FLOW_STEPS.SHOW_RESULTS:
    case FLOW_STEPS.NO_RESULTS:
    case FLOW_STEPS.CONFIRM_CONTACT: {
      const msg = message.toLowerCase();

      if (containsAny(msg, RESTART_KEYWORDS)) {
        // ── Restart search ──────────────────────────────────────────────────
        sessionService.updateStep(sessionId, FLOW_STEPS.COLLECT_PROPERTY_TYPE);
        response = buildResponse({
          reply: `Sure! Let's search again. What type of property are you looking for?`,
          step: FLOW_STEPS.COLLECT_PROPERTY_TYPE,
          quickReplies: PROPERTY_TYPES,
        });

      } else if (containsAny(msg, YES_KEYWORDS)) {
        // ── Save lead ───────────────────────────────────────────────────────
        const currentSession = sessionService.getSession(sessionId);
        try {
          await leadService.saveLead(currentSession);
          sessionService.updateSession(sessionId, { leadSaved: true });
        } catch (saveErr) {
          logger.error('Lead save failed:', saveErr);
          // Continue anyway — don't break the UX
        }

        const reply = await geminiService.generateResponse({
          userMessage: message,
          context: { name: currentSession.name },
          step: FLOW_STEPS.DONE,
          customInstruction: `Thank ${getFirstName(currentSession.name)} warmly. Confirm their inquiry has been saved and our Investment Manager will call within 24 hours. Wish them a great day. Keep it under 40 words.`,
        });

        sessionService.updateStep(sessionId, FLOW_STEPS.DONE);
        response = buildResponse({ reply, step: FLOW_STEPS.DONE });

      } else if (containsAny(msg, NO_KEYWORDS)) {
        // ── Soft decline ────────────────────────────────────────────────────
        sessionService.updateStep(sessionId, FLOW_STEPS.DONE);
        response = buildResponse({
          reply: `No problem at all! Feel free to come back anytime you'd like to explore properties. Have a wonderful day! 😊`,
          step: FLOW_STEPS.DONE,
        });

      } else {
        // ── Unclear response → gently re-confirm ────────────────────────────
        const reply = await geminiService.generateResponse({
          userMessage: message,
          context: { name: session.name },
          step: FLOW_STEPS.CONFIRM_CONTACT,
          customInstruction: `The visitor seems unsure. Gently ask if they'd like our Investment Manager to call them. Keep it to 1-2 sentences.`,
        });
        sessionService.updateStep(sessionId, FLOW_STEPS.CONFIRM_CONTACT);
        response = buildResponse({
          reply,
          step: FLOW_STEPS.CONFIRM_CONTACT,
          quickReplies: ['Yes, contact me 📞', 'No, thanks'],
        });
      }
      break;
    }

    // ─────────────────────────────────────────────────────────────────────────
    case FLOW_STEPS.DONE: {
      response = buildResponse({
        reply: `Thank you for connecting with us! Our team will be in touch soon. Feel free to start a new search anytime. 😊`,
        step: FLOW_STEPS.DONE,
      });
      break;
    }

    // ─────────────────────────────────────────────────────────────────────────
    default: {
      logger.warn(`Unknown step "${session.step}" — resetting session ${sessionId}`);
      sessionService.createSession(sessionId); // Reset
      response = buildResponse({
        reply: `Hello! 👋 Let's start fresh. May I know your name?`,
        step: FLOW_STEPS.COLLECT_NAME,
      });
    }
  }

  // Log bot response to session history
  sessionService.addMessage(sessionId, 'assistant', response.reply);

  return response;
};

module.exports = { startSession, processMessage };
