const pool = require('../middleware/db');

/* DELETE */
async function PostgresDelete(tableName, condition, conditionValue) {
    const query = `DELETE FROM ${tableName} WHERE ${condition} = $1`;
    await pool.query(query, [conditionValue]);
    return true;
}

/* INSERT */
async function PostgresInsert(tableName, values) {
    const keys = Object.keys(values);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${tableName} (${cols}) VALUES (${placeholders}) RETURNING *`;

    const result = await pool.query(query, Object.values(values));
    return result.rows[0];
}

/* BULK INSERT */
async function PostgresBulkInsert(tableName, valuesArray) {
    if (!valuesArray.length) throw new Error("Empty bulk insert");

    const keys = Object.keys(valuesArray[0]);
    const cols = keys.join(', ');

    const placeholders = valuesArray
        .map((_, r) => `(${keys.map((_, c) => `$${r * keys.length + c + 1}`).join(', ')})`)
        .join(', ');

    const query = `INSERT INTO ${tableName} (${cols}) VALUES ${placeholders} RETURNING *`;
    const flatValues = valuesArray.flatMap(obj => keys.map(k => obj[k]));

    const result = await pool.query(query, flatValues);
    return result.rows;
}

/* SELECT */
async function PostgresSelect(tableName, columns, condition, conditionValue) {
    const query = `SELECT ${columns.join(', ')} FROM ${tableName} WHERE ${condition} = $1`;
    const result = await pool.query(query, [conditionValue]);
    return result.rows;
}

/* 🔥 FIXED UPDATE (IMPORTANT) */
async function PostgresUpdate(tableName, values, where) {
    const setKeys = Object.keys(values).filter(k => values[k] !== undefined);
    if (!setKeys.length) throw new Error("No values to update");

    const whereKeys = Object.keys(where);
    if (!whereKeys.length) throw new Error("Where condition required");

    const setClause = setKeys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const whereClause = whereKeys
        .map((k, i) => `${k} = $${setKeys.length + i + 1}`)
        .join(' AND ');

    const query = `
        UPDATE ${tableName}
        SET ${setClause}
        WHERE ${whereClause}
        RETURNING *
    `;

    const valuesArray = [
        ...setKeys.map(k => values[k]),
        ...whereKeys.map(k => where[k]) // ✅ primitive only
    ];

    const result = await pool.query(query, valuesArray);
    return result.rows[0] || null;
}

/* ANY QUERY */
async function PostgresAny(query, params = []) {
    const result = await pool.query(query, params);
    return result.rows;
}

/* UPSERT */
async function PostgresUpsert(tableName, values, conflictCols, updateCols) {
    const keys = Object.keys(values);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const conflict = conflictCols.join(', ');
    const update = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');

    const query = `
        INSERT INTO ${tableName} (${cols})
        VALUES (${placeholders})
        ON CONFLICT (${conflict})
        DO UPDATE SET ${update}
        RETURNING *
    `;

    const result = await pool.query(query, Object.values(values));
    return result.rows[0];
}

module.exports = {
    PostgresDelete,
    PostgresInsert,
    PostgresBulkInsert,
    PostgresSelect,
    PostgresUpdate,
    PostgresAny,
    PostgresUpsert
};
