import React from 'react';
import { getOEEStatus, roundToTwo } from '../../utils/helpers';

export const MetricCard = ({ title, value, unit = '%', icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'from-blue-600 to-blue-700 text-blue-100',
    green: 'from-green-600 to-green-700 text-green-100',
    purple: 'from-purple-600 to-purple-700 text-purple-100',
    orange: 'from-orange-600 to-orange-700 text-orange-100',
    red: 'from-red-600 to-red-700 text-red-100',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-lg p-6 shadow-lg`}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-24 bg-current opacity-20 rounded"></div>
        {icon && <span className="text-3xl opacity-20">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="h-10 w-32 bg-current opacity-20 rounded"></div>
      </div>
    </div>
  );
};

export const OEECard = ({ oeeValue, availability, performance, quality, isEmpty }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg border-2 border-gray-700">
      <div className="h-6 w-48 bg-gray-700 rounded mb-4"></div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-12 w-40 bg-gray-700 rounded"></div>
        <div className="h-6 w-20 bg-gray-700 rounded"></div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-700 rounded p-3">
          <div className="h-4 w-20 bg-gray-600 rounded mb-2"></div>
          <div className="h-6 w-16 bg-gray-600 rounded"></div>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <div className="h-4 w-20 bg-gray-600 rounded mb-2"></div>
          <div className="h-6 w-16 bg-gray-600 rounded"></div>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <div className="h-4 w-20 bg-gray-600 rounded mb-2"></div>
          <div className="h-6 w-16 bg-gray-600 rounded"></div>
        </div>
      </div>
    </div>
  );
};

export const StatsGrid = ({ stats = {}, isEmpty }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard title="OEE" value={0} icon="📊" color="purple" />
      <MetricCard title="Availability" value={0} icon="⚙️" color="blue" />
      <MetricCard title="Performance" value={0} icon="🚀" color="green" />
      <MetricCard title="Quality" value={0} icon="✅" color="orange" />
    </div>
  );
};