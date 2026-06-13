"use client";

import type { EmployerRow } from "@/components/community-partners-workspace";
import { employerStatusLabel } from "@/lib/employer-constants";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";

type Props = {
  employers: EmployerRow[];
};

const DEFAULT_CENTER: [number, number] = [-83.5, 33.0];
const DEFAULT_ZOOM = 6;

function hasCoords(
  employer: EmployerRow
): employer is EmployerRow & { latitude: number; longitude: number } {
  return (
    typeof employer.latitude === "number" &&
    typeof employer.longitude === "number" &&
    Number.isFinite(employer.latitude) &&
    Number.isFinite(employer.longitude)
  );
}

function statusMarkerColor(status: string): string {
  if (status === "active") return "#2d6a4f";
  if (status === "prospect") return "#c9a227";
  if (status === "pending_review") return "#b45309";
  return "#737373";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function popupHtml(employer: EmployerRow): string {
  const location = [employer.city, employer.state].filter(Boolean).join(", ");
  const detailUrl = `/dashboard/community-partners/${employer.id}`;
  return `
    <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.4;">
      <p style="margin: 0 0 4px; font-weight: 600;">${escapeHtml(employer.name)}</p>
      <p style="margin: 0 0 8px; color: #555;">
        ${escapeHtml(employerStatusLabel(employer.status))}${location ? ` · ${escapeHtml(location)}` : ""}
      </p>
      <a href="${detailUrl}" style="color: #2d6a4f; font-weight: 500; text-decoration: underline;">View details</a>
    </div>
  `;
}

export function CommunityPartnersMap({ employers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const mappable = employers.filter(hasCoords);
  const missingCount = employers.length - mappable.length;

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current) return;

      setLoading(true);
      setMapError(null);

      const res = await fetch("/api/community-partners/map-config");
      const data = (await res.json()) as {
        configured?: boolean;
        token?: string;
        error?: string;
      };

      if (cancelled) return;

      if (!res.ok || !data.configured || !data.token) {
        setMapError(
          data.error ??
            "Map is not configured. Set MAPBOX_ACCESS_TOKEN in your environment."
        );
        setLoading(false);
        return;
      }

      mapboxgl.accessToken = data.token;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;

        const plotted = employers.filter(hasCoords);

        for (const employer of plotted) {
          const el = document.createElement("div");
          el.className = "h-3.5 w-3.5 rounded-full border-2 border-white shadow-md";
          el.style.backgroundColor = statusMarkerColor(employer.status);

          const popup = new mapboxgl.Popup({ offset: 12, maxWidth: "260px" }).setHTML(
            popupHtml(employer)
          );

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([employer.longitude, employer.latitude])
            .setPopup(popup)
            .addTo(map);

          markersRef.current.push(marker);
        }

        if (plotted.length === 1) {
          map.flyTo({
            center: [plotted[0].longitude, plotted[0].latitude],
            zoom: 12,
          });
        } else if (plotted.length > 1) {
          const bounds = new mapboxgl.LngLatBounds();
          for (const employer of plotted) {
            bounds.extend([employer.longitude, employer.latitude]);
          }
          map.fitBounds(bounds, { padding: 48, maxZoom: 12 });
        }

        setLoading(false);
      });
    }

    void initMap();

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [employers]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-brand-black/70">
        {mappable.length} of {employers.length} partner
        {employers.length === 1 ? "" : "s"} on the map
        {missingCount > 0
          ? ` (${missingCount} missing coordinates — add or update an address to place them)`
          : ""}
        .
      </p>

      {mapError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {mapError}
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
          {loading ? (
            <p className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm text-brand-black/60">
              Loading map…
            </p>
          ) : null}
          <div ref={containerRef} className="h-[min(70vh,560px)] w-full" />
        </div>
      )}
    </div>
  );
}
