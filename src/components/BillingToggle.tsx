import React from 'react';

interface BillingToggleProps {
  billingCycle: 'monthly' | 'yearly';
  onChange: (cycle: 'monthly' | 'yearly') => void;
}

const BillingToggle = ({ billingCycle, onChange }: BillingToggleProps) => {
  return (
    <fieldset className="flex items-center justify-center gap-6 mb-8" role="radiogroup" aria-label="Billing cycle selection">
      <legend className="sr-only">Select billing cycle</legend>
      
      {/* Monthly Label */}
      <span
        className={`text-white text-sm transition-opacity duration-200 hover:opacity-100 ${
          billingCycle === 'monthly' ? 'font-bold' : 'opacity-70'
        }`}
        role="radio"
        aria-checked={billingCycle === 'monthly'}
      >
        Monthly
      </span>

      {/* Toggle Button */}
      <label className="inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={billingCycle === 'yearly'}
          onChange={() => onChange(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
          className="sr-only peer"
          aria-label="Toggle billing cycle"
        />
        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600 hover:bg-gray-300 dark:hover:bg-gray-600"></div>
      </label>

      {/* Yearly Label */}
      <span
        className={`text-white text-sm transition-opacity duration-200 hover:opacity-100 ${
          billingCycle === 'yearly' ? 'font-bold' : 'opacity-70'
        }`}
        role="radio"
        aria-checked={billingCycle === 'yearly'}
      >
        Yearly <span className="text-green-400">(Save 17%)</span>
      </span>
    </fieldset>
  );
};

export default BillingToggle;
