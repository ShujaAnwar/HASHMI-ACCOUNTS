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

// Global cache for instant synchronous rendering
const qrCodeCache = new Map<string, string>();

export const VoucherQRCode: React.FC<VoucherQRCodeProps> = ({
  voucher,
  config,
  size = 68,
  showLabel = true,
  className = '',
  onClick,
  darkColor = '#0f172a'
}) => {
  const verificationUrl = useMemo(() => {
    return getVoucherVerificationUrl(voucher, config);
  }, [voucher, config]);

  const cacheKey = useMemo(() => {
    return `${verificationUrl}_${size}_${darkColor}`;
  }, [verificationUrl, size, darkColor]);

  const [qrDataUrl, setQrDataUrl] = useState<string>(() => {
    return qrCodeCache.get(cacheKey) || '';
  });

  useEffect(() => {
    let isMounted = true;
    if (verificationUrl) {
      if (qrCodeCache.has(cacheKey)) {
        setQrDataUrl(qrCodeCache.get(cacheKey)!);
        return;
      }

      generateQRCodeDataUrl(verificationUrl, {
        width: Math.max(size * 3, 260), // High-DPI for crisp printing & PDF export
        margin: 1,
        color: { dark: darkColor, light: '#ffffff' }
      }).then(url => {
        if (url) {
          qrCodeCache.set(cacheKey, url);
        }
        if (isMounted && url) {
          setQrDataUrl(url);
        }
      }).catch(err => {
        console.error('QR code generation failed:', err);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [verificationUrl, cacheKey, size, darkColor]);

  return (
    <div 
      className={`inline-flex flex-col items-center select-none ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
      onClick={onClick}
      title="Scan with any smartphone camera to verify this voucher online or view digital details"
    >
      <div 
        style={{ width: `${size}px`, height: `${size}px` }}
        className="p-1 bg-white border border-slate-300 dark:border-slate-700 rounded-md shadow-xs flex items-center justify-center overflow-hidden shrink-0"
      >
        {qrDataUrl ? (
          <img 
            src={qrDataUrl} 
            alt={`QR Code for Voucher ${voucher.voucherNum}`}
            style={{ width: `${size - 8}px`, height: `${size - 8}px` }}
            className="object-contain block max-w-full max-h-full"
          />
        ) : (
          <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-[7px] text-slate-400 font-mono text-center leading-none">
            <span className="text-[10px]">📷</span>
            <span>QR CODE</span>
          </div>
        )}
      </div>
      {showLabel && (
        <div className="mt-1 text-center leading-none">
          <span className="text-[7.5px] font-black tracking-tight text-slate-800 uppercase flex items-center justify-center gap-0.5 whitespace-nowrap">
            <span className="text-emerald-600 font-black">✓</span> SCAN TO VERIFY
          </span>
          <span className="text-[6px] font-bold text-slate-400 uppercase tracking-widest block scale-90 mt-0.5">
            DIGITAL E-VOUCHER
          </span>
        </div>
      )}
    </div>
  );
};

export default VoucherQRCode;
