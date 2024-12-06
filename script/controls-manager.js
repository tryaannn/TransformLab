// Camera Control States
const CameraState = {
  ORBIT: 'orbit',
  FIRST_PERSON: 'firstPerson'
};

class ControlsManager {
  constructor() {
      this.currentState = CameraState.ORBIT;
      this.moveSpeed = 0.1;
      this.mouseSpeed = 0.002;
      this.keys = {
          forward: false,
          backward: false,
          left: false,
          right: false,
          up: false,
          down: false
      };
      
      this.setupEventListeners();
  }

  setupEventListeners() {
      // Keyboard controls
      document.addEventListener('keydown', (e) => this.handleKeyDown(e));
      document.addEventListener('keyup', (e) => this.handleKeyUp(e));
      
      // Mouse controls for first person view
      document.addEventListener('mousemove', (e) => {
          if (this.currentState === CameraState.FIRST_PERSON) {
              this.handleMouseMove(e);
          }
      });

      // Toggle view mode
      document.addEventListener('keypress', (e) => {
          if (e.key === 'v' || e.key === 'V') {
              this.toggleViewMode();
          }
      });
  }

  handleKeyDown(event) {
      switch(event.key.toLowerCase()) {
          case 'w': this.keys.forward = true; break;
          case 's': this.keys.backward = true; break;
          case 'a': this.keys.left = true; break;
          case 'd': this.keys.right = true; break;
          case 'q': this.keys.down = true; break;
          case 'e': this.keys.up = true; break;
      }
  }

  handleKeyUp(event) {
      switch(event.key.toLowerCase()) {
          case 'w': this.keys.forward = false; break;
          case 's': this.keys.backward = false; break;
          case 'a': this.keys.left = false; break;
          case 'd': this.keys.right = false; break;
          case 'q': this.keys.down = false; break;
          case 'e': this.keys.up = false; break;
      }
  }

  handleMouseMove(event) {
      if (this.currentState !== CameraState.FIRST_PERSON) return;

      const { movementX, movementY } = event;
      const camera = window.app.camera;

      // Rotate camera based on mouse movement
      camera.rotation.y -= movementX * this.mouseSpeed;
      
      // Limit vertical rotation to prevent camera flipping
      const newRotationX = camera.rotation.x - movementY * this.mouseSpeed;
      camera.rotation.x = Math.max(Math.min(newRotationX, Math.PI / 2), -Math.PI / 2);
  }

  toggleViewMode() {
      if (this.currentState === CameraState.ORBIT) {
          this.currentState = CameraState.FIRST_PERSON;
          window.app.controls.enabled = false;
          document.body.requestPointerLock();
      } else {
          this.currentState = CameraState.ORBIT;
          window.app.controls.enabled = true;
          document.exitPointerLock();
      }
  }

  update() {
      if (this.currentState === CameraState.FIRST_PERSON) {
          this.updateFirstPersonControls();
      }
  }

  updateFirstPersonControls() {
      const camera = window.app.camera;
      const direction = new THREE.Vector3();
      const rotation = camera.rotation.clone();

      // Calculate forward/backward movement
      if (this.keys.forward || this.keys.backward) {
          direction.z = this.keys.forward ? -1 : 1;
          direction.applyEuler(rotation);
          camera.position.add(direction.multiplyScalar(this.moveSpeed));
      }

      // Calculate left/right movement
      if (this.keys.left || this.keys.right) {
          direction.set(this.keys.left ? -1 : 1, 0, 0);
          direction.applyEuler(rotation);
          camera.position.add(direction.multiplyScalar(this.moveSpeed));
      }

      // Calculate up/down movement
      if (this.keys.up || this.keys.down) {
          camera.position.y += (this.keys.up ? 1 : -1) * this.moveSpeed;
      }
  }
}

// Initialize Controls Manager
window.controlsManager = new ControlsManager();

// Add to animation loop
const originalAnimate = window.app.animate;
window.app.animate = function() {
  window.controlsManager.update();
  originalAnimate();
};