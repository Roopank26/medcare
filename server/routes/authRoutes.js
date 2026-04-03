const express = require("express");
const router = express.Router();
const { register, login, registerSync, loginSync } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

// Legacy routes (email/password - for backward compatibility & testing)
router.post("/register", register);
router.post("/login", login);

// Firebase ID Token sync routes (PRODUCTION)
router.post("/register-sync", requireAuth, registerSync);
router.post("/login-sync", requireAuth, loginSync);

module.exports = router;
