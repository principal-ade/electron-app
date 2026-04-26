export { ScopeManager, type AddToScopeInput } from './ScopeManager';
export { ScopeManagerError } from './types';
export type {
  AddEventInput,
  AddNamespaceInput,
  AddPathToNamespaceInput,
  AddScopeInput,
  EventAttributeSchema,
  EventRecord,
  NamespaceRecord,
  NodePosition,
  ScopeRecord,
  ScopeWorkspace,
} from './types';
export type { EventsCanvasFile, ScopeStore } from './ScopeStore';
export type { RawCanvas } from './canvasIo';
export {
  parseEventsCanvas,
  parseScopesCanvas,
  serializeEventsCanvas,
  serializeScopesCanvas,
} from './canvasIo';
export { InMemoryScopeStore } from './adapters/InMemoryScopeStore';
export {
  CanvasFileScopeStore,
  type CanvasFileScopeStoreOptions,
} from './adapters/CanvasFileScopeStore';
