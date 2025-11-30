/**
 * PARKING PREDICTOR PRO - REAL API INTEGRATION
 * ============================================
 * * Updates:
 * * 1. Filtered to only Park A and Park B.
 * * 2. Integrated real backend fetch to http://127.0.0.1:8000/slots
 * * 3. Map now pins the specific lot location when selected.
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  MapPin,
  Clock,
  Navigation,
  Car,
  Search,
  AlertTriangle,
  ArrowRight,
  X,
  Layers,
  Move,
} from "lucide-react";
import { format } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- UTILS ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Haversine formula to calculate distance between two points in meters
const getDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ1) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// --- TYPES ---
interface ParkingLot {
  id: string; // "1" or "2"
  name: string;
  lat: number;
  lng: number;
  distance_m: number;
  predicted_percent: number; // 0-100
  total_slots: number;
  slots: number[]; // Array of 0s and 1s
  type: "surface" | "multistory";
}

interface Destination {
  name: string;
  lat: number;
  lng: number;
}

interface BackendSlotResponse {
  id: number;
  datetime: string;
  total_slots: number;
  total_occupied: number;
  total_empty: number;
}

// --- MOCK DATA & BACKEND ---

const MOCK_DESTINATIONS: Destination[] = [
  { name: "Nizami Street, Baku", lat: 40.375, lng: 49.836 },
  { name: "Heydar Aliyev Center", lat: 40.395, lng: 49.867 },
  { name: "Baku Boulevard", lat: 40.368, lng: 49.839 },
  {
    name: "French Azerbaijani University",
    lat: 40.376661210916254,
    lng: 49.851671483258876,
  },
];

const mockFetchParkingLots = async (
  lat: number,
  lng: number
): Promise<ParkingLot[]> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 400));

  // Hardcoded Park A and Park B near the destination
  const lots = [
    {
      id: "1",
      name: "Park A",
      lat: lat + 0.0015,
      lng: lng - 0.001,
      type: "surface",
      total_slots: 120,
      baseOcc: 43, // Initial mock state before API fetch
    },
    {
      id: "2",
      name: "Park B",
      lat: lat - 0.001,
      lng: lng + 0.002,
      type: "multistory",
      total_slots: 30,
      baseOcc: 13, // Initial mock state before API fetch
    },
  ];

  return lots
    .map((l) => {
      // Generate initial visual slots based on baseOcc
      const occupiedCount = l.baseOcc;
      const slots = Array(l.total_slots)
        .fill(0)
        .map((_, idx) => (idx < occupiedCount ? 1 : 0))
        .sort(() => Math.random() - 0.5);
      // Take a slice for visualization if array is huge
      const visualSlots = slots.length > 50 ? slots.slice(0, 50) : slots;

      return {
        id: l.id,
        name: l.name,
        lat: l.lat,
        lng: l.lng,
        distance_m: getDistanceMeters(lat, lng, l.lat, l.lng),
        predicted_percent: Math.round((occupiedCount / l.total_slots) * 100),
        total_slots: l.total_slots,
        slots: visualSlots,
        type: l.type as any,
      };
    })
    .sort((a, b) => a.distance_m - b.distance_m);
};

// --- REAL API FETCH ---
const fetchRealPrediction = async (
  arrivalDate: string
): Promise<BackendSlotResponse[]> => {
  try {
    const response = await fetch("http://127.0.0.1:8000/slots", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ date: arrivalDate }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch real prediction:", error);
    // Fallback Mock for Demo purposes if backend isn't running
    return [
      {
        id: 1,
        datetime: arrivalDate,
        total_slots: 120,
        total_occupied: 43,
        total_empty: 77,
      },
      {
        id: 2,
        datetime: arrivalDate,
        total_slots: 30,
        total_occupied: 13,
        total_empty: 17,
      },
    ];
  }
};

// --- GOOGLE MAPS EMBED ---
const RealMap = ({
  center,
  destination,
  selectedLot,
}: {
  center: { lat: number; lng: number };
  destination: Destination | null;
  selectedLot: ParkingLot | null;
}) => {
  if (!destination) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 text-center">
        <div className="p-8 rounded-xl bg-white shadow-xl">
          <MapPin size={32} className="mx-auto mb-2 text-indigo-400" />
          <p className="text-sm font-semibold">
            Select a destination to load the map.
          </p>
        </div>
      </div>
    );
  }

  // If a lot is selected, pin THAT lot. Otherwise pin the destination.
  const targetLat = selectedLot ? selectedLot.lat : center.lat;
  const targetLng = selectedLot ? selectedLot.lng : center.lng;

  // Using q=lat,lng places a marker at that spot.
  const embedSrc = `https://maps.google.com/maps?q=${targetLat},${targetLng}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="w-full h-full relative">
      <iframe
        width="100%"
        height="100%"
        frameBorder="0"
        allowFullScreen={false}
        referrerPolicy="no-referrer-when-downgrade"
        src={embedSrc}
        title="Map"
        className="rounded-none border-0 shadow-lg"
      ></iframe>

      {/* Overlay for map interaction hint */}
      <div className="absolute top-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white/90 backdrop-blur shadow-2xl rounded-2xl p-4 z-10 hidden md:block">
        <div className="flex items-center gap-3">
          <Move size={20} className="text-teal-500" />
          <p className="text-sm text-slate-600">
            {selectedLot
              ? `Showing location for ${selectedLot.name}`
              : "Map centered on destination"}
          </p>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTS ---

// 1. Slot Grid Visualization
const SlotGrid = ({ slots, total }: { slots: number[]; total: number }) => {
  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Live Visualization (
          {slots.length < total ? "Partial View" : "Full View"})
        </span>
        <div className="flex gap-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-teal-400"></div> Free
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-red-400"></div> Occupied
          </span>
        </div>
      </div>
      <div className="grid grid-cols-10 gap-1 p-3 bg-gray-50/50 rounded-xl border border-gray-100 max-h-40 overflow-y-auto">
        {slots.map((status, idx) => (
          <div
            key={idx}
            title={status === 1 ? "Occupied" : "Free"}
            className={cn(
              "h-3 w-full rounded-sm transition-all duration-300",
              status === 1 ? "bg-red-400/80" : "bg-teal-400/80"
            )}
          />
        ))}
      </div>
    </div>
  );
};

// 3. Main Application
export default function ParkingApp() {
  // State
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Destination[]>([]);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [arrivalTime, setArrivalTime] = useState(
    format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{
    msg: string;
    type: "info" | "warning";
  } | null>(null);
  const [debugData, setDebugData] = useState<any>(null);

  // Derived
  const selectedLot = useMemo(
    () => parkingLots.find((l) => l.id === selectedLotId),
    [selectedLotId, parkingLots]
  );

  // Handlers
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (val.length > 0) {
      const matches = MOCK_DESTINATIONS.filter((d) =>
        d.name.toLowerCase().includes(val.toLowerCase())
      );
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  };

  const selectDestination = (dest: Destination) => {
    setDestination(dest);
    setQuery(dest.name);
    setSuggestions([]);
    fetchLots(dest);
    setSelectedLotId(null);
  };

  const fetchLots = async (dest: Destination) => {
    setIsLoading(true);
    setParkingLots([]);
    try {
      const lots = await mockFetchParkingLots(dest.lat, dest.lng);
      setParkingLots(lots);
      setDebugData({ destination: dest, lots_count: lots.length });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLotSelect = (id: string) => {
    setSelectedLotId(id);
    updatePrediction(id);
  };

  const updatePrediction = async (forceId?: string) => {
    // Call the real API
    const apiData = await fetchRealPrediction(arrivalTime.replace("T", " ")); // Format: 2026-03-15 14:30

    // Update state with API data
    setParkingLots((prev) =>
      prev.map((lot) => {
        const backendData = apiData.find((d) => d.id === parseInt(lot.id));

        if (backendData) {
          // Regenerate visual slots to match new numbers
          const newSlots = Array(backendData.total_slots)
            .fill(0)
            .map((_, i) => (i < backendData.total_occupied ? 1 : 0))
            .sort(() => Math.random() - 0.5);

          const percent = Math.round(
            (backendData.total_occupied / backendData.total_slots) * 100
          );

          // Check for busy status
          if (
            (forceId === lot.id || selectedLotId === lot.id) &&
            percent > 90
          ) {
            setNotification({
              type: "warning",
              msg: `High demand at ${lot.name} (${percent}%).`,
            });
          }

          return {
            ...lot,
            predicted_percent: percent,
            total_slots: backendData.total_slots,
            slots: newSlots.length > 50 ? newSlots.slice(0, 50) : newSlots, // Limit visual grid size
          };
        }
        return lot;
      })
    );

    setDebugData({ api_response: apiData });
  };

  // Re-fetch when time changes
  useEffect(() => {
    if (destination) {
      updatePrediction();
    }
  }, [arrivalTime]);

  const openNav = (type: "google" | "waze") => {
    if (!selectedLot) return;
    const { lat, lng } = selectedLot;
    let arrivalTimeMs = new Date(arrivalTime).getTime();
    const url =
      type === "waze"
        ? `https://www.waze.com/ul?ll=${lat}%2C${lng}&navigate=yes&time=${arrivalTimeMs}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank");
    console.log("Opening navigation:", url);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* --- HEADER --- */}
      <header className="flex-none bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-teal-500 p-2 rounded-lg text-white">
            <Car size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-slate-900">
              YerTap.Az
            </h1>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
              Predictive Parking
            </p>
          </div>
        </div>
        <div className="hidden md:flex gap-2">
          <button
            onClick={() => setDebugData(selectedLot || debugData)}
            className="px-3 py-1 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition"
          >
            Debug Data
          </button>
        </div>
      </header>

      {/* --- MAIN LAYOUT --- */}
      <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
        {/* --- LEFT SIDEBAR --- */}
        <aside className="w-full md:w-[400px] flex-none bg-white z-20 shadow-xl flex flex-col h-[40vh] md:h-full transition-all order-2 md:order-1 relative">
          <div className="p-5 border-b border-slate-100 space-y-4 bg-white/50">
            <div className="relative z-50">
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                Destination
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-2.5 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  value={query}
                  onChange={handleSearch}
                  placeholder="Try 'Baku'..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all text-sm outline-none"
                />
              </div>
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => selectDestination(s)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm flex items-center gap-2 border-b border-slate-50 last:border-0"
                    >
                      <MapPin size={14} className="text-indigo-500" />
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                Arrival Time
              </label>
              <div className="relative">
                <Clock
                  className="absolute left-3 top-2.5 text-slate-400"
                  size={16}
                />
                <input
                  type="datetime-local"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all text-sm outline-none text-slate-600"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {!destination ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-6">
                <Navigation size={48} className="mb-4 text-slate-200" />
                <p className="text-sm">Select a destination.</p>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center py-10">
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-3 text-xs font-medium text-slate-500">
                  Loading data...
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Available Lots
                </h3>
                {parkingLots.map((lot) => (
                  <div
                    key={lot.id}
                    onClick={() => handleLotSelect(lot.id)}
                    className={cn(
                      "group p-4 rounded-2xl bg-white border transition-all cursor-pointer relative overflow-hidden",
                      selectedLotId === lot.id
                        ? "border-teal-500 shadow-teal-100 shadow-lg ring-1 ring-teal-500"
                        : "border-slate-100 hover:border-teal-200 hover:shadow-md"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-slate-800 text-sm">
                          {lot.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Navigation size={10} /> {lot.distance_m}m
                          </span>
                          <span className="flex items-center gap-1">
                            <Layers size={10} /> {lot.type}
                          </span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "px-2 py-1 rounded-lg text-xs font-bold",
                          lot.predicted_percent > 80
                            ? "bg-red-50 text-red-600"
                            : lot.predicted_percent > 50
                            ? "bg-yellow-50 text-yellow-600"
                            : "bg-teal-50 text-teal-600"
                        )}
                      >
                        {lot.predicted_percent}%
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </aside>

        {/* --- MAP AREA --- */}
        <section className="flex-1 relative order-1 md:order-2 h-[60vh] md:h-full">
          <RealMap
            center={
              destination
                ? { lat: destination.lat, lng: destination.lng }
                : { lat: 40.375, lng: 49.836 }
            }
            destination={destination}
            selectedLot={selectedLot || null}
          />

          {notification && (
            <div className="absolute top-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white/90 backdrop-blur shadow-2xl rounded-2xl p-4 z-[1000] border-l-4 border-l-orange-500 animate-in slide-in-from-top duration-300">
              <div className="flex gap-3">
                <div className="mt-1 text-orange-500">
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-bold text-slate-800">Alert</h5>
                  <p className="text-xs text-slate-600 mt-1">
                    {notification.msg}
                  </p>
                  <button
                    onClick={() => setNotification(null)}
                    className="mt-2 text-xs font-bold text-slate-500"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {debugData && (
            <div className="absolute bottom-4 right-4 hidden md:block max-w-xs bg-black/80 text-green-400 p-4 rounded-xl text-[10px] font-mono overflow-auto max-h-40 z-[999] backdrop-blur">
              <div className="flex justify-between mb-2 pb-1 border-b border-white/20">
                <span>API_DEBUG</span>
                <button
                  onClick={() => setDebugData(null)}
                  className="text-white hover:text-red-400"
                >
                  <X size={12} />
                </button>
              </div>
              <pre>{JSON.stringify(debugData, null, 2)}</pre>
            </div>
          )}
        </section>

        {/* --- DETAIL PANEL --- */}
        {selectedLot && (
          <div
            className="absolute md:relative z-[500] md:z-20 w-full md:w-[320px] h-full md:h-auto top-0 left-0 bg-white md:border-l border-slate-200 shadow-2xl transform transition-transform duration-300 flex flex-col md:translate-x-0"
            style={{
              transform: window.innerWidth < 768 ? "translateY(0)" : "none",
            }}
          >
            <div
              className="md:hidden flex justify-center pt-2 pb-1"
              onClick={() => setSelectedLotId(null)}
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <button
                onClick={() => setSelectedLotId(null)}
                className="hidden md:flex absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>

              <div className="mb-6">
                <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider rounded-md mb-2">
                  Selected
                </span>
                <h2 className="text-2xl font-bold text-slate-800 leading-tight">
                  {selectedLot.name}
                </h2>
                <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Navigation size={14} /> {selectedLot.distance_m}m away
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">
                    Predicted Load
                  </span>
                  <span className="text-xs text-slate-400">
                    {format(new Date(arrivalTime), "h:mm a")}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span
                    className={cn(
                      "text-3xl font-bold",
                      selectedLot.predicted_percent > 80
                        ? "text-red-500"
                        : selectedLot.predicted_percent > 50
                        ? "text-yellow-500"
                        : "text-teal-500"
                    )}
                  >
                    {selectedLot.predicted_percent}%
                  </span>
                  <span className="text-sm font-medium text-slate-600 mb-1">
                    Occupancy
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      selectedLot.predicted_percent > 80
                        ? "bg-red-500"
                        : selectedLot.predicted_percent > 50
                        ? "bg-yellow-500"
                        : "bg-teal-500"
                    )}
                    style={{ width: `${selectedLot.predicted_percent}%` }}
                  ></div>
                </div>
              </div>

              <SlotGrid
                slots={selectedLot.slots}
                total={selectedLot.total_slots}
              />

              <div className="mt-8 space-y-3">
                <button
                  onClick={() => openNav("waze")}
                  className="w-full py-3 px-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-semibold shadow-lg shadow-teal-200 transition flex items-center justify-center gap-2"
                >
                  <Navigation size={18} /> Open in Waze
                </button>
                <button
                  onClick={() => openNav("google")}
                  className="w-full py-3 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                >
                  <MapPin size={18} /> Open in Google Maps
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
