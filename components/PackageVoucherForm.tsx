import React, { useState, useMemo, useEffect } from "react";
import {
  VoucherType,
  Currency,
  AccountType,
  Voucher,
  VoucherStatus,
  Account,
  AppConfig,
  HajiMaster,
} from "../types";
import { getAccounts, getConfig } from "../services/db";
import DateInput from "./DateInput";
import HajiSelector from "./HajiSelector";
import { AccountingService } from "../services/AccountingService";
import { HajiService } from "../services/HajiService";

interface PackageVoucherFormProps {
  initialData?: Partial<Voucher>;
  onSave: (data: any) => void;
  onCancel: () => void;
  isClone?: boolean;
}

const ROOM_TYPES = [
  "Single",
  "Double",
  "Triple",
  "Quad",
  "Quint",
  "Executive Suite",
  "Suite",
  "DBL C.V",
];
const MEALS = ["Breakfast", "Lunch", "Dinner", "Room Only", "BB"];
const VEHICLES = [
  "Car",
  "H1",
  "Staria",
  "GMC",
  "Coaster",
  "Bus",
  "SUV",
  "Pickup",
  "Other",
];
const SECTOR_SUGGESTIONS = [
  "Makkah → Jeddah",
  "Makkah → Madinah",
  "Madinah → Makkah",
  "Madinah → Jeddah",
  "Madinah Hotel → Madinah Airport",
  "Jeddah Airport → Makkah Hotel",
  "Ziyarat Makkah",
  "Ziyarat Madinah",
  "Ziyaraat e Taif",
];

const MAKKAH_HOTELS = [
  "Anwar Deafah",
  "Nada Deafah",
  "Mira Ajyaad",
  "Sunood Ajyaad",
  "Barka Mawadda",
  "Grand Massa (Shohda Side)",
  "Rihab Taqwa (Hijra)",
  "Waha Deafah",
  "Mather Jawar (Hijra)",
  "Dar Al Khalil (Misfala)",
  "Awtad Makkah",
  "Fajar Badee 5 (Misfala)",
  "Tara Ajyad (Bir Barila)",
  "Jaad Ajyad",
  "Burj Deafah",
  "Sharooq Al Misq",
  "Keyan Al Dana",
  "Asfaar Al Hijjaz 1",
  "Asfaar Al Hijjaz 2",
  "Asfaar Al Hijjaz 3",
  "Johra Mayassar",
  "Dorrat Al Khayr",
  "Makkah Clock Tower",
  "Pullman Zamzam Makkah",
  "Swissotel Makkah",
  "Swissotel Al Maqam",
  "Raffles Makkah Palace",
  "Movenpick Hajar Tower",
  "Al Safwah Tower",
  "Dorrar Aleiman",
  "Elaf Kinda",
  "Makkah Tower",
  "Intercontinental Dar Al Tawhid",
  "Jumeirah Jabal Omar",
  "Address Jabal Omar",
  "DoubleTree by Hilton",
  "Anjum Makkah",
  "Sheraton Jabal Al Kaaba",
  "Le Meridien Makkah",
  "Kunuz Ajyad",
  "Azka Al Safa",
  "Makarem Ajyad",
  "Elaf Ajyad",
  "Emaar Andalusia",
  "Areej Al Wafa",
  "Nawarat Shams 3",
  "Emaar Khalil",
  "Emaar Grand",
  "Al Massa Badar",
  "Yasmeen Al Majd",
  "Le Meridien Towers",
  "Saja Makkah",
  "Voco Makkah",
  "Holiday Inn",
  "Kiswah Tower",
  "Hidaya Tower",
];

const MADINAH_HOTELS = [
  "Rose Holiday",
  "Masa Bustan",
  "Gulnar Taiba",
  "Diyar Taiba",
  "Diyar Al Habib",
  "Karam Al Hajjaz",
  "Karam Al Khair",
  "Erjwan Sada",
  "Sebal Plus",
  "Al Zahra",
  "Raiz Al Zahra",
  "Al Madina Star",
  "Guest Time",
  "Mona Salam",
  "Karam Sada",
  "Burj Mawadda",
  "Riyaz Al Madina",
  "Rua Al Khair",
  "Jood Al Marjan 1",
  "Jood Al Marjan 2",
  "Jood Al Marjan 3",
  "Marina Golden",
  "Hilton Madina",
  "Al Haram Madina",
  "Anwar Al Madina",
  "Shaza Regency",
  "Al Aqeeq",
  "Pullman Zamzam Madina",
  "Al Ansar Golden Tulip",
  "Valley Madina",
  "Saja Al Madina",
  "Dallah Taibah",
  "Rua Al Hijra",
  "Province Al Sham",
  "Grand Plaza Badar Al Maqam",
  "Ritz Al Madina",
  "Al Muna Kareem",
  "Golden Tulip Zahabi",
  "Mokhtara International",
  "Andalus Golden",
  "Dar Al Naeem",
  "Zowar International",
  "Sonabel Al Madina",
  "Arkan Al Manar",
  "Qasar Al Ansar Golden Tulip",
  "Golden Tulip Shufra",
  "Anwar Al Madinah Movenpick",
  "Concorde Dar Al Khair",
  "Emaar Elite Madinah",
  "Dar Al Iman InterContinental",
  "Frontel Al Harithia",
  "Taiba Front & Suites",
  "Maden Madinah",
  "Madinah Hilton",
  "Sofitel Shad Al Madinah",
  "Grand Plaza Madinah",
  "Dar Al Eiman Al Haram",
  "Oberoi",
  "Safwat Al Madinah",
  "Ruve Al Madinah",
  "Artal International",
  "Odst Al Madinah",
  "Waqf Outhman",
  "Verta Al Madinah",
  "Jawhrat Al Rasheed",
  "Plaza Inn Ohud",
  "Valy Madinah",
  "Sky View",
];

interface HotelStay {
  id: string;
  city: "Makkah" | "Madinah";
  hotelName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomType: string;
  numRooms: number;
  mealPlan: string;
  vendorId: string;
  cost: number;
  isCostEdited?: boolean;
}

export const PackageVoucherForm: React.FC<PackageVoucherFormProps> = ({
  initialData,
  onSave,
  onCancel,
  isClone,
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Default state initialization of hotelStays
  const defaultHotelStays = useMemo<HotelStay[]>(() => {
    const rawStays = initialData?.details?.hotelStays;
    if (rawStays && Array.isArray(rawStays)) {
      return rawStays;
    }

    const legacyStays: HotelStay[] = [];
    const mackHotel = initialData?.details?.makkahHotelName || "";
    if (mackHotel) {
      legacyStays.push({
        id: "makkah-legacy",
        city: "Makkah",
        hotelName: mackHotel,
        checkIn: initialData?.details?.makkahCheckIn || "",
        checkOut: initialData?.details?.makkahCheckOut || "",
        nights: Number(initialData?.details?.makkahNights) || 0,
        roomType: initialData?.details?.makkahRoomType || "Triple",
        numRooms: Number(initialData?.details?.makkahNumRooms) || 1,
        mealPlan: initialData?.details?.makkahMealPlan || "Breakfast",
        vendorId: initialData?.details?.makkahVendorId || "",
        cost: Number(initialData?.details?.makkahCost) || 0,
        isCostEdited: true,
      });
    }

    const madHotel = initialData?.details?.madinahHotelName || "";
    if (madHotel) {
      legacyStays.push({
        id: "madinah-legacy",
        city: "Madinah",
        hotelName: madHotel,
        checkIn: initialData?.details?.madinahCheckIn || "",
        checkOut: initialData?.details?.madinahCheckOut || "",
        nights: Number(initialData?.details?.madinahNights) || 0,
        roomType: initialData?.details?.madinahRoomType || "Triple",
        numRooms: Number(initialData?.details?.madinahNumRooms) || 1,
        mealPlan: initialData?.details?.madinahMealPlan || "Breakfast",
        vendorId: initialData?.details?.madinahVendorId || "",
        cost: Number(initialData?.details?.madinahCost) || 0,
        isCostEdited: true,
      });
    }

    if (legacyStays.length > 0) {
      return legacyStays;
    }

    // Default 1 Makkah & 1 Madinah stays
    return [
      {
        id: "makkah-init-" + Date.now(),
        city: "Makkah",
        hotelName: "",
        checkIn: "",
        checkOut: "",
        nights: 0,
        roomType: "Triple",
        numRooms: 1,
        mealPlan: "Breakfast",
        vendorId: "",
        cost: 0,
        isCostEdited: false,
      },
      {
        id: "madinah-init-" + (Date.now() + 1),
        city: "Madinah",
        hotelName: "",
        checkIn: "",
        checkOut: "",
        nights: 0,
        roomType: "Triple",
        numRooms: 1,
        mealPlan: "Breakfast",
        vendorId: "",
        cost: 0,
        isCostEdited: false,
      }
    ];
  }, [initialData]);

  // Default state initialization
  const [formData, setFormData] = useState({
    date:
      initialData?.date?.split("T")[0] ||
      new Date().toISOString().split("T")[0],
    currency: initialData?.currency || Currency.PKR,
    roe: initialData?.roe || 1,
    voucherNum: initialData?.voucherNum || "",
    customerId: initialData?.customerId || "",
    description: initialData?.description || "",
    reference: initialData?.reference || "",

    // Package parameters (Dynamic hotel stays)
    hotelStays: defaultHotelStays,

    transportRoute: initialData?.details?.transportRoute || "",
    transportVehicle: initialData?.details?.transportVehicle || "Bus",
    transportVendorId: initialData?.details?.transportVendorId || "",
    transportCost: initialData?.details?.transportCost || 0,

    ziyaratDetails: initialData?.details?.ziyaratDetails || "",
    ziyaratVendorId: initialData?.details?.ziyaratVendorId || "",
    ziyaratCost: initialData?.details?.ziyaratCost || 0,

    otherServices: initialData?.details?.otherServices || "",
    otherVendorId: initialData?.details?.otherVendorId || "",
    otherCost: initialData?.details?.otherCost || 0,

    // Flight Ticket Parameters
    ticketPNR: initialData?.details?.ticketPNR || "",
    ticketAirline: initialData?.details?.ticketAirline || "",
    ticketSector: initialData?.details?.ticketSector || "",
    ticketVendorId: initialData?.details?.ticketVendorId || "",
    ticketCost: initialData?.details?.ticketCost || 0,

    packagePricePerHaji: initialData?.details?.packagePricePerHaji || 0,
    incomeAccountId: initialData?.details?.incomeAccountId || "",

    // Pilgrim List
    hajjis: initialData?.details?.hajjis || [
      { fullName: "", passportNumber: "", hajiId: "" },
    ],
  });

  const [editedFields, setEditedFields] = useState({
    transportCost: !!initialData,
    ziyaratCost: !!initialData,
    otherCost: !!initialData,
    ticketCost: !!initialData,
  });

  const customerAccounts = useMemo(
    () => accounts.filter((a) => a.type === AccountType.CUSTOMER),
    [accounts],
  );
  const vendorAccounts = useMemo(
    () => accounts.filter((a) => a.type === AccountType.VENDOR),
    [accounts],
  );
  const revenueAccounts = useMemo(
    () => accounts.filter((a) => a.type === AccountType.REVENUE),
    [accounts],
  );

  useEffect(() => {
    const load = async () => {
      const [accs, conf] = await Promise.all([getAccounts(), getConfig()]);
      setAccounts(accs);
      setConfig(conf);

      // Auto-assign Revenue Account if empty
      if (accs.length > 0) {
        const firstRev = accs.find((a) => a.type === AccountType.REVENUE);
        if (firstRev && !formData.incomeAccountId) {
          setFormData((prev) => ({ ...prev, incomeAccountId: firstRev.id }));
        }
      }

      // Generate automatic voucher number if creating or cloning
      if (isClone || !initialData?.voucherNum) {
        const vNum = await AccountingService.generateVoucherNumber(
          VoucherType.PACKAGE,
          initialData?.date,
        );
        setFormData((prev) => ({ ...prev, voucherNum: vNum }));
      }

      setLoading(false);
    };
    load();
  }, [isClone, initialData]);

  useEffect(() => {
    if (config && !initialData) {
      setFormData((prev) => ({
        ...prev,
        roe: prev.currency === Currency.SAR ? config.defaultROE : 1,
      }));
    }
  }, [config, initialData]);

  // Automatically calculate/populate the vendor costs if the user hasn't manually edited them
  useEffect(() => {
    const totalCustomerAmountTrans = Number(formData.packagePricePerHaji) * formData.hajjis.length;
    
    setFormData(prev => {
      let changed = false;
      const updatedStays = (prev.hotelStays || []).map(stay => {
        if (stay.vendorId) {
          if (!stay.isCostEdited && stay.cost !== totalCustomerAmountTrans) {
            changed = true;
            return { ...stay, cost: totalCustomerAmountTrans };
          }
        } else if (stay.cost !== 0) {
          changed = true;
          return { ...stay, cost: 0 };
        }
        return stay;
      });

      let updated = { 
        ...prev,
        hotelStays: updatedStays
      };

      // 3. Transport Cost
      if (prev.transportVendorId) {
        if (!editedFields.transportCost && prev.transportCost !== totalCustomerAmountTrans) {
          updated.transportCost = totalCustomerAmountTrans;
          changed = true;
        }
      } else if (prev.transportCost !== 0) {
        updated.transportCost = 0;
        changed = true;
      }

      // 4. Ziyarat Cost
      if (prev.ziyaratVendorId) {
        if (!editedFields.ziyaratCost && prev.ziyaratCost !== totalCustomerAmountTrans) {
          updated.ziyaratCost = totalCustomerAmountTrans;
          changed = true;
        }
      } else if (prev.ziyaratCost !== 0) {
        updated.ziyaratCost = 0;
        changed = true;
      }

      // 4.5. Ticket Cost
      if (prev.ticketVendorId) {
        if (!editedFields.ticketCost && prev.ticketCost !== totalCustomerAmountTrans) {
          updated.ticketCost = totalCustomerAmountTrans;
          changed = true;
        }
      } else if (prev.ticketCost !== 0) {
        updated.ticketCost = 0;
        changed = true;
      }

      // 5. Other/Services Cost
      if (prev.otherVendorId) {
        if (!editedFields.otherCost && prev.otherCost !== totalCustomerAmountTrans) {
          updated.otherCost = totalCustomerAmountTrans;
          changed = true;
        }
      } else if (prev.otherCost !== 0) {
        updated.otherCost = 0;
        changed = true;
      }

      return changed ? updated : prev;
    });
  }, [
    formData.packagePricePerHaji, 
    formData.hajjis.length, 
    formData.hotelStays?.map(s => s.vendorId).join(','),
    formData.hotelStays?.map(s => s.isCostEdited).join(','),
    formData.transportVendorId, 
    formData.ziyaratVendorId, 
    formData.ticketVendorId,
    formData.otherVendorId,
    editedFields
  ]);

  // Handle hotel night calculations
  // Dynamic Stay mutation methods
  const updateStayField = (id: string, field: keyof HotelStay, value: any) => {
    setFormData((prev) => {
      const updated = (prev.hotelStays || []).map((stay) => {
        if (stay.id === id) {
          let updatedStay = { ...stay, [field]: value };
          if (field === "checkIn" || field === "checkOut") {
            if (updatedStay.checkIn && updatedStay.checkOut) {
              const start = new Date(updatedStay.checkIn);
              const end = new Date(updatedStay.checkOut);
              const originalDiff = Math.ceil(
                (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
              );
              updatedStay.nights = originalDiff > 0 ? originalDiff : 0;
            }
          }
          if (field === "vendorId" && !value) {
            updatedStay.cost = 0;
            updatedStay.isCostEdited = false;
          }
          if (field === "cost") {
            updatedStay.isCostEdited = true;
          }
          return updatedStay;
        }
        return stay;
      });
      return { ...prev, hotelStays: updated };
    });
  };

  const addStay = (city: "Makkah" | "Madinah") => {
    setFormData((prev) => ({
      ...prev,
      hotelStays: [
        ...(prev.hotelStays || []),
        {
          id: city.toLowerCase() + "-" + Date.now() + Math.random().toString(36).substr(2, 4),
          city,
          hotelName: "",
          checkIn: "",
          checkOut: "",
          nights: 0,
          roomType: "Triple",
          numRooms: 1,
          mealPlan: "Breakfast",
          vendorId: "",
          cost: 0,
          isCostEdited: false,
        },
      ],
    }));
  };

  const cloneStay = (stayToClone: HotelStay) => {
    setFormData((prev) => {
      // Setup default dates for next stay based on the cloned stay's checkout
      let checkIn = stayToClone.checkOut || stayToClone.checkIn;
      let checkOut = "";
      if (checkIn && stayToClone.nights > 0) {
        const d = new Date(checkIn);
        d.setDate(d.getDate() + stayToClone.nights);
        checkOut = d.toISOString().split("T")[0];
      }

      // Automatically alternative city to provide a seamless travel rotation!
      const nextCity = stayToClone.city === "Makkah" ? "Madinah" : "Makkah";

      return {
        ...prev,
        hotelStays: [
          ...(prev.hotelStays || []),
          {
            ...stayToClone,
            id: nextCity.toLowerCase() + "-" + Date.now() + Math.random().toString(36).substr(2, 4),
            city: nextCity,
            checkIn: checkIn,
            checkOut: checkOut,
            isCostEdited: true, // Keep costs
          }
        ]
      };
    });
  };

  const removeStay = (id: string) => {
    if ((formData.hotelStays || []).length === 1) {
      alert("At least one hotel stay is required.");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      hotelStays: (prev.hotelStays || []).filter((s) => s.id !== id),
    }));
  };

  const cloneMakkahToMadinah = () => {};
  const cloneMadinahToMakkah = () => {};

  const cloneFromTransportToZiyarat = () => {
    setFormData((p) => {
      setEditedFields((pf) => ({
        ...pf,
        ziyaratCost: editedFields.transportCost,
      }));
      return {
        ...p,
        ziyaratDetails: p.transportRoute ? `ZIYARAT / TRANSPORT ROUTE: ${p.transportRoute} (${p.transportVehicle})` : p.ziyaratDetails,
        ziyaratVendorId: p.transportVendorId,
        ziyaratCost: p.transportCost,
      };
    });
  };

  const cloneFromZiyaratToTransport = () => {
    setFormData((p) => {
      setEditedFields((pf) => ({
        ...pf,
        transportCost: editedFields.ziyaratCost,
      }));
      return {
        ...p,
        transportRoute: p.ziyaratDetails ? p.ziyaratDetails.substring(0, 100) : p.transportRoute,
        transportVendorId: p.ziyaratVendorId,
        transportCost: p.ziyaratCost,
      };
    });
  };

  const autoGenerateRouteFromStays = () => {
    const stays = formData.hotelStays || [];
    if (stays.length === 0) {
      alert("No hotel stays defined yet to build a route.");
      return;
    }
    const sorted = [...stays].sort((a, b) => {
      if (!a.checkIn) return 1;
      if (!b.checkIn) return -1;
      return new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime();
    });

    const routeCities: string[] = ["Jeddah Airport"];
    sorted.forEach((stay) => {
      if (stay.city && !routeCities.includes(stay.city)) {
        routeCities.push(stay.city);
      }
    });
    routeCities.push("Jeddah Airport");

    const constructedRoute = routeCities.join(" → ");
    setFormData((p) => ({
      ...p,
      transportRoute: constructedRoute,
    }));
  };

  // Pilgrim List modification
  const addHajiRow = () => {
    setFormData((prev) => ({
      ...prev,
      hajjis: [
        ...prev.hajjis,
        { fullName: "", passportNumber: "", hajiId: "" },
      ],
    }));
  };

  const removeHajiRow = (idx: number) => {
    if (formData.hajjis.length === 1) {
      alert("At least one Pilgrim/Hajji name is required.");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      hajjis: prev.hajjis.filter((_, i) => i !== idx),
    }));
  };

  const updateHajiRow = (idx: number, field: string, value: any) => {
    setFormData((prev) => {
      const updated = [...prev.hajjis];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, hajjis: updated };
    });
  };

  // Totals calculations
  const totals = useMemo(() => {
    const rateMultiplier =
      formData.currency === Currency.SAR ? formData.roe : 1;

    // Total cost from all dynamic hotel stays
    const hotelStaysCost = (formData.hotelStays || []).reduce((acc, s) => acc + Number(s.cost || 0), 0);

    // Total cost from all vendors
    const vendorCosts =
      hotelStaysCost +
      Number(formData.transportCost) +
      Number(formData.ziyaratCost) +
      Number(formData.ticketCost) +
      Number(formData.otherCost);

    const totalPilgrims = formData.hajjis.length;
    const totalCustomerAmountTrans =
      Number(formData.packagePricePerHaji) * totalPilgrims;

    const customerAmountPKR = totalCustomerAmountTrans * rateMultiplier;
    const vendorCostsPKR = vendorCosts * rateMultiplier;
    const marginPKR = customerAmountPKR - vendorCostsPKR;

    return {
      totalPilgrims,
      totalCustomerAmountTrans,
      customerAmountPKR,
      vendorCosts,
      vendorCostsPKR,
      marginPKR,
    };
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) return alert("Please select a Customer Account.");

    // Ensure all Hajjis have names
    const emptyHaji = formData.hajjis.find((h) => !h.fullName.trim());
    if (emptyHaji)
      return alert("All pilgrims in the list must have a full name.");

    // Auto-save pilgrims to the Master Haji database
    const updatedHajjis = await Promise.all(
      formData.hajjis.map(async (hajiItem) => {
        try {
          const masterHaji = await HajiService.ensureHaji({
            fullName: hajiItem.fullName,
            passportNumber: hajiItem.passportNumber,
          });
          return {
            fullName: hajiItem.fullName,
            passportNumber: hajiItem.passportNumber,
            hajiId: masterHaji?.hajiId || "",
          };
        } catch (err) {
          console.error("Error saving pilgrim to database:", err);
          return hajiItem;
        }
      }),
    );

    onSave({
      ...formData,
      type: VoucherType.PACKAGE,
      totalAmountPKR: totals.customerAmountPKR,
      status: VoucherStatus.POSTED,
      details: {
        ...formData,
        hajjis: updatedHajjis,
        ...totals,
      },
    });
  };

  if (loading || !config) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto no-print">
      <div className="bg-[#f8fbff] dark:bg-slate-900 w-full max-w-7xl rounded-[2.5rem] shadow-2xl flex flex-col border border-white/20 animate-in zoom-in-95 duration-200 overflow-hidden h-[95vh]">
        {/* Header */}
        <div className="px-8 pt-6 pb-2 flex justify-between items-center bg-[#f8fbff] dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-black font-orbitron text-slate-800 dark:text-white uppercase tracking-tighter">
              PACKAGE BOOKING VOUCHER
            </h1>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">
              Group Umrah Packages - {config.companyName}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="bg-white dark:bg-slate-800 p-3 rounded-2xl text-slate-400 hover:text-rose-500 transition-colors shadow-sm ring-1 ring-slate-100 dark:ring-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar"
        >
          {/* Section A: Metadata / Header info */}
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">
                Voucher-Type
              </div>
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-black uppercase text-blue-600 dark:text-blue-400">
                📦 PACKAGE VOUCHER
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                Voucher #
              </label>
              <input
                type="text"
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase shadow-inner text-slate-800 dark:text-white disabled:opacity-60"
                disabled
                value={formData.voucherNum}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                Date
              </label>
              <DateInput
                value={formData.date}
                onChange={(val) => setFormData((p) => ({ ...p, date: val }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                  Currency
                </label>
                <select
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase select-custom outline-none text-slate-800 dark:text-white"
                  value={formData.currency}
                  onChange={(e) => {
                    const curr = e.target.value as Currency;
                    setFormData((p) => ({
                      ...p,
                      currency: curr,
                      roe: curr === Currency.SAR ? config.defaultROE : 1,
                    }));
                  }}
                >
                  <option value={Currency.PKR}>PKR</option>
                  <option value={Currency.SAR}>SAR</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                  ROE
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black shadow-inner outline-none text-slate-800 dark:text-white"
                  value={formData.roe}
                  disabled={formData.currency === Currency.PKR}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      roe: Number(e.target.value) || 1,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Section B: Customer Billing details */}
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                Customer Account (Debited)
              </label>
              <select
                required
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase select-custom outline-none text-slate-800 dark:text-white"
                value={formData.customerId}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, customerId: e.target.value }))
                }
              >
                <option value="">Select Customer Account</option>
                {customerAccounts.map((ac) => (
                  <option key={ac.id} value={ac.id}>
                    {ac.name} [{ac.currency}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                Package Price Per Hajji ({formData.currency})
              </label>
              <input
                type="number"
                min="0"
                required
                placeholder="Selling Price per Pilgrim"
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black shadow-inner outline-none text-slate-800 dark:text-white"
                value={formData.packagePricePerHaji || ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    packagePricePerHaji: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                Revenue/Loss Markup Account (Difference credit)
              </label>
              <select
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase select-custom outline-none text-slate-800 dark:text-white"
                value={formData.incomeAccountId}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    incomeAccountId: e.target.value,
                  }))
                }
              >
                {revenueAccounts.map((ac) => (
                  <option key={ac.id} value={ac.id}>
                    {ac.name} [Operating Income]
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                Voucher Global Description / Internal Note
              </label>
              <textarea
                rows={2}
                placeholder="Enter additional description, notes or remarks here..."
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black shadow-inner outline-none text-slate-800 dark:text-white uppercase"
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Section C: PILGRIMS / HAJJIS SECTION */}
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl shadow-sm">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider font-orbitron">
                  Pilgrim Group Details
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  List of pilgrims traveling together in this package
                </p>
              </div>
              <button
                type="button"
                onClick={addHajiRow}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors active:scale-95"
              >
                ➕ Add Pilgrim
              </button>
            </div>

            <div className="space-y-4">
              {formData.hajjis.map((haji, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end border-b border-slate-50 dark:border-slate-800 pb-4 last:border-0 last:pb-0"
                >
                  <div className="md:col-span-2">
                    <HajiSelector
                      label={`Pilgrim #${idx + 1} - Name`}
                      value={haji.fullName}
                      placeholder="Type to search or register pilgrim..."
                      onSelect={(selected) => {
                        updateHajiRow(idx, "fullName", selected.fullName || "");
                        if (selected.passportNumber) {
                          updateHajiRow(
                            idx,
                            "passportNumber",
                            selected.passportNumber,
                          );
                        }
                        if (selected.hajiId) {
                          updateHajiRow(idx, "hajiId", selected.hajiId);
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                        Passport Number
                      </label>
                      <input
                        type="text"
                        placeholder="PASSPORT #"
                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase shadow-inner outline-none text-slate-800 dark:text-white font-mono"
                        value={haji.passportNumber}
                        onChange={(e) =>
                          updateHajiRow(idx, "passportNumber", e.target.value)
                        }
                      />
                    </div>

                    {formData.hajjis.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeHajiRow(idx)}
                        className="bg-rose-50 rounded-2xl p-3 text-rose-500 hover:bg-rose-100 transition-colors shrink-0 mt-5 dark:bg-rose-900/10 dark:text-rose-400"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section D: Accommodation details */}
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800/10 pb-4">
              <div>
                <h3 className="text-xs font-black text-rose-600 uppercase tracking-wider font-orbitron">
                  🏢 Hotel Accommodations / Stays
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Manage sequence of stays (e.g. Makkah ➔ Madinah ➔ Makkah)
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto no-print">
                <button
                  type="button"
                  onClick={() => addStay("Makkah")}
                  className="flex-1 sm:flex-none bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/10 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all hover:scale-102 active:scale-98 flex items-center justify-center gap-1.5"
                >
                  🕋 Add Makkah Stay
                </button>
                <button
                  type="button"
                  onClick={() => addStay("Madinah")}
                  className="flex-1 sm:flex-none bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-105 dark:border-emerald-900/10 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all hover:scale-102 active:scale-98 flex items-center justify-center gap-1.5"
                >
                  🕌 Add Madinah Stay
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {(formData.hotelStays || []).map((stay, idx) => {
                const isMakkah = stay.city === "Makkah";
                const dotColor = isMakkah ? "bg-rose-500" : "bg-emerald-500";
                const badgeBg = isMakkah
                  ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/10"
                  : "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/10";
                const cityDatalist = isMakkah ? "makkah_suggestions" : "madinah_suggestions";

                return (
                  <div
                    key={stay.id}
                    className="bg-slate-50/10 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl hover:border-slate-200 dark:hover:border-slate-705 transition-all flex flex-col justify-between space-y-4"
                  >
                    {/* Header of Stay card */}
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-850/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/55">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
                        <div>
                          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${badgeBg}`}>
                            Stay #{idx + 1}: {stay.city}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 no-print">
                        <button
                          type="button"
                          onClick={() => cloneStay(stay)}
                          className="bg-sky-50 hover:bg-sky-100 text-sky-600 dark:bg-sky-950/20 dark:text-sky-400 border border-sky-100 dark:border-sky-900/10 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
                          title="Clone this stay to next destination stay"
                        >
                          👯 Clone Stay
                        </button>
                        {(formData.hotelStays || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStay(stay.id)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/10 p-1.5 rounded-xl text-[10px] font-black uppercase transition-all hover:scale-105 active:scale-95 text-xs w-7 h-7 flex items-center justify-center font-bold"
                            title="Delete this stay"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inputs of Card */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                          Hotel Name
                        </label>
                        <input
                          list={cityDatalist}
                          type="text"
                          required
                          placeholder="Select or enter hotel name"
                          className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase shadow-inner outline-none text-slate-800 dark:text-white"
                          value={stay.hotelName}
                          onChange={(e) => updateStayField(stay.id, "hotelName", e.target.value)}
                        />
                        <datalist id="makkah_suggestions">
                          {MAKKAH_HOTELS.map((hotel) => (
                            <option key={hotel} value={hotel} />
                          ))}
                        </datalist>
                        <datalist id="madinah_suggestions">
                          {MADINAH_HOTELS.map((hotel) => (
                            <option key={hotel} value={hotel} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                          Check-in Date
                        </label>
                        <DateInput
                          value={stay.checkIn}
                          onChange={(v) => updateStayField(stay.id, "checkIn", v)}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block font-orbitron">
                          Check-out Date
                        </label>
                        <DateInput
                          value={stay.checkOut}
                          onChange={(v) => updateStayField(stay.id, "checkOut", v)}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block font-orbitron">
                          Nights Count
                        </label>
                        <input
                          type="number"
                          disabled
                          placeholder="..."
                          className="w-full bg-slate-200 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black shadow-inner outline-none text-slate-500 dark:text-slate-400 select-none cursor-not-allowed"
                          value={stay.nights}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                          Room Type Category
                        </label>
                        <select
                          className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase select-custom outline-none text-slate-800 dark:text-white"
                          value={stay.roomType}
                          onChange={(e) => updateStayField(stay.id, "roomType", e.target.value)}
                        >
                          {ROOM_TYPES.map((rt) => (
                            <option key={rt} value={rt}>
                              {rt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block text-slate-500">
                          No. of Rooms
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black shadow-inner outline-none text-slate-800 dark:text-white"
                          value={stay.numRooms}
                          onChange={(e) => updateStayField(stay.id, "numRooms", parseInt(e.target.value) || 1)}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                          Meal Plan Arrangement
                        </label>
                        <select
                          className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase select-custom outline-none text-slate-800 dark:text-white font-orbitron"
                          value={stay.mealPlan}
                          onChange={(e) => updateStayField(stay.id, "mealPlan", e.target.value)}
                        >
                          {MEALS.map((meal) => (
                            <option key={meal} value={meal}>
                              {meal}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                            Hotel Vendor/Supplier Account
                          </label>
                          <select
                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase select-custom outline-none text-slate-800 dark:text-white"
                            value={stay.vendorId}
                            onChange={(e) => updateStayField(stay.id, "vendorId", e.target.value)}
                          >
                            <option value="">No vendor (No credit ledger entry)</option>
                            {vendorAccounts.map((ac) => (
                              <option key={ac.id} value={ac.id}>
                                {ac.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 flex items-center justify-between">
                            <span>Hotel Cost ({formData.currency})</span>
                            {stay.vendorId && (
                              <button
                                type="button"
                                onClick={() => {
                                  const totalCustomerAmountTrans = Number(formData.packagePricePerHaji) * formData.hajjis.length;
                                  updateStayField(stay.id, "cost", totalCustomerAmountTrans);
                                }}
                                className="text-[9px] font-bold text-emerald-500 hover:text-emerald-700 underline focus:outline-none"
                              >
                                Set to Total ({(Number(formData.packagePricePerHaji) * formData.hajjis.length).toLocaleString()})
                              </button>
                            )}
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="Vendor cost"
                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black shadow-inner outline-none text-slate-800 dark:text-white"
                            value={stay.cost || ""}
                            onChange={(e) => updateStayField(stay.id, "cost", Number(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* D1: Makkah Hotel Accommodation */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/10 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-xs font-black text-rose-600 uppercase tracking-wider font-orbitron">
                    Makkah Accommodation
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Hotel stay in Makkah Mukarramah
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cloneMakkahToMadinah}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 flex items-center gap-1 border border-rose-100 dark:border-rose-900/10 no-print"
                  title="Copy Accommodation details to Madinah section"
                >
                  👯 Clone to Madinah
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Hotel Name
                  </label>
                  <input
                    list="makkah_suggestions"
                    type="text"
                    placeholder="Select or enter hotel name"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase shadow-inner outline-none text-slate-800 dark:text-white"
                    value={formData.makkahHotelName}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        makkahHotelName: e.target.value,
                      }))
                    }
                  />
                  <datalist id="makkah_suggestions">
                    {MAKKAH_HOTELS.map((hotel) => (
                      <option key={hotel} value={hotel} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Check-in Date
                  </label>
                  <DateInput
                    value={formData.makkahCheckIn}
                    onChange={(v) =>
                      setFormData((p) => ({ ...p, makkahCheckIn: v }))
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Check-out Date
                  </label>
                  <DateInput
                    value={formData.makkahCheckOut}
                    onChange={(v) =>
                      setFormData((p) => ({ ...p, makkahCheckOut: v }))
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Room Type
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white"
                    value={formData.makkahRoomType}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        makkahRoomType: e.target.value,
                      }))
                    }
                  >
                    {ROOM_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    No. of Rooms
                  </label>
                  <input
                    type="number"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white"
                    value={formData.makkahNumRooms}
                    min={1}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        makkahNumRooms: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Meal Plan
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white"
                    value={formData.makkahMealPlan}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        makkahMealPlan: e.target.value,
                      }))
                    }
                  >
                    {MEALS.map((meal) => (
                      <option key={meal} value={meal}>
                        {meal}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Hotel Vendor Account
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase select-custom outline-none text-slate-800 dark:text-white"
                    value={formData.makkahVendorId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setEditedFields((p) => ({ ...p, makkahCost: false }));
                      }
                      setFormData((p) => ({
                        ...p,
                        makkahVendorId: val,
                      }));
                    }}
                  >
                    <option value="">No vendor (No credit ledger entry)</option>
                    {vendorAccounts.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block flex justify-between items-center">
                    <span>Hotel Cost ({formData.currency})</span>
                    {formData.makkahVendorId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditedFields((p) => ({ ...p, makkahCost: true }));
                          const totalCustomerAmountTrans = Number(formData.packagePricePerHaji) * formData.hajjis.length;
                          setFormData((p) => ({ ...p, makkahCost: totalCustomerAmountTrans }));
                        }}
                        className="text-[9px] font-bold text-emerald-500 hover:text-emerald-700 underline focus:outline-none"
                      >
                        Set to Total ({(Number(formData.packagePricePerHaji) * formData.hajjis.length).toLocaleString()})
                      </button>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Vendor cost"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black shadow-inner outline-none text-slate-800 dark:text-white"
                    value={formData.makkahCost || ""}
                    onChange={(e) => {
                      setEditedFields((p) => ({ ...p, makkahCost: true }));
                      setFormData((p) => ({
                        ...p,
                        makkahCost: Number(e.target.value) || 0,
                      }));
                    }}
                  />
                </div>
              </div>
            </div>

            {/* D2: Madinah Hotel Accommodation */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/10 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-xs font-black text-emerald-600 uppercase tracking-wider font-orbitron">
                    Madinah Accommodation
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Hotel stay in Madinah Munawwarah
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cloneMadinahToMakkah}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 flex items-center gap-1 border border-emerald-100 dark:border-emerald-900/10 no-print"
                  title="Copy Accommodation details to Makkah section"
                >
                  👯 Clone to Makkah
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Hotel Name
                  </label>
                  <input
                    list="madinah_suggestions"
                    type="text"
                    placeholder="Select or enter hotel name"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase shadow-inner outline-none text-slate-800 dark:text-white"
                    value={formData.madinahHotelName}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        madinahHotelName: e.target.value,
                      }))
                    }
                  />
                  <datalist id="madinah_suggestions">
                    {MADINAH_HOTELS.map((hotel) => (
                      <option key={hotel} value={hotel} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Check-in Date
                  </label>
                  <DateInput
                    value={formData.madinahCheckIn}
                    onChange={(v) =>
                      setFormData((p) => ({ ...p, madinahCheckIn: v }))
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Check-out Date
                  </label>
                  <DateInput
                    value={formData.madinahCheckOut}
                    onChange={(v) =>
                      setFormData((p) => ({ ...p, madinahCheckOut: v }))
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Room Type
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white"
                    value={formData.madinahRoomType}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        madinahRoomType: e.target.value,
                      }))
                    }
                  >
                    {ROOM_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    No. of Rooms
                  </label>
                  <input
                    type="number"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white"
                    value={formData.madinahNumRooms}
                    min={1}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        madinahNumRooms: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Meal Plan
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white"
                    value={formData.madinahMealPlan}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        madinahMealPlan: e.target.value,
                      }))
                    }
                  >
                    {MEALS.map((meal) => (
                      <option key={meal} value={meal}>
                        {meal}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Hotel Vendor Account
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase select-custom outline-none text-slate-800 dark:text-white"
                    value={formData.madinahVendorId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setEditedFields((p) => ({ ...p, madinahCost: false }));
                      }
                      setFormData((p) => ({
                        ...p,
                        madinahVendorId: val,
                      }));
                    }}
                  >
                    <option value="">No vendor (No credit ledger entry)</option>
                    {vendorAccounts.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block flex justify-between items-center">
                    <span>Hotel Cost ({formData.currency})</span>
                    {formData.madinahVendorId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditedFields((p) => ({ ...p, madinahCost: true }));
                          const totalCustomerAmountTrans = Number(formData.packagePricePerHaji) * formData.hajjis.length;
                          setFormData((p) => ({ ...p, madinahCost: totalCustomerAmountTrans }));
                        }}
                        className="text-[9px] font-bold text-emerald-500 hover:text-emerald-700 underline focus:outline-none"
                      >
                        Set to Total ({(Number(formData.packagePricePerHaji) * formData.hajjis.length).toLocaleString()})
                      </button>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Vendor cost"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black shadow-inner outline-none text-slate-800 dark:text-white"
                    value={formData.madinahCost || ""}
                    onChange={(e) => {
                      setEditedFields((p) => ({ ...p, madinahCost: true }));
                      setFormData((p) => ({
                        ...p,
                        madinahCost: Number(e.target.value) || 0,
                      }));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Section E: Transport & Ziyarat & Services details once */}
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
            <div>
              <h3 className="text-xs font-black text-blue-600 uppercase tracking-wider font-orbitron">
                Transport, Ziyarat, Flights & Other Services
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Define transport logs, ziyarat routing, flight tickets, and visas/other packages
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Transport details */}
              <div className="space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 pb-4 lg:pb-0 lg:pr-6">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80 mb-1">
                  <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                    🚗 Transportation
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={autoGenerateRouteFromStays}
                      className="text-[9px] font-black text-blue-500 hover:text-blue-700 underline uppercase"
                      title="Generate route sequence from hotels stays"
                    >
                      🪄 Auto Route
                    </button>
                    <button
                      type="button"
                      onClick={cloneFromZiyaratToTransport}
                      className="text-[9px] font-black text-emerald-500 hover:text-emerald-700 underline uppercase"
                      title="Copy vendor, cost & details from Ziyarat"
                    >
                      👯 Copy Ziyarat
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Sector / Route
                  </label>
                  <input
                    list="sector_choices"
                    type="text"
                    placeholder="e.g. Jeddah -> Makkah"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white"
                    value={formData.transportRoute}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        transportRoute: e.target.value,
                      }))
                    }
                  />
                  <datalist id="sector_choices">
                    {SECTOR_SUGGESTIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Vehicle Type
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white"
                    value={formData.transportVehicle}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        transportVehicle: e.target.value,
                      }))
                    }
                  >
                    {VEHICLES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Transport Vendor
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase select-custom outline-none text-slate-800 dark:text-white"
                    value={formData.transportVendorId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setEditedFields((p) => ({ ...p, transportCost: false }));
                      }
                      setFormData((p) => ({
                        ...p,
                        transportVendorId: val,
                      }));
                    }}
                  >
                    <option value="">No vendor</option>
                    {vendorAccounts.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block flex justify-between items-center">
                    <span>Transport Cost ({formData.currency})</span>
                    {formData.transportVendorId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditedFields((p) => ({ ...p, transportCost: true }));
                          const totalCustomerAmountTrans = Number(formData.packagePricePerHaji) * formData.hajjis.length;
                          setFormData((p) => ({ ...p, transportCost: totalCustomerAmountTrans }));
                        }}
                        className="text-[9px] font-bold text-emerald-500 hover:text-emerald-700 underline focus:outline-none"
                      >
                        Set to Total ({(Number(formData.packagePricePerHaji) * formData.hajjis.length).toLocaleString()})
                      </button>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Vendor cost"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black shadow-inner outline-none text-slate-800 dark:text-white"
                    value={formData.transportCost || ""}
                    onChange={(e) => {
                      setEditedFields((p) => ({ ...p, transportCost: true }));
                      setFormData((p) => ({
                        ...p,
                        transportCost: Number(e.target.value) || 0,
                      }));
                    }}
                  />
                </div>
              </div>

              {/* Ziyarat details */}
              <div className="space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 pb-4 lg:pb-0 lg:px-6">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80 mb-1">
                  <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                    🕌 Ziyarat Tours
                  </div>
                  <button
                    type="button"
                    onClick={cloneFromTransportToZiyarat}
                    className="text-[9px] font-black text-blue-500 hover:text-blue-700 underline uppercase"
                    title="Copy vendor, cost & route details from Transportation"
                  >
                    👯 Copy Transport
                  </button>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Ziyarat Details / Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ziyarat tours in Makkah/Madinah..."
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white"
                    value={formData.ziyaratDetails}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        ziyaratDetails: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Ziyarat Vendor
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase select-custom outline-none text-slate-800 dark:text-white"
                    value={formData.ziyaratVendorId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setEditedFields((p) => ({ ...p, ziyaratCost: false }));
                      }
                      setFormData((p) => ({
                        ...p,
                        ziyaratVendorId: val,
                      }));
                    }}
                  >
                    <option value="">No vendor</option>
                    {vendorAccounts.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block flex justify-between items-center">
                    <span>Ziyarat Cost ({formData.currency})</span>
                    {formData.ziyaratVendorId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditedFields((p) => ({ ...p, ziyaratCost: true }));
                          const totalCustomerAmountTrans = Number(formData.packagePricePerHaji) * formData.hajjis.length;
                          setFormData((p) => ({ ...p, ziyaratCost: totalCustomerAmountTrans }));
                        }}
                        className="text-[9px] font-bold text-emerald-500 hover:text-emerald-700 underline focus:outline-none"
                      >
                        Set to Total ({(Number(formData.packagePricePerHaji) * formData.hajjis.length).toLocaleString()})
                      </button>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Vendor cost"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black shadow-inner outline-none text-slate-800 dark:text-white"
                    value={formData.ziyaratCost || ""}
                    onChange={(e) => {
                      setEditedFields((p) => ({ ...p, ziyaratCost: true }));
                      setFormData((p) => ({
                        ...p,
                        ziyaratCost: Number(e.target.value) || 0,
                      }));
                    }}
                  />
                </div>
              </div>

              {/* Flight Ticket details */}
              <div className="space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 pb-4 lg:pb-0 lg:px-6">
                <div className="text-[10px] font-black text-slate-400 tracking-wider uppercase">
                  ✈️ Flight Tickets
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    PNR / Ticket Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1A-FXYZWE"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white font-orbitron"
                    value={formData.ticketPNR}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        ticketPNR: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Airline / Carrier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Saudia, PIA"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white"
                    value={formData.ticketAirline}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        ticketAirline: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Ticket Sector
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LHE-JED-KHI"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white"
                    value={formData.ticketSector}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        ticketSector: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block font-orbitron">
                    Ticket Vendor
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase select-custom outline-none text-slate-800 dark:text-white"
                    value={formData.ticketVendorId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setEditedFields((p) => ({ ...p, ticketCost: false }));
                      }
                      setFormData((p) => ({
                        ...p,
                        ticketVendorId: val,
                      }));
                    }}
                  >
                    <option value="">No vendor</option>
                    {vendorAccounts.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block flex justify-between items-center">
                    <span>Ticket Cost ({formData.currency})</span>
                    {formData.ticketVendorId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditedFields((p) => ({ ...p, ticketCost: true }));
                          const totalCustomerAmountTrans = Number(formData.packagePricePerHaji) * formData.hajjis.length;
                          setFormData((p) => ({ ...p, ticketCost: totalCustomerAmountTrans }));
                        }}
                        className="text-[9px] font-bold text-emerald-500 hover:text-emerald-700 underline focus:outline-none"
                      >
                        Set to Total ({(Number(formData.packagePricePerHaji) * formData.hajjis.length).toLocaleString()})
                      </button>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Vendor cost"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black shadow-inner outline-none text-slate-800 dark:text-white font-orbitron"
                    value={formData.ticketCost || ""}
                    onChange={(e) => {
                      setEditedFields((p) => ({ ...p, ticketCost: true }));
                      setFormData((p) => ({
                        ...p,
                        ticketCost: Number(e.target.value) || 0,
                      }));
                    }}
                  />
                </div>
              </div>

              {/* Other Services details */}
              <div className="space-y-4 lg:pl-6">
                <div className="text-[10px] font-black text-slate-400 tracking-wider uppercase">
                  📦 Other Included Services
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Other Services Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Visa, insurance, other additions..."
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase outline-none text-slate-800 dark:text-white"
                    value={formData.otherServices}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        otherServices: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Services Vendor
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black uppercase select-custom outline-none text-slate-800 dark:text-white"
                    value={formData.otherVendorId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setEditedFields((p) => ({ ...p, otherCost: false }));
                      }
                      setFormData((p) => ({
                        ...p,
                        otherVendorId: val,
                      }));
                    }}
                  >
                    <option value="">No vendor</option>
                    {vendorAccounts.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block flex justify-between items-center">
                    <span>Services Cost ({formData.currency})</span>
                    {formData.otherVendorId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditedFields((p) => ({ ...p, otherCost: true }));
                          const totalCustomerAmountTrans = Number(formData.packagePricePerHaji) * formData.hajjis.length;
                          setFormData((p) => ({ ...p, otherCost: totalCustomerAmountTrans }));
                        }}
                        className="text-[9px] font-bold text-emerald-500 hover:text-emerald-700 underline focus:outline-none"
                      >
                        Set to Total ({(Number(formData.packagePricePerHaji) * formData.hajjis.length).toLocaleString()})
                      </button>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Vendor cost"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-black shadow-inner outline-none text-slate-800 dark:text-white"
                    value={formData.otherCost || ""}
                    onChange={(e) => {
                      setEditedFields((p) => ({ ...p, otherCost: true }));
                      setFormData((p) => ({
                        ...p,
                        otherCost: Number(e.target.value) || 0,
                      }));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section F: Live Calculations Summary Widget */}
          <div className="bg-slate-900 border dark:border-slate-800 text-white p-8 rounded-[2rem] shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h4 className="text-sm font-black font-orbitron uppercase tracking-widest">
                  Pricing & Margin Sheet
                </h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  Real-time ledger projection balances in PKR Base Currency
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  GROUP PILGRIM COUNT
                </p>
                <p className="text-xl font-black font-orbitron text-blue-400">
                  {totals.totalPilgrims} HAJJIS
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center lg:text-left">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Price Per Hajji
                </p>
                <p className="text-xl font-black font-orbitron leading-none">
                  {formData.currency}{" "}
                  {Number(formData.packagePricePerHaji).toLocaleString()}
                </p>
                <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">
                  ROE: {formData.roe} PKR/SAR
                </p>
              </div>

              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  CUSTOMER BILLING / DEBIT
                </p>
                <p className="text-xl font-black font-orbitron text-blue-400 leading-none">
                  {formData.currency}{" "}
                  {totals.totalCustomerAmountTrans.toLocaleString()}
                </p>
                <p className="text-[9px] font-black text-blue-300 mt-1">
                  ≈ PKR {totals.customerAmountPKR.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  TOTAL VENDOR COST / CREDIT
                </p>
                <p className="text-xl font-black font-orbitron text-rose-400 leading-none">
                  {formData.currency} {totals.vendorCosts.toLocaleString()}
                </p>
                <p className="text-[9px] font-black text-rose-300 mt-1">
                  ≈ PKR {totals.vendorCostsPKR.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-1">
                  ESTIMATED NET MARGIN (PKR)
                </p>
                <p
                  className={`text-xl font-black font-orbitron leading-none ${totals.marginPKR >= 0 ? "text-emerald-400" : "text-rose-500"}`}
                >
                  PKR {totals.marginPKR.toLocaleString()}
                </p>
                <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">
                  CREDITED TO MARKUP REVENUE
                </p>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-8 py-4 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-widest transition-all hover:bg-slate-50 active:scale-95 shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-12 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95"
            >
              ✓ Save Package Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
