const pool = require('../middleware/db');

module.exports = {
    async PostgresDelete(tableName, condition, conditionValue) {
        const deleteQuery = `DELETE FROM ${tableName} WHERE ${condition} = $1`;
        try {
            await pool.query(deleteQuery, [conditionValue]);
            console.log('Delete successful');
            return true;
        } catch (error) {
            console.error('Error during delete:', error);
            console.error('Query:', deleteQuery);
            throw error;
        }
    },

    async PostgresInsert(tableName, values) {
        const columns = Object.keys(values).join(', ');
        const placeholders = Object.keys(values).map((_, index) => `$${index + 1}`).join(', ');
        const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING *`;
        try {
            const result = await pool.query(query, Object.values(values));
            console.log("Insert Data Successful");
            return result.rows[0];
        } catch (error) {
            console.error('Error during PostgresInsert:', error);
            console.error('Query:', query);
            throw error;
        }
    },
    async PostgresBulkInsert(tableName, valuesArray) {
        if (!Array.isArray(valuesArray) || valuesArray.length === 0) {
            throw new Error('Values should be a non-empty array');
        }
    
        const columns = Object.keys(valuesArray[0]).join(', ');
        const valuePlaceholders = valuesArray.map((_, rowIndex) =>
            `(${Object.keys(valuesArray[0]).map((_, colIndex) => `$${rowIndex * Object.keys(valuesArray[0]).length + colIndex + 1}`).join(', ')})`
        ).join(', ');
        const query = `INSERT INTO ${tableName} (${columns}) VALUES ${valuePlaceholders} RETURNING *`;
        const flattenedValues = valuesArray.flatMap(Object.values);
    
        try {
            const result = await pool.query(query, flattenedValues);
            console.log("Bulk Insert Data Successful");
            return result.rows;
        } catch (error) {
            console.error('Error during PostgresBulkInsert:', error);
            console.error('Query:', query);
            throw error;
        }
    },    

    async PostgresSelect(tableName, columns, condition, conditionValue) {
        const selectQuery = `SELECT ${columns.join(', ')} FROM ${tableName} WHERE ${condition} = $1`;
        try {
            // console.log(selectQuery);
            const result = await pool.query(selectQuery, [conditionValue]);
            return result.rows;
        } catch (error) {
            console.error('Error during select:', error);
            console.error('Query:', selectQuery);
            throw error;
        }
    },

    async PostgresUpdate(tableName, values, id) {
        const setClause = Object.keys(values).map((key, index) => `${key} = $${index + 1}`).join(', ');
        const query = `UPDATE ${tableName} SET ${setClause} WHERE id = $${Object.keys(values).length + 1}`;
        const valuesArray = [...Object.values(values), id];
        try {
            const result = await pool.query(query, valuesArray);
            return result.rows[0];
        } catch (error) {
            console.error('Error during PostgresUpdate:', error);
            console.error('Query:', query);
            throw error;
        }
    },

    async PostgresAny(query, params) {
        try {
            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Query:', query);
            throw error;
        }
    },
    async  PostgresUpsert(tableName, values, conflictColumns, updateColumns) {
        const columns = Object.keys(values).join(', ');
        const placeholders = Object.keys(values).map((_, index) => `$${index + 1}`).join(', ');
        const conflictAction = conflictColumns.map(col => `${col}`).join(', ');
        const updateAction = updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ');
    
        const query = `
            INSERT INTO ${tableName} (${columns})
            VALUES (${placeholders})
            ON CONFLICT (${conflictAction})
            DO UPDATE SET ${updateAction}
            RETURNING *`;
    
        try {
            const result = await pool.query(query, Object.values(values));
            console.log("Upsert Data Successful");
            return result.rows[0];
        } catch (error) {
            console.error('Error during PostgresUpsert:', error);
            console.error('Query:', query);
            throw error;
        }
    } 
};
