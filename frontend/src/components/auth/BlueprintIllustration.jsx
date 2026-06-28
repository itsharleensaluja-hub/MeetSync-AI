import React from 'react';

function BlueprintIllustration() {
  return (
    <svg
      className="blueprint-illustration"
      viewBox="0 0 400 300"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <style>
          {`
            .bp-stroke {
              stroke: #3B82F6;
              stroke-opacity: 0.045;
              stroke-width: 1;
              stroke-linecap: round;
              stroke-linejoin: round;
              fill: none;
            }
          `}
        </style>
      </defs>
      {/* Meeting table - rectangular outline */}
      <rect className="bp-stroke" x="60" y="120" width="180" height="100" rx="8" />
      {/* Table legs */}
      <line className="bp-stroke" x1="70" y1="220" x2="70" y2="240" />
      <line className="bp-stroke" x1="230" y1="220" x2="230" y2="240" />
      <line className="bp-stroke" x1="70" y1="220" x2="230" y2="220" />
      
      {/* Chairs - small rectangles on sides */}
      <rect className="bp-stroke" x="30" y="150" width="24" height="40" rx="4" />
      <rect className="bp-stroke" x="246" y="150" width="24" height="40" rx="4" />
      <rect className="bp-stroke" x="30" y="195" width="24" height="40" rx="4" />
      <rect className="bp-stroke" x="246" y="195" width="24" height="40" rx="4" />
      
      {/* Presentation screen - top */}
      <rect className="bp-stroke" x="80" y="40" width="140" height="60" rx="6" />
      {/* Screen stand */}
      <line className="bp-stroke" x1="150" y1="100" x2="150" y2="120" />
      <line className="bp-stroke" x1="130" y1="120" x2="170" y2="120" />
      
      {/* Abstract people - simple circles with shoulders */}
      <circle className="bp-stroke" cx="110" cy="165" r="12" />
      <path className="bp-stroke" d="M110,177 Q100,200 110,200" />
      <path className="bp-stroke" d="M110,177 Q120,200 110,200" />
      
      <circle className="bp-stroke" cx="190" cy="165" r="12" />
      <path className="bp-stroke" d="M190,177 Q180,200 190,200" />
      <path className="bp-stroke" d="M190,177 Q200,200 190,200" />
      
      {/* Third person */}
      <circle className="bp-stroke" cx="150" cy="150" r="10" />
      <path className="bp-stroke" d="M150,160 Q145,180 150,180" />
      <path className="bp-stroke" d="M150,160 Q155,180 150,180" />
      
      {/* Analytics chart - simple bars on right side */}
      <rect className="bp-stroke" x="280" y="60" width="30" height="100" rx="2" />
      <rect className="bp-stroke" x="320" y="80" width="30" height="80" rx="2" />
      <rect className="bp-stroke" x="360" y="50" width="30" height="110" rx="2" />
      
      {/* Chart axis */}
      <line className="bp-stroke" x1="280" y1="160" x2="390" y2="160" />
      <line className="bp-stroke" x1="280" y1="60" x2="280" y2="160" />
    </svg>
  );
}

export default BlueprintIllustration;