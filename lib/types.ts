export type QualityTier = 'perfect' | 'high' | 'mid' | 'low' | 'starter' | 'unknown';
export type ListingStatus = 'listed' | 'bumped' | 'price_edited' | 'pending' | 'sold' | 'closed' | 'expired';
export type ObsConfidence = 'ask_stale' | 'ask_observed' | 'sold_price_unknown' | 'fill_confirmed';

export interface Item {
  id: number; slug: string; name: string; category: string; roll_axes: string[];
}
export interface FmvRow {
  item_id: number; tier: QualityTier; n: number; freshest: string;
  bid: number | null; mid: number | null; ask: number | null;
}
export interface ListingItemRow {
  id: number; listing_id: number; item_id: number; item_slug: string; item_name: string;
  tier: QualityTier; asking_price: number | null; asking_currency: string | null;
  asking_price_fg: number | null; status: ListingStatus; url: string | null;
  username: string | null; last_seen: string;
}
export interface SnipeRow extends ListingItemRow {
  bid: number | null; price_ratio: number | null;
}
export interface IsoRow {
  id: number; item_id: number; item_slug: string; item_name: string;
  tier_min: QualityTier | null; max_price_fg: number | null; status: string;
  observed_at: string; url: string | null; i_own?: boolean;
}
export interface InventoryRow {
  id: number; item_id: number; item_slug: string; item_name: string; tier: QualityTier;
  qty: number; acquired_cost_fg: number | null; notes: string | null;
  bid: number | null; mid: number | null; liq_value: number | null; unrealized_fg: number | null;
}
export interface ExchangeRow {
  base_code: string; best_ask: number | null; best_bid: number | null;
  spread: number | null; crossed: boolean;
}
