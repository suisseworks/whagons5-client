import React from 'react'

interface PaymentTierProps {
  name: string;
  price: number;
  features: string[];
  popular?: boolean;
  billingCycle: 'monthly' | 'yearly';
}

const PaymentTier: React.FC<PaymentTierProps> = ({ name, price, features, popular, billingCycle }) => {
  return (
    <div className={`bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-xl p-8 flex-1 transition-transform hover:-translate-y-2 flex flex-col relative ${
      popular ? 'ring-2 ring-green-400' : ''
    }`}>
      {popular && (
        <span className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-green-400 text-white px-4 py-1 rounded-full text-sm font-semibold">
          Most Popular
        </span>
      )}
      <h2 className="text-2xl font-bold text-white mb-4">{name}</h2>
      <p className="text-4xl font-bold text-white mb-6">
        ${price.toFixed(2)} 
        <span className="text-lg font-normal">
          / {billingCycle === 'monthly' ? 'month' : 'year'}
        </span>
      </p>
      <ul className="mb-8 flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="text-gray-200 mb-2 flex items-start">
            <svg className="w-5 h-5 mr-2 text-green-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-bold py-3 px-4 rounded-full transition-colors mt-auto">
        Select Plan
      </button>
    </div>
  )
}

export default PaymentTier