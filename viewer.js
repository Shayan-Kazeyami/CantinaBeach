import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const stage = document.querySelector('#stage');
const status = document.querySelector('#status');
const reset = document.querySelector('#reset');
const inspect = document.querySelector('#inspect');
const top = document.querySelector('#top');
const center = new THREE.Vector3();
const direction = new THREE.Vector3(.82, .72, 1);
let modelSpan = 34;

try {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  const overviewCamera = new THREE.OrthographicCamera(-17, 17, 12, -12, 0.03, 150);
  const perspectiveCamera = new THREE.PerspectiveCamera(56,1,.025,150);
  let camera = overviewCamera;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.minZoom = .4;
  controls.maxZoom = 35;

  function render() {
    renderer.render(scene, camera);
  }

  function fit() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const aspect = width / Math.max(1, height);
    if (camera.isPerspectiveCamera) {
      camera.aspect = aspect;
    } else {
      const visibleWidth = Math.max(modelSpan, 15 * aspect);
      camera.left = -visibleWidth / 2;
      camera.right = visibleWidth / 2;
      camera.top = visibleWidth / (2 * aspect);
      camera.bottom = -camera.top;
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    render();
  }

  function useCamera(next) {
    camera = next;
    controls.object = next;
  }

  function choosePerspective(pose) {
    useCamera(perspectiveCamera);
    camera.fov = pose.fov;
    camera.position.fromArray(pose.position);
    controls.target.fromArray(pose.target);
    camera.zoom = 1;
    fit();
    controls.update();
    render();
  }

  function view(axis, target = center, span = null) {
    useCamera(overviewCamera);
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(axis.clone().normalize(), 56);
    camera.zoom = 1;
    fit();
    if (span !== null) {
      camera.zoom = (camera.right - camera.left) / span;
      camera.updateProjectionMatrix();
    }
    controls.update();
    render();
  }

  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('./three/examples/jsm/libs/draco/gltf/', import.meta.url).href);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const asset = await loader.loadAsync(new URL('./dollhouse.glb', import.meta.url).href);
  draco.dispose();
  scene.add(asset.scene);
  const bounds = new THREE.Box3().setFromObject(asset.scene, true);
  bounds.getCenter(center);
  const size = bounds.getSize(new THREE.Vector3());
  modelSpan = Math.max(size.x, size.z) * 1.22;

  controls.addEventListener('change', render);
  const setOverview = (axis) => {
    inspect.value = '';
    view(axis);
  };
  reset.addEventListener('click', () => setOverview(direction));
  top.addEventListener('click', () => setOverview(new THREE.Vector3(0, 1, .0001)));
  new ResizeObserver(fit).observe(stage);
  const joins = {
    ...{"bar_overhead":[[-1.4300000000000002,8.1,0.0],[-2.77,0,-5.6],8.3],"bar_soffit":{"position":[-0.66,1.60,-4.3],"target":[-1.77,2.5,-5.7],"fov":71},"bar_service":{"position":[-0.64,1.63,-3.9],"target":[-2.05,1.13,-6.5],"fov":72},"deck_threshold":[[-0.8999999999999986,0.71,-0.4399999999999995],[-10.72,-0.02,-7.41],1.25],"terrace":{"position":[-10.01,1.59,-0.35],"target":[-9.28,0.98,-3.6],"fov":52},"arcade":{"position":[-9.32,3.24,-9.98],"target":[-7.65,2.46,-9.16],"fov":41},"dining":{"position":[0.65,0.48,-4.97],"target":[0.02,0.24,-5.41],"fov":60},"drink":{"position":[8.13,1.34,-7.08],"target":[8.72,1.17,-5.24],"fov":64},"rack":{"position":[10.69,1.64,-7.41],"target":[10.7,0.83,-4.6],"fov":54},"restroom":{"position":[13.31,1.28,-7.8],"target":[14.05,1.05,-6.96],"fov":70},"marina_outer":[[3.3000000000000007,2.22,-4.210000000000001],[14.5,0.9,-9.7],5.7],"waterside":[[2.6799999999999997,1.2799999999999998,-3.530000000000001],[9.3,1.52,-10.12],6.8]},
    entry: [[.82,.51,1], [5.14,1.168,.135], 4.227],
    bar: [[-1,.58,-.29], [-.02,1.98,-5.30], 7.5],
    glasses: [[-2.75,-.90,-.40], [-4.70,2.43,-5.20], 4.0],
    kitchen: [[.3,1.35,1], [10.7,1.93,-5.15], 4.2],
    deck: [[-.6,-.35,.8], [-12.2,-.20,.59], 7.3],
    marina: [[1,.88,-1], [12.85,1.67,-8.35], 5.6],
  };
  function selectJoin(key) {
    if (!Object.hasOwn(joins,key)) {
      setOverview(direction);
      return;
    }
    const pose=joins[key];
    inspect.value=key;
    if (!Array.isArray(pose)) {
      choosePerspective(pose);
      return;
    }
    const [axis,target,span]=pose;
    view(new THREE.Vector3(...axis),new THREE.Vector3(...target),span);
  }
  inspect.addEventListener('change', () => selectJoin(inspect.value));
  selectJoin(new URLSearchParams(window.location.search).get('view'));
  inspect.disabled = false;
  reset.disabled = false;
  top.disabled = false;
  status.hidden = true;
} catch (error) {
  status.textContent = 'The 3D model could not load. Reload the page to try again.';
  console.error(error);
}



