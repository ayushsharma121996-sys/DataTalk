/**
 * Explanation & Result Synthesizer Service
 * Provides human-readable plain English descriptions of SQL logic and formats results.
 */

function generateExplanation(sql, intentResolved) {
  const s = sql.toLowerCase();

  if (s.includes('sum(o.total_amount) as total_revenue')) {
    return "This query calculates the total gross revenue per customer from completed orders and ranks them in descending order to identify the top revenue generator.";
  }
  if (s.includes('count(o.order_id) as total_orders')) {
    return "This query counts the total number of orders placed by each customer and ranks them to find who placed the highest number of orders.";
  }
  if (s.includes('count(v.visit_id) as total_visits')) {
    return "This query aggregates customer portal/app visit records from CustomerVisits to identify the customer with the highest repeat engagement.";
  }
  if (s.includes('sum(oi.quantity * oi.unit_price)')) {
    return "This query multiplies item price by quantity sold per product to find the top revenue-generating products.";
  }
  if (s.includes('signup_date >=')) {
    return "This query filters customer registration records by signup date range to compute new customer acquisitions.";
  }

  if (intentResolved) {
    return `This query translates your prompt with resolved intent: "${intentResolved}".`;
  }

  return "This query queries relevant database tables according to your filter criteria.";
}

function synthesizeSummaryCard(rows, question) {
  if (!rows || rows.length === 0) {
    return { title: "No Records Found", value: "0", subtitle: "No data matched the query criteria." };
  }

  const q = question.toLowerCase();

  // Single scalar result (e.g. COUNT or SUM)
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);

  if (rows.length === 1 && keys.length === 1) {
    const val = firstRow[keys[0]];
    const formattedVal = typeof val === 'number' ? val.toLocaleString() : val;
    return {
      title: keys[0].replace(/_/g, ' ').toUpperCase(),
      value: formattedVal,
      subtitle: `Computed across database records`
    };
  }

  // Top Customer / Result Summary
  if (firstRow.customer_name) {
    let detail = '';
    if (firstRow.total_revenue !== undefined) detail = `₹${Number(firstRow.total_revenue).toLocaleString()} Total Revenue`;
    else if (firstRow.total_orders !== undefined) detail = `${firstRow.total_orders} Total Orders`;
    else if (firstRow.total_visits !== undefined) detail = `${firstRow.total_visits} Total Repeat Visits`;
    else detail = `${firstRow.city || 'Active Account'}`;

    return {
      title: firstRow.customer_name,
      value: detail,
      subtitle: `Top Result for "${question}"`
    };
  }

  return {
    title: "Query Result Summary",
    value: `${rows.length} Rows`,
    subtitle: `Executed successfully against database`
  };
}

module.exports = {
  generateExplanation,
  synthesizeSummaryCard
};
