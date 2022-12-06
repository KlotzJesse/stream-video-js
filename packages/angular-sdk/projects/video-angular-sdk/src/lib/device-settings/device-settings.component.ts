import { Component, OnInit } from '@angular/core';
import {
  Call,
  getAudioDevices,
  getAudioOutputDevices,
  getAudioStream,
  getVideoDevices,
  getVideoStream,
  checkIfAudioOutputChangeSupported,
} from '@stream-io/video-client';
import { Observable, Subscription } from 'rxjs';
import { StreamVideoService } from '../video.service';
import { NgxPopperjsTriggers } from 'ngx-popperjs';

@Component({
  selector: 'stream-device-settings',
  templateUrl: './device-settings.component.html',
  styles: [],
})
export class DeviceSettingsComponent implements OnInit {
  currentlyUsedAudioDeviceId?: string;
  currentlyUsedVideoDeviceId?: string;
  currentlyUsedAudioOutputDeviceId?: string;
  audioDevices$: Observable<MediaDeviceInfo[]>;
  videoDevices$: Observable<MediaDeviceInfo[]>;
  audioOutputDevices$: Observable<MediaDeviceInfo[]>;
  popperTrigger = NgxPopperjsTriggers.click;
  isAudioOuputDeviceChangeSupported = checkIfAudioOutputChangeSupported();
  private activeCall?: Call;
  private subscriptions: Subscription[] = [];

  constructor(private streamVideoService: StreamVideoService) {
    this.subscriptions.push(
      this.streamVideoService.activeCall$.subscribe(
        (c) => (this.activeCall = c),
      ),
    );
    this.subscriptions.push(
      this.streamVideoService.activeCallLocalParticipant$.subscribe((p) => {
        this.currentlyUsedAudioDeviceId = p?.audioDeviceId;
        this.currentlyUsedVideoDeviceId = p?.videoDeviceId;
        this.currentlyUsedAudioOutputDeviceId = p?.audioOutputDeviceId;
      }),
    );
    this.audioDevices$ = getAudioDevices();
    this.videoDevices$ = getVideoDevices();
    this.audioOutputDevices$ = getAudioOutputDevices();
  }

  ngOnInit(): void {}

  async changeInputDevice(
    kind: Exclude<MediaDeviceKind, 'audiooutput'>,
    event: any,
  ) {
    const deviceId = event.target.value;
    try {
      if (kind === 'audioinput') {
        const audioStream = await getAudioStream(deviceId);
        await this.activeCall?.publishAudioStream(audioStream);
      } else if (kind === 'videoinput') {
        const videoStream = await getVideoStream(deviceId);
        await this.activeCall?.publishVideoStream(videoStream);
      } else {
        console.warn(`Unsupported device kind: ${kind}`);
      }
    } catch (error) {
      console.error(`Error during device changing`, error);
      throw error;
    }
  }

  async changeOutputDevice(event: any) {
    const deviceId = event.target.value;
    this.activeCall?.setAudioOutputDevice(deviceId);
  }
}
