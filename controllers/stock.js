const DB = require("../middleware/dbFunctions");

/* CURRENT STOCK */
exports.getStock = async (req,res)=>{
  const data = await DB.PostgresAny(`
    SELECT p.id,p.name,
    COALESCE(SUM(s.change_qty),0) AS stock_qty
    FROM products p
    LEFT JOIN stock_logs s ON s.product_id=p.id
    GROUP BY p.id,p.name
  `);
  res.json(data);
};

/* ADD / REDUCE STOCK */
exports.adjustStock = async (req,res)=>{
  const { product_id, change_qty, reason } = req.body;
  await DB.PostgresInsert("stock_logs",{product_id,change_qty,reason});
  res.json({message:"Stock updated"});
};
