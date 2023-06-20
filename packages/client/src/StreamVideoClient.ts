import { Call } from './Call';
import { StreamClient } from './coordinator/connection/client';
import {
  StreamVideoReadOnlyStateStore,
  StreamVideoWriteableStateStore,
} from './store';
import type {
  ConnectedEvent,
  CreateCallTypeRequest,
  CreateCallTypeResponse,
  CreateDeviceRequest,
  CreateGuestRequest,
  CreateGuestResponse,
  GetCallTypeResponse,
  GetEdgesResponse,
  ListCallTypeResponse,
  ListDevicesResponse,
  QueryCallsRequest,
  QueryCallsResponse,
  UpdateCallTypeRequest,
  UpdateCallTypeResponse,
} from './gen/coordinator';
import type {
  ConnectionChangedEvent,
  EventHandler,
  EventTypes,
  LogLevel,
  Logger,
  StreamClientOptions,
  TokenOrProvider,
  TokenProvider,
  User,
  UserWithId,
} from './coordinator/connection/types';
import { getLogger, logToConsole, setLogger } from './logger';

/**
 * A `StreamVideoClient` instance lets you communicate with our API, and authenticate users.
 */
export class StreamVideoClient {
  /**
   * A reactive store that exposes all the state variables in a reactive manner - you can subscribe to changes of the different state variables. Our library is built in a way that all state changes are exposed in this store, so all UI changes in your application should be handled by subscribing to these variables.
   */
  readonly readOnlyStateStore: StreamVideoReadOnlyStateStore;
  readonly user?: User;
  readonly token?: TokenOrProvider;
  readonly logLevel: LogLevel = 'warn';
  readonly logger: Logger;

  private readonly writeableStateStore: StreamVideoWriteableStateStore;
  streamClient: StreamClient;

  private eventHandlersToUnregister: Array<() => void> = [];
  private connectionPromise: Promise<void | ConnectedEvent> | undefined;
  private disconnectionPromise: Promise<void> | undefined;
  private logLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

  /**
   * You should create only one instance of `StreamVideoClient`.
   */
  constructor(apiKey: string, opts?: StreamClientOptions);
  constructor(args: {
    apiKey: string;
    options?: StreamClientOptions;
    user?: User;
    token?: string;
    tokenProvider?: TokenProvider;
  });
  constructor(
    apiKeyOrArgs:
      | string
      | {
          apiKey: string;
          options?: StreamClientOptions;
          user?: User;
          token?: string;
          tokenProvider?: TokenProvider;
        },
    opts?: StreamClientOptions,
  ) {
    let defaultLogger: Logger = logToConsole;
    if (typeof apiKeyOrArgs === 'string') {
      this.logLevel = opts?.logLevel || this.logLevel;
      this.logger = opts?.logger || defaultLogger;
    } else {
      this.logLevel = apiKeyOrArgs.options?.logLevel || this.logLevel;
      this.logger = apiKeyOrArgs.options?.logger || defaultLogger;
    }

    setLogger(this.filterLogs(this.logger));

    const clientLogger = getLogger(['client']);

    if (typeof apiKeyOrArgs === 'string') {
      this.streamClient = new StreamClient(apiKeyOrArgs, {
        persistUserOnConnectionFailure: true,
        ...opts,
        logLevel: this.logLevel,
        logger: clientLogger,
      });
    } else {
      this.streamClient = new StreamClient(apiKeyOrArgs.apiKey, {
        persistUserOnConnectionFailure: true,
        ...apiKeyOrArgs.options,
        logLevel: this.logLevel,
        logger: clientLogger,
      });

      this.user = apiKeyOrArgs.user;
      this.token = apiKeyOrArgs.token || apiKeyOrArgs.tokenProvider;
      if (this.user) {
        this.streamClient.startWaitingForConnection();
      }
    }

    this.writeableStateStore = new StreamVideoWriteableStateStore();
    this.readOnlyStateStore = new StreamVideoReadOnlyStateStore(
      this.writeableStateStore,
    );
  }

  /**
   * Connects the given user to the client.
   * Only one user can connect at a time, if you want to change users, call `disconnectUser` before connecting a new user.
   * If the connection is successful, the connected user [state variable](#readonlystatestore) will be updated accordingly.
   *
   * @param user the user to connect.
   * @param token a token or a function that returns a token.
   */
  async connectUser(
    user?: User,
    token?: TokenOrProvider,
  ): Promise<void | ConnectedEvent> {
    const userToConnect = user || this.user;
    const tokenToUse = token || this.token;
    if (!userToConnect) {
      throw new Error('Connect user is called without user');
    }
    if (userToConnect.type === 'anonymous') {
      userToConnect.id = '!anon';
      return this.connectAnonymousUser(userToConnect as UserWithId, tokenToUse);
    }
    if (userToConnect.type === 'guest') {
      const response = await this.createGuestUser({
        user: {
          ...userToConnect,
          role: 'guest',
        },
      });
      return this.connectUser(response.user, response.access_token);
    }
    const connectUser = () => {
      return this.streamClient.connectUser(userToConnect, tokenToUse);
    };
    this.connectionPromise = this.disconnectionPromise
      ? this.disconnectionPromise.then(() => connectUser())
      : connectUser();

    this.connectionPromise?.finally(() => (this.connectionPromise = undefined));
    const connectUserResponse = await this.connectionPromise;
    // connectUserResponse will be void if connectUser called twice for the same user
    if (connectUserResponse?.me) {
      this.writeableStateStore.setConnectedUser(connectUserResponse.me);
    }

    this.eventHandlersToUnregister.push(
      this.on('connection.changed', (e) => {
        const event = e as ConnectionChangedEvent;
        if (event.online) {
          const callsToReWatch = this.writeableStateStore.calls
            .filter((call) => call.watching)
            .map((call) => call.cid);

          if (callsToReWatch.length > 0) {
            this.queryCalls({
              watch: true,
              filter_conditions: {
                cid: { $in: callsToReWatch },
              },
              sort: [{ field: 'cid', direction: 1 }],
            }).catch((err) => {
              this.logger('error', 'Failed to re-watch calls', err);
            });
          }
        }
      }),
    );

    this.eventHandlersToUnregister.push(
      this.on('call.created', (event) => {
        if (event.type !== 'call.created') return;
        const { call, members } = event;
        if (userToConnect.id === call.created_by.id) {
          this.logger(
            'warn',
            'Received `call.created` sent by the current user',
          );
          return;
        }

        this.writeableStateStore.registerCall(
          new Call({
            streamClient: this.streamClient,
            type: call.type,
            id: call.id,
            metadata: call,
            members,
            clientStore: this.writeableStateStore,
          }),
        );
      }),
    );

    this.eventHandlersToUnregister.push(
      this.on('call.ring', async (event) => {
        if (event.type !== 'call.ring') return;
        const { call, members } = event;
        if (userToConnect.id === call.created_by.id) {
          this.logger('warn', 'Received `call.ring` sent by the current user');
          return;
        }

        // The call might already be tracked by the client,
        // if `call.created` was received before `call.ring`.
        // In that case, we cleanup the already tracked call.
        const prevCall = this.writeableStateStore.findCall(call.type, call.id);
        const prevMetadata = prevCall?.state.metadata;
        await prevCall?.leave();
        // we create a new call
        const theCall = new Call({
          streamClient: this.streamClient,
          type: call.type,
          id: call.id,
          members,
          clientStore: this.writeableStateStore,
          ringing: true,
          metadata: prevMetadata,
        });
        // we fetch the latest metadata for the call from the server
        await theCall.get();
        this.writeableStateStore.registerCall(theCall);
      }),
    );

    return connectUserResponse;
  }

  /**
   * Disconnects the currently connected user from the client.
   *
   * If the connection is successfully disconnected, the connected user [state variable](#readonlystatestore) will be updated accordingly
   *
   * @param timeout Max number of ms, to wait for close event of websocket, before forcefully assuming successful disconnection.
   *                https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
   */
  disconnectUser = async (timeout?: number) => {
    if (!this.streamClient.user) {
      return;
    }
    const disconnectUser = () => this.streamClient.disconnectUser(timeout);
    this.disconnectionPromise = this.connectionPromise
      ? this.connectionPromise.then(() => disconnectUser())
      : disconnectUser();
    this.disconnectionPromise.finally(
      () => (this.disconnectionPromise = undefined),
    );
    await this.disconnectionPromise;
    this.eventHandlersToUnregister.forEach((unregister) => unregister());
    this.eventHandlersToUnregister = [];
    this.writeableStateStore.setConnectedUser(undefined);
  };

  /**
   * You can subscribe to WebSocket events provided by the API.
   * To remove a subscription, call the `off` method or, execute the returned unsubscribe function.
   * Please note that subscribing to WebSocket events is an advanced use-case, for most use-cases it should be enough to watch for changes in the reactive [state store](#readonlystatestore).
   *
   * @param eventName the event name or 'all'.
   * @param callback the callback which will be called when the event is emitted.
   * @returns an unsubscribe function.
   */
  on = (eventName: EventTypes, callback: EventHandler) => {
    return this.streamClient.on(eventName, callback);
  };

  /**
   * Remove subscription for WebSocket events that were created by the `on` method.
   *
   * @param event the event name.
   * @param callback the callback which was passed to the `on` method.
   */
  off = (event: string, callback: EventHandler) => {
    return this.streamClient.off(event, callback);
  };

  /**
   * Creates a new call.
   *
   * @param type the type of the call.
   * @param id the id of the call, if not provided a unique random value is used
   * @param {boolean} [ringing] whether the call should be created in the ringing state.
   */
  call = (type: string, id: string, ringing?: boolean) => {
    return new Call({
      streamClient: this.streamClient,
      id: id,
      type: type,
      clientStore: this.writeableStateStore,
      ringing,
    });
  };

  /**
   * Creates a new guest user with the given data.
   *
   * @param data the data for the guest user.
   */
  createGuestUser = async (data: CreateGuestRequest) => {
    return this.streamClient.doAxiosRequest<
      CreateGuestResponse,
      CreateGuestRequest
    >('post', '/guest', data, { publicEndpoint: true });
  };

  /**
   * Will query the API for calls matching the given filters.
   *
   * @param data the query data.
   */
  queryCalls = async (data: QueryCallsRequest) => {
    if (data.watch) await this.streamClient.connectionIdPromise;
    const response = await this.streamClient.post<
      QueryCallsResponse,
      QueryCallsRequest
    >('/calls', data);
    const calls = response.calls.map((c) => {
      const call = new Call({
        streamClient: this.streamClient,
        id: c.call.id,
        type: c.call.type,
        metadata: c.call,
        members: c.members,
        ownCapabilities: c.own_capabilities,
        watching: data.watch,
        clientStore: this.writeableStateStore,
      });
      if (data.watch) {
        this.writeableStateStore.registerCall(call);
      }
      return call;
    });
    return {
      ...response,
      calls: calls,
    };
  };

  queryUsers = async () => {
    console.log('Querying users is not implemented yet.');
  };

  edges = async () => {
    return this.streamClient.get<GetEdgesResponse>(`/edges`);
  };

  // server-side only endpoints
  createCallType = async (data: CreateCallTypeRequest) => {
    return this.streamClient.post<CreateCallTypeResponse>(`/calltypes`, data);
  };

  getCallType = async (name: string) => {
    return this.streamClient.get<GetCallTypeResponse>(`/calltypes/${name}`);
  };

  updateCallType = async (name: string, data: UpdateCallTypeRequest) => {
    return this.streamClient.put<UpdateCallTypeResponse>(
      `/calltypes/${name}`,
      data,
    );
  };

  deleteCallType = async (name: string) => {
    return this.streamClient.delete(`/calltypes/${name}`);
  };

  listCallTypes = async () => {
    return this.streamClient.get<ListCallTypeResponse>(`/calltypes`);
  };

  /**
   * addDevice - Adds a push device for a user.
   *
   * @param {string} id the device id
   * @param {string} push_provider the push provider name (eg. apn, firebase)
   * @param {string} push_provider_name user provided push provider name
   * @param {string} [userID] the user id (defaults to current user)
   */
  addDevice = async (
    id: string,
    push_provider: string,
    push_provider_name?: string,
    userID?: string,
    voip_token?: boolean,
  ) => {
    return await this.streamClient.post<CreateDeviceRequest>('/devices', {
      id,
      push_provider,
      voip_token,
      ...(userID != null ? { user_id: userID } : {}),
      ...(push_provider_name != null ? { push_provider_name } : {}),
    });
  };

  /**
   * addDevice - Adds a push device for a user.
   *
   * @param {string} id the device id
   * @param {string} push_provider the push provider name (eg. apn, firebase)
   * @param {string} push_provider_name user provided push provider name
   * @param {string} [userID] the user id (defaults to current user)
   */
  async addVoipDevice(
    id: string,
    push_provider: string,
    push_provider_name: string,
    userID?: string,
  ) {
    return await this.addDevice(
      id,
      push_provider,
      push_provider_name,
      userID,
      true,
    );
  }

  /**
   * getDevices - Returns the devices associated with a current user
   * @param {string} [userID] User ID. Only works on serverside
   */
  getDevices = async (userID?: string) => {
    return await this.streamClient.get<ListDevicesResponse>(
      '/devices',
      userID ? { user_id: userID } : {},
    );
  };

  /**
   * removeDevice - Removes the device with the given id.
   *
   * @param {string} id The device id
   * @param {string} [userID] The user id. Only specify this for serverside requests
   *
   */
  removeDevice = async (id: string, userID?: string) => {
    return await this.streamClient.delete('/devices', {
      id,
      ...(userID ? { user_id: userID } : {}),
    });
  };

  /**
   * createToken - Creates a token to authenticate this user. This function is used server side.
   * The resulting token should be passed to the client side when the users registers or logs in.
   *
   * @param {string} userID The User ID
   * @param {number} [exp] The expiration time for the token expressed in the number of seconds since the epoch
   * @param call_cids for anonymous tokens you have to provide the call cids the use can join
   *
   * @return {string} Returns a token
   */
  createToken(
    userID: string,
    exp?: number,
    iat?: number,
    call_cids?: string[],
  ) {
    return this.streamClient.createToken(userID, exp, iat, call_cids);
  }

  /**
   * Connects the given anonymous user to the client.
   *
   * @param user the user to connect.
   * @param tokenOrProvider a token or a function that returns a token.
   */
  private connectAnonymousUser = async (
    user: UserWithId,
    tokenOrProvider: TokenOrProvider,
  ) => {
    const connectAnonymousUser = () =>
      this.streamClient.connectAnonymousUser(user, tokenOrProvider);
    this.connectionPromise = this.disconnectionPromise
      ? this.disconnectionPromise.then(() => connectAnonymousUser())
      : connectAnonymousUser();
    this.connectionPromise.finally(() => (this.connectionPromise = undefined));
    return this.connectionPromise;
  };

  private filterLogs = (logMethod: Logger) => {
    return (
      logLevel: LogLevel,
      messeage: string,
      extraData?: Record<string, unknown>,
      tags?: string[],
    ) => {
      if (
        this.logLevels.indexOf(logLevel) >=
        this.logLevels.indexOf(this.logLevel)
      ) {
        logMethod(logLevel, messeage, extraData, tags);
      }
    };
  };
}
