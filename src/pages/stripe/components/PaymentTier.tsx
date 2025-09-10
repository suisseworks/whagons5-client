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
    <div className={`bg-white bg-opacity-95 backdrop-filter backdrop-blur-lg rounded-xl p-8 flex-1 transition-transform hover:-translate-y-2 flex flex-col relative shadow-lg ${
      popular ? 'ring-2 ring-green-500 shadow-green-500/20' : ''
    }`}>
      {popular && (
        <span className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
          Most Popular
        </span>
      )}
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{name}</h2>
      <p className="text-4xl font-bold text-gray-900 mb-6">
        ${price.toFixed(2)} 
        <span className="text-lg font-normal text-gray-600">
          / {billingCycle === 'monthly' ? 'month' : 'year'}
        </span>
      </p>
      <ul className="mb-8 flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="text-gray-700 mb-2 flex items-start">
            <svg className="w-5 h-5 mr-2 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 mt-auto">
        Select Plan
      </button>
    </div>
  )
}

export default PaymentTier