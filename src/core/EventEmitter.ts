import { EventHandler, EngineEvent } from '../types';

/**
 * Universal event emitter for cross-platform compatibility
 * Provides a consistent event interface across all platforms
 */
export class EventEmitter {
  private eventListeners: Map<string, Set<EventHandler>> = new Map();
  private maxListeners: number = 100;
  
  /**
   * Add an event listener
   */
  on(event: EngineEvent | string, handler: EventHandler): this {
    this.addListener(event, handler);
    return this;
  }
  
  /**
   * Add an event listener (alias for on)
   */
  addListener(event: EngineEvent | string, handler: EventHandler): this {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    const listeners = this.eventListeners.get(event)!;
    
    // Check max listeners limit
    if (listeners.size >= this.maxListeners) {
      console.warn(`Warning: Possible EventEmitter memory leak detected. ${listeners.size} listeners added for event "${event}". Use setMaxListeners() to increase limit.`);
    }
    
    listeners.add(handler);
    return this;
  }
  
  /**
   * Add a one-time event listener
   */
  once(event: EngineEvent | string, handler: EventHandler): this {
    const onceWrapper = (data: any) => {
      handler(data);
      this.off(event, onceWrapper);
    };
    
    return this.on(event, onceWrapper);
  }
  
  /**
   * Remove an event listener
   */
  off(event: EngineEvent | string, handler: EventHandler): this {
    return this.removeListener(event, handler);
  }
  
  /**
   * Remove an event listener (alias for off)
   */
  removeListener(event: EngineEvent | string, handler: EventHandler): this {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(handler);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
    return this;
  }
  
  /**
   * Remove all listeners for an event, or all listeners if no event specified
   */
  removeAllListeners(event?: EngineEvent | string): this {
    if (event !== undefined) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
    return this;
  }
  
  /**
   * Emit an event to all listeners
   */
  emit(event: EngineEvent | string, data?: any): boolean {
    const listeners = this.eventListeners.get(event);
    if (!listeners || listeners.size === 0) {
      return false;
    }
    
    // Execute all listeners
    const listenersArray = Array.from(listeners);
    for (const listener of listenersArray) {
      try {
        listener(data);
      } catch (error) {
        // Emit error event for listener errors
        console.error(`Error in event listener for "${event}":`, error);
        this.emit('error', {
          code: 'LISTENER_ERROR',
          message: `Error in event listener for "${event}"`,
          details: { originalError: error, event, data }
        });
      }
    }
    
    return true;
  }
  
  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: EngineEvent | string): number {
    const listeners = this.eventListeners.get(event);
    return listeners ? listeners.size : 0;
  }
  
  /**
   * Get all listeners for an event
   */
  listeners(event: EngineEvent | string): EventHandler[] {
    const listeners = this.eventListeners.get(event);
    return listeners ? Array.from(listeners) : [];
  }
  
  /**
   * Get all event names that have listeners
   */
  eventNames(): string[] {
    return Array.from(this.eventListeners.keys());
  }
  
  /**
   * Set the maximum number of listeners per event
   */
  setMaxListeners(n: number): this {
    if (n < 0) {
      throw new Error('Maximum listeners count must be non-negative');
    }
    this.maxListeners = n;
    return this;
  }
  
  /**
   * Get the maximum number of listeners per event
   */
  getMaxListeners(): number {
    return this.maxListeners;
  }
  
  /**
   * Check if there are any listeners for an event
   */
  hasListeners(event: EngineEvent | string): boolean {
    return this.listenerCount(event) > 0;
  }
}