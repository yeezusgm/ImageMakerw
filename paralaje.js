import {paintDepthBand} from './planos-decorado.js';

export const parallaxModes=['auto','normal','suave','fijo'];
export function effectiveParallax(mode,reduced=false){
  if(mode==='normal'||mode==='suave'||mode==='fijo')return mode;
  return reduced?'fijo':'normal';
}
export function parallaxStrength(mode,reduced=false){
  const active=effectiveParallax(mode,reduced);
  return active==='fijo'?0:active==='suave'?.38:1;
}
// The tracking camera can sit against a level boundary while Tom is already
// walking. Add a little of his movement *inside* the frame, but never in a
// locked arena or on the title screen. Pausing leaves the same anchor in place.
export function scenicFocus(cx,cy,player,track){
  if(!track)return {x:cx,y:cy};
  const bound=(x,limit)=>Math.max(-limit,Math.min(limit,x));
  return {x:cx+.42*bound(player.x-cx,5),y:cy+.34*bound(player.y+2-cy,3)};
}
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>(x=clamp(x),x*x*(3-2*x));

// Travel measures the unshaken exploration focus, never a sprite animation,
// recoil, or elapsed time. Changing a preference while paused preserves the view.
export function createPanTravel(originX=0,originY=2.6){
  let px,py;
  const state={x:0,y:0,amount:1,cut:0};
  return {sample(x,y,amount=1,cut=false){
    if(px===undefined||cut||Math.abs(x-px)>14||Math.abs(y-py)>12){
      state.x=(x-originX)*amount;state.y=(y-originY)*amount;state.cut++;
    }else{state.x+=(x-px)*amount;state.y+=(y-py)*amount;}
    px=x;py=y;state.amount=amount;
    return state;
  }};
}

// Distinct world speeds for the horizon, painted ruins and the two silhouette
// layers. Horizontal UVs repeat at the edges; vertical UVs never leave the art.
export const plates={
  sky:        {speed:.24,lift:.15,phase:.51,height:12.4},
  eclipse:    {speed:.21,lift:.13,phase:.36,height:12.4},
  cavern:     {speed:.25,lift:.16,phase:.66,height:12.3},
  skylight:   {speed:.28,lift:.17,phase:.30,height:12.3},
  grotto:     {speed:.37,lift:.23,phase:.66,height:12.1},
  marshSky:   {speed:.18,lift:.12,phase:.52,height:13.4},
  abbey:      {speed:.33,lift:.19,phase:.51,height:13.2},
  middle:     {speed:.56,lift:.30,phase:.43,span:31,window:.86},
  near:       {speed:.90,lift:.45,phase:.37,span:24,window:.86}
};
export function framePlate(mesh,cx,cy,vw,vh,travel,spec,aspect=1){
  const w=vw*1.035,h=vh*1.045,texture=mesh.material.map;
  const fullH=spec.span?h/spec.window:Math.max(spec.height,h*1.16);
  const span=spec.span||fullH*aspect;
  const u=w/span,v=h/fullH,margin=1-v;
  // Keep the current landmark under the same screen coordinate on resize,
  // while each world unit walked always moves the image by its actual rate.
  // On a teleport, start directly at the destination's own composition.
  let sample=mesh.userData.scenicSample;
  if(!sample||sample.cut!==travel.cut||sample.map!==texture){
    sample=mesh.userData.scenicSample={cut:travel.cut,map:texture,x:travel.x,
      center:spec.phase+travel.x*spec.speed/(spec.span||spec.height*aspect)};
  }else{
    sample.center+=(travel.x-sample.x)*spec.speed/span;sample.x=travel.x;
  }
  texture.repeat.set(u,v);
  texture.offset.set(sample.center-u*.5,
    margin*.5*(1+.97*Math.tanh(travel.y*spec.lift/(fullH*margin*.5))));
  // Canvas reads offset/repeat; WebGL consumes their UV matrix.
  texture.matrixAutoUpdate=false;
  texture.updateMatrix();
  mesh.position.x=cx;mesh.position.y=cy;mesh.scale.set(w,h,1);
}
export function marshBlend(cx,start){return Number.isFinite(start)?smooth((cx-start+3)/7):0;}
export function regionWeights(cave,cyan,marsh){
  const underground=clamp(cave+cyan),land=1-clamp(marsh);
  return {bosque:land*(1-underground),cueva:land*underground,marjal:1-land};
}
export function createDepthBands(T,scene){
  const geometry=new T.PlaneGeometry(1,1),layers=new Map();
  const normal=new T.Color(0xffffff),eclipse=new T.Color(0xbfaad8);
  function build(kind){
    const pair=['medio','cerca'].map((depth,i)=>{
      const tx=new T.CanvasTexture(paintDepthBand(kind,depth));
      tx.wrapS=T.RepeatWrapping;tx.colorSpace=T.SRGBColorSpace;tx.magFilter=T.NearestFilter;
      tx.minFilter=T.LinearFilter;tx.generateMipmaps=false;
      const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,toneMapped:false}));
      mesh.name='Paralaje · '+kind+' · '+depth;mesh.position.z=i?-2.55:-6.6;mesh.renderOrder=i?-46:-82;scene.add(mesh);
      return mesh;
    });layers.set(kind,pair);return pair;
  }
  return {update(cx,cy,vw,vh,travel,region,marsh,corruption=0,arena=0){
    const weights=regionWeights(region.cave,region.cyan,marsh);
    for(const kind of ['cueva']){
      const weight=weights[kind],pair=layers.get(kind)||(weight>.002?build(kind):null);
      if(!pair)continue;
      for(let i=0;i<2;i++){
        const m=pair[i];m.visible=weight>.002;if(!m.visible)continue;
        m.material.opacity=weight*(i?.85:.63)*(1-clamp(arena)*(i?.9:.63));
        if(kind==='bosque')m.material.color.copy(normal).lerp(eclipse,clamp(corruption));
        framePlate(m,cx,cy,vw,vh,travel,i?plates.near:plates.middle);
      }
    }
  }};
}
