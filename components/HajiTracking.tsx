
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
  currentStatusText: string;
  currentLocation: string;
  currentCity: 'MAKKAH' | 'MADINA' | 'OTHER' | null;
  isCompleted: boolean;
  nextMovement: HajiMovement | null;
  nextMovementText: string;
  nextMovementDate: string;
  actionRequired: string;
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
            const city = v.details?.location || '';
            movement.location = `${item?.hotelName || v.details?.hotelName || 'Hotel'}${city ? ' (' + city + ')' : ''}`;
            movement.details = `${item?.hotelName || v.details?.hotelName} (${item?.roomType || v.details?.roomType || 'Standard'})`;
            movement.actionRequired = "Check-in Arrangement";
            allMovements.push(movement as HajiMovement);
          }
        } else if (v.type === VoucherType.TRANSPORT) {
          if (item?.isMultiSector && item?.subSectors?.length > 0) {
            item.subSectors.forEach((sub: any) => {
              const subMovement = { ...movement };
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
        
        // Guard against empty timeline to prevent entire processing from crashing
        if (timeline.length === 0) return null;

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

        // Check if journey is completed
        const lastEvent = timeline[timeline.length - 1];
        const lastEndDate = lastEvent.toDate ? new Date(lastEvent.toDate) : new Date(lastEvent.date);
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

        // Determine Status and Current Location strictly
        // We look for what is happening RIGHT NOW
        
        const hotelStay = timeline.find(m => 
          m.category === 'HOTEL' && 
          now >= new Date(m.date) && 
          now <= (m.toDate ? new Date(m.toDate) : new Date(m.date))
        );

        const transportToday = timeline.find(m => 
          m.category === 'TRANSPORT' && 
          new Date(m.date).setHours(0,0,0,0) === today.getTime()
        );

        const flightToday = timeline.find(m => 
          m.category === 'FLIGHT' && 
          new Date(m.date).setHours(0,0,0,0) === today.getTime()
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
            const voucherLoc = (transportToday.rawVoucher.details?.location || '').toLowerCase();
            if (destLower.includes('makkah') || voucherLoc.includes('makkah')) {
              currentCity = 'MAKKAH';
            } else if (destLower.includes('madina') || destLower.includes('madinah') || voucherLoc.includes('madina') || voucherLoc.includes('madinah')) {
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
            const checkInDate = new Date(hotelStay.date).setHours(0,0,0,0);
            const checkOutDate = hotelStay.toDate ? new Date(hotelStay.toDate).setHours(0,0,0,0) : checkInDate;
            
            if (checkInDate === today.getTime()) {
              currentStatusText = `Arriving at ${hotelStay.location} Today`;
            } else if (checkOutDate === today.getTime()) {
              currentStatusText = `Checking Out Today from ${hotelStay.location}`;
            } else {
              currentStatusText = `Staying in ${hotelStay.location}`;
            }

            // Set current city
            const loc = (hotelStay.location || '').toLowerCase();
            const voucherLoc = (hotelStay.rawVoucher.details?.location || '').toLowerCase();
            
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
              // Robust split: handles →, ->, -, and " to "
              const parts = lastSector.split(/→|->|-| to /i).map(p => p.trim());
              const destination = parts[parts.length - 1] || lastSector;
              
              const destLower = destination.toLowerCase();
              const voucherLoc = (pastTransport[0].rawVoucher.details?.location || '').toLowerCase();

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
          }

          // 2. Determine Action Required (Priority)
          // Check Today's Events first
          if (transportToday) {
            actionRequired = "Ensure vehicle is ready";
            alertLevel = 'RED';
          } else if (flightToday) {
            actionRequired = "Send passenger to airport";
            alertLevel = 'RED';
          } else if (hotelStay) {
            const checkInDate = new Date(hotelStay.date).setHours(0,0,0,0);
            const checkOutDate = hotelStay.toDate ? new Date(hotelStay.toDate).setHours(0,0,0,0) : checkInDate;
            
            if (checkInDate === today.getTime()) {
              actionRequired = "Inform hotel for arrival";
              alertLevel = 'RED';
            } else if (checkOutDate === today.getTime()) {
              actionRequired = "Arrange transport at hotel";
              alertLevel = 'RED';
            }
          }

          // If no RED action today, check YELLOW actions for tomorrow
          if (alertLevel !== 'RED' && nextSegment) {
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

        // Collect Today's Actions for the badge
        timeline.forEach(m => {
          const mDate = new Date(m.date).setHours(0,0,0,0);
          const mEndDate = m.toDate ? new Date(m.toDate).setHours(0,0,0,0) : mDate;
          
          if (mDate === today.getTime() || mEndDate === today.getTime()) {
            todayActions.push(m);
          }
        });

        return {
          paxName,
          currentStatusText,
          currentLocation,
          currentCity,
          isCompleted,
          nextMovement: nextSegment,
          nextMovementText,
          nextMovementDate,
          actionRequired,
          todayActions,
          timeline,
          alertLevel,
          isImportant: alertLevel === 'RED'
        };
      }).filter((h): h is HajiStatus => h !== null);
  }, [vouchers]);

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
      // If completed, don't show in active city counts
      if (h.isCompleted) return;

      // Real-time City presence (Handles hotel stay and between transport gaps)
      if (h.currentCity === 'MAKKAH') s.makkah++;
      else if (h.currentCity === 'MADINA') s.madina++;
      
      const loc = h.currentStatusText.toLowerCase();
      if (loc.includes('jeddah') || loc.includes('airport')) s.jeddahAirport++;

      // Actionable counts
      if (h.alertLevel === 'RED') s.urgentActions++;
      
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
              className={`p-6 rounded-[2rem] border cursor-pointer transition-all hover:shadow-xl group relative overflow-hidden ${
                haji.alertLevel === 'RED' ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/40' :
                haji.alertLevel === 'YELLOW' ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/40' :
                'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
              } ${selectedHaji?.paxName === haji.paxName ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
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
                    </h3>
                    <div className="flex items-center space-x-2 mb-1">
                       <span className={`w-2 h-2 rounded-full ${
                         haji.isCompleted ? 'bg-slate-300' :
                         haji.alertLevel === 'RED' ? 'bg-rose-500 animate-pulse' :
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
                    <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase inline-block ${
                      haji.isCompleted ? 'bg-slate-400 text-white' :
                      haji.alertLevel === 'RED' ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20' :
                      haji.alertLevel === 'YELLOW' ? 'bg-amber-500 text-white' :
                      'bg-emerald-500 text-white'
                    }`}>
                      {haji.isCompleted ? 'Finished' : haji.alertLevel === 'RED' ? 'Immediate Action' : haji.alertLevel === 'YELLOW' ? 'Prepare Next' : 'Plan Ahead'}
                    </span>
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
                  haji.alertLevel === 'RED' 
                    ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-500/20' 
                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg ${
                      haji.alertLevel === 'RED' ? 'bg-white/20' : 'bg-amber-100 dark:bg-amber-900/40'
                    }`}>
                      ⚠️
                    </div>
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-widest leading-none mb-1 ${
                        haji.alertLevel === 'RED' ? 'text-white/70' : 'text-slate-500'
                      }`}>
                        Required Action
                      </p>
                      <p className="text-[11px] font-black uppercase tracking-tight">
                        {haji.actionRequired}
                      </p>
                    </div>
                  </div>
                  <button className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                    haji.alertLevel === 'RED' ? 'bg-white text-rose-600 hover:bg-rose-50' : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}>
                    Resolve
                  </button>
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
