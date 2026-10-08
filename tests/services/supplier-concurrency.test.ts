import {describe,it,expect} from "vitest";
import {mapWithConcurrency} from "../../src/services/supplier-concurrency";

describe("bounded live supplier concurrency",()=>{
 it("never opens more than two active supplier requests and preserves result order",async()=>{
  let active=0,peak=0;
  const values=await mapWithConcurrency([1,2,3,4,5,6,7],async value=>{
    active++;
    peak=Math.max(peak,active);
    await new Promise(resolve=>setTimeout(resolve,value%2?4:1));
    active--;
    return value*2;
  },2);
  expect(peak).toBeLessThanOrEqual(2);
  expect(peak).toBe(2);
  expect(values).toEqual([2,4,6,8,10,12,14]);
 });
 it("handles empty source list without opening any connections",async()=>{
  const result=await mapWithConcurrency([],async()=>1);
  expect(result).toEqual([]);
 });
});