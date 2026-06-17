
export interface Product {
  name: string;
  weights: { [key: string]: string }; // e.g. { '25': '25KG', '30': '30KG' }
}

export const productData: Product[] = [
  { name: 'TDH URAD GOTA 1 KG', weights: { '1': '1KG' } },
  { name: 'TDH URAD GOTA (PER 1 KG)', weights: { '1': '1KG'} },
  { name: 'TDH URAD SPLIT DALL (1KG)', weights: { '1': '1KG' } },
  { name: 'TDH URAD SPLIT DALL (PER 1 KG)', weights: { '1': '1KG'} },
  { name: 'MAHARANI URAD GOTA (1KG)', weights: { '1': '1KG' } },
  { name: 'MAHARANI URAD GOTA (PER 1 KG)', weights: { '1': '1KG'} },
  { name: 'POTTU PAPPU (1KG)', weights: { '1': '1KG' } },
  { name: 'POTTU PAPPU (PER 1 KG)', weights: { '1': '1KG' } },
  { name: 'BLACK GRAM (1KG)', weights: { '1': '1KG' } },
  { name: 'BLACK GRAM (PER 1 KG)', weights: { '1': '1KG' } },
  { name: 'TDH TOOR DALL (new) (1KG)', weights: { '1': '1KG' } },
  { name: 'TDH TOOR DALL (new) (PER 1 KG)', weights: { '1': '1KG' } },
  { name: 'TDH MASOOR DALL (1KG)', weights: { '1': '1KG' } },
  { name: 'TDH MASOOR DALL (PER 1 KG)', weights: { '1': '1KG' } },
  { name: 'MOONG DALL (500 Grms)', weights: { '0.5': '0.5KG' } },
  { name: 'MOONG DALL (PER 1 KG)', weights: { '1': '1KG' } },
  { name: 'TDH MOONG CHILKA DALL (1KG)', weights: { '1': '1KG' } },
  { name: 'TDH MOONG CHILKA DALL (PER 1 KG)', weights: { '1': '1KG' } },
  { name: 'TDH MOONG WHOLE (1KG)', weights: { '1': '1KG' } },
  { name: 'TDH MOONG WHOLE (PER 1 KG)', weights: { '1': '1KG' } },
  { name: 'TDH DESI CHANNA (1KG)', weights: { '1': '1KG' } },
  { name: 'TDH DESI CHANNA (PER 1 KG)', weights: { '1': '1KG' } },
  { name: 'CHANNA DALL (500 Grms)', weights: { '0.5': '0.5KG' } },
  { name: 'CHANNA DALL (PER 1 KG)', weights: { '1': '1KG' } },
  { name: 'TDH KABULI CHANNA (1KG)', weights: { '1': '1KG' } },
  { name: 'TDH KABULI CHANNA (PER 1 KG)', weights: { '1': '1KG' } },
  { name: 'IDLY RAVVA (1KG)', weights: { '1': '1KG' } },
  { name: 'IDLY RAVVA (PER 1 KG)', weights: { '1': '1KG' } },
  { name: 'FRIED GRAM DALL 500 Grams', weights: { '0.5': '0.5KG' } },
  { name: 'FRIED GRAM DALL (PER 1 KG)', weights: { '1': '1KG' } },
  { name: 'TDH GROUNDNUTS (1KG)', weights: { '1': '1KG' } },
  { name: 'TDH GROUNDNUTS (PER 1 KG)', weights: { '1': '1KG' } },
];
