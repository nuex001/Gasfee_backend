const jwt = require("jsonwebtoken");
require('dotenv').config();

//

module.exports = async function (req, res, next) {
  // getting token
  const token = req.header("auth-token");
  if (!token) {
    return res.status(500).json({ msg: "No token, Invalid credentials" });
  }
  try {
    // Decode the jsonwebtoken
    const decoded = await jwt.verify(token, process.env.jwtSecret);
    // Assign to request
    req.user = decoded.user;
  } catch (error) {
    res.status(500).json({ msg: "Token is not valid" });
  }
  // NEXT
  next();
};