
import React, { useState, useMemo, useEffect } from 'react';
import { Voucher, Account, VoucherType, Currency, VoucherStatus } from '../types';
import { getVouchers, getAccounts } from '../services/db';
import { formatDate } from '../utils/format';
import { motion, AnimatePresence } from 'motion/react';

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
  currentLocation: string;
  nextMovement: HajiMovement | null;
  todayActions: HajiMovement[];
  timeline: HajiMovement[];
  alertLevel: 'RED' | 'YELLOW' | 'GREEN';
  isImportant: boolean;
}

const HajiTracking: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHaji, setSelectedHaji] = useState<HajiStatus | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [v, a] = await Promise.all([getVouchers(), getAccounts()]);
      setVouchers(v);
      setAccounts(a);
      setLoading(false);
    };
    fetchData();
  }, []);

  const hajiTrackingData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Extract all movements
    const allMovements: HajiMovement[] = [];

    vouchers
      .filter(v => v.status === VoucherStatus.POSTED)
      .forEach(v => {
      const items = v.details?.items || [v.details]; 
      items.forEach((item: any, idx: number) => {
        const paxName = item?.paxName || v.details?.paxName || v.details?.headName || null;
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
            movement.location = item?.hotelName || v.details?.hotelName || 'Hotel';
            movement.details = `${movement.location} (${item?.roomType || v.details?.roomType || 'Standard'})`;
            movement.actionRequired = "Check-in Arrangement";
            allMovements.push(movement as HajiMovement);
          }
        } else if (v.type === VoucherType.TRANSPORT) {
          const transportDate = item?.date || v.details?.date || v.date;
          movement.date = new Date(transportDate);
          movement.type = VoucherType.TRANSPORT;
          movement.category = 'TRANSPORT';
          const sector = item?.sector || v.details?.sector || item?.route || v.details?.route || 'Transit';
          movement.location = sector;
          movement.details = `${item?.vehicle || v.details?.vehicle || 'Vehicle'}: ${sector}`;
          
          if (sector.toLowerCase().includes('airport')) {
            movement.actionRequired = "Airport Logistics";
          } else {
            movement.actionRequired = "Transport Pickup";
          }
          allMovements.push(movement as HajiMovement);
        } else if (v.type === VoucherType.TICKET) {
          const flightDate = item?.date || v.details?.date || v.date;
          movement.date = new Date(flightDate);
          movement.type = VoucherType.TICKET;
          movement.category = 'FLIGHT';
          movement.location = item?.sector || v.details?.sector || 'Airport';
          movement.details = `Flight ${item?.flightNum || v.details?.flightNum || ''}: ${movement.location}`;
          movement.actionRequired = "Flight Monitoring";
          allMovements.push(movement as HajiMovement);
        }
      });
    });

    // 2. Group by Haji
    const grouped = allMovements.reduce((acc, m) => {
      if (!acc[m.paxName]) acc[m.paxName] = [];
      acc[m.paxName].push(m);
      return acc;
    }, {} as Record<string, HajiMovement[]>);

    // 3. Calculate Status for each Haji
    return Object.keys(grouped).map(paxName => {
      const timeline = grouped[paxName].sort((a, b) => a.date.getTime() - b.date.getTime());
      
      let currentLocation = 'Not Started';
      let todayActions: HajiMovement[] = [];
      let nextMovement: HajiMovement | null = null;
      let alertLevel: 'RED' | 'YELLOW' | 'GREEN' = 'GREEN';

      timeline.forEach(m => {
        const mDate = new Date(m.date);
        mDate.setHours(0,0,0,0);
        
        const mToEnd = m.toDate ? new Date(m.toDate) : mDate;
        mToEnd.setHours(23,59,59,999);

        // Current Location logic
        const isStartDay = today.getTime() === mDate.getTime();
        const isEndDay = m.toDate && today.getTime() === new Date(m.toDate).setHours(0,0,0,0);

        if (today >= mDate && today <= mToEnd) {
          currentLocation = m.location;
          let activeMovement = { ...m };
          if (isEndDay && m.category === 'HOTEL') {
            activeMovement.actionRequired = "Check-out Arrangement";
          } else if (isStartDay && m.category === 'HOTEL') {
            activeMovement.actionRequired = "Check-in Arrangement";
          }
          todayActions.push(activeMovement);
          alertLevel = 'RED'; // Direct assignment is safe here as RED is highest
        }

        // Next Movement logic
        if (mDate > today && !nextMovement) {
          nextMovement = m;
          const diffHours = (mDate.getTime() - today.getTime()) / (1000 * 60 * 60);
          if (diffHours <= 24 && (alertLevel as string) !== 'RED') {
            alertLevel = 'YELLOW';
          }
        }
      });

      // If no active today, check if they are in between movements
      if (currentLocation === 'Not Started' && timeline.length > 0) {
        const lastPassed = [...timeline].reverse().find(m => m.date <= today);
        if (lastPassed) currentLocation = `Last at: ${lastPassed.location}`;
      }

      return {
        paxName,
        currentLocation,
        nextMovement,
        todayActions,
        timeline,
        alertLevel,
        isImportant: (alertLevel as string) === 'RED'
      } as HajiStatus;
    });
  }, [vouchers]);

  const filteredHajis = useMemo(() => {
    return hajiTrackingData.filter(h => 
      h.paxName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.currentLocation.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
      const priority = { 'RED': 0, 'YELLOW': 1, 'GREEN': 2 };
      return priority[a.alertLevel] - priority[b.alertLevel];
    });
  }, [hajiTrackingData, searchQuery]);

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
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Real-time movement & arrangement manager</p>
        </div>
        <div className="w-full md:w-72 relative">
          <input 
            type="text" 
            placeholder="Search Haji or Location..."
            className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-5 py-3 text-sm font-bold shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List */}
        <div className="lg:col-span-2 space-y-4">
          {filteredHajis.map((haji, idx) => (
            <motion.div
              layout
              key={haji.paxName}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => setSelectedHaji(haji)}
              className={`p-5 rounded-3xl border cursor-pointer transition-all hover:shadow-xl group relative overflow-hidden ${
                haji.alertLevel === 'RED' ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30' :
                haji.alertLevel === 'YELLOW' ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' :
                'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
              } ${selectedHaji?.paxName === haji.paxName ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
            >
              {haji.isImportant && (
                <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
                  <div className="bg-rose-500 text-white text-[8px] font-black uppercase tracking-widest py-1 w-[150%] text-center rotate-45 translate-x-[20%] translate-y-[20%] animate-pulse">
                    Urgent
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-inner ${
                    haji.alertLevel === 'RED' ? 'bg-rose-100 text-rose-600' :
                    haji.alertLevel === 'YELLOW' ? 'bg-amber-100 text-amber-600' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    ☪️
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-1 group-hover:text-blue-600 transition-colors">
                      {haji.paxName}
                    </h3>
                    <div className="flex items-center space-x-2">
                       <span className={`w-2 h-2 rounded-full ${
                         haji.alertLevel === 'RED' ? 'bg-rose-500 animate-ping' :
                         haji.alertLevel === 'YELLOW' ? 'bg-amber-500' :
                         'bg-emerald-500'
                       }`}></span>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         {haji.currentLocation}
                       </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:flex md:items-center md:space-x-8">
                  <div className="text-left md:text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      haji.alertLevel === 'RED' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' :
                      haji.alertLevel === 'YELLOW' ? 'bg-amber-500 text-white' :
                      'bg-emerald-500 text-white'
                    }`}>
                      {haji.alertLevel === 'RED' ? 'ACTION REQ' : haji.alertLevel === 'YELLOW' ? 'UPCOMING' : 'IN ORDER'}
                    </span>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Next Move</p>
                    <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate max-w-[120px]">
                      {haji.nextMovement ? haji.nextMovement.location : 'Final Dest'}
                    </p>
                    {haji.nextMovement && (
                       <p className="text-[8px] font-bold text-slate-400 uppercase">
                         {formatDate(haji.nextMovement.date)}
                       </p>
                    )}
                  </div>
                </div>
              </div>

              {haji.todayActions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50 flex flex-wrap gap-2">
                  {haji.todayActions.map((action, i) => (
                    <div key={i} className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-xs">
                        {action.category === 'HOTEL' ? '🏨' : action.category === 'TRANSPORT' ? '🚐' : '✈️'}
                      </span>
                      <p className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tighter">
                        {action.actionRequired}: {action.location}
                      </p>
                    </div>
                  ))}
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
                key={selectedHaji.paxName}
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
                      <div key={i} className="relative pl-10">
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
    </div>
  );
};

export default HajiTracking;
