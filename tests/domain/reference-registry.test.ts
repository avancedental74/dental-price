import { describe, expect, it } from "vitest";
import { knowledgeForReference } from "../../src/domain/catalog";
describe("reference registry",()=>{
 it("keeps presentation semantics centralized",()=>{
  expect(knowledgeForReference("4910A3B")).toMatchObject({presentation:"Jeringa",quantity:3,unit:"g",variant:"Body",shade:"A3"});
  expect(knowledgeForReference("6020A3")).toMatchObject({presentation:"Jeringa",quantity:4,unit:"g",shade:"A3"});
  expect(knowledgeForReference("6021A3")).toMatchObject({presentation:"Cápsulas",quantity:0.2,unit:"g",packCount:20});
  expect(knowledgeForReference("56973")).toMatchObject({quantity:3.4,unit:"g",shade:"AO3"});
 });
});