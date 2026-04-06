import { useEffect, useRef, useCallback } from "react";
import type { Map as LeafletMap, Marker, Popup } from "leaflet";

interface SpaceMapItem {
  id: number | string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  base_weekly_price: number;
  suburb_name?: string | null;
  primary_image?: string | null;
  primary_thumbnail?: string | null;
  space_type?: string;
  min_contract_period?: number | null;
}

interface SpaceMapProps {
  spaces: SpaceMapItem[];
  hoveredId?: number | string | null;
  selectedId?: number | string | null;
  onMarkerHover?: (id: number | string | null) => void;
  onMarkerClick?: (id: number | string) => void;
  className?: string;
}

export function SpaceMap({
  spaces,
  hoveredId,
  selectedId,
  onMarkerHover,
  onMarkerClick,
  className = "",
}: SpaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, { marker: Marker; popup: Popup }>>(new Map());

  const getMarkerHtml = useCallback(
    (price: number, isActive: boolean) => `
    <div style="
      background: ${isActive ? "#F97316" : "#ffffff"};
      color: ${isActive ? "#ffffff" : "#1a1a1a"};
      border: 2px solid ${isActive ? "#ea6600" : "#F97316"};
      border-radius: 20px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      cursor: pointer;
      transition: all 0.15s ease;
    ">$${price}/wk</div>
  `,
    []
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let L: typeof import("leaflet");

    const initMap = async () => {
      L = await import("leaflet");

      if (!containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [-37.8136, 144.9631],
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      addMarkers(L, map, spaces);
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current.clear();
      }
    };
  }, []);

  const addMarkers = (L: typeof import("leaflet"), map: LeafletMap, items: SpaceMapItem[]) => {
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    const validSpaces = items.filter((s) => s.latitude != null && s.longitude != null);
    if (validSpaces.length === 0) return;

    validSpaces.forEach((space) => {
      const icon = L.divIcon({
        className: "",
        html: getMarkerHtml(space.base_weekly_price, false),
        iconAnchor: [30, 12],
      });

      const marker = L.marker([space.latitude!, space.longitude!], { icon });

      const photoUrl = space.primary_thumbnail ?? space.primary_image ?? "";
      const popupContent = `
        <div style="width:220px;font-family:Inter,sans-serif;border-radius:10px;overflow:hidden">
          ${photoUrl ? `<img src="${photoUrl}" style="width:100%;height:120px;object-fit:cover;display:block" />` : `<div style="width:100%;height:80px;background:linear-gradient(135deg,#fed7aa,#fef3c7);display:flex;align-items:center;justify-content:center;font-size:28px">🏠</div>`}
          <div style="padding:10px">
            <div style="font-weight:700;font-size:13px;line-height:1.3;margin-bottom:2px;color:#111">${space.name}</div>
            <div style="color:#888;font-size:11px;margin-bottom:8px">${space.suburb_name ? `${space.suburb_name}, VIC` : "Melbourne, VIC"}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <span style="font-weight:700;font-size:14px;color:#111">$${space.base_weekly_price}<span style="font-size:11px;font-weight:400;color:#888">/wk</span></span>
              ${space.min_contract_period ? `<span style="font-size:11px;color:#888">Min ${space.min_contract_period}wks</span>` : ""}
            </div>
            <a href="/spaces/${space.id}" style="display:block;text-align:center;background:#F97316;color:#fff;border-radius:7px;padding:7px 0;font-size:12px;font-weight:700;text-decoration:none">View Details →</a>
          </div>
        </div>
      `;

      const popup = L.popup({ maxWidth: 220, offset: [0, -8] }).setContent(popupContent);

      marker.bindPopup(popup);
      marker.on("click", () => {
        onMarkerClick?.(space.id);
      });
      marker.on("mouseover", () => {
        onMarkerHover?.(space.id);
      });
      marker.on("mouseout", () => {
        onMarkerHover?.(null);
      });

      marker.addTo(map);
      markersRef.current.set(String(space.id), { marker, popup });
    });

    if (validSpaces.length > 0) {
      const bounds = L.latLngBounds(validSpaces.map((s) => [s.latitude!, s.longitude!]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      addMarkers(L, mapRef.current!, spaces);
    });
  }, [spaces]);

  useEffect(() => {
    import("leaflet").then((L) => {
      markersRef.current.forEach(({ marker }, id) => {
        const isActive = id === String(hoveredId) || id === String(selectedId);
        const space = spaces.find((s) => String(s.id) === id);
        if (!space) return;
        const icon = L.divIcon({
          className: "",
          html: getMarkerHtml(space.base_weekly_price, isActive),
          iconAnchor: [30, 12],
        });
        marker.setIcon(icon);
        if (isActive) marker.setZIndexOffset(1000);
        else marker.setZIndexOffset(0);
      });
    });
  }, [hoveredId, selectedId, spaces]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{ minHeight: 400 }}
    />
  );
}
