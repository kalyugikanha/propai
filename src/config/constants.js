/**
 * PropAI — Central Constants
 * All configurable values that drive the conversation flow and property search.
 */

const FLOW_STEPS = {
  GREETING: 'GREETING',
  COLLECT_NAME: 'COLLECT_NAME',
  COLLECT_MOBILE: 'COLLECT_MOBILE',
  COLLECT_PROPERTY_TYPE: 'COLLECT_PROPERTY_TYPE',
  COLLECT_LOCATION: 'COLLECT_LOCATION',
  COLLECT_BUDGET: 'COLLECT_BUDGET',
  SEARCHING: 'SEARCHING',
  SHOW_RESULTS: 'SHOW_RESULTS',
  NO_RESULTS: 'NO_RESULTS',
  CONFIRM_CONTACT: 'CONFIRM_CONTACT',
  DONE: 'DONE',
};

const PROPERTY_TYPES = ['Villa', 'Plot', 'Apartment', 'Commercial'];

// Primary Jaipur localities shown as quick-reply buttons
const JAIPUR_LOCATIONS = [
  'Jagatpura',
  'Vaishali Nagar',
  'Ajmer Road',
  'Tonk Road',
  'Malviya Nagar',
  'C-Scheme',
  'Mansarovar',
  'Pratap Nagar',
  'Sitapura',
  'Sanganer',
  'Kalwar Road',
  'Sirsi Road',
  'Jhotwara',
  'Murlipura',
  'Gopalpura',
  'Shyam Nagar',
  'Vidyadhar Nagar',
  'Nirman Nagar',
];

// Number of quick-reply location buttons to show (rest still accepted via text)
const LOCATION_QUICK_REPLY_LIMIT = 6;

// Budget quick-reply options
const BUDGET_QUICK_REPLIES = [
  '20 Lakhs',
  '50 Lakhs',
  '75 Lakhs',
  '1 Crore',
  '2 Crore',
  '5 Crore+',
];

// Google Sheets tab names
const PROPERTIES_SHEET_NAME = 'Properties';
const LEADS_SHEET_NAME = 'Leads';

// Leads sheet column order (must match the sheet's header row)
// Note: Email column (J) added for landing page form leads
const LEADS_COLUMNS = [
  'Date',
  'Name',
  'Mobile Number',
  'Email',
  'Property Type',
  'Preferred Location',
  'Budget',
  'Recommended Projects',
  'Lead Status',
  'Notes',
];

// Properties sheet required columns (used for fallback mapping)
const PROPERTY_COLUMNS = {
  PROJECT_ID: 'Project ID',
  PROJECT_NAME: 'Project Name',
  LOCATION: 'Location',
  PROPERTY_TYPE: 'Property Type',
  MIN_BUDGET: 'Min Budget',
  MAX_BUDGET: 'Max Budget',
  SIZE_SQFT: 'Size (Sqft)',
  STATUS: 'Status',
  DESCRIPTION: 'Description',
};

const PROPERTY_STATUS_ACTIVE   = 'Active';
const PROPERTY_STATUS_HOT_DEAL = 'Hot Deal';

// Session / cache TTLs
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const SHEETS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Default limits
const TOP_PROPERTIES_LIMIT = 5;

module.exports = {
  FLOW_STEPS,
  PROPERTY_TYPES,
  JAIPUR_LOCATIONS,
  LOCATION_QUICK_REPLY_LIMIT,
  BUDGET_QUICK_REPLIES,
  PROPERTIES_SHEET_NAME,
  LEADS_SHEET_NAME,
  LEADS_COLUMNS,
  PROPERTY_COLUMNS,
  PROPERTY_STATUS_ACTIVE,
  PROPERTY_STATUS_HOT_DEAL,
  SESSION_TTL_MS,
  SHEETS_CACHE_TTL_MS,
  TOP_PROPERTIES_LIMIT,
};
