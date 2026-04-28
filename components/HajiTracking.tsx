
import React, { useState, useMemo, useEffect } from 'react';
import { Voucher, Account, VoucherType, Currency, VoucherStatus } from '../types';
import { getVouchers, getAccounts } from '../services/db';
import { HajiService } from '../services/HajiService';
import { HajiActionService, ActionResolution } from '../services/HajiActionService';
import { formatDate } from '../utils/format';
import { motion, AnimatePresence } from 'motion/react';
import { HajiMaster } from '../types';

interface HajiMovement {
  id: string;
  paxName: string;
  type: VoucherType;
  date: Date;
  toDate?: Date;
  details: string;
  location: string;
  actionRequired: string;
  category: 'HOTEL' | 'TRANSPORT' | 'FLIGHT' | 'VISA';
  rawVoucher: Voucher;
}

interface HajiStatus {
  paxName: string;
  hajiId?: string;
  passportNumber?: string;
  currentStatusText: string;
  currentLocation: string;
  currentCity: 'MAKKAH' | 'MADINA' | 'OTHER' | null;
  isCompleted: boolean;
  nextMovement: HajiMovement | null;
  nextMovementText: string;
  nextMovementDate: string;
  actionRequired: string;
  isResolved?: boolean;
  todayActions: HajiMovement[];
  timeline: HajiMovement[];
  alertLevel: 'RED' | 'YELLOW' | 'GREEN';
  isImportant: boolean;
}

const SummaryCard = ({ label, value, icon, active, onClick, color }: any) => {
  const colors: Record<string, string> = {
    emerald: active ? 'bg-emerald-600 text-white shadow-emerald-500/30' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-emerald-600',
    blue: active ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-blue-600',
    green: active ? 'bg-emerald-600 text-white shadow-emerald-500/30' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-emerald-600',
    indigo: active ? 'bg-indigo-600 text-white shadow-indigo-500/30' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-indigo-600',
    amber: active ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-amber-500',
    rose: active ? 'bg-rose-600 text-white shadow-rose-500/30' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-rose-600',
  };

  return (
    <button 
      onClick={onClick}
      className={`min-w-[120px] p-4 rounded-3xl border transition-all flex flex-col items-center justify-center text-center space-y-2 group shadow-sm active:scale-95 ${colors[color] || colors.emerald}`}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className={`text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${active ? 'text-white/70' : 'text-slate-400'}`}>{label}</p>
        <p className="text-xl font-orbitron font-black leading-none mt-1">{value}</p>
      </div>
    </button>
  );
};

const HajiTracking: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHaji, setSelectedHaji] = useState<HajiStatus | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'MAKKAH' | 'MADINA' | 'JEDDAH_AIRPORT' | 'URGENT' | 'UPCOMING' | 'TRANSPORT_REQ'>('ALL');
  
  // Haji Master State
  const [activeView, setActiveView] = useState<'TRACKING' | 'MASTER'>('TRACKING');
  const [trackingTab, setTrackingTab] = useState<'PENDING' | 'RESOLVED'>('PENDING');
  const [hajiMasterList, setHajiMasterList] = useState<HajiMaster[]>([]);
  const [resolutions, setResolutions] = useState<ActionResolution[]>([]);
  const [showAddHajiModal, setShowAddHajiModal] = useState(false);
  const [editingHaji, setEditingHaji] = useState<HajiMaster | null>(null);
  const [hajiFormData, setHajiFormData] = useState<Omit<HajiMaster, 'id' | 'hajiId' | 'createdAt'>>({
    fullName: '',
    passportNumber: '',
    contactNumber: '',
    nationality: 'Pakistan'
  });
  const [duplicateHaji, setDuplicateHaji] = useState<HajiMaster | null>(null);
  const [selectedHajiHistory, setSelectedHajiHistory] = useState<Voucher[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [v, a, hm, res] = await Promise.all([
        getVouchers(), 
        getAccounts(),
        HajiService.getAll(),
        HajiActionService.getResolutions()
      ]);
      setVouchers(v);
      setAccounts(a);
      setHajiMasterList(hm);
      setResolutions(res);
      setLoading(false);
    };
    fetchData();
  }, []);

  const refreshHajiMaster = async () => {
    const hm = await HajiService.getAll();
    setHajiMasterList(hm);
  };

  const handleSaveHaji = async () => {
    if (!hajiFormData.fullName || !hajiFormData.passportNumber) {
      alert("Please fill required fields (Name & Passport)");
      return;
    }

    try {
      if (editingHaji) {
        await HajiService.update(editingHaji.id, hajiFormData);
      } else {
        if (!duplicateHaji) {
          const existing = await HajiService.searchByPassport(hajiFormData.passportNumber);
          if (existing) {
            setDuplicateHaji(existing);
            return;
          }
        }
        await HajiService.create(hajiFormData);
      }
      
      await refreshHajiMaster();
      setShowAddHajiModal(false);
      setEditingHaji(null);
      setHajiFormData({ fullName: '', passportNumber: '', contactNumber: '', nationality: 'Pakistan' });
      setDuplicateHaji(null);
    } catch (err: any) {
      alert(`Error saving Haji: ${err.message}`);
    }
  };

  const handleEditHaji = (haji: HajiMaster) => {
    setEditingHaji(haji);
    setHajiFormData({
      fullName: haji.fullName,
      passportNumber: haji.passportNumber || '',
      contactNumber: haji.contactNumber || '',
      nationality: haji.nationality || 'Pakistan'
    });
    setShowAddHajiModal(true);
  };

  const handleDeleteHaji = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) return;
    try {
      await HajiService.delete(id);
      await refreshHajiMaster();
    } catch (err: any) {
      alert(`Error deleting Haji: ${err.message}`);
    }
  };

  const handleCloneHaji = (haji: HajiMaster) => {
    setEditingHaji(null);
    setHajiFormData({
      fullName: `${haji.fullName} (Clone)`,
      passportNumber: '',
      contactNumber: haji.contactNumber || '',
      nationality: haji.nationality || 'Pakistan'
    });
    setShowAddHajiModal(true);
  };

  const viewHajiHistory = async (haji: HajiMaster) => {
    try {
      const history = await HajiService.getHistory({ 
        hajiId: haji.hajiId, 
        passportNumber: haji.passportNumber,
        fullName: haji.fullName 
      });
      setSelectedHajiHistory(history as Voucher[]);
      setShowHistoryModal(true);
    } catch (err: any) {
      alert(`Error fetching history: ${err.message}`);
    }
  };

  const handleResolveAction = async (haji: any) => {
    if (!haji.hajiId && !haji.paxName) return;
    
    if (!confirm('Are you sure you want to mark this action as resolved?')) return;
    
    const actionKey = haji.actionRequired.toLowerCase().replace(/\s+/g, '_');
    const movementId = haji.nextMovement?.id || haji.todayActions[0]?.id;
    const voucherId = haji.nextMovement?.rawVoucher?.id || haji.todayActions[0]?.rawVoucher?.id;
    const fullActionKey = `${actionKey}_${movementId || 'today'}`;

    // Optimistic Update
    const tempResolution: ActionResolution = {
      hajiId: haji.hajiId || haji.paxName,
      actionKey: fullActionKey,
      voucherId: voucherId,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'System User'
    };
    
    const previousResolutions = [...resolutions];
    setResolutions([...resolutions, tempResolution]);

    try {
      const newRes = await HajiActionService.resolveAction({
        hajiId: haji.hajiId || haji.paxName,
        actionKey: fullActionKey,
        voucherId: voucherId
      });
      // Replace temp with real one from server
      setResolutions(prev => prev.map(r => 
        (r.hajiId === tempResolution.hajiId && r.actionKey === tempResolution.actionKey) ? newRes : r
      ));
    } catch (err: any) {
      console.error("Failed to save resolution to database:", err);
      // Revert if it was a real error (not just table missing)
      const isSchemaError = (err.code === 'PGRST205' || (err.message && err.message.includes('PGRST205')));
      
      if (!isSchemaError) {
        setResolutions(previousResolutions);
        alert(`Error saving resolution: ${err.message}`);
      } else {
        // If it was just table missing, we keep the optimistic one so the user can continue
        // but it won't persist.
        console.warn("Table missing in schema cache, resolution is active for this session but may not persist.");
      }
    }
  };

  const handleReopenAction = async (haji: any) => {
    if (!haji.hajiId && !haji.paxName) return;

    if (!confirm('Are you sure you want to reopen this action?')) return;

    const actionKey = haji.actionRequired.toLowerCase().replace(/\s+/g, '_');
    const movementId = haji.nextMovement?.id || haji.todayActions[0]?.id;
    const voucherId = haji.nextMovement?.rawVoucher?.id || haji.todayActions[0]?.rawVoucher?.id;
    const fullActionKey = `${actionKey}_${movementId || 'today'}`;

    try {
      await HajiActionService.reopenAction(haji.hajiId || haji.paxName, fullActionKey, voucherId);
      
      // Update local state
      setResolutions(prev => prev.filter(r => 
        !(r.hajiId === (haji.hajiId || haji.paxName) && r.actionKey === fullActionKey)
      ));
    } catch (err: any) {
      alert(`Error reopening action: ${err.message}`);
    }
  };

  const hajiTrackingData = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const nowTime = new Date().getTime();

    // Helper to check if a date is on a specific day
    const isSameDay = (d1: Date, d2: Date) => {
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    };

    // Helper to get end of day
    const getEndOfDay = (d: Date) => {
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      return end;
    };

    // 1. Extract all movements
    const allMovements: HajiMovement[] = [];

    vouchers
      .filter(v => v.status === VoucherStatus.POSTED)
      .forEach(v => {
      const items = v.details?.items || [v.details]; 
      items.forEach((item: any, idx: number) => {
        const globalPaxName = item?.paxName || v.details?.paxName || v.details?.headName || null;
        const paxName = globalPaxName;
        if (!paxName || paxName === 'N/A' || paxName === 'Unknown Pax') return;

        let movement: Partial<HajiMovement> = {
          id: `${v.id}-${idx}`,
          paxName,
          rawVoucher: v,
        };

        if (v.type === VoucherType.HOTEL) {
          const fromDate = item?.fromDate || v.details?.fromDate;
          const toDate = item?.toDate || v.details?.toDate;
          const numNights = Number(item?.numNights || v.details?.numNights || 0);
          
          if (fromDate) {
            movement.date = new Date(fromDate);
            if (toDate) {
              movement.toDate = new Date(toDate);
            } else if (numNights > 0) {
              const end = new Date(movement.date);
              end.setDate(end.getDate() + numNights);
              movement.toDate = end;
            }
            movement.type = VoucherType.HOTEL;
            movement.category = 'HOTEL';
            const city = item?.city || v.details?.city || v.details?.location || '';
            movement.location = `${item?.hotelName || v.details?.hotelName || 'Hotel'}${city ? ' (' + city + ')' : ''}`;
            movement.details = `${item?.hotelName || v.details?.hotelName} (${item?.roomType || v.details?.roomType || 'Standard'})`;
            movement.actionRequired = "Check-in Arrangement";
            allMovements.push(movement as HajiMovement);
          }
        } else if (v.type === VoucherType.TRANSPORT) {
          if (item?.isMultiSector && item?.subSectors?.length > 0) {
            item.subSectors.forEach((sub: any, sIdx: number) => {
              const subMovement = { ...movement };
              subMovement.id = `${v.id}-${idx}-s-${sIdx}`;
              subMovement.date = new Date(sub.date || v.date);
              subMovement.type = VoucherType.TRANSPORT;
              subMovement.category = 'TRANSPORT';
              subMovement.location = sub.route;
              subMovement.details = `${item.vehicle}: ${sub.route}${sub.note ? ' (' + sub.note + ')' : ''}`;
              
              if (sub.route.toLowerCase().includes('airport')) {
                subMovement.actionRequired = "Airport Logistics";
              } else {
                subMovement.actionRequired = "Transport Pickup";
              }
              allMovements.push(subMovement as HajiMovement);
            });
          } else {
            const transportDate = item?.date || v.details?.date || v.date;
            movement.date = new Date(transportDate);
            movement.type = VoucherType.TRANSPORT;
            movement.category = 'TRANSPORT';
            const sector = item?.sector === 'MULTI_SECTOR' ? item?.customLabel : (item?.sector || v.details?.sector || item?.route || v.details?.route || 'Transit');
            movement.location = sector;
            movement.details = `${item?.vehicle || v.details?.vehicle || 'Vehicle'}: ${sector}${item?.note ? ' (' + item.note + ')' : ''}`;
            
            if (sector && sector.toLowerCase().includes('airport')) {
              movement.actionRequired = "Airport Logistics";
            } else {
              movement.actionRequired = "Transport Pickup";
            }
            allMovements.push(movement as HajiMovement);
          }
        } else if (v.type === VoucherType.TICKET) {
          const flightDate = item?.date || v.details?.date || v.date;
          movement.date = new Date(flightDate);
          movement.type = VoucherType.TICKET;
          movement.category = 'FLIGHT';
          movement.location = item?.sector || v.details?.sector || 'Airport';
          movement.details = `Flight ${item?.flightNum || v.details?.flightNum || ''}: ${movement.location}`;
          movement.actionRequired = "Flight Monitoring";
          allMovements.push(movement as HajiMovement);
        } else if (v.type === VoucherType.ALL_IN_ONE || (v.type as string) === 'AV') {
          // 1. Hotel Items
          (v.details?.hotelItems || []).forEach((hItem: any, hIdx: number) => {
             if (hItem.fromDate) {
               const hMovement: Partial<HajiMovement> = {
                  id: `${v.id}-${idx}-h-${hIdx}`,
                  paxName: hItem.paxName || v.details?.paxName || globalPaxName,
                  date: new Date(hItem.fromDate),
                  toDate: hItem.toDate ? new Date(hItem.toDate) : undefined,
                  type: VoucherType.HOTEL,
                  category: 'HOTEL',
                  location: `${hItem.hotelName} (${hItem.city || 'KSA'})`,
                  details: `${hItem.hotelName} (${hItem.roomType || 'Standard'})`,
                  actionRequired: "Check-in Arrangement",
                  rawVoucher: v
               };
               allMovements.push(hMovement as HajiMovement);
             }
          });

          // 2. Transport Items
          (v.details?.transportItems || []).forEach((tItem: any, tIdx: number) => {
             const tDate = tItem.date || v.date;
             const tMovement: Partial<HajiMovement> = {
                id: `${v.id}-${idx}-t-${tIdx}`,
                paxName: tItem.paxName || v.details?.paxName || globalPaxName,
                date: new Date(tDate),
                type: VoucherType.TRANSPORT,
                category: 'TRANSPORT',
                location: tItem.sector === 'CUSTOM' ? tItem.customLabel : tItem.sector,
                details: `${tItem.vehicle}: ${tItem.sector === 'CUSTOM' ? tItem.customLabel : tItem.sector}`,
                actionRequired: "Transport Pickup",
                rawVoucher: v
             };
             allMovements.push(tMovement as HajiMovement);
          });

          // 3. Visa Items (Optional for tracking, but good for context)
          (v.details?.visaItems || []).forEach((vItem: any, vIdx: number) => {
             const vMovement: Partial<HajiMovement> = {
                id: `${v.id}-${idx}-v-${vIdx}`,
                paxName: vItem.paxName || v.details?.paxName || globalPaxName,
                date: new Date(v.date),
                type: VoucherType.VISA,
                category: 'VISA',
                location: 'Visa Processing',
                details: `Passport: ${vItem.passportNumber || v.details?.passportNumber || 'N/A'}`,
                actionRequired: "Visa Status Check",
                rawVoucher: v
             };
             allMovements.push(vMovement as HajiMovement);
          });
        }
      });
    });

    // 2. Group by Haji (Normalize using Master List if possible)
    const grouped = allMovements.reduce((acc, m) => {
      const details = m.rawVoucher.details || {};
      const voucherHajiId = details.hajiId || 
                     (Array.isArray(details.items) ? details.items.find((it: any) => it.paxName === m.paxName)?.hajiId : null) ||
                     (Array.isArray(details.visaItems) ? details.visaItems.find((it: any) => it.paxName === m.paxName)?.hajiId : null);
      
      // Try to find a master record to unify key
      const masterRecord = hajiMasterList.find(h => 
        (voucherHajiId && h.hajiId === voucherHajiId) || 
        h.fullName === m.paxName || 
        (h.passportNumber && details.passportNumber === h.passportNumber)
      );

      const key = masterRecord?.hajiId || voucherHajiId || m.paxName;
      if (!acc[key]) acc[key] = [];
      acc[key].push(m);
      return acc;
    }, {} as Record<string, HajiMovement[]>);

    // 3. Calculate Status for each Group
    return Object.keys(grouped).map(key => {
      const timeline = grouped[key].sort((a, b) => a.date.getTime() - b.date.getTime());
      if (timeline.length === 0) return null;

      // Try to find the real name and Passport from Master if key is hajiId
      const hajiMasterRecord = hajiMasterList.find(h => h.hajiId === key || h.fullName === key);
      const paxName = hajiMasterRecord?.fullName || timeline[0].paxName;
      const passportNumber = hajiMasterRecord?.passportNumber || '';
      const hajiId = hajiMasterRecord?.hajiId || (key.startsWith('H-') ? key : '');

      const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let currentStatusText = 'Waiting for Journey';
        let currentLocation = 'In Transit / Home';
        let currentCity: 'MAKKAH' | 'MADINA' | 'OTHER' | null = null;
        let isCompleted = false;
        let isTravelingToday = false;
        let nextMovementText = 'Final Destination Reached';
        let nextMovementDate = '';
        let actionRequired = 'No immediate action';
        let alertLevel: 'RED' | 'YELLOW' | 'GREEN' = 'GREEN';
        let todayActions: HajiMovement[] = [];

        // Check if journey is completed - only if now is after the full last day
        const lastEvent = timeline[timeline.length - 1];
        const lastEndDate = getEndOfDay(lastEvent.toDate ? new Date(lastEvent.toDate) : new Date(lastEvent.date));
        if (now > lastEndDate) {
          isCompleted = true;
          currentStatusText = 'Journey Completed / Returned';
          currentLocation = 'Home';
        }

        // Find Next Segment
        const nextSegment = timeline.find(m => m.date > now);
        if (nextSegment) {
          nextMovementText = nextSegment.location;
          nextMovementDate = formatDate(nextSegment.date);
        }

        let primaryActionMovement: HajiMovement | null = null;

        // Determine Status and Current Location strictly
        const hotelStay = timeline.find(m => 
          m.category === 'HOTEL' && 
          now >= new Date(m.date) && 
          now <= getEndOfDay(m.toDate ? new Date(m.toDate) : new Date(m.date))
        );

        const transportToday = timeline.find(m => 
          m.category === 'TRANSPORT' && isSameDay(new Date(m.date), today)
        );

        const flightToday = timeline.find(m => 
          m.category === 'FLIGHT' && isSameDay(new Date(m.date), today)
        );

        // 1. Determine Current Location and Status
        if (!isCompleted) {
          if (transportToday) {
            const parts = transportToday.location.split(/→|->|-| to /i).map(p => p.trim());
            const destination = parts[parts.length - 1] || transportToday.location;
            
            currentStatusText = `Traveling to ${destination}`;
            currentLocation = `In Transit (${transportToday.location})`;
            isTravelingToday = true;
            
            // Destination city = Current location on transport date
            const destLower = destination.toLowerCase();
            const voucherLoc = (transportToday.rawVoucher.details?.location || transportToday.rawVoucher.details?.city || '').toLowerCase();
            if (destLower.includes('makkah')) {
              currentCity = 'MAKKAH';
            } else if (destLower.includes('madina') || destLower.includes('madinah')) {
              currentCity = 'MADINA';
            } else {
              currentCity = 'OTHER';
            }
          } else if (flightToday) {
            currentStatusText = `Departure Today (Airport Transfer Required)`;
            currentLocation = `At Airport / Transit`;
            isTravelingToday = true;
            currentCity = 'OTHER';
          } else if (hotelStay) {
            currentLocation = hotelStay.location;
            const hotelStartDate = new Date(hotelStay.date);
            const hotelEndDate = hotelStay.toDate ? new Date(hotelStay.toDate) : hotelStartDate;
            
            if (isSameDay(hotelStartDate, today)) {
              currentStatusText = `Arriving at ${hotelStay.location} Today`;
            } else if (isSameDay(hotelEndDate, today)) {
              currentStatusText = `Checking Out Today from ${hotelStay.location}`;
            } else {
              currentStatusText = `Staying in ${hotelStay.location}`;
            }

            // Set current city
            const loc = (hotelStay.location || '').toLowerCase();
            const voucherLoc = (hotelStay.rawVoucher.details?.location || hotelStay.rawVoucher.details?.city || '').toLowerCase();
            
            if (loc.includes('makkah') || voucherLoc.includes('makkah')) {
              currentCity = 'MAKKAH';
            } else if (loc.includes('madina') || loc.includes('madinah') || voucherLoc.includes('madina') || voucherLoc.includes('madinah')) {
              currentCity = 'MADINA';
            } else {
              currentCity = 'OTHER';
            }
          } else {
            // Check if between transport sectors or after a transport sector
            const pastTransport = timeline.filter(m => m.category === 'TRANSPORT' && new Date(m.date) <= now)
                                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            if (pastTransport.length > 0) {
              const lastSector = pastTransport[0].location;
              const parts = lastSector.split(/→|->|-| to /i).map(p => p.trim());
              const destination = parts[parts.length - 1] || lastSector;
              
              const destLower = destination.toLowerCase();
              const voucherLoc = (pastTransport[0].rawVoucher.details?.location || pastTransport[0].rawVoucher.details?.city || '').toLowerCase();

              currentStatusText = `Staying in ${destination}`;
              currentLocation = destination;
              
              if (destLower.includes('makkah') || voucherLoc.includes('makkah')) {
                currentCity = 'MAKKAH';
              } else if (destLower.includes('madina') || destLower.includes('madinah') || voucherLoc.includes('madina') || voucherLoc.includes('madinah')) {
                currentCity = 'MADINA';
              } else {
                currentCity = 'OTHER';
              }
            } else {
              currentStatusText = 'Waiting for Journey';
              currentLocation = 'In Transit / Home';
            }
                 // 2. Determine Action Required (Priority)
        // Find all actionable movements for this Haji
        const actionableMovements = timeline.filter(m => m.category !== 'VISA' && !isCompleted);
        
        // Find the earliest unresolved action in the past or present
        const unresolvedFromPastOrPresent = actionableMovements
          .filter(m => new Date(m.date) <= getEndOfDay(now))
          .filter(m => !resolutions.some(r => 
            r.hajiId === (hajiId || paxName) && 
            r.voucherId === m.rawVoucher.id && 
            r.actionKey.includes(m.actionRequired.toLowerCase().replace(/\s+/g, '_'))
          ))
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        primaryActionMovement = unresolvedFromPastOrPresent[0];

        if (primaryActionMovement) {
          actionRequired = primaryActionMovement.actionRequired;
          const mDate = new Date(primaryActionMovement.date);
          if (mDate < today) {
            alertLevel = 'RED';
            actionRequired = `[LATE] ${actionRequired}`;
          } else if (isSameDay(mDate, today)) {
            alertLevel = 'RED';
          } else {
             alertLevel = 'YELLOW';
          }
        } else if (nextSegment) {
          // If no past/present unresolved, check if next segment is tomorrow for YELLOW alert
          const nDate = new Date(nextSegment.date).setHours(0,0,0,0);
          if (nDate === tomorrow.getTime()) {
            if (nextSegment.category === 'TRANSPORT') {
              actionRequired = "Remind transport provider";
              alertLevel = 'YELLOW';
            } else if (nextSegment.category === 'FLIGHT') {
              actionRequired = "Confirm airport transfer";
              alertLevel = 'YELLOW';
            } else if (nextSegment.category === 'HOTEL') {
              actionRequired = "Confirm hotel booking";
              alertLevel = 'YELLOW';
            }
          }
        }
      }
    }

      // Collect Today's Actions for the badge
      todayActions = [];
      timeline.forEach(m => {
        const mDate = new Date(m.date).setHours(0,0,0,0);
        const mEndDate = m.toDate ? new Date(m.toDate).setHours(0,0,0,0) : mDate;
        
        if (mDate === today.getTime() || mEndDate === today.getTime()) {
          todayActions.push(m);
        }
      });

    // Find the resolution details if resolved
    const currentActionKey = actionRequired.toLowerCase().replace(/\s+/g, '_');
    const movementIdForRes = primaryActionMovement?.id || nextSegment?.id || todayActions[0]?.id;
    const voucherIdForRes = primaryActionMovement?.rawVoucher?.id || nextSegment?.rawVoucher?.id || todayActions[0]?.rawVoucher?.id;
    const fullActionKey = `${currentActionKey}_${movementIdForRes || 'today'}`;
    
    const resolution = resolutions.find(r => 
      r.hajiId === (hajiId || paxName) && 
      r.actionKey === fullActionKey && 
      (!voucherIdForRes || r.voucherId === voucherIdForRes)
    );

    return {
      paxName,
      hajiId,
      passportNumber,
      currentStatusText,
      currentLocation,
      currentCity,
      isCompleted,
      nextMovement: nextSegment || null,
      nextMovementText,
      nextMovementDate,
      actionRequired,
      isResolved: !!resolution,
      resolution, // Pass full resolution info
      todayActions,
      timeline,
      alertLevel,
      isImportant: alertLevel === 'RED'
    } as HajiStatus;
  }).filter(h => h !== null) as HajiStatus[];
}, [vouchers, resolutions, hajiMasterList]);

  const stats = useMemo(() => {
    const s = {
      total: hajiTrackingData.length,
      makkah: 0,
      madina: 0,
      jeddahAirport: 0,
      urgentActions: 0,
      upcomingMovements: 0,
      transportReq: 0
    };

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    hajiTrackingData.forEach(h => {
      // If completed or resolved, don't show in active city counts unless explicitly filtered
      if (h.isCompleted) return;
      if (h.isResolved && trackingTab === 'PENDING') {
        // Still count for stats? User said "removed from active list". 
        // Let's exclude from stats if resolved to reflect "tasks remaining"
      } else {
        if (h.currentCity === 'MAKKAH') s.makkah++;
        else if (h.currentCity === 'MADINA') s.madina++;
        
        const loc = h.currentStatusText.toLowerCase();
        if (loc.includes('jeddah') || loc.includes('airport')) s.jeddahAirport++;

        // Actionable counts
        if (h.alertLevel === 'RED') s.urgentActions++;
      }
      
      // Upcoming movements count (any movement in the future)
      if (h.nextMovement) {
        s.upcomingMovements++;
      }

      h.todayActions.forEach((action: any) => {
        if (action.category === 'TRANSPORT') {
          s.transportReq++;
        }
      });
    });

    return s;
  }, [hajiTrackingData]);

  const filteredHajis = useMemo(() => {
    let data = hajiTrackingData.filter(h => 
      h.paxName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.currentStatusText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.nextMovementText.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Filter based on Tab selection
    if (trackingTab === 'PENDING') {
      data = data.filter(h => !h.isResolved || h.isCompleted);
    } else {
      data = data.filter(h => h.isResolved && !h.isCompleted);
    }

    if (filterType !== 'ALL') {
      data = data.filter(h => {
        switch (filterType) {
          case 'MAKKAH': return h.currentCity === 'MAKKAH' && !h.isCompleted;
          case 'MADINA': return h.currentCity === 'MADINA' && !h.isCompleted;
          case 'JEDDAH_AIRPORT': return h.currentStatusText.toLowerCase().includes('airport') || h.currentStatusText.toLowerCase().includes('jeddah');
          case 'URGENT': return h.alertLevel === 'RED' && !h.isCompleted;
          case 'UPCOMING': {
            const now = new Date();
            return h.nextMovement && new Date(h.nextMovement.date) > now && !h.isCompleted;
          }
          case 'TRANSPORT_REQ': return h.todayActions.some((a: any) => a.category === 'TRANSPORT') && !h.isCompleted;
          default: return true;
        }
      });
    }

    return data.sort((a, b) => {
      const priority = { 'RED': 0, 'YELLOW': 1, 'GREEN': 2 };
      return priority[a.alertLevel] - priority[b.alertLevel];
    });
  }, [hajiTrackingData, searchQuery, filterType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Haji Tracking System</h1>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mt-2 border border-slate-200 dark:border-slate-700">
            <button 
              onClick={() => setActiveView('TRACKING')}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'TRACKING' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Movement Tracking
            </button>
            <button 
              onClick={() => setActiveView('MASTER')}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'MASTER' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Haji Master Database
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="flex-1 md:w-72 relative">
            <input 
              type="text" 
              placeholder={activeView === 'TRACKING' ? "Search Active Haji..." : "Search Master Database..."}
              className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-5 py-3 text-sm font-bold shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>
          {activeView === 'MASTER' && (
            <button 
              onClick={() => setShowAddHajiModal(true)}
              className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg hover:rotate-90 transition-transform active:scale-90"
            >
              ➕
            </button>
          )}
        </div>
      </div>
      
      {activeView === 'TRACKING' ? (
        <>

      {/* Summary Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 no-scrollbar overflow-x-auto pb-2">
        <SummaryCard 
          label="Total Hajjis" 
          value={stats.total} 
          icon="👥" 
          active={filterType === 'ALL'}
          onClick={() => setFilterType('ALL')}
          color="emerald"
        />
        <SummaryCard 
          label="In Makkah" 
          value={stats.makkah} 
          icon="🕋" 
          active={filterType === 'MAKKAH'}
          onClick={() => setFilterType('MAKKAH')}
          color="blue"
        />
        <SummaryCard 
          label="In Madina" 
          value={stats.madina} 
          icon="🕌" 
          active={filterType === 'MADINA'}
          onClick={() => setFilterType('MADINA')}
          color="green"
        />
        <SummaryCard 
          label="Airport/JED" 
          value={stats.jeddahAirport} 
          icon="✈️" 
          active={filterType === 'JEDDAH_AIRPORT'}
          onClick={() => setFilterType('JEDDAH_AIRPORT')}
          color="indigo"
        />
        <SummaryCard 
          label="Urgent (Today)" 
          value={stats.urgentActions} 
          icon="🔴" 
          active={filterType === 'URGENT'}
          onClick={() => setFilterType('URGENT')}
          color="rose"
        />
        <SummaryCard 
          label="Upcoming" 
          value={stats.upcomingMovements} 
          icon="🟡" 
          active={filterType === 'UPCOMING'}
          onClick={() => setFilterType('UPCOMING')}
          color="amber"
        />
        <SummaryCard 
          label="Transport Req" 
          value={stats.transportReq} 
          icon="🚐" 
          active={filterType === 'TRANSPORT_REQ'}
          onClick={() => setFilterType('TRANSPORT_REQ')}
          color="rose"
        />
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Showing: <span className="text-blue-600">{filterType === 'ALL' ? 'All Hajjis' : filterType.replace('_', ' ')}</span> ({filteredHajis.length})
        </p>
        {filterType !== 'ALL' && (
          <button onClick={() => setFilterType('ALL')} className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center space-x-1">
            <span>↺</span>
            <span>Clear Filter</span>
          </button>
        )}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => setTrackingTab('PENDING')}
            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${trackingTab === 'PENDING' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Pending Actions
          </button>
          <button 
            onClick={() => setTrackingTab('RESOLVED')}
            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${trackingTab === 'RESOLVED' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Resolved Issues
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List */}
        <div className="lg:col-span-2 space-y-4">
          {filteredHajis.map((haji, idx) => (
            <motion.div
              layout
              key={haji.hajiId || haji.paxName}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => setSelectedHaji(haji)}
              className={`p-6 rounded-[2rem] border cursor-pointer transition-all hover:shadow-xl group relative overflow-hidden ${
                haji.alertLevel === 'RED' ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/40' :
                haji.alertLevel === 'YELLOW' ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/40' :
                'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
              } ${(selectedHaji?.hajiId || selectedHaji?.paxName) === (haji.hajiId || haji.paxName) ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
            >
              {haji.isImportant && !haji.isCompleted && (
                <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
                  <div className="bg-rose-600 text-white text-[8px] font-black uppercase tracking-widest py-1.5 w-[150%] text-center rotate-45 translate-x-[20%] translate-y-[20%] shadow-lg">
                    Urgent
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center space-x-5">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-inner shrink-0 ${
                    haji.isCompleted ? 'bg-slate-100 text-slate-400' :
                    haji.alertLevel === 'RED' ? 'bg-rose-100/80 text-rose-600' :
                    haji.alertLevel === 'YELLOW' ? 'bg-amber-100/80 text-amber-600' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {haji.isCompleted ? '🏁' : '👤'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-2 group-hover:text-blue-600 transition-colors truncate">
                      {haji.paxName}
                      {haji.hajiId && <span className="ml-2 text-[10px] font-orbitron text-blue-500 opacity-60">[{haji.hajiId}]</span>}
                    </h3>
                    <div className="flex items-center space-x-2 mb-1">
                       <span className={`w-2 h-2 rounded-full ${
                         haji.isCompleted ? 'bg-slate-300' :
                         haji.isResolved ? 'bg-emerald-500' :
                         haji.alertLevel === 'RED' ? 'bg-rose-500 animate-pulse ring-2 ring-rose-500/50' :
                         haji.alertLevel === 'YELLOW' ? 'bg-amber-500' :
                         'bg-emerald-500'
                       }`}></span>
                       <p className={`text-[11px] font-black uppercase tracking-widest ${
                         haji.isCompleted ? 'text-slate-400' :
                         haji.alertLevel === 'RED' ? 'text-rose-600 dark:text-rose-400' : 
                         haji.alertLevel === 'YELLOW' ? 'text-amber-600 dark:text-amber-400' : 
                         'text-slate-500 dark:text-slate-400'
                       }`}>
                         {haji.currentStatusText}
                       </p>
                    </div>
                    {!haji.isCompleted && (
                      <div className="flex items-center space-x-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Location:</span>
                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase truncate">
                          {haji.currentLocation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:gap-12 md:flex md:items-center md:justify-end flex-1">
                  <div className="text-left md:text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Action Status</p>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase inline-block ${
                        haji.isCompleted ? 'bg-slate-400 text-white' :
                        haji.isResolved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        haji.alertLevel === 'RED' ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20' :
                        haji.alertLevel === 'YELLOW' ? 'bg-amber-500 text-white' :
                        'bg-emerald-500 text-white'
                      }`}>
                        {haji.isCompleted ? 'Finished' : haji.isResolved ? 'Resolved' : haji.alertLevel === 'RED' ? 'Immediate Action' : haji.alertLevel === 'YELLOW' ? 'Prepare Next' : 'Plan Ahead'}
                      </span>
                      {!haji.isResolved && !haji.isCompleted && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolveAction(haji);
                          }}
                          className="p-1 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[8px] font-black uppercase text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors shadow-sm"
                        >
                          Resolve
                        </button>
                      )}
                      {haji.isResolved && !haji.isCompleted && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReopenAction(haji);
                          }}
                          className="p-1 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[8px] font-black uppercase text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors shadow-sm"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Next Movement</p>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase truncate">
                      {haji.nextMovementText}
                    </p>
                    {haji.nextMovementDate && (
                       <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                         {haji.nextMovementDate}
                       </p>
                    )}
                  </div>
                </div>
              </div>

              {haji.actionRequired !== 'No immediate action' && !haji.isCompleted && (
                <div className={`mt-6 p-4 rounded-2xl border flex items-center justify-between ${
                  haji.isResolved 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                    : haji.alertLevel === 'RED' 
                      ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-500/20' 
                      : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg ${
                      haji.isResolved ? 'bg-emerald-100 dark:bg-emerald-900/40' :
                      haji.alertLevel === 'RED' ? 'bg-white/20' : 'bg-amber-100 dark:bg-amber-900/40'
                    }`}>
                      {haji.isResolved ? '✅' : '⚠️'}
                    </div>
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-widest leading-none mb-1 ${
                        haji.isResolved ? 'text-emerald-600' :
                        haji.alertLevel === 'RED' ? 'text-white/70' : 'text-slate-500'
                      }`}>
                        {haji.isResolved ? `Resolved on ${formatDate(new Date((haji as any).resolution.resolvedAt))}` : 'Required Action'}
                      </p>
                      <p className="text-[11px] font-black uppercase tracking-tight">
                        {haji.actionRequired}
                      </p>
                    </div>
                  </div>
                  {haji.isResolved ? (
                     <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReopenAction(haji);
                      }}
                      className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all"
                    >
                      Resend / Reopen
                    </button>
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolveAction(haji);
                      }}
                      className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        haji.alertLevel === 'RED' ? 'bg-white text-rose-600 hover:bg-rose-50' : 'bg-amber-600 text-white hover:bg-amber-700'
                      }`}
                    >
                      Resolve
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Details / Timeline */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {selectedHaji ? (
              <motion.div
                key={selectedHaji.hajiId || selectedHaji.paxName}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl p-6 sticky top-8"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center text-white text-3xl shadow-xl shadow-blue-500/20 font-black">
                    {selectedHaji.paxName.charAt(0)}
                  </div>
                  <button 
                    onClick={() => setSelectedHaji(null)}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-1 leading-none">
                  {selectedHaji.paxName}
                </h2>
                <div className="flex items-center space-x-2 mb-8">
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase rounded-lg">VERIFIED HAJI</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest italic flex-1">Journey Timeline</span>
                </div>

                <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                  {selectedHaji.timeline.map((m, i) => {
                    const isPassed = new Date(m.date) < new Date();
                    return (
                      <div key={m.id} className="relative pl-10">
                        <div className={`absolute left-0 top-0 w-8 h-8 rounded-xl border-4 border-white dark:border-slate-900 flex items-center justify-center z-10 ${
                          isPassed ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                          <span className="text-[10px]">{isPassed ? '✓' : i + 1}</span>
                        </div>
                        <div className={`p-4 rounded-2xl border ${
                          isPassed ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 opacity-60' : 'bg-white dark:bg-slate-900 border-blue-100 dark:border-blue-900/30 shadow-sm'
                        }`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{m.category}</span>
                            <span className="text-[9px] font-black text-blue-600 dark:text-blue-400">{formatDate(m.date)}</span>
                          </div>
                          <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase leading-tight mb-1">{m.location}</p>
                          <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">{m.details}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
                  <div className="text-4xl mb-4 grayscale opacity-50">📋</div>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Select a Haji</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">To view full journey timeline and required actions</p>
                </div>
            )}
          </AnimatePresence>
        </div>
      </div>
        </>
      ) : (
        /* HAJI MASTER VIEW - TABLE FORMAT */
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-8">Haji Details</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Passport</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nationality</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {hajiMasterList
                  .filter(h => 
                    h.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (h.passportNumber && h.passportNumber.includes(searchQuery.toUpperCase())) || 
                    h.hajiId.includes(searchQuery.toUpperCase())
                  )
                  .map((haji, idx) => (
                  <motion.tr
                    layout
                    key={haji.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.01 }}
                    className="hover:bg-slate-50/30 dark:hover:bg-slate-800/20 transition-colors group"
                  >
                    <td className="p-5 pl-8">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-black group-hover:bg-blue-600 group-hover:text-white transition-all">
                          {haji.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none mb-1">
                            {haji.fullName}
                          </div>
                          <div className="text-[9px] font-orbitron font-black text-blue-500 opacity-60">
                            ID: {haji.hajiId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className="text-[10px] font-orbitron font-black text-slate-600 dark:text-slate-400 tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                        {haji.passportNumber || 'N/A'}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        {haji.nationality || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                      {haji.contactNumber || '—'}
                    </td>
                    <td className="p-5 text-right pr-8">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => viewHajiHistory(haji)}
                          title="View History"
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white transition-all active:scale-90"
                        >
                          📜
                        </button>
                        <button 
                          onClick={() => handleCloneHaji(haji)}
                          title="Clone Record"
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-amber-500 hover:text-white transition-all active:scale-90"
                        >
                          👯
                        </button>
                        <button 
                          onClick={() => handleEditHaji(haji)}
                          title="Edit Record"
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-blue-600 hover:text-white transition-all active:scale-90"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteHaji(haji.id)}
                          title="Delete Record"
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-rose-600 hover:text-white transition-all active:scale-90"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {hajiMasterList.length === 0 && (
             <div className="py-32 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Haji Master Database is empty</p>
             </div>
          )}
        </div>
      )}

      {/* Add Haji Modal */}
      {showAddHajiModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  {editingHaji ? 'Update Haji Record' : 'Register New Haji'}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {editingHaji ? `Editing: ${editingHaji.hajiId}` : 'Adding to unique master database'}
                </p>
              </div>
              <button 
                onClick={() => { setShowAddHajiModal(false); setEditingHaji(null); setDuplicateHaji(null); setHajiFormData({ fullName: '', passportNumber: '', contactNumber: '', nationality: 'Pakistan' }); }}
                className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-8 space-y-6">
              {duplicateHaji ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-3xl border-2 border-amber-500/30 space-y-4 animate-in zoom-in-95">
                   <div className="flex items-center space-x-3 text-amber-600">
                     <span className="text-2xl">⚠️</span>
                     <h4 className="text-sm font-black uppercase tracking-widest">Duplicate Detected</h4>
                   </div>
                   <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                     A Haji with passport <span className="font-orbitron font-black">{duplicateHaji.passportNumber}</span> already exists in the database as:
                   </p>
                   <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40">
                      <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{duplicateHaji.fullName}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {duplicateHaji.hajiId}</p>
                   </div>
                   <div className="flex flex-col space-y-2 pt-2">
                     <button 
                       onClick={() => { setShowAddHajiModal(false); setDuplicateHaji(null); }}
                       className="w-full py-3 bg-amber-600 text-white font-black rounded-xl text-[9px] uppercase tracking-widest shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                     >
                       Use Existing Record
                     </button>
                     <button 
                       onClick={() => setDuplicateHaji(null)}
                       className="w-full py-3 bg-white dark:bg-slate-800 text-slate-400 font-bold rounded-xl text-[9px] uppercase tracking-widest border border-slate-200 dark:border-slate-700"
                     >
                       Correction / Change Passport
                     </button>
                   </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-4">Full Legal Name</label>
                      <input 
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none uppercase"
                        placeholder="John Doe"
                        value={hajiFormData.fullName}
                        onChange={e => setHajiFormData({...hajiFormData, fullName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-4">Passport Number</label>
                      <input 
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-orbitron font-black shadow-inner outline-none text-blue-600 tracking-widest"
                        placeholder="AB123456"
                        value={hajiFormData.passportNumber}
                        onChange={e => setHajiFormData({...hajiFormData, passportNumber: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-4">Nationality</label>
                      <input 
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none"
                        placeholder="Pakistan"
                        value={hajiFormData.nationality}
                        onChange={e => setHajiFormData({...hajiFormData, nationality: e.target.value})}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-4">Contact Number (Optional)</label>
                      <input 
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none"
                        placeholder="0300-1234567"
                        value={hajiFormData.contactNumber}
                        onChange={e => setHajiFormData({...hajiFormData, contactNumber: e.target.value})}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveHaji}
                    className="w-full py-5 bg-blue-600 text-white font-black rounded-3xl shadow-xl shadow-blue-600/20 uppercase tracking-widest text-xs transition-all active:scale-95"
                  >
                    {editingHaji ? 'Update Master Record' : 'Register in Master Database'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col"
          >
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Full Service history</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tracking across all booking vouchers</p>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                ✕
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto no-scrollbar space-y-4">
              {selectedHajiHistory.map((v, i) => (
                <div key={v.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                   <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-[10px]">
                        {v.type}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-tight">{v.voucherNum}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">{formatDate(v.date)}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase truncate max-w-[200px]">
                        {v.description || 'Service Booking'}
                      </p>
                   </div>
                </div>
              ))}
              {selectedHajiHistory.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">No history found for this Haji</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default HajiTracking;
