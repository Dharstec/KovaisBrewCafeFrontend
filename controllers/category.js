const DB = require("../middleware/dbFunctions");
const handleError = require("../helpers/handleError");

exports.getAllCategories = async (req, res) => {
  try {
    const data = await DB.PostgresAny(
      `SELECT id, name FROM categories WHERE status = true ORDER BY name`
    );

    res.json({ success: true, data });

  } catch (error) {
    handleError(res, error, "Failed to fetch categories");
  }
};

exports.getAllCategoriesBilling = async (req, res) => {
  try {
    const data = await DB.PostgresAny(
      `SELECT id, name FROM categories WHERE status = true AND name NOT IN ('Stock Items') ORDER BY name`
    );

    res.json({ success: true, data });

  } catch (error) {
    handleError(res, error, "Failed to fetch categories");
  }
};