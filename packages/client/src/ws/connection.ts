import { StreamWebSocketClient } from './StreamWebSocketClient';
import type { StreamWSClient } from './types';
import { CreateUserRequest } from '../gen/video_coordinator_rpc/coordinator_service';

export const createSocketConnection = async (
  endpoint: string,
  apiKey: string,
  token: string,
  user: CreateUserRequest,
): Promise<StreamWSClient> => {
  const wsClient = new StreamWebSocketClient(endpoint, apiKey, token, user);
  await wsClient.ensureAuthenticated();

  return wsClient;
};
