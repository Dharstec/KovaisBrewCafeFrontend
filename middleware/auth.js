const jwt = require("jsonwebtoken");
require('dotenv').config();

exports.verifyToken = (req, res, next) => {
  let tokenWithBearer = req.headers["authorization"];

  if (!tokenWithBearer) {
    return res.status(403).send({ message: "No token provided!" });
  }

  const parts = tokenWithBearer.split(' ');
  if (parts.length === 2 && parts[0] === "Bearer") {
    const token = parts[1];

    jwt.verify(token, process.env.SECRET_CODE, (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: "Unauthorized!" });
      }
      req.user_name = decoded.user_name;
      req.user_id = decoded.user_id;
      req.role_type = decoded.role_type;
      req.email = decoded.email;   
      next();
    });
  } else {
    return res.status(401).send({ message: "Token format is invalid. Token should be a 'Bearer [token]'." });
  }
};
