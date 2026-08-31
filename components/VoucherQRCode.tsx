import React, { useState, useEffect, useMemo } from 'react';
import { Voucher, AppConfig } from '../types';
import { getVoucherVerificationUrl, generateQRCodeDataUrl } from '../utils/voucherQrHelper';

interface VoucherQRCodeProps {
  voucher: Voucher;
  config?: AppConfig;
  size?: number;
  showLabel?: boolean;
  className?: string;
  onClick?: () => void;
  darkColor?: string;
}

export const VoucherQRCode: React.FC<VoucherQRCodeProps> = ({
  voucher,
  config,
  size = 76,
  showLabel = true,
  className = '',
  onClick,
  darkColor = '#0f172a'
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const verificationUrl = useMemo(() => {
    return getVoucherVerificationUrl(voucher, config);
  }, [voucher, config]);

  useEffect(() => {
    let isMounted = true;
    if (verificationUrl) {
      generateQRCodeDataUrl(verificationUrl, {
        width: size * 3, // High-DPI for crisp printing & PDF export
        margin: 1,
        color: { dark: darkColor, light: '#ffffff' }
      }).then(url => {
        if (isMounted) {
          setQrDataUrl(url);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [verificationUrl, size, darkColor]);

  if (!qrDataUrl) {
    return (
      <div 
        style={{ width: `${size}px`, height: `${size}px` }} 
        className={`bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-[8px] text-slate-400 font-mono ${className}`}
      >
        QR...
      </div>
    );
  }

  return (
    <div 
      className={`inline-flex flex-col items-center select-none ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
      onClick={onClick}
      title="Scan with any smartphone camera to verify this voucher online or view digital details"
    >
      <div className="p-1 bg-white border border-slate-200 rounded-md shadow-xs flex items-center justify-center">
        <img 
          src={qrDataUrl} 
          alt={`QR Code for Voucher ${voucher.voucherNum}`}
          style={{ width: `${size}px`, height: `${size}px` }}
          className="object-contain block"
        />
      </div>
      {showLabel && (
        <div className="mt-0.5 text-center leading-none">
          <span className="text-[7px] font-black tracking-tighter text-slate-600 uppercase flex items-center justify-center gap-0.5 whitespace-nowrap">
            <span className="text-emerald-600">✓</span> SCAN TO VERIFY
          </span>
          <span className="text-[6px] font-bold text-slate-400 uppercase tracking-widest block scale-90">
            DIGITAL E-VOUCHER
          </span>
        </div>
      )}
    </div>
  );
};

export default VoucherQRCode;
