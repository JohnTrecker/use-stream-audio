import { useRef, useEffect, useState, useCallback } from 'react';

export interface UseWebAudioOptions {
  sampleRate?: number;
  onPlayingChange?: (isPlaying: boolean) => void;
}

/**
 * Custom hook for managing Web Audio API functionality
 * Handles AudioContext, AudioBuffer, and streaming audio operations
 */
export default function useWebAudio(options: UseWebAudioOptions = {}) {
  const { sampleRate = 24000, onPlayingChange } = options;

  // Web Audio API refs
  const audioContext = useRef<AudioContext | null>(null);
  const originalBuffer = useRef<AudioBuffer | null>(null);
  const activeSources = useRef<AudioBufferSourceNode[]>([]);
  const isAudioPlaying = useRef<boolean>(false);
  const [isAudioSuspended, setIsAudioSuspended] = useState<boolean>(false);

  /**
   * Initialize AudioContext and set up iOS/Safari unlock listeners
   * On iOS/Safari, the AudioContext is automatically suspended when the user navigates away from the page.
   * This listener resumes the context when the user clicks or touches the screen.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!audioContext.current) {
      audioContext.current = new AudioContext({ sampleRate });
    }
    const localAudioContext = audioContext.current;

    const handleStateChange = () => {
      setIsAudioSuspended(localAudioContext.state === 'suspended');
    };

    localAudioContext.addEventListener('statechange', handleStateChange);
    handleStateChange(); // Initial check for suspended state on load

    return () => {
      localAudioContext.removeEventListener('statechange', handleStateChange);
    };
  }, [sampleRate]);

  useEffect(() => {
    if (!isAudioSuspended) return;

    const unlock = () => {
      audioContext.current?.resume();
    };

    window.addEventListener('click', unlock);
    window.addEventListener('touchend', unlock);

    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchend', unlock);
    };
  }, [isAudioSuspended]);

  /**
   * Stop all active audio sources and clear the sources array
   */
  const stopStream = useCallback(() => {
    isAudioPlaying.current = false;
    for (const src of activeSources.current) {
      try {
        src.stop();
        src.disconnect();
      } catch (_ignored) {}
    }
    activeSources.current = [];
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  /**
   * Suspend the AudioContext to pause streaming audio
   */
  const pauseStream = useCallback(() => {
    audioContext.current?.suspend();
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  /**
   * Resume the AudioContext to continue streaming audio
   */
  const playStream = useCallback(() => {
    if (audioContext.current) {
      audioContext.current.resume();
      onPlayingChange?.(true);
      return;
    }
  }, [onPlayingChange]);

  /**
   * Get current playback time from AudioContext
   */
  const getCurrentTime = useCallback((): number => {
    return audioContext.current?.currentTime ?? 0;
  }, []);

  /**
   * Clean up Web Audio API resources
   */
  const cleanup = useCallback(() => {
    if (audioContext.current) {
      audioContext.current.close();
      audioContext.current = null;
    }
    stopStream();
  }, [stopStream]);

  /**
   * Reset Web Audio API state
   */
  const resetState = useCallback(() => {
    stopStream();
    originalBuffer.current = null;
  }, [stopStream]);

  return {
    // Refs (access with .current)
    audioContext,
    originalBuffer,
    activeSources,
    isAudioPlaying,

    // States
    isAudioSuspended,

    // Methods
    stopStream,
    pauseStream,
    playStream,
    cleanup,
    resetState,
    getCurrentTime,
  };
}
