import { Call } from './Call';
import { Dispatcher } from './Dispatcher';
import { StreamVideoWriteableStateStore } from '../stateStore';
import {
  watchParticipantJoined,
  watchParticipantLeft,
} from '../events/participant';
import { watchChangePublishQuality } from '../events/internal';
import {
  watchAudioLevelChanged,
  watchDominantSpeakerChanged,
} from '../events/speaker';

export const registerEventHandlers = <
  RTCPeerConnectionType extends RTCPeerConnection,
>(
  call: Call<RTCPeerConnectionType>,
  store: StreamVideoWriteableStateStore<RTCPeerConnectionType>,
  dispatcher: Dispatcher,
) => {
  watchChangePublishQuality(dispatcher, call);

  watchParticipantJoined(dispatcher, store);
  watchParticipantLeft(dispatcher, store);

  watchAudioLevelChanged(dispatcher, store);
  watchDominantSpeakerChanged(dispatcher, store);
};
