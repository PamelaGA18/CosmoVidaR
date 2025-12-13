const express = require("express");
const { authenticate, isAdmin } = require("../auth/auth.middleware");
const { 
    createCheckoutSesion, 
    sessionStatus, 
    publicSessionStatus 
} = require("../controllers/payment.controller");

const router = express.Router();

// Ruta para crear sesión (requiere autenticación)
router.get('/create-session', authenticate, createCheckoutSesion);

// Ruta para verificar estado (requiere autenticación - para uso interno)
router.get("/session-status", authenticate, sessionStatus);

// Ruta pública para el redirect de Stripe (NO requiere autenticación)
router.get("/public-session-status", publicSessionStatus);

module.exports = router;