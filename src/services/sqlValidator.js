/**
 * SQL Guardrail & Safety Validator
 * Ensures generated SQL is strictly read-only and free of dangerous operations.
 */

function validateAndSanitizeSQL(rawSql) {
  if (!rawSql || typeof rawSql !== 'string') {
    return { isValid: false, error: 'SQL query string is empty or invalid.' };
  }

  // Strip markdown code block formatting if present
  let cleanSql = rawSql.trim();
  if (cleanSql.startsWith('```')) {
    cleanSql = cleanSql.replace(/^```(sql)?\s*/i, '').replace(/```$/, '').trim();
  }

  // Remove trailing semicolons for uniform processing
  cleanSql = cleanSql.replace(/;+$/, '').trim();

  // Check for multi-statement query injection (semicolon inside query body)
  if (cleanSql.includes(';')) {
    return { isValid: false, error: 'Multiple SQL statements are not permitted.' };
  }

  const upperSql = cleanSql.toUpperCase();

  // Must begin with SELECT or WITH
  if (!upperSql.startsWith('SELECT') && !upperSql.startsWith('WITH')) {
    return { isValid: false, error: 'Only read-only SELECT queries are allowed.' };
  }

  // Blacklisted mutation keywords
  const forbiddenKeywords = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 
    'TRUNCATE', 'EXEC', 'EXECUTE', 'GRANT', 'REVOKE', 'PRAGMA', 'ATTACH', 'DETACH'
  ];

  for (const word of forbiddenKeywords) {
    // Regex matching whole word boundary to prevent false positives on column names
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(cleanSql)) {
      return { isValid: false, error: `Forbidden SQL operation detected: '${word}'. Only read-only SELECT queries are allowed.` };
    }
  }

  // Ensure row limit safety cap (append LIMIT 100 if no LIMIT clause present)
  if (!/\bLIMIT\b/i.test(cleanSql)) {
    cleanSql += ' LIMIT 100';
  }

  return {
    isValid: true,
    sql: cleanSql + ';'
  };
}

module.exports = {
  validateAndSanitizeSQL
};
