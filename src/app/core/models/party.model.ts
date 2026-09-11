export type PartyType = 'supplier' | 'customer';

export interface Party {
  id: number;
  party_type: PartyType;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  state: string | null;
  state_code: string | null;
}
