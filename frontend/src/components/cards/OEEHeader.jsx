import React from 'react';

const OEEHeader = ({
  onDateChange,
  onShiftChange,
  onApply,
  dateValue,
  shiftValue,
  shiftOptions = [],
  rangeLabel = '',
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-900 p-4 rounded-lg border border-gray-700 mb-6">
      <div className="flex gap-2 items-center">
        <div className="h-10 w-20 bg-gray-700 rounded-lg"></div>
        <div className="h-10 w-20 bg-gray-700 rounded-lg"></div>
        <div className="h-10 w-16 bg-gray-700 rounded-lg"></div>
        <div className="h-10 w-20 bg-gray-700 rounded-lg"></div>
        <div className="h-10 w-24 bg-gray-700 rounded-lg"></div>
        <div className="h-10 w-28 bg-gray-700 rounded-lg"></div>
      </div>
      <div className="flex gap-2 items-center">
        <div className="h-10 w-32 bg-gray-700 rounded-lg"></div>
        <div className="h-10 w-24 bg-gray-700 rounded-lg"></div>
        <div className="h-10 w-20 bg-gray-700 rounded-lg"></div>
      </div>
      {rangeLabel && (
        <div className="h-6 w-48 bg-gray-600 rounded"></div>
      )}
    </div>
  );
};

export default OEEHeader;
