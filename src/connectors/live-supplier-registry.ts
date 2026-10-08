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
