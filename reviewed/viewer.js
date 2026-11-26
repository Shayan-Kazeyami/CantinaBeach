import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
const q=id=>document.getElementById(id);
const part=q('part'), status=q('status'), reset=q('reset'), stage=q('stage');
const fail=error=>{status.textContent='Could not load this 3D view.';status.hidden=false;console.error(error);};
try {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1;
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  stage.append(renderer.domElement);
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf3f7ff,0xa69a91,2.0));
  const key=new THREE.DirectionalLight(0xfff5e5,2.2);
  key.position.set(-3,5,4);scene.add(key);
  const fill=new THREE.DirectionalLight(0xe3ecff,0.8);
  fill.position.set(4,2,-3);scene.add(fill);
  const camera=new THREE.PerspectiveCamera(43,1,.001,100);
  const controls=new OrbitControls(camera,renderer.domElement);
  const render=()=>renderer.render(scene,camera);
  controls.addEventListener('change',render);
  const resize=()=>{const {clientWidth:w,clientHeight:h}=stage;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);render();};
  new ResizeObserver(resize).observe(stage);
  const decoder=new DRACOLoader();
  decoder.setDecoderPath(new URL('../three/examples/jsm/libs/draco/gltf/',import.meta.url).href);
  const loader=new GLTFLoader().setDRACOLoader(decoder);
  const response=await fetch('./parts.json');
  if(!response.ok)throw Error('Parts index unavailable');
  const entries=await response.json();
  if(!entries.length)throw Error('No reviewed parts');
  const cache=new Map();
  let loaded,sequence=0,pose;
  part.replaceChildren(...entries.map(e=>new Option(e.id+' · '+e.title,e.id)));
  part.disabled=false;
  const view=()=>{if(!pose)return;camera.position.copy(pose.position);controls.target.set(0,0,0);controls.update();render();};
  function guide(box,direction){
    const c=new THREE.Group(), size=box.getSize(new THREE.Vector3()), span=Math.max(size.x,size.y,size.z);
    const square=new THREE.PlaneGeometry(span/10,span/10);
    const light=new THREE.MeshBasicMaterial({color:0xcbd2ca,side:THREE.DoubleSide});
    const dark=new THREE.MeshBasicMaterial({color:0x415354,side:THREE.DoubleSide});
    const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
    for(let x=0;x<8;x++)for(let y=0;y<12;y++){
      const m=new THREE.Mesh(square,((x+y)%2)?light:dark);
      m.position.addScaledVector(direction,-span*.17).addScaledVector(right,(x-3.5)*span/10);
      m.position.y=(y-5.5)*span/10;m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);c.add(m);
    }
    return c;
  }
  const load=async id=>{
    const e=entries.find(p=>p.id===id)??entries[0], run=++sequence;
    status.textContent='Loading '+e.title+'…';status.hidden=false;reset.disabled=true;part.value=e.id;
    try{
      if(!cache.has(e.id))cache.set(e.id,loader.loadAsync(new URL(e.file,import.meta.url).href).catch(err=>{cache.delete(e.id);throw err;}));
      const gltf=await cache.get(e.id);if(run!==sequence)return;
      if(loaded)scene.remove(loaded);
      const model=gltf.scene.clone(true), bounds=new THREE.Box3().setFromObject(model,true);
      const center=bounds.getCenter(new THREE.Vector3()), s=bounds.getSize(new THREE.Vector3());
      if(bounds.isEmpty())throw Error('Empty part');
      const span=Math.max(s.x,s.y,s.z), direction=new THREE.Vector3(s.x<s.z?1:0,0,s.x<s.z?0:1);
      loaded=new THREE.Group();model.position.sub(center);loaded.add(model);
      if(e.id==='B-011')loaded.add(guide(bounds,direction));
      scene.add(loaded);
      const isGlass=e.id==='B-011';
      const angle=direction.clone().add(new THREE.Vector3(direction.z*.30,isGlass?.03:.22,direction.x*.30)).normalize();
      const dist=span*(camera.aspect<.76?2.3:1.83);
      pose={position:angle.multiplyScalar(dist)};
      camera.near=Math.max(.0002,span/2800);camera.far=Math.max(5,span*18);camera.updateProjectionMatrix();
      controls.minDistance=span*.22;controls.maxDistance=span*9;
      q('part-title').textContent=e.title;
      q('scope').textContent=e.scope+(isGlass?' Checkerboard is an inspection aid, not venue geometry.':'');
      view();resize();status.hidden=true;reset.disabled=false;
    }catch(err){if(run===sequence)fail(err);}
  };
  reset.addEventListener('click',view);
  part.addEventListener('change',()=>{const url=new URL(location.href);url.searchParams.set('part',part.value);history.replaceState(null,'',url);load(part.value);});
  resize();await load(new URLSearchParams(location.search).get('part'));
}catch(error){fail(error);}
