import QRCode from 'qrcode';
import { Voucher, VoucherType, Currency, AppConfig } from '../types';

export interface VerifiedVoucherPayload {
  vNum: string;
  type: string;
  date: string;
  pax?: string;
  cust?: string;
  amt?: number;
  curr?: string;
  roe?: number;
  ref?: string;
  comp?: string;
  details?: any;
}

/**
 * Compactly encodes key voucher details into a base64 string for URL embedding.
 */
export const encodeVoucherData = (voucher: Voucher, config?: AppConfig): string => {
  try {
    const payload: VerifiedVoucherPayload = {
      vNum: voucher.voucherNum,
      type: voucher.type,
      date: voucher.date?.split('T')[0] || '',
      pax: voucher.details?.paxName || voucher.details?.headName || '',
      amt: voucher.totalAmountPKR || 0,
      curr: voucher.currency || Currency.PKR,
      roe: voucher.roe || 1,
      ref: voucher.reference || voucher.details?.bookingRef || '',
      comp: config?.companyName || 'Hashmi Travel Solutions',
      details: {
        hotel: voucher.details?.hotelName,
        city: voucher.details?.city,
        fromDate: voucher.details?.fromDate?.split('T')[0],
        toDate: voucher.details?.toDate?.split('T')[0],
        rooms: voucher.details?.numRooms,
        nights: voucher.details?.numNights,
        roomType: voucher.details?.roomType,
        sector: voucher.details?.sector,
        vehicle: voucher.details?.vehicle,
        qty: voucher.details?.quantity,
        itemsCount: voucher.details?.items?.length || 0,
        items: voucher.details?.items ? voucher.details.items.slice(0, 5).map((it: any) => ({
          hotelName: it.hotelName,
          city: it.city,
          fromDate: it.fromDate?.split('T')[0],
          toDate: it.toDate?.split('T')[0],
          sector: it.sector,
          vehicle: it.vehicle,
          date: it.date?.split('T')[0],
          paxName: it.paxName,
          quantity: it.quantity,
          roomType: it.roomType
        })) : undefined
      }
    };

    const jsonStr = JSON.stringify(payload);
    // Encode to base64 safely
    if (typeof window !== 'undefined') {
      return btoa(encodeURIComponent(jsonStr));
    }
    return Buffer.from(jsonStr).toString('base64');
  } catch (e) {
    console.error('Failed to encode voucher for QR:', e);
    return '';
  }
};

/**
 * Decodes the verification payload from a base64 query string.
 */
export const decodeVoucherData = (encodedData: string): VerifiedVoucherPayload | null => {
  try {
    let jsonStr = '';
    if (typeof window !== 'undefined') {
      jsonStr = decodeURIComponent(atob(encodedData));
    } else {
      jsonStr = Buffer.from(encodedData, 'base64').toString('utf-8');
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to decode voucher payload:', e);
    return null;
  }
};

/**
 * Generates the full public verification web URL for a voucher.
 */
export const getVoucherVerificationUrl = (voucher: Voucher, config?: AppConfig): string => {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const encoded = encodeVoucherData(voucher, config);
  const vNum = encodeURIComponent(voucher.voucherNum);
  const id = voucher.id ? encodeURIComponent(voucher.id) : '';

  return `${origin}${pathname}?verify=${vNum}&id=${id}&d=${encoded}`;
};

/**
 * Generates QR Code Data URL (PNG image) using qrcode library.
 */
export const generateQRCodeDataUrl = async (
  text: string, 
  options: { width?: number; margin?: number; color?: { dark: string; light: string } } = {}
): Promise<string> => {
  const { width = 200, margin = 1, color = { dark: '#0f172a', light: '#ffffff' } } = options;
  try {
    return await QRCode.toDataURL(text, {
      width,
      margin,
      color,
      errorCorrectionLevel: 'M'
    });
  } catch (err) {
    console.error('QR Code generation error:', err);
    return '';
  }
};
