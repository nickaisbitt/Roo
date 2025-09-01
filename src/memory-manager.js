/**
 * Memory management and cleanup utilities for Roo
 * Prevents memory leaks and handles proper resource disposal
 */

import { EventEmitter } from 'events';
import os from 'os';

/**
 * Task manager with automatic cleanup and memory leak prevention
 */
export class TaskManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.tasks = new Map();
    this.disposed = false;
    this.maxTasks = options.maxTasks || 100;
    this.gcInterval = options.gcInterval || 30000; // 30 seconds
    this.cleanupTimer = null;
    
    // Set maximum listeners to prevent memory leak warnings
    this.setMaxListeners(this.maxTasks);
    
    // Start automatic cleanup
    this.startAutomaticCleanup();
    
    // Handle process termination
    this.setupGracefulShutdown();
  }
  
  /**
   * Create a new task with automatic cleanup
   */
  createTask(id, taskFunction, options = {}) {
    if (this.disposed) {
      throw new Error('TaskManager has been disposed');
    }
    
    if (this.tasks.size >= this.maxTasks) {
      throw new Error(`Maximum number of tasks (${this.maxTasks}) exceeded`);
    }
    
    const task = new Task(id, taskFunction, options);
    this.tasks.set(id, task);
    
    // Auto-remove task when completed or failed
    task.once('completed', () => this.removeTask(id));
    task.once('failed', () => this.removeTask(id));
    
    this.emit('taskCreated', task);
    return task;
  }
  
  /**
   * Remove and cleanup a specific task
   */
  removeTask(id) {
    const task = this.tasks.get(id);
    if (task) {
      task.dispose();
      this.tasks.delete(id);
      this.emit('taskRemoved', id);
    }
  }
  
  /**
   * Get task by ID
   */
  getTask(id) {
    return this.tasks.get(id);
  }
  
  /**
   * Get all active tasks
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }
  
  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    const memoryUsage = process.memoryUsage();
    return {
      taskCount: this.tasks.size,
      memoryUsage: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024) // MB
      },
      systemMemory: {
        total: Math.round(os.totalmem() / 1024 / 1024), // MB
        free: Math.round(os.freemem() / 1024 / 1024) // MB
      }
    };
  }
  
  /**
   * Force garbage collection and cleanup
   */
  forceCleanup() {
    // Remove completed/failed tasks
    for (const [id, task] of this.tasks.entries()) {
      if (task.isCompleted() || task.isFailed()) {
        this.removeTask(id);
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    this.emit('cleanupCompleted', this.getMemoryStats());
  }
  
  /**
   * Start automatic cleanup timer
   */
  startAutomaticCleanup() {
    if (this.cleanupTimer) return;
    
    this.cleanupTimer = setInterval(() => {
      if (!this.disposed) {
        this.forceCleanup();
      }
    }, this.gcInterval);
  }
  
  /**
   * Stop automatic cleanup timer
   */
  stopAutomaticCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
  
  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const cleanup = () => {
      if (!this.disposed) {
        this.dispose();
      }
    };
    
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    process.once('beforeExit', cleanup);
  }
  
  /**
   * Dispose of all resources and cleanup
   */
  dispose() {
    if (this.disposed) return;
    
    this.disposed = true;
    this.stopAutomaticCleanup();
    
    // Dispose all tasks
    for (const [id, task] of this.tasks.entries()) {
      task.dispose();
    }
    this.tasks.clear();
    
    // Remove all listeners to prevent memory leaks
    this.removeAllListeners();
    
    this.emit('disposed');
  }
}

/**
 * Individual task with lifecycle management
 */
export class Task extends EventEmitter {
  constructor(id, taskFunction, options = {}) {
    super();
    this.id = id;
    this.taskFunction = taskFunction;
    this.status = 'pending';
    this.result = null;
    this.error = null;
    this.createdAt = new Date();
    this.completedAt = null;
    this.disposed = false;
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.timeoutTimer = null;
    
    // Set up timeout if specified
    if (this.timeout > 0) {
      this.timeoutTimer = setTimeout(() => {
        if (this.status === 'pending' || this.status === 'running') {
          this.fail(new Error(`Task ${id} timed out after ${this.timeout}ms`));
        }
      }, this.timeout);
    }
  }
  
  /**
   * Execute the task
   */
  async execute(...args) {
    if (this.disposed) {
      throw new Error('Task has been disposed');
    }
    
    if (this.status !== 'pending') {
      throw new Error(`Task ${this.id} is already ${this.status}`);
    }
    
    this.status = 'running';
    this.emit('started');
    
    try {
      this.result = await this.taskFunction(...args);
      this.complete();
    } catch (error) {
      this.fail(error);
    }
    
    return this.result;
  }
  
  /**
   * Mark task as completed
   */
  complete() {
    if (this.disposed || this.status === 'completed' || this.status === 'failed') {
      return;
    }
    
    this.status = 'completed';
    this.completedAt = new Date();
    this.clearTimeout();
    this.emit('completed', this.result);
  }
  
  /**
   * Mark task as failed
   */
  fail(error) {
    if (this.disposed || this.status === 'completed' || this.status === 'failed') {
      return;
    }
    
    this.status = 'failed';
    this.error = error;
    this.completedAt = new Date();
    this.clearTimeout();
    this.emit('failed', error);
  }
  
  /**
   * Check if task is completed
   */
  isCompleted() {
    return this.status === 'completed';
  }
  
  /**
   * Check if task is failed
   */
  isFailed() {
    return this.status === 'failed';
  }
  
  /**
   * Check if task is running
   */
  isRunning() {
    return this.status === 'running';
  }
  
  /**
   * Get task duration in milliseconds
   */
  getDuration() {
    if (!this.completedAt) return null;
    return this.completedAt.getTime() - this.createdAt.getTime();
  }
  
  /**
   * Clear timeout timer
   */
  clearTimeout() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
  
  /**
   * Dispose of task resources
   */
  dispose() {
    if (this.disposed) return;
    
    this.disposed = true;
    this.clearTimeout();
    this.removeAllListeners();
    
    // Clear references to prevent memory leaks
    this.taskFunction = null;
    this.result = null;
    this.error = null;
  }
}

/**
 * Resource context manager for automatic cleanup
 * Similar to Python's context managers
 */
export class ResourceContext {
  constructor() {
    this.resources = [];
    this.disposed = false;
  }
  
  /**
   * Add a resource for automatic cleanup
   */
  addResource(resource, cleanupFunction = null) {
    if (this.disposed) {
      throw new Error('ResourceContext has been disposed');
    }
    
    this.resources.push({
      resource,
      cleanup: cleanupFunction || (resource => {
        if (resource && typeof resource.dispose === 'function') {
          resource.dispose();
        } else if (resource && typeof resource.close === 'function') {
          resource.close();
        } else if (resource && typeof resource.end === 'function') {
          resource.end();
        }
      })
    });
    
    return resource;
  }
  
  /**
   * Remove a specific resource
   */
  removeResource(resource) {
    const index = this.resources.findIndex(r => r.resource === resource);
    if (index !== -1) {
      const { cleanup } = this.resources[index];
      this.resources.splice(index, 1);
      
      try {
        cleanup(resource);
      } catch (error) {
        console.warn('Error during resource cleanup:', error.message);
      }
    }
  }
  
  /**
   * Dispose all resources
   */
  dispose() {
    if (this.disposed) return;
    
    this.disposed = true;
    
    // Cleanup resources in reverse order (LIFO)
    while (this.resources.length > 0) {
      const { resource, cleanup } = this.resources.pop();
      
      try {
        cleanup(resource);
      } catch (error) {
        console.warn('Error during resource cleanup:', error.message);
      }
    }
  }
}

/**
 * Memory monitoring utilities
 */
export class MemoryMonitor {
  constructor(options = {}) {
    this.thresholds = {
      warning: options.warningThreshold || 500, // MB
      critical: options.criticalThreshold || 1000, // MB
      ...options.thresholds
    };
    this.monitorInterval = options.monitorInterval || 10000; // 10 seconds
    this.monitoring = false;
    this.timer = null;
    this.listeners = [];
  }
  
  /**
   * Start memory monitoring
   */
  startMonitoring() {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.timer = setInterval(() => {
      this.checkMemoryUsage();
    }, this.monitorInterval);
  }
  
  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (!this.monitoring) return;
    
    this.monitoring = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  
  /**
   * Add memory threshold listener
   */
  addListener(callback) {
    this.listeners.push(callback);
  }
  
  /**
   * Remove memory threshold listener
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  /**
   * Check current memory usage
   */
  checkMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
    
    const stats = {
      heapUsed: heapUsedMB,
      rss: rssMB,
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      timestamp: new Date()
    };
    
    let level = 'normal';
    if (heapUsedMB > this.thresholds.critical) {
      level = 'critical';
    } else if (heapUsedMB > this.thresholds.warning) {
      level = 'warning';
    }
    
    if (level !== 'normal') {
      this.notifyListeners(level, stats);
    }
    
    return stats;
  }
  
  /**
   * Notify listeners of memory threshold breach
   */
  notifyListeners(level, stats) {
    this.listeners.forEach(callback => {
      try {
        callback(level, stats);
      } catch (error) {
        console.warn('Error in memory monitor listener:', error.message);
      }
    });
  }
  
  /**
   * Get current memory statistics
   */
  getMemoryStats() {
    return this.checkMemoryUsage();
  }
}