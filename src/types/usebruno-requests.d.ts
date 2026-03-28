declare module '@usebruno/requests' {
  import type { AxiosInstance, AxiosRequestConfig } from 'axios';

  /**
   * Creates a configured Axios instance with response timing interceptors
   */
  export function makeAxiosInstance(
    customRequestConfig?: AxiosRequestConfig,
  ): AxiosInstance;

  /**
   * Get system proxy configuration
   */
  export function getSystemProxy(): Promise<{
    http?: string;
    https?: string;
  }>;
}
