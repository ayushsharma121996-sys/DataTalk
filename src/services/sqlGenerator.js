/**
 * SQL Generator & Translator Service
 * Generates dialect-correct SQL based on question intent and clarification resolution.
 */

function generateSQL(question, clarificationChoice = null, isBaselineMode = false) {
  const q = question.toLowerCase();

  // -------------------------------------------------------------
  // Baseline Mode (WITHOUT Clarification Engine)
  // Demonstrates the failure mode: silently picking a default assumption
  // e.g., "best customer" assumed to be COUNT(orders) -> returns Rajesh Kumar instead of Priya Sharma ($ revenue)
  // -------------------------------------------------------------
  if (isBaselineMode) {
    if (q.includes('best customer') || q.includes('top customer')) {
      return {
        sql: `SELECT c.customer_name, COUNT(o.order_id) AS total_orders FROM Customers c JOIN Orders o ON c.customer_id = o.customer_id GROUP BY c.customer_name ORDER BY total_orders DESC LIMIT 1;`,
        assumptionMade: "Assumed 'best customer' = highest order count (COUNT)",
        confidenceScore: 98 // High confidence on flawed premise!
      };
    }
    if (q.includes('best product') || q.includes('top product') || q.includes('top selling')) {
      return {
        sql: `SELECT p.product_name, SUM(oi.quantity) AS total_quantity FROM Products p JOIN OrderItems oi ON p.product_id = oi.product_id GROUP BY p.product_name ORDER BY total_quantity DESC LIMIT 1;`,
        assumptionMade: "Assumed 'top product' = highest quantity sold",
        confidenceScore: 95
      };
    }
    if (q.includes('recent orders') || q.includes('recent customers') || q.includes('new customers')) {
      return {
        sql: `SELECT * FROM Orders ORDER BY order_date DESC LIMIT 5;`,
        assumptionMade: "Assumed 'recent' = latest 5 rows without date filter",
        confidenceScore: 90
      };
    }
  }

  // -------------------------------------------------------------
  // Clarified / Explicit Mode (WITH Clarification Engine)
  // -------------------------------------------------------------

  // 1. "best customer" queries with resolved intent
  if (q.includes('best customer') || q.includes('top customer')) {
    if (clarificationChoice === 'revenue' || q.includes('revenue')) {
      return {
        sql: `SELECT c.customer_name, c.city, SUM(o.total_amount) AS total_revenue FROM Customers c JOIN Orders o ON c.customer_id = o.customer_id GROUP BY c.customer_name, c.city ORDER BY total_revenue DESC LIMIT 1;`,
        intentResolved: "Ranked by Total Revenue ($)",
        confidenceScore: 99
      };
    } else if (clarificationChoice === 'orders' || q.includes('order count') || q.includes('orders')) {
      return {
        sql: `SELECT c.customer_name, c.city, COUNT(o.order_id) AS total_orders FROM Customers c JOIN Orders o ON c.customer_id = o.customer_id GROUP BY c.customer_name, c.city ORDER BY total_orders DESC LIMIT 1;`,
        intentResolved: "Ranked by Total Order Volume (COUNT)",
        confidenceScore: 99
      };
    } else if (clarificationChoice === 'visits' || q.includes('visits')) {
      return {
        sql: `SELECT c.customer_name, c.city, COUNT(v.visit_id) AS total_visits FROM Customers c JOIN CustomerVisits v ON c.customer_id = v.customer_id GROUP BY c.customer_name, c.city ORDER BY total_visits DESC LIMIT 1;`,
        intentResolved: "Ranked by Total Repeat Visits",
        confidenceScore: 99
      };
    }
  }

  // 2. "top products" queries
  if (q.includes('best product') || q.includes('top product') || q.includes('top selling')) {
    if (clarificationChoice === 'prod_quantity' || q.includes('quantity') || q.includes('units')) {
      return {
        sql: `SELECT p.product_name, p.category, SUM(oi.quantity) AS total_units_sold FROM Products p JOIN OrderItems oi ON p.product_id = oi.product_id GROUP BY p.product_name, p.category ORDER BY total_units_sold DESC LIMIT 5;`,
        intentResolved: "Ranked by Total Units Sold",
        confidenceScore: 99
      };
    } else {
      // Default revenue
      return {
        sql: `SELECT p.product_name, p.category, SUM(oi.quantity * oi.unit_price) AS gross_revenue FROM Products p JOIN OrderItems oi ON p.product_id = oi.product_id GROUP BY p.product_name, p.category ORDER BY gross_revenue DESC LIMIT 5;`,
        intentResolved: "Ranked by Gross Revenue Generated ($)",
        confidenceScore: 99
      };
    }
  }

  // 3. "new / recent customers" queries
  if (q.includes('new customer') || q.includes('recent customer') || q.includes('signed up')) {
    if (clarificationChoice === 'last_month' || q.includes('last month') || q.includes('august')) {
      return {
        sql: `SELECT COUNT(*) AS new_customers FROM Customers WHERE signup_date >= '2026-08-01' AND signup_date <= '2026-08-31';`,
        intentResolved: "Timeframe: August 2026 (Previous Month)",
        confidenceScore: 99
      };
    } else {
      return {
        sql: `SELECT customer_name, city, signup_date FROM Customers WHERE signup_date >= '2026-08-01' ORDER BY signup_date DESC;`,
        intentResolved: "Timeframe: Recent Signups (Past 30 Days)",
        confidenceScore: 99
      };
    }
  }

  // 4. City-based queries
  if (q.includes('delhi')) {
    return {
      sql: `SELECT customer_name, email, city FROM Customers WHERE LOWER(city) = 'delhi';`,
      intentResolved: "Filter: City = Delhi",
      confidenceScore: 100
    };
  }
  if (q.includes('mumbai')) {
    return {
      sql: `SELECT customer_name, email, city FROM Customers WHERE LOWER(city) = 'mumbai';`,
      intentResolved: "Filter: City = Mumbai",
      confidenceScore: 100
    };
  }

  // 5. Orders / Revenue totals
  if (q.includes('total revenue') || q.includes('total sales')) {
    return {
      sql: `SELECT SUM(total_amount) AS total_revenue FROM Orders WHERE status = 'Completed';`,
      intentResolved: "Aggregated sum of completed orders",
      confidenceScore: 100
    };
  }
  if (q.includes('all orders') || q.includes('show orders')) {
    return {
      sql: `SELECT o.order_id, c.customer_name, o.order_date, o.total_amount, o.status FROM Orders o JOIN Customers c ON o.customer_id = c.customer_id ORDER BY o.order_date DESC;`,
      intentResolved: "List all orders with customer details",
      confidenceScore: 100
    };
  }

  // 6. Generic Fallback Query
  return {
    sql: `SELECT customer_name, city, signup_date FROM Customers LIMIT 10;`,
    intentResolved: "General query: Showing sample customer records",
    confidenceScore: 85
  };
}

module.exports = {
  generateSQL
};
