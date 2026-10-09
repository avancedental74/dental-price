import {describe,expect,it} from "vitest";
import {mergeDiscoveryState,type OfflineDiscoveryState} from "../../scripts/discovery-lib";

const previous:OfflineDiscoveryState={
  generatedAt:"2026-10-01T00:00:00.000Z",
  sources:[],
  products:[{
    supplierId:"dentalboom",
    productUrl:"https://dentalboom.com/shop/composites/old/",
    rawName:"Old composite",
    normalizedName:"old composite",
    firstSeenAt:"2026-10-01T00:00:00.000Z",
    lastSeenAt:"2026-10-01T00:00:00.000Z",
    source:"store-api",
    sourceUrl:"https://dentalboom.com/wp-json/wc/store/v1/products?page=1",
    discoveryStatus:"active",
    detailStatus:"fetched"
  }]
};

describe("offline discovery index state",()=>{
  it("adds new products while preserving first seen dates for known URLs",()=>{
    const next=mergeDiscoveryState(previous,[{
      supplierId:"dentalboom",
      productUrl:"https://dentalboom.com/shop/composites/old/",
      rawName:"Old composite updated",
      source:"store-api",
      sourceUrl:"https://dentalboom.com/wp-json/wc/store/v1/products?page=1",
      detailStatus:"fetched"
    },{
      supplierId:"dentalboom",
      productUrl:"https://dentalboom.com/shop/composites/new/",
      rawName:"New composite",
      manufacturerReference:"ABC123",
      source:"store-api",
      sourceUrl:"https://dentalboom.com/wp-json/wc/store/v1/products?page=1",
      detailStatus:"fetched"
    }],[{
      supplierId:"dentalboom",
      source:"woocommerce-store-api",
      sourceUrl:"https://dentalboom.com/wp-json/wc/store/v1/products",
      fetchedAt:"2026-10-02T00:00:00.000Z",
      status:"ok",
      scope:"partial",
      discovered:2
    }],"2026-10-02T00:00:00.000Z");

    expect(next.products).toHaveLength(2);
    expect(next.products.find(product=>product.rawName==="Old composite updated")?.firstSeenAt).toBe("2026-10-01T00:00:00.000Z");
    expect(next.products.find(product=>product.rawName==="New composite")?.manufacturerReference).toBe("ABC123");
  });

  it("marks unseen products stale, not retired, after partial discovery",()=>{
    const next=mergeDiscoveryState(previous,[],[{
      supplierId:"dentalboom",
      source:"woocommerce-store-api",
      sourceUrl:"https://dentalboom.com/wp-json/wc/store/v1/products",
      fetchedAt:"2026-10-02T00:00:00.000Z",
      status:"ok",
      scope:"partial",
      discovered:0
    }],"2026-10-02T00:00:00.000Z");

    expect(next.products[0].discoveryStatus).toBe("stale");
  });

  it("marks unseen products retired only after a successful full source pass",()=>{
    const next=mergeDiscoveryState(previous,[],[{
      supplierId:"dentalboom",
      source:"woocommerce-store-api",
      sourceUrl:"https://dentalboom.com/wp-json/wc/store/v1/products",
      fetchedAt:"2026-10-02T00:00:00.000Z",
      status:"ok",
      scope:"full",
      discovered:0
    }],"2026-10-02T00:00:00.000Z");

    expect(next.products[0].discoveryStatus).toBe("retired");
  });
});
