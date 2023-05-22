import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mic, MicOff, Video, VideoSlash } from '../icons';
import { useCall, useConnectedUser } from '@stream-io/video-react-bindings';
import { useStreamVideoStoreValue } from '../contexts/StreamVideoContext';
import { CallControlsButton } from './CallControlsButton';
import { theme } from '../theme';
import { useMutingState } from '../hooks/useMutingState';
import { useLocalVideoStream } from '../hooks';
import { VideoRenderer } from './VideoRenderer';
import { Avatar } from './Avatar';
import { AxiosError, StreamVideoParticipant } from '@stream-io/video-client';
import { LOCAL_VIDEO_VIEW_STYLE } from '../constants';

const ParticipantStatus = () => {
  const connectedUser = useConnectedUser();
  const { isAudioMuted, isVideoMuted } = useMutingState();
  return (
    <View style={styles.status}>
      <Text style={styles.userNameLabel}>{connectedUser?.id}</Text>
      {isAudioMuted && (
        <View style={[styles.svgContainerStyle, theme.icon.xs]}>
          <MicOff color={theme.light.error} />
        </View>
      )}
      {isVideoMuted && (
        <View style={[styles.svgContainerStyle, theme.icon.xs]}>
          {isVideoMuted && <VideoSlash color={theme.light.error} />}
        </View>
      )}
    </View>
  );
};

export const LobbyView = () => {
  const localVideoStream = useLocalVideoStream();
  const connectedUser = useConnectedUser();
  const { isAudioMuted, isVideoMuted, toggleAudioState, toggleVideoState } =
    useMutingState();
  const isCameraOnFrontFacingMode = useStreamVideoStoreValue(
    (store) => store.isCameraOnFrontFacingMode,
  );
  const isVideoAvailable = !!localVideoStream && !isVideoMuted;

  const MicIcon = isAudioMuted ? (
    <MicOff color={theme.light.static_white} />
  ) : (
    <Mic color={theme.light.static_black} />
  );
  const VideoIcon = isVideoMuted ? (
    <VideoSlash color={theme.light.static_white} />
  ) : (
    <Video color={theme.light.static_black} />
  );

  const call = useCall();
  const joinCallHandler = async () => {
    try {
      await call?.join({ create: true });
    } catch (error) {
      console.log(error);
      if (error instanceof AxiosError) {
        console.log('Error joining call', error);
        Alert.alert(error.response?.data.message);
      }
    }
  };
  const connectedUserAsParticipant = {
    userId: connectedUser?.id,
    // @ts-ignore
    image: connectedUser?.imageUrl,
    name: connectedUser?.name,
  } as StreamVideoParticipant;

  const muteStatusColor = (status: boolean) => {
    return !status ? theme.light.static_white : theme.light.static_black;
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>Before Joining</Text>
        <Text style={styles.subHeading}>Setup your audio and video</Text>
        <View style={styles.videoView}>
          {isVideoAvailable ? (
            <VideoRenderer
              mirror={isCameraOnFrontFacingMode}
              mediaStream={localVideoStream}
              objectFit="cover"
              style={styles.stream}
            />
          ) : (
            <Avatar participant={connectedUserAsParticipant} />
          )}
          <ParticipantStatus />
        </View>
        <View style={styles.buttonGroup}>
          <CallControlsButton
            onPress={toggleAudioState}
            color={muteStatusColor(isAudioMuted)}
            style={[
              styles.button,
              theme.button.md,
              {
                shadowColor: muteStatusColor(isAudioMuted),
              },
            ]}
          >
            {MicIcon}
          </CallControlsButton>
          <CallControlsButton
            onPress={toggleVideoState}
            color={muteStatusColor(isVideoMuted)}
            style={[
              styles.button,
              theme.button.md,
              {
                shadowColor: muteStatusColor(isVideoMuted),
              },
            ]}
          >
            {VideoIcon}
          </CallControlsButton>
        </View>
        <View style={styles.info}>
          <Text style={styles.infoText}>
            You are about to join a test call at Stream. 3 more people are in
            the call now.
          </Text>
          <Pressable style={styles.joinButton} onPress={joinCallHandler}>
            <Text style={styles.joinButtonText}>Join</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.light.static_grey,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: theme.padding.md,
  },
  heading: {
    color: theme.light.static_white,
    ...theme.fonts.heading4,
  },
  stream: {
    flex: 1,
  },
  subHeading: {
    color: theme.light.text_low_emphasis,
    ...theme.fonts.subtitle,
    marginBottom: theme.margin.sm,
  },
  videoView: {
    backgroundColor: theme.light.disabled,
    height: LOCAL_VIDEO_VIEW_STYLE.height * 2,
    borderRadius: LOCAL_VIDEO_VIEW_STYLE.borderRadius * 2,
    justifyContent: 'center',
    overflow: 'hidden',
    marginVertical: theme.margin.md,
    width: '100%',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: theme.margin.md,
  },
  button: {
    marginHorizontal: theme.margin.sm,
  },
  info: {
    backgroundColor: theme.light.static_overlay,
    padding: theme.padding.md,
    borderRadius: theme.rounded.sm,
    width: '100%',
  },
  infoText: {
    color: theme.light.static_white,
    ...theme.fonts.subtitleBold,
  },
  joinButton: {
    backgroundColor: theme.light.primary,
    borderRadius: theme.rounded.sm,
    marginTop: theme.margin.md,
    justifyContent: 'center',
    paddingVertical: theme.padding.sm,
  },
  joinButtonText: {
    color: theme.light.static_white,
    textAlign: 'center',
    ...theme.fonts.subtitleBold,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: theme.spacing.sm,
    bottom: theme.spacing.sm,
    padding: theme.padding.sm,
    borderRadius: theme.rounded.xs,
    backgroundColor: theme.light.static_overlay,
    zIndex: 10,
  },
  avatar: {
    height: theme.avatar.sm,
    width: theme.avatar.sm,
    borderRadius: theme.avatar.sm / 2,
    alignSelf: 'center',
  },
  userNameLabel: {
    color: theme.light.static_white,
    ...theme.fonts.caption,
  },
  svgContainerStyle: {
    marginLeft: theme.margin.sm,
  },
});
