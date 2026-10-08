/**
 * Bounded concurrent supplier calls. Fast / healthy shops should not be
 * penalized by a burst of requests that overwhelms a shared Worker.
 */
export async function mapWithConcurrency<T,U>(
  inputs:readonly T[],task:(input:T,index:number)=>Promise<U>,limit=2
):Promise<U[]>{
  const count=Math.max(1,Math.floor(limit));
  const results=new Array<U>(inputs.length);
  let next=0;
  const runners=Array.from({length:Math.min(count,inputs.length)},async()=>{
    while(next<inputs.length){
      const index=next++;
      results[index]=await task(inputs[index]!,index);
    }
  });
  await Promise.all(runners);
  return results;
}
