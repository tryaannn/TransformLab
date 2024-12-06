// Global Variables
window.app = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  dragControls: null,
  objects: [],
  selectedObject: null,
  isDragging: false
};

// Initialize Scene
function initScene() {
  // Scene Setup
  app.scene = new THREE.Scene();
  
  // Camera Setup
  const cameraGroup = new THREE.Group();
  app.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  app.camera.position.set(0, 5, 10);
  cameraGroup.add(app.camera);
  app.scene.add(cameraGroup);

  // Renderer Setup
  const canvas = document.querySelector('canvas');
  app.renderer = new THREE.WebGLRenderer({ 
      canvas: canvas,
      antialias: true,
      preserveDrawingBuffer: true // Required for image saving
  });
  app.renderer.setSize(window.innerWidth, window.innerHeight);
  app.renderer.setClearColor(0xffffff, 1);

  // Lighting Setup
  setupLighting();

  // Controls Setup
  setupControls();

  // Event Listeners
  setupEventListeners();

  // Start Animation Loop
  animate();
}

// Setup Lighting
function setupLighting() {
  const ambientLight = new THREE.AmbientLight(0x404040, 2);
  app.scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(10, 10, 10);
  app.scene.add(directionalLight);
}

// Setup Controls
function setupControls() {
  // Orbit Controls
  app.controls = new THREE.OrbitControls(app.camera, app.renderer.domElement);
  app.controls.enableDamping = true;
  app.controls.dampingFactor = 0.05;
  app.controls.minDistance = 2;
  app.controls.maxDistance = 20;

  // Drag Controls will be initialized when first object is added
  updateDragControls();
}

// Update Drag Controls
function updateDragControls() {
  if (app.dragControls) {
      app.dragControls.dispose();
  }
  
  app.dragControls = new THREE.DragControls(app.objects, app.camera, app.renderer.domElement);
  
  app.dragControls.addEventListener('dragstart', () => {
      app.isDragging = true;
      app.controls.enabled = false;
  });

  app.dragControls.addEventListener('dragend', () => {
      app.isDragging = false;
      app.controls.enabled = true;
      window.historyManager.saveState();
  });
}

// Window Resize Handler
function handleResize() {
  app.renderer.setSize(window.innerWidth, window.innerHeight);
  app.camera.aspect = window.innerWidth / window.innerHeight;
  app.camera.updateProjectionMatrix();
}

// Setup Event Listeners
function setupEventListeners() {
  window.addEventListener('resize', handleResize);
  
  // Object Selection
  app.renderer.domElement.addEventListener('pointerdown', (event) => {
      if (!app.isDragging) {
          handleObjectSelection(event);
      }
  });
}

// Animation Loop
function animate() {
  requestAnimationFrame(animate);
  app.controls.update();
  app.renderer.render(app.scene, app.camera);
}

// Initialize Everything
document.addEventListener('DOMContentLoaded', initScene);