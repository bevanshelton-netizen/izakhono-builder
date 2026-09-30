import { registryFetch } from './api';

export default {
  async fetch(request: Request): Promise<Response> {
    return registryFetch(request);
  }
};
