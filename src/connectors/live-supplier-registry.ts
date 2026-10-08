export const liveAutomaticSupplierIds=[
  "dentaltix",
  "dentalcost",
  "dvd-dental",
  "dentalexpress",
  "ortolan",
  "dentipak",
  "dentalboom"
] as const;

export const browserProtectedSupplierIds=[
  "proclinic",
  "dental-iberica",
  "brokerdental"
] as const;

export const allSearchSupplierIds=[
  ...liveAutomaticSupplierIds,
  ...browserProtectedSupplierIds
] as const;

export type SearchSupplierId=typeof allSearchSupplierIds[number];

export const supplierLabels:Record<SearchSupplierId,string>={
  dentaltix:"Dentaltix",
  dentalcost:"DentalCost",
  "dvd-dental":"DVD Dental",
  dentalexpress:"Dental Express",
  ortolan:"Ortolan",
  dentipak:"Dentipak",
  dentalboom:"Dental Boom",
  proclinic:"Proclinic",
  "dental-iberica":"Dental Ibérica",
  brokerdental:"Broker Dental"
};
