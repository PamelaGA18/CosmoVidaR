import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import axios from "axios";
import { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { baseUrl } from "../../../environment";

const stripePromise = loadStripe("pk_test_51RUheLQj0Dr03eMVBwAUYhPIbzHSW2H1NQ1cOjdah8UgP8xjmYerXLA1bAKDM3IRA1xDV9Ou7FLBHYC9ZvFMFmx300dplyYt5a");

export default function Checkout() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const fetchClientSecret = useCallback(() => {
        console.log("🔄 Solicitando clientSecret...");
        
        return axios.get(`${baseUrl}/payment/create-session`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(resp => {
            console.log("✅ clientSecret recibido:", resp.data);
            
            // Guardar sessionId en localStorage para recuperarlo después
            if (resp.data.sessionId) {
                localStorage.setItem('stripe_session_id', resp.data.sessionId);
                localStorage.setItem('stripe_checkout_started', 'true');
            }
            
            return resp.data.clientSecret;
        })
        .catch(e => {
            console.error("❌ Error creando sesión:", e.response?.data || e.message);
            setError(e.response?.data?.message || "Error al crear sesión de pago");
            setLoading(false);
            throw e;
        });
    }, []);

    // Efecto para limpiar localStorage cuando se sale del checkout
    useEffect(() => {
        return () => {
            localStorage.removeItem('stripe_checkout_started');
        };
    }, []);

    const options = { 
        fetchClientSecret,
        onComplete: () => {
            console.log("✅ Checkout completado");
            // Redirigir a la página de éxito
            const sessionId = localStorage.getItem('stripe_session_id');
            if (sessionId) {
                navigate(`/payment-return?session_id=${sessionId}`);
            }
        }
    };

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
                    <h2 className="text-red-800 text-xl font-bold mb-2">Error</h2>
                    <p className="text-red-600 mb-4">{error}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
                    >
                        Reintentar
                    </button>
                    <button 
                        onClick={() => navigate('/cart')}
                        className="ml-4 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
                    >
                        Volver al Carrito
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div id="checkout" className="min-h-screen">
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-6 text-center">Finalizar Compra</h1>
                
                {/* Información importante */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                    <p className="text-blue-800 text-sm">
                        <strong>Nota:</strong> Estás en modo de prueba. Para simular un pago exitoso usa:
                    </p>
                    <ul className="text-blue-700 text-sm mt-2 list-disc pl-5">
                        <li>Número de tarjeta: <code>4242 4242 4242 4242</code></li>
                        <li>Fecha de expiración: Cualquier fecha futura</li>
                        <li>CVC: Cualquier número de 3 dígitos</li>
                    </ul>
                </div>
                
                {/* Checkout de Stripe */}
                <div className="max-w-2xl mx-auto">
                    <EmbeddedCheckoutProvider
                        stripe={stripePromise}
                        options={options}
                    >
                        <EmbeddedCheckout />
                    </EmbeddedCheckoutProvider>
                </div>
                
                {/* Botón de cancelar */}
                <div className="text-center mt-6">
                    <button 
                        onClick={() => navigate('/cart')}
                        className="text-gray-600 hover:text-gray-800 underline"
                    >
                        Cancelar y volver al carrito
                    </button>
                </div>
            </div>
        </div>
    );
}