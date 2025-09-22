import { EventEmitter } from '../../src/core/EventEmitter';

describe('EventEmitter', () => {
  let emitter: EventEmitter;
  
  beforeEach(() => {
    emitter = new EventEmitter();
  });
  
  afterEach(() => {
    emitter.removeAllListeners();
  });
  
  describe('Basic functionality', () => {
    test('should add and emit events', () => {
      const handler = jest.fn();
      emitter.on('test', handler);
      
      emitter.emit('test', 'data');
      
      expect(handler).toHaveBeenCalledWith('data');
    });
    
    test('should support multiple listeners for same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      emitter.on('test', handler1);
      emitter.on('test', handler2);
      
      emitter.emit('test', 'data');
      
      expect(handler1).toHaveBeenCalledWith('data');
      expect(handler2).toHaveBeenCalledWith('data');
    });
    
    test('should remove listeners', () => {
      const handler = jest.fn();
      emitter.on('test', handler);
      emitter.off('test', handler);
      
      emitter.emit('test', 'data');
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    test('should support once listeners', () => {
      const handler = jest.fn();
      emitter.once('test', handler);
      
      emitter.emit('test', 'data1');
      emitter.emit('test', 'data2');
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('data1');
    });
  });
  
  describe('Listener management', () => {
    test('should count listeners correctly', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      expect(emitter.listenerCount('test')).toBe(0);
      
      emitter.on('test', handler1);
      expect(emitter.listenerCount('test')).toBe(1);
      
      emitter.on('test', handler2);
      expect(emitter.listenerCount('test')).toBe(2);
      
      emitter.off('test', handler1);
      expect(emitter.listenerCount('test')).toBe(1);
    });
    
    test('should return event names', () => {
      emitter.on('event1', jest.fn());
      emitter.on('event2', jest.fn());
      
      const eventNames = emitter.eventNames();
      expect(eventNames).toContain('event1');
      expect(eventNames).toContain('event2');
      expect(eventNames).toHaveLength(2);
    });
    
    test('should check if has listeners', () => {
      expect(emitter.hasListeners('test')).toBe(false);
      
      emitter.on('test', jest.fn());
      expect(emitter.hasListeners('test')).toBe(true);
      
      emitter.removeAllListeners('test');
      expect(emitter.hasListeners('test')).toBe(false);
    });
  });
  
  describe('Error handling', () => {
    test('should handle listener errors gracefully', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const errorHandler = jest.fn();
      const goodHandler = jest.fn();
      
      emitter.on('error', errorHandler);
      emitter.on('test', () => { throw new Error('Test error'); });
      emitter.on('test', goodHandler);
      
      emitter.emit('test', 'data');
      
      expect(goodHandler).toHaveBeenCalledWith('data');
      expect(errorHandler).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();
      
      consoleError.mockRestore();
    });
  });
  
  describe('Max listeners', () => {
    test('should warn when max listeners exceeded', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
      
      emitter.setMaxListeners(2);
      
      emitter.on('test', jest.fn());
      emitter.on('test', jest.fn());
      expect(consoleWarn).not.toHaveBeenCalled();
      
      emitter.on('test', jest.fn());
      expect(consoleWarn).toHaveBeenCalled();
      
      consoleWarn.mockRestore();
    });
    
    test('should get and set max listeners', () => {
      expect(emitter.getMaxListeners()).toBe(100);
      
      emitter.setMaxListeners(50);
      expect(emitter.getMaxListeners()).toBe(50);
    });
  });
});