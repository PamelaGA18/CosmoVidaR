import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { baseUrl } from "../../../environment";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { updateTotal, clearCart } from "../../../state/cartSlice";
import { 
    CheckCircleIcon, 
    XCircleIcon,
    ClockIcon 
} from "@heroicons/react/24/outline";

export default function PaymentReturn() {
    const [status, setStatus] = useState('loading');
    const [customerEmail, setCustomerEmail] = useState('');
    const [orderId, setOrderId] = useState('');
    const [searchParams] = useSearchParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const auth = useSelector(state => state.auth.auth);

    const fetchCart = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const resp = await axios.get(`${baseUrl}/cart`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (resp.data.cart?.products) {
                dispatch(updateTotal(resp.data.cart.products.length));
            } else {
                dispatch(updateTotal(0));
            }
        } catch (e) {
            console.log("⚠️ Error obteniendo carrito:", e.message);
            dispatch(updateTotal(0));
        }
    };

    const verifyPayment = async (sessionId, userId) => {
        try {
            console.log(`🔍 Verificando pago: ${sessionId}, Usuario: ${userId}`);
            
            // Intentar con la ruta pública primero
            const response = await axios.get(
                `${baseUrl}/payment/public-session-status?session_id=${sessionId}&user_id=${userId}`
            );
            
            console.log("✅ Respuesta del servidor:", response.data);
            
            return response.data;
            
        } catch (error) {
            console.error("❌ Error verificando pago:", error.response?.data || error.message);
            
            // Si hay error de autenticación, intentar con token
            if (error.response?.status === 401 && auth) {
                try {
                    const token = localStorage.getItem('token');
                    const authResponse = await axios.get(
                        `${baseUrl}/payment/session-status?session_id=${sessionId}`,
                        {
                            headers: { 'Authorization': `Bearer ${token}` }
                        }
                    );
                    return authResponse.data;
                } catch (authError) {
                    console.error("❌ Error con autenticación:", authError.message);
                }
            }
            
            throw error;
        }
    };

    useEffect(() => {
        const checkPaymentStatus = async () => {
            const sessionId = searchParams.get('session_id');
            const userId = searchParams.get('user_id');
            
            console.log("📋 Parámetros de URL:", { sessionId, userId });
            
            if (!sessionId) {
                console.error("❌ No hay session_id en la URL");
                setStatus('error');
                return;
            }

            // Verificar si ya se procesó este pago
            const processedKey = `processed_${sessionId}`;
            if (localStorage.getItem(processedKey)) {
                console.log("✅ Pago ya procesado anteriormente");
                setStatus('paid');
                return;
            }

            try {
                const result = await verifyPayment(sessionId, userId);
                
                console.log("📊 Resultado del pago:", result);
                
                setStatus(result.status);
                setCustomerEmail(result.customer_email || '');
                
                // Si el pago fue exitoso, limpiar carrito y marcar como procesado
                if (result.status === 'paid') {
                    localStorage.setItem(processedKey, 'true');
                    
                    // Limpiar carrito del estado global
                    dispatch(clearCart());
                    
                    // Obtener información de la orden
                    try {
                        const orderResponse = await axios.get(
                            `${baseUrl}/order/latest?paymentId=${sessionId}`,
                            {
                                headers: { 
                                    'Authorization': `Bearer ${localStorage.getItem('token')}` 
                                }
                            }
                        );
                        if (orderResponse.data.success) {
                            setOrderId(orderResponse.data.order._id);
                        }
                    } catch (orderError) {
                        console.log("⚠️ No se pudo obtener ID de orden:", orderError.message);
                    }
                }
                
            } catch (error) {
                console.error("❌ Error en checkPaymentStatus:", error);
                setStatus('error');
            }
        };

        // Pequeño delay para asegurar que Stripe haya procesado el pago
        const timer = setTimeout(() => {
            checkPaymentStatus();
        }, 1500);

        return () => clearTimeout(timer);
    }, [searchParams, dispatch, auth]);

    // Limpiar localStorage al salir de la página
    useEffect(() => {
        return () => {
            localStorage.removeItem('stripe_checkout_started');
        };
    }, []);

    // Renderizar según estado
    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
                        <h2 className="text-xl font-semibold mt-4 text-gray-700">Procesando pago...</h2>
                        <p className="text-gray-500 mt-2">Por favor, espera unos segundos.</p>
                    </div>
                );

            case 'paid':
                return (
                    <div className="text-center">
                        <CheckCircleIcon className="h-20 w-20 text-green-500 mx-auto" />
                        <h2 className="text-3xl font-bold mt-6 text-green-600">¡Pago Exitoso!</h2>
                        <p className="text-lg text-gray-600 mt-2">Gracias por tu compra</p>
                        
                        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-6 max-w-md mx-auto">
                            {customerEmail && (
                                <p className="text-gray-700">
                                    Se envió un recibo a: <strong className="text-green-700">{customerEmail}</strong>
                                </p>
                            )}
                            {orderId && (
                                <p className="text-gray-700 mt-2">
                                    Número de orden: <code className="bg-gray-100 px-2 py-1 rounded">{orderId.substring(0, 8)}...</code>
                                </p>
                            )}
                        </div>
                        
                        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                to="/orders"
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow font-medium transition"
                            >
                                Ver mis pedidos
                            </Link>
                            <Link
                                to="/products"
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow font-medium transition"
                            >
                                Seguir comprando
                            </Link>
                        </div>
                    </div>
                );

            case 'unpaid':
            case 'canceled':
                return (
                    <div className="text-center">
                        <XCircleIcon className="h-20 w-20 text-red-500 mx-auto" />
                        <h2 className="text-2xl font-bold mt-6 text-red-600">Pago Cancelado</h2>
                        <p className="text-gray-600 mt-2">El pago no se completó o fue cancelado.</p>
                        
                        <div className="mt-8">
                            <button
                                onClick={() => navigate('/cart')}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow font-medium transition"
                            >
                                Volver al carrito
                            </button>
                        </div>
                    </div>
                );

            case 'error':
                return (
                    <div className="text-center">
                        <XCircleIcon className="h-20 w-20 text-red-500 mx-auto" />
                        <h2 className="text-2xl font-bold mt-6 text-red-600">Error de Conexión</h2>
                        <p className="text-gray-600 mt-2">No se pudo verificar el estado del pago.</p>
                        
                        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow font-medium transition"
                            >
                                Reintentar
                            </button>
                            <button
                                onClick={() => navigate('/orders')}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg shadow font-medium transition"
                            >
                                Ver mis pedidos
                            </button>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="text-center">
                        <ClockIcon className="h-20 w-20 text-yellow-500 mx-auto" />
                        <h2 className="text-2xl font-bold mt-6 text-gray-700">Estado desconocido</h2>
                        <p className="text-gray-600 mt-2">El estado del pago no pudo ser determinado.</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow font-medium transition"
                        >
                            Volver al inicio
                        </button>
                    </div>
                );
        }
    };

    return (
        <section className="min-h-screen flex flex-col justify-center items-center bg-gray-50 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
                {renderContent()}
                
                {/* Información de ayuda */}
                <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                    <p className="text-sm text-gray-500">
                        ¿Problemas con tu pedido?{' '}
                        <a 
                            href="mailto:soporte@cosmovida.com" 
                            className="text-blue-600 hover:text-blue-800 underline"
                        >
                            Contáctanos
                        </a>
                    </p>
                </div>
            </div>
        </section>
    );
}