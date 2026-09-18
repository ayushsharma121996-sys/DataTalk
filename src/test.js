const { initDatabase, runQuery, getSchemaSummary } = require('./db/database');
const { analyzeAmbiguity } = require('./services/clarificationEngine');
const { generateSQL } = require('./services/sqlGenerator');
const { validateAndSanitizeSQL } = require('./services/sqlValidator');
const { generateExplanation, synthesizeSummaryCard } = require('./services/explanationService');

async function runVerificationTests() {
  console.log('🧪 Starting SQL_text_AL Verification Suite...\n');

  // Test 1: DB Initialization & Schema Extractor
  console.log('--- Test 1: DB Initialization & Schema Extractor ---');
  await initDatabase();
  const schema = await getSchemaSummary();
  const tableNames = Object.keys(schema);
  console.log('Tables in database:', tableNames);
  if (tableNames.includes('Customers') && tableNames.includes('Orders')) {
    console.log('✓ PASS: Database initialization & schema extraction successful.\n');
  } else {
    throw new Error('Test 1 Failed: Expected tables missing.');
  }

  // Test 2: Ambiguity Detection Engine
  console.log('--- Test 2: Ambiguity Detection Engine ---');
  const ambCheck1 = analyzeAmbiguity('Who is the best customer?');
  console.log('Ambiguity Check ("best customer"):', ambCheck1.isAmbiguous, ambCheck1.reason);
  if (ambCheck1.isAmbiguous && ambCheck1.options.length === 3) {
    console.log('✓ PASS: Detected ambiguity & generated 3 clarification options.\n');
  } else {
    throw new Error('Test 2 Failed: Ambiguity not detected correctly.');
  }

  const ambCheck2 = analyzeAmbiguity('Show customers from Delhi');
  console.log('Ambiguity Check ("from Delhi"):', ambCheck2.isAmbiguous);
  if (!ambCheck2.isAmbiguous) {
    console.log('✓ PASS: Unambiguous query correctly identified as non-ambiguous.\n');
  } else {
    throw new Error('Test 2 Failed: Explicit query incorrectly marked as ambiguous.');
  }

  // Test 3: SQL Generator & Validator (Baseline vs Clarified)
  console.log('--- Test 3: SQL Generation & Guardrail Validation ---');
  // Baseline (without clarification)
  const baseGen = generateSQL('Who is the best customer?', null, true);
  console.log('Baseline SQL:', baseGen.sql);
  const baseVal = validateAndSanitizeSQL(baseGen.sql);
  const baseRows = await runQuery(baseVal.sql);
  console.log('Baseline Top Customer:', baseRows[0].customer_name, '(COUNT = ' + baseRows[0].total_orders + ')');
  // Expected: Rajesh Kumar (5 orders)

  // Clarified (with clarification choice = revenue)
  const clarGen = generateSQL('Who is the best customer?', 'revenue', false);
  console.log('Clarified SQL (Revenue):', clarGen.sql);
  const clarVal = validateAndSanitizeSQL(clarGen.sql);
  const clarRows = await runQuery(clarVal.sql);
  console.log('Clarified Top Customer:', clarRows[0].customer_name, '(Revenue = ₹' + clarRows[0].total_revenue + ')');
  // Expected: Priya Sharma (₹180,000 revenue)

  if (baseRows[0].customer_name === 'Rajesh Kumar' && clarRows[0].customer_name === 'Priya Sharma') {
    console.log('✓ PASS: Clarification engine correctly shifted top customer result from Rajesh Kumar (by orders) to Priya Sharma (by revenue).\n');
  } else {
    throw new Error('Test 3 Failed: SQL execution output mismatch.');
  }

  // Test 4: SQL Guardrail Rejection Test
  console.log('--- Test 4: SQL Guardrail Mutation Block Test ---');
  const dangerousSql = "DROP TABLE Customers; SELECT * FROM Orders;";
  const guardVal = validateAndSanitizeSQL(dangerousSql);
  console.log('Guardrail Validation Result:', guardVal);
  if (!guardVal.isValid) {
    console.log('✓ PASS: Guardrail successfully blocked forbidden query.\n');
  } else {
    throw new Error('Test 4 Failed: Dangerous SQL query was not blocked!');
  }

  console.log('🎉 ALL 4 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runVerificationTests().catch(err => {
  console.error('❌ Verification Test Failed:', err);
  process.exit(1);
});
