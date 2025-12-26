const DB = require("../middleware/dbFunctions");

exports.getEmployees = async (req,res)=>{
  res.json(await DB.PostgresAny(
    "SELECT * FROM employees WHERE is_active=true ORDER BY id DESC"
  ));
};

exports.createEmployee = async (req,res)=>{
  res.json(await DB.PostgresInsert("employees", req.body));
};

exports.updateEmployee = async (req,res)=>{
  await DB.PostgresUpdate("employees", req.body, {id:req.params.id});
  res.json({message:"Updated"});
};
