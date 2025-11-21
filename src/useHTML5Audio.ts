import { useRef, useEffect, useCallback } from 'react';

export interface UseHTML5AudioOptions {
  onPlayingChange?: (isPlaying: boolean) => void;
}

/**
 * Custom hook for managing HTML5 Audio API functionality
 * Handles HTMLAudioElement and related audio operations
 */
export default function useHTML5Audio(options: UseHTML5AudioOptions = {}) {
  const { onPlayingChange } = options;

  // HTML5 Audio API refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedCallback = useRef<(() => void) | null>(null);

  /**
   * Initialize HTML5 Audio element
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }
  }, []);

  /**
   * Stop HTML5 Audio playback and reset to beginning
   */
  const stopAudio = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  /**
   * Pause HTML5 Audio playback
   */
  const pauseAudio = useCallback(() => {
    audioRef.current?.pause();
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  /**
   * Play HTML5 Audio
   */
  const playAudio = useCallback(() => {
    audioRef.current?.play();
    onPlayingChange?.(true);
  }, [onPlayingChange]);

  /**
   * Rewind HTML5 Audio by specified seconds
   */
  const rewindAudio = useCallback(
    (seconds: number = 5, wasPlaying: boolean = false) => {
      if (!audioRef.current) return;
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - seconds);
      if (wasPlaying) {
        playAudio();
      }
    },
    [playAudio],
  );

  /**
   * Set up audio event listeners
   */
  const setupAudioListeners = useCallback((onCanPlay: () => void, onEnded: () => void) => {
    if (!audioRef.current) return;

    audioRef.current.addEventListener('canplay', onCanPlay, { once: true });

    onEndedCallback.current = onEnded;
    audioRef.current.addEventListener('ended', onEndedCallback.current);
  }, []);

  /**
   * Set audio source URL
   */
  const setAudioSource = useCallback((url: string) => {
    if (!audioRef.current) return;
    audioRef.current.src = url;
  }, []);

  /**
   * Set current playback time
   */
  const setCurrentTime = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
  }, []);

  /**
   * Get current playback time
   */
  const getCurrentTime = useCallback((): number => {
    return audioRef.current?.currentTime ?? 0;
  }, []);

  /**
   * Clean up HTML5 Audio resources
   */
  const cleanup = useCallback(() => {
    if (onEndedCallback.current) {
      audioRef.current?.removeEventListener('ended', onEndedCallback.current);
    }
    if (audioRef.current?.src) {
      URL.revokeObjectURL(audioRef.current.src);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  return {
    // Refs (access with .current)
    audioRef,

    // Methods
    stopAudio,
    pauseAudio,
    playAudio,
    rewindAudio,
    setupAudioListeners,
    setAudioSource,
    setCurrentTime,
    getCurrentTime,
    cleanup,
  };
}
