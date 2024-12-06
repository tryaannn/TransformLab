// Object Counter for unique IDs
let objectCounter = 0;

// Load 3D Asset
async function loadAsset(assetName, options = {}) {
    const loader = new THREE.GLTFLoader();
    const assetPath = `./assets/${assetName}.glb`;

    try {
        const gltf = await new Promise((resolve, reject) => {
            loader.load(assetPath,
                (gltf) => resolve(gltf),
                undefined,
                (error) => reject(error)
            );
        });

        const model = gltf.scene;
        
        // Apply position, rotation, and scale
        if (options.position) {
            model.position.copy(options.position);
        } else {
            model.position.set(
                Math.random() * 4 - 2,
                0,
                Math.random() * 4 - 2
            );
        }

        if (options.rotation) {
            model.rotation.copy(options.rotation);
        }

        if (options.scale) {
            model.scale.copy(options.scale);
        } else {
            model.scale.set(1, 1, 1);
        }

        // Set metadata
        model.userData.draggable = true;
        model.userData.type = assetName;
        model.userData.id = options.id || `object_${++objectCounter}`;

        // Add to scene and objects array
        window.app.scene.add(model);
        window.app.objects.push(model);

        // Setup material for selection highlight
        model.traverse((child) => {
            if (child.isMesh) {
                child.userData.originalMaterial = child.material.clone();
                child.material = child.userData.originalMaterial.clone();
            }
        });

        // Update controls
        updateDragControls();

        // Save state for undo/redo if not part of state restoration
        if (!window.historyManager.isApplyingState) {
            window.historyManager.saveState();
        }

        return model;
    } catch (error) {
        console.error('Error loading model:', error);
        return null;
    }
}

// Handle Object Selection
function handleObjectSelection(event) {
    event.preventDefault();

    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, window.app.camera);
    
    const intersects = raycaster.intersectObjects(window.app.objects, true);

    // Deselect current object
    if (window.app.selectedObject) {
        deselectObject(window.app.selectedObject);
    }

    // Select new object if clicked
    if (intersects.length > 0) {
        const clickedObject = findTopLevelObject(intersects[0].object);
        if (clickedObject) {
            selectObject(clickedObject);
        }
    }
}

// Find top level object (parent) from a child mesh
function findTopLevelObject(object) {
    let current = object;
    while (current.parent && !current.userData.draggable) {
        current = current.parent;
    }
    return current.userData.draggable ? current : null;
}

// Select Object
function selectObject(object) {
    window.app.selectedObject = object;
    object.traverse((child) => {
        if (child.isMesh) {
            // Create highlighted material
            const highlightMaterial = child.userData.originalMaterial.clone();
            highlightMaterial.emissive.setHex(0x555555);
            highlightMaterial.emissiveIntensity = 0.5;
            child.material = highlightMaterial;
        }
    });
    
    // Enable relevant buttons
    updateObjectControlButtons(true);
}

// Deselect Object
function deselectObject(object) {
    object.traverse((child) => {
        if (child.isMesh && child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial.clone();
        }
    });
    
    if (window.app.selectedObject === object) {
        window.app.selectedObject = null;
        // Disable relevant buttons
        updateObjectControlButtons(false);
    }
}

// Update Object Control Buttons
function updateObjectControlButtons(enabled) {
    const buttons = [
        'duplicateObject',
        'removeSelected',
        'scaleUp',
        'scaleDown',
        'rotateLeft',
        'rotateRight',
        'rotateUp',
        'rotateDown',
        'rotateVerticalLeft',
        'rotateVerticalRight'
    ];

    buttons.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.disabled = !enabled;
        }
    });
}

// Duplicate Selected Object
async function duplicateSelectedObject() {
    if (!window.app.selectedObject) return;

    const original = window.app.selectedObject;
    const offset = 0.5; // Offset for new position

    const newPosition = original.position.clone();
    newPosition.x += offset;
    newPosition.z += offset;

    await loadAsset(original.userData.type, {
        position: newPosition,
        rotation: original.rotation.clone(),
        scale: original.scale.clone()
    });
}

// Remove Selected Object
function removeSelectedObject() {
    if (!window.app.selectedObject) return;

    const obj = window.app.selectedObject;
    window.app.scene.remove(obj);
    
    const index = window.app.objects.indexOf(obj);
    if (index > -1) {
        window.app.objects.splice(index, 1);
    }

    window.app.selectedObject = null;
    updateObjectControlButtons(false);
    updateDragControls();
    
    window.historyManager.saveState();
}

// Save Scene as Image
function saveSceneAsImage() {
    // Render scene
    window.app.renderer.render(window.app.scene, window.app.camera);
    
    // Get canvas data
    const imageData = window.app.renderer.domElement.toDataURL('image/png');
    
    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.href = imageData;
    downloadLink.download = 'scene_' + new Date().toISOString().slice(0, 10) + '.png';
    
    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// Setup Event Listeners for Object Controls
function setupObjectControlListeners() {
    // Add asset buttons
    const assetButtons = ['wall', 'wall2', 'wall3', 'floor', 'roof'];
    assetButtons.forEach(asset => {
        document.getElementById(`add${asset.charAt(0).toUpperCase() + asset.slice(1)}`)
            .addEventListener('click', () => loadAsset(asset));
    });

    // Object manipulation buttons
    document.getElementById('duplicateObject').addEventListener('click', duplicateSelectedObject);
    document.getElementById('removeSelected').addEventListener('click', removeSelectedObject);
    document.getElementById('saveScene').addEventListener('click', saveSceneAsImage);

    // Scale controls
    document.getElementById('scaleUp').addEventListener('click', () => {
        if (window.app.selectedObject) {
            window.app.selectedObject.scale.multiplyScalar(1.1);
            window.historyManager.saveState();
        }
    });

    document.getElementById('scaleDown').addEventListener('click', () => {
        if (window.app.selectedObject) {
            window.app.selectedObject.scale.multiplyScalar(0.9);
            window.historyManager.saveState();
        }
    });

    // Setup rotation controls
    setupRotationControls();
}

// Setup Rotation Controls
function setupRotationControls() {
    const rotationAmount = Math.PI / 18; // 10 degrees

    const rotationControls = {
        'rotateLeft': { axis: 'y', amount: -rotationAmount },
        'rotateRight': { axis: 'y', amount: rotationAmount },
        'rotateUp': { axis: 'x', amount: -rotationAmount },
        'rotateDown': { axis: 'x', amount: rotationAmount },
        'rotateVerticalLeft': { axis: 'z', amount: -rotationAmount },
        'rotateVerticalRight': { axis: 'z', amount: rotationAmount }
    };

    Object.entries(rotationControls).forEach(([buttonId, { axis, amount }]) => {
        document.getElementById(buttonId).addEventListener('click', () => {
            if (window.app.selectedObject) {
                window.app.selectedObject.rotation[axis] += amount;
                window.historyManager.saveState();
            }
        });
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    setupObjectControlListeners();
});

