import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumbs/Breadcrumb';
import { loadStripe } from '@stripe/stripe-js';

// const stripePromise = loadStripe("pk_test_c2ltcGxlLWR1Y2stNTcuY2xlcmsuYWNjb3VudHMuZGV2JA");

const Stripe = () => {
  const handleRedirect = (url: string) => {
    window.location.href = url;
  };

  const handleCheckout = async () => {
    try {
      const response = await fetch(
        'http://localhost:8000/create-checkout-session',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            price_id: 'price_1PyKJxQTWjXb1ROmd3zndi6L', // Replace with your Stripe Price ID
          }),
        },
      );

      if (!response.ok) throw new Error('Failed to create checkout session');

      // const { sessionId } = await response.json();

      const res = await response.json();

      console.log(res.url);

      // const stripe = await stripePromise;
      // stripe?.redirectToCheckout({ sessionId });
      handleRedirect(res.url);
    } catch (error) {
      console.error('Error during checkout:', error);
    }
  };

  return (
    <div>
      <Breadcrumb pageName="Stripe" />
      <h1>Stripe Checkout</h1>
      <button
        onClick={handleCheckout}
        className="px-6 py-3 my-2 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        Pay Now
      </button>
    </div>
  );
};

export default Stripe;
