

import BillingToggle from '@/components/BillingToggle'
import PaymentTier from '@/components/PaymentTier'
import { useState } from 'react'

const tiers = [
    {
      name: 'Basic',
      price: 29.99,
      features: [
        'Task creation and assignment',
        'Basic reporting',
        'Mobile app access',
        'Email support',
        'Up to 10 team members',
        '30-day data retention'
      ],
    },
    {
      name: 'Pro',
      price: 79.99,
      popular: true,
      features: [
        'All Basic features',
        'Advanced KPI dashboard',
        'Custom task workflows',
        'Team performance analytics',
        'Priority email & chat support',
        'Up to 50 team members',
        '90-day data retention',
        'Basic AI-powered insights'
      ],
    },
    {
      name: 'Enterprise',
      price: 199.99,
      features: [
        'All Pro features',
        'Unlimited team members',
        'Advanced AI-powered task optimization',
        'Predictive cleaning schedules',
        'Custom integrations',
        'Dedicated account manager',
        'On-site training',
        '24/7 phone support',
        'Unlimited data retention',
        'Multi-property management'
      ],
    },
  ]



  function Stripe() {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
    
    const getPrice = (basePrice: number) => {
      if (billingCycle === 'yearly') {
        return (basePrice * 10).toFixed(2) // 2 months free
      }
      return basePrice.toFixed(2)
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="w-full max-w-7xl">
          {/* Header Section */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">Choose Your Plan</h1>
            <p className="text-xl text-white mb-8">Streamline your hotel operations with our AI-powered task management solution</p>
            
            {/* Billing Toggle */}
            <BillingToggle 
              billingCycle={billingCycle}
              onChange={setBillingCycle}
            />
          </div>

          {/* Pricing Cards */}
          <div className="flex flex-col lg:flex-row justify-between gap-8 mb-16">
            {tiers.map((tier) => (
              <PaymentTier
                key={tier.name}
                {...tier}
                price={Number(getPrice(tier.price))}
                billingCycle={billingCycle}
              />
            ))}
          </div>

          {/* Money Back Guarantee */}
          <div className="text-center mb-16">
            <div className="inline-block bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-xl p-4">
              <p className="text-white text-lg">
                <span className="font-bold">30-Day Money-Back Guarantee</span> - Try risk-free and see the results for yourself
              </p>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-3xl p-8 mb-16">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Frequently Asked Questions</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Can I switch plans later?</h3>
                <p className="text-gray-200">Yes, you can upgrade or downgrade your plan at any time. The new pricing will be prorated based on your billing cycle.</p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">What payment methods do you accept?</h3>
                <p className="text-gray-200">We accept all major credit cards, including Visa, Mastercard, and American Express. We also support payment via PayPal.</p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Is there a setup fee?</h3>
                <p className="text-gray-200">No, there are no hidden fees. You only pay the advertised price for your chosen plan.</p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Do you offer custom enterprise solutions?</h3>
                <p className="text-gray-200">Yes, we can create custom solutions for large organizations. Contact our sales team for more information.</p>
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-xl p-6">
              <p className="text-gray-200 mb-4">"This platform has revolutionized how we manage our hotel operations. The AI-powered insights are game-changing."</p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-300 rounded-full mr-4"></div>
                <div>
                  <p className="text-white font-bold">Sarah Johnson</p>
                  <p className="text-gray-300">Operations Manager, Luxury Hotel Group</p>
                </div>
              </div>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-xl p-6">
              <p className="text-gray-200 mb-4">"The team performance analytics have helped us optimize our staffing and improve guest satisfaction."</p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-300 rounded-full mr-4"></div>
                <div>
                  <p className="text-white font-bold">Michael Chen</p>
                  <p className="text-gray-300">General Manager, Boutique Hotels</p>
                </div>
              </div>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-xl p-6">
              <p className="text-gray-200 mb-4">"Outstanding customer support and continuous feature updates. Worth every penny."</p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-300 rounded-full mr-4"></div>
                <div>
                  <p className="text-white font-bold">Emma Rodriguez</p>
                  <p className="text-gray-300">Director of Housekeeping</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  export default Stripe
