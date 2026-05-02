// Real, currently-published spaces from the production DB. Used as a fallback
// across the homepage, stay-plans page, and search page so visitors never see
// an empty grid if the API is briefly unreachable. Clicking any of these
// resolves to a real /spaces/:id detail page.

export interface FallbackSpace {
  id: number;
  name: string;
  space_type: string;
  booking_mode: string | null;
  max_occupancy: number | null;
  base_weekly_price: string | null;
  base_currency: string | null;
  min_stay_weeks: number | null;
  description: string | null;
  status: string;
  property_id: number | null;
  parent_space_id: number | null;
  property_name: string | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  latitude: string | null;
  longitude: string | null;
  primary_image: string;
  primary_thumbnail: string;
  suburb_name: string;
  suburb_id: number | null;
}

const make = (
  id: number,
  name: string,
  suburb: string,
  price: number,
  spaceType: string,
  image: string,
): FallbackSpace => ({
  id,
  name,
  space_type: spaceType,
  booking_mode: "Standard",
  max_occupancy: spaceType === "EntireSpace" ? 4 : 2,
  base_weekly_price: String(price),
  base_currency: "AUD",
  min_stay_weeks: 4,
  description: null,
  status: "Active",
  property_id: null,
  parent_space_id: null,
  property_name: null,
  property_address: null,
  property_city: "Melbourne",
  property_state: "VIC",
  latitude: null,
  longitude: null,
  primary_image: image,
  primary_thumbnail: image,
  suburb_name: suburb,
  suburb_id: null,
});

export const FALLBACK_SPACES: FallbackSpace[] = [
  make(9,  "118 Kavanagh St, Southbank — Entire Apartment",      "Southbank",      850,  "EntireSpace", "https://res.cloudinary.com/dthc3gmdr/image/upload/v1775402723/millionstay/spaces/uvmozsogqq5jkyvt420u.jpg"),
  make(23, "250 City Rd, Southbank — Entire Apartment",          "Southbank",      1020, "EntireSpace", "https://res.cloudinary.com/dthc3gmdr/image/upload/v1775403198/millionstay/spaces/oeyqoey8gbpmnq3uhe6n.jpg"),
  make(4,  "285 La Trobe St, Melbourne — Entire Apartment",      "Melbourne CBD",  1100, "EntireSpace", "https://res.cloudinary.com/dthc3gmdr/image/upload/v1775878116/millionstay/spaces/4/bc3o5lp2vj1xsewdu4ga.jpg"),
  make(17, "336 Russell St, Melbourne — Entire Apartment",       "Melbourne CBD",  1040, "EntireSpace", "https://res.cloudinary.com/dthc3gmdr/image/upload/v1775460087/millionstay/spaces/hwse0na7bll7umaa6eac.jpg"),
  make(12, "139 Bourke St, Melbourne — Entire Apartment",        "Melbourne CBD",  980,  "EntireSpace", "https://res.cloudinary.com/dthc3gmdr/image/upload/v1775867111/millionstay/spaces/aqzwfvixub7ion0xjbv0.jpg"),
  make(28, "53 Batman St, West Melbourne — Entire Apartment",    "West Melbourne", 790,  "EntireSpace", "https://res.cloudinary.com/dthc3gmdr/image/upload/v1775835112/millionstay/spaces/bx6m4sw50uyqfizvgfud.jpg"),
  make(3,  "Fitzroy Studio Apartments — Studio A",               "Fitzroy",        600,  "EntireSpace", "https://res.cloudinary.com/dthc3gmdr/image/upload/v1775878111/millionstay/spaces/3/zbgpnnpuo1pyobhrscgx.jpg"),
];
