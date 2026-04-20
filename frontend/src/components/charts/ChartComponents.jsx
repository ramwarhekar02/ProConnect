import React from 'react';

export const SimpleLineChart = ({ data = [], title = 'Production Data', yAxisLabel = 'Value' }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 h-80 flex items-center justify-center border border-gray-700">
        <p className="text-gray-400">No data available</p>
      </div>
    );
  }

  // Find min and max values for scaling
  const values = data.map((d) => d.value || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  // Calculate SVG path
  const width = 800;
  const height = 300;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((d, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">{title}</h3>

      <svg width="100%" height="350" viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={`h-${i}`}
            x1={padding}
            y1={padding + (chartHeight / 4) * i}
            x2={width - padding}
            y2={padding + (chartHeight / 4) * i}
            stroke="#4B5563"
            strokeDasharray="5,5"
          />
        ))}

        {/* Y-axis labels hidden */}

        {/* Y-axis */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#6B7280" strokeWidth="2" />

        {/* X-axis */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#6B7280" strokeWidth="2" />

        {/* Chart line */}
        <path d={pathD} fill="none" stroke="#3B82F6" strokeWidth="2" />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={`point-${i}`} cx={p.x} cy={p.y} r="4" fill="#3B82F6" />
        ))}

        {/* X-axis label hidden */}

        {/* Y-axis label hidden */}
      </svg>
    </div>
  );
};

export const OEETrendChart = ({ metrics = [] }) => {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 h-96 flex items-center justify-center border border-gray-700">
        <p className="text-gray-400">No data available</p>
      </div>
    );
  }

  const width = 800;
  const height = 350;
  const padding = 50;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Prepare data for lines
  const oeeValues = metrics.map((m) => m.oee || 0);
  const availabilityValues = metrics.map((m) => m.availability || 0);
  const performanceValues = metrics.map((m) => m.performance || 0);
  const qualityValues = metrics.map((m) => m.quality || 0);

  const createPath = (values) => {
    const max = 100;
    return values
      .map((v, i) => {
        const x = padding + (i / (values.length - 1 || 1)) * chartWidth;
        const y = padding + chartHeight - (v / max) * chartHeight;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="h-6 w-40 bg-gray-700 rounded mb-4"></div>

      <svg width="100%" height="400" viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Grid */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={`grid-${i}`}
            x1={padding}
            y1={padding + (chartHeight / 4) * i}
            x2={width - padding}
            y2={padding + (chartHeight / 4) * i}
            stroke="#4B5563"
            strokeDasharray="5,5"
          />
        ))}

        {/* Y-axis */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#6B7280" strokeWidth="2" />

        {/* X-axis */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#6B7280" strokeWidth="2" />

        {/* OEE line */}
        <path d={createPath(oeeValues)} fill="none" stroke="#8B5CF6" strokeWidth="2" opacity="0.8" />

        {/* Availability line */}
        <path d={createPath(availabilityValues)} fill="none" stroke="#3B82F6" strokeWidth="2" opacity="0.8" />

        {/* Performance line */}
        <path d={createPath(performanceValues)} fill="none" stroke="#10B981" strokeWidth="2" opacity="0.8" />

        {/* Quality line */}
        <path d={createPath(qualityValues)} fill="none" stroke="#F59E0B" strokeWidth="2" opacity="0.8" />
      </svg>

      {/* Legend */}
      <div className="flex gap-6 mt-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
          <div className="h-3 w-8 bg-gray-700 rounded"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <div className="h-3 w-16 bg-gray-700 rounded"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <div className="h-3 w-16 bg-gray-700 rounded"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
          <div className="h-3 w-12 bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
  );
};
