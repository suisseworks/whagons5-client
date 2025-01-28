import React from 'react'
import PaymentTier from '../components/PaymentTier'



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
    return (
      <div className="flex items-center justify-center p-[5px] py-2 h-full w-full bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-3xl shadow-xl p-8">
          <h1 className="text-4xl font-bold text-center text-white mb-4">Choose Your Plan</h1>
          <p className="text-center text-white mb-12">Streamline your hotel operations with our AI-powered task management solution</p>
          <div className="flex flex-col lg:flex-row justify-between gap-8">
            {tiers.map((tier) => (
              <PaymentTier key={tier.name} {...tier} />
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  export default Stripe