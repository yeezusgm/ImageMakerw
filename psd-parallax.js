// Paisajes de los PSD originales (Bosque 2.0, Abismo y Zona de peste 2.0).
// Cada grupo se exporta en el LIENZO COMPLETO de 2000 x 1000: las posiciones
// de los elementos nunca se recalculan ni se separan las capas verticalmente.
// La distancia de paralaje se aplica a las UV, no al tamaño del plano.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const specs={
  bosque:[
    ['cielo',.014,.010],['lejanos',.044,.022],
    ['medios',.093,.033],['cercanos',.148,.045],['luz',.068,.016]
  ],
  abismo:[
    ['cielo',.013,.008],['nubes',.042,.015],
    ['ruinas',.080,.029],['pinos',.128,.039],['cercanos',.175,.048]
  ],
  peste:[
    ['cielo',.012,.008],['lejanos',.036,.020],
    ['ruinas',.070,.026],['pantano',.118,.037],['gas',.159,.045]
  ]
};
export function createPSDParallax(T,scene,{spawn=0,sword=0,marshStart=0}={}){
  const geometry=new T.PlaneGeometry(1,1),sets={};
  const anchors={bosque:spawn+4.8,abismo:sword,peste:marshStart+3};
  let failed=false;
  const loader=new T.TextureLoader();
  for(const [zone,stages] of Object.entries(specs)){
    const group=new T.Group();group.name='PSD · '+zone;scene.add(group);
    sets[zone]={group,loaded:false,loading:false,entries:stages.map(([id,speed,lift],i)=>{
      const mat=new T.MeshBasicMaterial({transparent:true,depthWrite:false,
        depthTest:true,toneMapped:false,opacity:0,
        blending:zone==='peste'&&id==='gas'?T.AdditiveBlending:T.NormalBlending});
      const mesh=new T.Mesh(geometry,mat);
      mesh.name='PSD · '+zone+' · '+id;
      mesh.position.z=-23.6+i*2.05;
      mesh.renderOrder=-140+i;
      group.add(mesh);
      return {id,speed,lift,mesh,texture:null};
    })};
  }
  function ensure(zone){
    const set=sets[zone];if(set.loading)return;
    set.loading=true;
    for(const entry of set.entries){
      const tx=loader.load('./art/parallax/'+zone+'-'+entry.id+'.webp',loaded=>{
        loaded.colorSpace=T.SRGBColorSpace;
        loaded.magFilter=T.LinearFilter;loaded.minFilter=T.LinearFilter;
        loaded.wrapS=T.MirroredRepeatWrapping;
        loaded.wrapT=T.ClampToEdgeWrapping;
        loaded.generateMipmaps=false;
        entry.mesh.material.map=loaded;
        entry.mesh.material.needsUpdate=true;
        entry.texture=loaded;
        set.loaded=set.entries.every(item=>!!item.texture);
      },undefined,()=>{failed=true;});
      tx.colorSpace=T.SRGBColorSpace;
      tx.wrapS=T.MirroredRepeatWrapping;
      tx.wrapT=T.ClampToEdgeWrapping;
      tx.generateMipmaps=false;
    }
  }
  // El bosque y el abismo se precargan para la transición de la espada;
  // el Marjal solo se lee cuando la cámara se acerca a su entrada.
  ensure('bosque');ensure('abismo');
  function update(cx,cy,vw,vh,travel,region,marsh,corruption){
    if(cx>=marshStart-vw*2.3)ensure('peste');
    const underground=clamp((region?.cave||0)+(region?.cyan||0));
    const land=(1-clamp(marsh))*(1-underground);
    const weights={bosque:land*(1-clamp(corruption)),
      abismo:land*clamp(corruption),peste:clamp(marsh)};
    // Todos los grupos tienen el mismo encuadre y el mismo tamaño,
    // incluidos los que originalmente tenían píxeles fuera del PSD.
    const worldW=Math.max(vw*1.09,vh*2*1.09);
    const worldH=worldW/2;
    const u=vw/worldW,v=vh/worldH;
    const strength=travel.amount??1;
    for(const [zone,set] of Object.entries(sets)){
      const opacity=weights[zone];
      set.group.visible=opacity>.001;
      if(!set.group.visible)continue;
      const dx=(travel.x-(anchors[zone]-spawn)*strength);
      const dy=travel.y;
      for(const entry of set.entries){
        const mesh=entry.mesh,tx=entry.texture;
        mesh.visible=!!tx;
        if(!tx)continue;
        mesh.material.opacity=opacity;
        // +x en UV hace que el fondo se deslice a la izquierda.
        // MirroredRepeat evita costuras y franjas vacías en recorridos largos.
        tx.repeat.set(u,v);
        tx.offset.set((1-u)*.5+dx*entry.speed/worldW,
          clamp((1-v)*.5+dy*entry.lift/worldH,0,1-v));
        tx.matrixAutoUpdate=false;
        tx.updateMatrix();
        mesh.position.x=cx;mesh.position.y=cy;
        mesh.scale.set(vw,vh,1);
      }
    }
  }
  return {update,sets,get failed(){return failed;}};
}
