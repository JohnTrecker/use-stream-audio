import { useRef, useState, useEffect } from 'react';
import audioBufferToWav from 'audiobuffer-to-wav';
import useWebAudio from './useWebAudio';
import useHTML5Audio from './useHTML5Audio';

export interface UseStreamAudioOptions {
  /**
   * Sample rate for the audio context (default: 24000)
   */
  sampleRate?: number;
  /**
   * Enable automatic transition to HTML5 Audio after streaming completes (default: true)
   * This provides more stable playback controls but requires full audio buffering
   */
  enableTransition?: boolean;
  /**
   * Called when playback state changes
   */
  onPlayingChange?: (isPlaying: boolean) => void;
  /**
   * Called when audio is ready for HTML5 playback
   */
  onAudioReady?: () => void;
  /**
   * Called when playback ends
   */
  onEnded?: () => void;
}

/**
 * Helper function to create and schedule an audio source for streaming playback
 */
function createAndScheduleAudioSource(
  audioContext: AudioContext,
  audioBuffer: AudioBuffer,
  startTime: number,
  activeSources: AudioBufferSourceNode[],
): AudioBufferSourceNode {
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start(startTime);
  activeSources.push(source);
  return source;
}

/**
 * Hook for streaming audio playback using dual audio systems:
 *
 * 1. Web Audio API (AudioContext + AudioBufferSourceNode)
 *    - Low-latency streaming audio
 *    - Plays chunks as they arrive
 *
 * 2. HTML5 Audio API (HTMLAudioElement)
 *    - Stable playback controls (seek, rewind, etc.)
 *    - Used after streaming completes (if enableTransition is true)
 *
 * Based on implementation from @n1ckoates at https://github.com/ai-ng/swift/blob/main/app/lib/usePlayer.ts
 */
export default function useStreamAudio(options: UseStreamAudioOptions = {}) {
  const {
    sampleRate = 24000,
    enableTransition = true,
    onPlayingChange,
    onAudioReady,
    onEnded,
  } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState<boolean>(false);
  const [isAudioTransitioned, setIsAudioTransitioned] = useState<boolean>(false);

  // Update playing state and notify callback
  const updatePlayingState = (playing: boolean) => {
    setIsPlaying(playing);
    onPlayingChange?.(playing);
  };

  const webAudio = useWebAudio({
    sampleRate,
    onPlayingChange: updatePlayingState,
  });

  const html5Audio = useHTML5Audio({
    onPlayingChange: updatePlayingState,
  });

  // Time tracking
  const [currentTime, setCurrentTime] = useState<number>(0); // seconds
  const [duration, setDuration] = useState<number>(0); // seconds
  const timeIntervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!isPlaying) return;

    timeIntervalRef.current = setInterval(() => {
      const current = isAudioTransitioned
        ? html5Audio.getCurrentTime()
        : webAudio.getCurrentTime();
      setCurrentTime(current);
    }, 100);

    return () => clearInterval(timeIntervalRef.current);
  }, [isPlaying, isAudioTransitioned, html5Audio, webAudio]);

  // Handle transition between audio systems
  useEffect(() => {
    if (!enableTransition) return;

    if (isAudioReady) {
      // Transfer current playback position to HTML5 Audio
      const currentPosition = currentTime;
      html5Audio.setCurrentTime(currentPosition);
      setIsAudioTransitioned(true);

      onAudioReady?.();

      if (isPlaying) {
        webAudio.stopStream();
        html5Audio.playAudio();
      }
    }
  }, [isAudioReady, enableTransition, currentTime, isPlaying, html5Audio, webAudio, onAudioReady]);

  // Cleanup on unmount
  useEffect(() => () => cleanup(), []);

  /**
   * Stream audio from a ReadableStream of Float32Array audio data
   *
   * @param stream - ReadableStream containing raw audio data (Float32Array)
   * @example
   * ```typescript
   * const stream = new ReadableStream({
   *   start(controller) {
   *     // Push Float32Array chunks
   *     controller.enqueue(new Float32Array([0.1, 0.2, ...]));
   *   }
   * });
   * await streamAudio(stream);
   * ```
   */
  async function streamAudio(stream: ReadableStream<Uint8Array>) {
    resetState();
    webAudio.isAudioPlaying.current = true;
    setCurrentTime(0);

    let nextStartTime = webAudio.getCurrentTime();
    let totalDuration = 0;
    let allBuffers: Float32Array[] = []; // Store chunks for later

    const reader = stream.getReader();
    let leftover = new Uint8Array();
    let result = await reader.read();
    let source: AudioBufferSourceNode | null = null;

    updatePlayingState(true);

    // Process each chunk
    while (!result.done && webAudio.audioContext.current && webAudio.isAudioPlaying.current) {
      // Combine with any leftover data from previous chunk
      let data = new Uint8Array(leftover.length + result.value.length);
      data.set(leftover);
      data.set(result.value, leftover.length);

      // Convert data into Float32 samples
      const length = Math.floor(data.length / 4) * 4;
      const remainder = data.length % 4;

      const buffer = new Float32Array(data.buffer, 0, length / 4);

      // Handle leftover bytes that couldn't make a complete sample
      leftover = new Uint8Array(data.buffer, length, remainder);

      // Only process audio if we have valid samples
      if (buffer.length) {
        // Create an audio buffer and schedule it to play
        const audioBuffer = webAudio.audioContext.current.createBuffer(
          1,
          buffer.length,
          webAudio.audioContext.current.sampleRate,
        );
        audioBuffer.copyToChannel(buffer, 0);
        allBuffers.push(buffer); // Save each chunk

        // Update total duration
        totalDuration += audioBuffer.duration;

        source = createAndScheduleAudioSource(
          webAudio.audioContext.current,
          audioBuffer,
          nextStartTime,
          webAudio.activeSources.current,
        );
        nextStartTime += audioBuffer.duration;
      }

      result = await reader.read();

      if (result.done && enableTransition) {
        // Combine all chunks into one buffer
        const totalLength = allBuffers.reduce((acc, buf) => acc + buf.length, 0);
        const completeBuffer = new Float32Array(totalLength);

        let offset = 0;
        for (const buf of allBuffers) {
          completeBuffer.set(buf, offset);
          offset += buf.length;
        }

        const complete = webAudio.audioContext.current.createBuffer(
          1,
          completeBuffer.length,
          webAudio.audioContext.current.sampleRate,
        );
        complete.copyToChannel(completeBuffer, 0);

        // Update audio duration
        setDuration(complete.duration);

        // Convert complete buffer to WAV for HTMLAudioElement playback
        const wavBuffer = audioBufferToWav(complete);
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        if (html5Audio.audioRef.current) {
          html5Audio.setAudioSource(url);
          html5Audio.setupAudioListeners(
            () => {
              setIsAudioReady(true);
            },
            () => {
              stop();
              onEnded?.();
            },
          );
        }

        // Store for AudioContext playback
        webAudio.originalBuffer.current = complete;
        source?.addEventListener(
          'ended',
          () => {
            stop();
            onEnded?.();
          },
          { once: true },
        );
      } else if (result.done && !enableTransition) {
        // Just set up the ended listener
        source?.addEventListener(
          'ended',
          () => {
            stop();
            onEnded?.();
          },
          { once: true },
        );
      }
    }
  }

  function stop() {
    if (isAudioTransitioned) {
      html5Audio.stopAudio();
    } else {
      webAudio.stopStream();
    }
    updatePlayingState(false);
  }

  function play() {
    if (isAudioTransitioned) {
      html5Audio.playAudio();
    } else {
      webAudio.playStream();
    }
  }

  function pause() {
    if (isAudioTransitioned) {
      html5Audio.pauseAudio();
    } else {
      webAudio.pauseStream();
    }
  }

  function rewind(seconds: number = 5) {
    if (isAudioTransitioned) {
      html5Audio.rewindAudio(seconds, isPlaying);
    }
  }

  function cleanup() {
    if (timeIntervalRef?.current) {
      clearInterval(timeIntervalRef.current);
    }
    html5Audio.cleanup();
    webAudio.cleanup();
  }

  function resetState() {
    stop();
    setIsAudioReady(false);
    setIsAudioTransitioned(false);
    webAudio.resetState();
  }

  return {
    /**
     * Whether audio is currently playing
     */
    isPlaying,

    /**
     * Whether the audio context is suspended (typically on iOS/Safari)
     */
    isAudioSuspended: webAudio.isAudioSuspended,

    /**
     * Stream audio from a ReadableStream
     */
    streamAudio,

    /**
     * Stop playback and reset to beginning
     */
    stop,

    /**
     * Resume playback
     */
    play,

    /**
     * Pause playback
     */
    pause,

    /**
     * Rewind by specified seconds (only available after transition to HTML5)
     */
    rewind,

    /**
     * Current playback time in seconds
     */
    currentTime,

    /**
     * Total duration in seconds
     */
    duration,

    /**
     * Whether rewind is available (only after HTML5 transition)
     */
    isRewindEnabled: isAudioReady,

    /**
     * Whether audio has transitioned to HTML5 playback
     */
    isAudioTransitioned,
  };
}
