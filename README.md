# use-stream-audio

A React hook for streaming audio playback that combines the low-latency benefits of the Web Audio API with the stable playback controls of HTML5 Audio.

## Features

- **Dual Audio System**: Uses Web Audio API for low-latency streaming, then transitions to HTML5 Audio for stable playback controls
- **Stream Processing**: Play audio chunks as they arrive from a ReadableStream
- **Seamless Transition**: Automatically switches between audio systems without interrupting playback
- **Playback Controls**: Play, pause, stop, and rewind functionality
- **TypeScript Support**: Full TypeScript definitions included
- **React 18+ Compatible**: Works with both React 18 and 19

## Installation

```bash
npm install use-stream-audio
```

or

```bash
yarn add use-stream-audio
```

## Usage

### Basic Example

```tsx
import { useStreamAudio } from 'use-stream-audio';

function AudioPlayer() {
  const {
    streamAudio,
    play,
    pause,
    stop,
    isPlaying,
    currentTime,
    duration,
  } = useStreamAudio();

  const handleStream = async () => {
    // Your ReadableStream of audio data (Uint8Array chunks)
    const stream = await fetch('/api/audio-stream').then(res => res.body);

    if (stream) {
      await streamAudio(stream);
    }
  };

  return (
    <div>
      <button onClick={handleStream}>Start Streaming</button>
      <button onClick={play} disabled={!isPlaying}>Play</button>
      <button onClick={pause} disabled={!isPlaying}>Pause</button>
      <button onClick={stop}>Stop</button>
      <div>
        {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
      </div>
    </div>
  );
}
```

### Advanced Example with Options

```tsx
import { useStreamAudio } from 'use-stream-audio';

function AdvancedAudioPlayer() {
  const {
    streamAudio,
    play,
    pause,
    stop,
    rewind,
    isPlaying,
    isAudioSuspended,
    isRewindEnabled,
    currentTime,
    duration,
  } = useStreamAudio({
    sampleRate: 24000,
    enableTransition: true,
    onPlayingChange: (playing) => {
      console.log('Playing state changed:', playing);
    },
    onAudioReady: () => {
      console.log('Audio ready for HTML5 playback');
    },
    onEnded: () => {
      console.log('Playback ended');
    },
  });

  const handleRewind = () => {
    rewind(10); // Rewind 10 seconds
  };

  return (
    <div>
      {isAudioSuspended && (
        <p>Audio is suspended. Click anywhere to resume.</p>
      )}

      <button onClick={() => streamAudio(myStream)}>
        Start Streaming
      </button>

      <div>
        <button onClick={play}>Play</button>
        <button onClick={pause}>Pause</button>
        <button onClick={stop}>Stop</button>
        <button onClick={handleRewind} disabled={!isRewindEnabled}>
          Rewind 10s
        </button>
      </div>

      <div>
        Time: {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
      </div>
    </div>
  );
}
```

## API Reference

### `useStreamAudio(options?)`

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sampleRate` | `number` | `24000` | Sample rate for the audio context |
| `enableTransition` | `boolean` | `true` | Enable automatic transition to HTML5 Audio after streaming |
| `onPlayingChange` | `(playing: boolean) => void` | - | Callback when playback state changes |
| `onAudioReady` | `() => void` | - | Callback when audio is ready for HTML5 playback |
| `onEnded` | `() => void` | - | Callback when playback ends |

#### Returns

| Property | Type | Description |
|----------|------|-------------|
| `streamAudio` | `(stream: ReadableStream<Uint8Array>) => Promise<void>` | Start streaming audio from a ReadableStream |
| `play` | `() => void` | Resume playback |
| `pause` | `() => void` | Pause playback |
| `stop` | `() => void` | Stop playback and reset to beginning |
| `rewind` | `(seconds?: number) => void` | Rewind by specified seconds (only available after HTML5 transition) |
| `isPlaying` | `boolean` | Whether audio is currently playing |
| `isAudioSuspended` | `boolean` | Whether the audio context is suspended (typically on iOS/Safari) |
| `isRewindEnabled` | `boolean` | Whether rewind is available (after HTML5 transition) |
| `isAudioTransitioned` | `boolean` | Whether audio has transitioned to HTML5 playback |
| `currentTime` | `number` | Current playback time in seconds |
| `duration` | `number` | Total duration in seconds |

## How It Works

This hook implements a dual audio system:

1. **Web Audio API (Streaming Phase)**
   - Audio chunks are received from a ReadableStream
   - Each chunk is immediately scheduled for playback using AudioContext
   - Provides low-latency streaming with minimal buffering
   - Perfect for real-time audio streaming

2. **HTML5 Audio (Playback Phase)**
   - Once streaming completes, all chunks are combined into a single buffer
   - Converted to WAV format and loaded into an HTMLAudioElement
   - Provides stable playback controls (seek, rewind, etc.)
   - Allows for better user control after initial streaming

The transition between the two systems is seamless and happens automatically when `enableTransition` is true.

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari/iOS Safari: Full support (handles AudioContext suspension automatically)

## Credits

Based on the implementation by [@n1ckoates](https://github.com/ai-ng/swift/blob/main/app/lib/usePlayer.ts)

## License

MIT
