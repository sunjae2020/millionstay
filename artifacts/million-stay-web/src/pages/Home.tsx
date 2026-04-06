import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, MapPin, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import SpaceCard from "@/components/SpaceCard";
import { listSpaces } from "@/lib/api";

const POPULAR_CITIES = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"];
const SPACE_TYPES = ["Studio", "SingleRoom", "DoubleRoom", "Suite", "Apartment", "Office"];

export default function Home() {
  const [city, setCity] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["spaces", city, minPrice, maxPrice],
    queryFn: () =>
      listSpaces({
        city: city || undefined,
        min_price: minPrice ? Number(minPrice) : undefined,
        max_price: maxPrice ? Number(maxPrice) : undefined,
      }),
  });

  function handleSearch() {
    setCity(cityInput.trim());
  }

  function clearFilters() {
    setCity("");
    setCityInput("");
    setMinPrice("");
    setMaxPrice("");
  }

  const spaces = data?.data ?? [];
  const hasFilters = !!city || !!minPrice || !!maxPrice;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-orange-50 via-white to-orange-50/30 pt-12 pb-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            Find Your Perfect{" "}
            <span className="text-primary">Stay</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Premium furnished rooms and spaces across Australia.
            Monthly and weekly options available.
          </p>

          {/* Search Bar */}
          <div className="flex gap-2 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by city (e.g. Melbourne, Sydney)..."
                className="pl-9 h-11 bg-white shadow-sm"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} className="h-11 px-6 bg-primary hover:bg-primary/90">
              Search
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-3 flex flex-wrap gap-3 justify-center max-w-2xl mx-auto">
              <div className="flex items-center gap-2 bg-white rounded-lg border px-3 py-2 shadow-sm">
                <span className="text-xs font-medium text-muted-foreground">Min $</span>
                <Input
                  type="number"
                  placeholder="0"
                  className="w-20 h-7 border-0 p-0 text-sm focus-visible:ring-0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">— Max $</span>
                <Input
                  type="number"
                  placeholder="Any"
                  className="w-20 h-7 border-0 p-0 text-sm focus-visible:ring-0"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">/wk</span>
              </div>
            </div>
          )}

          {/* Quick city filters */}
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {POPULAR_CITIES.map((c) => (
              <button
                key={c}
                onClick={() => { setCity(c); setCityInput(c); }}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  city === c
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-muted-foreground hover:text-foreground border-border"
                }`}
              >
                <MapPin className="inline w-3 h-3 mr-1" />
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">
              {isLoading ? (
                "Loading spaces..."
              ) : hasFilters ? (
                `${spaces.length} space${spaces.length !== 1 ? "s" : ""} found`
              ) : (
                `${spaces.length} available spaces`
              )}
            </h2>
            {city && (
              <p className="text-sm text-muted-foreground mt-0.5">
                in <span className="font-medium text-foreground">{city}</span>
              </p>
            )}
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-3.5 h-3.5 mr-1" />
              Clear filters
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-muted-foreground">
            Failed to load spaces. Please try again.
          </div>
        ) : spaces.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold mb-2">No spaces found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or clearing filters.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {spaces.map((space) => (
              <SpaceCard key={space.id} space={space} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
