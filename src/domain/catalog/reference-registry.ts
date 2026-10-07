export interface ReferenceKnowledge {
  presentation?:string;
  quantity?:number;
  unit?:string;
  packCount?:number;
  variant?:string;
  shade?:string;
}

const exact:Record<string,ReferenceKnowledge>={
  "4242":{presentation:"Frasco",quantity:6,unit:"ml",packCount:1},
  "41294":{presentation:"Frasco",quantity:5,unit:"ml",packCount:1},
  "56971":{presentation:"Jeringa",quantity:3.4,unit:"g",packCount:1,shade:"Translucido"},
  "56972":{presentation:"Jeringa",quantity:3.4,unit:"g",packCount:1,shade:"A1"},
  "56973":{presentation:"Jeringa",quantity:3.4,unit:"g",packCount:1,shade:"AO3"},
  "56974":{presentation:"Jeringa",quantity:3.4,unit:"g",packCount:1,shade:"WO"}
};

export function knowledgeForReference(ref?:string):ReferenceKnowledge{
  if(!ref) return {};
  if(exact[ref]) return exact[ref];

  const xte=ref.match(/^4910([A-Z]+\d(?:\.5)?)([BDE])$/i);
  if(xte){
    const opacity=xte[2].toUpperCase();
    return {presentation:"Jeringa",quantity:3,unit:"g",packCount:1,variant:opacity==="B"?"Body":opacity==="D"?"Dentin":"Enamel",shade:xte[1].toUpperCase()};
  }
  const z250Syringe=ref.match(/^6020([A-Z]\d(?:\.5)?)$/i);
  if(z250Syringe) return {presentation:"Jeringa",quantity:4,unit:"g",packCount:1,shade:z250Syringe[1].toUpperCase()};

  const z250Capsule=ref.match(/^6021([A-Z]\d(?:\.5)?|UD)$/i);
  if(z250Capsule) return {presentation:"Cápsulas",quantity:0.2,unit:"g",packCount:20,variant:"Capsule",shade:z250Capsule[1].toUpperCase()};

  const universal=ref.match(/^6555(A1|A2|A3|A3\.5|A4|B1|B2|D3|XW|PO)$/i);
  if(universal) return {presentation:"Jeringa",quantity:4,unit:"g",packCount:1,shade:universal[1].toUpperCase()};

  return {};
}
