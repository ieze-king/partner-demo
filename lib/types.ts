/** A listing as the Getpropool Partner API returns it (GET /properties/{id}, and inside webhooks). */
export interface Listing {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  listingType: 'rent' | 'sale' | 'shortlet' | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: boolean | null;
  neighbourhoodName: string | null;
  city: string;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrls: string[];
  thumbUrls?: string[];
  features?: string[];
  /** Older flag; not reliable for listings. Use `available`. */
  hasVacancy: boolean;
  /** Every listing partners receive is on the market */
  available?: boolean;
  availableUnits: number | null;
  organization: { id: string; name: string; verified: boolean } | null;
  variants?: { id: string; title: string; description: string | null; price: number | null; bedrooms: number | null; availableUnits: number | null }[];
  enquiriesOpen: boolean;
  updatedAt: string;
}

export interface Enquiry {
  id: string;
  reference: string | null;
  propertyId: string;
  headline: string;
  buyerName: string | null;
  status: 'waiting' | 'available' | 'unavailable' | 'expired' | 'withdrawn';
  listerName: string | null;
  listerReply: string | null;
  listerWhatsapp: string | null;
  createdAt: string;
  respondedAt: string | null;
}

/** What the demo shows in its live activity panel. */
export interface ActivityItem {
  event: string;
  id: string;
  title: string | null;
  sentAt: string | null;
  receivedAt: string;
  /** Milliseconds between Getpropool sending the webhook and this site receiving it */
  delayMs: number | null;
}
