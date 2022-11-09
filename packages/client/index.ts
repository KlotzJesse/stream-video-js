import 'webrtc-adapter';

export * as SfuEvents from './src/gen/video/sfu/event/events';
export * as SfuModels from './src/gen/video/sfu/models/models';
// due to name collision with `/rtc/Call.ts`
export * as CallMeta from './src/gen/video/coordinator/call_v1/call';

export * from './src/gen/google/protobuf/struct';
export * from './src/gen/video/coordinator/client_v1_rpc/client_rpc';
export * from './src/gen/video/coordinator/edge_v1/edge';
export * from './src/gen/video/coordinator/event_v1/event';
export * from './src/gen/video/coordinator/user_v1/user';

export * from './src/rpc/types';
export * from './src/rtc/types';
export * from './src/ws/types';

export * from './src/stateStore';
export * from './src/rtc/Call';
export * from './src/StreamVideoClient';
export * from './src/StreamSfuClient';
