import { readFile } from "node:fs/promises";
import { fetchDvdProduct } from "../src/connectors/dvd-dental";
import { matchOfferToProduct } from "../src/domain/matching/matcher";
import type { CanonicalProduct } from "../src/types/domain";
const products=JSON.parse(await readFile("data/products.json","utf8")) as CanonicalProduct[];
const product=products.find(p=>p.id==="scotchbond-universal-plus-41294");
if(!product) throw new Error("missing product");
const result=await fetchDvdProduct("https://www.dvd-dental.com/adhesivo-scotchbond-universal-plus-5ml/");
console.log(JSON.stringify({raw:result.raw,offers:result.offers,matches:result.offers.map(o=>matchOfferToProduct(product,o))},null,2));