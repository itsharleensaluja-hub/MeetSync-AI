import { createContext, useContext } from 'react';
import useAudioRecording from '../hooks/useAudioRecording';

const RecordingContext = createContext(null);

export function RecordingProvider({ children }) {
  return (
    <RecordingContext.Provider value={useAudioRecording()}>
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  const ctx = useContext(RecordingContext);
  if (!ctx) {
    throw new Error('useRecording must be used within a RecordingProvider');
  }
  return ctx;
}
