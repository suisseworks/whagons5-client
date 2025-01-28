import React from 'react'

interface PaymentTierProps {
  name: string;
  price: number;
  features: string[];
}

const PaymentTier: React.FC<PaymentTierProps> = ({ name, price, features }) => {
  return (
    <div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-xl p-8 flex-1 transition-transform hover:-translate-y-2 flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-4">{name}</h2>
      <p className="text-4xl font-bold text-white mb-6">${price.toFixed(2)} <span className="text-lg font-normal">/ month</span></p>
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
