const POSTGRESQLService = require('../helpers/POSTGRES');
const { generateSearchString } = require("../helpers")

const TABLE_SPENT = process.env.TABLE_SPENT || 'spent';

const getAllRecords = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const pageSize = parseInt(req.query.pageSize, 10) || 10;
        const offset = (page - 1) * pageSize;

        const sortColumn = req.query.sortColumn || 'id';
        const sortOrder = (req.query.sortOrder || 'asc').toUpperCase() === 'DESC'
            ? 'DESC'
            : 'ASC';

        const searchTerm = req.query.searchTerm?.trim() || '';
        const searchConditions = searchTerm
            ? generateSearchString(searchTerm, ['reason', 'amount'])
            : '';

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
        const endOfMonth = new Date(currentYear, currentMonth, 0);

        const totalSpendQuery = `
            SELECT 
                SUM(amount) AS total_spent_this_month
            FROM ${TABLE_SPENT}
            WHERE date >= $1 AND date <= $2
        `;

        const totalSpentThisMonth = await POSTGRESQLService.PostgresAny(totalSpendQuery, [startOfMonth, endOfMonth]);
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        // const startDate = req?.query?.startDate || new Date(year, month, 1).toISOString().slice(0, 10);
        // const endDate = req?.query?.endDate || new Date(year, month + 1, 0).toISOString().slice(0, 10);
        const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
        const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);

const query = `
  SELECT 
    TO_CHAR(date, 'DD-MM-YYYY') AS spent_date,
    *,
    COUNT(*) OVER() AS total_count
  FROM ${TABLE_SPENT}
  WHERE date::date BETWEEN $3::date AND $4::date
  ${searchConditions}
  ORDER BY ${sortColumn} ${sortOrder}
  LIMIT $1 OFFSET $2
`;


        const data = await POSTGRESQLService.PostgresAny(query, [pageSize, offset, startDate, endDate]);

        res.json({
            status: 'success',
            data,
            total_spent_this_month: totalSpentThisMonth[0]?.total_spent_this_month || 0,
            filters: {
                sort: { name: sortColumn, type: sortOrder },
                search: searchTerm,
                pagination: { page, pageSize }
            },
            total_count: data.length > 0
                ? parseInt(data[0].total_count, 10)
                : 0
        });
    } catch (err) {
        console.error('getAllRecords error:', err);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};




const addRecord = async (req, res) => {
    try {

        await POSTGRESQLService.PostgresInsert(TABLE_SPENT, req.body);
        res.json({ status: 'success', message: 'Item added' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

const updateRecord = async (req, res) => {
    try {
        const updatedItem = { ...req.body, updated_at: new Date().toISOString() };
        await POSTGRESQLService.PostgresUpdate(TABLE_SPENT, updatedItem, req.params.id);
        res.json({ status: 'success', message: 'Updated' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

const deleteRecord = async (req, res) => {
    try {
        await POSTGRESQLService.PostgresDelete(TABLE_SPENT, 'id', req.params.id);
        res.json({ status: 'success', message: 'Item removed' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

module.exports = {
    getAllRecords,
    addRecord,
    updateRecord,
    deleteRecord
};
