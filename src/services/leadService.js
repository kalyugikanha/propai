/**
 * Lead Service
 * Collects session data, formats a lead row, and appends it to the Leads Sheet.
 */

const sheetsService = require('./sheetsService');
const { format: formatBudget } = require('../utils/budgetParser');
const { formatDateIN } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Save a lead from a completed chat session to Google Sheets.
 * @param {object} session  - full session object from sessionService
 * @returns {Promise<void>}
 */
const saveLead = async (session) => {
  logger.info(`Saving lead: name="${session.name}" mobile="${session.mobile}"`);

  const date = formatDateIN(new Date());
  const budgetStr = session.budget
    ? (session.budget.raw || formatBudget(session.budget.amount))
    : '';
  const recommendedProjects = (session.recommendedProjects || []).join(', ');

  // Order must match the Leads sheet columns exactly:
  // Date | Name | Mobile Number | Property Type | Preferred Location |
  // Budget | Recommended Projects | Lead Status | Notes
  const row = [
    date,
    session.name || '',
    session.mobile || '',
    session.propertyType || '',
    session.location || '',
    budgetStr,
    recommendedProjects,
    'New Lead',
    `Website chatbot — ${new Date().toLocaleTimeString('en-IN')}`,
  ];

  await sheetsService.appendLead(row);

  logger.info(`Lead saved for: ${session.name} (${session.mobile})`);
};

module.exports = { saveLead };
