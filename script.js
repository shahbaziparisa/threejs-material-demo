import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ========== CONFIGURATION ==========
const MODEL_PATH = './model/model.glb';

// Target mesh and material names
const TARGET_MESH_NAME = 'Cylinder001_1';
const TARGET_MATERIAL_NAME = 'oak_veneer_01';

// ========== PBR MATERIALS CONFIGURATION ==========
const PBR_MATERIALS = [
    {
        id: 'wood_oak',
        name: 'Oak Wood',
        previewImage: './textures/wood/basecolor.jpg',
        maps: {
            map: './textures/wood/basecolor.jpg',
            normalMap: './textures/wood/normal.jpg',
            roughnessMap: './textures/wood/roughness.jpg',
            aoMap: './textures/wood/ao.jpg'
        }
    },
    {
        id: 'metal_brushed',
        name: 'wood 2',
        previewImage: './textures/wood2/basecolor.jpg',
        maps: {
            map: './textures/wood2/basecolor.jpg',
            normalMap: './textures/wood2/normal.jpg',
            roughnessMap: './textures/wood2/roughness.jpg',
            aoMap: './textures/wood2/ao.jpg'
        }
    },
    {
        id: 'carbon_fiber',
        name: 'wood3',
        previewImage: './textures/wood3/basecolor.jpg',
        maps: {
            map: './textures/wood3/basecolor.jpg',
            normalMap: './textures/wood3/normal.jpg',
            roughnessMap: './textures/wood3/roughness.jpg',
            aoMap: './textures/wood3/ao.jpg'
        }
    }
];

// HDRI Files Configuration
const HDRI_FILES = {
    studio: './hdri/1.hdr',
    sunset: './hdri/night_free_Env.hdr',
    forest: './hdri/outdoor.hdr'
};

// --- GLOBAL VARIABLES ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0a2a');

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(3, 2, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;  // Increased for better brightness
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enableZoom = true;
controls.enablePan = true;
controls.zoomSpeed = 1.2;
controls.rotateSpeed = 1.0;
controls.target.set(0, 0.5, 0);

let currentModel = null;
let currentHDRIMap = null;
let currentBGMode = 'solid';

// --- IMPROVED LIGHTING SYSTEM ---
let ambientLight, keyLight, fillLight, rimLight, backRimLight;

function initLights() {
    // Ambient light - brighter for better base illumination
    ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    // Main Key Light (bright directional light)
    keyLight = new THREE.DirectionalLight(0xfff5e0, 1.5);
    keyLight.position.set(3, 5, 2);
    keyLight.castShadow = true;
    keyLight.receiveShadow = false;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);
    
    // Fill Light from below (to lift shadows)
    fillLight = new THREE.PointLight(0x88aaff, 0.6);
    fillLight.position.set(0, -1.5, 0);
    scene.add(fillLight);
    
    // Rim Light from back-right
    rimLight = new THREE.PointLight(0xffaa66, 0.8);
    rimLight.position.set(1.5, 2, -3);
    scene.add(rimLight);
    
    // Back rim light from left
    backRimLight = new THREE.PointLight(0xff8866, 0.6);
    backRimLight.position.set(-1.5, 2, -2.5);
    scene.add(backRimLight);
    
    // Optional: A subtle fill from top
    const topFill = new THREE.PointLight(0xaaccff, 0.4);
    topFill.position.set(0, 3, 0);
    scene.add(topFill);
}

function setLightingPreset(type) {
    switch(type) {
        case 'natural':
            keyLight.intensity = 1.5;
            keyLight.color.setHex(0xfff5e0);
            fillLight.intensity = 0.6;
            rimLight.intensity = 0.8;
            backRimLight.intensity = 0.6;
            ambientLight.intensity = 0.8;
            renderer.toneMappingExposure = 1.3;
            break;
        case 'studio':
            keyLight.intensity = 1.8;
            keyLight.color.setHex(0xffffff);
            fillLight.intensity = 0.8;
            rimLight.intensity = 1.0;
            backRimLight.intensity = 0.8;
            ambientLight.intensity = 0.9;
            renderer.toneMappingExposure = 1.1;
            break;
        case 'dramatic':
            keyLight.intensity = 2.0;
            keyLight.color.setHex(0xffaa66);
            fillLight.intensity = 0.3;
            rimLight.intensity = 1.3;
            backRimLight.intensity = 1.0;
            ambientLight.intensity = 0.5;
            renderer.toneMappingExposure = 1.5;
            break;
        case 'soft':
            keyLight.intensity = 1.0;
            keyLight.color.setHex(0xccddff);
            fillLight.intensity = 0.9;
            rimLight.intensity = 0.6;
            backRimLight.intensity = 0.5;
            ambientLight.intensity = 1.0;
            renderer.toneMappingExposure = 1.2;
            break;
    }
}

// ========== Apply ONLY texture maps to existing material ==========
function applyTexturesToTargetLayer(materialConfig) {
    if (!currentModel) {
        console.warn('No model loaded yet');
        return false;
    }
    
    console.log(`🎨 Applying textures from "${materialConfig.name}" to target layer...`);
    
    const textureLoader = new THREE.TextureLoader();
    let loadedCount = 0;
    let totalTextures = 0;
    
    // Count textures to load
    if (materialConfig.maps.map) totalTextures++;
    if (materialConfig.maps.normalMap) totalTextures++;
    if (materialConfig.maps.roughnessMap) totalTextures++;
    if (materialConfig.maps.metalnessMap) totalTextures++;
    if (materialConfig.maps.aoMap) totalTextures++;
    
    function checkAllLoaded() {
        loadedCount++;
        if (loadedCount === totalTextures) {
            const loadingDiv = document.getElementById('loadingStatus');
            loadingDiv.innerHTML = `✅ ${materialConfig.name} textures applied!`;
            setTimeout(() => { loadingDiv.style.opacity = '0.5'; }, 2000);
            console.log(`✅ All textures for "${materialConfig.name}" applied successfully`);
        }
    }
    
    // Find the target material and update its maps
    function updateMaterialMaps(texture, mapType) {
        let foundCount = 0;
        
        currentModel.traverse((child) => {
            if (!child.isMesh) return;
            
            // Check by mesh name first
            if (child.name === TARGET_MESH_NAME) {
                if (Array.isArray(child.material)) {
                    child.material.forEach((mat) => {
                        if (mat && (mat.name === TARGET_MATERIAL_NAME || mat.name?.includes(TARGET_MATERIAL_NAME))) {
                            mat[mapType] = texture;
                            if (mapType === 'map') mat.needsUpdate = true;
                            console.log(`  → Updated ${mapType} on material "${mat.name}"`);
                            foundCount++;
                        }
                    });
                } else if (child.material) {
                    if (child.material.name === TARGET_MATERIAL_NAME || child.material.name?.includes(TARGET_MATERIAL_NAME)) {
                        child.material[mapType] = texture;
                        if (mapType === 'map') child.material.needsUpdate = true;
                        console.log(`  → Updated ${mapType} on material "${child.material.name}"`);
                        foundCount++;
                    }
                }
            }
            
            // Fallback: search by material name only
            if (Array.isArray(child.material)) {
                child.material.forEach((mat) => {
                    if (mat && (mat.name === TARGET_MATERIAL_NAME || mat.name?.includes(TARGET_MATERIAL_NAME))) {
                        mat[mapType] = texture;
                        if (mapType === 'map') mat.needsUpdate = true;
                        console.log(`  → Updated ${mapType} on material "${mat.name}" (mesh: ${child.name})`);
                        foundCount++;
                    }
                });
            } else if (child.material && (child.material.name === TARGET_MATERIAL_NAME || child.material.name?.includes(TARGET_MATERIAL_NAME))) {
                child.material[mapType] = texture;
                if (mapType === 'map') child.material.needsUpdate = true;
                console.log(`  → Updated ${mapType} on material "${child.material.name}" (mesh: ${child.name})`);
                foundCount++;
            }
        });
        
        return foundCount;
    }
    
    // Load Base Color Map
    if (materialConfig.maps.map) {
        textureLoader.load(materialConfig.maps.map,
            (tex) => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(1, 1);
                updateMaterialMaps(tex, 'map');
                checkAllLoaded();
            },
            undefined,
            (err) => console.error(`❌ Failed to load base color map:`, err)
        );
    }
    
    // Load Normal Map
    if (materialConfig.maps.normalMap) {
        textureLoader.load(materialConfig.maps.normalMap,
            (tex) => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                updateMaterialMaps(tex, 'normalMap');
                checkAllLoaded();
            },
            undefined,
            (err) => console.warn(`⚠️ Normal map failed:`, err)
        );
    }
    
    // Load Roughness Map
    if (materialConfig.maps.roughnessMap) {
        textureLoader.load(materialConfig.maps.roughnessMap,
            (tex) => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                updateMaterialMaps(tex, 'roughnessMap');
                checkAllLoaded();
            },
            undefined,
            (err) => console.warn(`⚠️ Roughness map failed:`, err)
        );
    }
    
    // Load Metalness Map (if exists)
    if (materialConfig.maps.metalnessMap) {
        textureLoader.load(materialConfig.maps.metalnessMap,
            (tex) => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                updateMaterialMaps(tex, 'metalnessMap');
                checkAllLoaded();
            },
            undefined,
            (err) => console.warn(`⚠️ Metalness map failed:`, err)
        );
    }
    
    // Load AO Map
    if (materialConfig.maps.aoMap) {
        textureLoader.load(materialConfig.maps.aoMap,
            (tex) => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                updateMaterialMaps(tex, 'aoMap');
                checkAllLoaded();
            },
            undefined,
            (err) => console.warn(`⚠️ AO map failed:`, err)
        );
    }
    
    return true;
}

// ========== SIMPLE COLOR OVERRIDE (KEEPS textures) ==========
function setTargetLayerColor(hexColor) {
    if (!currentModel) return;
    
    const color = new THREE.Color(hexColor);
    
    currentModel.traverse((child) => {
        if (!child.isMesh) return;
        
        if (child.name === TARGET_MESH_NAME) {
            if (Array.isArray(child.material)) {
                child.material.forEach((mat) => {
                    if (mat && (mat.name === TARGET_MATERIAL_NAME || mat.name?.includes(TARGET_MATERIAL_NAME))) {
                        mat.color.set(color);
                        console.log(`  → Updated color for material "${mat.name}"`);
                    }
                });
            } else if (child.material) {
                if (child.material.name === TARGET_MATERIAL_NAME || child.material.name?.includes(TARGET_MATERIAL_NAME)) {
                    child.material.color.set(color);
                    console.log(`  → Updated color for material "${child.material.name}"`);
                }
            }
        }
    });
}

// --- HDRI LOADING ---
function loadHDRI(type) {
    const url = HDRI_FILES[type];
    if (!url) { 
        console.warn('HDRI not configured for:', type); 
        return; 
    }
    
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load(url, (texture) => {
        texture.mapping = THREE.EquirectangularMapping;
        scene.environment = texture;
        currentHDRIMap = texture;
        if (currentBGMode === 'hdri') {
            scene.background = texture;
            scene.environment = texture;
        }
    }, undefined, (err) => console.error('HDRI load failed:', err));
}

function setBackgroundMode(mode) {
    currentBGMode = mode;
    const solidGroup = document.getElementById('solidColorGroup');
    const hdriGroup = document.getElementById('hdriGroup');
    
    if (mode === 'solid') {
        solidGroup.style.display = 'flex';
        hdriGroup.style.display = 'none';
        const solidColor = document.getElementById('bgColorSelect').value;
        scene.background = new THREE.Color(solidColor);
        scene.environment = null;  // Clear environment for solid mode
    } else {
        solidGroup.style.display = 'none';
        hdriGroup.style.display = 'flex';
        loadHDRI(document.getElementById('hdriSelect').value);
    }
}

// --- LOAD GLB MODEL ---
function loadGLBModel() {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    dracoLoader.setDecoderConfig({ type: 'wasm' });
    
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    
    const loadingDiv = document.getElementById('loadingStatus');
    
    loader.load(MODEL_PATH, 
        (gltf) => {
            if (currentModel) scene.remove(currentModel);
            currentModel = gltf.scene;
            currentModel.scale.set(1, 1, 1);
            currentModel.position.set(0, 0, 0);
            
            console.log('=== Model Loaded ===');
            console.log('Target mesh:', TARGET_MESH_NAME);
            console.log('Target material:', TARGET_MATERIAL_NAME);
            
            // Enable shadows on all meshes
            currentModel.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            scene.add(currentModel);
            
            // Auto-adjust camera
            const box = new THREE.Box3().setFromObject(currentModel);
            const center = box.getCenter(new THREE.Vector3());
            controls.target.copy(center);
            controls.update();
            
            loadingDiv.innerHTML = '✅ Model loaded! Select a texture';
            setTimeout(() => { loadingDiv.style.opacity = '0.5'; }, 2000);
            
            dracoLoader.dispose();
        },
        (xhr) => {
            const percent = Math.floor(xhr.loaded / xhr.total * 100);
            loadingDiv.innerHTML = `📦 Loading model: ${percent}%`;
        },
        (error) => {
            console.error('Model load error:', error);
            loadingDiv.innerHTML = '❌ Failed to load model! Check path.';
            loadingDiv.style.color = '#ff6666';
        }
    );
}

// --- IMPROVED GIZMO CAMERA CONTROLS ---
function setCameraView(direction) {
    if (!currentModel) {
        console.warn('No model loaded yet');
        return;
    }
    
    // Get the exact center of the model
    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Calculate dynamic distance based on model size
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 1.5;
    
    // Store current target
    controls.target.copy(center);
    
    // Set camera position based on direction
    switch(direction) {
        case 'left':
            camera.position.set(center.x - distance, center.y, center.z);
            break;
        case 'right':
            camera.position.set(center.x + distance, center.y, center.z);
            break;
        case 'top':
            camera.position.set(center.x, center.y + distance, center.z);
            break;
        case 'bottom':
            camera.position.set(center.x, center.y - distance, center.z);
            break;
        case 'front':
            camera.position.set(center.x, center.y, center.z + distance);
            break;
        case 'back':
            camera.position.set(center.x, center.y, center.z - distance);
            break;
        default:
            return;
    }
    
    // Force camera to look exactly at the center
    camera.lookAt(center);
    
    // Update controls
    controls.update();
    
    console.log(`📷 Camera moved to ${direction} view. Distance: ${distance.toFixed(2)}`);
}

// --- CREATE TEXTURE UI CIRCLES ---
function createTextureUI() {
    const container = document.getElementById('texturePicker');
    container.innerHTML = '';
    
    PBR_MATERIALS.forEach(material => {
        const div = document.createElement('div');
        div.className = 'texture-circle';
        
        if (material.previewImage) {
            const img = document.createElement('img');
            img.src = material.previewImage;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            div.appendChild(img);
            img.onerror = () => {
                div.innerHTML = '🎨';
                div.style.background = '#555';
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.justifyContent = 'center';
                div.style.fontSize = '24px';
            };
        } else {
            div.innerHTML = '🎨';
            div.style.background = '#555';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'center';
            div.style.fontSize = '24px';
        }
        
        div.title = material.name;
        div.addEventListener('click', () => {
            applyTexturesToTargetLayer(material);
            document.querySelectorAll('.texture-circle').forEach(c => c.classList.remove('active'));
            div.classList.add('active');
            
            const loadingDiv = document.getElementById('loadingStatus');
            loadingDiv.innerHTML = `🎨 Applying ${material.name} textures...`;
            loadingDiv.style.opacity = '1';
            setTimeout(() => { loadingDiv.style.opacity = '0.5'; }, 1500);
        });
        container.appendChild(div);
    });
}

// --- EVENT LISTENERS ---
document.getElementById('bgModeSelect').addEventListener('change', (e) => setBackgroundMode(e.target.value));
document.getElementById('bgColorSelect').addEventListener('change', (e) => {
    if (currentBGMode === 'solid') scene.background = new THREE.Color(e.target.value);
});
document.getElementById('hdriSelect').addEventListener('change', (e) => {
    if (currentBGMode === 'hdri') loadHDRI(e.target.value);
});
document.getElementById('lightingSelect').addEventListener('change', (e) => setLightingPreset(e.target.value));

// Color picker - applies to target layer only
document.querySelectorAll('.color-circle').forEach(circle => {
    circle.addEventListener('click', () => {
        setTargetLayerColor(circle.dataset.color);
        document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
        circle.classList.add('active');
    });
});

// Gizmo buttons
document.querySelectorAll('.gizmo-btn').forEach(btn => {
    btn.addEventListener('click', () => setCameraView(btn.dataset.view));
});

// --- HELPER: Ground grid ---
const gridHelper = new THREE.GridHelper(8, 20, 0x88aaff, 0x446688);
gridHelper.position.y = -0.9;
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.25;
scene.add(gridHelper);

// --- INITIALIZE APPLICATION ---
initLights();
setLightingPreset('natural');
setBackgroundMode('solid');
createTextureUI();
loadGLBModel();

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// --- RESIZE HANDLER ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log('🚀 3D Configurator Ready | Target Mesh: ' + TARGET_MESH_NAME + ' | Target Material: ' + TARGET_MATERIAL_NAME);