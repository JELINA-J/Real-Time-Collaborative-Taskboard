const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  // The frontend sends:  Authorization: Bearer <token>
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = header.split(" ")[1];

  try {
    // verify() checks the signature and the expiry date
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId; // available to the next handlers
    next();                      // let the request continue
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = requireAuth;