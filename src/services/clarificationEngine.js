/**
 * Ambiguity Detection & Clarification Engine
 * Evaluates user questions to identify underspecified metrics, ambiguous definitions, or missing parameters.
 */

const AMBIGUITY_RULES = [
  {
    id: 'best_customer',
    matchers: [/best customer/i, /top customer/i, /greatest customer/i, /most valuable customer/i],
    reason: "'Best Customer' can be defined by revenue, order frequency, or engagement.",
    prompt: "How would you like to define 'best customer'?",
    options: [
      { key: 'revenue', label: 'By Total Revenue ($)', description: 'Ranks customers by sum of order amounts.' },
      { key: 'orders', label: 'By Order Count (🛒)', description: 'Ranks customers by total number of completed orders.' },
      { key: 'visits', label: 'By Repeat Visits (🔁)', description: 'Ranks customers by total visit frequency.' }
    ]
  },
  {
    id: 'top_products',
    matchers: [/best product/i, /top product/i, /top selling/i, /best seller/i, /popular product/i],
    reason: "'Top Product' can be ranked by total gross revenue or volume of units sold.",
    prompt: "How would you like to rank the top products?",
    options: [
      { key: 'prod_revenue', label: 'By Revenue Generated ($)', description: 'Rank by gross sales revenue.' },
      { key: 'prod_quantity', label: 'By Units Sold (📦)', description: 'Rank by total quantity sold.' }
    ]
  },
  {
    id: 'recent_activity',
    matchers: [/recent orders/i, /recent customers/i, /new customers/i, /recent sales/i],
    reason: "The date window for 'recent' is underspecified.",
    prompt: "Please select the timeframe for recent activity:",
    options: [
      { key: 'last_30_days', label: 'Last 30 Days', description: 'Activity within the past 30 days.' },
      { key: 'last_month', label: 'Previous Month (August 2026)', description: 'Activity during August 2026.' },
      { key: 'current_month', label: 'Current Month (September 2026)', description: 'Activity during September 2026.' }
    ]
  },
  {
    id: 'inactive_customers',
    matchers: [/inactive customer/i, /churned/i, /dormant user/i],
    reason: "Inactivity threshold is not defined.",
    prompt: "Select the inactivity threshold:",
    options: [
      { key: 'no_orders_30', label: 'No orders in last 30 days', description: 'Customers with no purchases in past 30 days.' },
      { key: 'no_orders_60', label: 'No orders in last 60 days', description: 'Customers with no purchases in past 60 days.' }
    ]
  }
];

function analyzeAmbiguity(question, forcedMode = false) {
  if (!question || typeof question !== 'string') {
    return { isAmbiguous: false };
  }

  // If user query explicitly contains clarification criteria already, it's not ambiguous!
  const hasExplicitCriteria = /(by revenue|by order count|by total revenue|by units sold|by repeat visits|last 30 days|august 2026)/i.test(question);
  if (hasExplicitCriteria && !forcedMode) {
    return { isAmbiguous: false };
  }

  for (const rule of AMBIGUITY_RULES) {
    for (const matcher of rule.matchers) {
      if (matcher.test(question)) {
        return {
          isAmbiguous: true,
          ruleId: rule.id,
          reason: rule.reason,
          prompt: rule.prompt,
          options: rule.options
        };
      }
    }
  }

  return { isAmbiguous: false };
}

module.exports = {
  analyzeAmbiguity,
  AMBIGUITY_RULES
};
