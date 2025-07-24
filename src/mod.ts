/**
 * Main source export file for Mnemo and components
 * @module mnemo
 */

export * from './tools/mod.ts'
export * from './embedder/mod.ts'
export * from './client/mod.ts'

export { createMnemo, Mnemo as default, type MnemoOptions, type SearchFromTextOptions } from './mnemo.ts'
