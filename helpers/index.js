
const recipients = ['gokuldsp01@gmail.com']
const generateSearchString = (searchTerm, columns = []) => {
  if (!searchTerm) return '';

  const escaped = searchTerm.replace(/'/g, "''");

  const conditions = columns.map(col => {
    if (col === 'amount') {
      return `CAST(${col} AS TEXT) ILIKE '%${escaped}%'`;
    }
    return `LOWER(${col}) LIKE '%${escaped.toLowerCase()}%'`;
  });

  return ` AND (${conditions.join(' OR ')})`;
};


function sanitizeValue(val) {
    if (typeof val === 'number' || typeof val === 'boolean') return val;
    return String(val).replace(/'/g, "''");
}

function generateFilterConditions(filters, tableAliases = {}) {
    if (!filters) return '';
    const conditions = [];
    const arrayFields = ['peoples', 'occasions'];

    for (const [field, filter] of Object.entries(filters)) {
        const fieldRef = tableAliases[field] ? `${tableAliases[field]}.${field}` : field;

        if (filter.IN && Array.isArray(filter.IN) && filter.IN.length > 0) {
            const sanitizedList = filter.IN.map(val => `'${sanitizeValue(val)}'`).join(', ');
            if (arrayFields.includes(field)) {
                conditions.push(`AND ${fieldRef} && ARRAY[${sanitizedList}]`);
            } else {
                conditions.push(`AND ${fieldRef} IN (${sanitizedList})`);
            }
        }
        if (filter.EQ !== undefined && filter.EQ !== null) {
            const val = sanitizeValue(filter.EQ);
            conditions.push(`AND ${fieldRef} = '${val}'`);
        }
        if (
            typeof filter.MIN !== 'undefined' &&
            typeof filter.MAX !== 'undefined' &&
            filter.MIN !== null &&
            filter.MAX !== null
        ) {
            const minVal = sanitizeValue(filter.MIN);
            const maxVal = sanitizeValue(filter.MAX);
            conditions.push(`AND ${fieldRef} BETWEEN '${minVal}' AND '${maxVal}'`);
        }
    }
    return conditions.join(' ');
}

module.exports = {
    recipients,
    generateSearchString,
    generateFilterConditions
}