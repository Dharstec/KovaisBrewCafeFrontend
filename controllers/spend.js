const POSTGRESQLService = require('../helpers/POSTGRES');
const { generateSearchString } = require("../helpers")

const TABLE_SPENT = process.env.TABLE_SPENT || 'spent';

const getAllRecords = async (req, res) => {
    try {
        const page     = parseInt(req.query.page,     10) || 1;
        const pageSize = parseInt(req.query.pageSize, 10) || 10;
        const offset   = (page - 1) * pageSize;

        const sortColumn = req.query.sortColumn || 'date';
        const sortOrder  = (req.query.sortOrder || 'DESC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const searchTerm      = req.query.searchTerm?.trim() || '';
        const searchConditions = searchTerm
            ? generateSearchString(searchTerm, ['reason', 'amount'])
            : '';

        // Date range — default both to today
        const todayStr = new Date().toISOString().slice(0, 10);
        const dateRx   = /^\d{4}-\d{2}-\d{2}$/;
        const startDate = (req.query.startDate && dateRx.test(req.query.startDate))
            ? req.query.startDate : todayStr;
        const endDate   = (req.query.endDate   && dateRx.test(req.query.endDate))
            ? req.query.endDate   : todayStr;

        // This-month total (always)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const monthTotal   = await POSTGRESQLService.PostgresAny(
            `SELECT COALESCE(SUM(amount),0) AS total_spent_this_month FROM ${TABLE_SPENT} WHERE date >= $1 AND date <= $2`,
            [startOfMonth, endOfMonth]
        );

        // Range total
        const rangeTotal = await POSTGRESQLService.PostgresAny(
            `SELECT COALESCE(SUM(amount),0) AS range_total FROM ${TABLE_SPENT} WHERE date::date BETWEEN $1::date AND $2::date`,
            [startDate, endDate]
        );

        // Paginated records
        const query = `
            SELECT
                TO_CHAR(date, 'DD-MM-YYYY') AS spent_date,
                *,
                COUNT(*) OVER() AS total_count
            FROM ${TABLE_SPENT}
            WHERE date::date BETWEEN $1::date AND $2::date
            ${searchConditions}
            ORDER BY ${sortColumn} ${sortOrder}
            LIMIT $3 OFFSET $4
        `;
        const data = await POSTGRESQLService.PostgresAny(query, [startDate, endDate, pageSize, offset]);

        res.json({
            status: 'success',
            data,
            total_spent_this_month: monthTotal[0]?.total_spent_this_month || 0,
            range_total: rangeTotal[0]?.range_total || 0,
            total_count: data.length > 0 ? parseInt(data[0].total_count, 10) : 0
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

const getUniqueReasons = async (req, res) => {
    try {
        const data = await POSTGRESQLService.PostgresAny(
            `SELECT DISTINCT reason FROM ${TABLE_SPENT} WHERE reason IS NOT NULL AND reason <> '' ORDER BY reason ASC`
        );
        res.json(data.map((r) => r.reason));
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
    deleteRecord,
    getUniqueReasons
};
