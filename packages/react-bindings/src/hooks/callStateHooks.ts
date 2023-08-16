import { useMemo } from 'react';
import {
  CallIngressResponse,
  CallSessionResponse,
  CallSettingsResponse,
  CallState,
  CallStatsReport,
  Comparator,
  EgressResponse,
  MemberResponse,
  StreamVideoParticipant,
  UserResponse,
} from '@stream-io/video-client';
import { useCall } from '../contexts';
import { useObservableValue } from './useObservableValue';

/**
 * Utility hook, which provides the current call's state.
 *
 * @category Call State
 */
export const useCallState = () => {
  const call = useCall();
  // return an empty and unlinked CallState object if there is no call in the provider
  // this ensures that the hooks always return a value and many null checks can be avoided
  if (!call) {
    const message =
      'You are using useCallState() outside a Call context. ' +
      'Please wrap your component in <StreamCall /> and provide a "call" instance.';
    console.warn(message);
    return new CallState();
  }
  return call.state;
};

/**
 * Utility hook which provides information whether the current call is being recorded. It will return `true` if the call is being recorded.
 *
 * @category Call State
 */
export const useIsCallRecordingInProgress = (): boolean => {
  const { recording$ } = useCallState();
  return useObservableValue(recording$);
};

/**
 * Utility hook which provides information whether the current call is broadcasting.
 *
 * @category Call State
 */
export const useIsCallBroadcastingInProgress = (): boolean => {
  const { egress$ } = useCallState();
  const egress = useObservableValue(egress$);
  if (!egress) return false;
  return egress.broadcasting;
};

/**
 * Utility hook which provides information whether the current call is live.
 *
 * @category Call State
 */
export const useIsCallLive = (): boolean => {
  const { backstage$ } = useCallState();
  const isBackstageOn = useObservableValue(backstage$);
  return !isBackstageOn;
};

/**
 * Returns the list of blocked users in the current call.
 */
export const useCallBlockedUserIds = (): string[] => {
  const { blockedUserIds$ } = useCallState();
  return useObservableValue(blockedUserIds$);
};

/**
 * Returns the timestamp when this call was created.
 */
export const useCallCreatedAt = (): Date | undefined => {
  const { createdAt$ } = useCallState();
  return useObservableValue(createdAt$);
};

/**
 * Returns the timestamp when this call was ended.
 */
export const useCallEndedAt = (): Date | undefined => {
  const { endedAt$ } = useCallState();
  return useObservableValue(endedAt$);
};

/**
 * Returns the timestamp telling when the call is scheduled to start.
 */
export const useCallStartsAt = (): Date | undefined => {
  const { startsAt$ } = useCallState();
  return useObservableValue(startsAt$);
};

/**
 * Returns the timestamp when this call was updated.
 */
export const useCallUpdatedAt = (): Date | undefined => {
  const { updatedAt$ } = useCallState();
  return useObservableValue(updatedAt$);
};

/**
 * Returns the information about the call's creator.
 */
export const useCallCreatedBy = (): UserResponse | undefined => {
  const { createdBy$ } = useCallState();
  return useObservableValue(createdBy$);
};

/**
 * Returns the call's custom data.
 */
export const useCallCustomData = (): Record<string, any> => {
  const { custom$ } = useCallState();
  return useObservableValue(custom$);
};

/**
 * Returns the call's Egress information.
 */
export const useCallEgress = (): EgressResponse | undefined => {
  const { egress$ } = useCallState();
  return useObservableValue(egress$);
};

/**
 * Returns the call's Ingress information.
 */
export const useCallIngress = (): CallIngressResponse | undefined => {
  const { ingress$ } = useCallState();
  return useObservableValue(ingress$);
};

/**
 * Returns the data for the current call session.
 */
export const useCallSession = (): CallSessionResponse | undefined => {
  const { session$ } = useCallState();
  return useObservableValue(session$);
};

/**
 * Returns the call's settings.
 */
export const useCallSettings = (): CallSettingsResponse | undefined => {
  const { settings$ } = useCallState();
  return useObservableValue(settings$);
};

/**
 * Returns whether the call has transcribing enabled.
 */
export const useIsCallTranscribingInProgress = (): boolean => {
  const { transcribing$ } = useCallState();
  return useObservableValue(transcribing$);
};

/**
 * Returns information about the user who has marked this call as ended.
 */
export const useCallEndedBy = (): UserResponse | undefined => {
  const { endedBy$ } = useCallState();
  return useObservableValue(endedBy$);
};

/**
 * Utility hook which provides a boolean indicating whether there is
 * a participant in the current call which shares their screen.
 *
 * @category Call State
 */
export const useHasOngoingScreenShare = (): boolean => {
  const { hasOngoingScreenShare$ } = useCallState();
  return useObservableValue(hasOngoingScreenShare$);
};

/**
 * Utility hook which provides the latest stats report of the current call.
 *
 * The latest stats report of the current call.
 * When stats gathering is enabled, this observable will emit a new value
 * at a regular (configurable) interval.
 *
 * Consumers of this observable can implement their own batching logic
 * in case they want to show historical stats data.
 *
 * @category Call State
 */
export const useCallStatsReport = (): CallStatsReport | undefined => {
  const { callStatsReport$ } = useCallState();
  return useObservableValue(callStatsReport$);
};

/**
 * Utility hook which provides the dominant speaker of the current call.
 *
 * @category Call State
 */
export const useDominantSpeaker = (): StreamVideoParticipant | undefined => {
  const { dominantSpeaker$ } = useCallState();
  return useObservableValue(dominantSpeaker$);
};

/**
 * Utility hook which provides a list of call members.
 *
 * @category Call State
 */
export const useCallMembers = (): MemberResponse[] => {
  const { members$ } = useCallState();
  return useObservableValue(members$);
};

/**
 * Utility hook providing the current calling state of the call. For example, `RINGING` or `JOINED`.
 *
 * @category Call State
 */
export const useCallCallingState = () => {
  const { callingState$ } = useCallState();
  return useObservableValue(callingState$);
};

/**
 * Utility hook providing the actual start time of the current session.
 * Useful for calculating the call duration.
 *
 * @category Call State
 */
export const useCallStartedAt = () => {
  const { startedAt$ } = useCallState();
  return useObservableValue(startedAt$);
};

/**
 * A hook which provides a list of all participants that have joined an active call.
 *
 * @category Call State
 *
 * @param options.sortBy - A comparator function to sort the participants by.
 * Make sure to memoize output of the `combineComparators` function
 * (or keep it out of component's scope if possible) before passing it down to this property.
 */
export const useParticipants = ({
  sortBy,
}: {
  /**
   * Make sure to memoize output of the `combineComparators` function
   * (or keep it out of component's scope if possible) before passing it down to this property.
   */
  sortBy?: Comparator<StreamVideoParticipant>;
} = {}) => {
  const { participants$ } = useCallState();
  const participants = useObservableValue(participants$);

  return useMemo(() => {
    if (sortBy) {
      return [...participants].sort(sortBy);
    }
    return participants;
  }, [participants, sortBy]);
};

/**
 * A hook which provides a StreamVideoLocalParticipant object.
 * It signals that I have joined a call.
 *
 * @category Call State
 */
export const useLocalParticipant = () => {
  const { localParticipant$ } = useCallState();
  return useObservableValue(localParticipant$);
};

/**
 * A hook which provides a list of all other participants than me that have joined an active call.
 *
 * @category Call State
 */
export const useRemoteParticipants = () => {
  const { remoteParticipants$ } = useCallState();
  return useObservableValue(remoteParticipants$);
};

/**
 * Returns the approximate participant count of the active call.
 * This includes the anonymous users as well, and it is computed on the server.
 *
 * @category Call State
 */
export const useParticipantCount = () => {
  const { participantCount$ } = useCallState();
  return useObservableValue(participantCount$);
};

/**
 * Returns the approximate anonymous participant count of the active call.
 * The regular participants are not included in this count. It is computed on the server.
 *
 * @category Call State
 */
export const useAnonymousParticipantCount = () => {
  const { anonymousParticipantCount$ } = useCallState();
  return useObservableValue(anonymousParticipantCount$);
};