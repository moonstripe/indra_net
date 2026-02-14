interface LogoProps {
  className?: string
  size?: number
}

export default function Logo({ className = '', size = 32 }: LogoProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 200 200" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ fillRule: 'evenodd', clipRule: 'evenodd', strokeLinecap: 'round', strokeLinejoin: 'round', strokeMiterlimit: 1.5 }}
    >
      <g transform="matrix(1.221429,0,0,0.775148,-21.884548,6.835596)">
        <path d="M64,25L64,146" style={{ fill: 'none', stroke: 'rgb(147,0,255)', strokeWidth: '12.71px' }} />
      </g>
      <g transform="matrix(1.096848,0,0,1.029618,-13.911411,0.473836)">
        <path d="M64,25C64,25 67.624,63.112 104.135,77.135" style={{ fill: 'none', stroke: 'rgb(147,0,255)', strokeWidth: '12.22px' }} />
      </g>
      <g transform="matrix(1.034475,0,0,1.034475,-15.926968,-13.895481)">
        <circle cx="70" cy="130" r="12" style={{ fill: 'rgb(145,2,255)', stroke: 'rgb(147,0,255)', strokeWidth: '0.97px', strokeLinecap: 'butt', strokeMiterlimit: 2 }} />
      </g>
      <g transform="matrix(1.034475,0,0,1.034475,28.073032,-54.895481)">
        <circle cx="70" cy="130" r="12" style={{ fill: 'rgb(145,2,255)', stroke: 'rgb(147,0,255)', strokeWidth: '0.97px', strokeLinecap: 'butt', strokeMiterlimit: 2 }} />
      </g>
      <g transform="matrix(1.034475,0,0,1.034475,-46.961224,-35.65481)">
        <circle cx="100" cy="60" r="12" style={{ fill: 'rgb(147,1,255)', stroke: 'rgb(147,0,255)', strokeWidth: '0.97px', strokeLinecap: 'butt', strokeMiterlimit: 2 }} />
      </g>
      <g transform="matrix(1.221429,0,0,0.750354,-21.884548,7.455431)">
        <path d="M64,25L64,146" style={{ fill: 'none', stroke: 'rgb(147,0,255)', strokeWidth: '12.83px' }} />
      </g>
      <g transform="matrix(1.096848,0,0,1.029618,-13.911411,0.473836)">
        <path d="M64,25C64,25 67.624,63.112 104.135,77.135" style={{ fill: 'none', stroke: 'rgb(147,0,255)', strokeWidth: '12.22px' }} />
      </g>
      <g transform="matrix(-1.221429,-0,0,-0.775148,221.857143,193.164404)">
        <path d="M64,25L64,146" style={{ fill: 'none', stroke: 'rgb(147,0,255)', strokeWidth: '12.71px' }} />
      </g>
      <g transform="matrix(-1.096848,-0,0,-1.029618,213.884005,199.526164)">
        <path d="M64,25C64,25 67.624,63.112 104.135,77.135" style={{ fill: 'none', stroke: 'rgb(147,0,255)', strokeWidth: '12.22px' }} />
      </g>
      <g transform="matrix(-1.034475,-0,0,-1.034475,215.899563,213.895481)">
        <circle cx="70" cy="130" r="12" style={{ fill: 'rgb(145,2,255)', stroke: 'rgb(147,0,255)', strokeWidth: '0.97px', strokeLinecap: 'butt', strokeMiterlimit: 2 }} />
      </g>
      <g transform="matrix(-1.034475,-0,0,-1.034475,171.899563,254.895481)">
        <circle cx="70" cy="130" r="12" style={{ fill: 'rgb(145,2,255)', stroke: 'rgb(147,0,255)', strokeWidth: '0.97px', strokeLinecap: 'butt', strokeMiterlimit: 2 }} />
      </g>
      <g transform="matrix(-1.034475,-0,0,-1.034475,246.933819,235.65481)">
        <circle cx="100" cy="60" r="12" style={{ fill: 'rgb(147,1,255)', stroke: 'rgb(147,0,255)', strokeWidth: '0.97px', strokeLinecap: 'butt', strokeMiterlimit: 2 }} />
      </g>
      <g transform="matrix(-1.221429,-0,0,-0.750354,221.857143,192.544569)">
        <path d="M64,25L64,146" style={{ fill: 'none', stroke: 'rgb(147,0,255)', strokeWidth: '12.83px' }} />
      </g>
      <g transform="matrix(-1.096848,-0,0,-1.029618,213.884005,199.526164)">
        <path d="M64,25C64,25 67.624,63.112 104.135,77.135" style={{ fill: 'none', stroke: 'rgb(147,0,255)', strokeWidth: '12.22px' }} />
      </g>
    </svg>
  )
}
