// History State Class
class HistoryState {
    constructor(objects) {
      // Deep clone the objects array to prevent reference issues
      this.objects = objects.map(obj => ({
        type: obj.userData.type,
        position: obj.position.clone(),
        rotation: obj.rotation.clone(),
        scale: obj.scale.clone(),
        id: obj.userData.id,
        // Add additional metadata that might be important
        userData: { ...obj.userData }
      }));
      // Store timestamp for debugging
      this.timestamp = Date.now();
    }
  
    async apply() {
      try {
        // Clear current scene objects safely
        const objectsToRemove = [...window.app.objects];
        objectsToRemove.forEach(obj => {
          window.app.scene.remove(obj);
          // Clean up any resources
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(mat => mat.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
        
        window.app.objects.length = 0;
        window.app.selectedObject = null;
  
        // Rebuild scene from state with error handling
        for (const objState of this.objects) {
          try {
            const newObject = await loadAsset(objState.type, {
              position: objState.position,
              rotation: objState.rotation,
              scale: objState.scale,
              id: objState.id
            });
            
            if (newObject) {
              // Restore additional userData if it exists
              Object.assign(newObject.userData, objState.userData);
            } else {
              console.warn(`Failed to load asset: ${objState.type}`);
            }
          } catch (err) {
            console.error(`Error restoring object of type ${objState.type}:`, err);
            // Continue with other objects even if one fails
            continue;
          }
        }
        
        // Update controls and UI
        updateDragControls();
        updateObjectControlButtons(false);
      } catch (err) {
        console.error('Error applying history state:', err);
        throw err; // Propagate error for handling in undo/redo
      }
    }
  }
  
  // History Manager Class
  class HistoryManager {
    constructor(maxStates = 50) {
      this.undoStack = [];
      this.redoStack = [];
      this.maxStates = maxStates;
      this.isApplyingState = false;
      this.lastSaveTimestamp = 0;
      this.minTimeBetweenStates = 100; // ms
    }
  
    shouldSaveState() {
      const now = Date.now();
      return now - this.lastSaveTimestamp >= this.minTimeBetweenStates;
    }
  
    saveState() {
      // Prevent recursive saves while applying states
      if (this.isApplyingState) return;
      
      // Throttle state saving
      if (!this.shouldSaveState()) return;
      
      // Don't save if there are no objects
      if (!window.app.objects || window.app.objects.length === 0) return;
  
      try {
        const state = new HistoryState(window.app.objects);
        
        // Compare with previous state to prevent duplicate states
        const previousState = this.undoStack[this.undoStack.length - 1];
        if (previousState && this.areStatesEqual(previousState, state)) {
          return;
        }
  
        this.undoStack.push(state);
        this.lastSaveTimestamp = Date.now();
  
        // Maintain stack size limit
        while (this.undoStack.length > this.maxStates) {
          this.undoStack.shift();
        }
  
        // Clear redo stack when new action is performed
        this.redoStack.length = 0;
        
        // Update UI
        this.updateButtonStates();
      } catch (err) {
        console.error('Error saving state:', err);
      }
    }
  
    areStatesEqual(state1, state2) {
      if (!state1 || !state2) return false;
      if (state1.objects.length !== state2.objects.length) return false;
  
      return state1.objects.every((obj1, index) => {
        const obj2 = state2.objects[index];
        return (
          obj1.type === obj2.type &&
          obj1.position.equals(obj2.position) &&
          obj1.rotation.equals(obj2.rotation) &&
          obj1.scale.equals(obj2.scale) &&
          obj1.id === obj2.id
        );
      });
    }
  
    async undo() {
      if (this.undoStack.length <= 1 || this.isApplyingState) return;
  
      try {
        this.isApplyingState = true;
        
        const currentState = this.undoStack.pop();
        if (currentState) {
          this.redoStack.push(currentState);
        }
  
        const previousState = this.undoStack[this.undoStack.length - 1];
        if (previousState) {
          await previousState.apply();
        }
        
        this.updateButtonStates();
      } catch (err) {
        console.error('Error during undo:', err);
        // Attempt to recover
        this.undoStack.push(...this.redoStack.splice(-1));
      } finally {
        this.isApplyingState = false;
      }
    }
  
    async redo() {
      if (this.redoStack.length === 0 || this.isApplyingState) return;
  
      try {
        this.isApplyingState = true;
        
        const nextState = this.redoStack.pop();
        if (nextState) {
          await nextState.apply();
          this.undoStack.push(nextState);
        }
        
        this.updateButtonStates();
      } catch (err) {
        console.error('Error during redo:', err);
        // Attempt to recover
        this.redoStack.push(...this.undoStack.splice(-1));
      } finally {
        this.isApplyingState = false;
      }
    }
  
    updateButtonStates() {
      const undoButton = document.getElementById('undo');
      const redoButton = document.getElementById('redo');
  
      if (undoButton) {
        undoButton.disabled = this.undoStack.length <= 1;
        // Add visual feedback
        undoButton.classList.toggle('opacity-50', this.undoStack.length <= 1);
      }
      if (redoButton) {
        redoButton.disabled = this.redoStack.length === 0;
        // Add visual feedback
        redoButton.classList.toggle('opacity-50', this.redoStack.length === 0);
      }
    }
  
    clearHistory() {
      this.undoStack = [];
      this.redoStack = [];
      this.saveState(); // Save current state as initial state
    }
  
    // Initialize first state
    initializeHistory() {
      this.clearHistory();
    }
  }
  
  // Create global instance
  window.historyManager = new HistoryManager();
  
  // Setup event listeners with debouncing
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };
  
  const setupHistoryEventListeners = () => {
    const undoButton = document.getElementById('undo');
    const redoButton = document.getElementById('redo');
  
    if (undoButton) {
      undoButton.addEventListener('click', debounce(() => window.historyManager.undo(), 250));
    }
    if (redoButton) {
      redoButton.addEventListener('click', debounce(() => window.historyManager.redo(), 250));
    }
  
    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) { // Support both Windows/Linux and Mac
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            window.historyManager.redo();
          } else {
            window.historyManager.undo();
          }
        } else if (e.key === 'y') {
          e.preventDefault();
          window.historyManager.redo();
        }
      }
    });
  };
  
  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', setupHistoryEventListeners);