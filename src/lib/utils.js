// src/lib/utils.js

/**
 * Utility function to conditionally join class names
 * @param {...string} classes - class names to join
 * @returns {string} - the combined class names
 */
export function cn(...classes) {
    return classes.filter(Boolean).join(' ');
  }
  