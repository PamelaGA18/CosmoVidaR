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

    // ✅ NUEVA FUNCIÓN para extraer parámetros del HASH
    const getParamsFromHash = () => {
        const hash = window.location.hash;
        console.log("🔍 Hash completo para análisis:", hash);
        
        if (!hash.includes('?')) {
            return { sessionId: null, userId: null };
        }
        
        // Extraer query string del hash: #/payment-return?session_id=xxx&user_id=yyy
        const queryPart = hash.split('?')[1];
        const params = new URLSearchParams(queryPart);
        
        return {
            sessionId: params.get('session_id'),
            userId: params.get('user_id')
        };
    };

    useEffect(() => {
        console.log("=== DEBUG PAYMENT RETURN ===");
        console.log("1. URL completa:", window.location.href);
        console.log("2. Hash:", window.location.hash);
        console.log("3. Search (query string):", window.location.search);
        
        // ✅ USAR AMBOS MÉTODOS
        const fromSearchParams = {
            sessionId: searchParams.get('session_id'),
            userId: searchParams.get('user_id')
        };
        
        const fromHash = getParamsFromHash();
        
        console.log("4. De searchParams:", fromSearchParams);
        console.log("5. Del hash:", fromHash);
        
        // Decidir cuál usar (priorizar hash si existe)
        const sessionId = fromHash.sessionId || fromSearchParams.sessionId;
        const userId = fromHash.userId || fromSearchParams.userId;
        
        console.log("6. Final - Usando:", { sessionId, userId });
        console.log("============================");
        
        if (!sessionId) {
            console.error("❌ No session_id found anywhere");
            setStatus('error');
            return;
        }

        const verifyPayment = async () => {
            try {
                console.log("🔍 Verificando pago con session:", sessionId);
                
                const response = await axios.get(
                    `${baseUrl}/payment/public-session-status?session_id=${sessionId}&user_id=${userId}`
                );
                
                console.log("✅ Estado del pago:", response.data);
                
                if (response.data.success) {
                    setStatus(response.data.status);
                    setCustomerEmail(response.data.customer_email || '');
                    
                    if (response.data.status === 'paid') {
                        // Limpiar carrito
                        dispatch(clearCart());
                        dispatch(updateTotal(0));
                        localStorage.removeItem('cartData');
                        localStorage.removeItem('stripe_session_id');
                        
                        console.log("🛒 Carrito limpiado");
                        
                        // Obtener info de orden
                        try {
                            const token = localStorage.getItem('token');
                            if (token) {
                                const ordersResponse = await axios.get(`${baseUrl}/order`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                
                                if (ordersResponse.data.success && ordersResponse.data.orders.length > 0) {
                                    setOrderId(ordersResponse.data.orders[0]._id);
                                }
                            }
                        } catch (orderError) {
                            console.log("⚠️ No se pudo obtener orden:", orderError.message);
                        }
                    }
                } else {
                    setStatus('error');
                }
                
            } catch (error) {
                console.error("❌ Error verificando pago:", error);
                setStatus('error');
            }
        };

        setTimeout(() => {
            verifyPayment();
        }, 2000);

    }, [searchParams, dispatch]);


    // Renderizar según estado
    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div className="text-center p-8">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
                        <h2 className="text-xl font-semibold mt-4 text-gray-700">Verificando tu pago...</h2>
                        <p className="text-gray-500 mt-2">Esto puede tomar unos segundos.</p>
                    </div>
                );

            case 'paid':
                return (
                    <div className="text-center p-8 max-w-md mx-auto">
                        <CheckCircleIcon className="h-20 w-20 text-green-500 mx-auto" />
                        <h2 className="text-3xl font-bold mt-6 text-green-600">¡Pago Exitoso!</h2>
                        <p className="text-lg text-gray-600 mt-2">Tu pedido ha sido confirmado.</p>
                        
                        {customerEmail && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                                <p className="text-gray-700">
                                    Recibo enviado a: <strong className="text-green-700">{customerEmail}</strong>
                                </p>
                            </div>
                        )}
                        
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
                        
                        <p className="text-sm text-gray-500 mt-6">
                            ¿Problemas con tu pedido?{' '}
                            <a href="mailto:soporte@cosmovida.com" className="text-blue-600 hover:underline">
                                Contáctanos
                            </a>
                        </p>
                    </div>
                );

            case 'unpaid':
            case 'canceled':
                return (
                    <div className="text-center p-8">
                        <h2 className="text-red-500 text-2xl font-bold">Pago pendiente o cancelado</h2> {/* ✅ CORREGIDO */}
                        <p className="text-gray-600 mt-2">El pago no se completó.</p>
                        <button 
                            onClick={() => navigate('/cart')}
                            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow"
                        >
                            Volver al carrito
                        </button>
                    </div>
                );

            default:
                return (
                    <div className="text-center p-8">
                        <h2 className="text-red-500 text-2xl font-bold">Error</h2>
                        <p className="text-gray-600 mt-2">No se pudo verificar el estado del pago.</p>
                        <div className="mt-6 flex gap-4 justify-center">
                            <button 
                                onClick={() => window.location.reload()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow"
                            >
                                Reintentar
                            </button>
                            <button 
                                onClick={() => navigate('/')}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg shadow"
                            >
                                Ir al inicio
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <section className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-[#6A5A8C] to-[#A6789F] p-6 text-center">
                    <h1 className="text-2xl font-bold text-white">Confirmación de Pago</h1>
                </div>
                <div className="p-8">
                    {renderContent()}
                </div>
            </div>
        </section>
    );
}