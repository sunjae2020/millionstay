import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AdminLayout from "@/components/admin-layout";
import { Camera, Home } from "lucide-react";

import { getApiBase } from "@/lib/api-base";
const API = getApiBase();
const ADMIN_KEY = "ms_admin_key";
function getKey() { return localStorage.getItem(ADMIN_KEY) ?? ""; }

type Space = {
  id: number; name: string; spaceType: string; baseWeeklyPrice: string;
  status: string; isActive: boolean; propertyName: string; suburbName: string;
  thumbnailUrl: string | null;
};

export default function AdminSpaces() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const key = getKey();
    if (!key) { setLocation("/admin"); return; }
    fetch(`${API}/api/v1/admin/spaces`, { headers: { "x-admin-api-key": key } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setSpaces(d.data); })
      .finally(() => setLoading(false));
  }, [setLocation]);

  return (
    <AdminLayout>
      <div className="p-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Spaces</h1>
            <p className="text-gray-500 text-sm mt-0.5">{spaces.length} listed spaces</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="bg-white rounded-2xl border h-64 animate-pulse" />)}
          </div>
        ) : spaces.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No spaces found</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map((space) => (
              <div key={space.id} className="bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-video bg-gray-100 relative">
                  {space.thumbnailUrl ? (
                    <img src={space.thumbnailUrl} alt={space.name}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Home className="h-10 w-10" />
                    </div>
                  )}
                  <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    space.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {space.status}
                  </span>
                </div>

                <div className="p-4">
                  <p className="font-semibold text-gray-800 truncate">{space.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5 truncate">{space.propertyName} · {space.suburbName}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <span className="text-primary font-bold">${Number(space.baseWeeklyPrice).toLocaleString()}</span>
                      <span className="text-gray-400 text-xs">/wk</span>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {space.spaceType}
                    </span>
                  </div>

                  <a
                    href={`/spaces/${space.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-2 w-full justify-center border rounded-xl py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary transition-colors"
                  >
                    <Camera className="h-3.5 w-3.5" /> View Space
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
