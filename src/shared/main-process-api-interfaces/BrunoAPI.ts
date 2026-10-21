import type {
  BrunoRequest,
  BrunoResponse,
  BrunoEnvironment,
} from '@principal-ade/bruno-panels';
import type {
  OpenRequestEnvelope,
  SavedRequest,
  CatalogRequest,
} from '../requests/preparedRequest';

/**
 * Bruno API Events for IPC communication
 */
export enum BrunoAPIEvent {
  SEND_REQUEST = 'bruno:sendRequest',
  LOAD_BRU_REQUEST = 'bruno:loadBruRequest',
  LOAD_ENVIRONMENTS = 'bruno:loadEnvironments',
  OPEN = 'bruno:open',
  OPENED = 'bruno:opened',
  LIST_SAVED = 'bruno:listSaved',
  PIN = 'bruno:pin',
  UNPIN = 'bruno:unpin',
  LIST_ROUTES = 'bruno:listRoutes',
  UPDATE_ROUTE = 'bruno:updateRoute',
  FORGET_ROUTE = 'bruno:forgetRoute',
  CATALOG_CHANGED = 'bruno:catalogChanged',
}

/**
 * Bruno Panel API Interface
 */
export interface BrunoAPI {
  onOpenRequest: (
    callback: (request: OpenRequestEnvelope) => void,
  ) => () => void;
  acknowledgeOpen: (requestId: string, tabId: string) => void;
  listSaved: () => Promise<SavedRequest[]>;
  pin: (request: SavedRequest) => Promise<SavedRequest[]>;
  unpin: (id: string) => Promise<SavedRequest[]>;
  listRoutes: () => Promise<CatalogRequest[]>;
  updateRoute: (request: SavedRequest) => Promise<CatalogRequest[]>;
  forgetRoute: (id: string) => Promise<CatalogRequest[]>;
  onCatalogChanged: (callback: () => void) => () => void;
  /**
   * Send an HTTP request using Bruno request format
   */
  sendRequest: (
    request: BrunoRequest,
    environment?: Record<string, string>,
  ) => Promise<BrunoResponse>;

  /**
   * Load and parse a .bru file, returning a BrunoRequest.
   * Parsing happens on the host side using @usebruno/lang.
   */
  loadBruRequest: (path: string) => Promise<BrunoRequest>;

  /**
   * Load all environments from environments/*.json files in the collection
   */
  loadEnvironments: (collectionPath: string) => Promise<BrunoEnvironment[]>;
}
