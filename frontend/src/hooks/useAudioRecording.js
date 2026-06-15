import { useState, useRef, useEffect, useCallback } from 'react';

export default function useAudioRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingError, setRecordingError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const isRecordingRef = useRef(false);

  const startRecording = useCallback(() => {
    const stream = window.localStream;
    if (!stream || !stream.getAudioTracks().length) {
      setRecordingError('No microphone detected. Join the meeting first.');
      return;
    }

    setRecordingError(null);
    setAudioBlob(null);
    audioChunksRef.current = [];

    try {
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onerror = () => {
        setRecordingError('Audio recording error occurred.');
        setIsRecording(false);
        isRecordingRef.current = false;
        clearInterval(timerRef.current);
        setRecordingDuration(0);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        setAudioBlob(blob);
        setIsRecording(false);
        isRecordingRef.current = false;
        clearInterval(timerRef.current);
        setRecordingDuration(0);
      };

      recorder.start();
      setIsRecording(true);
      isRecordingRef.current = true;

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (e) {
      setRecordingError('MediaRecorder is not supported in this browser.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const resetRecording = useCallback(() => {
    setAudioBlob(null);
    setRecordingError(null);
    setRecordingDuration(0);
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  return {
    isRecording,
    recordingDuration,
    audioBlob,
    recordingError,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
