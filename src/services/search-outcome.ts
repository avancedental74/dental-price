export type SupplierCoverageStatus="results"|"no_match"|"partial"|"error";
export interface SupplierCoverage {
  supplierId:string;
  offers:number;
  candidateLimitReached:boolean;
  queries:number;
  partialErrors:number;
  status:SupplierCoverageStatus;
}
export type CatalogOutcome="results"|"partial_results"|"no_match"|"partial_failure"|"all_failed"|"unavailable";
export function evaluateCatalogOutcome(groupsCount:number,coverage:SupplierCoverage[]):CatalogOutcome{
  if(groupsCount>0)return coverage.some(x=>x.status==="error"||x.status==="partial"||x.partialErrors>0)?"partial_results":"results";
  if(!coverage.length)return "unavailable";
  const failed=coverage.filter(x=>x.status==="error"||x.partialErrors>0).length;
  const partial=coverage.filter(x=>x.status==="partial").length;
  if(failed===coverage.length)return "all_failed";
  if(failed>0||partial>0||coverage.some(x=>x.status==="results"))return "partial_failure";
  return "no_match";
}
