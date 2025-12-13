require('dotenv').config()
const Cart = require("../models/cart.model");
const Order = require("../models/order.model")
const stripe = require('stripe')(process.env.STRIPE_SECRET)

module.exports = {
    createCheckoutSesion: async (req, res) => {
        try {
            const YOUR_DOMAIN = 'http://localhost:3000';
            const userId = req.user.id;
            
            console.log(`🛒 Creando sesión de pago para usuario: ${userId}`);
            
            const cart = await Cart.findOne({ user: userId }).populate("products.product");
            
            if (!cart || cart.products.length === 0) { 
                return res.status(404).json({ 
                    success: false, 
                    message: "Carrito vacío o no encontrado" 
                }); 
            }
            
            console.log(`📦 Productos en carrito: ${cart.products.length}`);
            
            const lineItems = cart.products.map((item) => {
                return {
                    price_data: {
                        currency: 'mxn',
                        unit_amount: Math.round(item.product.price * 100), // Asegurar número entero
                        product_data: {
                            name: item.product.name,
                            description: item.product.short_desc || 'Producto sin descripción',
                            images: item.product.images ? [item.product.images] : []
                        }
                    },
                    quantity: item.quantity
                }
            });
            
            console.log(`💰 Creando sesión de Stripe con ${lineItems.length} items`);
            
            const session = await stripe.checkout.sessions.create({
                ui_mode: 'embedded',
                line_items: lineItems,
                mode: 'payment',
                // IMPORTANTE: Usar return_url sin auth requerida
                return_url: `${YOUR_DOMAIN}/payment-return?session_id={CHECKOUT_SESSION_ID}&user_id=${userId}`,
                customer_email: req.user.email, // Opcional: email del usuario
                metadata: {
                    user_id: userId.toString()
                }
            });

            console.log(`✅ Sesión creada: ${session.id}`);
            
            res.json({ 
                success: true,
                clientSecret: session.client_secret,
                sessionId: session.id
            });
            
        } catch (error) {
            console.error("❌ Error en createCheckoutSesion:", error);
            res.status(500).json({ 
                success: false, 
                message: "Error creando sesión de pago",
                error: error.message 
            });
        }
    },

    sessionStatus: async (req, res) => {
        try {
            console.log(`🔍 Verificando sesión (autenticada): ${req.query.session_id}`);
            
            const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
            const userId = req.user.id;
            
            console.log(`👤 Usuario autenticado: ${userId}, Estado pago: ${session.payment_status}`);
            
            // Solo crear orden si no existe
            const existingOrder = await Order.findOne({ paymentId: session.id });
            
            if (!existingOrder && session.payment_status === 'paid') {
                await createOrderFromCart(userId, session);
            }
            
            res.json({
                success: true,
                status: session.payment_status,
                customer_email: session.customer_details?.email,
                sessionId: session.id
            });
            
        } catch (error) {
            console.error("❌ Error en sessionStatus:", error);
            res.status(500).json({ 
                success: false, 
                message: "Error verificando estado de sesión",
                error: error.message 
            });
        }
    },

    // NUEVO: Función pública para el redirect de Stripe
    publicSessionStatus: async (req, res) => {
        try {
            const sessionId = req.query.session_id;
            const userId = req.query.user_id;
            
            console.log(`🔍 Verificando sesión (pública): ${sessionId}, Usuario: ${userId}`);
            
            if (!sessionId) {
                return res.status(400).json({ 
                    success: false, 
                    message: "session_id es requerido" 
                });
            }
            
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            
            console.log(`📊 Estado de sesión: ${session.payment_status}`);
            
            // Solo procesar si el pago fue exitoso
            if (session.payment_status === 'paid' && userId) {
                const existingOrder = await Order.findOne({ paymentId: sessionId });
                
                if (!existingOrder) {
                    console.log(`🛍️ Creando orden para usuario: ${userId}`);
                    await createOrderFromCart(userId, session);
                } else {
                    console.log(`✅ Orden ya existe: ${existingOrder._id}`);
                }
            }
            
            res.json({
                success: true,
                status: session.payment_status,
                customer_email: session.customer_details?.email,
                sessionId: session.id
            });
            
        } catch (error) {
            console.error("❌ Error en publicSessionStatus:", error);
            res.status(500).json({ 
                success: false, 
                message: "Error verificando estado de pago",
                error: error.message 
            });
        }
    }
};

// Función auxiliar para crear orden
async function createOrderFromCart(userId, session) {
    try {
        const cart = await Cart.findOne({ user: userId }).populate("products.product");
        
        if (!cart || cart.products.length === 0) {
            console.log(`⚠️ Carrito no encontrado para usuario: ${userId}`);
            return;
        }
        
        const totalPrice = cart.products.reduce((sum, item) => {
            return sum + (item.product.price * item.quantity);
        }, 0);
        
        const newOrder = new Order({ 
            user: userId, 
            products: cart.products.map(item => ({
                product: item.product._id,
                quantity: item.quantity,
                price: item.product.price
            })), 
            totalPrice, 
            paymentId: session.id, 
            paymentStatus: session.payment_status,
            customerEmail: session.customer_details?.email
        });
        
        await newOrder.save();
        console.log(`✅ Orden creada: ${newOrder._id}`);
        
        // Limpiar carrito después de crear orden exitosa
        await Cart.findOneAndDelete({ user: userId });
        console.log(`🗑️ Carrito limpiado para usuario: ${userId}`);
        
    } catch (error) {
        console.error("❌ Error creando orden:", error);
        throw error;
    }
}